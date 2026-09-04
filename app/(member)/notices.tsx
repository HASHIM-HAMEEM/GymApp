import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { EmptyState } from '@/components/Surfaces';
import { useNotices } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { fmtShort } from '@/data/format';
import type { Notice } from '@/data/types';

function catColor(c: any, category: Notice['category']) {
  switch (category) {
    case 'Urgent':
      return c.bad;
    case 'Facilities':
      return c.warn;
    case 'Schedule':
    case 'Hours':
      return c.accentHi;
    case 'Renewal':
    default:
      return c.ok;
  }
}

export default function NoticesScreen() {
  const router = useRouter();
  const noticesQuery = useNotices();
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const notices = noticesQuery.data ?? [];
  const unreadCount = notices.filter((n) => !n.read).length;

  if (notices.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Notices" />
        <EmptyState icon="bell" title="All quiet" body="No notices right now. When the club posts something, it'll show up here." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title="Notices"
        right={
          unreadCount > 0 ? (
            <Text style={[styles.badge, { color: c.accentHi }]}>{unreadCount} new</Text>
          ) : null
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Body>
          <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
            {notices.map((n, i) => {
              const color = catColor(c, n.category);
              return (
                <Pressable
                  key={n.id}
                  onPress={() => router.push(`/notice?id=${n.id}`)}
                  style={({ pressed }) => [
                    styles.nrow,
                    { borderColor: c.line },
                    i === notices.length - 1 && { borderBottomWidth: 0 },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.cat, { color }]}>{n.category}</Text>
                  <View style={styles.grow}>
                    <Text style={[styles.title, { color: c.ink }]} numberOfLines={2}>
                      {n.title}
                    </Text>
                    <Text style={[styles.preview, { color: c.ink3 }]} numberOfLines={2}>
                      {n.body}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={[styles.dt, { color: c.ink4 }]}>{fmtShort(n.date)}</Text>
                    {!n.read ? (
                      <View style={[styles.unread, { backgroundColor: c.accent }]} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
  },
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
    width: 78,
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
  preview: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  dt: {
    fontFamily: typography.mono,
    fontSize: 11,
    paddingTop: 4,
  },
  unread: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 5,
  },
});
