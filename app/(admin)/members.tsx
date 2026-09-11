import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, StatusDot, Tag } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/Overlays';
import { EmptyState } from '@/components/Surfaces';
import { useMembers } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { statusVisual, fmtShort } from '@/data/format';
import type { MembershipStatus } from '@/data/types';
import type { Language } from '@/lib/i18n';

export default function AdminMembers() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query);
  const [filter, setFilter] = React.useState<'all' | MembershipStatus | 'removed'>('all');
  const membersQuery = useMembers(deferredQuery, filter);
  const { darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const filters = [
    { key: 'all' as const, label: t('adminMembers.filterAll') },
    { key: 'active' as const, label: t('status.active'), dot: 'ok' as const },
    { key: 'expiring' as const, label: t('status.expiring'), dot: 'warn' as const },
    { key: 'expired' as const, label: t('status.expired'), dot: 'bad' as const },
    { key: 'paused' as const, label: t('status.paused'), dot: 'muted' as const },
    { key: 'due' as const, label: t('status.due'), dot: 'warn' as const },
    { key: 'removed' as const, label: t('adminMembers.filterRemoved'), dot: 'muted' as const },
  ];

  const members = membersQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('adminMembers.title')} right={<Button size="sm" variant="secondary" icon="userplus" onPress={() => router.push('/member-new')}>{t('adminMembers.new')}</Button>} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 14 }}>

      <View style={[styles.searchbar, { backgroundColor: c.bg2, borderColor: c.line2, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Icon name="search" size={19} color={c.ink3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t('adminMembers.searchPlaceholder')}
          placeholder={isRtl ? 'نام یا رکن نمبر تلاش کریں' : 'Search name or member ID'}
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: c.ink, textAlign: isRtl ? 'right' : 'left', writingDirection: textDir }]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
        {filters.map((f) => (
          <Chip key={f.key} on={filter === f.key} onPress={() => setFilter(f.key)} leading={f.dot ? <StatusDot variant={f.dot} size={7} /> : undefined}>
            {f.label}
          </Chip>
        ))}
      </ScrollView>

      {membersQuery.isLoading ? (
        <Text style={{ color: c.ink3, fontSize: 13, letterSpacing: tracking.small, textAlign: 'center', paddingVertical: 20, writingDirection: textDir }}>
          {t('adminMembers.loading')}
        </Text>
      ) : members.length === 0 ? (
        <EmptyState
          icon="search"
          title={query ? t('adminMembers.noMatch', { query }) : t('adminMembers.noView')}
          body={query
            ? t('adminMembers.searchHelp')
            : t('adminMembers.filterHelp')}
          action={<Button variant="quiet" onPress={() => { setQuery(''); setFilter('all'); }}>{t('adminMembers.clearSearch')}</Button>}
        />
      ) : (
        <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
          {members.map((m) => {
            const ms = m.membership;
            const vis = ms ? statusVisual(ms.status, ms, c, language) : null;
            const invited = m.accountStatus === 'invited';
            const removed = m.removed === true;
            const lastVisit = m.lastVisitAt ? fmtShort(m.lastVisitAt.slice(0, 10), language) : null;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${m.firstName} ${m.lastName}, ${m.id}`}
                key={m.id}
                onPress={() => router.push({ pathname: '/member-detail', params: { id: m.id } })}
                style={({ pressed }) => [styles.mrow, { borderColor: c.line }, pressed && { opacity: 0.6 }]}
              >
                <View style={[styles.mleft, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Monogram text={`${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase()} size={40} fontSize={13} />
                  <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    <Text style={[styles.mname, { color: c.ink, writingDirection: textDir }]} numberOfLines={2}>{m.firstName} {m.lastName}</Text>
                    <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                      <Text style={[styles.msub, { color: c.ink3 }]}>{m.id}</Text>
                      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 7 }}>
                        <StatusDot variant={removed ? 'muted' : invited ? 'muted' : vis?.dotVariant ?? 'muted'} size={6} />
                        <Text style={{ color: c.ink2, fontSize: 13, lineHeight: 19 }}>{removed ? t('status.removed') : invited ? t('common.invited') : vis?.tagLabel ?? t('common.noPlan')}</Text>
                      </View>
                    </View>
                  </View>
                  <Icon name={isRtl ? 'chevl' : 'chev'} size={16} color={c.ink4} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.foot}>
        <Text style={[styles.footText, { color: c.ink3, writingDirection: textDir }]}>
          {membersQuery.isLoading ? ' ' : t(members.length >= 100 ? 'adminMembers.showingMore' : 'adminMembers.showing', { count: members.length })}
        </Text>
      </View>
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontSize: 15,
  },
  tbl: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mrow: {
    minHeight: 80,
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
    fontSize: 15,
    fontWeight: '600',
  },
  msub: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    letterSpacing: tracking.small,
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
    fontSize: 13,
    letterSpacing: tracking.small,
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
    fontSize: 13,
    letterSpacing: tracking.small,
    fontWeight: '600',
  },
  mdot: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  mlast: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  foot: { alignItems: 'center', paddingTop: 8 },
  footText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
});
