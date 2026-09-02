import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { QrCode } from '@/components/QrCode';
import { Tag } from '@/components/Tag';
import { Banner } from '@/components/Surfaces';
import { Live } from '@/components/Overlays';
import { useApp } from '@/data/store';
import { statusVisual, fmtLong } from '@/data/format';

export default function QrScreen() {
  const router = useRouter();
  const { currentMember, darkMode } = useApp();
  const c = useColors(darkMode);
  if (!currentMember) return null;
  const m = currentMember;
  const ms = m.membership;
  const vis = ms ? statusVisual(ms.status, ms, c) : null;

  const qrValue = `MERIDIAN|${m.id}|${m.firstName[0]}${m.lastName[0]}|${ms?.status.toUpperCase().slice(0, 3) ?? 'NON'}`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Membership card" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.name, { color: c.ink }]}>{m.firstName} {m.lastName}</Text>
          <Text style={[styles.id, { color: c.ink3 }]}>Member ID · {m.id}</Text>
        </View>

        <View style={[styles.plate, { backgroundColor: c.bg1, borderColor: c.line }]}>
          <QrCode value={qrValue} size={220} dark={c.ink} light={c.accent} />
        </View>

        {ms && vis ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Tag variant={vis.tagVariant}>{vis.tagLabel}</Tag>
              <Text style={[styles.validity, { color: c.ink3 }]}>
                {ms.planName} · until <Text style={{ color: c.ink, fontWeight: '600' }}>{fmtLong(ms.expiryDate)}</Text>
              </Text>
            </View>
            <Live label="Live QR · refreshes with your membership" color={c.ok} />
          </View>
        ) : null}

        <Banner variant="offline">
          No scanner? Staff can find you by member ID <Text style={{ fontWeight: '700' }}>{m.id}</Text> or phone.
        </Banner>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: spacing.screen,
    paddingBottom: 40,
  },
  plate: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 22,
  },
  name: {
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  id: {
    fontFamily: typography.mono,
    fontSize: 12.5,
    marginTop: 4,
  },
  validity: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '500',
  },
});
