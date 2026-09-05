import * as React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

// A spring about an equilibrium: m*x'' + c*x' + k*x = 0.
// Sample once, then send transforms to Animated's native driver. No per-frame
// React renders. Different masses retain their own momentum and angular decay.
const TIMES = Array.from({ length: 101 }, (_, i) => i / 100);
const OBJECTS = [
  { kind: 'timer', x: 39, y: 39, width: 66, height: 78, angle: -16, mass: 0.8, delay: 0 },
  { kind: 'plate', x: 222, y: 22, width: 84, height: 84, angle: 19, mass: 1.5, delay: 0.035 },
  { kind: 'card', x: 13, y: 160, width: 94, height: 61, angle: -14, mass: 0.65, delay: 0.07 },
  { kind: 'dumbbell', x: 215, y: 151, width: 109, height: 70, angle: -26, mass: 1.8, delay: 0.105 },
  { kind: 'bolt', x: 160, y: 13, width: 27, height: 40, angle: 12, mass: 0.45, delay: 0.13 },
  { kind: 'ring', x: 145, y: 230, width: 43, height: 43, angle: -9, mass: 0.7, delay: 0.16 },
] as const;

function displacement(t: number, start: number, velocity: number, mass: number) {
  const frequency = Math.sqrt(150 / mass);
  const decay = frequency * 0.64;
  const damped = frequency * Math.sqrt(1 - 0.64 ** 2);
  return Math.exp(-decay * t) * (start * Math.cos(damped * t) + (velocity + decay * start) / damped * Math.sin(damped * t));
}

const FLIGHTS = OBJECTS.map((object) => {
  const startX = 170 - (object.x + object.width / 2);
  const startY = 140 - (object.y + object.height / 2);
  const curve = (axis: 'x' | 'y' | 'rotation') => TIMES.map((p) => {
    const t = Math.max(0, p * 1.65 - object.delay);
    const start = axis === 'x' ? startX : axis === 'y' ? startY : -object.angle * 1.8;
    // Upward launch bias gives a shallow arc before the spring settles.
    const velocity = axis === 'x' ? -startX * 2.3 : axis === 'y' ? -startY * 1.8 - 75 : 65;
    const value = displacement(t, start, velocity, axis === 'rotation' ? object.mass * 1.15 : object.mass);
    // Blend the subpixel tail to exactly zero, avoiding a discontinuity on replay.
    const tail = p < 0.85 ? 1 : (1 - p) / 0.15;
    return value * tail;
  });
  return { x: curve('x'), y: curve('y'), rotation: curve('rotation').map((v) => `${v + object.angle}deg`) };
});

function Equipment({ kind, light }: { kind: typeof OBJECTS[number]['kind']; light: boolean }) {
  const id = React.useId().replace(/:/g, '');
  const metal = `url(#${id}-metal)`;
  const edge = light ? '#4B5D69' : '#D1DEE8';
  return (
    <Svg width="100%" height="100%" viewBox={kind === 'dumbbell' ? '0 0 110 70' : kind === 'card' ? '0 0 94 61' : '0 0 84 84'} fill="none">
      <Defs>
        <LinearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F4F8FA" />
          <Stop offset="0.2" stopColor="#8B9DAA" />
          <Stop offset="0.43" stopColor="#E5EDF2" />
          <Stop offset="0.58" stopColor="#526674" />
          <Stop offset="0.8" stopColor="#A8BAC7" />
          <Stop offset="1" stopColor="#33444F" />
        </LinearGradient>
      </Defs>
      {kind === 'dumbbell' ? <>
        <Rect x="30" y="29" width="50" height="13" rx="5" fill={metal} />
        {Array.from({ length: 9 }, (_, i) => <Path key={i} d={`M${39 + i * 4} 31l-3 9`} stroke="#263945" strokeOpacity="0.5" />)}
        <Rect x="11" y="12" width="23" height="47" rx="7" fill="#17212A" stroke={edge} strokeWidth="1.5" />
        <Rect x="17" y="8" width="12" height="51" rx="5" fill={metal} />
        <Rect x="77" y="12" width="23" height="47" rx="7" fill="#17212A" stroke={edge} strokeWidth="1.5" />
        <Rect x="79" y="8" width="12" height="51" rx="5" fill={metal} />
        <Path d="M5 29v13M106 29v13" stroke={edge} strokeWidth="4" strokeLinecap="round" />
      </> : kind === 'plate' ? <>
        <Circle cx="42" cy="44" r="37" fill="#10191F" stroke={edge} strokeWidth="1.5" />
        <Circle cx="42" cy="41" r="34" fill="#273640" stroke={metal} strokeWidth="4" />
        <Circle cx="42" cy="41" r="27" stroke="#8EA3B0" strokeOpacity="0.4" />
        <Circle cx="42" cy="41" r="9" fill="#03080B" stroke={metal} strokeWidth="4" />
        <Path d="M19 33a25 25 0 0 1 8-11M60 21a25 25 0 0 1 8 13M31 64a25 25 0 0 0 23 0" stroke="#091115" strokeWidth="5" strokeLinecap="round" />
        <SvgText x="42" y="20" fill="#F0F5F8" fontSize="9" fontWeight="600" textAnchor="middle">20 KG</SvgText>
      </> : kind === 'timer' ? <>
        <Rect x="33" y="5" width="18" height="8" rx="3" fill={metal} />
        <Path d="m65 21 5-5" stroke={metal} strokeWidth="7" strokeLinecap="round" />
        <Circle cx="42" cy="46" r="31" fill="#15232C" stroke={metal} strokeWidth="4" />
        <Circle cx="42" cy="46" r="24" stroke="#567080" strokeWidth="0.8" />
        {Array.from({ length: 12 }, (_, i) => <Path key={i} d="M42 24v3" stroke="#BCCAD2" strokeWidth="1.5" transform={`rotate(${i * 30} 42 46)`} />)}
        <Path d="M42 31v15l11 7" stroke="#F5F9FB" strokeWidth="2.5" strokeLinecap="round" />
        <Circle cx="42" cy="46" r="3" fill={metal} />
      </> : kind === 'card' ? <>
        <Rect x="2" y="3" width="90" height="56" rx="9" fill="#182732" stroke={metal} strokeWidth="1.4" />
        <Path d="M12 4h62" stroke="#EEF6FB" strokeOpacity="0.55" />
        <Circle cx="16" cy="17" r="5" stroke="#E1EBF2" strokeWidth="1.3" />
        <Path d="M11 17h10" stroke="#E1EBF2" />
        <SvgText x="28" y="20" fill="#E5EEF3" fontSize="8" letterSpacing="1">APEX</SvgText>
        <Path d="M12 36h39M12 44h23" stroke="#778F9F" strokeWidth="3" strokeLinecap="round" />
        <G stroke="#DCE7EF" strokeWidth="2"><Rect x="67" y="32" width="7" height="7" /><Rect x="79" y="32" width="7" height="7" /><Rect x="67" y="44" width="7" height="7" /><Path d="M80 44h5v6h-5z" /></G>
      </> : kind === 'bolt' ? <Path d="M49 4 18 48h23l-5 32 30-46H45l4-30Z" fill={metal} stroke={edge} /> : <>
        <Circle cx="42" cy="42" r="29" stroke="#304550" strokeWidth="8" />
        <Path d="M42 13a29 29 0 1 1-28 36" stroke={metal} strokeWidth="8" strokeLinecap="round" />
        <Path d="m30 42 8 8 17-19" stroke={light ? '#253E4C' : '#DDEAF3'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </Svg>
  );
}

export function WelcomeArtwork({ progress, width, light, onReplay, replayLabel }: {
  progress: Animated.Value;
  width: number;
  light: boolean;
  onReplay: () => void;
  replayLabel: string;
}) {
  const scale = width / 340;
  return <View style={{ width, height: 280 * scale, direction: 'ltr' }}>
    <View style={{ width: 340, height: 280, transform: [{ scale }], transformOrigin: 'top left' }}>
      <View aria-hidden style={StyleSheet.absoluteFill}>
        {OBJECTS.map((object, index) => <Animated.View key={object.kind} testID={`welcome-object-${object.kind}`} style={{
          position: 'absolute', left: object.x, top: object.y, width: object.width, height: object.height,
          opacity: progress.interpolate({ inputRange: [0, object.delay / 1.65 + 0.01, object.delay / 1.65 + 0.1, 1], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' }),
          transform: [
            { translateX: progress.interpolate({ inputRange: TIMES, outputRange: FLIGHTS[index].x }) },
            { translateY: progress.interpolate({ inputRange: TIMES, outputRange: FLIGHTS[index].y }) },
            { rotate: progress.interpolate({ inputRange: TIMES, outputRange: FLIGHTS[index].rotation }) },
          ],
        }}><Equipment kind={object.kind} light={light} /></Animated.View>)}
      </View>
      <Animated.View style={{ position: 'absolute', left: 130, top: 104, opacity: progress.interpolate({ inputRange: [0, 0.14, 1], outputRange: [0, 1, 1] }) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={replayLabel} onPress={onReplay} style={({ pressed }) => ({ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <Circle cx="40" cy="40" r="34" fill={light ? '#E5EBEE' : '#101C25'} stroke={light ? '#667E8D' : '#687F8E'} strokeWidth="0.8" />
            <Circle cx="40" cy="40" r="25" stroke={light ? '#243D4D' : '#E9F2F8'} strokeWidth="2" />
            <Path d="M15 40h50" stroke={light ? '#243D4D' : '#E9F2F8'} strokeWidth="2" />
            <Circle cx="54" cy="40" r="6" fill={light ? '#243D4D' : '#E9F2F8'} />
            <Path d="M20 16a33 33 0 0 1 40 0" stroke="#F4F9FD" strokeOpacity="0.65" strokeLinecap="round" />
          </Svg>
        </Pressable>
      </Animated.View>
    </View>
  </View>;
}
