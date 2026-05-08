import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../src/api';
import { colors, type } from '../src/theme';

export default function Index() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { user, onboarded, onboarding } = await api.registerDevice();
        await AsyncStorage.setItem('@nh:user_id', user.id);
        if (onboarded) {
          await AsyncStorage.setItem('@nh:onboarding', JSON.stringify(onboarding));
          router.replace('/home');
        } else {
          router.replace('/onboarding');
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {error ? (
        <>
          <Text style={[type.body, { color: colors.danger, textAlign: 'center', marginBottom: 12 }]}>
            Could not reach backend
          </Text>
          <Text style={[type.bodyMuted, { textAlign: 'center' }]}>{error}</Text>
          <Text style={[type.bodyMuted, { textAlign: 'center', marginTop: 16, fontSize: 12 }]}>
            Backend URL: {api.backendUrl}
          </Text>
        </>
      ) : (
        <ActivityIndicator color={colors.accentBright} />
      )}
    </View>
  );
}
