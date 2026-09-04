import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Body } from '@/components/Chrome';
import { Icon, type IconName } from '@/components/Icon';
import { useClub } from '@/data/api/queries';
import { CLUB } from '@/data/plans';
import { useApp } from '@/providers/AppProvider';
import { radius, typography, useColors } from '@/theme/tokens';

export default function PrivacyScreen() {
  const router = useRouter();
  const { darkMode, isRtl, t } = useApp();
  const c = useColors(darkMode);
  const clubQuery = useClub();
  const phone = clubQuery.data?.phone ?? CLUB.phone;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('privacy.title')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <Body style={{ gap: 16 }}>
          <View style={[styles.promise, { backgroundColor: c.accentSoft, borderColor: c.line2 }]}>
            <Icon name="shield" size={24} color={c.accentHi} />
            <Text style={[styles.promiseText, { color: c.ink, textAlign: isRtl ? 'right' : 'left' }]}>
              {t('privacy.promise')}
            </Text>
          </View>

          <Text style={[styles.intro, { color: c.ink2, textAlign: isRtl ? 'right' : 'left' }]}>
            {t('privacy.intro')}
          </Text>

          <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
            <PrivacyRow icon="user" title={t('privacy.keptTitle')} body={t('privacy.keptBody')} />
            <PrivacyRow icon="check" title={t('privacy.useTitle')} body={t('privacy.useBody')} />
            <PrivacyRow icon="shield" title={t('privacy.protectionTitle')} body={t('privacy.protectionBody')} />
            <PrivacyRow icon="info" title={t('privacy.controlTitle')} body={t('privacy.controlBody')} last />
          </View>

          <Text style={[styles.contact, { color: c.ink3, textAlign: isRtl ? 'right' : 'left' }]}>
            {t('privacy.contact', { phone })}
          </Text>
        </Body>
      </ScrollView>
    </View>
  );
}

function PrivacyRow({ icon, title, body, last }: { icon: IconName; title: string; body: string; last?: boolean }) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  return (
    <View
      style={[
        styles.row,
        { borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
        last && { borderBottomWidth: 0 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: c.bg2 }]}>
        <Icon name={icon} size={19} color={c.ink2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.ink, textAlign: isRtl ? 'right' : 'left' }]}>{title}</Text>
        <Text style={[styles.body, { color: c.ink3, textAlign: isRtl ? 'right' : 'left' }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  promise: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  promiseText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  intro: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 22,
  },
  list: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    padding: 16,
    borderBottomWidth: 1,
    gap: 13,
    alignItems: 'flex-start',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },
  contact: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});
