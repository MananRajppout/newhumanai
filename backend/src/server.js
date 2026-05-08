import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
