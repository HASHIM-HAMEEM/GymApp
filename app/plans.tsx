import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { radius, tracking, useColors } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Sheet, Switch } from '@/components/Overlays';
import { useAdminPlans, useSavePlan } from '@/data/api/queries';
import type { ApiPlanRow } from '@/data/api/api';
import { formatMoney } from '@/data/format';

export default function Plans() {
  const { role, darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const router = useRouter();
  const plans = useAdminPlans();
  const save = useSavePlan();
  const [editing, setEditing] = React.useState<ApiPlanRow | 'new' | null>(null);
  const [name, setName] = React.useState('');
  const [months, setMonths] = React.useState('1');
  const [price, setPrice] = React.useState('');
  const [blurb, setBlurb] = React.useState('');
  const [active, setActive] = React.useState(true);
  const [error, setError] = React.useState('');
  const textDir = isRtl ? 'rtl' : 'ltr';

  if (role !== 'admin') return <Redirect href="/welcome" />;

  const edit = (row: ApiPlanRow | 'new') => {
    setEditing(row);
    setError('');
    save.reset();
    setName(row === 'new' ? '' : row.name);
    setMonths(row === 'new' ? '1' : String(row.duration_months));
    setPrice(row === 'new' ? '' : String(row.price));
    setBlurb(row === 'new' ? '' : row.blurb ?? '');
    setActive(row === 'new' ? true : row.is_active);
  };

  const submit = async () => {
    if (save.isPending) return;
    if (!name.trim() || !/^\d+$/.test(months) || Number(months) < 1 || Number(months) > 120 || !/^\d+(\.\d{1,2})?$/.test(price)) {
      setError(t('plans.invalid'));
      return;
    }
    try {
      await save.mutateAsync({
        id: editing && editing !== 'new' ? editing.id : undefined,
        name: name.trim(),
        months: Number(months),
        price: Number(price),
        blurb: blurb.trim(),
        active,
      });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('plans.saveFailed'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('plans.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>
          <Text style={[styles.intro, { color: c.ink2, writingDirection: textDir }]}>{t('plans.intro')}</Text>
          <Text style={[styles.effectNote, { color: c.ink3, writingDirection: textDir }]}>{t('plans.effectNote')}</Text>
          {plans.isError ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: c.bad, writingDirection: textDir }]}>
              {t('plans.loadFailed')}
            </Text>
          ) : null}
          {(plans.data ?? []).map((row) => (
            <View key={row.id} style={[styles.plan, { borderColor: c.line, backgroundColor: c.bg1 }]}>
              <View style={[styles.planRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.planName, { color: c.ink, writingDirection: textDir }]}>{row.name}</Text>
                  <Text style={[styles.planMeta, { color: c.ink2, writingDirection: textDir }]}>
                    {t('plans.monthsValue', { count: row.duration_months })} · {formatMoney(Number(row.price), row.currency, language)}
                    {row.is_active ? '' : ` · ${t('plans.inactive')}`}
                  </Text>
                  {row.blurb ? (
                    <Text style={[styles.planBlurb, { color: c.ink3, writingDirection: textDir }]}>{row.blurb}</Text>
                  ) : null}
                </View>
                <Button size="sm" variant="secondary" onPress={() => edit(row)}>{t('plans.edit')}</Button>
              </View>
            </View>
          ))}
          <Button block onPress={() => edit('new')}>{t('plans.create')}</Button>
        </Body>
      </ScrollView>
      <Sheet
        visible={editing !== null}
        onClose={() => { if (!save.isPending) setEditing(null); }}
        title={editing === 'new' ? t('plans.createTitle') : t('plans.editTitle')}
      >
        <View style={styles.form}>
          <Field label={t('plans.name')}>
            <Control
              accessibilityLabel={t('plans.name')}
              value={name}
              onChangeText={setName}
              placeholder={t('plans.namePlaceholder')}
              maxLength={120}
            />
          </Field>
          <Field label={t('plans.months')}>
            <Control accessibilityLabel={t('plans.months')} value={months} onChangeText={setMonths} inputMode="numeric" maxLength={3} />
          </Field>
          <Field label={t('plans.price')}>
            <Control accessibilityLabel={t('plans.price')} value={price} onChangeText={setPrice} inputMode="decimal" />
          </Field>
          <Field label={t('plans.description')}>
            <Control
              accessibilityLabel={t('plans.description')}
              value={blurb}
              onChangeText={setBlurb}
              multiline
              maxLength={160}
            />
          </Field>
          <View style={[styles.switchRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Text style={{ flex: 1, color: c.ink, writingDirection: textDir }}>{t('plans.availableForNew')}</Text>
            <Switch on={active} onChange={setActive} />
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: c.bad, writingDirection: textDir }]}>{error}</Text>
          ) : null}
          <Button block loading={save.isPending} onPress={submit}>{t('plans.save')}</Button>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 15,
    lineHeight: 22,
  },
  effectNote: {
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 20,
  },
  error: {
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 20,
  },
  plan: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  planRow: {
    gap: 12,
    alignItems: 'center',
  },
  planName: {
    fontSize: 15,
    fontWeight: '600',
  },
  planMeta: {
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 20,
    marginTop: 4,
  },
  planBlurb: {
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 20,
    marginTop: 4,
  },
  form: {
    gap: 14,
    marginTop: 12,
  },
  switchRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
});
