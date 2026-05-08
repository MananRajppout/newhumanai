import React, { useEffect } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, type } from '../theme';

/**
 * A single trigger node — circle with optional icon glyph + label.
 * `active` makes it pulse and glow brighter (for the "tap your trigger" focus state).
 * `align` controls left/right placement on the timeline.
 */
export default function TriggerNode({
  label,
  sublabel,
  icon,        // small SVG/emoji string component
  active = false,
  align = 'left',
  onPress,
}) {
  const pulse = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.5, { duration: 1400, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(0, { duration: 300 });
    }
  }, [active]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.15 }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <View style={[styles.row, align === 'right' && styles.rowRight]}>
      <Pressable onPress={handlePress} style={styles.pressable} hitSlop={8}>
        {/* Outer glow halo */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { backgroundColor: colors.accentGlow },
            glowStyle,
          ]}
        />
        {/* Circle */}
        <View style={[styles.circle, active && styles.circleActive]}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[type.triggerLabel, active && styles.labelActive]}>{label}</Text>
          {sublabel ? <Text style={type.triggerSub}>{sublabel}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

const SIZE = 110;

const styles = StyleSheet.create({
  row: {
    width: '100%',
    alignItems: 'flex-start',
    paddingLeft: 24,
    marginVertical: 6,
  },
  rowRight: {
    alignItems: 'flex-end',
    paddingLeft: 0,
    paddingRight: 24,
  },
  pressable: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: SIZE * 1.4,
    height: SIZE * 1.4,
    borderRadius: SIZE,
    // Soft purple halo — combined with opacity animation gives the glow effect
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 221, 0.35)',
    backgroundColor: 'rgba(157, 78, 221, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  circleActive: {
    borderColor: colors.accentBright,
    borderWidth: 1.5,
    backgroundColor: 'rgba(157, 78, 221, 0.18)',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '500',
  },
  icon: {
    marginBottom: 6,
    opacity: 0.85,
  },
});
