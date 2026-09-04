import * as React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useColors } from '@/theme/tokens';
import { TabBar, TabDef } from '@/components/Chrome';
import { useApp } from '@/data/store';

const TAB_ICONS: Record<string, TabDef> = {
  home: { key: 'home', label: 'Home', icon: 'home', href: '/(member)/home' },
  visits: { key: 'visits', label: 'Visits', icon: 'clock', href: '/(member)/visits' },
  notices: { key: 'notices', label: 'Notices', icon: 'bell', href: '/(member)/notices' },
  profile: { key: 'profile', label: 'Profile', icon: 'user', href: '/(member)/profile' },
};

interface TabBarProps {
  state: { routes: { name: string; key: string }[]; index: number };
}

function MemberTabBar({ state }: TabBarProps) {
  const active = state.routes[state.index].name;
  const tabs = state.routes
    .filter((route: { name: string }) => TAB_ICONS[route.name])
    .map((route: { name: string }) => TAB_ICONS[route.name]);

  return (
    <TabBar
      tabs={tabs}
      active={active}
      fab={{ icon: 'qr', href: '/qr' }}
    />
  );
}

export default function MemberLayout() {
  const { role, darkMode } = useApp();
  const c = useColors(darkMode);

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
