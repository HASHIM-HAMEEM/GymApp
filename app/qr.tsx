import * as React from 'react';
import { Platform, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { colors, useColors, spacing, typography, tracking, radius } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Tag } from '@/components/Tag';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Overlays';
import { Logo } from '@/components/Logo';
import { useClub, useCurrentMember, useQrPass, useRegenerateQrPass } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { fmtLong, daysBetween, todayIso } from '@/data/format';
import type { Language } from '@/lib/i18n';

/**
 * M-09, M-10 & M-11:
 * - M-09 QR pass (Live): rotating one-time pass issued by the server.
 * - M-10 QR pass (Expired): plate dims, badge says Won't scan, renew CTA.
 * - M-11 Sheet (Regenerate): rotating immediately invalidates saved copies.
 *
 * V3: Large responsive QR, Apex branding, months-left badge.
 */
function qrDate(iso: string, language: Language): string {
  return fmtLong(iso, language);
}

function monthsLeft(expiry: string, today: string): number {
  const days = Math.max(0, daysBetween(expiry, today));
  return Math.ceil(days / 30);
}

export default function QrScreen() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const clubQuery = useClub();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
  const { width: screenWidth } = useWindowDimensions();
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const regeneratePass = useRegenerateQrPass();

  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;
  const canIssue = Boolean(
    ms && (ms.status === 'active' || ms.status === 'expiring' || ms.status === 'due'),
  );
  const qrQuery = useQrPass(canIssue);
  const pass = qrQuery.data ?? null;
  const unavailable = !canIssue || qrQuery.isError;

  // Responsive QR size: fill available width minus padding, cap at 320
  const qrSize = Math.min(screenWidth - 96, 300);
  const platePadding = Math.round(qrSize * 0.09);

  React.useEffect(() => {
    if (!pass?.expiresAt) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      setSecondsLeft(Math.max(0, Math.ceil((new Date(pass.expiresAt).getTime() - Date.now()) / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [pass?.expiresAt]);

  const handleRegenerate = async () => {
    try {
      await regeneratePass.mutateAsync();
      setRegenOpen(false);
    } catch {
      setRegenOpen(false);
      void qrQuery.refetch();
    }
  };

  const unavailableText = qrQuery.isError
    ? t('qr.issueFailed')
    : ms?.status === 'paused'
    ? t('qr.membershipPaused')
    : ms?.status === 'upcoming'
    ? t('qr.planStarts', { date: ms ? qrDate(ms.startDate, language) : t('common.notAvailable') })
    : ms?.status === 'expired'
    ? t('qr.expired', { date: ms ? qrDate(ms.expiryDate, language) : t('common.notAvailable') })
    : t('qr.noActive');

  const activeText =
    ms && pass
      ? t('qr.activePass', { plan: ms.planName, date: qrDate(ms.expiryDate, language), seconds: secondsLeft })
      : ms
      ? `${t('status.active')} · ${ms.planName} · ${t('membership.validUntil', { date: qrDate(ms.expiryDate, language) })}`
      : t('qr.noActive');

  const today = m?.asOf ?? todayIso();
  const months = ms ? monthsLeft(ms.expiryDate, today) : 0;
  const clubName = clubQuery.data?.name ?? 'Apex';

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar
        onClose={() => router.back()}
        right={
          unavailable ? (
            <Tag variant="bad">{t('qr.unavailable')}</Tag>
          ) : pass ? (
            <Tag variant="ok">{t('qr.live')}</Tag>
          ) : (
            <Tag variant="muted">{t('common.loading')}</Tag>
          )
        }
      />

      <View style={styles.body}>
        {/* Apex branding + months left badge */}
        <View style={[styles.brandRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.brand, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Logo size={22} color={c.ink} strokeWidth={2.6} />
            <Text style={[styles.wordmark, { color: c.ink }]}>{clubName}</Text>
          </View>
          {ms && !unavailable ? (
            <View style={[styles.monthsBadge, { backgroundColor: c.accentSoft, borderColor: c.line2 }]}>
              <Text style={[styles.monthsNum, { color: c.ink }]}>{months}</Text>
              <Text style={[styles.monthsUnit, { color: c.ink3 }]}>{t('qr.monthsLeft')}</Text>
            </View>
          ) : null}
        </View>

        {/* Member name + ID */}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={[styles.name, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {m ? `${m.firstName} ${m.lastName}` : t('member.apexMember')}
          </Text>
          <Text style={[styles.id, { color: c.ink3, writingDirection: 'ltr' }]}>{m?.id ?? 'MRD-····'}</Text>
        </View>

        {/* Large responsive QR plate */}
        <View style={[styles.plate, { opacity: unavailable ? 0.28 : 1, padding: platePadding, borderRadius: Math.round(platePadding * 1.4) }]}>
          {pass && !unavailable ? (
            <QRCode
              value={pass.value}
              size={qrSize}
              color="#0A0A0A"
              backgroundColor={colors.plate}
              quietZone={Math.round(qrSize * 0.06)}
              ecl="M"
            />
          ) : (
            <View style={{ width: qrSize, height: qrSize }} />
          )}
        </View>

        {/* Status row */}
        <View style={{ alignItems: 'center' }}>
          {unavailable ? (
            <View style={[styles.statusRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Icon name="xc" size={17} color={c.bad} />
              <Text style={[styles.statusText, { color: c.bad, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{unavailableText}</Text>
            </View>
          ) : (
            <View style={[styles.statusRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Icon name="shield" size={17} color={c.ok} />
              <Text style={[styles.statusText, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{activeText}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.foot}>
        {unavailable ? (
          <Button block onPress={() => router.push('/(member)/membership')}>
            {t('qr.membershipOptions')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            block
            icon="refresh"
            loading={qrQuery.isFetching || regeneratePass.isPending}
            onPress={() => setRegenOpen(true)}
          >
            {t('qr.regenerateCode')}
          </Button>
        )}
      </View>

      <Sheet
        visible={regenOpen}
        onClose={() => setRegenOpen(false)}
        title={t('qr.regenerateCode')}
        desc={t('qr.regenerateBody')}
      >
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button block loading={regeneratePass.isPending} onPress={handleRegenerate}>
            {t('qr.regeneratePass')}
          </Button>
          <Button variant="quiet" block onPress={() => setRegenOpen(false)}>
            {t('qr.keepCurrent')}
          </Button>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: spacing.screen,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 360,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  wordmark: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  monthsBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
  },
  monthsNum: {
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  monthsUnit: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  name: {
    fontFamily: typography.display,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.015 * 24,
    textAlign: 'center',
  },
  id: {
    fontFamily: typography.mono,
    fontSize: 13,
    letterSpacing: 0.8,
  },
  plate: {
    backgroundColor: colors.plate,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 18px 50px rgba(0,0,0,0.5)' }
      : {
          shadowColor: '#000000',
          shadowOpacity: 0.5,
          shadowRadius: 50,
          shadowOffset: { width: 0, height: 18 },
          elevation: 8,
        }),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 340,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    textAlign: 'center',
    flexShrink: 1,
  },
  foot: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 28,
    paddingTop: 12,
  },
});
