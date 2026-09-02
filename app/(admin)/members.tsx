import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, StatusDot, Tag } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/Overlays';
import { EmptyState } from '@/components/Surfaces';
import { useApp } from '@/data/store';
import { searchMembers } from '@/data/members';
import { statusVisual, fmtShort } from '@/data/format';
import type { MembershipStatus } from '@/data/types';

const FILTERS: { key: 'all' | MembershipStatus; label: string; dot?: 'ok' | 'warn' | 'bad' | 'muted' }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active', dot: 'ok' },
  { key: 'expiring', label: 'Expiring soon', dot: 'warn' },
  { key: 'expired', label: 'Expired', dot: 'bad' },
  { key: 'paused', label: 'Paused', dot: 'muted' },
  { key: 'due', label: 'Payment due', dot: 'warn' },
];

export default function AdminMembers() {
  const router = useRouter();
  const { members, darkMode } = useApp();
  const c = useColors(darkMode);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | MembershipStatus>('all');

  const filtered = React.useMemo(() => {
    let list = query ? searchMembers(query) : members;
    if (filter !== 'all') list = list.filter((m) => m.membership?.status === filter);
    return list;
  }, [query, filter, members]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Members" right={<Button size="sm" variant="secondary" icon="userplus" onPress={() => router.push('/member-new')}>New</Button>} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 14 }}>

      <View style={[styles.searchbar, { backgroundColor: c.bg2, borderColor: c.line2 }]}>
        <Icon name="search" size={19} color={c.ink3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, member ID, or phone…"
          placeholderTextColor={c.ink3}
          style={[styles.searchInput, { color: c.ink }]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} on={filter === f.key} onPress={() => setFilter(f.key)}>
            {f.dot ? <StatusDot variant={f.dot} size={7} /> : null}
            {f.label}
          </Chip>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title={`No members match "${query}"`}
          body="Check the spelling, or search by member ID or phone number."
          action={<Button variant="quiet" onPress={() => { setQuery(''); setFilter('all'); }}>Clear search</Button>}
        />
      ) : (
        <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
          {filtered.map((m) => {
            const ms = m.membership;
            const vis = ms ? statusVisual(ms.status, ms, c) : null;
            const lastVisit = m.visits.length > 0 ? m.visits[m.visits.length - 1] : null;
            return (
              <Pressable
                key={m.id}
                onPress={() => router.push({ pathname: '/member-detail', params: { id: m.id } })}
                style={({ pressed }) => [styles.mrow, { borderColor: c.line }, pressed && { opacity: 0.6 }]}
              >
                <View style={styles.mtop}>
                  <View style={styles.mleft}>
                    <Monogram text={`${m.firstName[0]}${m.lastName[0]}`.toUpperCase()} size={36} fontSize={12} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.mname, { color: c.ink }]} numberOfLines={1}>{m.firstName} {m.lastName}</Text>
                      <Text style={[styles.msub, { color: c.ink3 }]} numberOfLines={1}>{m.id} · {m.phone}</Text>
                    </View>
                  </View>
                  {vis ? <Tag variant={vis.tagVariant}>{vis.tagLabel}</Tag> : <Tag variant="muted">No plan</Tag>}
                </View>
                <View style={styles.mbottom}>
                  <Text style={[styles.mplan, { color: c.ink2 }]} numberOfLines={1}>{ms?.planName ?? 'No plan'}</Text>
                  <View style={styles.mmeta}>
                    <Text style={[styles.mexp, { color: c.ink }]}>{ms ? fmtShort(ms.expiryDate) : '-'}</Text>
                    <Text style={[styles.mdot, { color: c.ink3 }]}>·</Text>
                    <Text style={[styles.mlast, { color: c.ink2 }]}>{lastVisit ? fmtShort(lastVisit.date) : 'no visits'}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.foot}>
        <Text style={[styles.footText, { color: c.ink3 }]}>Showing {filtered.length} of {members.length} members</Text>
      </View>
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.screen },
  searchbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 15,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
  },
  tbl: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mrow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  mtop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  mleft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
    minWidth: 0,
  },
  mname: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  msub: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    marginTop: 2,
  },
  mbottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 47,
    gap: 8,
  },
  mplan: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    flex: 1,
    minWidth: 0,
  },
  mmeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  mexp: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '600',
  },
  mdot: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
  },
  mlast: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
  },
  foot: { alignItems: 'center', paddingTop: 8 },
  footText: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
  },
});
