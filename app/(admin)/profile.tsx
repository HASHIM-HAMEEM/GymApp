import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button, TextButton } from '@/components/Button';
import { Monogram, SectionLabel, Tag } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Overlays';
import { DeveloperCredit, PreferencesGroup } from '@/components/SettingsSection';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';
import { useClub, useUpdateAdminProfile, useUpdateClub } from '@/data/api/queries';
import { ApiCallError } from '@/data/api/queries';

type ClubHours = { label: string; value: string };

export default function AdminProfile() {
  const router = useRouter();
  const { profile, adminName, adminInitials, signOut, darkMode, authError, clearAuthError, isRtl, t } = useApp();
  const clubQuery = useClub();
  const updateAdminProfile = useUpdateAdminProfile();
  const updateClub = useUpdateClub();
  const c = useColors(darkMode);
  const club = clubQuery.data;

  const [accountOpen, setAccountOpen] = React.useState(false);
  const [clubOpen, setClubOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

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
      <AppBar title={t('settings.title')} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>

          {authError ? (
            <Text style={{ color: c.bad, fontSize: 13, letterSpacing: tracking.small, lineHeight: 19 }}>{authError}</Text>
          ) : null}

          <View style={[styles.head, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Monogram text={adminInitials || '··'} size={56} fontSize={18} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{adminName || 'Front desk'}</Text>
              <Text style={[styles.sub, { color: c.ink3, fontFamily: typography.mono }]}>
                Front desk · Reception {profile?.reception ?? 'A'}
              </Text>
            </View>
            <Tag variant="accent">Admin</Tag>
          </View>

          <View>
            <SectionLabel>{t('settings.yourAccount')}</SectionLabel>
            <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
              <Row icon="user" title={t('settings.displayName')} sub={adminName || t('settings.frontDesk')} onPress={() => setAccountOpen(true)} c={c} />
              <Row icon="pin" title={t('settings.reception')} sub={t('settings.desk', { desk: profile?.reception ?? 'A' })} onPress={() => setAccountOpen(true)} c={c} last />
            </View>
            <Text style={[styles.hint, { color: c.ink4 }]}>
              {t('admin.accountHint')}
            </Text>
          </View>

          <View>
            <View style={styles.sectionHead}>
              <SectionLabel>{t('settings.clubDetails')}</SectionLabel>
              <TextButton onPress={() => setClubOpen(true)}>{t('settings.edit')}</TextButton>
            </View>
            <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
              <Row icon="pin" title={club.name} sub={`${club.address}, ${club.city}`} c={c} />
              <Row
                icon="clock"
                title={`Mon–Thu ${club.hours[0]?.value ?? ''}`}
                sub={`Fri ${club.hours[1]?.value ?? ''} · Sat ${club.hours[2]?.value ?? ''}`}
                c={c}
              />
              <Row
                icon="phone"
                title={club.phone}
                sub="Front desk"
                right={
                  <Button size="sm" variant="secondary" onPress={() => void Linking.openURL(`tel:${club.phone}`)}>
                    {t('settings.call')}
                  </Button>
                }
                c={c}
                last
              />
            </View>
            <Text style={[styles.hint, { color: c.ink4 }]}>
              {t('admin.clubHint')}
            </Text>
          </View>

          <View>
            <SectionLabel>{t('settings.preferences')}</SectionLabel>
            <PreferencesGroup onSignOut={() => void handleSignOut()} signingOut={signingOut} />
          </View>

          <DeveloperCredit />
        </Body>
      </ScrollView>

      <AccountSheet
        visible={accountOpen}
        onClose={() => setAccountOpen(false)}
        displayName={adminName || 'Front desk'}
        reception={(profile?.reception ?? 'A') as 'A' | 'B'}
        saving={updateAdminProfile.isPending}
        onSave={async (displayName, reception) => {
          try {
            await updateAdminProfile.mutateAsync({ displayName, reception });
            setAccountOpen(false);
          } catch {
            /* banner shown inside sheet */
          }
        }}
      />

      <ClubSheet
        visible={clubOpen}
        onClose={() => setClubOpen(false)}
        club={club}
        hours={club.hours}
        saving={updateClub.isPending}
        onSave={async (details) => {
          try {
            await updateClub.mutateAsync(details);
            setClubOpen(false);
          } catch {
            /* banner shown inside sheet */
          }
        }}
      />
    </View>
  );
}

function AccountSheet({
  visible,
  onClose,
  displayName,
  reception,
  saving,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  displayName: string;
  reception: 'A' | 'B';
  saving: boolean;
  onSave: (displayName: string, reception: 'A' | 'B') => Promise<void>;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const [name, setName] = React.useState(displayName);
  const [desk, setDesk] = React.useState<'A' | 'B'>(reception);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setName(displayName);
      setDesk(reception);
      setError(null);
    }
  }, [visible, displayName, reception]);

  const save = async () => {
    if (!name.trim()) {
      setError('Display name is required — it appears on receipts.');
      return;
    }
    setError(null);
    await onSave(name.trim(), desk);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Your account"
      desc="Update how your name appears to members and which desk you work."
    >
      <View style={{ gap: 14, marginTop: 12 }}>
        {error ? <Banner variant="error">{error}</Banner> : null}
        <Field label="Display name">
          <Control value={name} onChangeText={setName} placeholder="e.g. Sarah Kamal" />
        </Field>
        <Field label="Reception desk">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['A', 'B'] as const).map((desk_) => {
              const on = desk_ === desk;
              return (
                <Pressable
                  key={desk_}
                  onPress={() => setDesk(desk_)}
                  style={[
                    styles.deskOption,
                    { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.bg1 },
                  ]}
                >
                  <Text style={{ color: on ? c.accentHi : c.ink2, fontWeight: '600' }}>Desk {desk_}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <Button block loading={saving} onPress={save}>Save Changes</Button>
        <Button variant="quiet" block onPress={onClose}>Cancel</Button>
      </View>
    </Sheet>
  );
}

function ClubSheet({
  visible,
  onClose,
  club,
  hours,
  saving,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  club: { name: string; address: string; city: string; phone: string };
  hours: ClubHours[];
  saving: boolean;
  onSave: (details: {
    name: string;
    address: string;
    city: string;
    phone: string;
    monThuHours: string;
    friHours: string;
    satHours: string;
  }) => Promise<void>;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const [name, setName] = React.useState(club.name);
  const [address, setAddress] = React.useState(club.address);
  const [city, setCity] = React.useState(club.city);
  const [phone, setPhone] = React.useState(club.phone);
  const [monThu, setMonThu] = React.useState(hours[0]?.value ?? '');
  const [fri, setFri] = React.useState(hours[1]?.value ?? '');
  const [sat, setSat] = React.useState(hours[2]?.value ?? '');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setName(club.name);
      setAddress(club.address);
      setCity(club.city);
      setPhone(club.phone);
      setMonThu(hours[0]?.value ?? '');
      setFri(hours[1]?.value ?? '');
      setSat(hours[2]?.value ?? '');
      setError(null);
    }
  }, [visible, club.name, club.address, club.city, club.phone, hours]);

  const save = async () => {
    let bad: string | null = null;
    if (!name.trim()) bad = 'Club name is required.';
    else if (!address.trim()) bad = 'Club address is required.';
    else if (!city.trim()) bad = 'City is required.';
    else if (phone.replace(/\D/g, '').length < 7) bad = 'Enter a valid club phone number.';
    else if (!monThu.trim() || !fri.trim() || !sat.trim()) bad = 'Fill in all three opening-hours entries.';
    if (bad) {
      setError(bad);
      return;
    }
    setError(null);
    await onSave({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: phone.trim(),
      monThuHours: monThu.trim(),
      friHours: fri.trim(),
      satHours: sat.trim(),
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Club details"
      desc="These details appear across the member app — membership screens, notices, and the reception card."
    >
      <View style={{ gap: 14, marginTop: 12 }}>
        {error ? <Banner variant="error">{error}</Banner> : null}
        <Field label="Club name">
          <Control value={name} onChangeText={setName} placeholder="Apex Athletic Club" />
        </Field>
        <Field label="Address">
          <Control value={address} onChangeText={setAddress} placeholder="Street, area" />
        </Field>
        <Field label="City">
          <Control value={city} onChangeText={setCity} placeholder="Mumbai" />
        </Field>
        <Field label="Front desk phone" hint="Members see this on notices and membership screens.">
          <Control value={phone} onChangeText={setPhone} inputMode="tel" placeholder="+91 22 2619 4400" />
        </Field>
        <Field label="Opening hours" hint="One entry per line: Mon–Thu, Fri, Sat.">
          <Control value={monThu} onChangeText={setMonThu} placeholder="Mon–Thu · e.g. 6 AM–11 PM" />
          <View style={{ height: 10 }} />
          <Control value={fri} onChangeText={setFri} placeholder="Fri · e.g. 7 AM–9 PM" />
          <View style={{ height: 10 }} />
          <Control value={sat} onChangeText={setSat} placeholder="Sat · e.g. 6 AM–10 PM" />
        </Field>
        <Button block loading={saving} onPress={save}>Save Changes</Button>
        <Button variant="quiet" block onPress={onClose}>Cancel</Button>
      </View>
    </Sheet>
  );
}

function Row({
  icon,
  title,
  sub,
  right,
  onPress,
  c,
  last,
}: {
  icon: any;
  title: string;
  sub: string;
  right?: React.ReactNode;
  onPress?: () => void;
  c: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.row, { borderColor: c.line }, last && { borderBottomWidth: 0 }]}>
      <Icon name={icon} size={19} color={c.ink3} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowSub, { color: c.ink3 }]}>{sub}</Text>
      </View>
      {right}
      {onPress && !right ? <Icon name="chev" size={16} color={c.ink4} /> : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 2,
  },
  name: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    marginTop: 3,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  hint: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    letterSpacing: tracking.small,
    lineHeight: 16,
    marginTop: 8,
    paddingLeft: 3,
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    marginTop: 2,
  },
  deskOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  version: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    letterSpacing: tracking.small,
    textAlign: 'center',
    marginTop: 12,
  },
});
