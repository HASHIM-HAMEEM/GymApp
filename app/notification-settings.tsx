import * as React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Body } from '@/components/Chrome';
import { Banner, SectionBlock } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { SectionLabel } from '@/components/Tag';
import { SettingsGroup, SettingsRow } from '@/components/SettingsSection';
import { notificationStateLabel, openNotificationSettings, sendTestNotification } from '@/lib/notifications';
import { useApp } from '@/providers/AppProvider';
import { useColors, typography } from '@/theme/tokens';

export default function NotificationSettings() {
  const router = useRouter();
  const { darkMode, notificationState, requestNotifications, refreshNotifications, t } = useApp();
  const c = useColors(darkMode);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [testSent, setTestSent] = React.useState(false);

  const enable = async () => {
    setBusy(true);
    setError(null);
    setTestSent(false);
    try {
      await requestNotifications();
      await refreshNotifications();
    } catch {
      setError(t('notifications.registerFailed'));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setError(null);
    setTestSent(false);
    try {
      await sendTestNotification();
      setTestSent(true);
    } catch {
      setError(t('notifications.testFailed'));
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
          {testSent ? <Banner variant="info">{t('notifications.testSent')}</Banner> : null}
          {notificationState === 'unsupported' ? <Banner variant="info">Push notifications are available in the installed Apex app. Notices remain available in this browser.</Banner> : null}
          {notificationState === 'expo-go' ? <Banner variant="info">{t('notifications.expoGo')}</Banner> : null}
          {notificationState === 'unconfigured' ? <Banner variant="warn">{t('notifications.unconfigured')}</Banner> : null}

          <SectionBlock title={<SectionLabel>{t('notifications.deviceStatus')}</SectionLabel>}>
            <SettingsGroup>
              <SettingsRow icon="bell" label={t('notifications.pushLabel')} value={t(notificationStateLabel(notificationState))} last />
            </SettingsGroup>
          </SectionBlock>

          <Text style={{ color: c.ink2, fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22 }}>
            {t('notifications.about')}
          </Text>

          {nativeAvailable && notificationState !== 'denied' && notificationState !== 'registered' ? (
            <Button block loading={busy} onPress={() => void enable()}>{t('notifications.enable')}</Button>
          ) : null}
          {nativeAvailable && notificationState !== 'prompt' && notificationState !== 'denied' ? (
            <Button variant="secondary" block disabled={busy} onPress={() => void test()}>{t('notifications.test')}</Button>
          ) : null}
          {nativeAvailable && (notificationState === 'denied' || notificationState === 'registered' || notificationState === 'granted') ? (
            <Button variant="secondary" block disabled={busy} onPress={() => void openNotificationSettings()}>{t('notifications.openSettings')}</Button>
          ) : null}
          <Button variant="quiet" block disabled={busy} onPress={() => void refreshNotifications()}>{t('notifications.refresh')}</Button>
        </Body>
      </ScrollView>
    </View>
  );
}
