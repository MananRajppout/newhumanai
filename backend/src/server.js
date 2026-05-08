import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------- Health ----------
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ---------- Users / Onboarding ----------

// Register or fetch a user by device_id (stable per install)
app.post('/api/users', async (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });

  try {
    const result = await pool.query(
      `INSERT INTO users (device_id) VALUES ($1)
       ON CONFLICT (device_id) DO UPDATE SET device_id = EXCLUDED.device_id
       RETURNING id, device_id, created_at`,
      [device_id]
    );

    const user = result.rows[0];
    const onb = await pool.query('SELECT * FROM onboarding WHERE user_id = $1', [user.id]);

    res.json({
      user,
      onboarded: onb.rows.length > 0,
      onboarding: onb.rows[0] || null,
    });
  } catch (err) {
    console.error('users error', err);
    res.status(500).json({ error: err.message });
  }
});

// Save onboarding answers
app.post('/api/onboarding', async (req, res) => {
  const { user_id, triggers, inner_voice, best_self, loop_time, grounding, voice_opt_in } = req.body;

  if (!user_id || !Array.isArray(triggers) || triggers.length === 0) {
    return res.status(400).json({ error: 'user_id and triggers[] required' });
  }

  try {
    await pool.query(
      `INSERT INTO onboarding (user_id, triggers, inner_voice, best_self, loop_time, grounding, voice_opt_in)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         triggers = EXCLUDED.triggers,
         inner_voice = EXCLUDED.inner_voice,
         best_self = EXCLUDED.best_self,
         loop_time = EXCLUDED.loop_time,
         grounding = EXCLUDED.grounding,
         voice_opt_in = EXCLUDED.voice_opt_in,
         completed_at = NOW()`,
      [user_id, triggers, inner_voice || '', best_self || '', loop_time || '', grounding || '', !!voice_opt_in]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('onboarding error', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Session start: mint LiveKit token + create session row ----------
app.post('/api/session/start', async (req, res) => {
  const { user_id, trigger, context } = req.body;
  if (!user_id || !trigger) {
    return res.status(400).json({ error: 'user_id and trigger required' });
  }

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET ||
      process.env.LIVEKIT_API_SECRET.startsWith('REPLACE_ME')) {
    return res.status(500).json({
      error: 'LiveKit credentials not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in backend/.env'
    });
  }

  try {
    const room_name = `nh-${randomUUID().slice(0, 8)}`;
    const identity = `user-${user_id.slice(0, 8)}`;

    // Save session row + onboarding context for the agent to read
    await pool.query(
      `INSERT INTO sessions (user_id, trigger, context, room_name) VALUES ($1, $2, $3, $4)`,
      [user_id, trigger, context || '', room_name]
    );

    // Mint token
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity,
      ttl: '15m',
      // Stash session metadata so the agent gets it via room metadata
      metadata: JSON.stringify({ user_id, trigger, context: context || '' }),
    });
    at.addGrant({
      roomJoin: true,
      room: room_name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    res.json({
      token,
      url: process.env.LIVEKIT_URL,
      room: room_name,
    });
  } catch (err) {
    console.error('session/start error', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Session end ----------
app.post('/api/session/end', async (req, res) => {
  const { room_name } = req.body;
  if (!room_name) return res.status(400).json({ error: 'room_name required' });

  try {
    await pool.query(
      `UPDATE sessions SET ended_at = NOW() WHERE room_name = $1 AND ended_at IS NULL`,
      [room_name]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Exercise generation ----------
// GPT picks 3 somatic exercises from a fixed library, personalizing the text per trigger + moment.
// The library is constrained so every exercise has a polished animation in the app.

const EXERCISE_LIBRARY = `
Available animation primitives (you MUST pick from these — no others):

1. "breathing-circle" — orb that expands on inhale, holds, contracts on exhale, holds.
   Best for: acute spirals, doomscrolling, anxiety, can't sleep.
   Params: { inhale_sec, hold_in_sec, exhale_sec, hold_out_sec, cycles }
   Typical: { inhale_sec: 4, hold_in_sec: 4, exhale_sec: 4, hold_out_sec: 4, cycles: 4 } for box breathing
   Or: { inhale_sec: 4, hold_in_sec: 0, exhale_sec: 8, hold_out_sec: 0, cycles: 5 } for extended exhale

2. "count-down" — large number ticking down from N to 0, with a settling line of text below it.
   Best for: impulse-pause moments, overeating, alcohol cravings.
   Params: { from_seconds, body_text }

3. "text-reveal" — series of short prompts that fade in one by one, user reads each silently.
   Best for: 5-4-3-2-1 grounding, overthinking, rumination.
   Params: { lines: ["5 things you can see", "4 things you can hear", ...] }
   Use 3-6 lines, each under 8 words.

4. "pulse" — small dot that pulses at a slow rate (heartbeat-like ~60bpm or slower), with a single fixed line of text.
   Best for: shame, relationship pain, hand-on-heart moments.
   Params: { duration_sec, body_text, bpm }
   Typical: { duration_sec: 30, bpm: 50 }

5. "body-scan" — vertical orb that travels slowly down the screen with body part labels appearing as it passes.
   Best for: sleep, body tension, somatic disconnection.
   Params: { duration_sec, parts: ["head", "shoulders", "chest", "belly", "hips", "legs", "feet"] }
`;

app.post('/api/exercises', async (req, res) => {
  const { user_id, trigger, context } = req.body;
  if (!user_id || !trigger) {
    return res.status(400).json({ error: 'user_id and trigger required' });
  }

  try {
    // Pull onboarding for personalization
    const { rows } = await pool.query(
      `SELECT triggers, inner_voice, best_self, loop_time, grounding FROM onboarding WHERE user_id = $1`,
      [user_id]
    );
    const onb = rows[0] || {};

    const systemPrompt = `You are designing a 3-step somatic intervention for someone in the middle of a compulsive loop. They will see these exercises one at a time, full-screen, before a voice session begins.

${EXERCISE_LIBRARY}

YOUR JOB:
- Output a JSON object with a "exercises" array of EXACTLY 3 exercises.
- Each exercise has: { "type": "<one of the 5 above>", "title": "...", "intro": "...", "params": {...}, "outro": "..." }
- "title" — 2-4 words, sentence case (e.g. "Box breathing", "Just 30 seconds")
- "intro" — ONE short sentence in second person. MUST reference their specific situation — quote or paraphrase what they said is happening, or directly name the trigger. "Let's start by focusing on your breath" is BANNED, that's generic. "You said it feels like you haven't eaten in days — start here" is right. If they didn't say anything, name the trigger directly: "Doomscrolling has you. Start here."
- "outro" — ONE short sentence affirming what they just did. Calm, plain words. NOT "Remember these affirmations" — too coachy. Try "You're back" or "Better." or "One more."
- Sequence the 3 exercises from most physiologically activating (calms the nervous system fastest) → grounding → settling. So a typical sequence:
  1st: breathing-circle (immediate downregulation)
  2nd: text-reveal or count-down (reorient attention)
  3rd: pulse or body-scan (settle in)
- Match exercises to the trigger:
  * doomscrolling/phone → breathing-circle, then text-reveal (5-4-3-2-1), then pulse
  * overeating/food → breathing-circle (extended exhale), then count-down (60s), then body-scan
  * alcohol/substances → count-down, then breathing-circle, then text-reveal
  * relationships/shame → breathing-circle, then pulse (hand on heart), then text-reveal
  * can't sleep → body-scan, then breathing-circle (extended exhale), then pulse
  * overthinking → text-reveal, then breathing-circle, then body-scan
- Voice rules: "you" not "I" or "we". No words like "meditation", "mindfulness", "journey", "wellness".
- Keep all text plain, short, written like a friend who knows them.

OUTPUT: ONLY valid JSON. No markdown fences. No commentary.`;

    const userPrompt = `Trigger: ${trigger}
What they said is happening right now: "${context || '(they did not say)'}"
Their compulsive loops: ${(onb.triggers || []).join(', ') || 'unspecified'}
The voice in their head: "${onb.inner_voice || 'unspecified'}"
Their best self in 6 months: "${onb.best_self || 'unspecified'}"
What grounds them when it works: ${onb.grounding || 'breath'}

Generate the 3-exercise sequence as JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('GPT returned invalid JSON:', raw);
      throw new Error('Could not parse AI response');
    }

    if (!parsed.exercises || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      throw new Error('AI did not return exercises');
    }

    // Validate each exercise has a known type
    const VALID_TYPES = new Set(['breathing-circle', 'count-down', 'text-reveal', 'pulse', 'body-scan']);
    for (const ex of parsed.exercises) {
      if (!VALID_TYPES.has(ex.type)) {
        console.warn(`AI returned unknown type "${ex.type}", coercing to breathing-circle`);
        ex.type = 'breathing-circle';
        ex.params = { inhale_sec: 4, hold_in_sec: 4, exhale_sec: 4, hold_out_sec: 4, cycles: 4 };
      }
    }

    res.json({ exercises: parsed.exercises.slice(0, 3) });
  } catch (err) {
    console.error('exercises error', err);
    // Fallback: return a generic 3-exercise sequence so the demo never breaks
    res.json({
      exercises: [
        {
          type: 'breathing-circle',
          title: 'Slow it down',
          intro: 'Start here. Just breathe.',
          params: { inhale_sec: 4, hold_in_sec: 0, exhale_sec: 8, hold_out_sec: 0, cycles: 4 },
          outro: 'Good.',
        },
        {
          type: 'text-reveal',
          title: 'Come back',
          intro: 'Notice what is around you.',
          params: { lines: ['5 things you can see', '4 things you can touch', '3 things you can hear', '2 things you can smell', '1 thing you can taste'] },
          outro: 'You are here.',
        },
        {
          type: 'pulse',
          title: 'Settle',
          intro: 'A hand on your chest, if you want.',
          params: { duration_sec: 25, body_text: 'You are safe right now.', bpm: 50 },
          outro: 'Ready.',
        },
      ],
      fallback: true,
    });
  }
});

// ---------- Single metric: chosen-yourself count this month ----------
app.get('/api/metric/:user_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM sessions
       WHERE user_id = $1
         AND started_at >= date_trunc('month', NOW())`,
      [req.params.user_id]
    );
    res.json({ chosen_yourself: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Internal: get session context for agent ----------
// The agent worker calls this with room_name to fetch user onboarding + trigger
app.get('/api/internal/session-context/:room_name', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.trigger, s.context, s.user_id,
              o.triggers AS onb_triggers, o.inner_voice, o.best_self, o.loop_time, o.grounding
       FROM sessions s
       LEFT JOIN onboarding o ON o.user_id = s.user_id
       WHERE s.room_name = $1
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [req.params.room_name]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'session not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌑 newhuman backend listening on :${PORT}`);
  console.log(`   LiveKit URL: ${process.env.LIVEKIT_URL}`);
});
