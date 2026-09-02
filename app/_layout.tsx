import * as React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '@/data/store';
import { colors, useColors } from '@/theme/tokens';
import { StatusBar as FauxStatusBar } from '@/components/Chrome';

function RootNav() {
  const { role, darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(member)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="index" redirect={!role || role === 'unauth' ? undefined : true} />
      </Stack>
    </>
  );
}

/**
 * On web, constrain the app to a phone-sized frame centered on a dark
 * backdrop — same presentation as the design system showcase.
 * On native, fill the full screen.
 */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View style={[webStyles.backdrop, { backgroundColor: darkMode ? '#0A0A0A' : '#EDEDED' }]}>
      <View style={[webStyles.phone, { backgroundColor: c.bg, borderColor: darkMode ? '#2A2A2A' : '#D6D6D6' }]}>
        <FauxStatusBar dark={darkMode} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      {Platform.OS === 'web' ? (
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
          @keyframes sh { to { background-position: -200% 0; } }
          @keyframes mpress { 0% { transform: scale(1); } 50% { transform: scale(.985); } 100% { transform: scale(1); } }
          * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        `}</style>
      ) : null}
      <PhoneFrame>
        <RootNav />
      </PhoneFrame>
    </AppProvider>
  );
}

const webStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#EDEDED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 390,
    height: 844,
    backgroundColor: colors.bg,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
    flexDirection: 'column',
  },
});
