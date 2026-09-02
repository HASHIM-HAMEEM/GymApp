import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { TextButton } from '@/components/Button';
import { Monogram } from '@/components/Tag';
import { Switch } from '@/components/Overlays';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentMember, signOut, darkMode, toggleDarkMode } = useApp();
  const c = useColors(darkMode);
  if (!currentMember) return null;
  const m = currentMember;
  const initials = `${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title="Profile"
        right={<TextButton onPress={() => router.push('/edit-profile')}>Edit</TextButton>}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 6 }}>
            <Monogram text={initials} size={62} fontSize={20} />
            <View>
              <Text style={[styles.name, { color: c.ink }]}>{m.firstName} {m.lastName}</Text>
              <Text style={[styles.sub, { color: c.ink3, fontFamily: typography.mono }]}>
                {m.id} · joined {m.memberSince}
              </Text>
            </View>
          </View>

          <View style={[styles.list, { borderColor: c.line, backgroundColor: c.bg1 }]}>
            <ProfileRow label="Phone" value={m.phone} />
            <ProfileRow label="Email" value={m.email || '—'} />
            <ProfileRow label="Date of birth" value={m.dateOfBirth || '—'} />
            <ProfileRow label="Aadhar" value={m.aadharNumber || '—'} />
            <ProfileRow label="Address" value={m.address || '—'} last />
          </View>

          <View style={[styles.list, { borderColor: c.line, backgroundColor: c.bg1 }]}>
            <IconRow icon="moon" label="Dark mode" value={darkMode ? 'On' : 'Off'} right={<Switch on={darkMode} onChange={toggleDarkMode} />} />
            <IconRow icon="globe" label="Language" value="English" />
            <IconRow icon="shield" label="Privacy & data" />
            <IconRow icon="logout" label="Sign out" danger onPress={() => { signOut(); router.replace('/'); }} last />
          </View>
        </Body>
      </ScrollView>
    </View>
  );
}

function ProfileRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View style={[styles.prow, { borderBottomWidth: last ? 0 : 1, borderColor: c.line }]}>
      <Text style={[styles.k, { color: c.ink3, width: 92, flexShrink: 0 }]}>{label}</Text>
      <Text style={[styles.v, { color: c.ink, flex: 1 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function IconRow({
  icon,
  label,
  value,
  danger,
  onPress,
  right,
  last,
}: {
  icon: any;
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const content = (
    <View style={[styles.prow, { borderBottomWidth: last ? 0 : 1, borderColor: c.line, gap: 12 }]}>
      <Icon name={icon} size={18} color={danger ? c.bad : c.ink3} />
      <Text style={[styles.k, { color: danger ? c.bad : c.ink3, flex: 1 }]}>{label}</Text>
      {value ? <Text style={[styles.v, { color: c.ink2, fontSize: 13 }]}>{value}</Text> : null}
      {right ? right : null}
      {!danger && !right ? <Icon name="chev" size={16} color={c.ink4} /> : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}

const styles = StyleSheet.create({
  name: {
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
    marginTop: 5,
  },
  list: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  prow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  k: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: '#999',
  },
  v: {
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    fontWeight: '500',
  },
});
