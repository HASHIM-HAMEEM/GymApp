import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Chip, Switch, ConfirmModal } from '@/components/Overlays';
import { KVList, KVRow } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';
import { ADMIN_USER } from '@/data/plans';

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
  const { publishNotice, members, darkMode } = useApp();
  const c = useColors(darkMode);

  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [audience, setAudience] = React.useState<'All members' | 'Active only' | 'Expiring soon'>('All members');
  const [urgent, setUrgent] = React.useState(false);
  const [step, setStep] = React.useState<'compose' | 'confirm' | 'success' | 'failure'>('compose');

  const audienceCount = audience === 'All members' ? members.length : audience === 'Active only' ? members.filter((m) => m.membership?.status === 'active' || m.membership?.status === 'due').length : members.filter((m) => m.membership?.status === 'expiring').length;

  const publish = () => {
    publishNotice({
      category: urgent ? 'Urgent' : 'Schedule',
      title,
      body,
      date: '2026-09-20',
      author: ADMIN_USER.name,
      audience,
      urgent,
    });
    setStep('success');
  };

  if (step === 'success') {
    return (
      <View style={[styles.successWrap, { backgroundColor: c.bg }]}>
        <View style={[styles.successBadge, { backgroundColor: c.okSoft }]}>
          <Icon name="check" size={42} color={c.ok} />
        </View>
        <Text style={[styles.successTitle, { color: c.ink }]}>Notice published</Text>
        <Text style={[styles.successBody, { color: c.ink2 }]}>
          Delivered to <Text style={{ color: c.ink, fontWeight: '600' }}>{audienceCount} members</Text> in the app.{'\n'}
          SMS delivery for urgent notices: in progress.
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <KVList>
            <KVRow label="Notice"><Text style={{ fontSize: 13.5, color: c.ink }}>{title.slice(0, 28)}{title.length > 28 ? '…' : ''}</Text></KVRow>
            <KVRow label="Audience"><Text style={{ color: c.ink }}>{audience}</Text></KVRow>
            <KVRow label="Published"><Text style={{ color: c.ink }}>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} · by {ADMIN_USER.name}</Text></KVRow>
          </KVList>
        </View>
        <Button block onPress={() => router.replace('/(admin)/notices')}>Done</Button>
      </View>
    );
  }

  if (step === 'failure') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="New notice" onBack={() => setStep('compose')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 14 }}>
        <View style={{ marginTop: 4 }}>
          <View style={[styles.errBanner, { borderColor: c.bad + '33', backgroundColor: c.badBg }]}>
            <Icon name="wifioff" size={19} color={c.bad} />
            <Text style={[styles.errText, { color: c.bad }]}>
              <Text style={{ fontWeight: '700' }}>Couldn't publish. The connection dropped.</Text> Your notice is saved as a draft and will publish the moment you're back online.
            </Text>
          </View>
        </View>
        <Field label="Title"><Control value={title} onChangeText={setTitle} /></Field>
        <Field label="Body">
          <Control value={body} onChangeText={setBody} multiline />
        </Field>
        <Field label="Audience">
          <Chip on>{audience} <Text style={{ color: c.ink3 }}>{audienceCount}</Text></Chip>
        </Field>
        <Button variant="secondary" block icon="refresh" onPress={() => setStep('confirm')}>Retry publish</Button>
        </Body>
      </ScrollView>
    </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="New notice" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <Body style={{ gap: 18 }}>

        <Field label="Title">
          <Control value={title} onChangeText={setTitle} placeholder="Say it in one clear line" />
        </Field>

        <Field label="Body" hint="Members read this in the notice's editorial view. Write plainly.">
          <Control value={body} onChangeText={setBody} multiline placeholder="Write the announcement…" />
        </Field>

        <Field label="Audience">
          <View style={{ gap: 8 }}>
            {(['All members', 'Active only', 'Expiring soon'] as const).map((a) => (
              <Chip key={a} on={audience === a} onPress={() => setAudience(a)} count={a === 'All members' ? members.length : a === 'Active only' ? members.filter((m) => m.membership?.status === 'active' || m.membership?.status === 'due').length : members.filter((m) => m.membership?.status === 'expiring').length}>
                {a}
              </Chip>
            ))}
          </View>
        </Field>

        <Field label="Priority">
          <View style={[styles.priorityRow, { backgroundColor: c.bg2, borderColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.priorityT, { color: c.ink }]}>Mark as urgent</Text>
              <Text style={[styles.priorityS, { color: c.ink3 }]}>Red spine, top of the feed, SMS fallback</Text>
            </View>
            <Switch on={urgent} onChange={setUrgent} />
          </View>
        </Field>
        </Body>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: c.bg, borderTopColor: c.line }]}>
        <Button block disabled={!title.trim() || !body.trim()} onPress={() => setStep('confirm')}>Review & publish</Button>
      </View>

      <ConfirmModal
        visible={step === 'confirm'}
        title={`Publish to ${audience.toLowerCase()}?`}
        confirmLabel="Publish"
        onCancel={() => setStep('compose')}
        onConfirm={publish}
      >
        <Text style={{ fontWeight: '600', color: c.ink }}>{title}</Text> will be delivered to <Text style={{ fontWeight: '600', color: c.ink }}>{audienceCount} members</Text> now. Urgent notices are also sent by SMS.
      </ConfirmModal>
    </View>
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
    fontSize: 14.5,
    fontWeight: '500',
  },
  priorityS: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
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
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
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
    fontSize: 13.5,
    lineHeight: 19,
  },
});
