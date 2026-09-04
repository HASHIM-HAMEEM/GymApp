import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { EmptyState } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useCurrentMember } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { TODAY } from '@/data/format';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function labelFor(iso: string) {
  const m = parseInt(iso.slice(5, 7), 10) - 1;
  const y = iso.slice(0, 4);
  return `${MONTHS[m]} ${y}`;
}

function sessionLabel(time: string) {
  const h = parseInt(time.split(':')[0], 10) + (time.includes('PM') && parseInt(time.split(':')[0], 10) < 12 ? 12 : 0);
  return h < 12 ? 'Morning check-in' : 'Evening check-in';
}

export default function VisitsScreen() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const [showSkeleton, setShowSkeleton] = React.useState(false);

  const visits = memberQuery.data?.visits ?? [];

  const monthKeys = React.useMemo(() => {
    const set = new Set<string>();
    visits.forEach((v) => set.add(v.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [visits]);

  const [selectedMonth, setSelectedMonth] = React.useState<string>(
    monthKeys.find((k) => k === TODAY.slice(0, 7)) ?? monthKeys[0] ?? TODAY.slice(0, 7)
  );

  const filtered = visits
    .filter((v) => v.date.slice(0, 7) === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date));

  const count = filtered.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title="Visits"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => setShowSkeleton((v) => !v)}>
              <Text style={{ fontFamily: typography.mono, fontSize: 11, color: showSkeleton ? c.accent : c.ink4 }}>
                {showSkeleton ? 'M-20 Shimmer: ON' : 'M-20'}
              </Text>
            </Pressable>
            <Text style={[styles.headStat, { color: c.ink3 }]}>{count} this month</Text>
          </View>
        }
      />
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
                    { borderColor: c.line },
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
              title="No visits yet"
              body="Once you check in at reception, your visits will appear here."
              action={
                <Button variant="secondary" icon="qr" href="/qr" style={{ marginTop: 22 }}>
                  Show my card
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
                      <Text style={[styles.chipText, { color: on ? c.bg : c.ink }]}>{labelFor(k + '-01')}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
                {filtered.map((v, i) => (
                  <View key={v.id} style={[styles.vrow, { borderColor: c.line }, i === filtered.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[styles.date, { backgroundColor: c.bg2, borderColor: c.line }]}>
                      <Text style={[styles.dateD, { color: c.ink }]}>{parseInt(v.date.slice(8), 10)}</Text>
                      <Text style={[styles.dateM, { color: c.ink3 }]}>{MONTHS[parseInt(v.date.slice(5, 7), 10) - 1]}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.time, { color: c.ink }]}>{sessionLabel(v.time)}</Text>
                      <Text style={[styles.loc, { color: c.ink3, fontFamily: typography.mono }]} numberOfLines={1}>
                        {v.time} · {v.method === 'qr' ? 'QR scan' : 'Front desk'} · Reception {v.reception}
                      </Text>
                    </View>
                    <Icon name="checkc" size={18} color={c.ok} />
                  </View>
                ))}
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
    fontSize: 12,
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
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 17,
  },
  dateM: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  time: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  loc: {
    fontSize: 12,
    marginTop: 2,
  },
});
