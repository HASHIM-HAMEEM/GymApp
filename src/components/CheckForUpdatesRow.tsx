import * as React from 'react';
import { Platform, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/providers/AppProvider';
import { fetchLatestAppRelease, mapAppRelease } from '@/data/api/api';
import { currentVersionCode, currentVersionName, updateStatus, type AppRelease } from '@/lib/app-update';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Overlays';
import { SettingsRow } from '@/components/SettingsSection';
import { UpdatePromptSheet } from '@/components/AppUpdateGate';

/**
 * "Check for updates" settings row — manual entry point. Shows the prompt
 * sheet even when this version was recently snoozed. Kept out of
 * AppUpdateGate/SettingsSection to avoid a module cycle.
 */
export function CheckForUpdatesRow({ label }: { label: string }) {
  const cache = useQueryClient();
  const { t } = useApp();
  const [manual, setManual] = React.useState<AppRelease | null>(null);
  const [feedback, setFeedback] = React.useState<'latest' | 'failed' | null>(null);
  const [checking, setChecking] = React.useState(false);

  const check = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const result = await cache.fetchQuery({
        queryKey: ['app-release'],
        queryFn: async () => {
          const row = await fetchLatestAppRelease();
          return row ? mapAppRelease(row) : null;
        },
        staleTime: 0,
      });
      if (updateStatus(currentVersionCode(), result) === 'up_to_date') setFeedback('latest');
      else setManual(result);
    } catch {
      setFeedback('failed');
    } finally {
      setChecking(false);
    }
  };

  // Android-only: the in-house APK update flow does not apply on web/iOS.
  if (Platform.OS !== 'android') return null;

  return (
    <>
      <SettingsRow
        icon="download"
        label={checking ? t('common.loading') : label}
        value={currentVersionName() ? `v${currentVersionName()}` : ''}
        onPress={Platform.OS === 'android' ? () => void check() : undefined}
      />
      <Sheet
        visible={feedback !== null}
        onClose={() => setFeedback(null)}
        title={feedback === 'latest' ? t('update.latestTitle') : t('update.checkFailedTitle')}
        desc={
          feedback === 'latest'
            ? t('update.latest', { version: currentVersionName() || '?' })
            : t('update.checkFailed')
        }
      >
        <View style={{ marginTop: 12 }}>
          <Button block onPress={() => setFeedback(null)}>{t('common.done')}</Button>
        </View>
      </Sheet>
      {manual ? (
        <UpdatePromptSheet release={manual} visible onLater={() => setManual(null)} />
      ) : null}
    </>
  );
}
