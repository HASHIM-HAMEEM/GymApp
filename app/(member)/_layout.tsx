import * as React from 'react';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { useColors } from '@/theme/tokens';
import { TabBar, TabDef } from '@/components/Chrome';
import { useApp } from '@/data/store';

const TAB_ICONS: Record<string, TabDef> = {
  home: { key: 'home', label: 'Home', icon: 'home' },
  visits: { key: 'visits', label: 'Visits', icon: 'clock' },
  notices: { key: 'notices', label: 'Notices', icon: 'bell' },
  profile: { key: 'profile', label: 'Profile', icon: 'user' },
};

interface TabBarProps {
  state: { routes: { name: string; key: string }[]; index: number };
  navigation: { navigate: (name: string) => void };
}

function MemberTabBar({ state, navigation }: TabBarProps) {
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
      fab={{ icon: 'qr', onPress: () => router.push('/qr') }}
    />
  );
}

export default function MemberLayout() {
  const { role, currentMember } = useApp();
  const c = useColors(false);

  if (role !== 'member' || !currentMember) {
    return <Redirect href="/" />;
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
