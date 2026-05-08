import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// Delay before auto-advancing after a tap, so the user sees their selection light up
const AUTO_ADVANCE_MS = 600;

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

  // Track timer so back-to-back taps don't queue multiple advances
  const advanceTimer = useRef(null);

  const tap = () => { try { Haptics.selectionAsync(); } catch {} };
  const heavy = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} };

  const clearAdvance = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const scheduleAdvance = (toLast = false) => {
    clearAdvance();
    advanceTimer.current = setTimeout(() => {
      heavy();
      if (toLast) submit();
      else setStep((s) => s + 1);
    }, AUTO_ADVANCE_MS);
  };

  const toggleTrigger = (k) => {
    tap();
    setAnswers((a) => {
      const has = a.triggers.includes(k);
      let next = has ? a.triggers.filter((x) => x !== k) : [...a.triggers, k];
      if (next.length > 3) next = next.slice(-3);
      return { ...a, triggers: next };
    });
    // Don't auto-advance for multi-select — user picks several. Use the small Next button.
  };

  const pickSingle = (key, fieldName, isLast = false) => {
    tap();
    setAnswers((a) => ({ ...a, [fieldName]: key }));
    scheduleAdvance(isLast);
  };

  const pickVoice = (optKey) => {
    tap();
    const isOptIn = optKey === "I'll record later";
    setAnswers((a) => ({ ...a, voice_opt_in: isOptIn }));
    scheduleAdvance(true); // last step → submit
  };

  const goBack = () => {
    clearAdvance();
    setStep((s) => Math.max(0, s - 1));
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

  const advanceText = () => {
    heavy();
    if (step === STEPS_COUNT - 1) submit();
    else setStep(step + 1);
  };

  const STEPS_COUNT = 6;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepFrame
            label={`QUESTION 1 OF ${STEPS_COUNT}`}
            title={'What pulls you\ninto the loop?'}
            hint="Pick up to 3, then tap Next."
          >
            <OrbGrid
              options={TRIGGER_OPTIONS}
              isSelected={(k) => answers.triggers.includes(k)}
              onTap={toggleTrigger}
            />
          </StepFrame>
        );
      case 1:
        return (
          <StepFrame
            label={`QUESTION 2 OF ${STEPS_COUNT}`}
            title={"What does the voice\nin your head say?"}
            hint="The exact words."
          >
            <TextInputOrb
              placeholder="you're never going to figure this out"
              value={answers.inner_voice}
              onChange={(t) => setAnswers((a) => ({ ...a, inner_voice: t }))}
            />
          </StepFrame>
        );
      case 2:
        return (
          <StepFrame
            label={`QUESTION 3 OF ${STEPS_COUNT}`}
            title={'Your best self,\n6 months from now.'}
            hint="One sentence."
          >
            <TextInputOrb
              placeholder="calm, present, doing the work"
              value={answers.best_self}
              onChange={(t) => setAnswers((a) => ({ ...a, best_self: t }))}
            />
          </StepFrame>
        );
      case 3:
        return (
          <StepFrame
            label={`QUESTION 4 OF ${STEPS_COUNT}`}
            title={'When do the loops\nusually hit?'}
            hint="Tap one."
          >
            <OrbGrid
              options={TIME_OPTIONS.map((k) => ({ key: k }))}
              isSelected={(k) => answers.loop_time === k}
              onTap={(k) => pickSingle(k, 'loop_time')}
            />
          </StepFrame>
        );
      case 4:
        return (
          <StepFrame
            label={`QUESTION 5 OF ${STEPS_COUNT}`}
            title={'What grounds you\nwhen it works?'}
            hint="Tap one."
          >
            <OrbGrid
              options={GROUNDING_OPTIONS.map((k) => ({ key: k }))}
              isSelected={(k) => answers.grounding === k}
              onTap={(k) => pickSingle(k, 'grounding')}
            />
          </StepFrame>
        );
      case 5:
        return (
          <StepFrame
            label={`QUESTION 6 OF ${STEPS_COUNT}`}
            title={'Your voice,\nor a neutral one?'}
            hint="Voice cloning ships in V1."
          >
            <OrbGrid
              options={[
                { key: 'Neutral voice' },
                { key: "I'll record later" },
              ]}
              isSelected={(k) => (answers.voice_opt_in ? "I'll record later" : 'Neutral voice') === k}
              onTap={pickVoice}
            />
          </StepFrame>
        );
      default:
        return null;
    }
  };

  // Show Next button only for text-input steps
  const isTextStep = step === 1 || step === 2;
  const isMultiSelectStep = step === 0;
  const canTextNext = (step === 1 && answers.inner_voice.trim()) || (step === 2 && answers.best_self.trim());
  const canMultiNext = step === 0 && answers.triggers.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Step pip indicator */}
        <View style={styles.pips}>
          {Array.from({ length: STEPS_COUNT }).map((_, i) => (
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
          {renderStep()}
        </ScrollView>

        {/* Bottom nav — only shows for text steps and multi-select; hidden on auto-advance steps */}
        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : <View style={{ width: 64 }} />}

          {(isTextStep || isMultiSelectStep) ? (
            <Pressable
              onPress={advanceText}
              disabled={!(canTextNext || canMultiNext) || submitting}
              style={[
                styles.nextBtn,
                (!(canTextNext || canMultiNext) || submitting) && styles.nextBtnDisabled,
              ]}
            >
              <Text style={styles.nextText}>
                {submitting ? 'Saving…' : 'Next'}
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 100 }} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepFrame({ label, title, hint, children }) {
  return (
    <>
      <Text style={[type.label, styles.qLabel]}>{label}</Text>
      <Text style={styles.title}>{title}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.body}>{children}</View>
    </>
  );
}

function OrbGrid({ options, isSelected, onTap }) {
  const orbSize = options.length > 5 ? 96 : options.length > 3 ? 110 : 130;
  return (
    <View style={styles.grid}>
      {options.map((opt) => {
        const sel = isSelected(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => onTap(opt.key)}
            style={styles.gridCell}
            hitSlop={6}
          >
            <GlowOrb size={orbSize} filled={sel} intensity={sel ? 1 : 0.4}>
              <View style={{ paddingHorizontal: 8, alignItems: 'center' }}>
                <Text style={[
                  styles.orbText,
                  sel && styles.orbTextActive,
                  orbSize < 110 && { fontSize: 11 },
                ]} numberOfLines={2}>
                  {opt.key}
                </Text>
                {!!opt.sub && (
                  <Text style={[styles.orbSub, orbSize < 110 && { fontSize: 9 }]} numberOfLines={1}>
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

function TextInputOrb({ placeholder, value, onChange }) {
  return (
    <View style={styles.textareaWrap}>
      <View style={styles.textareaGlow} pointerEvents="none" />
      <TextInput
        style={styles.textarea}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        value={value}
        onChangeText={onChange}
        multiline
        autoFocus
        maxLength={200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  pips: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  qLabel: { textAlign: 'center', marginTop: spacing.md, fontSize: 11, letterSpacing: 2.5 },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 30,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  body: {
    flex: 1,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  gridCell: { margin: -6 },

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
    paddingHorizontal: spacing.sm,
    marginTop: spacing.lg,
  },
  textareaGlow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    backgroundColor: colors.accentGlow,
    opacity: 0.25,
    borderRadius: radius.lg,
  },
  textarea: {
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(157,78,221,0.4)',
    borderRadius: radius.lg,
    padding: 18,
    minHeight: 110,
    width: '100%',
    textAlignVertical: 'top',
    backgroundColor: 'rgba(157,78,221,0.06)',
    shadowColor: colors.accentBright,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { paddingVertical: 10, paddingHorizontal: 14, width: 64 },
  backText: { color: colors.textMuted, fontSize: 14 },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    paddingHorizontal: 36,
    borderRadius: radius.full,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 10,
  },
  nextBtnDisabled: {
    backgroundColor: 'rgba(157,78,221,0.25)',
    shadowOpacity: 0,
  },
  nextText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
});
