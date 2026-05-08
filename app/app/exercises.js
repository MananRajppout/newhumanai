import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors, type, spacing, radius } from '../src/theme';
import { api } from '../src/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ExercisesScreen() {
  const router = useRouter();
  const { trigger, context } = useLocalSearchParams();

  const [exercises, setExercises] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);

  // Fetch exercises
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userId = await AsyncStorage.getItem('@nh:user_id');
        const r = await api.getExercises({
          user_id: userId,
          trigger,
          context: context || '',
        });
        if (cancelled) return;
        if (!r.exercises || r.exercises.length === 0) throw new Error('No exercises returned');
        setExercises(r.exercises);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onDone = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (idx < exercises.length - 1) {
      setIdx(idx + 1);
    } else {
      // All exercises done → go to voice session
      router.replace({
        pathname: '/session',
        params: { trigger, context: context || '' },
      });
    }
  };

  const onSkip = () => {
    router.replace({
      pathname: '/session',
      params: { trigger, context: context || '' },
    });
  };

  // Loading state
  if (!exercises && !error) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <View style={styles.loadingOrb}>
            <View style={styles.loadingOrbCore} />
          </View>
          <Text style={styles.loadingLabel}>{String(trigger || '').toUpperCase()}</Text>
          <Text style={styles.loadingHint}>Settling in</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorMsg}>Couldn't reach the AI.{'\n'}{error}</Text>
          <Pressable style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Continue to voice</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const ex = exercises[idx];
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Progress pips at top */}
      <View style={styles.pips}>
        {exercises.map((_, i) => (
          <View
            key={i}
            style={[styles.pip, i === idx && styles.pipActive, i < idx && styles.pipDone]}
          />
        ))}
      </View>

      {/* Skip in top right */}
      <Pressable style={styles.skipTop} onPress={onSkip} hitSlop={12}>
        <Text style={styles.skipTopText}>Skip</Text>
      </Pressable>

      {/* Top: title and intro */}
      <View style={styles.header}>
        <Text style={styles.exTitle}>{ex.title}</Text>
        {!!ex.intro && <Text style={styles.exIntro}>{ex.intro}</Text>}
      </View>

      {/* Middle: animation */}
      <View style={styles.animationArea}>
        <ExerciseAnimation key={`${idx}-${ex.type}`} ex={ex} />
      </View>

      {/* Bottom: outro and Done button */}
      <View style={styles.footer}>
        {!!ex.outro && <Text style={styles.exOutro}>{ex.outro}</Text>}
        <Pressable style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneText}>
            {idx < exercises.length - 1 ? 'Done' : 'Begin voice session'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// Animation primitives — one component per exercise type
// ============================================================================

function ExerciseAnimation({ ex }) {
  switch (ex.type) {
    case 'breathing-circle': return <BreathingCircle params={ex.params || {}} />;
    case 'count-down': return <CountDown params={ex.params || {}} />;
    case 'text-reveal': return <TextReveal params={ex.params || {}} />;
    case 'pulse': return <Pulse params={ex.params || {}} />;
    case 'body-scan': return <BodyScan params={ex.params || {}} />;
    default: return <BreathingCircle params={{}} />;
  }
}

/* ---------- 1. Breathing circle ---------- */

function BreathingCircle({ params }) {
  const inhale = (params.inhale_sec || 4) * 1000;
  const holdIn = (params.hold_in_sec || 0) * 1000;
  const exhale = (params.exhale_sec || 4) * 1000;
  const holdOut = (params.hold_out_sec || 0) * 1000;
  const cycles = params.cycles || 4;

  const scale = useSharedValue(0.55);
  const [phase, setPhase] = useState('Breathe in');
  const [cycleNum, setCycleNum] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let cycle = 0;

    const runCycle = () => {
      if (cancelled || cycle >= cycles) return;
      cycle++;
      setCycleNum(cycle);

      // Inhale
      setPhase('Breathe in');
      scale.value = withTiming(1, { duration: inhale, easing: Easing.inOut(Easing.quad) });

      const t1 = setTimeout(() => {
        if (cancelled) return;
        if (holdIn > 0) {
          setPhase('Hold');
          // no scale change
        } else {
          setPhase('Breathe out');
          scale.value = withTiming(0.55, { duration: exhale, easing: Easing.inOut(Easing.quad) });
        }

        const t2 = setTimeout(() => {
          if (cancelled) return;
          if (holdIn > 0) {
            setPhase('Breathe out');
            scale.value = withTiming(0.55, { duration: exhale, easing: Easing.inOut(Easing.quad) });
            const t3 = setTimeout(() => {
              if (cancelled) return;
              if (holdOut > 0) {
                setPhase('Hold');
                setTimeout(runCycle, holdOut);
              } else {
                runCycle();
              }
            }, exhale);
          } else {
            if (holdOut > 0) {
              setPhase('Hold');
              setTimeout(runCycle, holdOut);
            } else {
              runCycle();
            }
          }
        }, holdIn || exhale);
      }, inhale);
    };

    runCycle();

    return () => {
      cancelled = true;
      cancelAnimation(scale);
    };
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={animStyles.center}>
      <Animated.View style={[animStyles.bigOrbHalo, orbStyle]} />
      <Animated.View style={[animStyles.bigOrb, orbStyle]} />
      <View style={animStyles.bigOrbCore} />
      <Text style={animStyles.phaseText}>{phase}</Text>
      <Text style={animStyles.cycleText}>{cycleNum} / {cycles}</Text>
    </View>
  );
}

/* ---------- 2. Count down ---------- */

function CountDown({ params }) {
  const total = params.from_seconds || 60;
  const bodyText = params.body_text || '';
  const [remaining, setRemaining] = useState(total);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, total - elapsed);
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.4,
    transform: [{ scale: 1 + pulse.value * 0.05 }],
  }));

  return (
    <View style={animStyles.center}>
      <Animated.View style={[animStyles.countRing, ringStyle]} />
      <Text style={animStyles.countNumber}>{remaining}</Text>
      <Text style={animStyles.countLabel}>seconds</Text>
      {!!bodyText && <Text style={animStyles.countBody}>{bodyText}</Text>}
    </View>
  );
}

/* ---------- 3. Text reveal (5-4-3-2-1 grounding) ---------- */

function TextReveal({ params }) {
  const lines = Array.isArray(params.lines) && params.lines.length > 0
    ? params.lines
    : ['5 things you can see', '4 things you can touch', '3 things you can hear', '2 things you can smell', '1 thing you can taste'];

  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timers = [];
    lines.forEach((_, i) => {
      const t = setTimeout(() => setShown(i + 1), 6000 * (i + 1));
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <View style={animStyles.revealList}>
      {lines.map((line, i) => (
        <RevealLine key={i} line={line} visible={i < shown} />
      ))}
    </View>
  );
}

function RevealLine({ line, visible }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) });
      translateY.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.quad) });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style}>
      <Text style={animStyles.revealLine}>{line}</Text>
    </Animated.View>
  );
}

/* ---------- 4. Pulse (heartbeat) ---------- */

function Pulse({ params }) {
  const bodyText = params.body_text || '';
  const bpm = params.bpm || 50;
  const period = 60000 / bpm;

  const scale = useSharedValue(0.85);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: period * 0.35, easing: Easing.out(Easing.quad) }),
        withTiming(0.85, { duration: period * 0.65, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(scale);
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + (scale.value - 0.85) * 2,
    transform: [{ scale: scale.value * 1.3 }],
  }));

  return (
    <View style={animStyles.center}>
      <Animated.View style={[animStyles.pulseHalo, haloStyle]} />
      <Animated.View style={[animStyles.pulseDot, dotStyle]} />
      {!!bodyText && <Text style={animStyles.pulseBody}>{bodyText}</Text>}
    </View>
  );
}

/* ---------- 5. Body scan ---------- */

function BodyScan({ params }) {
  const duration = (params.duration_sec || 30) * 1000;
  const parts = Array.isArray(params.parts) && params.parts.length > 0
    ? params.parts
    : ['head', 'shoulders', 'chest', 'belly', 'hips', 'legs', 'feet'];

  const [currentPart, setCurrentPart] = useState(0);
  const orbY = useSharedValue(0);

  const SCAN_HEIGHT = 320;

  useEffect(() => {
    orbY.value = withTiming(SCAN_HEIGHT, { duration, easing: Easing.linear });

    const stepDuration = duration / parts.length;
    const timers = [];
    parts.forEach((_, i) => {
      const t = setTimeout(() => setCurrentPart(i), stepDuration * i);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: orbY.value }],
  }));

  return (
    <View style={animStyles.bodyScanArea}>
      <View style={[animStyles.bodyScanColumn, { height: SCAN_HEIGHT }]} />
      <Animated.View style={[animStyles.bodyScanOrb, orbStyle]}>
        <View style={animStyles.bodyScanOrbCore} />
      </Animated.View>
      <View style={animStyles.bodyScanLabels}>
        {parts.map((p, i) => (
          <Text
            key={p}
            style={[
              animStyles.bodyScanLabel,
              i === currentPart && animStyles.bodyScanLabelActive,
              i < currentPart && animStyles.bodyScanLabelDone,
            ]}
          >
            {p}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },

  pips: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  pip: {
    width: 28, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(157,78,221,0.2)',
  },
  pipActive: {
    backgroundColor: colors.accentBright,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  pipDone: { backgroundColor: 'rgba(157,78,221,0.5)' },

  skipTop: {
    position: 'absolute',
    top: spacing.lg + 24,
    right: spacing.md,
    padding: spacing.sm,
    zIndex: 10,
  },
  skipTopText: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },

  header: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  exTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  exIntro: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },

  animationArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  exOutro: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: radius.full,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.5,
  },

  // Loading state
  loadingOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    backgroundColor: 'rgba(157,78,221,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 15,
    marginBottom: spacing.xl,
  },
  loadingOrbCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  loadingLabel: {
    color: colors.accentBright,
    fontSize: 12,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  loadingHint: {
    color: colors.textMuted,
    fontSize: 13,
  },

  errorMsg: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  skipBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipText: { color: colors.textMuted, fontSize: 14 },
});

const animStyles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },

  // Breathing circle
  bigOrbHalo: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.accentGlow,
    opacity: 0.3,
  },
  bigOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    backgroundColor: 'rgba(157,78,221,0.15)',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 15,
  },
  bigOrbCore: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },
  phaseText: {
    position: 'absolute',
    bottom: 30,
    color: colors.accentBright,
    fontSize: 16,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  cycleText: {
    position: 'absolute',
    top: 30,
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 2,
  },

  // Count down
  countRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    backgroundColor: 'rgba(157,78,221,0.08)',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  countNumber: {
    color: colors.text,
    fontSize: 80,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  countBody: {
    position: 'absolute',
    bottom: 30,
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    fontStyle: 'italic',
  },

  // Text reveal
  revealList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: 18,
  },
  revealLine: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Pulse
  pulseHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.accentGlow,
    opacity: 0.4,
  },
  pulseDot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentBright,
    shadowColor: colors.accentBright,
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  pulseBody: {
    position: 'absolute',
    bottom: 30,
    color: colors.text,
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 24,
  },

  // Body scan
  bodyScanArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  bodyScanColumn: {
    width: 1,
    backgroundColor: 'rgba(157,78,221,0.3)',
    marginRight: spacing.lg,
  },
  bodyScanOrb: {
    position: 'absolute',
    left: '50%',
    marginLeft: -28,
    top: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    backgroundColor: 'rgba(157,78,221,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 5,
  },
  bodyScanOrbCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  bodyScanLabels: {
    flex: 1,
    height: 320,
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
  },
  bodyScanLabel: {
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  bodyScanLabelActive: {
    color: colors.accentBright,
    fontWeight: '500',
    fontSize: 18,
  },
  bodyScanLabelDone: {
    color: colors.textMuted,
  },
});
