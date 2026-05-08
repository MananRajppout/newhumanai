import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import GlowOrb from '../src/components/GlowOrb';
import { IconFor } from '../src/components/icons';
import { colors, type, spacing } from '../src/theme';
import { api } from '../src/api';

const FALLBACK_TRIGGERS = ['Doomscrolling', 'Overeating', "Can't Sleep", 'Overthinking'];

export default function Home() {
  const router = useRouter();
  const [triggers, setTriggers] = useState([]);
  const [chosenCount, setChosenCount] = useState(0);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    (async () => {
      const onbStr = await AsyncStorage.getItem('@nh:onboarding');
      const uid = await AsyncStorage.getItem('@nh:user_id');
      setUserId(uid);

      let trigs = FALLBACK_TRIGGERS;
      if (onbStr) {
        try {
          const onb = JSON.parse(onbStr);
          if (Array.isArray(onb.triggers) && onb.triggers.length > 0) trigs = onb.triggers;
        } catch {}
      }
      setTriggers(trigs);

      if (uid) {
        try {
          const { chosen_yourself } = await api.getMetric(uid);
          setChosenCount(chosen_yourself);
        } catch {}
      }
    })();
  }, []);

  const goToContext = (trigger) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    router.push({ pathname: '/context', params: { trigger } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Top header */}
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} hitSlop={12}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
        <Text style={styles.brand}>NEW HUMAN AI</Text>
        <Pressable
          style={styles.iconBtn}
          hitSlop={12}
          onPress={() => router.push('/profile')}
        >
          <View style={styles.profileDot} />
          <View style={styles.profileArc} />
        </Pressable>
      </View>

      {/* Tap your trigger label */}
      <Text style={[type.label, styles.tapLabel]}>TAP YOUR TRIGGER</Text>

      {/* Scrollable trigger list with timeline */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.timeline}>
          {/* Vertical line */}
          <View style={styles.timelineLine} pointerEvents="none" />

          {triggers.map((label, idx) => {
            const align = idx % 2 === 0 ? 'left' : 'right';
            return (
              <View key={`${label}-${idx}`} style={styles.nodeRow}>
                {/* Connector dot on the line */}
                <View style={styles.connectorDot} pointerEvents="none" />

                <View style={[
                  styles.nodeWrap,
                  align === 'left' ? styles.nodeLeft : styles.nodeRight,
                ]}>
                  <Pressable
                    onPress={() => goToContext(label)}
                    hitSlop={10}
                  >
                    <GlowOrb size={108} intensity={0.5}>
                      <View style={{ alignItems: 'center' }}>
                        <View style={{ marginBottom: 4 }}>
                          <IconFor trigger={label} />
                        </View>
                        <Text style={styles.orbLabel} numberOfLines={2}>
                          {label}
                        </Text>
                      </View>
                    </GlowOrb>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {/* Bottom "you" node */}
          <View style={styles.bottomNodeWrap}>
            <GlowOrb size={66} intensity={0.7} filled>
              <View style={styles.dotCluster}>
                {[...Array(8)].map((_, i) => {
                  const angle = (i / 8) * Math.PI * 2;
                  const r = 12;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.smallDot,
                        {
                          left: 18 + Math.cos(angle) * r,
                          top: 18 + Math.sin(angle) * r,
                        },
                      ]}
                    />
                  );
                })}
                <View style={[styles.smallDot, { left: 18, top: 18 }]} />
              </View>
            </GlowOrb>
          </View>

          {/* Counter */}
          <View style={styles.counter}>
            <Text style={styles.counterLabel}>You have chosen yourself</Text>
            <Text style={styles.counterNum}>{chosenCount}</Text>
            <Text style={styles.counterLabel}>times this month.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLine: {
    width: 20,
    height: 1.5,
    backgroundColor: colors.text,
    marginVertical: 2.5,
    opacity: 0.85,
    borderRadius: 1,
  },
  profileDot: {
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1, borderColor: colors.text,
  },
  profileArc: {
    width: 18, height: 9,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.text,
    borderTopLeftRadius: 9, borderTopRightRadius: 9,
    marginTop: 3,
  },
  brand: {
    color: colors.text,
    fontSize: 13,
    letterSpacing: 4,
    fontWeight: '300',
    flex: 1,
    textAlign: 'center',
  },

  tapLabel: {
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 11,
    letterSpacing: 2.5,
  },

  scroll: {
    paddingBottom: spacing.xxl,
  },

  timeline: {
    position: 'relative',
    width: '100%',
    paddingTop: spacing.sm,
  },
  timelineLine: {
    position: 'absolute',
    left: '50%',
    marginLeft: -0.5,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(157,78,221,0.2)',
  },

  nodeRow: {
    width: '100%',
    height: 110,
    position: 'relative',
    justifyContent: 'center',
  },
  connectorDot: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -4,
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(157,78,221,0.6)',
    backgroundColor: colors.bg,
  },
  nodeWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  nodeLeft: {
    left: spacing.md,
  },
  nodeRight: {
    right: spacing.md,
  },

  orbLabel: {
    color: colors.text,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  bottomNodeWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dotCluster: { width: 36, height: 36, position: 'relative' },
  smallDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accentBright,
  },

  counter: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  counterLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  counterNum: {
    color: colors.accentBright,
    fontSize: 32,
    fontWeight: '300',
    marginVertical: 4,
  },
});
