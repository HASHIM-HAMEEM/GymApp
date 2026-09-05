import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Chip, Switch, ConfirmModal } from '@/components/Overlays';
import { KVList, KVRow, Banner } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useDashboard, usePublishNotice } from '@/data/api/queries';
import { ApiCallError } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';

type Audience = 'all_members' | 'active_only' | 'expiring_soon';

export default function NoticeCompose() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NoticeComposeInner />
    </>
  );
}

function NoticeComposeInner() {
  const router = useRouter();
  const publishNotice = usePublishNotice();
  const dashboardQuery = useDashboard();
  const { adminName, darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [audience, setAudience] = React.useState<Audience>('all_members');
  const [urgent, setUrgent] = React.useState(false);
  const [step, setStep] = React.useState<'compose' | 'confirm' | 'success' | 'failure'>('compose');
  const [deliveredCount, setDeliveredCount] = React.useState(0);
  const [pushDelivery, setPushDelivery] = React.useState<'sent' | 'none' | 'failed'>('none');
  const [error, setError] = React.useState<string | null>(null);

  const audienceLabels: Record<Audience, string> = {
    all_members: t('noticeCompose.allMembers'),
    active_only: t('noticeCompose.activeOnly'),
    expiring_soon: t('noticeCompose.expiringSoon'),
  };

  const audienceCount = (() => {
    const data = dashboardQuery.data;
    if (!data) return null;
    if (audience === 'all_members') return data.total_members;
    if (audience === 'active_only') return data.active_members;
    return data.expiring_soon;
  })();

  const publish = async () => {
    setError(null);
    try {
      const result = await publishNotice.mutateAsync({
        category: urgent ? 'urgent' : 'schedule',
        title: title.trim(),
        body: body.trim(),
        audience,
        urgent,
      });
      setDeliveredCount(result.recipient_count);
      setPushDelivery(result.push === null ? 'failed' : result.push.sent > 0 ? 'sent' : 'none');
      setStep('success');
    } catch (err) {
      if (err instanceof ApiCallError && err.code === 'VALIDATION_ERROR') {
        setError(t('noticeCompose.validationFailed'));
        setStep('compose');
      } else {
        setError(t('noticeCompose.connectionDropped'));
        setStep('failure');
      }
    }
  };

  if (step === 'success') {
    return (
      <View style={[styles.successWrap, { backgroundColor: c.bg }]}>
        <View style={[styles.successBadge, { backgroundColor: c.okSoft }]}>
          <Icon name="check" size={42} color={c.ok} />
        </View>
        <Text style={[styles.successTitle, { color: c.ink, writingDirection: textDir }]}>{t('notices.published')}</Text>
        <Text style={[styles.successBody, { color: c.ink2, writingDirection: textDir }]}>
          {t('noticeCompose.delivered', { count: deliveredCount })}
        </Text>
        <Banner variant={pushDelivery === 'failed' ? 'warn' : 'info'}>
          <Text style={{ writingDirection: textDir }}>
            {pushDelivery === 'sent'
              ? t('notices.pushed')
              : pushDelivery === 'failed'
                ? t('notices.pushUnavailable')
                : t('notices.noPushDevices')}
          </Text>
        </Banner>
        <View style={{ alignSelf: 'stretch' }}>
          <KVList>
            <KVRow label={t('noticeCompose.notice')}>
              <Text style={{ fontSize: 13, letterSpacing: tracking.small, color: c.ink, writingDirection: textDir }}>
                {title.slice(0, 28)}{title.length > 28 ? '…' : ''}
              </Text>
            </KVRow>
            <KVRow label={t('noticeCompose.audience')}>
              <Text style={{ color: c.ink, writingDirection: textDir }}>{audienceLabels[audience]}</Text>
            </KVRow>
            <KVRow label={t('noticeCompose.published')}>
              <Text style={{ color: c.ink, writingDirection: textDir }}>
                {t('noticeCompose.justNowBy', { name: adminName || t('common.frontDesk') })}
              </Text>
            </KVRow>
          </KVList>
        </View>
        <Button block onPress={() => router.replace('/(admin)/notices')}>{t('common.done')}</Button>
      </View>
    );
  }

  if (step === 'failure') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title={t('noticeCompose.newNotice')} onBack={() => setStep('compose')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 14 }}>
            <View style={{ marginTop: 4 }}>
              <View style={[styles.errBanner, { borderColor: c.bad + '33', backgroundColor: c.badBg, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Icon name="wifioff" size={19} color={c.bad} />
                <Text style={[styles.errText, { color: c.bad, writingDirection: textDir }]}>
                  <Text style={{ fontWeight: '700' }}>{t('noticeCompose.couldNotPublish')}</Text>{' '}
                  {t('noticeCompose.draftSaved', { error: error || t('noticeCompose.connectionDropped') })}
                </Text>
              </View>
            </View>
            <Field label={t('noticeCompose.title')}><Control value={title} onChangeText={setTitle} /></Field>
            <Field label={t('noticeCompose.body')}>
              <Control value={body} onChangeText={setBody} multiline />
            </Field>
            <Field label={t('noticeCompose.audience')}>
              <Chip on count={audienceCount ?? '…'}>{audienceLabels[audience]}</Chip>
            </Field>
            <Button variant="secondary" block icon="refresh" onPress={() => setStep('confirm')}>{t('noticeCompose.retry')}</Button>
          </Body>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <AppBar title={t('noticeCompose.newNotice')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <Body style={{ gap: 18 }}>

          {error ? <Banner variant="error"><Text style={{ writingDirection: textDir }}>{error}</Text></Banner> : null}

          <Field
            label={t('noticeCompose.title')}
            hint={t('noticeCompose.characterCount', { count: title.length })}
          >
            <Control
              value={title}
              onChangeText={setTitle}
              placeholder={t('noticeCompose.titlePlaceholder')}
              maxLength={160}
            />
          </Field>

          <Field label={t('noticeCompose.body')} hint={t('noticeCompose.bodyHint')}>
            <Control value={body} onChangeText={setBody} multiline placeholder={t('noticeCompose.bodyPlaceholder')} />
          </Field>

          <Field label={t('noticeCompose.audience')}>
            <View style={{ gap: 8 }}>
              {(['all_members', 'active_only', 'expiring_soon'] as Audience[]).map((key) => {
                const count =
                  key === 'all_members'
                    ? dashboardQuery.data?.total_members
                    : key === 'active_only'
                      ? dashboardQuery.data?.active_members
                      : dashboardQuery.data?.expiring_soon;
                return (
                  <Chip key={key} on={audience === key} onPress={() => setAudience(key)} count={count ?? '…'}>
                    {audienceLabels[key]}
                  </Chip>
                );
              })}
            </View>
          </Field>

          <Field label={t('noticeCompose.priority')}>
            <View style={[styles.priorityRow, { backgroundColor: c.bg2, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.priorityT, { color: c.ink, writingDirection: textDir }]}>{t('noticeCompose.markUrgent')}</Text>
                <Text style={[styles.priorityS, { color: c.ink3, writingDirection: textDir }]}>{t('noticeCompose.urgentHint')}</Text>
              </View>
              <Switch on={urgent} onChange={setUrgent} />
            </View>
          </Field>
        </Body>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: c.bg, borderTopColor: c.line }]}>
        <Button block disabled={!title.trim() || !body.trim()} onPress={() => setStep('confirm')}>{t('noticeCompose.reviewPublish')}</Button>
      </View>

      <ConfirmModal
        visible={step === 'confirm'}
        title={t('noticeCompose.publishTo', { audience: audienceLabels[audience] })}
        confirmLabel={t('common.publish')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setStep('compose')}
        onConfirm={publish}
      >
        <Text style={{ writingDirection: textDir }}>
          {t('noticeCompose.confirmBody', { title, count: audienceCount ?? t('noticeCompose.selectedMembers') })}
        </Text>
      </ConfirmModal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screen,
    paddingBottom: 34,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  priorityT: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '500',
  },
  priorityS: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    marginTop: 2,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: spacing.screen,
    paddingBottom: 40,
  },
  successBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
  },
});
