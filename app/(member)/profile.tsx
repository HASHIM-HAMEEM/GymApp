import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { TextButton } from '@/components/Button';
import { Monogram } from '@/components/Tag';
import { Switch } from '@/components/Overlays';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';
import { useCurrentMember } from '@/data/api/queries';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, darkMode, toggleDarkMode, authError, clearAuthError } = useApp();
  const memberQuery = useCurrentMember();
  const c = useColors(darkMode);
  const m = memberQuery.data ?? null;

  const initials = m ? `${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase() : '··';

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/welcome');
    } catch {
      clearAuthError();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title="Profile"
        right={<TextButton onPress={() => router.push('/edit-profile')}>Edit</TextButton>}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Body>
          {authError ? (
            <Text style={{ color: c.bad, fontSize: 13, lineHeight: 19 }}>{authError}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 6 }}>
            <Monogram text={initials} size={62} fontSize={20} />
            <View>
              <Text style={[styles.name, { color: c.ink }]}>
                {m ? `${m.firstName} ${m.lastName}` : 'Loading…'}
              </Text>
              <Text style={[styles.sub, { color: c.ink3, fontFamily: typography.mono }]}>
                {m ? `${m.id} · joined ${m.memberSince}` : ''}
              </Text>
            </View>
          </View>

          <View style={[styles.list, { borderColor: c.line, backgroundColor: c.bg1 }]}>
            <ProfileRow label="Email" value={m?.email ?? ''} />
            <ProfileRow label="Phone" value={m?.phone || '—'} />
            <ProfileRow label="Date of birth" value={m?.dateOfBirth || '—'} />
            {m?.emergencyName ? (
              <ProfileRow label="Emergency" value={`${m.emergencyName} · ${m.emergencyPhone ?? ''}`} />
            ) : null}
            <ProfileRow label="National ID" value={m?.nationalId || '—'} />
            <ProfileRow label="Address" value={m?.address || '—'} last />
          </View>

          <View style={[styles.list, { borderColor: c.line, backgroundColor: c.bg1 }]}>
            <IconRow icon="moon" label="Dark mode" value={darkMode ? 'On' : 'Off'} right={<Switch on={darkMode} onChange={toggleDarkMode} />} />
            <IconRow icon="globe" label="Language" value="English" />
            <IconRow icon="shield" label="Privacy & data" />
            <IconRow icon="logout" label="Sign out" danger onPress={handleSignOut} last />
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
