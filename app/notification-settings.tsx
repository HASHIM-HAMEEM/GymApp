import * as React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Body } from '@/components/Chrome';
import { Banner, SectionBlock } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { SectionLabel } from '@/components/Tag';
import { SettingsGroup, SettingsRow } from '@/components/SettingsSection';
import { notificationStateLabel, openNotificationSettings } from '@/lib/notifications';
import { useApp } from '@/providers/AppProvider';
import { useColors, typography } from '@/theme/tokens';

export default function NotificationSettings() {
  const router = useRouter();
  const { darkMode, notificationState, requestNotifications, refreshNotifications, t } = useApp();
  const c = useColors(darkMode);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestNotifications();
      await refreshNotifications();
    } catch {
      setError('Notifications could not be registered. Check your connection and app configuration, then retry.');
    } finally {
      setBusy(false);
    }
  };

  const nativeAvailable = Platform.OS !== 'web' && notificationState !== 'expo-go';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('notifications.title')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 24 }}>
          {error ? <Banner variant="error">{error}</Banner> : null}
          {notificationState === 'unsupported' ? <Banner variant="info">Push notifications are available in the installed Apex app. Notices remain available in this browser.</Banner> : null}
          {notificationState === 'expo-go' ? <Banner variant="info">{t('notifications.expoGo')}</Banner> : null}
          {notificationState === 'unconfigured' ? <Banner variant="warn">Permission is available, but this build is missing its Expo project or push credential configuration.</Banner> : null}

          <SectionBlock title={<SectionLabel>Device status</SectionLabel>}>
            <SettingsGroup>
              <SettingsRow icon="bell" label="Push notifications" value={t(notificationStateLabel(notificationState))} last />
            </SettingsGroup>
          </SectionBlock>

          <Text style={{ color: c.ink2, fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22 }}>
            Apex uses notifications for club notices and urgent updates. You can always read the same notices inside the app.
          </Text>

          {nativeAvailable && notificationState !== 'denied' && notificationState !== 'registered' ? (
            <Button block loading={busy} onPress={() => void enable()}>Enable notifications</Button>
          ) : null}
          {nativeAvailable && (notificationState === 'denied' || notificationState === 'registered' || notificationState === 'granted') ? (
            <Button variant="secondary" block onPress={() => void openNotificationSettings()}>Open device settings</Button>
          ) : null}
          <Button variant="quiet" block disabled={busy} onPress={() => void refreshNotifications()}>Refresh status</Button>
        </Body>
      </ScrollView>
    </View>
  );
}
