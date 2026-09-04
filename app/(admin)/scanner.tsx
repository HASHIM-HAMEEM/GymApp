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
import { fmtLong } from '@/data/format';
import type { ApiCheckInByQrRow } from '@/data/api/api';

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
  const { profile, darkMode } = useApp();
  const c = useColors(darkMode);
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
              ? `${error.message} Search the member manually to check them in.`
              : 'The QR code could not be verified. Check your connection and try again.',
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
    if (!row) return { title: 'Scan failed', badge: 'bad' as const, icon: 'xc' as const };
    switch (row.verdict) {
      case 'active':
        return { title: 'Check-in admitted', badge: 'ok' as const, icon: 'check' as const };
      case 'expiring':
        return { title: `Expiring in ${row.days_left ?? 0} days`, badge: 'warn' as const, icon: 'warn' as const };
      case 'due':
        return { title: 'Payment due — admitted under grace', badge: 'warn' as const, icon: 'warn' as const };
      case 'duplicate':
        return { title: 'Already checked in', badge: 'warn' as const, icon: 'warn' as const };
      case 'paused':
        return { title: 'Membership paused', badge: 'bad' as const, icon: 'pause' as const };
      case 'expired':
        return { title: 'Membership expired', badge: 'bad' as const, icon: 'xc' as const };
      case 'suspended':
        return { title: 'Account suspended', badge: 'bad' as const, icon: 'xc' as const };
      case 'invited':
        return { title: 'Invitation not accepted yet', badge: 'bad' as const, icon: 'mail' as const };
      case 'none':
        return { title: 'No active membership', badge: 'bad' as const, icon: 'xc' as const };
      default:
        return { title: 'Pass rejected', badge: 'bad' as const, icon: 'xc' as const };
    }
  };

  const meta = verdictMeta(scanned);

  return (
    <View style={styles.wrap}>
      <AppBar
        title={state === 'ready' ? 'Scan member code' : state === 'verifying' ? 'Verifying pass' : 'Check-in verdict'}
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
            <Text style={styles.readyTitle}>Hold the member's QR code in the frame</Text>
            <Text style={styles.readySub}>The camera runs continuously. No shutter button.</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ok }} />
            <Text style={styles.live}>Scanner ready · Reception {profile?.reception ?? 'A'}</Text>
          </View>

          {scanError ? (
            <Banner variant="error">{scanError}</Banner>
          ) : !permission ? (
            <Text style={styles.readySub}>Checking camera permission…</Text>
          ) : !permission.granted ? (
            <View style={{ gap: 10, alignItems: 'center' }}>
              <Text style={styles.readySub}>
                Camera access is off. Allow it to scan member passes.
              </Text>
              <Button size="sm" onPress={requestPermission}>Allow camera</Button>
            </View>
          ) : null}
        </View>
      ) : state === 'verifying' ? (
        <View style={styles.verifyingWrap}>
          <ActivityIndicator size="large" color={colors.ok} />
          <Text style={styles.resultTitle}>Checking pass…</Text>
          <Text style={styles.resultSub}>
            Confirming the one-time token and current membership status.
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
          <Text style={{ color: colors.ink }}>Enter member ID manually</Text>
        </Button>
      </View>

      <Sheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Find member manually"
        desc="Enter a member ID, email, or full name. Reception can also read the ID from the physical card."
      >
        <View style={{ gap: 12, marginTop: 8 }}>
          <View style={[styles.manualInput, { backgroundColor: c.surface, borderColor: c.lineStrong }]}>
            <TextInput
              value={manualQuery}
              onChangeText={setManualQuery}
              placeholder="MRD-0001, email, or name"
              placeholderTextColor={c.ink3}
              style={[styles.manualTextInput, { color: c.ink }]}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {manualQuery.trim() && membersQuery.data && membersQuery.data.length > 0 ? (
            <View style={{ gap: 8 }}>
              {membersQuery.data.slice(0, 3).map((candidate) => (
                <ManualRow
                  key={candidate.id}
                  name={`${candidate.firstName} ${candidate.lastName}`}
                  sub={`${candidate.id} · ${candidate.membership?.planName ?? 'No plan'}`}
                  tag={
                    candidate.accountStatus === 'invited'
                      ? 'Invited'
                      : candidate.membership
                        ? candidate.membership.status === 'active'
                          ? 'Active'
                          : candidate.membership.status === 'expiring'
                            ? 'Expiring'
                            : candidate.membership.status === 'due'
                              ? 'Due'
                              : candidate.membership.status === 'paused'
                                ? 'Paused'
                                : 'Expired'
                        : 'No plan'
                  }
                  tagVariant={
                    candidate.accountStatus === 'invited' || !candidate.membership
                      ? 'muted'
                      : candidate.membership.status === 'active'
                        ? 'ok'
                        : candidate.membership.status === 'expiring' || candidate.membership.status === 'due'
                          ? 'warn'
                          : 'bad'
                  }
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
                              : 'The check-in could not be recorded.',
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
              ))}
            </View>
          ) : manualQuery.trim() ? (
            <Text style={{ color: c.ink3, fontSize: 12.5 }}>
              {membersQuery.isLoading ? 'Searching…' : 'No member matches that search.'}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={() => setManualOpen(false)}>
              Cancel
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
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View style={[styles.manualResult, { backgroundColor: c.surface2, borderColor: c.line }]}>
      <Monogram text={name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()} size={38} fontSize={12.5} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.manualName, { color: c.ink }]}>{name}</Text>
        <Text style={[styles.manualSub, { color: c.ink3 }]}>{sub}</Text>
      </View>
      <Tag variant={tagVariant}>{tag}</Tag>
      <View style={{ gap: 6 }}>
        <Button size="sm" loading={busy} onPress={onCheckIn}>Check in</Button>
        <Button size="sm" variant="quiet" onPress={onView}>View</Button>
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
  if (state === 'unreadable' || !row || !row.member_number) {
    return (
      <View style={styles.resultWrap}>
        <View style={[styles.badge, styles.badgeBad]}>
          <Icon name="xc" size={42} color={colors.bad} />
        </View>
        <Text style={styles.resultTitle}>Scan failed</Text>
        <Text style={styles.resultSub}>
          The camera could not resolve a valid Meridian QR pass. The member's screen may be dimmed or displaying an expired screenshot.
        </Text>

        <View style={{ width: '100%', gap: 10, marginTop: 24 }}>
          <Button block onPress={onScanNext}>
            Retry scan
          </Button>
          <Button variant="secondary" block onPress={onManualLookup}>
            Search member manually
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
      ? `"${row.first_name}, your membership expires in ${days} days. Would you like to renew before leaving today?"`
      : row.verdict === 'due'
        ? `"${row.first_name}, there's an outstanding payment on your plan. The desk can settle it in a moment."`
        : row.verdict === 'expired'
          ? `"Your membership expired ${fmtLong(row.end_date ?? '')}. We can renew it right now at the desk if you have a moment."`
          : row.verdict === 'paused'
            ? `"Your membership is paused. Reception can resume it whenever you're ready."`
            : null;

  return (
    <View style={styles.resultWrap}>
      <View style={[styles.badge, badgeStyle]}>
        <Icon name={meta.icon as any} size={42} color={badgeColor} />
      </View>

      <Text style={styles.resultTitle}>{meta.title}</Text>

      <View style={styles.scanCard}>
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
          <Text style={styles.scanCardName}>
            {row.first_name} {row.last_name}
          </Text>
          <Text style={styles.scanCardSub}>
            {row.member_number} · {row.plan_name ?? 'No plan'}
          </Text>
        </View>
        <Tag variant={meta.badge}>{meta.title.split(' — ')[0]}</Tag>
      </View>

      {speechScript ? (
        <Banner variant={meta.badge === 'warn' ? 'warn' : 'error'}>
          <Text style={{ fontStyle: 'italic' }}>Staff prompt: </Text>
          {speechScript}
        </Banner>
      ) : null}

      <Text style={styles.scanTime}>
        {row.admitted
          ? `Admitted at ${new Date(row.checked_in_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })} · ${row.end_date ? `until ${fmtLong(row.end_date)}` : ''}`
          : row.verdict === 'duplicate'
            ? 'A valid check-in already exists for this member. No new visit recorded.'
            : `${fmtLong(row.end_date ?? '')}. Do not admit on this pass.`}
      </Text>

      <View style={styles.resultCtas}>
        {row.admitted ? (
          <Button block style={{ flex: 1, backgroundColor: colors.ok }} onPress={onScanNext}>
            Scan next member
          </Button>
        ) : row.verdict === 'duplicate' ? (
          <>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={onScanNext}>
              <Text style={{ color: colors.ink }}>Scan next</Text>
            </Button>
            <Button block style={{ flex: 1.3 }} onPress={() => onViewMember(row.member_number!)}>
              View member
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
              <Text style={{ color: colors.ink }}>View member</Text>
            </Button>
            <Button
              block
              style={{ flex: 1.3, backgroundColor: meta.badge === 'bad' ? colors.bad : colors.warn }}
              onPress={() => onRenew(row.member_number!)}
            >
              Renew at desk
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
