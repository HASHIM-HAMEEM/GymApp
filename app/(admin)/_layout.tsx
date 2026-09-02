import * as React from 'react';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { useColors } from '@/theme/tokens';
import { TabBar, TabDef } from '@/components/Chrome';
import { useApp } from '@/data/store';

const TAB_ICONS: Record<string, TabDef> = {
  today: { key: 'today', label: 'Today', icon: 'grid' },
  members: { key: 'members', label: 'Members', icon: 'users' },
  notices: { key: 'notices', label: 'Notices', icon: 'megaphone' },
  profile: { key: 'profile', label: 'Profile', icon: 'user' },
};

interface TabBarProps {
  state: { routes: { name: string; key: string }[]; index: number };
  navigation: { navigate: (name: string) => void };
}

function AdminTabBar({ state, navigation }: TabBarProps) {
  const router = useRouter();
  const active = state.routes[state.index].name;
  const tabs = state.routes
    .filter((r: { name: string }) => TAB_ICONS[r.name])
    .map((r: { name: string }) => TAB_ICONS[r.name]);

  return (
    <TabBar
      tabs={tabs}
      active={active}
      onChange={(key) => navigation.navigate(key)}
      fab={{ icon: 'scan', onPress: () => router.push('/(admin)/scanner') }}
    />
  );
}

export default function AdminLayout() {
  const { role } = useApp();
  if (role !== 'admin') return <Redirect href="/" />;

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
