import * as React from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/theme/tokens';

/** Horizontal intent reveals an action; a separate confirmation owns deletion. */
export function SwipeNoticeRow({ children, onDelete, label }: { children: React.ReactNode; onDelete: () => void; label: string }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const reduced = useReducedMotion();
  const x = React.useRef(new Animated.Value(0)).current;
  const origin = React.useRef(0);
  const [side, setSide] = React.useState(0);
  const settle = React.useCallback((target: number) => {
    origin.current = target;
    setSide(Math.sign(target));
    if (reduced) x.setValue(target);
    else Animated.spring(x, { toValue: target, stiffness: 230, damping: 27, mass: 1, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [reduced, x]);
  const pan = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderGrant: () => x.stopAnimation((value) => { origin.current = value; }),
    onPanResponderMove: (_, g) => x.setValue(Math.max(-88, Math.min(88, origin.current + g.dx))),
    onPanResponderRelease: (_, g) => {
      const position = origin.current + g.dx;
      settle(Math.abs(position) > 36 ? Math.sign(position) * 88 : 0);
    },
    onPanResponderTerminate: () => settle(0),
  }), [settle, x]);
  return <View style={{ overflow: 'hidden', backgroundColor: c.badSoft }}>
    {side !== 0 ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { settle(0); onDelete(); }} style={{ position: 'absolute', top: 0, bottom: 0, ...(side > 0 ? { left: 0 } : { right: 0 }), width: 88, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.bad, fontWeight: '600', fontSize: 13 }}>{label}</Text></Pressable> : null}
    <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }], backgroundColor: c.bg1 }}>{children}</Animated.View>
  </View>;
}
