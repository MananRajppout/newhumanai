import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import GlowOrb from '../src/components/GlowOrb';
import { colors, type, spacing, radius } from '../src/theme';
import { api } from '../src/api';

const TRIGGER_OPTIONS = [
  { key: 'Doomscrolling', sub: 'phone / apps' },
  { key: 'Overeating', sub: 'food' },
  { key: 'Alcohol', sub: 'substances' },
  { key: 'Relationships', sub: 'people' },
  { key: 'Work avoidance', sub: 'procrastination' },
  { key: 'Overthinking', sub: 'rumination' },
  { key: "Can't sleep", sub: 'late nights' },
];

const TIME_OPTIONS = ['Morning', 'Afternoon', 'Night', 'All day'];
const GROUNDING_OPTIONS = ['Movement', 'Breath', 'Music', 'Stillness', 'Talking'];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({
    triggers: [],
    inner_voice: '',
    best_self: '',
    loop_time: '',
    grounding: '',
    voice_opt_in: false,
  });

  const tap = () => Haptics.selectionAsync();

  const toggleTrigger = (k) => {
    tap();
    setAnswers((a) => {
      const has = a.triggers.includes(k);
      let next = has ? a.triggers.filter((x) => x !== k) : [...a.triggers, k];
      if (next.length > 3) next = next.slice(-3);
      return { ...a, triggers: next };
    });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const userId = await AsyncStorage.getItem('@nh:user_id');
      await api.submitOnboarding({ user_id: userId, ...answers });
      await AsyncStorage.setItem('@nh:onboarding', JSON.stringify(answers));
      router.replace('/home');
    } catch (e) {
      alert('Could not save: ' + e.message);
      setSubmitting(false);
    }
  };

  const steps = [
    {
      title: 'What pulls you\ninto the loop most?',
      hint: 'Pick up to 3.',
      type: 'multi-orb',
      options: TRIGGER_OPTIONS,
      canNext: answers.triggers.length > 0,
    },
    {
      title: 'When it happens,\nwhat does the voice\nin your head say?',
      hint: 'One sentence. The exact words.',
      type: 'text',
      placeholder: "you're never going to figure this out",
      value: answers.inner_voice,
      onChange: (t) => setAnswers((a) => ({ ...a, inner_voice: t })),
      canNext: answers.inner_voice.trim().length > 0,
    },
    {
      title: 'Your best self,\n6 months from now.',
      hint: 'One sentence.',
      type: 'text',
      placeholder: 'calm, present, doing the work',
      value: answers.best_self,
      onChange: (t) => setAnswers((a) => ({ ...a, best_self: t })),
      canNext: answers.best_self.trim().length > 0,
    },
    {
      title: 'When do the loops\nusually hit?',
      type: 'single-orb',
      options: TIME_OPTIONS.map((k) => ({ key: k })),
      value: answers.loop_time,
      onTap: (k) => { tap(); setAnswers((a) => ({ ...a, loop_time: k })); },
      canNext: !!answers.loop_time,
    },
    {
      title: 'What grounds you\nwhen it works?',
      type: 'single-orb',
      options: GROUNDING_OPTIONS.map((k) => ({ key: k })),
      value: answers.grounding,
      onTap: (k) => { tap(); setAnswers((a) => ({ ...a, grounding: k })); },
      canNext: !!answers.grounding,
    },
    {
      title: 'Your voice,\nor a neutral one?',
      hint: 'Voice cloning ships in V1. For now — neutral.',
      type: 'single-orb',
      options: [
        { key: 'Neutral voice', sub: 'recommended' },
        { key: "I'll record later", sub: 'V1 feature' },
      ],
      value: answers.voice_opt_in ? "I'll record later" : 'Neutral voice',
      onTap: (k) => { tap(); setAnswers((a) => ({ ...a, voice_opt_in: k === "I'll record later" })); },
      canNext: true,
    },
  ];

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Step pip indicator */}
      <View style={styles.pips}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[styles.pip, i === step && styles.pipActive, i < step && styles.pipDone]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.label, styles.label]}>
          QUESTION {step + 1} OF {steps.length}
        </Text>
        <Text style={styles.title}>{cur.title}</Text>
        {!!cur.hint && <Text style={styles.hint}>{cur.hint}</Text>}

        <View style={styles.body}>
          {cur.type === 'multi-orb' && (
            <OrbGrid
              options={cur.options}
              isSelected={(k) => answers.triggers.includes(k)}
              onTap={toggleTrigger}
            />
          )}

          {cur.type === 'single-orb' && (
            <OrbGrid
              options={cur.options}
              isSelected={(k) => cur.value === k}
              onTap={cur.onTap}
            />
          )}

          {cur.type === 'text' && (
            <View style={styles.textareaWrap}>
              <View style={styles.textareaGlow} pointerEvents="none" />
              <TextInput
                style={styles.textarea}
                placeholder={cur.placeholder}
                placeholderTextColor={colors.textDim}
                value={cur.value}
                onChangeText={cur.onChange}
                multiline
                autoFocus
                maxLength={200}
              />
            </View>
          )}
        </View>

        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable onPress={() => setStep(step - 1)} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          ) : <View style={{ width: 60 }} />}

          <Pressable
            onPress={() => {
              if (isLast) { submit(); return; }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setStep(step + 1);
            }}
            disabled={!cur.canNext || submitting}
            style={[styles.nextBtn, (!cur.canNext || submitting) && styles.nextBtnDisabled]}
          >
            <Text style={styles.nextText}>
              {submitting ? 'Saving…' : isLast ? 'Begin' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OrbGrid({ options, isSelected, onTap }) {
  // Adjust orb size based on count - smaller when there are more options
  const size = options.length > 5 ? 95 : options.length > 3 ? 110 : 130;
  return (
    <View style={styles.grid}>
      {options.map((opt) => {
        const sel = isSelected(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => onTap(opt.key)}
            style={styles.gridCell}
            hitSlop={4}
          >
            <GlowOrb size={size} filled={sel} intensity={sel ? 1 : 0.4}>
              <View style={{ paddingHorizontal: 6, alignItems: 'center' }}>
                <Text style={[
                  styles.orbText,
                  sel && styles.orbTextActive,
                  size < 110 && { fontSize: 11 },
                ]}>
                  {opt.key}
                </Text>
                {!!opt.sub && (
                  <Text style={[styles.orbSub, size < 110 && { fontSize: 9 }]}>
                    {opt.sub}
                  </Text>
                )}
              </View>
            </GlowOrb>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pips: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    gap: 6,
  },
  pip: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(157,78,221,0.2)',
  },
  pipActive: {
    backgroundColor: colors.accentBright,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  pipDone: { backgroundColor: 'rgba(157,78,221,0.5)' },

  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: 60,
    paddingTop: spacing.xl,
  },
  label: { textAlign: 'center', marginTop: spacing.lg },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 34,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  body: { marginTop: spacing.xl, alignItems: 'center' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCell: { margin: -8 }, // negative so glow halos overlap nicely

  orbText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
  orbTextActive: { color: colors.accentBright, fontWeight: '500' },
  orbSub: {
    color: colors.textDim,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },

  textareaWrap: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  textareaGlow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md * 2,
    right: spacing.md * 2,
    bottom: 0,
    backgroundColor: colors.accentGlow,
    opacity: 0.25,
    borderRadius: radius.lg,
  },
  textarea: {
    color: colors.text,
    fontSize: 17,
    borderWidth: 1,
    borderColor: 'rgba(157,78,221,0.4)',
    borderRadius: radius.lg,
    padding: 22,
    minHeight: 130,
    width: '100%',
    textAlignVertical: 'top',
    backgroundColor: 'rgba(157,78,221,0.06)',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  backBtn: { padding: 14, width: 60 },
  backText: { color: colors.textMuted, fontSize: 15 },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: radius.full,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 10,
  },
  nextBtnDisabled: {
    backgroundColor: 'rgba(157,78,221,0.25)',
    shadowOpacity: 0,
  },
  nextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 2,
  },
});
