import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, type, spacing, radius } from '../src/theme';

export default function Profile() {
  const router = useRouter();

  const reset = async () => {
    Alert.alert(
      'Reset onboarding?',
      'For demo purposes — you will see the onboarding flow again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('@nh:onboarding');
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={[type.brand, { textAlign: 'center', marginTop: 40 }]}>NEW HUMAN AI</Text>
      <Text style={[type.label, { textAlign: 'center', marginTop: 12 }]}>PREVIEW BUILD</Text>

      <View style={styles.about}>
        <Text style={styles.aboutText}>
          This is a proof-of-concept build. The Bluetooth button, voice cloning,
          SMS layer, and check-ins are not wired up here. The realtime voice session
          and the trigger-aware AI are the parts being demonstrated.
        </Text>
      </View>

      <Pressable onPress={reset} style={styles.resetBtn}>
        <Text style={styles.resetText}>Reset onboarding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: 60 },
  backBtn: { padding: 6 },
  backText: { color: colors.textMuted, fontSize: 16 },
  about: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(157,78,221,0.2)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  aboutText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  resetBtn: {
    marginTop: 'auto',
    marginBottom: 60,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  resetText: { color: colors.danger, fontSize: 14 },
});
