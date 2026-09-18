import * as React from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography, tracking } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, StatusDot } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/Overlays';
import { EmptyState } from '@/components/Surfaces';
import { useMembers } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { statusVisual } from '@/data/format';
import type { Member, MembershipStatus } from '@/data/types';

export default function AdminMembers() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query);
  const [filter, setFilter] = React.useState<'all' | MembershipStatus | 'removed'>('all');
  const membersQuery = useMembers(deferredQuery, filter);
  const { darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const filters = React.useMemo(() => [
    { key: 'all' as const, label: t('adminMembers.filterAll') },
    { key: 'active' as const, label: t('status.active'), dot: 'ok' as const },
    { key: 'expiring' as const, label: t('status.expiring'), dot: 'warn' as const },
    { key: 'expired' as const, label: t('status.expired'), dot: 'bad' as const },
    { key: 'paused' as const, label: t('status.paused'), dot: 'muted' as const },
    { key: 'due' as const, label: t('status.due'), dot: 'warn' as const },
    { key: 'removed' as const, label: t('adminMembers.filterRemoved'), dot: 'muted' as const },
  ], [t]);

  const members = membersQuery.data ?? [];

  const renderMember = React.useCallback(({ item: m, index }: { item: Member; index: number }) => {
    const ms = m.membership;
    const vis = ms ? statusVisual(ms.status, ms, c, language) : null;
    const invited = m.accountStatus === 'invited';
    const removed = m.removed === true;
    const last = index === members.length - 1;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${m.firstName} ${m.lastName}, ${m.id}`}
        onPress={() => router.push({ pathname: '/member-detail', params: { id: m.id } })}
        style={({ pressed }) => [
          styles.mrow,
          {
            backgroundColor: c.bg1,
            borderColor: c.line,
            borderTopWidth: index === 0 ? 1 : 0,
            borderTopLeftRadius: index === 0 ? radius.lg : 0,
            borderTopRightRadius: index === 0 ? radius.lg : 0,
            borderBottomLeftRadius: last ? radius.lg : 0,
            borderBottomRightRadius: last ? radius.lg : 0,
          },
          pressed && { opacity: 0.6 },
        ]}
      >
        <View style={[styles.mleft, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <Monogram text={`${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase()} size={40} fontSize={13} />
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text style={[styles.mname, { color: c.ink, writingDirection: textDir }]} numberOfLines={2}>{m.firstName} {m.lastName}</Text>
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <Text style={[styles.msub, { color: c.ink3 }]}>{m.id}</Text>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 7 }}>
                <StatusDot variant={removed ? 'muted' : invited ? 'muted' : vis?.dotVariant ?? 'muted'} size={6} />
                <Text style={[styles.status, { color: c.ink2, writingDirection: textDir }]}>{removed ? t('status.removed') : invited ? t('common.invited') : vis?.tagLabel ?? t('common.noPlan')}</Text>
              </View>
            </View>
          </View>
          <Icon name={isRtl ? 'chevl' : 'chev'} size={16} color={c.ink4} />
        </View>
      </Pressable>
    );
  }, [c, isRtl, language, members.length, router, t, textDir]);

  const header = (
    <View style={styles.header}>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => (
          <Chip key={item.key} on={filter === item.key} onPress={() => setFilter(item.key)} leading={item.dot ? <StatusDot variant={item.dot} size={7} /> : undefined}>
            {item.label}
          </Chip>
        ))}
      </ScrollView>
    </View>
  );

  const empty = membersQuery.isLoading ? (
    <Text style={[styles.loading, { color: c.ink3, writingDirection: textDir }]}>{t('adminMembers.loading')}</Text>
  ) : (
    <EmptyState
      icon="search"
      title={query ? t('adminMembers.noMatch', { query }) : t('adminMembers.noView')}
      body={query ? t('adminMembers.searchHelp') : t('adminMembers.filterHelp')}
      action={<Button variant="quiet" onPress={() => { setQuery(''); setFilter('all'); }}>{t('adminMembers.clearSearch')}</Button>}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('adminMembers.title')} right={<Button size="sm" variant="secondary" icon="userplus" onPress={() => router.push('/member-new')}>{t('adminMembers.new')}</Button>} />
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={(
          <View style={styles.foot}>
            <Text style={[styles.footText, { color: c.ink3, writingDirection: textDir }]}>
              {membersQuery.isLoading ? ' ' : t(members.length >= 100 ? 'adminMembers.showingMore' : 'adminMembers.showing', { count: members.length })}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    gap: 14,
    marginBottom: 14,
  },
  searchbar: {
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
  filters: {
    gap: 8,
    paddingHorizontal: 2,
  },
  loading: {
    fontSize: 13,
    letterSpacing: tracking.small,
    textAlign: 'center',
    paddingVertical: 20,
  },
  mrow: {
    minHeight: 80,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    gap: 10,
  },
  mleft: {
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
  status: {
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
  },
  foot: {
    alignItems: 'center',
    paddingTop: 16,
  },
  footText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
});
