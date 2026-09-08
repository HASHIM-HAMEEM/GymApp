import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, SectionLabel, StatusDot, Tag } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';
import { useDashboard, useClub } from '@/data/api/queries';
import { fmtShort, fmtTime, daysBetween, todayIso } from '@/data/format';
import type { ColorSet } from '@/theme/tokens';
import type { Language } from '@/lib/i18n';

export default function AdminToday() {
  const router = useRouter();
  const { adminName, darkMode, t, isRtl, language } = useApp();
  const dashboardQuery = useDashboard();
  const clubQuery = useClub();
  const c = useColors(darkMode);
  const data = dashboardQuery.data;
  const today = todayIso(clubQuery.data?.timezone);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('member.greetingMorning');
    if (h < 18) return t('member.greetingAfternoon');
    return t('member.greetingEvening');
  })();

  const expiring = data?.expiring_list ?? [];
  const recent = data?.recent_check_ins ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('adminToday.title')} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>

      <View style={{ gap: 4 }}>
        <Text style={[styles.hi, { color: c.ink, writingDirection: textDir }]}>
          {t('adminToday.greetingWithName', { greeting, name: adminName ? adminName.split(' ')[0] : '' })}
        </Text>
        <Text style={[styles.sub, { color: c.ink3, writingDirection: textDir }]}>{t('adminToday.clubDesk', { club: clubQuery.data?.name ?? '' })}</Text>
      </View>

      <View style={styles.actions}>
        <Button variant="secondary" icon="userplus" onPress={() => router.push('/member-new')}>{t('adminToday.newMember')}</Button>
        <Button icon="scan" onPress={() => router.push('/(admin)/scanner')}>{t('adminToday.scanCode')}</Button>
      </View>

      <View style={[styles.statGrid, { backgroundColor: c.surface, borderColor: c.line }]}>
        <StatCell
          label={t('status.active')}
          dot="ok"
          value={data?.active_members ?? 0}
          sub={t('adminToday.activeSub')}
          c={c}
          borderRight
          borderBottom
        />
        <StatCell
          label={t('adminToday.expiring')}
          dot="warn"
          value={data?.expiring_soon ?? 0}
          sub={t('adminToday.expiringSub')}
          valueColor={c.warn}
          c={c}
          borderBottom
        />
        <StatCell
          label={t('status.expired')}
          dot="bad"
          value={data?.expired_members ?? 0}
          sub={t('adminToday.expiredSub')}
          valueColor={c.bad}
          c={c}
          borderRight
        />
        <StatCell
          label={t('adminToday.checkIns')}
          icon="checkc"
          value={data?.check_ins_today ?? 0}
          sub={recent[0] ? t('adminToday.lastAt', { time: `\u200E${fmtTime(recent[0].checked_in_at, language)}\u200E` }) : t('adminToday.noneToday')}
          c={c}
        />
      </View>

      {(data?.pending_invitations ?? 0) > 0 ? (
        <Pressable
          onPress={() => router.push('/(admin)/members')}
          style={({ pressed }) => [
            styles.inviteRow,
            { borderColor: c.line, backgroundColor: c.bg1, flexDirection: isRtl ? 'row-reverse' : 'row' },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Monogram text="IV" size={36} fontSize={13} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.inviteTitle, { color: c.ink, writingDirection: textDir }]}>{t('adminToday.invitationsWaiting')}</Text>
            <Text style={[styles.inviteSub, { color: c.ink3, writingDirection: textDir }]}>
              {data?.pending_invitations === 1
                ? t('adminToday.invitationOne')
                : t('adminToday.invitationMany', { count: data?.pending_invitations })}
            </Text>
          </View>
          <Icon name="chev" size={16} color={c.ink4} />
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>{t('adminToday.attention')}</SectionLabel>
          {expiring.length > 0 ? (
            <Button size="sm" variant="quiet" onPress={() => router.push('/(admin)/members')}>{t('adminToday.viewAll')}</Button>
          ) : null}
        </View>
        {expiring.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.bg1, borderColor: c.line }]}>
            <Text style={[styles.emptyText, { color: c.ink3, writingDirection: textDir }]}>{t('adminToday.noExpiring')}</Text>
          </View>
        ) : (
          <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
            {expiring.slice(0, 4).map((m) => {
              const days = m.end_date ? daysBetween(m.end_date, today) : 0;
              return (
                <Pressable
                  key={m.member_id}
                  onPress={() => router.push({ pathname: '/member-detail', params: { id: m.member_number } })}
                  style={({ pressed }) => [styles.expRow, { borderColor: c.line }, pressed && { opacity: 0.6 }]}
                >
                  <View style={[styles.expTop, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.expLeft, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                      <Monogram text={`${m.first_name[0]}${m.last_name[0]}`.toUpperCase()} size={36} fontSize={13} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.expName, { color: c.ink, writingDirection: textDir }]} numberOfLines={1}>{m.first_name} {m.last_name}</Text>
                        <Text style={[styles.expSub, { color: c.ink3, writingDirection: textDir }]} numberOfLines={1}>{m.plan_name ?? t('common.noPlan')} · {`\u200E${m.member_number}\u200E`}</Text>
                      </View>
                    </View>
                    <Tag variant="warn">{t('adminToday.daysShort', { count: Math.max(0, days) })}</Tag>
                  </View>
                  <View style={styles.expBottom}>
                    <Text style={[styles.expDate, { color: c.ink2, writingDirection: textDir }]}>{t('adminToday.ends', { date: `\u200E${m.end_date ? fmtShort(m.end_date, language) : '-'}\u200E` })}</Text>
                    <Button size="sm" onPress={() => router.push({ pathname: '/renew', params: { id: m.member_number } })}>{t('adminToday.renew')}</Button>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('adminToday.recentCheckIns')}</SectionLabel>
        {recent.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.bg1, borderColor: c.line }]}>
            <Text style={[styles.emptyText, { color: c.ink3, writingDirection: textDir }]}>{t('adminToday.noCheckIns')}</Text>
          </View>
        ) : (
          <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
            {recent.map((ci) => (
              <View key={ci.member_number + ci.checked_in_at} style={[styles.ciRow, { flexDirection: isRtl ? 'row-reverse' : 'row', borderColor: c.line }]}>
                <Monogram text={`${ci.first_name[0]}${ci.last_name[0]}`.toUpperCase()} size={32} fontSize={11} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.ciName, { color: c.ink, writingDirection: textDir }]} numberOfLines={1}>{ci.first_name} {ci.last_name}</Text>
                  <Text style={[styles.ciSub, { color: c.ink3, writingDirection: textDir }]} numberOfLines={1}>
                    {t('adminToday.checkInDetail', { source: ci.source === 'qr' ? t('visits.qrScan') : t('visits.frontDesk'), reception: ci.reception ?? 'A' })}
                  </Text>
                </View>
                <Text style={[styles.ciTime, { color: c.ink, writingDirection: 'ltr' }]}>
                  {fmtTime(ci.checked_in_at, language)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
        </Body>
      </ScrollView>
    </View>
  );
}

function StatCell({ label, dot, icon, value, sub, valueColor, c, borderRight, borderBottom }: {
  label: string;
  dot?: 'ok' | 'warn' | 'bad';
  icon?: 'checkc';
  value: number;
  sub: string;
  valueColor?: string;
  c: ColorSet;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  const { isRtl } = useApp();
  return (
    <View style={[
      styles.statCell,
      borderRight && { borderRightColor: c.line },
      borderBottom && { borderBottomColor: c.line },
    ]}>
      <View style={[styles.statLabelRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        {dot ? <StatusDot variant={dot} size={7} /> : null}
        {icon ? <Icon name={icon} size={13} color={c.ink3} /> : null}
        <Text style={[styles.statLabel, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: valueColor ?? c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{value}</Text>
      <Text style={[styles.statSub, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hi: {
    fontFamily: typography.fontFamily,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  actions: { flexDirection: 'row', gap: 10 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statCell: {
    width: '50%',
    padding: 16,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    borderRightWidth: 1,
    borderRightColor: 'transparent',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: typography.display,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.02,
    marginTop: 4,
  },
  statSub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  inviteTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  inviteSub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  section: { gap: 12 },
  tbl: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  empty: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  expRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  expTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  expLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
    minWidth: 0,
  },
  expName: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  expSub: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    letterSpacing: tracking.small,
    marginTop: 2,
  },
  expBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 47,
  },
  expDate: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  ciRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  ciName: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  ciSub: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    letterSpacing: tracking.small,
    marginTop: 2,
  },
  ciTime: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    fontWeight: '600',
    flexShrink: 0,
  },
});
