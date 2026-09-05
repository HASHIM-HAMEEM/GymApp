import * as React from 'react';
import { Circle, Defs, LinearGradient, Path, RadialGradient, Stop, Svg } from 'react-native-svg';
import { useColors } from '@/theme/tokens';
import { useApp } from '@/data/store';

export function ApexMark({
  size = 92,
  appearance = 'chrome',
  light = false,
}: {
  size?: number;
  appearance?: 'chrome' | 'flat';
  light?: boolean;
}) {
  const flatInk = light ? '#1D2A33' : '#EDF5FA';

  return (
    <Svg width={size} height={size} viewBox="0 0 92 92" fill="none">
      <Defs>
        <LinearGradient id="apexChrome" gradientUnits="userSpaceOnUse" x1="18" y1="9" x2="75" y2="82">
          <Stop offset="0" stopColor={light ? '#435667' : '#F7FBFF'} />
          <Stop offset="0.24" stopColor={light ? '#EAF1F5' : '#9BAFBE'} />
          <Stop offset="0.48" stopColor={light ? '#667B8D' : '#F9FCFF'} />
          <Stop offset="0.72" stopColor={light ? '#233847' : '#61798B'} />
          <Stop offset="1" stopColor={light ? '#C5D0D8' : '#DDE7EE'} />
        </LinearGradient>
        <RadialGradient id="apexOrb" cx="38%" cy="28%" r="74%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
          <Stop offset="0.28" stopColor="#C7D4DE" stopOpacity="0.96" />
          <Stop offset="0.66" stopColor="#536B7D" stopOpacity="0.98" />
          <Stop offset="1" stopColor="#15222C" />
        </RadialGradient>
      </Defs>
      {appearance === 'chrome' ? (
        <Circle cx="46" cy="46" r="35" stroke="#8EA5B6" strokeOpacity="0.2" strokeWidth="9" />
      ) : null}
      <Circle
        cx="46"
        cy="46"
        r="31"
        stroke={appearance === 'chrome' ? 'url(#apexChrome)' : flatInk}
        strokeWidth="7"
      />
      <Path
        d="M15 46 H77"
        stroke={appearance === 'chrome' ? 'url(#apexChrome)' : flatInk}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Circle cx="66" cy="46" r="10" fill={appearance === 'chrome' ? 'url(#apexOrb)' : flatInk} />
      {appearance === 'chrome' ? (
        <Path d="M29 25c8-7 22-10 34-3" stroke="#FFFFFF" strokeOpacity="0.76" strokeWidth="2.2" strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

/** Apex V2 mark — horizon arc crossing a circle. */
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
