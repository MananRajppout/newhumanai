import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  triggers TEXT[] NOT NULL DEFAULT '{}',
  inner_voice TEXT,
  best_self TEXT,
  loop_time TEXT,
  grounding TEXT,
  voice_opt_in BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  context TEXT,
  room_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
`;

async function main() {
  try {
    await pool.query(SCHEMA);
    console.log('✅ Database schema initialized');

    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`   Users in DB: ${rows[0].count}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ DB init failed:', err.message);
    process.exit(1);
  }
}

main();
