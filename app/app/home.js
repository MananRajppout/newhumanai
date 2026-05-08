import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import TriggerNode from '../src/components/TriggerNode';
import { IconFor } from '../src/components/icons';
import { colors, type, spacing } from '../src/theme';
import { api } from '../src/api';

const { width: SCREEN_W } = Dimensions.get('window');

// Default seed triggers if onboarding didn't define any (shouldn't happen, but safe)
const FALLBACK_TRIGGERS = ['Doomscrolling', 'Overeating', "Can't Sleep", 'Overthinking'];

export default function Home() {
  const router = useRouter();
  const [triggers, setTriggers] = useState([]);
  const [activeIdx, setActiveIdx] = useState(2); // The "Overeating" star position from the screenshot
  const [chosenCount, setChosenCount] = useState(0);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    (async () => {
      const onbStr = await AsyncStorage.getItem('@nh:onboarding');
      const uid = await AsyncStorage.getItem('@nh:user_id');
      setUserId(uid);

      let trigs = FALLBACK_TRIGGERS;
      if (onbStr) {
        const onb = JSON.parse(onbStr);
        if (Array.isArray(onb.triggers) && onb.triggers.length > 0) {
          trigs = onb.triggers;
        }
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
    router.push({ pathname: '/context', params: { trigger } });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} hitSlop={12}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
        <Text style={[type.brand, styles.brandText]}>NEW HUMAN AI</Text>
        <Pressable
          style={styles.iconBtn}
          hitSlop={12}
          onPress={() => router.push('/profile')}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <SvgCircle cx="12" cy="9" r="3.5" stroke={colors.text} strokeWidth={1.4} />
            <Line x1="4" y1="22" x2="4" y2="22" stroke="transparent" />
            <SvgCircle cx="12" cy="20" r="8" stroke={colors.text} strokeWidth={1.4} />
          </Svg>
        </Pressable>
      </View>

      {/* Tap your trigger */}
      <Text style={[type.label, styles.tapLabel]}>TAP YOUR TRIGGER</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vertical timeline line behind nodes */}
        <View style={styles.timeline} pointerEvents="none">
          <Svg width={2} height={triggers.length * 130 + 100} style={{ alignSelf: 'center' }}>
            <Line
              x1={1}
              y1={0}
              x2={1}
              y2={triggers.length * 130 + 100}
              stroke="rgba(157, 78, 221, 0.25)"
              strokeWidth={1}
            />
          </Svg>
        </View>

        {/* Trigger nodes alternating left/right */}
        {triggers.map((label, idx) => {
          const align = idx % 2 === 0 ? 'left' : 'right';
          const isActive = idx === activeIdx;
          return (
            <View key={`${label}-${idx}`} style={styles.nodeRow}>
              {/* Connector dot on the timeline */}
              <View style={[styles.dot, align === 'left' ? styles.dotRight : styles.dotLeft]} />
              <TriggerNode
                label={label}
                icon={<IconFor trigger={label} />}
                active={isActive}
                align={align}
                onPress={() => goToContext(label)}
              />
            </View>
          );
        })}

        {/* Bottom node - "you" / current self */}
        <View style={styles.bottomNodeWrap}>
          <View style={styles.bottomNode}>
            <View style={styles.bottomNodeInner}>
              {[...Array(9)].map((_, i) => {
                const angle = (i / 9) * Math.PI * 2;
                const r = 14;
                return (
                  <View
                    key={i}
                    style={[
                      styles.bottomDot,
                      {
                        left: 28 + Math.cos(angle) * r,
                        top: 28 + Math.sin(angle) * r,
                      },
                    ]}
                  />
                );
              })}
              <View style={[styles.bottomDot, { left: 28, top: 28 }]} />
            </View>
          </View>
        </View>

        {/* Chosen-yourself counter */}
        <View style={styles.counter}>
          <Text style={[type.bodyMuted, { textAlign: 'center' }]}>
            You have chosen yourself
          </Text>
          <Text style={styles.counterNum}>{chosenCount}</Text>
          <Text style={[type.bodyMuted, { textAlign: 'center' }]}>
            times this month.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 50 },
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
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuLine: {
    width: 22,
    height: 1.5,
    backgroundColor: colors.text,
    marginVertical: 2.5,
    opacity: 0.85,
    borderRadius: 1,
  },
  brandText: { flex: 1, textAlign: 'center' },
  tapLabel: {
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  scrollContent: {
    paddingBottom: 60,
    alignItems: 'center',
  },
  timeline: {
    position: 'absolute',
    left: SCREEN_W / 2 - 1,
    top: 0,
  },
  nodeRow: {
    width: '100%',
    minHeight: 130,
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: '50%',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 221, 0.5)',
    backgroundColor: colors.bg,
    marginTop: -5,
  },
  dotRight: { left: SCREEN_W / 2 - 5 },
  dotLeft: { left: SCREEN_W / 2 - 5 },
  bottomNodeWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
  },
  bottomNode: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 10,
  },
  bottomNodeInner: { width: 56, height: 56, position: 'relative' },
  bottomDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentBright,
  },
  counter: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  counterNum: {
    color: colors.accentBright,
    fontSize: 36,
    fontWeight: '300',
    marginVertical: 4,
  },
});
