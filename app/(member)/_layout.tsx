import * as React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, Redirect } from 'expo-router';
import { useColors } from '@/theme/tokens';
import { TabBar, TabDef } from '@/components/Chrome';
import { useApp } from '@/data/store';
import { useNotices } from '@/data/api/queries';
import { processNoticesForNotification, registerNoticeBackgroundTask } from '@/lib/notifications';

const TAB_ICONS: Record<string, Omit<TabDef, 'label'>> = {
  home: { key: 'home', icon: 'home', href: '/(member)/home' },
  visits: { key: 'visits', icon: 'clock', href: '/(member)/visits' },
  notices: { key: 'notices', icon: 'bell', href: '/(member)/notices' },
  profile: { key: 'profile', icon: 'user', href: '/(member)/profile' },
};

interface TabBarProps {
  state: { routes: { name: string; key: string }[]; index: number };
}

function MemberTabBar({ state }: TabBarProps) {
  const { t } = useApp();
  const notices = useNotices();
  const unread = (notices.data ?? []).filter((notice) => !notice.read).length;
  const noticeRows = notices.data;

  // New unread notices raise a local device notification (works without
  // any remote push service). Reuses the notices poll (30s) already running.
  React.useEffect(() => {
    if (!noticeRows || noticeRows.length === 0) return;
    void processNoticesForNotification(
      noticeRows.map((n) => ({ id: n.id, title: n.title, body: n.body, read: Boolean(n.read) })),
    );
  }, [noticeRows]);
  const active = state.routes[state.index].name;
  const labels = {
    home: t('tabs.home'),
    visits: t('tabs.visits'),
    notices: t('tabs.notices'),
    profile: t('tabs.profile'),
  };
  const tabs = state.routes
    .filter((route: { name: string }) => TAB_ICONS[route.name])
    .map((route: { name: string }) => ({ ...TAB_ICONS[route.name], label: labels[route.name as keyof typeof labels], badge: route.name === 'notices' ? unread : 0 }));

  return (
    <TabBar
      tabs={tabs}
      active={active}
      fab={{ icon: 'qr', href: '/qr' }}
    />
  );
}

export default function MemberLayout() {
  const { role, darkMode, notificationState, requestNotifications } = useApp();
  const c = useColors(darkMode);
  const notificationPrompted = React.useRef(false);

  // Periodic background notice check (~every 15 min) so notifications
  // arrive even when the app is closed. No-op on web and Expo Go.
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    void registerNoticeBackgroundTask();
  }, []);

  // Ask for notification permission once after member sign-in.
  React.useEffect(() => {
    if (Platform.OS === 'web' || notificationPrompted.current) return;
    if (notificationState !== 'prompt') return;
    let active = true;
    void AsyncStorage.getItem('apex.notificationsPrompted.v1')
      .then((value) => {
        if (!active || value !== null || notificationPrompted.current) return;
        notificationPrompted.current = true;
        void AsyncStorage.setItem('apex.notificationsPrompted.v1', '1').catch(() => undefined);
        void requestNotifications().catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [notificationState, requestNotifications]);

  if (role !== 'member') {
    return <Redirect href={role === 'admin' ? '/(admin)/today' : '/welcome'} />;
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarActiveTintColor: c.accent }}
      tabBar={(props) => <MemberTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="visits" options={{ title: 'Visits' }} />
      <Tabs.Screen name="notices" options={{ title: 'Notices' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="membership" options={{ href: null, title: 'Membership' }} />
    </Tabs>
  );
}
