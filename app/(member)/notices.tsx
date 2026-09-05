import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { EmptyState } from '@/components/Surfaces';
import { LtrText } from '@/components/LtrText';
import { useNotices } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { fmtShort } from '@/data/format';
import type { Language, TranslationKey } from '@/lib/i18n';
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

function noticeCategoryKey(category: Notice['category']): TranslationKey {
  switch (category) {
    case 'Urgent': return 'noticeCategory.urgent';
    case 'Schedule': return 'noticeCategory.schedule';
    case 'Hours': return 'noticeCategory.hours';
    case 'Facilities': return 'noticeCategory.facilities';
    case 'Renewal': return 'noticeCategory.renewal';
    default: return 'noticeCategory.renewal';
  }
}

function noticeDate(iso: string, language: Language): string {
  return fmtShort(iso, language);
}

export default function NoticesScreen() {
  const router = useRouter();
  const noticesQuery = useNotices();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
  const notices = noticesQuery.data ?? [];
  const unreadCount = notices.filter((n) => !n.read).length;

  if (notices.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title={t('notices.title')} />
        <EmptyState icon="bell" title={t('notices.emptyTitle')} body={t('notices.emptyBody')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        right={
          unreadCount > 0 ? (
            <Text style={[styles.badge, { color: c.accentHi, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('notices.newCount', { count: unreadCount })}</Text>
          ) : null
        }
      >
        <Text style={{ fontFamily: typography.display, fontSize: 18, fontWeight: '600', letterSpacing: -0.01, color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }}>{t('notices.title')}</Text>
      </AppBar>
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
                    { borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
                    i === notices.length - 1 && { borderBottomWidth: 0 },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.cat, { color, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t(noticeCategoryKey(n.category))}</Text>
                  <View style={styles.grow}>
                    <Text style={[styles.title, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]} numberOfLines={2}>
                      {n.title}
                    </Text>
                    <Text style={[styles.preview, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]} numberOfLines={2}>
                      {n.body}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <LtrText style={[styles.dt, { color: c.ink4 }]}>{noticeDate(n.date, language)}</LtrText>
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
    fontSize: 13,
    letterSpacing: tracking.small,
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
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  grow: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
  },
  preview: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 18,
    marginTop: 4,
  },
  dt: {
    fontFamily: typography.mono,
    fontSize: 11,
    letterSpacing: tracking.small,
    paddingTop: 4,
  },
  unread: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 5,
  },
});
