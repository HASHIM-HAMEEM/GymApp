import * as React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Stack, SplashScreen, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '@/providers/AppProvider';
import { colors, useColors } from '@/theme/tokens';
import { StatusBar as FauxStatusBar } from '@/components/Chrome';

SplashScreen.preventAutoHideAsync();

function RootNav() {
  const { role, session, profile, authLoading, darkMode } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const c = useColors(darkMode);

  React.useEffect(() => {
    if (!authLoading) SplashScreen.hide();
  }, [authLoading]);

  React.useEffect(() => {
    if (authLoading || pathname === '/confirm') return;
    if (!session) {
      if (!['/welcome', '/signin', '/forgot-password', '/splash'].includes(pathname)) {
        router.replace('/welcome');
      }
      return;
    }
    if (!profile || profile.status === 'suspended') {
      if (pathname !== '/account-status') router.replace('/account-status');
      return;
    }
    if (profile.mustSetPassword || profile.status === 'invited') {
      if (pathname !== '/set-password') router.replace('/set-password');
      return;
    }
    const adminOnly = ['/today', '/members', '/scanner', '/member-new', '/member-detail', '/renew', '/notice-compose'];
    const memberOnly = ['/home', '/visits', '/membership', '/qr', '/edit-profile'];
    if (role === 'member' && adminOnly.includes(pathname)) router.replace('/(member)/home');
    if (role === 'admin' && memberOnly.includes(pathname)) router.replace('/(admin)/today');
  }, [authLoading, pathname, profile, role, router, session]);

  if (authLoading) return null;

  const hasSession = Boolean(session);
  const authed = Boolean(session && profile);
  const blocked = hasSession && (!profile || profile.status === 'suspended');
  const needsPassword = authed && Boolean(profile?.mustSetPassword);
  const active = authed && profile?.status === 'active';
  const isAdmin = active && role === 'admin';
  const isMember = active && role === 'member';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="confirm" />

      <Stack.Protected guard={!hasSession}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={blocked}>
        <Stack.Screen name="account-status" />
      </Stack.Protected>

      <Stack.Protected guard={active && !needsPassword}>
        <Stack.Screen name="notice" />
        <Stack.Protected guard={isMember}>
          <Stack.Screen name="(member)" />
          <Stack.Screen name="qr" />
          <Stack.Screen name="edit-profile" />
        </Stack.Protected>
        <Stack.Protected guard={isAdmin}>
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="member-new" />
          <Stack.Screen name="member-detail" />
          <Stack.Screen name="renew" />
          <Stack.Screen name="notice-compose" />
        </Stack.Protected>
      </Stack.Protected>

      <Stack.Protected guard={authed && profile?.status !== 'suspended'}>
        <Stack.Screen name="set-password" />
      </Stack.Protected>
    </Stack>
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
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const frameWidth = Math.min(390, Math.max(280, width - 24));
  const frameHeight = Math.min(844, Math.max(480, height - 24));

  return (
    <View style={[webStyles.backdrop, { backgroundColor: darkMode ? '#0A0A0A' : '#EDEDED' }]}>
      <View
        style={[
          webStyles.phone,
          {
            width: frameWidth,
            height: frameHeight,
            borderRadius: frameWidth < 360 ? 34 : 46,
            backgroundColor: c.bg,
            borderColor: darkMode ? '#2A2A2A' : '#D6D6D6',
          },
        ]}
      >
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
    backgroundColor: colors.bg,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
    flexDirection: 'column',
  },
});
