import * as React from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Control, type ControlProps } from '@/components/Field';

function parseIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date();
  if (year && month && day) date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateField({ value, onChangeText, minimumDate, maximumDate, ...props }: ControlProps & {
  value: string;
  onChangeText: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const inputRef = React.useRef<TextInput>(null);
  const [open, setOpen] = React.useState(false);
  const date = parseIso(value);

  const assignInputRef = React.useCallback((node: TextInput | null) => {
    inputRef.current = node;
    const externalRef = props.inputRef;
    if (typeof externalRef === 'function') externalRef(node);
    else if (externalRef) (externalRef as React.MutableRefObject<TextInput | null>).current = node;
  }, [props.inputRef]);

  if (Platform.OS === 'web') {
    return <Control {...props} inputRef={assignInputRef} value={value} onChangeText={onChangeText} inputMode="numeric" webType="date" webMin={minimumDate ? toIso(minimumDate) : undefined} webMax={maximumDate ? toIso(maximumDate) : undefined} />;
  }

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) onChangeText(toIso(selected));
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? props.placeholder ?? 'Select date'} onPress={() => setOpen(true)}>
        <View pointerEvents="none"><Control {...props} value={value} onChangeText={() => undefined} editable={false} /></View>
      </Pressable>
      {open ? <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} maximumDate={maximumDate} minimumDate={minimumDate} onChange={handleChange} /> : null}
    </>
  );
}
