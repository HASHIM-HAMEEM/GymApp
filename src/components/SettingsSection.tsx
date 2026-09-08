import * as React from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, type IconName } from './Icon';
import { Switch, Sheet } from './Overlays';
import { Banner } from './Surfaces';
import { Button } from './Button';
import { radius, typography, useColors, tracking } from '@/theme/tokens';
import { useApp } from '@/providers/AppProvider';
import { notificationStateLabel } from '@/lib/notifications';
import type { Language } from '@/data/types';

export function SettingsSection({
  title,
  action,
  children,
  hint,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}> 
        <Text style={[styles.sectionTitle, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{title}</Text>
        {action}
      </View>
      {children}
      {hint ? <Text style={[styles.sectionHint, { color: c.ink4, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{hint}</Text> : null}
    </View>
  );
}

export function SettingsGroup({ children }: { children: React.ReactNode }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return <View style={[styles.group, { backgroundColor: c.bg1, borderColor: c.line }]}>{children}</View>;
}

export function SettingsRow({
  icon,
  label,
  value,
  right,
  danger,
  last,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  right?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const content = (
    <View
      style={[
        styles.row,
        { borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
        last && { borderBottomWidth: 0 },
      ]}
    >
      <Icon name={icon} size={20} color={danger ? c.bad : c.ink3} />
      <Text
        style={[
          styles.label,
          { color: danger ? c.bad : c.ink2, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' },
        ]}
      >
        {label}
      </Text>
      {value ? <Text style={[styles.value, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{value}</Text> : null}
      {right}
      {!right && !danger ? <Icon name="chev" size={17} color={c.ink3} /> : null}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>{content}</Pressable> : content;
}

export function PreferencesGroup({
  onSignOut,
  onExport,
  onPlans,
  onPaymentSetup,
  accountRows,
  clubRows,
  signingOut = false,
}: {
  onSignOut: () => void;
  onExport?: () => void;
  onPlans?: () => void;
  onPaymentSetup?: () => void;
  accountRows?: React.ReactNode;
  clubRows?: React.ReactNode;
  signingOut?: boolean;
}) {
  const router = useRouter();
  const {
    darkMode,
    toggleDarkMode,
    language,
    setLanguage,
    notificationState,
    t,
  } = useApp();
  const [languageOpen, setLanguageOpen] = React.useState(false);
  const [languageError, setLanguageError] = React.useState<string | null>(null);
  const [savingLanguage, setSavingLanguage] = React.useState(false);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const downloadUrl = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL?.trim() || 'https://apexgc.vercel.app/download';

  const shareApp = async () => {
    if (Platform.OS === 'web') {
      await Linking.openURL(downloadUrl);
      return;
    }
    await Share.share({
      title: t('settings.shareApp'),
      message: `${t('settings.shareMessage')}\n${downloadUrl}`,
      url: downloadUrl,
    });
  };

  const chooseLanguage = async (nextLanguage: Language) => {
    setLanguageError(null);
    setSavingLanguage(true);
    try {
      await setLanguage(nextLanguage);
      setLanguageOpen(false);
    } catch {
      setLanguageError('The language could not be saved. Check your connection and try again.');
    } finally {
      setSavingLanguage(false);
    }
  };

  return (
    <>
      <SettingsSection title={t('settings.accountSection')}>
        <SettingsGroup>
          {accountRows}
          <SettingsRow icon="key" label={t('settings.changePassword')} onPress={() => router.push('/change-password')} />
          <SettingsRow icon="download" label={t('settings.shareApp')} onPress={() => void shareApp()} />
          <SettingsRow
            icon="logout"
            label={signingOut ? t('common.loading') : t('settings.signOut')}
            danger
            last
            onPress={signingOut ? undefined : () => setSignOutOpen(true)}
          />
        </SettingsGroup>
      </SettingsSection>

      {onExport || onPlans || onPaymentSetup ? (
        <SettingsSection title={t('settings.clubManagement')}>
          <SettingsGroup>
            {clubRows}
            {onPlans ? <SettingsRow icon="card" label={t('settings.membershipPlans')} onPress={onPlans} /> : null}
            {onPaymentSetup ? <SettingsRow icon="receipt" label={t('settings.upiPayments')} onPress={onPaymentSetup} /> : null}
            {onExport ? <SettingsRow icon="download" label={t('settings.exportRecords')} onPress={onExport} last /> : null}
          </SettingsGroup>
        </SettingsSection>
      ) : null}

      <SettingsSection title={t('settings.appearanceLanguage')}>
        <SettingsGroup>
          <SettingsRow
            icon="moon"
            label={t('settings.darkMode')}
            value={darkMode ? t('common.on') : t('common.off')}
            right={<Switch on={darkMode} onChange={toggleDarkMode} />}
          />
          <SettingsRow
            icon="globe"
            label={t('settings.language')}
            value={language === 'ur' ? t('settings.urdu') : t('settings.english')}
            onPress={() => setLanguageOpen(true)}
            last
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={t('settings.notificationsPrivacy')}>
        <SettingsGroup>
          <SettingsRow
            icon="bell"
            label={t('notifications.title')}
            value={t(notificationStateLabel(notificationState))}
            onPress={() => router.push('/notification-settings')}
          />
          <SettingsRow icon="shield" label={t('settings.privacy')} onPress={() => router.push('/privacy')} last />
        </SettingsGroup>
      </SettingsSection>

      <Sheet
        visible={languageOpen}
        onClose={() => setLanguageOpen(false)}
        title={t('settings.languageTitle')}
        desc={t('settings.languageHint')}
      >
        <View style={styles.languageSheet}>
          {languageError ? <Banner variant="error">{languageError}</Banner> : null}
          <LanguageOption
            label="English"
            nativeLabel="English"
            selected={language === 'en'}
            disabled={savingLanguage}
            onPress={() => void chooseLanguage('en')}
          />
          <LanguageOption
            label="Urdu"
            nativeLabel="اردو"
            selected={language === 'ur'}
            disabled={savingLanguage}
            onPress={() => void chooseLanguage('ur')}
          />
          <Button variant="quiet" block disabled={savingLanguage} onPress={() => setLanguageOpen(false)}>
            {t('common.cancel')}
          </Button>
        </View>
      </Sheet>

      <Sheet
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title={t('settings.signOut')}
        desc={t('settings.signOutDisclaimer')}
      >
        <View style={styles.languageSheet}>
          <Button block loading={signingOut} onPress={() => { setSignOutOpen(false); onSignOut(); }}>
            {t('settings.signOutConfirm')}
          </Button>
          <Button variant="quiet" block disabled={signingOut} onPress={() => setSignOutOpen(false)}>
            {t('common.cancel')}
          </Button>
        </View>
      </Sheet>
    </>
  );
}

function LanguageOption({
  label,
  nativeLabel,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  nativeLabel: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.languageOption,
        { backgroundColor: selected ? c.accentSoft : c.bg1, borderColor: selected ? c.accent : c.line },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.languageLabel, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{label}</Text>
        <Text style={[styles.languageNative, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{nativeLabel}</Text>
      </View>
      {selected ? <Icon name="check" size={19} color={c.accentHi} /> : null}
    </Pressable>
  );
}

export function DeveloperCredit() {
  const { darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL('https://hashimhameem.site')}
      style={styles.credit}
    >
      <Text style={[styles.creditText, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('settings.developedBy')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    minHeight: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: tracking.caps,
    textTransform: 'uppercase',
  },
  sectionHint: {
    paddingHorizontal: 3,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: tracking.small,
  },
  group: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    minHeight: 62,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  label: {
    flex: 1,
    minWidth: 0,
    lineHeight: 22,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '500',
  },
  value: {
    flexShrink: 1,
    maxWidth: '45%',
    lineHeight: 22,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  languageSheet: {
    gap: 10,
    marginTop: 12,
  },
  languageOption: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  languageNative: {
    fontFamily: typography.arabic,
    fontSize: 13,
    letterSpacing: tracking.small,
    marginTop: 2,
  },
  credit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  creditText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    textDecorationLine: 'underline',
  },
});
