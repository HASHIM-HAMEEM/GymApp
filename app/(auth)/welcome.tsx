import * as React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Sheet } from '@/components/Overlays';
import { CLUB } from '@/data/plans';
import { useApp } from '@/data/store';
import { typography } from '@/theme/tokens';

type CharmKind = 'dumbbell' | 'plate' | 'time' | 'member' | 'bolt' | 'check';

type CharmSpec = {
  kind: CharmKind;
  delay: number;
  left: number;
  top: number;
  rotate: number;
  dx: number;
  dy: number;
  size: number;
};

const CHARMS: CharmSpec[] = [
  { kind: 'time', delay: 0.08, left: 0.08, top: 0.08, rotate: -13, dx: 112, dy: 106, size: 50 },
  { kind: 'plate', delay: 0.13, left: 0.67, top: 0.03, rotate: 14, dx: -75, dy: 120, size: 58 },
  { kind: 'bolt', delay: 0.2, left: 0.82, top: 0.31, rotate: 17, dx: -115, dy: 40, size: 42 },
  { kind: 'member', delay: 0.16, left: 0.02, top: 0.43, rotate: -8, dx: 126, dy: -12, size: 62 },
  { kind: 'dumbbell', delay: 0.24, left: 0.59, top: 0.52, rotate: -12, dx: -57, dy: -48, size: 68 },
  { kind: 'check', delay: 0.29, left: 0.16, top: 0.72, rotate: 11, dx: 86, dy: -102, size: 46 },
];

const STARS = [
  [8, 13, 1], [18, 28, 1.4], [29, 8, 1], [42, 19, 0.8], [53, 6, 1.2],
  [67, 17, 0.8], [81, 9, 1.4], [91, 25, 0.9], [12, 54, 0.9], [24, 72, 1.3],
  [38, 61, 0.8], [49, 83, 1], [63, 70, 1.2], [77, 56, 0.8], [89, 78, 1.4],
  [5, 91, 1.1], [33, 94, 0.8], [71, 92, 0.9], [96, 63, 0.8],
] as const;

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

function StarField({ light }: { light: boolean }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.noPointerEvents]}
    >
      {STARS.map(([left, top, size], index) => (
        <View
          key={`${left}-${top}`}
          style={[
            styles.star,
            {
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              opacity: light ? 0.16 : index % 4 === 0 ? 0.72 : 0.38,
              backgroundColor: light ? '#263746' : '#E8F2FA',
            },
          ]}
        />
      ))}
    </View>
  );
}

function ChromeMark({ light }: { light: boolean }) {
  const { t, isRtl } = useApp();
  return (
    <View style={styles.chromeMark}>
      <Svg width={92} height={92} viewBox="0 0 92 92" fill="none">
        <Defs>
          <LinearGradient id="chrome" x1="18" y1="9" x2="75" y2="82">
            <Stop offset="0" stopColor={light ? '#435667' : '#F7FBFF'} />
            <Stop offset="0.24" stopColor={light ? '#EAF1F5' : '#9BAFBE'} />
            <Stop offset="0.48" stopColor={light ? '#667B8D' : '#F9FCFF'} />
            <Stop offset="0.72" stopColor={light ? '#233847' : '#61798B'} />
            <Stop offset="1" stopColor={light ? '#C5D0D8' : '#DDE7EE'} />
          </LinearGradient>
          <RadialGradient id="orb" cx="38%" cy="28%" r="74%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
            <Stop offset="0.28" stopColor="#C7D4DE" stopOpacity="0.96" />
            <Stop offset="0.66" stopColor="#536B7D" stopOpacity="0.98" />
            <Stop offset="1" stopColor="#15222C" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Circle cx="46" cy="46" r="35" stroke="#8EA5B6" strokeOpacity="0.22" strokeWidth="9" />
        <Circle cx="46" cy="46" r="31" stroke="url(#chrome)" strokeWidth="7" />
        <Path d="M15 46 H77" stroke="url(#chrome)" strokeWidth="7" strokeLinecap="round" />
        <Circle cx="66" cy="46" r="10" fill="url(#orb)" />
        <Path d="M29 25c8-7 22-10 34-3" stroke="#FFFFFF" strokeOpacity="0.78" strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
      <Text style={[styles.brandName, { color: light ? '#18242D' : '#EDF5FA' }]}>MERIDIAN</Text>
      <Text style={[styles.brandSub, { color: light ? '#63727D' : '#8294A0', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.athleticClub')}</Text>
    </View>
  );
}

function MiniDumbbell({ color }: { color: string }) {
  return (
    <Svg width="72%" height="72%" viewBox="0 0 56 32" fill="none">
      <G stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 16h24" />
        <Rect x="8" y="8" width="8" height="16" rx="3" />
        <Rect x="40" y="8" width="8" height="16" rx="3" />
        <Path d="M5 11v10M51 11v10" />
      </G>
    </Svg>
  );
}

function CharmFace({ kind, light }: { kind: CharmKind; light: boolean }) {
  const { t, isRtl } = useApp();
  const ink = light ? '#1C2A34' : '#F4F8FB';
  const quiet = light ? '#5C6E7C' : '#91A5B3';

  if (kind === 'dumbbell') return <MiniDumbbell color={ink} />;
  if (kind === 'bolt') {
    return (
      <Svg width="58%" height="58%" viewBox="0 0 24 24">
        <Path d="M13.4 2.8 5.7 13h5.2l-.4 8.2L18.3 11h-5.2l.3-8.2Z" fill={ink} />
      </Svg>
    );
  }
  if (kind === 'check') {
    return (
      <Svg width="62%" height="62%" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={quiet} strokeWidth="1.4" />
        <Path d="m7.7 12.3 2.7 2.7 5.9-6.1" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <View style={styles.charmCopy}>
      <Text style={[styles.charmStrong, { color: ink }]}>
        {kind === 'plate' ? '45' : kind === 'time' ? '06:30' : 'M·01'}
      </Text>
      <Text style={[styles.charmSmall, { color: quiet, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
        {kind === 'plate' ? 'KG' : kind === 'time' ? t('welcome.train') : t('welcome.member')}
      </Text>
    </View>
  );
}

function WorkoutCharm({ spec, stageWidth, stageHeight, light, reducedMotion }: {
  spec: CharmSpec;
  stageWidth: number;
  stageHeight: number;
  light: boolean;
  reducedMotion: boolean;
}) {
  const flight = React.useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const outwardX = -Math.sign(spec.dx) * 6;
  const gravityY = spec.dy > 0 ? -9 : 7;
  const initialRotation = spec.rotate + Math.sign(spec.dx) * 18;

  React.useEffect(() => {
    flight.stopAnimation();
    if (reducedMotion) {
      flight.setValue(1);
      return;
    }

    flight.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(560 + Math.round(spec.delay * 420)),
      Animated.timing(flight, {
        toValue: 0.76,
        duration: 250,
        easing: Easing.bezier(0.16, 0.82, 0.28, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(flight, {
        toValue: 1,
        stiffness: 170,
        damping: 17,
        mass: 0.82,
        velocity: 0.3,
        overshootClamping: true,
        restDisplacementThreshold: 0.001,
        restSpeedThreshold: 0.001,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [flight, reducedMotion, spec.delay]);

  const translateX = flight.interpolate({
    inputRange: [0, 0.76, 1],
    outputRange: [spec.dx, outwardX, 0],
  });
  const translateY = flight.interpolate({
    inputRange: [0, 0.76, 1],
    outputRange: [spec.dy, gravityY, 0],
  });
  const rotate = flight.interpolate({
    inputRange: [0, 0.76, 1],
    outputRange: [`${initialRotation}deg`, `${spec.rotate - Math.sign(spec.dx) * 2}deg`, `${spec.rotate}deg`],
  });
  const scale = flight.interpolate({
    inputRange: [0, 0.76, 1],
    outputRange: [0.84, 1.055, 1],
  });
  const opacity = flight.interpolate({
    inputRange: [0, 0.12, 0.76, 1],
    outputRange: [0, 0.5, 0.96, 1],
  });

  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.charm,
        {
          left: stageWidth * spec.left,
          top: stageHeight * spec.top,
          width: spec.size,
          height: spec.kind === 'member' || spec.kind === 'time' ? spec.size * 0.7 : spec.size,
          borderRadius: spec.kind === 'member' || spec.kind === 'time' ? 13 : spec.size / 2,
          backgroundColor: light ? 'rgba(255,255,255,0.76)' : 'rgba(20,29,36,0.86)',
          borderColor: light ? 'rgba(24,42,54,0.15)' : 'rgba(222,237,247,0.24)',
          opacity,
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale },
          ],
        },
      ]}
    >
      <View style={[styles.noPointerEvents, styles.charmHighlight, { borderColor: light ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.12)' }]} />
      <CharmFace kind={spec.kind} light={light} />
    </Animated.View>
  );
}

function LiquidOrb({ progress, light }: { progress: Animated.Value; light: boolean }) {
  const scale = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.58, 1.08, 1] });
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 1] });
  return (
    <Animated.View style={[styles.orb, { opacity, transform: [{ scale }] }]}>
      <Svg width="100%" height="100%" viewBox="0 0 72 72">
        <Defs>
          <RadialGradient id="glassOrb" cx="36%" cy="27%" r="74%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={light ? 0.82 : 0.7} />
            <Stop offset="0.2" stopColor="#AFC2D0" stopOpacity="0.44" />
            <Stop offset="0.67" stopColor="#526B7E" stopOpacity="0.32" />
            <Stop offset="1" stopColor="#111A21" stopOpacity={light ? 0.34 : 0.94} />
          </RadialGradient>
          <LinearGradient id="orbRim" x1="12" y1="8" x2="60" y2="64">
            <Stop stopColor="#FFFFFF" stopOpacity="0.88" />
            <Stop offset="0.5" stopColor="#A9C0D0" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.58" />
          </LinearGradient>
        </Defs>
        <Circle cx="36" cy="36" r="31" fill="url(#glassOrb)" stroke="url(#orbRim)" strokeWidth="1.25" />
        <Ellipse cx="29" cy="22" rx="13" ry="7" fill="#FFFFFF" fillOpacity="0.09" />
        <Circle cx="36" cy="36" r="27" stroke="#FFFFFF" strokeOpacity="0.08" />
        <Path d="M29 36h14M36 29v14" stroke={light ? '#1B2C38' : '#F6FAFC'} strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

function GlassHorizon({ light, exitProgress }: { light: boolean; exitProgress: Animated.Value }) {
  const scale = exitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 3.45] });
  const translateY = exitProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -188] });
  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.noPointerEvents, styles.horizon, { transform: [{ translateY }, { scale }] }]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 620 310" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="planet" cx="50%" cy="10%" r="76%">
            <Stop offset="0" stopColor={light ? '#FFFFFF' : '#65839A'} stopOpacity={light ? 0.86 : 0.82} />
            <Stop offset="0.28" stopColor={light ? '#BCCAD3' : '#293D4C'} stopOpacity="0.74" />
            <Stop offset="0.67" stopColor={light ? '#6E8494' : '#101E29'} stopOpacity="0.94" />
            <Stop offset="1" stopColor={light ? '#2B3B47' : '#05090D'} stopOpacity="1" />
          </RadialGradient>
          <LinearGradient id="rim" x1="80" y1="12" x2="530" y2="70">
            <Stop stopColor="#FFFFFF" stopOpacity="0.12" />
            <Stop offset="0.48" stopColor="#E9F6FF" stopOpacity="0.92" />
            <Stop offset="1" stopColor="#8CABBE" stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="310" cy="284" rx="306" ry="242" fill="#82A6BC" fillOpacity="0.09" />
        <Ellipse cx="310" cy="294" rx="295" ry="236" fill="url(#planet)" stroke="url(#rim)" strokeWidth="3" />
        <Ellipse cx="310" cy="284" rx="267" ry="207" stroke="#D9EDFA" strokeOpacity="0.1" strokeWidth="2" />
        <Circle cx="310" cy="94" r="23" fill="#0C151B" fillOpacity="0.18" />
        <Circle cx="310" cy="94" r="15" stroke="#E7F5FF" strokeOpacity="0.08" />
      </Svg>
    </Animated.View>
  );
}

function PathArrow({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 7h8M7.5 3.5 11 7l-3.5 3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PrimaryAction({ onPress, light, disabled }: { onPress: () => void; light: boolean; disabled: boolean }) {
  const { t, isRtl } = useApp();
  const scale = React.useRef(new Animated.Value(1)).current;
  const animate = (toValue: number, duration: number) => {
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: 'stretch' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('welcome.signInAccessibility')}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(0.97, 100)}
        onPressOut={() => animate(1, 120)}
        style={({ pressed }) => [
          styles.primary,
          {
            backgroundColor: light ? '#10171C' : '#F4F7F9',
            opacity: disabled ? 0.72 : pressed ? 0.9 : 1,
            flexDirection: isRtl ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Text style={[styles.primaryText, { color: light ? '#FFFFFF' : '#070A0C', writingDirection: isRtl ? 'rtl' : 'ltr', paddingLeft: isRtl ? 0 : 34, paddingRight: isRtl ? 34 : 0 }]}>{t('welcome.memberSignIn')}</Text>
        <View style={[styles.arrowCircle, { backgroundColor: light ? '#FFFFFF' : '#12191E', transform: [{ scaleX: isRtl ? -1 : 1 }] }]}>
          <PathArrow color={light ? '#11181D' : '#FFFFFF'} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * M-02 Welcome — a one-time cinematic arrival inspired by the Astra reference.
 * Membership creation remains an in-person reception flow; this route only
 * hands existing members into password sign-in.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { darkMode, t, isRtl } = useApp();
  const reducedMotion = useReducedMotion();
  const [deskInfoOpen, setDeskInfoOpen] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const progress = React.useRef(new Animated.Value(0)).current;
  const exitProgress = React.useRef(new Animated.Value(0)).current;
  const light = !darkMode;
  const stageWidth = Math.max(280, Math.min(width, 390) - 40);
  const compact = Math.min(height, 844) < 720;
  const stageHeight = compact ? 180 : 232;

  React.useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      setReady(true);
      return;
    }
    progress.setValue(0);
    setReady(false);
    const animation = Animated.sequence([
      Animated.delay(640),
      Animated.timing(progress, {
        toValue: 1,
        duration: 720,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setReady(true);
    });
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const enter = React.useCallback(() => {
    if (exiting) return;
    if (reducedMotion) {
      router.push('/signin');
      return;
    }
    setExiting(true);
    Animated.timing(exitProgress, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) {
        router.push('/signin');
      } else {
        setExiting(false);
      }
    });
  }, [exitProgress, exiting, reducedMotion, router]);

  const introOpacity = progress.interpolate({ inputRange: [0, 0.34, 0.64, 1], outputRange: [1, 1, 0, 0] });
  const introScale = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 0.72] });
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.48, 0.78, 1], outputRange: [0, 0, 1, 1] });
  const contentTranslate = progress.interpolate({ inputRange: [0, 0.52, 1], outputRange: [18, 18, 0] });
  const exitOpacity = exitProgress.interpolate({ inputRange: [0, 0.58, 1], outputRange: [1, 0.32, 0] });

  return (
    <View style={[styles.wrap, { backgroundColor: light ? '#EDF1F3' : '#020304' }]}>
      <StarField light={light} />

      <Animated.View
        style={[
          styles.scene,
          {
            paddingTop: Math.max(insets.top, compact ? 8 : 16),
            opacity: exitOpacity,
            transform: [{ scale: exitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) }],
          },
        ]}
      >
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Animated.View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.intro, { opacity: introOpacity, transform: [{ scale: introScale }] }]}
          >
            <ChromeMark light={light} />
          </Animated.View>

          <Animated.View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.constellation,
              compact && styles.constellationCompact,
              { width: stageWidth, opacity: contentOpacity, transform: [{ translateY: contentTranslate }] },
            ]}
          >
            {CHARMS.map((spec) => (
              <WorkoutCharm
                key={spec.kind}
                spec={spec}
                stageWidth={stageWidth}
                stageHeight={stageHeight}
                light={light}
                reducedMotion={reducedMotion}
              />
            ))}
            <View style={styles.orbAnchor}>
              <LiquidOrb progress={progress} light={light} />
            </View>
          </Animated.View>

          <Animated.View style={[styles.copy, compact && styles.copyCompact, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}> 
            <Text selectable style={[styles.eyebrow, { color: light ? '#60717E' : '#81929E' }]}>YOUR MEMBERSHIP, IN MOTION</Text>
            <Text selectable style={[styles.title, compact && styles.titleCompact, { color: light ? '#11191F' : '#F4F7F9' }]}>Train. Arrive. Belong.</Text>
            <Text selectable style={[styles.lede, { color: light ? '#596A76' : '#94A3AD' }]}>Your pass, visits, and membership — ready before you reach reception.</Text>
          </Animated.View>
        </View>

        <Animated.View
          accessibilityElementsHidden={!ready}
          importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.actions,
            {
              pointerEvents: ready ? 'auto' : 'none',
              paddingBottom: Math.max(insets.bottom, compact ? 28 : 12),
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          <PrimaryAction onPress={enter} light={light} disabled={!ready || exiting} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Learn how to join Meridian"
            hitSlop={6}
            onPress={() => setDeskInfoOpen(true)}
            style={({ pressed }) => [styles.receptionAction, { opacity: pressed ? 0.55 : 1 }]}
          >
            <Text style={[styles.receptionText, { color: light ? '#E7EEF2' : '#82929C' }]}>New member? Join at reception</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>

      <GlassHorizon light={light} exitProgress={exitProgress} />

      <Sheet
        visible={deskInfoOpen}
        onClose={() => setDeskInfoOpen(false)}
        title="Membership at the desk"
        desc="Meridian is a private athletic club. Memberships are created in person at reception, then activated from a secure email invitation."
      >
        <View style={styles.sheetContent}>
          <View style={[styles.infoBox, { backgroundColor: light ? '#FFFFFF' : '#12181D', borderColor: light ? 'rgba(18,30,38,0.1)' : 'rgba(255,255,255,0.1)' }]}>
            <Text selectable style={[styles.infoTitle, { color: light ? '#11191F' : '#F4F7F9' }]}>{CLUB.name}</Text>
            <Text selectable style={[styles.infoLine, { color: light ? '#4F616D' : '#A6B4BC' }]}>{CLUB.address}, {CLUB.city}</Text>
            <Text selectable style={[styles.infoLine, styles.mono, { color: light ? '#6A7A84' : '#7F919D' }]}>Reception: {CLUB.phone}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeskInfoOpen(false)}
            style={({ pressed }) => [styles.sheetButton, { backgroundColor: light ? '#11191F' : '#F4F7F9', opacity: pressed ? 0.78 : 1 }]}
          >
            <Text style={[styles.sheetButtonText, { color: light ? '#FFFFFF' : '#080B0D' }]}>Close details</Text>
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  noPointerEvents: { pointerEvents: 'none' },
  scene: { zIndex: 2, flex: 1, paddingHorizontal: 20 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  heroCompact: { paddingTop: 0 },
  star: { position: 'absolute', borderRadius: 4 },
  intro: { position: 'absolute', top: '23%', alignItems: 'center' },
  chromeMark: { alignItems: 'center' },
  brandName: { marginTop: 12, fontFamily: typography.display, fontSize: 18, lineHeight: 20, fontWeight: '600', letterSpacing: 18 * 0.18, paddingLeft: 18 * 0.18 },
  brandSub: { marginTop: 7, fontFamily: typography.fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 11 * 0.14, paddingLeft: 11 * 0.14 },
  constellation: { height: 246, marginTop: -76, position: 'relative' },
  constellationCompact: { height: 188, marginTop: -12 },
  orbAnchor: { position: 'absolute', left: '50%', top: 104, width: 72, height: 72, marginLeft: -36 },
  orb: { width: 72, height: 72 },
  charm: { pointerEvents: 'none', position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  charmHighlight: { position: 'absolute', top: 3, left: 5, right: 5, height: '46%', borderTopWidth: 1, borderRadius: 999, opacity: 0.7 },
  charmCopy: { alignItems: 'center', justifyContent: 'center' },
  charmStrong: { fontFamily: typography.mono, fontSize: 11, lineHeight: 13, fontWeight: '600', letterSpacing: 0.2 },
  charmSmall: { marginTop: 2, fontFamily: typography.fontFamily, fontSize: 7, lineHeight: 9, fontWeight: '600', letterSpacing: 0.7 },
  copy: { alignItems: 'center', marginTop: 16, maxWidth: 330 },
  copyCompact: { marginTop: 4 },
  eyebrow: { fontFamily: typography.fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 11 * 0.13, textAlign: 'center' },
  title: { marginTop: 12, fontFamily: typography.display, fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: 30 * -0.028, textAlign: 'center' },
  titleCompact: { fontSize: 26, lineHeight: 30, letterSpacing: 26 * -0.028 },
  lede: { marginTop: 10, maxWidth: 292, fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 20, fontWeight: '400', letterSpacing: 13 * 0.01, textAlign: 'center' },
  actions: { gap: 4, alignSelf: 'stretch' },
  primary: { minHeight: 54, borderRadius: 999, paddingLeft: 22, paddingRight: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryText: { flex: 1, textAlign: 'center', paddingLeft: 34, fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
  arrowCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  receptionAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  receptionText: { fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '500', letterSpacing: 13 * 0.01 },
  horizon: { zIndex: 1, position: 'absolute', left: '50%', bottom: -174, width: 620, height: 310, marginLeft: -310 },
  sheetContent: { width: '100%', alignSelf: 'stretch', gap: 14, marginTop: 12 },
  infoBox: { width: '100%', padding: 16, borderRadius: 14, borderWidth: 1, gap: 5 },
  infoTitle: { fontFamily: typography.display, fontSize: 18, lineHeight: 22, fontWeight: '600' },
  infoLine: { fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: 13 * 0.01 },
  mono: { marginTop: 3, fontFamily: typography.mono },
  sheetButton: { width: '100%', alignSelf: 'stretch', minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetButtonText: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
