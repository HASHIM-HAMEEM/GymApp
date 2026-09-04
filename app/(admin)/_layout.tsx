import * as React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { TabBar, TabDef } from '@/components/Chrome';
import { useApp } from '@/data/store';

const TAB_ICONS: Record<string, Omit<TabDef, 'label'>> = {
  today: { key: 'today', icon: 'grid', href: '/(admin)/today' },
  members: { key: 'members', icon: 'users', href: '/(admin)/members' },
  notices: { key: 'notices', icon: 'megaphone', href: '/(admin)/notices' },
  profile: { key: 'profile', icon: 'user', href: '/(admin)/profile' },
};

interface TabBarProps {
  state: { routes: { name: string; key: string }[]; index: number };
}

function AdminTabBar({ state }: TabBarProps) {
  const { t } = useApp();
  const active = state.routes[state.index].name;
  const labels = {
    today: t('tabs.today'),
    members: t('tabs.members'),
    notices: t('tabs.notices'),
    profile: t('tabs.profile'),
  };
  const tabs = state.routes
    .filter((route: { name: string }) => TAB_ICONS[route.name])
    .map((route: { name: string }) => ({ ...TAB_ICONS[route.name], label: labels[route.name as keyof typeof labels] }));

  return (
    <TabBar
      tabs={tabs}
      active={active}
      fab={{ icon: 'scan', href: '/(admin)/scanner' }}
    />
  );
}

export default function AdminLayout() {
  const { role } = useApp();
  if (role !== 'admin') {
    return <Redirect href={role === 'member' ? '/(member)/home' : '/welcome'} />;
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AdminTabBar {...props} />}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="members" options={{ title: 'Members' }} />
      <Tabs.Screen name="scanner" options={{ href: null, title: 'Scanner' }} />
      <Tabs.Screen name="notices" options={{ title: 'Notices' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
