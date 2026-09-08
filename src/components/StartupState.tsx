import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LaunchBrand } from '@/components/LaunchBrand';
import { Banner } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { useApp } from '@/providers/AppProvider';
import { typography, useColors } from '@/theme/tokens';

export function StartupState({ onReady }: { onReady?: () => void }) {
  const { darkMode, isOnline, startupTimedOut, startupError, retryStartup, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const [retrying, setRetrying] = React.useState(false);
  return (
    <View onLayout={onReady} style={[styles.wrap, { backgroundColor: c.bg }]}> 
      <LaunchBrand subtitle={t('welcome.athleticClub')} isRtl={isRtl} light={!darkMode} />
      <Text style={[styles.text, { color: c.ink3 }]}>Opening Apex…</Text>
      {!isOnline ? <Banner variant="offline" style={styles.banner}>No internet connection. Reconnect, then try again.</Banner> : null}
      {startupTimedOut || startupError || !isOnline ? (
        <View style={styles.retry}>
          <Banner variant="warn">Apex is taking longer than expected. Your session is safe.</Banner>
          <Button variant="secondary" block loading={retrying} onPress={() => { setRetrying(true); void retryStartup().catch(() => undefined).finally(() => setRetrying(false)); }}>Try again</Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  text: { fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 18 },
  banner: { width: '100%', marginTop: 10 },
  retry: { width: '100%', gap: 12, marginTop: 4 },
});
