import 'dotenv/config';
import {
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

/**
 * Build instructions from the user's onboarding answers + current trigger.
 * The AI speaks AS the user's future self, referencing their actual words.
 */
function buildInstructions(ctx) {
  const triggers = (ctx.onb_triggers || []).join(', ') || 'unspecified';
  const innerVoice = ctx.inner_voice || '(not provided)';
  const bestSelf = ctx.best_self || '(not provided)';
  const grounding = ctx.grounding || 'breath';
  const trigger = ctx.trigger || 'general';
  const moment = ctx.context || '';

  return `You are this person's own future self — the version they described becoming in 6 months: "${bestSelf}". You speak to them in second person ("you", never "I" or "we") with calm, warm, ungimmicky presence. You are NOT a therapist, NOT a coach, NOT a chatbot. You are them, six months from now, reaching back.

CONTEXT YOU KNOW ABOUT THIS PERSON:
- Their compulsive loops: ${triggers}
- The voice in their head when it hits: "${innerVoice}"
- What grounds them when it works: ${grounding}
- Right now they pressed the button because of: ${trigger}
- What they just said is happening: "${moment}"

YOUR JOB IN THIS SESSION:
1. Open with one short sentence that acknowledges THIS exact moment — reference what they said, in their words. Do not be generic.
2. Lead a 3-5 minute somatic intervention. Pick ONE based on the trigger:
   - Doomscrolling / overeating / acute spiral → breathwork (box breathing or extended exhale)
   - Relationship pain / shame / rumination → guided body scan + reframe
   - Anxiety / physical tension → simple grounding 5-4-3-2-1
   - Stagnation / numbness → guided movement (stand, shake, posture reset)
   - Can't sleep → slow body scan from feet up, lengthening exhale
3. Speak in short sentences. Pause naturally. If they speak, listen first, then continue gently.
4. End with ONE sentence bridging back to action. Not a command. A soft pointer. Example: "What's one thing you can do in the next ten minutes?"

VOICE RULES:
- Second person always. You. Not I, not we.
- Never break the future-self frame.
- Avoid the words "meditation", "mindfulness", "wellness", "journey", "I'm here for you".
- Short sentences. Plain words. Like a voice note from someone who knows them.
- If they go silent, that's fine. Continue the somatic work.`;
}

async function fetchSessionContext(roomName) {
  try {
    const url = `${BACKEND_URL}/api/internal/session-context/${encodeURIComponent(roomName)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[agent] could not fetch context for ${roomName}: ${res.status}`);
      return {};
    }
    return await res.json();
  } catch (err) {
    console.warn(`[agent] context fetch error: ${err.message}`);
    return {};
  }
}

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx) => {
    await ctx.connect();
    console.log(`[agent] joined room ${ctx.room.name}`);

    const participant = await ctx.waitForParticipant();
    console.log(`[agent] participant joined: ${participant.identity}`);

    // Pull session-specific personalization from backend
    const sessionCtx = await fetchSessionContext(ctx.room.name);
    const instructions = buildInstructions(sessionCtx);
    console.log(`[agent] trigger=${sessionCtx.trigger || 'unknown'} ctx="${(sessionCtx.context || '').slice(0, 60)}"`);

    // Build the agent with our personalized instructions
    const agent = new voice.Agent({ instructions });

    // The session: VAD + STT + LLM + TTS
    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad,
      stt: new deepgram.STT({ model: 'nova-2-general', language: 'en-US' }),
      llm: new openai.LLM({ model: 'gpt-4o-mini', temperature: 0.7 }),
      tts: new deepgram.TTS({ model: 'aura-asteria-en' }),
    });

    await session.start({
      agent,
      room: ctx.room,
    });

    console.log('[agent] session started, generating opening reply');

    // Kick off — agent speaks first. Pass an explicit instruction so it doesn't
    // wait for the user to say something first.
    try {
      await session.generateReply({
        instructions: `Greet the person warmly. In ONE short sentence, acknowledge that they pressed the button about ${sessionCtx.trigger || 'this'}${sessionCtx.context ? ` and what they said: "${sessionCtx.context}"` : ''}. Then immediately begin the somatic intervention without asking for more input. Speak naturally, like a voice note.`,
      });
      console.log('[agent] opening reply triggered');
    } catch (err) {
      console.error('[agent] generateReply error:', err);
    }
  },
});

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
  })
);
