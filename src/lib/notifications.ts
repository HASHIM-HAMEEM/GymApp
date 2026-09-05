import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { requireSupabase } from './supabase';

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

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<NotificationState> {
  if (Platform.OS === 'web') return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('club-notices', {
      name: 'Club notices',
      description: 'Membership announcements and urgent club updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#F5F5F5',
      sound: 'default',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
  return permission.status === 'granted' ? 'granted' : 'denied';
}

export async function registerPushDevice(): Promise<{ state: NotificationState; token?: string }> {
  const permissionState = await requestNotificationPermission();
  if (permissionState !== 'granted') return { state: permissionState };
  if (!Device.isDevice) return { state: 'unconfigured' };
  if (Constants.appOwnership === 'expo') return { state: 'expo-go' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { state: 'unconfigured' };

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
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
  const redirect = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) {
      onUrl(url, response.notification.request.identifier);
    }
  };
  void Notifications.getLastNotificationResponseAsync().then(redirect);
  const subscription = Notifications.addNotificationResponseReceivedListener(redirect);
  return () => subscription.remove();
}
