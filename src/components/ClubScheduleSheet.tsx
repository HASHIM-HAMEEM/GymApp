import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Control, Field } from '@/components/Field';
import { Sheet, Switch } from '@/components/Overlays';
import { Banner } from '@/components/Surfaces';
import type { ClubHour } from '@/data/types';
import { clubDayKey } from '@/lib/club-hours';
import { useApp } from '@/providers/AppProvider';
import { radius, tracking, typography, useColors } from '@/theme/tokens';

const clockPattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function clockInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function ClubScheduleSheet({
  visible,
  hours,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  hours: ClubHour[];
  saving: boolean;
  onClose: () => void;
  onSave: (hours: ClubHour[]) => Promise<void>;
}) {
  const { darkMode, isRtl, t } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  const [draft, setDraft] = React.useState<ClubHour[]>(hours);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    setDraft(hours.map((row) => ({ ...row })));
    setError(null);
  }, [hours, visible]);

  const patch = (index: number, value: Partial<ClubHour>) => {
    setDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...value } : row));
    setError(null);
  };

  const submit = async () => {
    const invalid = draft.find((row) => !row.closed && (!clockPattern.test(row.open ?? '') || !clockPattern.test(row.close ?? '') || row.open === row.close));
    if (invalid) {
      setError(t('schedule.invalidTime', { day: t(clubDayKey(invalid.day)) }));
      return;
    }
    try {
      await onSave(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('schedule.saveFailed'));
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('schedule.title')} desc={t('schedule.adminDesc')}>
      <View style={styles.content}>
        {error ? <Banner variant="error">{error}</Banner> : null}
        {draft.map((row, index) => (
          <View key={row.day} style={[styles.day, { borderColor: c.line, backgroundColor: c.bg1 }]}>
            <View style={[styles.dayHead, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.dayName, { color: c.ink, writingDirection: textDir }]}>{t(clubDayKey(row.day))}</Text>
              <View style={[styles.switchWrap, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.state, { color: c.ink3, writingDirection: textDir }]}>{row.closed ? t('schedule.closed') : t('schedule.open')}</Text>
                <Switch on={!row.closed} onChange={(open) => patch(index, { closed: !open, open: open ? row.open ?? '06:00' : null, close: open ? row.close ?? '22:00' : null })} />
              </View>
            </View>
            {!row.closed ? (
              <View style={[styles.times, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Field label={t('schedule.opens')} style={styles.timeField}>
                  <Control value={row.open ?? ''} onChangeText={(value) => patch(index, { open: clockInput(value) })} placeholder="06:00" maxLength={5} inputMode="numeric" autoComplete="off" />
                </Field>
                <Field label={t('schedule.closes')} style={styles.timeField}>
                  <Control value={row.close ?? ''} onChangeText={(value) => patch(index, { close: clockInput(value) })} placeholder="22:00" maxLength={5} inputMode="numeric" autoComplete="off" />
                </Field>
              </View>
            ) : null}
          </View>
        ))}
        <Text style={[styles.hint, { color: c.ink3, writingDirection: textDir }]}>{t('schedule.timeHint')}</Text>
        <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <Button variant="secondary" onPress={onClose}>{t('common.cancel')}</Button>
          <Button loading={saving} onPress={() => void submit()}>{t('schedule.save')}</Button>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    marginTop: 16,
  },
  day: {
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 13,
  },
  dayHead: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayName: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  switchWrap: {
    alignItems: 'center',
    gap: 8,
  },
  state: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  times: {
    gap: 10,
  },
  timeField: {
    flex: 1,
  },
  hint: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
  },
  actions: {
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
});
