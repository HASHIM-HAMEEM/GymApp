import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { TextButton } from '@/components/Button';
import { ConfirmModal } from '@/components/Overlays';
import { Banner } from '@/components/Surfaces';
import { useDeleteNotice, useNotices } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { fmtShort } from '@/data/format';
import type { Notice } from '@/data/types';
import type { Language, TranslationKey } from '@/lib/i18n';

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

const categoryKey: Record<Notice['category'], TranslationKey> = {
  Urgent: 'noticeCategory.urgent',
  Schedule: 'noticeCategory.schedule',
  Hours: 'noticeCategory.hours',
  Facilities: 'noticeCategory.facilities',
  Renewal: 'noticeCategory.renewal',
};

const audienceKey: Record<Notice['audience'], TranslationKey> = {
  'All members': 'noticeCompose.allMembers',
  'Active only': 'noticeCompose.activeOnly',
  'Expiring soon': 'noticeCompose.expiringSoon',
};

export default function AdminNotices() {
  const router = useRouter();
  const noticesQuery = useNotices(true);
  const deleteNotice = useDeleteNotice();
  const { darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  const notices = noticesQuery.data ?? [];
  const [selectedNotice, setSelectedNotice] = React.useState<Notice | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const removeNotice = async () => {
    if (!selectedNotice) return;
    setDeleteError(null);
    try {
      await deleteNotice.mutateAsync(selectedNotice.id);
      setSelectedNotice(null);
    } catch {
      setDeleteError(t('notices.deleteFailed'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title={t('notices.title')}
        right={<TextButton onPress={() => router.push('/notice-compose')}>{t('notices.new')}</TextButton>}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>
          {deleteError ? <Banner variant="error"><Text style={{ writingDirection: textDir }}>{deleteError}</Text></Banner> : null}
          {notices.length === 0 ? (
            <Text style={{ color: c.ink3, fontSize: 13, textAlign: 'center', paddingVertical: 24, writingDirection: textDir }}>
              {noticesQuery.isLoading ? t('notices.loading') : t('notices.adminEmpty')}
            </Text>
          ) : (
            <View style={[styles.list, { backgroundColor: c.bg1, borderColor: c.line }]}>
              {notices.map((n, i) => {
                const color = catColor(c, n.category);
                return (
                  <View
                    key={n.id}
                    style={[
                      styles.nrow,
                      { borderColor: c.line },
                      i === notices.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Pressable
                      onPress={() => router.push({ pathname: '/notice', params: { id: n.id } })}
                      style={({ pressed }) => [styles.noticeLink, { flexDirection: isRtl ? 'row-reverse' : 'row' }, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={[styles.cat, { color, textAlign: isRtl ? 'right' : 'left', writingDirection: textDir }]}>{t(categoryKey[n.category])}</Text>
                      <View style={styles.grow}>
                        <Text style={[styles.title, { color: c.ink, writingDirection: textDir }]} numberOfLines={2}>{n.title}</Text>
                        <Text style={[styles.dt, { color: c.ink3, writingDirection: textDir }]} numberOfLines={1}>
                          {fmtShort(n.date, language)} · {t(audienceKey[n.audience])} · {t('notices.delivered', { count: n.delivered.toLocaleString() })}
                        </Text>
                      </View>
                    </Pressable>
                    <TextButton color={c.bad} onPress={() => setSelectedNotice(n)}><Text style={{ writingDirection: textDir }}>{t('common.delete')}</Text></TextButton>
                  </View>
                );
              })}
            </View>
          )}
        </Body>
      </ScrollView>
      <ConfirmModal
        visible={Boolean(selectedNotice)}
        title={t('notices.deleteTitle')}
        confirmLabel={t('notices.deleteConfirm')}
        confirmVariant="danger"
        onCancel={() => setSelectedNotice(null)}
        onConfirm={() => void removeNotice()}
      >
        {t('notices.deleteBody')}
      </ConfirmModal>
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
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  noticeLink: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    gap: 12,
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
