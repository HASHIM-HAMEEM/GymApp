import * as React from 'react';
import { Svg, Circle, Path } from 'react-native-svg';
import { useColors } from '@/theme/tokens';
import { useApp } from '@/data/store';

/** Meridian V2 mark — horizon arc crossing a circle. */
export function Logo({
  size = 48,
  color,
  strokeWidth = 3,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const ink = color ?? c.accentHi;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx={24} cy={24} r={19} stroke={ink} strokeWidth={strokeWidth} />
      <Path d="M5 24 H43" stroke={ink} strokeWidth={strokeWidth} />
      <Circle cx={35.4} cy={24} r={5.6} fill={ink} />
    </Svg>
  );
}
