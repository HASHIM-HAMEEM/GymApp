import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** One row of the public.app_releases table, as returned by latest_app_release(). */
export type AppRelease = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  minSupportedVersionCode: number;
  notes: string;
  publishedAt: string | null;
};

export type UpdateStatus = 'up_to_date' | 'optional' | 'forced';

/**
 * The versionCode of the installed binary (0 on web/dev). Read from the real
 * Android PackageInfo first — that is what the OS compares on install — and
 * fall back to the app.json value embedded at build time.
 */
export function currentVersionCode(): number {
  if (Platform.OS !== 'android') return 0;
  const native = Number.parseInt(Application.nativeBuildVersion ?? '', 10);
  if (Number.isFinite(native) && native > 0) return native;
  const code = Constants.expoConfig?.android?.versionCode;
  return typeof code === 'number' && Number.isFinite(code) ? code : 0;
}

export function currentVersionName(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '';
}

/**
 * Decide what the installed build should do about `release`.
 * forced   — installed versionCode is below the release's minimum supported
 *            version: the app must not be usable until updated.
 * optional — a newer build exists but this one is still supported.
 */
export function updateStatus(
  currentCode: number,
  release: Pick<AppRelease, 'versionCode' | 'minSupportedVersionCode'> | null,
): UpdateStatus {
  if (!release || !Number.isFinite(release.versionCode) || release.versionCode <= 0) {
    return 'up_to_date';
  }
  if (currentCode >= release.versionCode) return 'up_to_date';
  return currentCode < release.minSupportedVersionCode ? 'forced' : 'optional';
}

const SNOOZE_KEY = 'apex.appUpdate.snooze.v1';
const SNOOZE_MS = 24 * 60 * 60 * 1000; // "Later" quiets the prompt for 24h per version

/** Returns true when this release's optional prompt was dismissed recently. */
export async function isUpdateSnoozed(versionCode: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { versionCode?: number; until?: number };
    return parsed.versionCode === versionCode && typeof parsed.until === 'number' && parsed.until > Date.now();
  } catch {
    return false;
  }
}

export async function snoozeUpdate(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify({ versionCode, until: Date.now() + SNOOZE_MS }));
  } catch {
    /* non-fatal — prompt simply reappears next launch */
  }
}
