import * as React from 'react';
import { View, ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '@/theme/tokens';

export function QrCode({
  value,
  size = 230,
  dark = colors.ink,
  light = colors.surface,
  style,
}: {
  value: string;
  size?: number;
  dark?: string;
  light?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          backgroundColor: light,
          borderRadius: 8,
          padding: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <QRCode
        value={value}
        size={size - 16}
        color={dark}
        backgroundColor={light}
        quietZone={0}
      />
    </View>
  );
}
