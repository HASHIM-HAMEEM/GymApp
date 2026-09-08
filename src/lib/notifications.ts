import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationResponse } from 'expo-notifications';
import { requireSupabase } from './supabase';

/**
 * expo-notifications throws on import in Expo Go (Android, SDK 53+) because
 * remote push was removed from Expo Go. We skip loading the module entirely
 * in Expo Go so the error never fires; push reports `expo-go` state.
 */
type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;
let notificationsLoadAttempted = false;

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Notifications) return Notifications;
  if (notificationsLoadAttempted) return null;
  notificationsLoadAttempted = true;
  if (isExpoGo()) return null;
  try {
    Notifications = await import('expo-notifications');
    return Notifications;
  } catch {
    notificationsLoadAttempted = false;
    return null;
  }
}

// Best-effort notification handler setup — skipped in Expo Go and web.
if (Platform.OS !== 'web' && !isExpoGo()) {
  void loadNotifications().then((mod) => {
    if (!mod) return;
    try {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      // ignore — handler registration is non-critical
    }
  });
}

export type NotificationState =
  | 'unsupported'
  | 'prompt'
  | 'denied'
  | 'granted'
  | 'expo-go'
  | 'unconfigured'
  | 'disabled'
  | 'registered';

export type NotificationStateKey =
  | 'notifications.state.unsupported'
  | 'notifications.state.prompt'
  | 'notifications.state.denied'
  | 'notifications.state.granted'
  | 'notifications.state.expoGo'
  | 'notifications.state.unconfigured'
  | 'notifications.state.disabled'
  | 'notifications.state.registered';

export function notificationStateLabel(state: NotificationState): NotificationStateKey {
  switch (state) {
    case 'registered':
      return 'notifications.state.registered';
    case 'granted':
      return 'notifications.state.granted';
    case 'denied':
      return 'notifications.state.denied';
    case 'unsupported':
      return 'notifications.state.unsupported';
    case 'unconfigured':
      return 'notifications.state.unconfigured';
    case 'disabled':
      return 'notifications.state.disabled';
    case 'expo-go':
      return 'notifications.state.expoGo';
    case 'prompt':
      return 'notifications.state.prompt';
  }
}

export async function getNotificationState(): Promise<NotificationState> {
  if (Platform.OS === 'web') return 'unsupported';
  if (isExpoGo()) return 'expo-go';
  const mod = await loadNotifications();
  if (!mod) return 'unconfigured';
  const permission = await mod.getPermissionsAsync();
  if (permission.status === 'granted') return 'granted';
  return permission.canAskAgain ? 'prompt' : 'denied';
}

async function ensureNotificationChannel(mod: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await mod.setNotificationChannelAsync('club-notices', {
    name: 'Club notices',
    description: 'Membership announcements and urgent club updates',
    importance: mod.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: '#F5F5F5',
    sound: 'default',
  });
}

export async function requestNotificationPermission(): Promise<NotificationState> {
  if (Platform.OS === 'web') return 'unsupported';
  if (isExpoGo()) return 'expo-go';
  const mod = await loadNotifications();
  if (!mod) return 'unconfigured';
  await ensureNotificationChannel(mod);
  const current = await mod.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await mod.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
  return permission.status === 'granted'
    ? 'granted'
    : permission.canAskAgain ? 'prompt' : 'denied';
}

export async function registerPushDevice(): Promise<{ state: NotificationState; token?: string }> {
  const permissionState = await requestNotificationPermission();
  if (permissionState !== 'granted') return { state: permissionState };
  if (!Device.isDevice) return { state: 'unconfigured' };
  if (Constants.appOwnership === 'expo') return { state: 'expo-go' };

  const mod = await loadNotifications();
  if (!mod) return { state: 'unconfigured' };

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
    || Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId;
  if (!projectId) return { state: 'unconfigured' };

  const token = (await mod.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await requireSupabase().rpc('register_push_device', {
    p_expo_push_token: token,
    p_platform: Platform.OS,
  });
  if (error) throw error;
  return { state: 'registered', token };
}

export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web' || isExpoGo()) return;
  const mod = await loadNotifications();
  if (!mod) throw new Error('Notifications are unavailable in this build.');
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') throw new Error('Notification permission is not granted.');
  await ensureNotificationChannel(mod);
  await mod.scheduleNotificationAsync({
    content: {
      title: 'Apex notifications are ready',
      body: 'This device can show club notices.',
      sound: 'default',
      data: { url: '/notification-settings' },
    },
    trigger: Platform.OS === 'android'
      ? { type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'club-notices' }
      : { type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}

export async function unregisterPushDevice(token: string) {
  const { error } = await requireSupabase().rpc('unregister_push_device', {
    p_expo_push_token: token,
  });
  if (error) throw error;
}

export async function openNotificationSettings() {
  if (Platform.OS !== 'web') await Linking.openSettings();
}

export function subscribeToNotificationResponses(
  onUrl: (url: string, responseId?: string) => void,
) {
  if (Platform.OS === 'web') return () => undefined;
  let subscription: { remove: () => void } | null = null;
  let disposed = false;
  void loadNotifications().then((mod) => {
    if (!mod || disposed) return;
    const redirect = (response: NotificationResponse | null) => {
      if (!response || disposed) return;
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        onUrl(url, response.notification.request.identifier);
      }
    };
    void mod.getLastNotificationResponseAsync().then(redirect);
    subscription = mod.addNotificationResponseReceivedListener(redirect);
  });
  return () => { disposed = true; subscription?.remove(); };
}

/* ------------------------------------------------------------------ */
/* Local notice notifications (no remote push service required)        */
/* New club notices raise a device notification while the app is open  */
/* (instant) and from a periodic background check (~every 15 minutes). */
/* ------------------------------------------------------------------ */

const NOTIFIED_STORAGE_KEY = 'apex.notifiedNotices.v1';
export const NOTICE_BACKGROUND_TASK = 'apex-notice-check';

export interface NoticeNotificationInput {
  id: string;
  title: string;
  body: string;
  read: boolean;
}

async function loadNotifiedIds(): Promise<Set<string> | null> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

async function saveNotifiedIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // best effort — a missed write only risks a duplicate notification
  }
}

async function notifyNotice(notice: NoticeNotificationInput): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const mod = await loadNotifications();
  if (!mod) return false;
  const permission = await mod.getPermissionsAsync();
  if (permission.status !== 'granted') return false;
  await ensureNotificationChannel(mod);
  await mod.scheduleNotificationAsync({
    content: {
      title: notice.title.slice(0, 120),
      body: notice.body.length > 200 ? `${notice.body.slice(0, 197)}…` : notice.body,
      sound: 'default',
      data: { url: `/notice?id=${notice.id}` },
    },
    trigger: Platform.OS === 'android'
      ? { type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'club-notices' }
      : { type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
  return true;
}

/**
 * Detects notices never alerted on this device and raises a local
 * notification for each (newest first, capped at 3 per check to avoid
 * banner spam). The first run only records the current notices so old
 * unread items never blast the member after install or sign-in.
 */
export async function processNoticesForNotification(
  notices: NoticeNotificationInput[],
): Promise<number> {
  if (notices.length === 0) return 0;
  const known = await loadNotifiedIds();
  if (known === null) {
    await saveNotifiedIds(new Set(notices.map((n) => n.id)));
    return 0;
  }
  const fresh = notices.filter((n) => !n.read && !known.has(n.id));
  if (fresh.length === 0) return 0;

  const toAlert = fresh.slice(0, 3);
  let alerted = 0;
  for (const notice of toAlert) {
    if (await notifyNotice(notice)) alerted += 1;
  }
  const next = new Set(notices.map((n) => n.id));
  await saveNotifiedIds(next);
  return alerted;
}

/** Direct unread-notice fetch used by the background task (no React Query). */
export async function fetchUnreadMemberNotices(): Promise<NoticeNotificationInput[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notice_deliveries')
    .select('notices!inner(id, title, body)')
    .is('read_at', null)
    .order('delivered_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return ((data ?? []) as unknown as { notices: { id: string; title: string; body: string } }[])
    .map((row) => ({ id: row.notices.id, title: row.notices.title, body: row.notices.body, read: false }));
}

/** Registers the periodic background notice check (idempotent). */
export async function registerNoticeBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web' || isExpoGo()) return;
  try {
    const { registerTaskAsync } = await import('expo-background-task');
    await registerTaskAsync(NOTICE_BACKGROUND_TASK, { minimumInterval: 15 });
  } catch {
    // already registered, or background tasks restricted — foreground checks still run
  }
}

// Define the background task at module scope (restored tasks need the
// definition registered during app startup). Dynamic import keeps Expo Go
// and web safe from native-module side effects.
if (Platform.OS !== 'web' && !isExpoGo()) {
  void (async () => {
    try {
      const TaskManager = await import('expo-task-manager');
      const { BackgroundTaskResult } = await import('expo-background-task');
      TaskManager.defineTask(NOTICE_BACKGROUND_TASK, async () => {
        try {
          const notices = await fetchUnreadMemberNotices();
          await processNoticesForNotification(notices);
          return BackgroundTaskResult.Success;
        } catch {
          return BackgroundTaskResult.Failed;
        }
      });
    } catch {
      // notifications module unavailable — task simply never registers
    }
  })();
}
