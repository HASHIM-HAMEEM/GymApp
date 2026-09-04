import * as React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, type Href } from 'expo-router';
import { colors, useColors, spacing, typography, tracking } from '@/theme/tokens';
import { Icon, IconName } from './Icon';
import { IconButton } from './Button';
import { useApp } from '@/data/store';

/* ------------------------------------------------------------------ */
/* iOS status bar — time + signal/wifi/battery                         */
/* On native, SafeAreaInsets handles the top padding. On web preview,  */
/* we render a faux status bar so the app looks like a real phone.     */
/* ------------------------------------------------------------------ */

export function StatusBar({ dark = false }: { dark?: boolean }) {
  const insets = useSafeAreaInsets();
  const ink = useColors(dark).ink;

  if (Platform.OS !== 'web') {
    return <View style={{ height: insets.top }} />;
  }

  const time = '9:41';
  return (
    <View
      style={{
        height: 52,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingBottom: 6,
      }}
    >
      <Text
        style={{
          fontFamily: typography.display,
          fontSize: 15,
          fontWeight: '600',
          letterSpacing: 0.01,
          color: ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {time}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12 }}>
          <View style={{ width: 3, height: 4, borderRadius: 1, backgroundColor: ink }} />
          <View style={{ width: 3, height: 6, borderRadius: 1, backgroundColor: ink }} />
          <View style={{ width: 3, height: 9, borderRadius: 1, backgroundColor: ink }} />
          <View style={{ width: 3, height: 12, borderRadius: 1, backgroundColor: ink }} />
        </View>
        <Icon name="wifi" size={16} color={ink} />
        <View
          style={{
            width: 25,
            height: 12,
            borderRadius: 3,
            borderWidth: 1.5,
            borderColor: ink,
            padding: 1.5,
            flexDirection: 'row',
          }}
        >
          <View style={{ flex: 1, backgroundColor: ink, borderRadius: 1 }} />
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* App bar — screen header                                             */
/* ------------------------------------------------------------------ */

export interface AppBarProps {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: React.ReactNode;
  sub?: string;
  dark?: boolean;
  children?: React.ReactNode;
}

export function AppBar({ title, onBack, onClose, right, sub, dark, children }: AppBarProps) {
  const { darkMode } = useApp();
  const isDark = dark ?? darkMode;
  const c = useColors(isDark);
  return (
    <View
      style={{
        minHeight: 54,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 2,
      }}
    >
      {onBack ? <IconButton name="back" onPress={onBack} color={c.ink} /> : null}
      {onClose ? <IconButton name="close" onPress={onClose} color={c.ink} /> : null}
      {children ? (
        children
      ) : (
        <>
          <Text
            style={{
              fontFamily: typography.display,
              fontSize: 17,
              fontWeight: '600',
              letterSpacing: -0.01,
              color: c.ink,
            }}
          >
            {title}
          </Text>
          {sub ? (
            <Text
              style={{
                fontFamily: typography.mono,
                fontSize: 12,
                color: c.ink3,
                marginLeft: 6,
              }}
            >
              {sub}
            </Text>
          ) : null}
        </>
      )}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Tab bar — bottom navigation (dock with raised FAB)                  */
/* ------------------------------------------------------------------ */

export interface TabDef {
  key: string;
  label: string;
  icon: IconName;
  href: Href;
}

export interface TabBarProps {
  tabs: TabDef[];
  active: string;
  fab?: { icon: IconName; href: Href };
  dark?: boolean;
}

export function TabBar({ tabs, active, fab, dark = false }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { darkMode } = useApp();
  const isDark = dark || darkMode;
  const c = useColors(isDark);

  const left = tabs.slice(0, Math.ceil(tabs.length / 2));
  const right = tabs.slice(Math.ceil(tabs.length / 2));

  const TabItem = ({ t }: { t: TabDef }) => {
    const on = t.key === active;
    return (
      <Link href={t.href} asChild>
        <Pressable style={{ flex: 1, alignItems: 'center', gap: 5, paddingTop: 3 }}>
          <Icon name={t.icon} size={22} color={on ? c.accentHi : c.ink4} stroke={on ? 2 : 1.6} />
          <Text
            style={{
              fontFamily: typography.fontFamily,
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 0.3,
              color: on ? c.accentHi : c.ink4,
            }}
          >
            {t.label}
          </Text>
        </Pressable>
      </Link>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Platform.OS === 'web' ? 'rgba(17, 20, 27, 0.94)' : c.bg1,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingBottom: Platform.OS === 'web' ? 24 : insets.bottom + 8,
        paddingTop: 8,
        paddingHorizontal: 14,
      }}
    >
      {left.map((t) => (
        <TabItem key={t.key} t={t} />
      ))}
      {fab ? (
        <View style={{ width: 68, alignItems: 'center' }}>
          <Link href={fab.href} asChild>
            <Pressable
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -24,
                borderWidth: 4,
                borderColor: c.bg,
                shadowColor: c.accentGlow,
                shadowOpacity: 0.9,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              <Icon name={fab.icon} size={24} color={c.accentInk} />
            </Pressable>
          </Link>
        </View>
      ) : (
        <View style={{ width: 68 }} />
      )}
      {right.map((t) => (
        <TabItem key={t.key} t={t} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen scaffold                                                     */
/* ------------------------------------------------------------------ */

export interface ScreenProps {
  children: React.ReactNode;
  dark?: boolean;
  noScroll?: boolean;
  padded?: boolean;
  style?: any;
}

export function Screen({ children, dark, noScroll = false, padded = true, style }: ScreenProps) {
  const { darkMode } = useApp();
  const isDark = dark ?? darkMode;
  const c = useColors(isDark);
  const bg = c.bg;
  const inner = (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: bg,
        },
        padded && { paddingHorizontal: spacing.screen },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (noScroll) return inner;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          backgroundColor: bg,
          ...(padded ? { paddingHorizontal: spacing.screen } : {}),
          ...style,
        }}
      >
        {children}
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Body — scrollable column with V2 spacing                            */
/* ------------------------------------------------------------------ */

export function Body({
  children,
  scroll = false,
  center = false,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  center?: boolean;
  style?: any;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const content = (
    <View
      style={[
        {
          flex: 1,
          minHeight: 0,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 26,
          gap: 18,
        },
        center && { alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!scroll) return content;
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 26, gap: 18 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Greeting block                                                      */
/* ------------------------------------------------------------------ */

export function Greeting({ hi, name }: { hi: string; name: string }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View>
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 15,
          color: c.ink2,
          fontWeight: '500',
        }}
      >
        {hi}
      </Text>
      <Text
        style={{
          fontFamily: typography.display,
          fontSize: 19,
          fontWeight: '600',
          color: c.ink,
          letterSpacing: -0.015,
          marginTop: 4,
        }}
      >
        {name}
      </Text>
    </View>
  );
}
