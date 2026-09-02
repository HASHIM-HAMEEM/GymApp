import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { Tag, TagVariant } from './Tag';
import { useApp } from '@/data/store';

/* ------------------------------------------------------------------ */
/* Membership card — dark physical object, always dark                 */
/* V2: radial + linear gradient, white wordmark, plan chip.            */
/* ------------------------------------------------------------------ */

export interface MembershipCardProps {
  name: string;
  plan: string;
  validUntil?: string;
  memberSince?: string;
  memberId: string;
  tag?: { label: string; variant?: TagVariant };
  onShowQr?: () => void;
  showQr?: boolean;
  style?: ViewStyle;
}

export function MembershipCard({
  name,
  plan,
  validUntil,
  memberSince,
  memberId,
  tag,
  onShowQr,
  showQr = true,
  style,
}: MembershipCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: '#161616',
          borderRadius: 22,
          padding: 22,
          paddingBottom: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          minHeight: 188,
          justifyContent: 'space-between',
        },
        style,
      ]}
    >
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Logo size={20} color="#FFFFFF" strokeWidth={2.6} />
            <Text
              style={{
                fontFamily: typography.display,
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.24,
                color: 'rgba(242,244,248,0.92)',
                textTransform: 'uppercase',
              }}
            >
              Meridian
            </Text>
          </View>
          <Text
            style={{
              fontFamily: typography.display,
              fontSize: 10.5,
              fontWeight: '600',
              letterSpacing: 0.1,
              color: '#EDEDED',
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.28)',
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 999,
              textTransform: 'uppercase',
            }}
          >
            {plan}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: typography.display,
            fontSize: 21,
            fontWeight: '600',
            letterSpacing: -0.01,
            color: '#F2F4F8',
            marginTop: 22,
            lineHeight: 26,
          }}
          numberOfLines={2}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: typography.mono,
            fontSize: 12.5,
            letterSpacing: 0.08,
            color: 'rgba(242,244,248,0.55)',
            marginTop: 5,
          }}
        >
          {memberId}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginTop: 20,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: 'rgba(242,244,248,0.14)',
        }}
      >
        <View>
          <Text
            style={{
              fontFamily: typography.fontFamily,
              fontSize: 9.5,
              fontWeight: '600',
              letterSpacing: 0.16,
              color: 'rgba(242,244,248,0.45)',
              textTransform: 'uppercase',
            }}
          >
            Valid until
          </Text>
          <Text
            style={{
              fontFamily: typography.display,
              fontSize: 14,
              fontWeight: '600',
              color: '#F2F4F8',
              marginTop: 4,
            }}
          >
            {validUntil ?? memberSince}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {tag ? (
            <Tag variant={tag.variant ?? 'accent'}>{tag.label}</Tag>
          ) : null}
          {showQr && onShowQr ? (
            <Pressable
              onPress={onShowQr}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="qr" size={22} color="#F2F4F8" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
