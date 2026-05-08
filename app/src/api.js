import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Read backend URL from app.json `extra` — set via EAS env or local dev
// For local dev on physical device: use your machine's LAN IP, not localhost
const BACKEND_URL =
  Constants.expoConfig?.extra?.BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://10.0.2.2:3000'; // Android emulator default for host localhost

async function req(path, opts = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// Stable per-install device id
async function getDeviceId() {
  let id = await AsyncStorage.getItem('@nh:device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem('@nh:device_id', id);
  }
  return id;
}

export const api = {
  backendUrl: BACKEND_URL,

  async registerDevice() {
    const device_id = await getDeviceId();
    return req('/api/users', {
      method: 'POST',
      body: JSON.stringify({ device_id }),
    });
  },

  async submitOnboarding(payload) {
    return req('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async startSession({ user_id, trigger, context }) {
    return req('/api/session/start', {
      method: 'POST',
      body: JSON.stringify({ user_id, trigger, context }),
    });
  },

  async getExercises({ user_id, trigger, context }) {
    return req('/api/exercises', {
      method: 'POST',
      body: JSON.stringify({ user_id, trigger, context }),
    });
  },

  async endSession(room_name) {
    return req('/api/session/end', {
      method: 'POST',
      body: JSON.stringify({ room_name }),
    });
  },

  async getMetric(user_id) {
    return req(`/api/metric/${user_id}`);
  },
};
