import * as React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, useColors, radius, spacing, typography } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, Tag } from '@/components/Tag';
import { Sheet } from '@/components/Overlays';
import { Icon } from '@/components/Icon';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';
import { useCheckInByQr, useCheckInManual, useMembers } from '@/data/api/queries';
import { ApiCallError } from '@/data/api/queries';
import { fmtLong, fmtTime } from '@/data/format';
import type { ApiCheckInByQrRow } from '@/data/api/api';
import type { Language, TranslationKey } from '@/lib/i18n';

type ScanState = 'ready' | 'verifying' | 'verdict' | 'unreadable';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/**
 * A-07 through A-11:
 * - A-07 Continuous viewfinder (camera runs continuously, no shutter)
 * - A-08 Scan verdict — admitted
 * - A-09 Scan verdict — expiring soon (with receptionist speech script)
 * - A-10 Scan verdict — expired / denied
 * - A-11 Scan verdict — unreadable failure state
 */
export default function Scanner() {
  const router = useRouter();
  const checkInByQr = useCheckInByQr();
  const checkInManual = useCheckInManual();
  const { profile, darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = React.useState<ScanState>('ready');
  const [scanned, setScanned] = React.useState<ApiCheckInByQrRow | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualQuery, setManualQuery] = React.useState('');
  const membersQuery = useMembers(
    manualQuery,
    'all',
    manualOpen && manualQuery.trim().length > 0,
  );
  const [scanError, setScanError] = React.useState<string | null>(null);

  const lockRef = React.useRef(false);

  React.useEffect(() => {
    if (state !== 'ready') {
      lockRef.current = true;
    }
  }, [state]);

  const handleBarcode = ({ data }: { data: string }) => {
    if (lockRef.current) return;
    const token = data.trim().toLowerCase();
    if (!TOKEN_PATTERN.test(token)) {
      lockRef.current = true;
      setScanned(null);
      setState('unreadable');
      return;
    }
    lockRef.current = true;
    setScanError(null);
    setState('verifying');
    checkInByQr.mutate(
      { token, reception: (profile?.reception ?? 'A') as 'A' | 'B' },
      {
        onSuccess: (row) => {
          setScanned(row);
          setState('verdict');
        },
        onError: (error) => {
          setScanError(
            error instanceof ApiCallError
              ? t('scanner.qrApiError')
              : t('scanner.connectionError'),
          );
          lockRef.current = false;
          setState('ready');
        },
      },
    );
  };

  const reset = () => {
    lockRef.current = false;
    setScanned(null);
    setScanError(null);
    setState('ready');
  };

  const verdictMeta = (row: ApiCheckInByQrRow | null) => {
    if (!row) return { title: t('scanner.scanFailed'), badge: 'bad' as const, icon: 'xc' as const };
    switch (row.verdict) {
      case 'active':
        return { title: t('scanner.admitted'), badge: 'ok' as const, icon: 'check' as const };
      case 'expiring':
        return { title: t('scanner.expiring', { days: row.days_left ?? 0 }), badge: 'warn' as const, icon: 'warn' as const };
      case 'due':
        return { title: t('scanner.due'), badge: 'warn' as const, icon: 'warn' as const };
      case 'duplicate':
        return { title: t('scanner.duplicate'), badge: 'warn' as const, icon: 'warn' as const };
      case 'paused':
        return { title: t('scanner.paused'), badge: 'bad' as const, icon: 'pause' as const };
      case 'expired':
        return { title: t('scanner.expired'), badge: 'bad' as const, icon: 'xc' as const };
      case 'suspended':
        return { title: t('scanner.suspended'), badge: 'bad' as const, icon: 'xc' as const };
      case 'invited':
        return { title: t('scanner.invited'), badge: 'bad' as const, icon: 'mail' as const };
      case 'none':
        return { title: t('scanner.noActive'), badge: 'bad' as const, icon: 'xc' as const };
      default:
        return { title: t('scanner.rejected'), badge: 'bad' as const, icon: 'xc' as const };
    }
  };

  const meta = verdictMeta(scanned);

  return (
    <View style={styles.wrap}>
      <AppBar
        title={state === 'ready' ? t('scanner.scanMemberCode') : state === 'verifying' ? t('scanner.verifyingPass') : t('scanner.verdict')}
        onClose={() => router.back()}
        dark
      />

      {state === 'ready' ? (
        <View style={styles.readyBody}>
          <View style={styles.scanFrame}>
            {permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                onBarcodeScanned={scanError ? undefined : handleBarcode}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            ) : null}
            <View style={[styles.corner, styles.c1]} />
            <View style={[styles.corner, styles.c2]} />
            <View style={[styles.corner, styles.c3]} />
            <View style={[styles.corner, styles.c4]} />
            <View style={styles.scanLine} />
          </View>

          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={[styles.readyTitle, { writingDirection: textDir }]}>{t('scanner.holdCode')}</Text>
            <Text style={[styles.readySub, { writingDirection: textDir }]}>{t('scanner.cameraContinuous')}</Text>
          </View>

          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ok }} />
            <Text style={[styles.live, { writingDirection: textDir }]}>{t('scanner.readyAtDesk', { reception: profile?.reception ?? 'A' })}</Text>
          </View>

          {scanError ? (
            <Banner variant="error"><Text style={{ writingDirection: textDir }}>{scanError}</Text></Banner>
          ) : !permission ? (
            <Text style={[styles.readySub, { writingDirection: textDir }]}>{t('scanner.cameraPermissionChecking')}</Text>
          ) : !permission.granted ? (
            <View style={{ gap: 10, alignItems: 'center' }}>
              <Text style={[styles.readySub, { writingDirection: textDir }]}>
                {t('scanner.cameraOff')}
              </Text>
              <Button size="sm" onPress={requestPermission}>{t('scanner.allowCamera')}</Button>
            </View>
          ) : null}
        </View>
      ) : state === 'verifying' ? (
        <View style={styles.verifyingWrap}>
          <ActivityIndicator size="large" color={colors.ok} />
          <Text style={[styles.resultTitle, { writingDirection: textDir }]}>{t('scanner.checkingPass')}</Text>
          <Text style={[styles.resultSub, { writingDirection: textDir }]}>
            {t('scanner.checkingPassBody')}
          </Text>
        </View>
      ) : (
        <ScanResult
          state={state}
          row={scanned}
          meta={meta}
          onScanNext={reset}
          onManualLookup={() => {
            reset();
            setManualOpen(true);
          }}
          onViewMember={(memberNumber) =>
            router.push({ pathname: '/member-detail', params: { id: memberNumber } })
          }
          onRenew={(memberNumber) =>
            router.push({ pathname: '/renew', params: { id: memberNumber } })
          }
        />
      )}

      <View style={styles.bottomBar}>
        <Button variant="secondary" block icon="search" onPress={() => setManualOpen(true)}>
          <Text style={{ color: colors.ink, writingDirection: textDir }}>{t('scanner.enterManually')}</Text>
        </Button>
      </View>

      <Sheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        title={t('scanner.findManually')}
        desc={t('scanner.findManuallyBody')}
      >
        <View style={{ gap: 12, marginTop: 8 }}>
          <View style={[styles.manualInput, { backgroundColor: c.surface, borderColor: c.lineStrong }]}>
            <TextInput
              value={manualQuery}
              onChangeText={setManualQuery}
              placeholder={t('scanner.manualPlaceholder')}
              placeholderTextColor={c.ink3}
              style={[styles.manualTextInput, { color: c.ink, textAlign: isRtl ? 'right' : 'left', writingDirection: textDir }]}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {manualQuery.trim() && membersQuery.data && membersQuery.data.length > 0 ? (
            <View style={{ gap: 8 }}>
              {membersQuery.data.slice(0, 3).map((candidate) => {
                const tagInfo = (() => {
                  if (candidate.accountStatus === 'invited') {
                    return { label: t('common.invited'), variant: 'muted' as const };
                  }
                  if (!candidate.membership) {
                    return { label: t('common.noPlan'), variant: 'muted' as const };
                  }
                  const s = candidate.membership.status;
                  const variant =
                    s === 'active'
                      ? ('ok' as const)
                      : s === 'expiring' || s === 'due'
                        ? ('warn' as const)
                        : ('bad' as const);
                  return { label: t(('status.' + s) as TranslationKey), variant };
                })();
                return (
                  <ManualRow
                    key={candidate.id}
                    name={`${candidate.firstName} ${candidate.lastName}`}
                    sub={`${candidate.id} · ${candidate.membership?.planName ?? t('common.noPlan')}`}
                    tag={tagInfo.label}
                    tagVariant={tagInfo.variant}
                    busy={checkInManual.isPending}
                    onCheckIn={() => {
                      checkInManual.mutate(
                        { memberId: candidate.databaseId!, reception: (profile?.reception ?? 'A') as 'A' | 'B' },
                        {
                          onSuccess: (result) => {
                            setManualOpen(false);
                            setManualQuery('');
                            setScanned({
                              check_in_id: result.check_in_id,
                              admitted: result.admitted,
                              verdict: result.verdict,
                              membership_id: result.membership_id,
                              qr_pass_id: null,
                              member_id: candidate.databaseId ?? null,
                              member_number: candidate.id,
                              first_name: candidate.firstName,
                              last_name: candidate.lastName,
                              plan_name: candidate.membership?.planName ?? null,
                              end_date: candidate.membership?.expiryDate ?? null,
                              days_left: null,
                              checked_in_at: result.checked_in_at,
                            });
                            setState('verdict');
                          },
                          onError: (error) => {
                            setScanError(
                              error instanceof ApiCallError
                                ? error.message
                                : t('scanner.manualError'),
                            );
                            setManualOpen(false);
                          },
                        },
                      );
                    }}
                    onView={() => {
                      setManualOpen(false);
                      router.push({ pathname: '/member-detail', params: { id: candidate.id } });
                    }}
                  />
                );
              })}
            </View>
          ) : manualQuery.trim() ? (
            <Text style={{ color: c.ink3, fontSize: 12.5, writingDirection: textDir }}>
              {membersQuery.isLoading ? t('scanner.searching') : t('scanner.noMatch')}
            </Text>
          ) : null}

          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 10, marginTop: 4 }}>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={() => setManualOpen(false)}>
              {t('common.cancel')}
            </Button>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

function ManualRow({
  name,
  sub,
  tag,
  tagVariant,
  busy,
  onCheckIn,
  onView,
}: {
  name: string;
  sub: string;
  tag: string;
  tagVariant: 'ok' | 'warn' | 'bad' | 'muted';
  busy: boolean;
  onCheckIn: () => void;
  onView: () => void;
}) {
  const { darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  return (
    <View style={[styles.manualResult, { backgroundColor: c.surface2, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <Monogram text={name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()} size={38} fontSize={12.5} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.manualName, { color: c.ink, writingDirection: textDir }]}>{name}</Text>
        <Text style={[styles.manualSub, { color: c.ink3, writingDirection: textDir }]}>{sub}</Text>
      </View>
      <Tag variant={tagVariant}>{tag}</Tag>
      <View style={{ gap: 6 }}>
        <Button size="sm" loading={busy} onPress={onCheckIn}>{t('scanner.checkIn')}</Button>
        <Button size="sm" variant="quiet" onPress={onView}>{t('scanner.view')}</Button>
      </View>
    </View>
  );
}

function ScanResult({
  state,
  row,
  meta,
  onScanNext,
  onManualLookup,
  onViewMember,
  onRenew,
}: {
  state: ScanState;
  row: ApiCheckInByQrRow | null;
  meta: { title: string; badge: 'ok' | 'warn' | 'bad'; icon: string };
  onScanNext: () => void;
  onManualLookup: () => void;
  onViewMember: (memberNumber: string) => void;
  onRenew: (memberNumber: string) => void;
}) {
  const { t, isRtl, language } = useApp();
  const textDir = isRtl ? 'rtl' : 'ltr';
  if (state === 'unreadable' || !row || !row.member_number) {
    return (
      <View style={styles.resultWrap}>
        <View style={[styles.badge, styles.badgeBad]}>
          <Icon name="xc" size={42} color={colors.bad} />
        </View>
        <Text style={[styles.resultTitle, { writingDirection: textDir }]}>{t('scanner.scanFailed')}</Text>
        <Text style={[styles.resultSub, { writingDirection: textDir }]}>
          {t('scanner.failedBody')}
        </Text>

        <View style={{ width: '100%', gap: 10, marginTop: 24 }}>
          <Button block onPress={onScanNext}>
            {t('scanner.retry')}
          </Button>
          <Button variant="secondary" block onPress={onManualLookup}>
            {t('scanner.searchManually')}
          </Button>
        </View>
      </View>
    );
  }

  const days = row.days_left ?? 0;

  const badgeStyle = meta.badge === 'ok' ? styles.badgeOk : meta.badge === 'warn' ? styles.badgeWarn : styles.badgeBad;
  const badgeColor = meta.badge === 'ok' ? colors.ok : meta.badge === 'warn' ? colors.warn : colors.bad;

  const speechScript =
    row.verdict === 'expiring'
      ? t('scanner.expiringPrompt', { name: row.first_name, days })
      : row.verdict === 'due'
        ? t('scanner.duePrompt', { name: row.first_name })
        : row.verdict === 'expired'
          ? t('scanner.expiredPrompt', { date: fmtLong(row.end_date ?? '', language) })
          : row.verdict === 'paused'
            ? t('scanner.pausedPrompt')
            : null;

  return (
    <View style={styles.resultWrap}>
      <View style={[styles.badge, badgeStyle]}>
        <Icon name={meta.icon as any} size={42} color={badgeColor} />
      </View>

      <Text style={[styles.resultTitle, { writingDirection: textDir }]}>{meta.title}</Text>

      <View style={[styles.scanCard, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Monogram
          text={`${row.first_name?.[0] ?? ''}${row.last_name?.[0] ?? ''}`.toUpperCase()}
          size={44}
          fontSize={14}
          bg={
            meta.badge === 'ok'
              ? colors.okSoft
              : meta.badge === 'warn'
                ? colors.warnSoft
                : colors.badSoft
          }
          color={badgeColor}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.scanCardName, { writingDirection: textDir }]}>
            {row.first_name} {row.last_name}
          </Text>
          <Text style={[styles.scanCardSub, { writingDirection: textDir }]}>
            {row.member_number} · {row.plan_name ?? t('common.noPlan')}
          </Text>
        </View>
        <Tag variant={meta.badge}>{meta.title.split(' — ')[0]}</Tag>
      </View>

      {speechScript ? (
        <Banner variant={meta.badge === 'warn' ? 'warn' : 'error'}>
          <Text style={{ writingDirection: textDir }}>
            <Text style={{ fontStyle: 'italic' }}>{t('scanner.staffPrompt')}</Text> {speechScript}
          </Text>
        </Banner>
      ) : null}

      <Text style={[styles.scanTime, { writingDirection: textDir }]}>
        {row.admitted
          ? row.end_date
            ? t('scanner.admittedAt', { time: fmtTime(row.checked_in_at, language), date: fmtLong(row.end_date, language) })
            : t('scanner.admittedAtNoEnd', { time: fmtTime(row.checked_in_at, language) })
          : row.verdict === 'duplicate'
            ? t('scanner.duplicateBody')
            : t('scanner.doNotAdmit', { date: fmtLong(row.end_date ?? '', language) })}
      </Text>

      <View style={styles.resultCtas}>
        {row.admitted ? (
          <Button block style={{ flex: 1, backgroundColor: colors.ok }} onPress={onScanNext}>
            {t('scanner.scanNextMember')}
          </Button>
        ) : row.verdict === 'duplicate' ? (
          <>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={onScanNext}>
              <Text style={{ color: colors.ink, writingDirection: textDir }}>{t('scanner.scanNext')}</Text>
            </Button>
            <Button block style={{ flex: 1.3 }} onPress={() => onViewMember(row.member_number!)}>
              {t('scanner.viewMember')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              block
              style={{ flex: 1 }}
              onPress={() => onViewMember(row.member_number!)}
            >
              <Text style={{ color: colors.ink, writingDirection: textDir }}>{t('scanner.viewMember')}</Text>
            </Button>
            <Button
              block
              style={{ flex: 1.3, backgroundColor: meta.badge === 'bad' ? colors.bad : colors.warn }}
              onPress={() => onRenew(row.member_number!)}
            >
              {t('scanner.renewAtDesk')}
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dk },
  readyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: 'rgba(236,233,224,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.ok,
  },
  c1: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  c2: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  c3: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  c4: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    height: 2,
    backgroundColor: colors.ok,
    opacity: 0.7,
  },
  readyTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.ink,
    textAlign: 'center',
  },
  readySub: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 18,
  },
  live: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '500',
    color: colors.ok,
  },
  bottomBar: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 34,
    paddingTop: 12,
  },
  manualInput: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  manualTextInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
  },
  manualResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
  },
  manualName: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  manualSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.ink3,
    marginTop: 2,
  },
  verifyingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  resultWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
    paddingBottom: 20,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOk: { backgroundColor: colors.okSoft },
  badgeWarn: { backgroundColor: colors.warnSoft },
  badgeBad: { backgroundColor: colors.badSoft },
  resultTitle: {
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  resultSub: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 20,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    width: '100%',
  },
  scanCardName: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  scanCardSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.ink3,
    marginTop: 2,
  },
  scanTime: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 19,
  },
  resultCtas: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
});
