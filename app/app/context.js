import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, type, spacing, radius } from '../src/theme';

// Adaptive prompt per trigger — pulled from the doc
function promptFor(trigger) {
  const t = (trigger || '').toLowerCase();
  if (t.includes('doom') || t.includes('phone') || t.includes('scroll')) {
    return 'What are you\navoiding right now?';
  }
  if (t.includes('mom') || t.includes('relation') || t.includes('boss') || t.includes('ramin')) {
    return 'What happened.\nShort version.';
  }
  if (t.includes('eat') || t.includes('food')) {
    return 'What are you feeling\nin your body\nright now?';
  }
  if (t.includes('sleep')) {
    return 'What thought\nkeeps coming back?';
  }
  if (t.includes('alcohol') || t.includes('substance')) {
    return "What do you need\nthat this isn't\nactually giving you?";
  }
  if (t.includes('think') || t.includes('overthink')) {
    return 'What are you\nturning over\nright now?';
  }
  if (t.includes('school') || t.includes('work') || t.includes('pressure')) {
    return 'What is actually due\n— and what is your mind\nmaking it?';
  }
  return "What's going on\nright now?";
}

export default function ContextScreen() {
  const router = useRouter();
  const { trigger } = useLocalSearchParams();
  const [text, setText] = useState('');

  const proceed = (skip = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.replace({
      pathname: '/session',
      params: { trigger, context: skip ? '' : text.trim() },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.root}>
        <Text style={[type.label, styles.label]}>
          {String(trigger || '').toUpperCase()}
        </Text>

        <Text style={styles.question}>{promptFor(trigger)}</Text>
        <Text style={styles.sub}>Optional. Ten seconds.</Text>

        {/* Glowing orb-shaped input frame */}
        <View style={styles.inputWrap}>
          <View style={styles.glowOuter} pointerEvents="none" />
          <View style={styles.glowInner} pointerEvents="none" />
          <TextInput
            style={styles.input}
            placeholder="One sentence…"
            placeholderTextColor={colors.textDim}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            maxLength={300}
          />
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => proceed(true)} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable onPress={() => proceed(false)} style={styles.goBtn}>
            <Text style={styles.goText}>Begin</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, paddingTop: 100 },
  label: { textAlign: 'center', marginBottom: spacing.xl },
  question: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 38,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },

  inputWrap: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: '110%',
    height: 200,
    backgroundColor: colors.accentGlow,
    opacity: 0.25,
    borderRadius: 120,
    top: -10,
  },
  glowInner: {
    position: 'absolute',
    width: '95%',
    height: 170,
    backgroundColor: colors.accentGlow,
    opacity: 0.35,
    borderRadius: 100,
    top: 5,
  },
  input: {
    color: colors.text,
    fontSize: 18,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    borderRadius: radius.lg,
    padding: 24,
    width: '100%',
    minHeight: 150,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(157,78,221,0.1)',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  skipBtn: { padding: 14 },
  skipText: { color: colors.textMuted, fontSize: 15 },
  goBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderRadius: radius.full,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 12,
  },
  goText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 2,
  },
});
