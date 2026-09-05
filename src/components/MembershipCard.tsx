import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Link, type Href } from 'expo-router';
import { colors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { Logo } from './Logo';
import { Tag, TagVariant } from './Tag';
import { useApp } from '@/data/store';

/* ------------------------------------------------------------------ */
/* Membership card — signature luxury physical object, always dark     */
/* Ported with exact radial + linear gradients and mini QR plate.     */
/* ------------------------------------------------------------------ */

export interface MembershipCardProps {
  name: string;
  plan: string;
  validUntil?: string;
  memberSince?: string;
  memberId: string;
  variant?: 'active' | 'warn' | 'bad';
  tag?: { label: string; variant?: TagVariant };
  onShowQr?: () => void;
  href?: Href;
  showQr?: boolean;
  qrValue?: string;
  style?: ViewStyle;
}

export function MembershipCard({
  name,
  plan,
  validUntil,
  memberSince,
  memberId,
  variant = 'active',
  tag,
  onShowQr,
  href,
  showQr = true,
  qrValue,
  style,
}: MembershipCardProps) {
  const { t, isRtl } = useApp();
  const borderColor =
    variant === 'warn'
      ? 'rgba(222, 184, 124, 0.38)'
      : variant === 'bad'
      ? 'rgba(222, 138, 128, 0.38)'
      : 'rgba(255, 255, 255, 0.2)';

  const cardGradientStyle = Platform.select({
    web: {
      backgroundImage:
        variant === 'warn'
          ? 'radial-gradient(130% 150% at 100% 0%, rgba(222, 184, 124, .13) 0%, rgba(222, 184, 124, 0) 52%), linear-gradient(155deg, #211C14 0%, #16130D 58%, #100E0A 100%)'
          : variant === 'bad'
          ? 'radial-gradient(130% 150% at 100% 0%, rgba(222, 138, 128, .13) 0%, rgba(222, 138, 128, 0) 52%), linear-gradient(155deg, #221415 0%, #171112 58%, #110D0D 100%)'
          : 'radial-gradient(130% 150% at 100% 0%, rgba(255, 255, 255, .1) 0%, rgba(255, 255, 255, 0) 52%), linear-gradient(155deg, #242424 0%, #161616 58%, #101010 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px rgba(0,0,0,0.38)',
    } as any,
    default: {
      backgroundColor:
        variant === 'warn' ? '#1B1610' : variant === 'bad' ? '#1C1213' : '#161616',
    },
  });

  const qrPayload = qrValue ?? `APEX|${memberId}|INACTIVE`;

  const CardInner = (
    <View
      style={[
        styles.card,
        cardGradientStyle,
        { borderColor },
        style,
      ]}
    >
      <View>
        <View style={[styles.topRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.brandRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Logo size={20} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.wordmark}>Apex</Text>
          </View>
          <Text style={styles.planChip}>{plan}</Text>
        </View>

        <View style={styles.holder}>
          <Text style={[styles.holderName, { writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {name}
          </Text>
          <Text style={[styles.holderId, { writingDirection: 'ltr' }]}>{memberId}</Text>
        </View>
      </View>

      <View style={[styles.footRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <View style={styles.stat}>
          <Text style={[styles.statCap, { writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('membership.validUntilLabel')}</Text>
          <Text style={[styles.statVal, { writingDirection: 'ltr' }]}>{validUntil ?? memberSince ?? '—'}</Text>
        </View>

        {showQr ? (
          <View style={styles.qrPlate}>
            <QRCode
              value={qrPayload}
              size={92}
              color="#10131A"
              backgroundColor={colors.plate}
              quietZone={12}
              ecl="M"
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
          {CardInner}
        </Pressable>
      </Link>
    );
  }

  if (onShowQr) {
    return (
      <Pressable
        onPress={onShowQr}
        style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      >
        {CardInner}
      </Pressable>
    );
  }

  return CardInner;
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minWidth: 0,
    borderRadius: 22,
    padding: 20,
    paddingBottom: 18,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 172,
    justifyContent: 'space-between',
    backgroundColor: '#161616',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  wordmark: {
    fontFamily: typography.display,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.6,
    color: 'rgba(242,244,248,0.92)',
    textTransform: 'uppercase',
  },
  planChip: {
    maxWidth: '100%',
    flexShrink: 1,
    fontFamily: typography.display,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    color: '#EDEDED',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    textTransform: 'uppercase',
  },
  holder: {
    marginTop: 16,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  holderName: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#F2F4F8',
    lineHeight: 26,
  },
  holderId: {
    fontFamily: typography.mono,
    fontSize: 13,
    letterSpacing: 1.0,
    color: 'rgba(242,244,248,0.55)',
    marginTop: 5,
    lineHeight: 20,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 0,
    gap: 16,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  statCap: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(242,244,248,0.45)',
    textTransform: 'uppercase',
  },
  statVal: {
    lineHeight: 22,
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
    color: '#F2F4F8',
  },
  qrPlate: {
    overflow: 'hidden',
    width: 92,
    height: 92,
    flexShrink: 0,
    borderRadius: 14,
    backgroundColor: colors.plate,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }
      : {
          shadowColor: '#000000',
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
});
