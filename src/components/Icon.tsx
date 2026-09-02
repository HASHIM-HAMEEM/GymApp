import * as React from 'react';
import { Svg, Path, Rect, Circle, G, Line } from 'react-native-svg';
import { colors } from '@/theme/tokens';

/**
 * Meridian icon set — 1.6 px stroke, round caps, 24 grid.
 * Ported from assets/shared.js ICONS map. Each entry is a render function
 * that returns the inner SVG nodes; the wrapper <Svg> is shared.
 */
type Node = React.ReactNode;

const ICONS: Record<string, () => Node> = {
  home: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M3.5 10.4 12 3l8.5 7.4" />
      <Path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
    </G>
  ),
  card: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={3} y={5.5} width={18} height={13} rx={2.5} />
      <Path d="M3 10h18" />
      <Path d="M6.5 14.5h3" />
    </G>
  ),
  clock: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </G>
  ),
  bell: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.5 5.5 1.5 5.5h-15S6 14 6 9.5" />
      <Path d="M10.3 18.5a2 2 0 0 0 3.4 0" />
    </G>
  ),
  user: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={8} r={3.7} />
      <Path d="M5.2 20.2c1.1-3.3 3.8-5 6.8-5s5.7 1.7 6.8 5" />
    </G>
  ),
  qr: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={3.5} y={3.5} width={6.5} height={6.5} rx={1.5} />
      <Rect x={14} y={3.5} width={6.5} height={6.5} rx={1.5} />
      <Rect x={3.5} y={14} width={6.5} height={6.5} rx={1.5} />
      <Rect x={14} y={14} width={3} height={3} fill="currentColor" stroke="none" />
      <Path d="M20 14v6.5h-6.5" />
    </G>
  ),
  chev: () => (
    <Path
      d="M9.5 5.5 15.5 12l-6 6.5"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  chevl: () => (
    <Path
      d="M14.5 5.5 8.5 12l6 6.5"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  chevd: () => (
    <Path
      d="M6 9.5l6 6 6-6"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  search: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={10.7} cy={10.7} r={6.4} />
      <Path d="M15.4 15.4 20 20" />
    </G>
  ),
  plus: () => (
    <Path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    />
  ),
  scan: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M4 8V6.2A2.2 2.2 0 0 1 6.2 4H8M16 4h1.8A2.2 2.2 0 0 1 20 6.2V8M20 16v1.8a2.2 2.2 0 0 1-2.2 2.2H16M8 20H6.2A2.2 2.2 0 0 1 4 17.8V16" />
      <Path d="M7.5 12h9" />
    </G>
  ),
  check: () => (
    <Path
      d="M5 12.5l4.5 4.5L19 7.5"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  close: () => (
    <Path
      d="M6 6l12 12M18 6 6 18"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    />
  ),
  warn: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M12 4 21.3 20.2H2.7L12 4Z" />
      <Path d="M12 10v4.2" />
      <Path d="M12 17.3v.1" />
    </G>
  ),
  info: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 11.2v4.8" />
      <Path d="M12 8.2v.1" />
    </G>
  ),
  back: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M19.5 12H5" />
      <Path d="M11 5.5 4.5 12 11 18.5" />
    </G>
  ),
  refresh: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M20 5.5v4.2h-4.2" />
      <Path d="M19.7 9.7a7.6 7.6 0 1 0 .6 3.3" />
    </G>
  ),
  wifioff: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M3.5 9.5a13 13 0 0 1 6-3.4" />
      <Path d="M20.5 9.5a13 13 0 0 0-5-2.9" />
      <Path d="M6.5 13a8.5 8.5 0 0 1 3-1.8" />
      <Path d="M17.5 13a8.5 8.5 0 0 0-1.6-1" />
      <Circle cx={12} cy={19.3} r={1} fill="currentColor" />
      <Path d="M4 4l16 16" />
    </G>
  ),
  wifi: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M3.5 9.5a13 13 0 0 1 17 0" />
      <Path d="M6.5 13a8.5 8.5 0 0 1 11 0" />
      <Path d="M9.5 16.3a4 4 0 0 1 5 0" />
      <Circle cx={12} cy={19.3} r={1} fill="currentColor" />
    </G>
  ),
  phone: () => (
    <Path
      d="M6.7 3.5h2.6l1.4 3.7-2 1.4a11.6 11.6 0 0 0 5.6 5.6l1.4-2 3.7 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.7 5.7a2 2 0 0 1 2-2.2Z"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  mail: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={3} y={5} width={18} height={14} rx={2.5} />
      <Path d="M3.5 7.5 12 13.5l8.5-6" />
    </G>
  ),
  pin: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M12 21c-4.4-3.7-7-7.2-7-10.6a7 7 0 0 1 14 0C19 13.8 16.4 17.3 12 21Z" />
      <Circle cx={12} cy={10.3} r={2.4} />
    </G>
  ),
  cal: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={4} y={5} width={16} height={16} rx={2.5} />
      <Path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </G>
  ),
  logout: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M14.5 4.5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3.5" />
      <Path d="M3 12h11.5" />
      <Path d="M10.5 7.5 15 12l-4.5 4.5" />
    </G>
  ),
  edit: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M4.5 19.5l.9-3.4L16.6 4.9a2.1 2.1 0 0 1 3 3L8.4 19.1l-3.9.4Z" />
      <Path d="M14.5 7l3 3" />
    </G>
  ),
  users: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={9} cy={8.2} r={3.3} />
      <Path d="M3.4 19.8c.9-3 3-4.6 5.6-4.6s4.7 1.6 5.6 4.6" />
      <Path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.3M17.5 15.6c1.7.7 2.8 2 3.4 4.2" />
    </G>
  ),
  grid: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={3.5} y={3.5} width={7} height={7} rx={1.8} />
      <Rect x={13.5} y={3.5} width={7} height={7} rx={1.8} />
      <Rect x={3.5} y={13.5} width={7} height={7} rx={1.8} />
      <Rect x={13.5} y={13.5} width={7} height={7} rx={1.8} />
    </G>
  ),
  speak: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M4 10.2v3.6l2.7.8V9.4l-2.7.8Z" />
      <Path d="M7.3 9.4 13.5 6v12l-6.2-3.4" />
      <Path d="M16.2 9.2a4 4 0 0 1 0 5.6M18.6 7a7 7 0 0 1 0 10" />
    </G>
  ),
  checkc: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M8.2 12.3l2.6 2.6 5-5.3" />
    </G>
  ),
  xc: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </G>
  ),
  alertc: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5v5" />
      <Path d="M12 16.3v.1" />
    </G>
  ),
  userplus: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={10} cy={8.2} r={3.3} />
      <Path d="M4 19.8c.9-3 3-4.6 5.6-4.6 1 0 2 .2 2.9.7" />
      <Path d="M17.5 13.5v6M14.5 16.5h6" />
    </G>
  ),
  receipt: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6L8.4 20.5 6 19v-15.5Z" />
      <Path d="M9.5 8.5h5M9.5 12h5" />
    </G>
  ),
  ccard: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={3} y={6} width={18} height={12.5} rx={2.5} />
      <Path d="M3 10h18M6.5 14.5h3" />
    </G>
  ),
  list: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M4.5 6.5h2v2h-2zM9.5 7.5h10M4.5 15.5h2v2h-2zM9.5 16.5h10" />
    </G>
  ),
  tag: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M4 4.5h6.5L20 14a2 2 0 0 1 0 2.8l-3.2 3.2a2 2 0 0 1-2.8 0L4 11V4.5Z" />
      <Path d="M8 8h.01" />
    </G>
  ),
  settings: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={12} r={2.6} />
      <Path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1" />
    </G>
  ),
  send: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M20 4 10.5 13.5" />
      <Path d="M20 4l-5.5 16-4-6.5L4 9.5 20 4z" />
    </G>
  ),
  pause: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={7} y={5} width={3.5} height={14} rx={1.2} />
      <Rect x={13.5} y={5} width={3.5} height={14} rx={1.2} />
    </G>
  ),
  copy: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Rect x={8.5} y={8.5} width={12} height={12} rx={2.5} />
      <Path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </G>
  ),
  key: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={8} cy={14} r={4.5} />
      <Path d="M11.5 10.5 20 2" />
      <Path d="M15.5 6.5l2.5 2.5" />
    </G>
  ),
  eye: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx={12} cy={12} r={3} />
    </G>
  ),
  sparkle: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <Path d="M18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
    </G>
  ),
  shield: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M12 2.5 19.5 5.5v6c0 5-3.2 8.4-7.5 10-4.3-1.6-7.5-5-7.5-10v-6L12 2.5z" />
      <Path d="M9 11.5l2.2 2.2 4-4" />
    </G>
  ),
  megaphone: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l9 4.5v-15L8 9H5a1.5 1.5 0 0 0-1.5 1.5z" />
      <Path d="M8 15.5V19a1.5 1.5 0 0 0 1.5 1.5H10" />
    </G>
  ),
  listic: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M9 6h11M9 12h11M9 18h11" />
      <Circle cx={5} cy={6} r={0.6} fill="currentColor" />
      <Circle cx={5} cy={12} r={0.6} fill="currentColor" />
      <Circle cx={5} cy={18} r={0.6} fill="currentColor" />
    </G>
  ),
  activity: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M3 12h4l3-7 4 14 3-7h4" />
    </G>
  ),
  filter: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M4 5.5h16l-6.5 7.5v5L10.5 20v-7L4 5.5z" />
    </G>
  ),
  download: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M12 3.5v12" />
      <Path d="M7 11.5l5 5 5-5" />
      <Path d="M4.5 20.5h15" />
    </G>
  ),
  map: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d="M9 4 3.5 6.5v13L9 17l6 2.5 5.5-2.5v-13L15 6.5 9 4z" />
      <Path d="M9 4v13M15 6.5v13" />
    </G>
  ),
  globe: () => (
    <G
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M3.5 12h17" />
      <Path d="M12 3.5a13.5 13.5 0 0 1 0 17 13.5 13.5 0 0 1 0-17z" />
    </G>
  ),
};

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** strokeWidth override (default 1.6) */
  stroke?: number;
}

export function Icon({ name, size = 24, color = colors.ink, stroke = 1.6 }: IconProps) {
  const render = ICONS[name];
  if (!render) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" color={color}>
      {render()}
    </Svg>
  );
}

/** Small icon variant (13px) for inline use. */
export function IconSm({ name, color }: { name: IconName; color?: string }) {
  return <Icon name={name} size={13} color={color} stroke={1.8} />;
}
