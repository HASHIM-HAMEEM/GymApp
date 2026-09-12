import * as React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Stack, SplashScreen, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '@/providers/AppProvider';
import { colors, useColors } from '@/theme/tokens';
import { subscribeToNotificationResponses } from '@/lib/notifications';
import { StartupState } from '@/components/StartupState';
import { AppUpdateGate } from '@/components/AppUpdateGate';
import { Banner } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { StatusBar as WebSafeAreaSpacer } from '@/components/Chrome';

SplashScreen.preventAutoHideAsync();

function RootNav() {
  const { role, session, profile, authLoading, startupError, darkMode, isOnline, connectivityKnown, refreshConnectivity } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const c = useColors(darkMode);
  const handledResponses = React.useRef(new Set<string>());

  const hideSplash = React.useCallback(() => { void SplashScreen.hideAsync(); }, []);

  React.useEffect(() => {
    if (authLoading || !session) return;
    return subscribeToNotificationResponses((url, responseId) => {
      if (responseId) {
        if (handledResponses.current.has(responseId)) return;
        handledResponses.current.add(responseId);
      }
      router.push(url as never);
    });
  }, [authLoading, router, session]);

  React.useEffect(() => {
    if (authLoading || startupError || pathname === '/confirm') return;
    if (!session) {
      if (!['/welcome', '/signin', '/forgot-password', '/splash', '/download'].includes(pathname)) {
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
    const adminOnly = ['/today', '/members', '/scanner', '/member-new', '/member-detail', '/renew', '/notice-compose', '/exports', '/plans', '/payment-settings'];
    const memberOnly = ['/home', '/visits', '/membership', '/qr', '/edit-profile', '/pay'];
    if (pathname === '/' || ['/welcome', '/signin', '/splash'].includes(pathname)) {
      router.replace(role === 'admin' ? '/(admin)/today' : '/(member)/home');
      return;
    }
    if (role === 'member' && adminOnly.includes(pathname)) router.replace('/(member)/home');
    if (role === 'admin' && memberOnly.includes(pathname)) router.replace('/(admin)/today');
  }, [authLoading, startupError, pathname, profile, role, router, session]);

  if (authLoading || startupError) return <StartupState onReady={hideSplash} />;

  const hasSession = Boolean(session);
  const authed = Boolean(session && profile);
  const blocked = hasSession && (!profile || profile.status === 'suspended');
  const needsPassword = authed && Boolean(profile?.mustSetPassword);
  const active = authed && profile?.status === 'active';
  const isAdmin = active && role === 'admin';
  const isMember = active && role === 'member';

  return (
    <View style={{ flex: 1 }} onLayout={hideSplash}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="confirm" />
      <Stack.Screen name="download" />

      <Stack.Protected guard={!hasSession}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={blocked}>
        <Stack.Screen name="account-status" />
      </Stack.Protected>

      <Stack.Protected guard={active && !needsPassword}>
        <Stack.Screen name="notice" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="notification-settings" />
        <Stack.Protected guard={isMember}>
          <Stack.Screen name="(member)" />
          <Stack.Screen name="qr" />
          <Stack.Screen name="member-overview" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="pay" />
        </Stack.Protected>
        <Stack.Protected guard={isAdmin}>
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="member-new" />
          <Stack.Screen name="member-detail" />
          <Stack.Screen name="renew" />
          <Stack.Screen name="notice-compose" />
          <Stack.Screen name="exports" />
          <Stack.Screen name="plans" />
          <Stack.Screen name="payment-settings" />
        </Stack.Protected>
      </Stack.Protected>

      <Stack.Protected guard={authed && profile?.status !== 'suspended'}>
        <Stack.Screen name="set-password" />
      </Stack.Protected>
    </Stack>
    {connectivityKnown && !isOnline ? (
      <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, backgroundColor: c.bg, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Banner variant="offline">No internet connection. Reconnect to use Apex.</Banner>
        <Button block onPress={() => void refreshConnectivity().catch(() => undefined)}>Retry connection</Button>
      </View>
    ) : null}
    <AppUpdateGate />
    </View>
  );
}

/**
 * On web, constrain the app to a phone-sized frame centered on a dark
 * backdrop — same presentation as the design system showcase.
 * On native, fill the full screen.
 */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg, direction: isRtl ? 'rtl' : 'ltr' }}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        {children}
      </SafeAreaView>
    );
  }

  const mobile = width < 600;
  const frameWidth = mobile ? width : Math.min(390, width - 24);
  const frameHeight = mobile ? height : Math.min(844, height - 24);

  return (
    <View style={[webStyles.backdrop, { backgroundColor: darkMode ? '#0A0A0A' : '#EDEDED' }]}>
      <View
        style={[
          webStyles.phone,
          {
            width: frameWidth,
            height: frameHeight,
            borderRadius: mobile ? 0 : 46,
            borderWidth: mobile ? 0 : 1,
            backgroundColor: c.bg,
            borderColor: darkMode ? '#2A2A2A' : '#D6D6D6',
          },
        ]}
      >
        <WebSafeAreaSpacer dark={darkMode} />
        <View style={{ flex: 1, direction: isRtl ? 'rtl' : 'ltr' }}>{children}</View>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
    <AppProvider>
      {Platform.OS === 'web' ? (
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
          @keyframes sh { to { background-position: -200% 0; } }
          @keyframes mpress { 0% { transform: scale(1); } 50% { transform: scale(.985); } 100% { transform: scale(1); } }
          * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
          html, body, #root { height: 100%; min-height: 100dvh; overflow: hidden; }
          input, textarea { scroll-margin-block: 160px; }
        `}</style>
      ) : null}
      <PhoneFrame>
        <RootNav />
      </PhoneFrame>
    </AppProvider>
    </SafeAreaProvider>
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
