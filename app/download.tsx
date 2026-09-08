import * as React from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, spacing, typography, tracking, radius } from '@/theme/tokens';
import { useApp } from '@/data/store';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/Icon';

const APK_URL = '/apex.apk';

export default function DownloadScreen() {
  const { t, isRtl, darkMode } = useApp();
  const c = useColors(darkMode);
  const insets = useSafeAreaInsets();
  const textDir = isRtl ? 'rtl' : 'ltr';

  const download = () => {
    void Linking.openURL(APK_URL);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg, paddingTop: Math.max(insets.top, 24) }]}>
      <View style={[styles.hero, { direction: textDir }]}>
        <Logo size={44} color={c.ink} strokeWidth={2.2} />
        <Text style={[styles.brand, { color: c.ink }]}>APEX</Text>
        <Text style={[styles.tagline, { color: c.ink3, writingDirection: textDir }]}>
          {t('welcome.athleticClub')}
        </Text>
      </View>

      <View style={[styles.body, { direction: textDir }]}>
        <Text style={[styles.title, { color: c.ink, writingDirection: textDir }]}>
          {t('download.title')}
        </Text>
        <Text style={[styles.desc, { color: c.ink3, writingDirection: textDir }]}>
          {t('download.desc')}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('download.androidButton')}
          onPress={download}
          style={({ pressed }) => [
            styles.downloadButton,
            { backgroundColor: c.ink, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Icon name="download" size={20} color={c.bg} />
          <Text style={[styles.downloadButtonText, { color: c.bg }]}>
            {t('download.androidButton')}
          </Text>
        </Pressable>

        <View style={[styles.steps, { borderColor: c.line, backgroundColor: c.bg1 }]}>
          <Text style={[styles.stepsTitle, { color: c.ink2, writingDirection: textDir }]}>
            {t('download.stepsTitle')}
          </Text>
          {['download.step1', 'download.step2', 'download.step3'].map((key, i) => (
            <View key={key} style={[styles.step, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <View style={[styles.stepNumber, { backgroundColor: c.ink3 }]}>
                <Text style={[styles.stepNumberText, { color: c.bg }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: c.ink3, writingDirection: textDir, flex: 1 }]}>
                {t(key as never)}
              </Text>
            </View>
          ))}
        </View>

        {Platform.OS === 'web' ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL('/welcome')}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 24, alignSelf: 'center' })}
          >
            <Text style={[styles.webLink, { color: c.ink3, writingDirection: textDir }]}>
              {t('download.useWeb')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 40, paddingBottom: 28, gap: 8 },
  brand: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 26 * 0.18,
    paddingLeft: 26 * 0.18,
  },
  tagline: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.14,
    textTransform: 'uppercase',
  },
  body: { paddingHorizontal: 24, gap: 18 },
  title: {
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  desc: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 20,
  },
  downloadButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  downloadButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.01,
  },
  steps: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
    gap: 14,
    marginTop: 6,
  },
  stepsTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.12,
    textTransform: 'uppercase',
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  stepText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
    paddingTop: 1,
  },
  webLink: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    textDecorationLine: 'underline',
  },
});
