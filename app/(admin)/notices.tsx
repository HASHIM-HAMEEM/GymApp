import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { TextButton } from '@/components/Button';
import { useNotices } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { fmtShort } from '@/data/format';
import type { Notice } from '@/data/types';

function catColor(c: any, category: Notice['category']) {
  switch (category) {
    case 'Urgent': return c.bad;
    case 'Facilities': return c.warn;
    case 'Schedule':
    case 'Hours': return c.accentHi;
    case 'Renewal':
    default: return c.ok;
  }
}

export default function AdminNotices() {
  const router = useRouter();
  const noticesQuery = useNotices(true);
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const notices = noticesQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title="Notices"
        right={<TextButton onPress={() => router.push('/notice-compose')}>New</TextButton>}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>
          {notices.length === 0 ? (
            <Text style={{ color: c.ink3, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
              {noticesQuery.isLoading ? 'Loading notices…' : 'No notices published yet. Compose the first one.'}
            </Text>
          ) : (
            <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
              {notices.map((n, i) => {
                const color = catColor(c, n.category);
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => router.push({ pathname: '/notice', params: { id: n.id } })}
                    style={({ pressed }) => [
                      styles.nrow,
                      { borderColor: c.line },
                      i === notices.length - 1 && { borderBottomWidth: 0 },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[styles.cat, { color }]}>{n.category}</Text>
                    <View style={styles.grow}>
                      <Text style={[styles.title, { color: c.ink }]} numberOfLines={2}>{n.title}</Text>
                      <Text style={[styles.dt, { color: c.ink3 }]} numberOfLines={1}>
                        {fmtShort(n.date)} · {n.audience} · {n.delivered.toLocaleString()} delivered
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  nrow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: 'flex-start',
  },
  cat: {
    width: 62,
    flexShrink: 0,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  grow: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  dt: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
});
