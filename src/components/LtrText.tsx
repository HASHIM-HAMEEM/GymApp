import * as React from 'react';
import { Text, type TextProps } from 'react-native';

export function LtrText({ children, style, ...rest }: TextProps) {
  return (
    <Text style={[{ writingDirection: 'ltr' }, style]} {...rest}>
      {children}
    </Text>
  );
}
