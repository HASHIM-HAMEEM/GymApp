import * as React from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { getLocales } from 'expo-localization';
import { authRedirectUrl, isSupabaseConfigured, listenForAuthRefresh, requireSupabase, supabase } from '@/lib/supabase';
import type { AppProfile, Language, Role } from '@/data/types';
import { translate, type TranslationKey } from '@/lib/i18n';
import {
  openNotificationSettings,
  registerPushDevice,
  requestNotificationPermission,
  unregisterPushDevice,
  type NotificationState,
} from '@/lib/notifications';

interface AppState {
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  role: Role;
  authLoading: boolean;
  configurationError: string | null;
  authError: string | null;
  adminName: string;
  adminInitials: string;
  darkMode: boolean;
  language: Language;
  isRtl: boolean;
  t: (key: TranslationKey, options?: Record<string, unknown>) => string;
  notificationState: NotificationState;
}

interface AppActions {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  setPassword: (password: string, completeInvite?: boolean) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  requestNotifications: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
  toggleDarkMode: () => void;
}

type AppContextValue = AppState & AppActions;

const AppContext = React.createContext<AppContextValue | null>(null);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
});

function mapProfile(row: Record<string, unknown>): AppProfile {
  const name = String(row.display_name ?? 'Apex member');
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return {
    id: String(row.id),
    role: row.role === 'admin' ? 'admin' : 'member',
    displayName: name,
    initials,
    reception: row.reception === 'B' ? 'B' : row.reception === 'A' ? 'A' : undefined,
    status: row.account_state === 'suspended' ? 'suspended' : row.account_state === 'active' ? 'active' : 'invited',
    mustSetPassword: Boolean(row.must_set_password),
    preferredLanguage: row.preferred_language === 'ur' ? 'ur' : 'en',
  };
}

async function loadProfile(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, role, account_state, must_set_password, display_name, reception, preferred_language')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return mapProfile(data as Record<string, unknown>);
}

function SessionProvider({ children }: { children: React.ReactNode }) {
  const cache = useQueryClient();
  const [session, setSession] = React.useState<Session | null>(null);
  const [initialized, setInitialized] = React.useState(!isSupabaseConfigured);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [darkMode, setDarkMode] = React.useState(true);
  const [language, setLanguageState] = React.useState<Language>(
    getLocales()[0]?.languageCode === 'ur' ? 'ur' : 'en',
  );
  const [notificationState, setNotificationState] = React.useState<NotificationState>('prompt');
  const pushToken = React.useRef<string | null>(null);
  const previousUserId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError('Your saved session could not be restored. Sign in again.');
      setSession(data.session);
      setInitialized(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (previousUserId.current !== nextUserId) {
        cache.clear();
        previousUserId.current = nextUserId;
      }
      setSession(nextSession);
      setInitialized(true);
    });
    const stopRefreshListener = listenForAuthRefresh();
    return () => {
      active = false;
      data.subscription.unsubscribe();
      stopRefreshListener();
    };
  }, [cache]);

  React.useEffect(() => {
    let active = true;
    void requestNotificationPermission()
      .then((state) => {
        if (active) setNotificationState(state);
      })
      .catch(() => {
        if (active) setNotificationState('unconfigured');
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!session) return;
    let active = true;
    void registerPushDevice()
      .then((result) => {
        if (!active) return;
        pushToken.current = result.token ?? null;
        setNotificationState(result.state);
      })
      .catch(() => {
        if (active) setNotificationState('unconfigured');
      });
    return () => {
      active = false;
    };
  }, [session]);

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: () => loadProfile(session!.user.id),
    enabled: Boolean(session?.user.id),
    retry: false,
  });

  React.useEffect(() => {
    if (profileQuery.error) {
      setAuthError('This account is not connected to a Apex profile. Ask an administrator for help.');
    }
  }, [profileQuery.error]);

  React.useEffect(() => {
    if (profileQuery.data?.preferredLanguage) {
      setLanguageState(profileQuery.data.preferredLanguage);
    }
  }, [profileQuery.data?.preferredLanguage]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await requireSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setAuthError('Email or password is incorrect. Check both fields or reset your password.');
      throw error;
    }
  }, []);

  const signOut = React.useCallback(async () => {
    setAuthError(null);
    if (pushToken.current) {
      await unregisterPushDevice(pushToken.current).catch(() => undefined);
      pushToken.current = null;
    }
    const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
    if (error) throw error;
    cache.clear();
  }, [cache]);

  const sendPasswordReset = React.useCallback(async (email: string) => {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: authRedirectUrl,
    });
    if (error) throw error;
  }, []);

  const setPassword = React.useCallback(async (password: string, completeInvite = false) => {
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    if (completeInvite) {
      const { error: completionError } = await client.rpc('complete_member_onboarding');
      if (completionError) throw completionError;
    }
    await cache.invalidateQueries({ queryKey: ['profile'] });
  }, [cache]);

  const setLanguage = React.useCallback(async (nextLanguage: Language) => {
    const previousLanguage = language;
    setLanguageState(nextLanguage);
    if (!session) return;
    const { error } = await requireSupabase().rpc('set_preferred_language', {
      p_language: nextLanguage,
    });
    if (error) {
      setLanguageState(previousLanguage);
      throw error;
    }
    await cache.invalidateQueries({ queryKey: ['profile', session.user.id] });
  }, [cache, language, session]);

  const requestNotifications = React.useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotificationState(permission);
    if (permission === 'denied') {
      await openNotificationSettings();
      return;
    }
    if (session) {
      const result = await registerPushDevice();
      pushToken.current = result.token ?? null;
      setNotificationState(result.state);
    }
  }, [session]);

  const refreshProfile = React.useCallback(async () => {
    await cache.invalidateQueries({ queryKey: ['profile', session?.user.id] });
  }, [cache, session?.user.id]);

  const profile = profileQuery.data ?? null;
  const t = React.useCallback(
    (key: TranslationKey, options?: Record<string, unknown>) => translate(language, key, options),
    [language],
  );
  const value = React.useMemo<AppContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? 'unauth',
    authLoading: !initialized || Boolean(session && profileQuery.isLoading),
    configurationError: isSupabaseConfigured
      ? null
      : 'Connect Supabase by copying .env.example to .env.local and adding the project URL and publishable key.',
    authError,
    adminName: profile?.role === 'admin' ? profile.displayName : '',
    adminInitials: profile?.role === 'admin' ? profile.initials : '',
    darkMode,
    language,
    isRtl: language === 'ur',
    t,
    notificationState,
    signIn,
    signOut,
    sendPasswordReset,
    setPassword,
    setLanguage,
    requestNotifications,
    refreshProfile,
    clearAuthError: () => setAuthError(null),
    toggleDarkMode: () => setDarkMode((value) => !value),
  }), [
    session,
    profile,
    initialized,
    profileQuery.isLoading,
    authError,
    darkMode,
    language,
    t,
    notificationState,
    signIn,
    signOut,
    sendPasswordReset,
    setPassword,
    setLanguage,
    requestNotifications,
    refreshProfile,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

export function useApp(): AppContextValue {
  const context = React.useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
