import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Body } from '@/components/Chrome';
import { Banner } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { Control, Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/theme/tokens';
import { FormScroll } from '@/components/FormScroll';

const MIN_LENGTH = 10;

function passwordProblem(value: string): string | null {
  if (value.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return 'Use upper case, lower case, and at least one number.';
  }
  return null;
}

function PasswordInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const [visible, setVisible] = React.useState(false);
  return (
    <Control
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secure={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="new-password"
      trailing={(
        <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} hitSlop={10} onPress={() => setVisible((current) => !current)} style={styles.eye}>
          <Icon name="eye" size={20} color={c.ink3} />
        </Pressable>
      )}
    />
  );
}

export default function ChangePassword() {
  const router = useRouter();
  const { darkMode, changePassword } = useApp();
  const c = useColors(darkMode);
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const problem = passwordProblem(next);
    if (!current) return setError('Enter your current password.');
    if (problem) return setError(problem);
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('Choose a password different from your current password.');
    setError(null);
    setSaving(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The password could not be changed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Change password" onBack={() => router.back()} />
      <FormScroll contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 18 }}>
            {done ? <Banner variant="info">Password changed. Use the new password next time you sign in.</Banner> : null}
            {error ? <Banner variant="error">{error}</Banner> : null}
            <Field label="Current password"><PasswordInput value={current} onChangeText={setCurrent} placeholder="Current password" /></Field>
            <Field label="New password" hint="At least 10 characters with upper case, lower case, and a number."><PasswordInput value={next} onChangeText={setNext} placeholder="New password" /></Field>
            <Field label="Confirm new password"><PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Repeat new password" /></Field>
            <Button block loading={saving} disabled={done} onPress={() => void save()}>Change password</Button>
          </Body>
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
});
