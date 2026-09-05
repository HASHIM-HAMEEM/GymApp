import * as React from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { Sheet } from '@/components/Overlays';
import { useClub } from '@/data/api/queries';
import { useApp } from '@/data/store';
import { typography } from '@/theme/tokens';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { WelcomeArtwork } from '@/components/WelcomeArtwork';


const STARS = [
  [8, 13, 1], [18, 28, 1.4], [29, 8, 1], [42, 19, 0.8], [53, 6, 1.2],
  [67, 17, 0.8], [81, 9, 1.4], [91, 25, 0.9], [12, 54, 0.9], [24, 72, 1.3],
  [38, 61, 0.8], [49, 83, 1], [63, 70, 1.2], [77, 56, 0.8], [89, 78, 1.4],
  [5, 91, 1.1], [33, 94, 0.8], [71, 92, 0.9], [96, 63, 0.8],
] as const;

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
          <LinearGradient id="chrome" gradientUnits="userSpaceOnUse" x1="18" y1="9" x2="75" y2="82">
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
      <Text style={[styles.brandName, { color: light ? '#18242D' : '#EDF5FA' }]}>APEX</Text>
      <Text style={[styles.brandSub, { color: light ? '#63727D' : '#8294A0', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.athleticClub')}</Text>
    </View>
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
      <Svg width="100%" height="100%" viewBox="0 0 620 310" preserveAspectRatio="none" fill="none">
        <Defs>
          <RadialGradient id="planet" cx="50%" cy="10%" r="76%">
            <Stop offset="0" stopColor={light ? '#FFFFFF' : '#65839A'} stopOpacity={light ? 0.86 : 0.82} />
            <Stop offset="0.28" stopColor={light ? '#BCCAD3' : '#293D4C'} stopOpacity="0.74" />
            <Stop offset="0.67" stopColor={light ? '#6E8494' : '#101E29'} stopOpacity="0.94" />
            <Stop offset="1" stopColor={light ? '#2B3B47' : '#05090D'} stopOpacity="1" />
          </RadialGradient>
          <LinearGradient id="rim" gradientUnits="userSpaceOnUse" x1="80" y1="12" x2="530" y2="70">
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

function PrimaryAction({ onPress, light, disabled, reducedMotion }: { onPress: () => void; light: boolean; disabled: boolean; reducedMotion: boolean }) {
  const { t, isRtl } = useApp();
  const scale = React.useRef(new Animated.Value(1)).current;
  const animate = (toValue: number, duration: number) => {
    if (reducedMotion) return;
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
  const { width, height, fontScale } = useWindowDimensions();
  const { darkMode, t, isRtl } = useApp();
  const clubQuery = useClub();
  const reducedMotion = useReducedMotion();
  const [deskInfoOpen, setDeskInfoOpen] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [replay, setReplay] = React.useState(0);
  const [available, setAvailable] = React.useState({ width: Math.min(width, 390), height });
  const navigationLocked = React.useRef(false);
  const introPlayed = React.useRef(false);
  const progress = React.useRef(new Animated.Value(0)).current;
  const exitProgress = React.useRef(new Animated.Value(0)).current;
  const light = !darkMode;
  const club = clubQuery.data;
  const compact = available.height < 620 || fontScale > 1.2;
  const stageWidth = Math.max(180, Math.min(340, available.width - 48, compact ? 270 : 340));

  useFocusEffect(React.useCallback(() => {
    navigationLocked.current = false;
    exitProgress.setValue(0);
    setExiting(false);
    if (introPlayed.current) {
      progress.setValue(1);
      setReady(true);
    }
    return () => {
      exitProgress.stopAnimation();
      progress.stopAnimation();
      introPlayed.current = true;
    };
  }, [exitProgress, progress]));

  React.useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      setReady(true);
      return;
    }
    progress.setValue(0);
    setReady(false);
    const animation = Animated.sequence([
      Animated.delay(320),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1650,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setReady(true);
    });
    return () => animation.stop();
  }, [progress, reducedMotion, replay]);

  const enter = React.useCallback(() => {
    if (navigationLocked.current || !ready) return;
    navigationLocked.current = true;
    setExiting(true);
    if (reducedMotion) {
      router.push('/signin');
      return;
    }
    Animated.timing(exitProgress, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) {
        router.push('/signin');
      } else {
        navigationLocked.current = false;
        setExiting(false);
      }
    });
  }, [exitProgress, ready, reducedMotion, router]);

  const introOpacity = progress.interpolate({ inputRange: [0, 0.03, 0.15, 1], outputRange: [1, 1, 0, 0] });
  const introScale = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0.96, 0.96] });
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.12, 0.32, 1], outputRange: [0, 0, 1, 1] });
  const contentTranslate = progress.interpolate({ inputRange: [0, 0.12, 0.32, 1], outputRange: [12, 12, 0, 0] });
  const exitOpacity = exitProgress.interpolate({ inputRange: [0, 0.58, 1], outputRange: [1, 0.32, 0] });

  return (
    <View onLayout={(event) => setAvailable(event.nativeEvent.layout)} style={[styles.wrap, { backgroundColor: light ? '#EDF1F3' : '#020304' }]}>
      <StarField light={light} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} style={{ zIndex: 2 }}>
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
            style={[
              { marginBottom: compact ? 16 : 28 },
            ]}
          >
            <WelcomeArtwork progress={progress} width={stageWidth} light={light} onReplay={() => { if (ready && !exiting && !reducedMotion) setReplay((value) => value + 1); }} replayLabel={isRtl ? 'حرکت دوبارہ چلائیں' : 'Replay the motion'} />
          </Animated.View>

          <Animated.View style={[styles.copy, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}>
            <Text selectable style={[styles.eyebrow, { color: light ? '#536773' : '#9BAEBB' }]}>{t('welcome.eyebrow')}</Text>
            <Text selectable accessibilityRole="header" style={[styles.title, compact && styles.titleCompact, { color: light ? '#11191F' : '#F4F7F9', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.title')}</Text>
            <Text selectable style={[styles.lede, { color: light ? '#596A76' : '#AAB7BF', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.lede')}</Text>
          </Animated.View>
        </View>

        <Animated.View
          accessibilityElementsHidden={!ready}
          importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.actions,
            {
              pointerEvents: ready ? 'auto' : 'none',
              paddingBottom: Math.max(insets.bottom, 20),
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          <PrimaryAction onPress={enter} light={light} disabled={!ready || exiting} reducedMotion={reducedMotion} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('welcome.joinAccessibility')}
            disabled={!ready || exiting}
            hitSlop={6}
            onPress={() => setDeskInfoOpen(true)}
            style={({ pressed }) => [styles.receptionAction, { opacity: pressed ? 0.55 : 1 }]}
          >
            <Text style={[styles.receptionText, { color: light ? '#344D5E' : '#B5C3CC' }]}>{t('welcome.join')}</Text>
          </Pressable>

          {(club.address || club.city || club.phone) ? (
            <View
              style={[
                styles.clubCard,
                {
                  backgroundColor: light ? 'rgba(18,30,38,0.04)' : 'rgba(255,255,255,0.05)',
                  borderColor: light ? 'rgba(18,30,38,0.08)' : 'rgba(255,255,255,0.08)',
                  flexDirection: isRtl ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.clubCardCol, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.clubCardLabel, { color: light ? '#7A8A95' : '#7E909B', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.clubInfoTitle')}</Text>
                {club.address || club.city ? (
                  <Text selectable style={[styles.clubCardValue, { color: light ? '#2A3A47' : '#C8D5DD', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                    {t('welcome.clubLocation', { address: club.address, city: club.city })}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.clubCardCol, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                {club.hours && club.hours.length > 0 ? (
                  <>
                    <Text style={[styles.clubCardLabel, { color: light ? '#7A8A95' : '#7E909B', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.hoursLabel')}</Text>
                    {club.hours.map((h, i) => (
                      <Text key={i} selectable style={[styles.clubCardValue, { color: light ? '#2A3A47' : '#C8D5DD', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                        {h.label} · {h.value}
                      </Text>
                    ))}
                  </>
                ) : null}
              </View>
              <View style={[styles.clubCardCol, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                {club.phone ? (
                  <>
                    <Text style={[styles.clubCardLabel, { color: light ? '#7A8A95' : '#7E909B', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.phoneLabel')}</Text>
                    <Text selectable style={[styles.clubCardValue, styles.mono, { color: light ? '#2A3A47' : '#C8D5DD', writingDirection: 'ltr' }]}>{club.phone}</Text>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
      </ScrollView>

      <GlassHorizon light={light} exitProgress={exitProgress} />

      <Sheet
        visible={deskInfoOpen}
        onClose={() => setDeskInfoOpen(false)}
        title={t('welcome.sheetTitle')}
        desc={t('welcome.sheetBody')}
      >
        <View style={styles.sheetContent}>
          <View style={[styles.infoBox, { backgroundColor: light ? '#FFFFFF' : '#12181D', borderColor: light ? 'rgba(18,30,38,0.1)' : 'rgba(255,255,255,0.1)' }]}>
            <Text selectable style={[styles.infoTitle, { color: light ? '#11191F' : '#F4F7F9', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{club.name}</Text>
            {club.address || club.city ? (
              <Text selectable style={[styles.infoLine, { color: light ? '#4F616D' : '#A6B4BC', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                {t('welcome.clubLocation', { address: club.address, city: club.city })}
              </Text>
            ) : null}
            {club.phone ? (
              <Text selectable style={[styles.infoLine, styles.mono, { color: light ? '#6A7A84' : '#AABAC5', writingDirection: 'ltr' }]}>
                {t('welcome.receptionPhone', { phone: club.phone })}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeskInfoOpen(false)}
            style={({ pressed }) => [styles.sheetButton, { backgroundColor: light ? '#11191F' : '#F4F7F9', opacity: pressed ? 0.78 : 1 }]}
          >
            <Text style={[styles.sheetButtonText, { color: light ? '#FFFFFF' : '#080B0D' }]}>{t('welcome.closeDetails')}</Text>
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  noPointerEvents: { pointerEvents: 'none' },
  scene: { zIndex: 2, flexGrow: 1, paddingHorizontal: 24 },
  hero: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 28, paddingBottom: 36 },
  heroCompact: { paddingTop: 12, paddingBottom: 24 },
  star: { position: 'absolute', borderRadius: 4 },
  intro: { position: 'absolute', top: '23%', alignItems: 'center' },
  chromeMark: { alignItems: 'center' },
  brandName: { marginTop: 12, fontFamily: typography.display, fontSize: 18, lineHeight: 20, fontWeight: '600', letterSpacing: 18 * 0.18, paddingLeft: 18 * 0.18 },
  brandSub: { marginTop: 7, fontFamily: typography.fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 11 * 0.14, paddingLeft: 11 * 0.14 },
  copy: { alignItems: 'center', marginTop: 16, maxWidth: 330 },
  eyebrow: { fontFamily: typography.fontFamily, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 11 * 0.1, textTransform: 'uppercase', textAlign: 'center' },
  title: { marginTop: 12, fontFamily: typography.display, fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: 30 * -0.028, textAlign: 'center' },
  titleCompact: { fontSize: 26, lineHeight: 30, letterSpacing: 26 * -0.028 },
  lede: { marginTop: 10, maxWidth: 292, fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 20, fontWeight: '400', letterSpacing: 13 * 0.01, textAlign: 'center' },
  actions: { gap: 4, alignSelf: 'stretch' },
  primary: { minHeight: 56, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryText: { flex: 1, textAlign: 'center', paddingLeft: 34, fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
  arrowCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  receptionAction: { minHeight: 44, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  receptionText: { fontFamily: typography.fontFamily, textAlign: 'center', fontSize: 13, lineHeight: 20, fontWeight: '500', letterSpacing: 13 * 0.01 },
  clubCard: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, gap: 14, flexWrap: 'wrap' },
  clubCardCol: { flex: 1, minWidth: 120, gap: 4 },
  clubCardLabel: { fontFamily: typography.fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 11 * 0.12, textTransform: 'uppercase' },
  clubCardValue: { fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 19, fontWeight: '400', letterSpacing: 13 * 0.01 },
  horizon: { zIndex: 1, opacity: 0.3, position: 'absolute', left: '50%', bottom: -180, width: 620, height: 310, marginLeft: -310 },
  sheetContent: { width: '100%', alignSelf: 'stretch', gap: 14, marginTop: 12 },
  infoBox: { width: '100%', padding: 16, borderRadius: 14, borderWidth: 1, gap: 5 },
  infoTitle: { fontFamily: typography.display, fontSize: 18, lineHeight: 22, fontWeight: '600' },
  infoLine: { fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: 13 * 0.01 },
  mono: { marginTop: 3, fontFamily: typography.mono },
  sheetButton: { width: '100%', alignSelf: 'stretch', minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetButtonText: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
