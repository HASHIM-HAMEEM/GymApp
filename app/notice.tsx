import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors, radius, spacing, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { useApp } from '@/providers/AppProvider';
import { useMarkNoticeRead, useNotices } from '@/data/api/queries';
import { fmtLong } from '@/data/format';
import { CLUB } from '@/data/plans';
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

export default function NoticeDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, darkMode } = useApp();
  const noticesQuery = useNotices(role === 'admin');
  const markRead = useMarkNoticeRead();
  const c = useColors(darkMode);

  const notices = noticesQuery.data ?? [];
  const n = notices.find((x) => x.id === id);

  React.useEffect(() => {
    if (role === 'member' && n && !n.read) {
      markRead.mutate(n.id);
    }
  }, [role, n, markRead]);

  if (!n) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Notice" onBack={() => router.back()} />
        <Text style={{ color: c.ink2, padding: 20 }}>
          {noticesQuery.isLoading ? 'Loading the notice…' : 'Notice not found.'}
        </Text>
      </View>
    );
  }

  const color = catColor(c, n.category);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Notice" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 18 }}>
          <View>
            <Text style={[styles.kicker, { color }]}>{n.category}</Text>
            <Text style={[styles.title, { color: c.ink }]}>{n.title}</Text>
            <Text style={[styles.byline, { color: c.ink3 }]}>
              {n.author} · {fmtLong(n.date)}
            </Text>
          </View>

          <View style={[styles.body, { borderTopColor: c.line }]}>
            <Text style={[styles.paragraph, { color: c.ink }]}>{n.body}</Text>
          </View>

          <View style={[styles.foot, { backgroundColor: c.bg1, borderColor: c.line }]}>
            <Text style={[styles.footText, { color: c.ink3 }]}>
              Questions? The front desk answers at {CLUB.phone}.
            </Text>
          </View>
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  byline: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: '#888',
    paddingTop: 10,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  body: {
    borderTopWidth: 1,
    paddingTop: 20,
  },
  paragraph: {
    fontFamily: typography.serif,
    fontSize: 16,
    lineHeight: 28,
  },
  foot: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  footText: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
