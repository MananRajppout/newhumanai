import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, PermissionsAndroid, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LiveKitRoom,
  useRoomContext,
  AudioSession,
  useTracks,
  useLocalParticipant,
  AndroidAudioTypePresets,
} from '@livekit/react-native';
import { Track, RoomEvent } from 'livekit-client';
import GlowOrb from '../src/components/GlowOrb';
import { colors, type, spacing, radius } from '../src/theme';
import { api } from '../src/api';

/**
 * Request RECORD_AUDIO at runtime. Android 6+ needs this — manifest alone is not enough.
 * Returns true if granted, false otherwise.
 */
async function ensureMicPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone access',
        message: 'newhuman.ai needs your mic so the session can hear you.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Mic permission error:', err);
    return false;
  }
}

export default function SessionScreen() {
  const router = useRouter();
  const { trigger, context } = useLocalSearchParams();

  const [phase, setPhase] = useState('init'); // init | permission | connecting | ready | error
  const [token, setToken] = useState(null);
  const [url, setUrl] = useState(null);
  const [room, setRoomName] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Mic permission first
        setPhase('permission');
        const ok = await ensureMicPermission();
        if (!ok) {
          throw new Error('Microphone permission was not granted. Enable it in Settings → Apps → newhuman.ai → Permissions.');
        }

        // 2. Configure audio for MEDIA playback (speaker), not communication (earpiece).
        // This is THE fix for "I can't hear the AI" — by default LiveKit uses
        // communication mode which routes to the small earpiece at the top of the phone,
        // making the agent's voice nearly inaudible.
        setPhase('connecting');
        try {
          await AudioSession.configureAudio({
            android: {
              audioTypeOptions: AndroidAudioTypePresets.media,
            },
          });
        } catch (cfgErr) {
          console.warn('AudioSession.configureAudio failed (non-fatal):', cfgErr?.message);
        }
        await AudioSession.startAudioSession();

        // 3. Get a token from backend
        const userId = await AsyncStorage.getItem('@nh:user_id');
        if (!userId) throw new Error('No user_id found. Please re-do onboarding.');

        const r = await api.startSession({
          user_id: userId,
          trigger,
          context: context || '',
        });

        if (cancelled) return;
        setToken(r.token);
        setUrl(r.url);
        setRoomName(r.room);
        setPhase('ready');
      } catch (e) {
        console.error('Session init error:', e);
        setError(e.message || String(e));
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  const onEnd = async () => {
    if (room) { try { await api.endSession(room); } catch {} }
    router.replace('/home');
  };

  // Pre-connection states — show orb so it doesn't feel like a loading screen
  if (phase !== 'ready') {
    const statusText = {
      init: 'Settling in',
      permission: 'Asking for mic',
      connecting: 'Connecting',
      error: 'Could not connect',
    }[phase];

    return (
      <View style={styles.root}>
        <Text style={[type.label, styles.label]}>{String(trigger || '').toUpperCase()}</Text>

        <View style={styles.orbHolder}>
          <GlowOrb size={180} intensity={0.6}>
            <View style={styles.orbCore} />
          </GlowOrb>
        </View>

        <Text style={phase === 'error' ? styles.statusError : styles.status}>
          {statusText}
        </Text>

        {phase === 'error' && error && (
          <Text style={styles.errorMsg}>{error}</Text>
        )}

        <Pressable style={styles.endBtn} onPress={onEnd}>
          <Text style={styles.endText}>{phase === 'error' ? 'Back' : 'Cancel'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect={true}
      audio={true}
      video={false}
      options={{ adaptiveStream: false, dynacast: false }}
      onError={(e) => {
        console.error('LiveKit room error:', e);
        setError(e?.message || 'Room error');
        setPhase('error');
      }}
    >
      <SessionUI trigger={String(trigger || '')} onEnd={onEnd} />
    </LiveKitRoom>
  );
}

function SessionUI({ trigger, onEnd }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [debug, setDebug] = useState('');

  // CRITICAL: subscribe to BOTH the user's mic AND the agent's audio.
  // Without this, you can't hear the agent.
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });

  useEffect(() => {
    if (!room) return;

    const refresh = () => {
      const remotes = Array.from(room.remoteParticipants.values());
      const agentHere = remotes.length > 0;
      setAgentJoined(agentHere);
      setDebug(`local:${localParticipant?.identity || '?'} remotes:${remotes.length} state:${room.state}`);
    };

    const onActiveSpeakers = (speakers) => {
      const localId = localParticipant?.identity;
      setAgentSpeaking(speakers.some((s) => s.identity !== localId));
      setUserSpeaking(speakers.some((s) => s.identity === localId));
    };

    const onConnStateChanged = () => refresh();

    room.on(RoomEvent.ParticipantConnected, refresh);
    room.on(RoomEvent.ParticipantDisconnected, refresh);
    room.on(RoomEvent.ConnectionStateChanged, onConnStateChanged);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
    room.on(RoomEvent.TrackSubscribed, refresh);

    refresh();

    return () => {
      room.off(RoomEvent.ParticipantConnected, refresh);
      room.off(RoomEvent.ParticipantDisconnected, refresh);
      room.off(RoomEvent.ConnectionStateChanged, onConnStateChanged);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
      room.off(RoomEvent.TrackSubscribed, refresh);
    };
  }, [room, localParticipant]);

  const status = !agentJoined
    ? 'Waking your future self'
    : agentSpeaking
    ? 'Speaking'
    : userSpeaking
    ? 'Listening to you'
    : 'Listening';

  return (
    <View style={styles.root}>
      <Text style={[type.label, styles.label]}>{trigger.toUpperCase()}</Text>

      <View style={styles.orbHolder}>
        <GlowOrb
          size={180}
          intensity={agentJoined ? 1 : 0.6}
          speaking={agentSpeaking || userSpeaking}
          filled={agentJoined}
        >
          <View style={styles.orbCore} />
        </GlowOrb>
      </View>

      <Text style={styles.status}>{status}</Text>
      <Text style={styles.hint}>
        Speak when you want. Or just listen.{'\n'}There is nothing to do.
      </Text>

      {/* Tiny debug line at bottom — helps if something's wrong, invisible if not looking */}
      {!!debug && <Text style={styles.debug}>{debug}</Text>}

      <Pressable style={styles.endBtn} onPress={onEnd}>
        <Text style={styles.endText}>End session</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  label: { textAlign: 'center', marginBottom: spacing.xl },

  orbHolder: {
    marginVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },

  status: {
    color: colors.accentBright,
    fontSize: 13,
    letterSpacing: 3,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  statusError: {
    color: colors.danger,
    fontSize: 13,
    letterSpacing: 3,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  errorMsg: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    lineHeight: 19,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
  debug: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    fontFamily: 'monospace',
    position: 'absolute',
    bottom: 110,
    textAlign: 'center',
  },

  endBtn: {
    marginTop: 'auto',
    marginBottom: 50,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  endText: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
});
