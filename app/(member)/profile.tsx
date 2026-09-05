import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { TextButton } from '@/components/Button';
import { Monogram } from '@/components/Tag';
import { DeveloperCredit, PreferencesGroup } from '@/components/SettingsSection';
import { useApp } from '@/providers/AppProvider';
import { useCurrentMember } from '@/data/api/queries';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, darkMode, authError, clearAuthError, isRtl, t } = useApp();
  const memberQuery = useCurrentMember();
  const c = useColors(darkMode);
  const m = memberQuery.data ?? null;
  const [signingOut, setSigningOut] = React.useState(false);

  const initials = m ? `${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase() : '··';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/welcome');
    } catch {
      clearAuthError();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title={t('profile.title')}
        right={<TextButton onPress={() => router.push('/edit-profile')}>{t('settings.edit')}</TextButton>}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Body style={{ gap: 16 }}>
          {authError ? (
            <Text style={{ color: c.bad, fontSize: 13, letterSpacing: tracking.small, lineHeight: 19 }}>{authError}</Text>
          ) : null}

          <View style={[styles.head, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Monogram text={initials} size={62} fontSize={18} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.ink, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                {m ? `${m.firstName} ${m.lastName}` : t('common.loading')}
              </Text>
              <Text style={[styles.sub, { color: c.ink3, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                {m ? `${m.id} · ${t('profile.joined', { date: m.memberSince })}` : ''}
              </Text>
            </View>
          </View>

          <View style={[styles.list, { borderColor: c.line, backgroundColor: c.bg1 }]}>
            <ProfileRow label={t('profile.email')} value={m?.email ?? ''} />
            <ProfileRow label={t('profile.phone')} value={m?.phone || '—'} />
            <ProfileRow label={t('profile.dateOfBirth')} value={m?.dateOfBirth || '—'} />
            {m?.emergencyName ? (
              <ProfileRow label={t('profile.emergency')} value={`${m.emergencyName} · ${m.emergencyPhone ?? ''}`} />
            ) : null}
            <ProfileRow label={t('profile.address')} value={m?.address || '—'} last />
          </View>

          <PreferencesGroup onSignOut={() => void handleSignOut()} signingOut={signingOut} />
          <DeveloperCredit />
        </Body>
      </ScrollView>
    </View>
  );
}

function ProfileRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  return (
    <View
      style={[
        styles.profileRow,
        { borderBottomWidth: last ? 0 : 1, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
      ]}
    >
      <Text style={[styles.key, { color: c.ink3, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{label}</Text>
      <Text style={[styles.value, { color: c.ink, textAlign: isRtl ? 'left' : 'right', writingDirection: isRtl ? 'rtl' : 'ltr' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: 'center',
    gap: 16,
    padding: 6,
  },
  name: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '600',
  },
  sub: {
    fontFamily: typography.mono,
    fontSize: 13,
    letterSpacing: tracking.small,
    marginTop: 5,
  },
  list: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  profileRow: {
    minHeight: 52,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  key: {
    width: 105,
    flexShrink: 0,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  value: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '500',
  },
});
