import * as React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, type Href } from 'expo-router';
import { colors, useColors, spacing, typography, tracking } from '@/theme/tokens';
import { Icon, IconName } from './Icon';
import { IconButton } from './Button';
import { useApp } from '@/data/store';

/* ------------------------------------------------------------------ */
/* Native safe-area spacer. Web keeps the same top rhythm without      */
/* rendering mock time, signal, Wi-Fi, or battery indicators.          */
/* ------------------------------------------------------------------ */

export function StatusBar({ dark = false }: { dark?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') {
    return <View style={{ height: insets.top }} />;
  }
  const height = width < 600 ? Math.max(insets.top, 16) : 52;
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, flexShrink: 0 }} />;
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
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {children ? (
        children
      ) : (
        <>
          <Text
            style={{
              fontFamily: typography.display,
              flexShrink: 1,
              fontSize: 18,
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
                fontSize: 13,
                letterSpacing: tracking.small,
                color: c.ink3,
                marginLeft: 6,
              }}
            >
              {sub}
            </Text>
          ) : null}
        </>
      )}
      </View>
      {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Tab bar — bottom navigation (dock with raised FAB)                  */
/* ------------------------------------------------------------------ */

export interface TabDef {
  badge?: number;
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
  const { darkMode, t } = useApp();
  const isDark = dark || darkMode;
  const c = useColors(isDark);

  const left = tabs.slice(0, Math.ceil(tabs.length / 2));
  const right = tabs.slice(Math.ceil(tabs.length / 2));

  const TabItem = ({ t }: { t: TabDef }) => {
    const on = t.key === active;
    return (
      <Link href={t.href} asChild>
        <Pressable
          accessibilityLabel={t.label}
          style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          <Icon name={t.icon} size={22} color={on ? c.accentHi : c.ink3} stroke={on ? 2 : 1.7} />
          {Boolean(t.badge) ? <View accessibilityLabel={`${t.badge} unread`} style={{ position: 'absolute', top: 1, left: '58%', width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} /> : null}
          <Text
            numberOfLines={1}
            style={{
              fontFamily: typography.fontFamily,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 0.2,
              color: on ? c.accentHi : c.ink2,
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
        backgroundColor: c.bg1,
        borderTopWidth: 1,
        borderTopColor: c.line2,
        paddingBottom: Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 8),
        paddingTop: 8,
        paddingHorizontal: 12,
      }}
    >
      {left.map((t) => (
        <TabItem key={t.key} t={t} />
      ))}
      {fab ? (
        <View style={{ width: 68, alignItems: 'center' }}>
          <Link href={fab.href} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.add')}
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -24,
                borderWidth: 4,
                borderColor: c.bg1,
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
          fontSize: 18,
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
