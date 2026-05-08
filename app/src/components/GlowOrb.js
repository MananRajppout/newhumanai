import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme';

/**
 * GlowOrb — the signature visual primitive of the app.
 * Used as the main session orb, the onboarding answer-circle, the context input frame.
 *
 * Props:
 *   size: outer diameter
 *   intensity: 0-1, how bright the glow pulses
 *   speaking: boolean — if true, pulses faster and brighter
 *   filled: boolean — if true, slightly tinted background (selected state)
 *   children: content rendered inside the orb
 */
export default function GlowOrb({
  size = 120,
  intensity = 0.7,
  speaking = false,
  filled = false,
  children,
  style,
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    const dur = speaking ? 900 : 1800;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: dur, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [speaking]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.45 * intensity,
    transform: [{ scale: 1 + pulse.value * 0.15 }],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    opacity: 0.85 + pulse.value * 0.15,
    transform: [{ scale: 1 + pulse.value * 0.04 }],
  }));

  return (
    <View style={[{ width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: size,
            backgroundColor: colors.accentGlow,
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: filled ? 1.5 : 1,
            borderColor: filled ? colors.accentBright : 'rgba(157,78,221,0.45)',
            backgroundColor: filled ? 'rgba(157,78,221,0.18)' : 'rgba(157,78,221,0.04)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.accentBright,
            shadowOpacity: filled ? 0.8 : 0.4,
            shadowRadius: filled ? 20 : 12,
            shadowOffset: { width: 0, height: 0 },
            elevation: filled ? 14 : 6,
          },
          orbStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
