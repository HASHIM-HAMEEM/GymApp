import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { buildAdminExport } from '@/data/api/exports';
import { saveCsv } from '@/lib/saveCsv';

export default function Exports() {
  const { role, darkMode } = useApp();
  const c = useColors(darkMode);
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  if (role !== 'admin') return <Redirect href="/welcome" />;
  const generate = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const report = await buildAdminExport();
      if (!report.count) { setMessage('No member records yet.'); return; }
      await saveCsv(report.filename, report.csv);
      setMessage(`${report.count} rows prepared for saving.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <AppBar title="Export records" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <Body style={{ gap: 20 }}>
        <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 20, padding: 20, backgroundColor: c.bg1, gap: 12 }}>
          <Icon name="download" size={24} color={c.ink2} />
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '600' }}>Member report</Text>
          <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 22 }}>Members, membership terms and payments in one CSV.</Text>
          <Text style={{ color: c.ink3, fontSize: 13, lineHeight: 19 }}>One row per membership. Opens in Excel or Google Sheets.</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: c.bad, lineHeight: 21 }}>{error}</Text> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={{ color: c.ink2, lineHeight: 21 }}>{message}</Text> : null}
        <Button block loading={busy} onPress={generate}>Export member report</Button>
        <Text style={{ color: c.ink3, fontSize: 13, lineHeight: 19 }}>Contains personal records. Keep your copy secure.</Text>
      </Body>
    </ScrollView>
  </View>;
}
