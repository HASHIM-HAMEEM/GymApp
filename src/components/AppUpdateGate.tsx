import * as React from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useColors, tracking, typography } from '@/theme/tokens';
import { useApp } from '@/providers/AppProvider';
import { useLatestAppRelease } from '@/data/api/queries';
import {
  currentVersionCode,
  currentVersionName,
  isUpdateSnoozed,
  snoozeUpdate,
  updateStatus,
  type AppRelease,
} from '@/lib/app-update';
import { Button } from '@/components/Button';
import { Banner } from '@/components/Surfaces';
import { Sheet } from '@/components/Overlays';
import { Icon } from '@/components/Icon';

/**
 * Downloads the release APK and hands it to the Android package installer.
 * The OS enforces the rest: same-signature requirement, "install unknown apps"
 * consent, atomic replace, data preserved.
 */
export async function downloadAndInstall(
  release: AppRelease,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const FS = await import('expo-file-system/legacy');
  const { startActivityAsync } = await import('expo-intent-launcher');

  const base = FS.cacheDirectory ?? FS.documentDirectory;
  if (!base) throw new Error('No writable directory');
  const target = `${base}apex-update-${release.versionCode}.apk`;
  const task = FS.createDownloadResumable(release.apkUrl, target, {}, (progress) => {
    const total = progress.totalBytesExpectedToWrite;
    if (total > 0) onProgress(progress.totalBytesWritten / total);
  });
  const result = await task.downloadAsync();
  if (!result?.uri) throw new Error('Download failed');

  const contentUri = await FS.getContentUriAsync(result.uri);
  // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
  await startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1 | 268435456,
  });
}

type DownloadState = 'idle' | 'downloading' | 'installing' | 'error';

function useDownloader() {
  const [state, setState] = React.useState<DownloadState>('idle');
  const [progress, setProgress] = React.useState(0);

  const start = React.useCallback(async (release: AppRelease) => {
    setState('downloading');
    setProgress(0);
    try {
      await downloadAndInstall(release, setProgress);
      setState('installing');
    } catch {
      setState('error');
    }
  }, []);

  return { state, progress, start, reset: () => { setState('idle'); setProgress(0); } };
}

function UpdateBody({
  release,
  dl,
}: {
  release: AppRelease;
  dl: ReturnType<typeof useDownloader>;
}) {
  const { darkMode, isRtl, t } = useApp();
  const c = useColors(darkMode);
  const busy = dl.state === 'downloading' || dl.state === 'installing';

  return (
    <View style={{ gap: 14, marginTop: 4 }}>
      {dl.state === 'error' ? <Banner variant="error">{t('update.failed')}</Banner> : null}

      {release.notes ? (
        <Text style={[styles.notes, { color: c.ink2, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
          {release.notes}
        </Text>
      ) : null}

      <Text style={[styles.meta, { color: c.ink3, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
        {t('update.installedVersion', { version: currentVersionName() || '?' })} → v{release.versionName}
      </Text>

      {dl.state === 'downloading' ? (
        <View style={[styles.track, { backgroundColor: c.bg2 }]}>
          <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.round(dl.progress * 100)}%` }]} />
        </View>
      ) : null}

      <Button block loading={busy} onPress={() => void dl.start(release)}>
        {dl.state === 'error'
          ? t('update.retry')
          : busy
            ? t('update.downloading', { pct: Math.round(dl.progress * 100) })
            : t('update.download')}
      </Button>
    </View>
  );
}

/** Optional update — dismissible sheet. "Later" snoozes this version for 24h. */
export function UpdatePromptSheet({
  release,
  visible,
  onLater,
}: {
  release: AppRelease;
  visible: boolean;
  onLater: () => void;
}) {
  const { t } = useApp();
  const dl = useDownloader();
  return (
    <Sheet
      visible={visible}
      onClose={onLater}
      title={t('update.optionalTitle', { version: release.versionName })}
      desc={t('update.optionalDesc')}
    >
      <UpdateBody release={release} dl={dl} />
      <Button variant="quiet" block onPress={onLater}>{t('update.later')}</Button>
    </Sheet>
  );
}

/** Mandatory update — full-screen, non-dismissible. */
function ForceUpdateScreen({ release }: { release: AppRelease }) {
  const { darkMode, isRtl, t } = useApp();
  const c = useColors(darkMode);
  const dl = useDownloader();
  return (
    <View
      accessibilityViewIsModal
      style={[styles.force, { backgroundColor: c.bg, direction: isRtl ? 'rtl' : 'ltr' }]}
    >
      <View style={styles.forceInner}>
        <Icon name="download" size={34} color={c.accent} />
        <Text style={[styles.forceTitle, { color: c.ink, textAlign: isRtl ? 'right' : 'left' }]}>
          {t('update.requiredTitle')}
        </Text>
        <Text style={[styles.forceDesc, { color: c.ink3, textAlign: isRtl ? 'right' : 'left' }]}>
          {t('update.requiredDesc', { version: release.versionName })}
        </Text>
        <View style={{ width: '100%' }}>
          <UpdateBody release={release} dl={dl} />
        </View>
      </View>
    </View>
  );
}

/**
 * Watches latest_app_release() and gates the UI when the installed build is
 * out of date. Mounted above the navigator; no-ops off Android.
 */
export function AppUpdateGate() {
  const releaseQuery = useLatestAppRelease(Platform.OS === 'android');
  const [snoozed, setSnoozed] = React.useState(true);
  const release = releaseQuery.data ?? null;
  const status = updateStatus(currentVersionCode(), release);

  // Re-check whenever the app returns to the foreground.
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void releaseQuery.refetch();
    });
    return () => sub.remove();
  }, [releaseQuery]);

  React.useEffect(() => {
    let alive = true;
    if (status !== 'optional' || !release) return;
    void isUpdateSnoozed(release.versionCode).then((value) => { if (alive) setSnoozed(value); });
    return () => { alive = false; };
  }, [status, release]);

  if (Platform.OS !== 'android' || !release || status === 'up_to_date') return null;

  if (status === 'forced') return <ForceUpdateScreen release={release} />;

  if (snoozed) return null;
  return (
    <UpdatePromptSheet
      release={release}
      visible
      onLater={() => {
        setSnoozed(true);
        void snoozeUpdate(release.versionCode);
      }}
    />
  );
}

/**
 * "Check for updates" settings row — manual entry point. Shows the prompt
 * sheet even when this version was recently snoozed. Lives in
 * CheckForUpdatesRow.tsx to avoid a module cycle with SettingsSection.
 */

const styles = StyleSheet.create({
  notes: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
  },
  meta: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    letterSpacing: tracking.small,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  force: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 28,
    zIndex: 10,
  },
  forceInner: {
    alignItems: 'center',
    gap: 12,
  },
  forceTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  forceDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 20,
    textAlign: 'center',
  },
});
