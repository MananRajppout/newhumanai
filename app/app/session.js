import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LiveKitRoom,
  useRoomContext,
  AudioSession,
  useTracks,
  useLocalParticipant,
} from '@livekit/react-native';
import { Track, RoomEvent } from 'livekit-client';
import GlowOrb from '../src/components/GlowOrb';
import { colors, type, spacing, radius } from '../src/theme';
import { api } from '../src/api';

export default function SessionScreen() {
  const router = useRouter();
  const { trigger, context } = useLocalSearchParams();

  const [token, setToken] = useState(null);
  const [url, setUrl] = useState(null);
  const [room, setRoomName] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await AudioSession.startAudioSession();
        const userId = await AsyncStorage.getItem('@nh:user_id');
        const r = await api.startSession({
          user_id: userId,
          trigger,
          context: context || '',
        });
        if (cancelled) return;
        setToken(r.token);
        setUrl(r.url);
        setRoomName(r.room);
      } catch (e) {
        setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
      AudioSession.stopAudioSession();
    };
  }, []);

  const onEnd = async () => {
    if (room) { try { await api.endSession(room); } catch {} }
    router.replace('/home');
  };

  // While token is loading, show the orb in a "connecting" state — same visual
  // language as the active session, so it doesn't feel like a loading screen.
  if (!token || !url || error) {
    return (
      <View style={styles.root}>
        <Text style={[type.label, styles.label]}>
          {String(trigger || '').toUpperCase()}
        </Text>

        <View style={styles.orbHolder}>
          <GlowOrb size={200} intensity={0.6}>
            <View style={styles.orbCore} />
          </GlowOrb>
        </View>

        {error ? (
          <>
            <Text style={styles.statusError}>Could not connect</Text>
            <Text style={styles.errorMsg}>{error}</Text>
          </>
        ) : (
          <>
            <Text style={styles.status}>Settling in</Text>
            <Text style={styles.hint}>One moment.</Text>
          </>
        )}

        <Pressable style={styles.endBtn} onPress={onEnd}>
          <Text style={styles.endText}>{error ? 'Back' : 'Cancel'}</Text>
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
  const [connected, setConnected] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);

  // Mount mic track so audio actually flows
  useTracks([Track.Source.Microphone]);

  useEffect(() => {
    if (!room) return;

    const onConnected = () => setConnected(true);
    const onParticipantConnected = (p) => {
      if (p.identity !== localParticipant?.identity) setAgentJoined(true);
    };
    // ActiveSpeakersChanged is driven server-side by LiveKit's audio level analysis,
    // which combined with our Silero VAD on the agent side gives clean turn-taking signal.
    const onActiveSpeakers = (speakers) => {
      const localId = localParticipant?.identity;
      setAgentSpeaking(speakers.some((s) => s.identity !== localId));
      setUserSpeaking(speakers.some((s) => s.identity === localId));
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);

    if (room.state === 'connected') setConnected(true);
    room.remoteParticipants.forEach((p) => {
      if (p.identity !== localParticipant?.identity) setAgentJoined(true);
    });

    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
    };
  }, [room, localParticipant]);

  const status = !connected
    ? 'Settling in'
    : !agentJoined
    ? 'Almost there'
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
          size={220}
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
    paddingTop: 80,
    paddingHorizontal: spacing.lg,
  },
  label: { textAlign: 'center', marginBottom: spacing.xxl },

  orbHolder: {
    marginVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },

  status: {
    color: colors.accentBright,
    fontSize: 14,
    letterSpacing: 3,
    marginTop: spacing.xl,
    textTransform: 'uppercase',
  },
  statusError: {
    color: colors.danger,
    fontSize: 14,
    letterSpacing: 3,
    marginTop: spacing.xl,
    textTransform: 'uppercase',
  },
  errorMsg: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },

  endBtn: {
    marginTop: 'auto',
    marginBottom: 60,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  endText: {
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 1,
  },
});
