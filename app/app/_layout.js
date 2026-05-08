import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LiveKitRoom, registerGlobals } from '@livekit/react-native';
import { useEffect } from 'react';
import { colors } from '../src/theme';

// LiveKit needs WebRTC globals registered before any room mounts
registerGlobals();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade',
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}
