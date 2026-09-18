import * as React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors, typography, radius, tracking } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { EmptyState } from '@/components/Surfaces';
import { LtrText } from '@/components/LtrText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useCurrentMember } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { todayIso, fmtShort, fmtLong, formatTime } from '@/data/format';
import type { Visit } from '@/data/types';
import type { Language } from '@/lib/i18n';

function monthYearLabel(iso: string, language: Language): string {
  const long = fmtLong(`${iso}-01`, language);
  return long.replace(/^\d{1,2}\s+/, '');
}

export default function VisitsScreen() {
  const memberQuery = useCurrentMember();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
  const [showSkeleton, setShowSkeleton] = React.useState(false);
  const visits = memberQuery.data?.visits ?? [];

  const monthKeys = React.useMemo(() => {
    const set = new Set<string>();
    visits.forEach((visit) => set.add(visit.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [visits]);

  const [selectedMonth, setSelectedMonth] = React.useState<string>(
    monthKeys.find((key) => key === todayIso().slice(0, 7)) ?? monthKeys[0] ?? todayIso().slice(0, 7),
  );

  React.useEffect(() => {
    if (monthKeys.length > 0 && !monthKeys.includes(selectedMonth)) setSelectedMonth(monthKeys[0]);
  }, [monthKeys, selectedMonth]);

  const filtered = React.useMemo(
    () => visits
      .filter((visit) => visit.date.slice(0, 7) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [visits, selectedMonth],
  );

  const sessionLabel = React.useCallback((time: string) => {
    const rawHour = parseInt(time.split(':')[0], 10);
    const hour = time.includes('PM') && rawHour < 12 ? rawHour + 12 : rawHour;
    return hour < 12 ? t('visits.morning') : t('visits.evening');
  }, [t]);

  const renderVisit = React.useCallback(({ item: visit, index }: { item: Visit; index: number }) => {
    const [dayLabel, monthLabel] = fmtShort(visit.date, language).split(' ');
    const last = index === filtered.length - 1;
    return (
      <View
        style={[
          styles.vrow,
          {
            backgroundColor: c.bg1,
            borderColor: c.line,
            borderTopWidth: index === 0 ? 1 : 0,
            borderTopLeftRadius: index === 0 ? radius.lg : 0,
            borderTopRightRadius: index === 0 ? radius.lg : 0,
            borderBottomLeftRadius: last ? radius.lg : 0,
            borderBottomRightRadius: last ? radius.lg : 0,
            flexDirection: isRtl ? 'row-reverse' : 'row',
          },
        ]}
      >
        <View style={[styles.date, { backgroundColor: c.bg2, borderColor: c.line }]}>
          <LtrText style={[styles.dateD, { color: c.ink }]}>{dayLabel}</LtrText>
          <Text style={[styles.dateM, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{monthLabel}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.time, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{sessionLabel(visit.time)}</Text>
          <Text style={[styles.loc, { color: c.ink3, fontFamily: typography.mono, writingDirection: isRtl ? 'rtl' : 'ltr' }]} numberOfLines={1}>
            {t('visits.detail', {
              time: `\u200E${formatTime(visit.time, language)}\u200E`,
              method: visit.method === 'qr' ? t('visits.qrScan') : t('visits.frontDesk'),
              reception: visit.reception,
            })}
          </Text>
        </View>
        <Icon name="checkc" size={18} color={c.ok} />
      </View>
    );
  }, [c, filtered.length, isRtl, language, sessionLabel, t]);

  const skeleton = (
    <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
      {[1, 2, 3, 4, 5].map((number, index) => (
        <View
          key={number}
          style={[
            styles.skeletonRow,
            { borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
            index === 4 && { borderBottomWidth: 0 },
          ]}
        >
          <View style={[styles.date, { backgroundColor: c.bg2, borderColor: c.line, opacity: 0.5 }]} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={{ height: 14, width: '55%', backgroundColor: c.bg2, borderRadius: 4 }} />
            <View style={{ height: 11, width: '38%', backgroundColor: c.bg2, borderRadius: 4, opacity: 0.6 }} />
          </View>
        </View>
      ))}
    </View>
  );

  const empty = showSkeleton ? skeleton : visits.length === 0 ? (
    <EmptyState
      icon="clock"
      title={t('member.noVisits')}
      body={t('member.noVisitsBody')}
      action={(
        <Button variant="secondary" icon="qr" href="/qr" style={{ marginTop: 22 }}>
          {t('member.showCard')}
        </Button>
      )}
    />
  ) : null;

  const header = !showSkeleton && visits.length > 0 ? (
    <View style={[styles.months, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      {monthKeys.slice(0, 3).map((key) => {
        const on = key === selectedMonth;
        return (
          <Pressable
            key={key}
            onPress={() => setSelectedMonth(key)}
            style={[styles.chip, { backgroundColor: on ? c.ink : 'transparent', borderColor: on ? c.ink : c.line2 }]}
          >
            <Text style={[styles.chipText, { color: on ? c.bg : c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{monthYearLabel(key, language)}</Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        right={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable accessibilityRole="button" onPress={() => setShowSkeleton((value) => !value)} style={styles.shimmerButton}>
              <Text style={{ fontFamily: typography.mono, fontSize: 11, letterSpacing: tracking.small, color: showSkeleton ? c.accent : c.ink4, writingDirection: isRtl ? 'rtl' : 'ltr' }}>
                {showSkeleton ? t('visits.shimmerOn') : t('common.off')}
              </Text>
            </Pressable>
            <Text style={[styles.headStat, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('visits.monthCount', { count: filtered.length })}</Text>
          </View>
        )}
      >
        <Text style={{ fontFamily: typography.display, fontSize: 18, fontWeight: '600', letterSpacing: -0.01, color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }}>{t('visits.title')}</Text>
      </AppBar>
      <FlatList
        data={showSkeleton ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderVisit}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
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
    paddingBottom: 120,
  },
  headStat: {
    fontFamily: typography.mono,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  shimmerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  months: {
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    fontWeight: '500',
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  vrow: {
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    gap: 14,
  },
  skeletonRow: {
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 14,
  },
  date: {
    width: 46,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  dateD: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 17,
  },
  dateM: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  time: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  loc: {
    fontSize: 13,
    letterSpacing: tracking.small,
    marginTop: 2,
  },
});
