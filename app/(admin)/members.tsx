import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
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
  const [filter, setFilter] = React.useState<'all' | MembershipStatus>('all');
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
          placeholder={t('adminMembers.searchPlaceholder')}
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: c.ink, textAlign: isRtl ? 'right' : 'left', writingDirection: textDir }]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
        {filters.map((f) => (
          <Chip key={f.key} on={filter === f.key} onPress={() => setFilter(f.key)}>
            {f.dot ? <StatusDot variant={f.dot} size={7} /> : null}
            <Text style={{ writingDirection: textDir }}>{f.label}</Text>
          </Chip>
        ))}
      </ScrollView>

      {membersQuery.isLoading ? (
        <Text style={{ color: c.ink3, fontSize: 13, textAlign: 'center', paddingVertical: 20, writingDirection: textDir }}>
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
            const lastVisit = m.lastVisitAt ? fmtShort(m.lastVisitAt.slice(0, 10), language) : null;
            return (
              <Pressable
                key={m.id}
                onPress={() => router.push({ pathname: '/member-detail', params: { id: m.id } })}
                style={({ pressed }) => [styles.mrow, { borderColor: c.line }, pressed && { opacity: 0.6 }]}
              >
                <View style={[styles.mtop, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.mleft, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <Monogram text={`${m.firstName[0]}${m.lastName[0]}`.toUpperCase()} size={36} fontSize={12} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.mname, { color: c.ink, writingDirection: textDir }]} numberOfLines={1}>{m.firstName} {m.lastName}</Text>
                      <Text style={[styles.msub, { color: c.ink3, writingDirection: textDir }]} numberOfLines={1}>{m.id} · {m.email}</Text>
                    </View>
                  </View>
                  {invited ? (
                    <Tag variant="muted">{t('common.invited')}</Tag>
                  ) : vis ? (
                    <Tag variant={vis.tagVariant}>{vis.tagLabel}</Tag>
                  ) : (
                    <Tag variant="muted">{t('common.noPlan')}</Tag>
                  )}
                </View>
                <View style={styles.mbottom}>
                  <Text style={[styles.mplan, { color: c.ink2, writingDirection: textDir }]} numberOfLines={1}>{ms?.planName ?? t('common.noPlan')}</Text>
                  <View style={styles.mmeta}>
                    <Text style={[styles.mexp, { color: c.ink, writingDirection: textDir }]}>{ms ? fmtShort(ms.expiryDate, language) : '-'}</Text>
                    <Text style={[styles.mdot, { color: c.ink3 }]}>·</Text>
                    <Text style={[styles.mlast, { color: c.ink2, writingDirection: textDir }]}>{lastVisit ?? t('adminMembers.noVisits')}</Text>
                  </View>
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
