import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, SectionLabel, Tag } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { Switch } from '@/components/Overlays';
import { useApp } from '@/data/store';
import { CLUB, ADMIN_USER } from '@/data/plans';
import type { ColorSet } from '@/theme/tokens';

export default function AdminProfile() {
  const router = useRouter();
  const { adminName, adminInitials, signOut, darkMode, toggleDarkMode } = useApp();
  const c = useColors(darkMode);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Profile" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>

      <View style={styles.head}>
        <Monogram text={adminInitials} size={56} fontSize={18} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{adminName}</Text>
          <Text style={[styles.sub, { color: c.ink3, fontFamily: typography.mono }]}>Front desk · Reception {ADMIN_USER.reception}</Text>
        </View>
        <Tag variant="accent">Admin</Tag>
      </View>

      <View>
        <SectionLabel>Preferences</SectionLabel>
        <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
          <View style={[styles.row, { borderColor: c.line }]}>
            <Icon name="info" size={19} color={c.ink3} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: c.ink }]}>Dark mode</Text>
              <Text style={[styles.rowSub, { color: c.ink3 }]}>Switch between light and dark theme</Text>
            </View>
            <Switch on={darkMode} onChange={toggleDarkMode} />
          </View>
        </View>
      </View>

      <View>
        <SectionLabel>Your club</SectionLabel>
        <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
          <Row icon="pin" title={CLUB.name} sub={`${CLUB.address}, ${CLUB.city}`} c={c} />
          <Row
            icon="clock"
            title={`Mon–Thu ${CLUB.hours[0].value}`}
            sub={`Fri ${CLUB.hours[1].value} · Sat ${CLUB.hours[2].value}`}
            c={c}
          />
          <Row icon="phone" title={CLUB.phone} sub="Front desk" right={<Button size="sm" variant="secondary">Call</Button>} c={c} />
        </View>
      </View>

      <View>
        <SectionLabel>Admin tools</SectionLabel>
        <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
          <Row icon="users" title="Members" sub="View and manage all members" c={c} />
          <Row icon="speak" title="Notices" sub="Send announcements to members" c={c} />
          <Row icon="scan" title="Scanner" sub="Check in members by QR code" c={c} />
        </View>
      </View>

      <View style={{ paddingTop: 8 }}>
        <Button variant="danger" block icon="logout" onPress={() => { signOut(); router.replace('/'); }}>
          Sign out of Meridian
        </Button>
        <Text style={[styles.version, { color: c.ink3 }]}>Meridian Admin · v1.0</Text>
      </View>
        </Body>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  title,
  sub,
  right,
  c,
}: {
  icon: any;
  title: string;
  sub: string;
  right?: React.ReactNode;
  c: ColorSet;
}) {
  return (
    <View style={[styles.row, { borderColor: c.line }]}>
      <Icon name={icon} size={19} color={c.ink3} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowSub, { color: c.ink3 }]}>{sub}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.screen },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 2,
  },
  name: {
    fontFamily: typography.fontFamily,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    marginTop: 3,
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    fontWeight: '500',
  },
  rowSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    marginTop: 2,
  },
  version: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 12,
  },
});
