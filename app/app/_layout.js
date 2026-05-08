import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Try to load LiveKit globals — failure here would crash the bundle silently.
// We try, and capture the error if it fails so the error boundary can render it.
let livekitInitError = null;
try {
  // eslint-disable-next-line global-require
  const { registerGlobals } = require('@livekit/react-native');
  registerGlobals();
} catch (e) {
  livekitInitError = e;
}

// Import theme defensively too
let theme;
try {
  theme = require('../src/theme').colors;
} catch (e) {
  theme = { bg: '#000000', text: '#ffffff', danger: '#ff4d4d', textMuted: '#888' };
}

class ErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ROOT CRASH:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#000' }}
          contentContainerStyle={{ padding: 20, paddingTop: 60 }}
        >
          <Text style={{ color: '#ff4d4d', fontSize: 18, marginBottom: 16, fontWeight: 'bold' }}>
            App crash
          </Text>
          <Text style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          <Text style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>
            {String(this.state.error?.stack || '').slice(0, 1500)}
          </Text>
          {this.state.errorInfo?.componentStack && (
            <>
              <Text style={{ color: '#aaa', fontSize: 12, marginTop: 16, marginBottom: 6 }}>
                Component stack:
              </Text>
              <Text style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>
                {String(this.state.errorInfo.componentStack).slice(0, 1500)}
              </Text>
            </>
          )}
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function LayoutInner() {
  // If LiveKit failed to init at module load, throw inside render
  // so ErrorBoundary catches it and shows the message on screen.
  if (livekitInitError) {
    throw new Error('LiveKit init failed: ' + (livekitInitError?.message || livekitInitError));
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
            animation: 'fade',
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <LayoutInner />
    </ErrorBoundary>
  );
}
