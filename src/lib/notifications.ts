import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
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

export async function requestNotificationPermission(): Promise<NotificationState> {
  if (Platform.OS === 'web') return 'unsupported';
  if (isExpoGo()) return 'expo-go';
  const mod = await loadNotifications();
  if (!mod) return 'expo-go';
  if (Platform.OS === 'android') {
    try {
      await mod.setNotificationChannelAsync('club-notices', {
        name: 'Club notices',
        description: 'Membership announcements and urgent club updates',
        importance: mod.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 180, 250],
        lightColor: '#F5F5F5',
        sound: 'default',
      });
    } catch {
      // ignore — channel setup is non-critical in Expo Go
    }
  }
  const current = await mod.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await mod.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
  return permission.status === 'granted' ? 'granted' : 'denied';
}

export async function registerPushDevice(): Promise<{ state: NotificationState; token?: string }> {
  const permissionState = await requestNotificationPermission();
  if (permissionState !== 'granted') return { state: permissionState };
  if (!Device.isDevice) return { state: 'unconfigured' };
  if (Constants.appOwnership === 'expo') return { state: 'expo-go' };

  const mod = await loadNotifications();
  if (!mod) return { state: 'expo-go' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { state: 'unconfigured' };

  const token = (await mod.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await requireSupabase().rpc('register_push_device', {
    p_expo_push_token: token,
    p_platform: Platform.OS,
  });
  if (error) throw error;
  return { state: 'registered', token };
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
  void loadNotifications().then((mod) => {
    if (!mod) return;
    const redirect = (response: NotificationResponse | null) => {
      if (!response) return;
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        onUrl(url, response.notification.request.identifier);
      }
    };
    void mod.getLastNotificationResponseAsync().then(redirect);
    subscription = mod.addNotificationResponseReceivedListener(redirect);
  });
  return () => subscription?.remove();
}
