import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, radius, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { EmptyState } from '@/components/Surfaces';
import { LtrText } from '@/components/LtrText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useCurrentMember } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { todayIso, fmtShort, fmtLong, formatTime } from '@/data/format';
import type { Language } from '@/lib/i18n';

function monthYearLabel(iso: string, language: Language): string {
  const long = fmtLong(`${iso}-01`, language);
  return long.replace(/^\d{1,2}\s+/, '');
}

export default function VisitsScreen() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
  const [showSkeleton, setShowSkeleton] = React.useState(false);

  const visits = memberQuery.data?.visits ?? [];

  const monthKeys = React.useMemo(() => {
    const set = new Set<string>();
    visits.forEach((v) => set.add(v.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [visits]);

  const [selectedMonth, setSelectedMonth] = React.useState<string>(
    monthKeys.find((k) => k === todayIso().slice(0, 7)) ?? monthKeys[0] ?? todayIso().slice(0, 7)
  );

  const filtered = visits
    .filter((v) => v.date.slice(0, 7) === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date));

  const count = filtered.length;

  const sessionLabel = (time: string) => {
    const rawHour = parseInt(time.split(':')[0], 10);
    const hour = time.includes('PM') && rawHour < 12 ? rawHour + 12 : rawHour;
    return hour < 12 ? t('visits.morning') : t('visits.evening');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => setShowSkeleton((v) => !v)}>
              <Text style={{ fontFamily: typography.mono, fontSize: 11, letterSpacing: tracking.small, color: showSkeleton ? c.accent : c.ink4, writingDirection: isRtl ? 'rtl' : 'ltr' }}>
                {showSkeleton ? t('visits.shimmerOn') : t('common.off')}
              </Text>
            </Pressable>
            <Text style={[styles.headStat, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('visits.monthCount', { count })}</Text>
          </View>
        }
      >
        <Text style={{ fontFamily: typography.display, fontSize: 18, fontWeight: '600', letterSpacing: -0.01, color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }}>{t('visits.title')}</Text>
      </AppBar>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Body>
          {showSkeleton ? (
            <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
              {[1, 2, 3, 4, 5].map((n, i) => (
                <View
                  key={n}
                  style={[
                    styles.vrow,
                    { borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
                    i === 4 && { borderBottomWidth: 0 },
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
          ) : visits.length === 0 ? (
            <EmptyState
              icon="clock"
              title={t('member.noVisits')}
              body={t('member.noVisitsBody')}
              action={
                <Button variant="secondary" icon="qr" href="/qr" style={{ marginTop: 22 }}>
                  {t('member.showCard')}
                </Button>
              }
            />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {monthKeys.slice(0, 3).map((k) => {
                  const on = k === selectedMonth;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setSelectedMonth(k)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: on ? c.ink : 'transparent',
                          borderColor: on ? c.ink : c.line2,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: on ? c.bg : c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{monthYearLabel(k, language)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
                {filtered.map((v, i) => {
                  const [dayLabel, monthLabel] = fmtShort(v.date, language).split(' ');
                  return (
                    <View key={v.id} style={[styles.vrow, { borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }, i === filtered.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[styles.date, { backgroundColor: c.bg2, borderColor: c.line }]}>
                        <LtrText style={[styles.dateD, { color: c.ink }]}>{dayLabel}</LtrText>
                        <Text style={[styles.dateM, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{monthLabel}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.time, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{sessionLabel(v.time)}</Text>
                        <Text style={[styles.loc, { color: c.ink3, fontFamily: typography.mono, writingDirection: isRtl ? 'rtl' : 'ltr' }]} numberOfLines={1}>
                          {t('visits.detail', {
                            time: `\u200E${formatTime(v.time, language)}\u200E`,
                            method: v.method === 'qr' ? t('visits.qrScan') : t('visits.frontDesk'),
                            reception: v.reception,
                          })}
                        </Text>
                      </View>
                      <Icon name="checkc" size={18} color={c.ok} />
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headStat: {
    fontFamily: typography.mono,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    flexDirection: 'row',
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
