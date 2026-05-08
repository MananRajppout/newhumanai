import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, type, spacing, radius } from '../src/theme';

function promptFor(trigger) {
  const t = (trigger || '').toLowerCase();
  if (t.includes('doom') || t.includes('phone') || t.includes('scroll')) {
    return 'What are you\navoiding right now?';
  }
  if (t.includes('mom') || t.includes('relation') || t.includes('boss')) {
    return 'What happened.\nShort version.';
  }
  if (t.includes('eat') || t.includes('food')) {
    return 'What are you feeling\nin your body?';
  }
  if (t.includes('sleep')) {
    return 'What thought\nkeeps coming back?';
  }
  if (t.includes('alcohol') || t.includes('substance')) {
    return "What do you need\nthat this isn't giving you?";
  }
  if (t.includes('think') || t.includes('overthink')) {
    return 'What are you\nturning over?';
  }
  if (t.includes('school') || t.includes('work') || t.includes('pressure')) {
    return 'What is actually due —\nwhat is your mind making it?';
  }
  return "What's going on\nright now?";
}

export default function ContextScreen() {
  const router = useRouter();
  const { trigger } = useLocalSearchParams();
  const [text, setText] = useState('');

  const proceed = (skip = false) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    router.replace({
      pathname: '/exercises',
      params: { trigger, context: skip ? '' : text.trim() },
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={[type.label, styles.trigLabel]}>
            {String(trigger || '').toUpperCase()}
          </Text>

          <Text style={styles.question}>{promptFor(trigger)}</Text>
          <Text style={styles.sub}>OPTIONAL · TEN SECONDS</Text>

          <View style={styles.inputWrap}>
            <View style={styles.glowOuter} pointerEvents="none" />
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
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => proceed(true)} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable onPress={() => proceed(false)} style={styles.goBtn}>
            <Text style={styles.goText}>Begin</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  trigLabel: { textAlign: 'center', marginBottom: spacing.xl, fontSize: 11, letterSpacing: 2.5 },

  question: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 32,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  inputWrap: {
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  glowOuter: {
    position: 'absolute',
    top: -8, left: -8, right: -8, bottom: -8,
    backgroundColor: colors.accentGlow,
    opacity: 0.3,
    borderRadius: radius.lg,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    borderRadius: radius.lg,
    padding: 18,
    width: '100%',
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(157,78,221,0.1)',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },

  // Fixed at bottom
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  skipText: { color: colors.textMuted, fontSize: 14 },
  goBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    paddingHorizontal: 40,
    borderRadius: radius.full,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 10,
  },
  goText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
});
