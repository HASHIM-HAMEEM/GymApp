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

/**
 * M-09, M-10 & M-11:
 * - M-09 QR pass (Live): rotating one-time pass issued by the server.
 * - M-10 QR pass (Expired): plate dims, badge says Won't scan, renew CTA.
 * - M-11 Sheet (Regenerate): rotating immediately invalidates saved copies.
 */
export default function QrScreen() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const { darkMode } = useApp();
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

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar
        onClose={() => router.back()}
        right={
          unavailable ? (
            <Tag variant="bad">Unavailable</Tag>
          ) : pass ? (
            <Tag variant="ok">Live</Tag>
          ) : (
            <Tag variant="muted">Loading…</Tag>
          )
        }
      />

      <View style={styles.body}>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.slabel, { color: c.ink3 }]}>Member card</Text>
          <Text style={[styles.name, { color: c.ink }]}>
            {m ? `${m.firstName} ${m.lastName}` : 'Meridian member'}
          </Text>
          <Text style={[styles.id, { color: c.ink3 }]}>{m?.id ?? 'MRD-····'}</Text>
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
            <View style={styles.statusRow}>
              <Icon name="xc" size={17} color={c.bad} />
              <Text style={[styles.statusText, { color: c.bad }]}>
                {qrQuery.isError
                  ? 'A live pass could not be issued — reconnect or ask reception'
                  : ms?.status === 'paused'
                    ? 'Membership paused — see reception'
                    : ms?.status === 'upcoming'
                      ? `Plan starts ${fmtLong(ms.startDate)}`
                      : ms?.status === 'expired'
                        ? `Expired ${fmtLong(ms.expiryDate)} · Renew to reactivate`
                        : 'No active membership — ask reception'}
              </Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <Icon name="shield" size={17} color={c.ok} />
              <Text style={[styles.statusText, { color: c.ink3 }]}>
                Active · {ms?.planName ?? 'Premium'} · until{' '}
                <Text style={{ color: c.ink2, fontWeight: '600' }}>
                  {ms ? fmtLong(ms.expiryDate) : '—'}
                </Text>
                {pass ? ` · pass expires in ${secondsLeft}s` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.foot}>
        {unavailable ? (
          <Button block onPress={() => router.push('/(member)/membership')}>
            Membership options
          </Button>
        ) : (
          <Button
            variant="secondary"
            block
            icon="refresh"
            loading={qrQuery.isFetching || regeneratePass.isPending}
            onPress={() => setRegenOpen(true)}
          >
            Regenerate code
          </Button>
        )}
      </View>

      <Sheet
        visible={regenOpen}
        onClose={() => setRegenOpen(false)}
        title="Regenerate code"
        desc="Rotating your QR pass immediately invalidates any saved copies. A fresh one-time code will be issued for your card."
      >
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button block loading={regeneratePass.isPending} onPress={handleRegenerate}>
            Regenerate pass
          </Button>
          <Button variant="quiet" block onPress={() => setRegenOpen(false)}>
            Keep current
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
