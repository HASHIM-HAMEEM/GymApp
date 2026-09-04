import * as React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { colors, useColors, spacing, typography } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Tag } from '@/components/Tag';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Overlays';
import { useCurrentMember, useQrPass, useRegenerateQrPass } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { fmtLong } from '@/data/format';
import type { Language } from '@/lib/i18n';

/**
 * M-09, M-10 & M-11:
 * - M-09 QR pass (Live): rotating one-time pass issued by the server.
 * - M-10 QR pass (Expired): plate dims, badge says Won't scan, renew CTA.
 * - M-11 Sheet (Regenerate): rotating immediately invalidates saved copies.
 */
function qrDate(iso: string, language: Language): string {
  return fmtLong(iso, language);
}

export default function QrScreen() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
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
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.slabel, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('qr.memberCard')}</Text>
          <Text style={[styles.name, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {m ? `${m.firstName} ${m.lastName}` : t('member.meridianMember')}
          </Text>
          <Text style={[styles.id, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{m?.id ?? 'MRD-····'}</Text>
        </View>

        <View style={[styles.plate, { opacity: unavailable ? 0.28 : 1 }]}>
          {pass && !unavailable ? (
            <QRCode
              value={pass.value}
              size={210}
              color="#0A0A0A"
              backgroundColor={colors.plate}
              quietZone={16}
              ecl="M"
            />
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

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
    gap: 26,
    paddingHorizontal: spacing.screen,
  },
  slabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
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
    fontSize: 12.5,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  plate: {
    backgroundColor: colors.plate,
    padding: 18,
    borderRadius: 24,
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
  placeholder: {
    width: 210,
    height: 210,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
  },
  foot: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 28,
    paddingTop: 12,
  },
});
