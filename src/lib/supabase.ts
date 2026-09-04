import 'react-native-url-polyfill/auto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const chunkSize = 1800;

const webStorage = {
  async getItem(key: string) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const secureStorage = {
  async getItem(key: string) {
    const countValue = await SecureStore.getItemAsync(`${key}:chunks`);
    if (!countValue) return SecureStore.getItemAsync(key);
    const count = Number.parseInt(countValue, 10);
    if (!Number.isFinite(count) || count < 1) return null;
    const values = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}:${index}`)),
    );
    return values.some((value) => value === null) ? null : values.join('');
  },
  async setItem(key: string, value: string) {
    await this.removeItem(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / chunkSize) },
      (_, index) => value.slice(index * chunkSize, (index + 1) * chunkSize),
    );
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}:${index}`, chunk)));
    await SecureStore.setItemAsync(`${key}:chunks`, String(chunks.length));
  },
  async removeItem(key: string) {
    const countValue = await SecureStore.getItemAsync(`${key}:chunks`);
    const count = Number.parseInt(countValue ?? '0', 10);
    if (Number.isFinite(count) && count > 0) {
      await Promise.all(
        Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${key}:${index}`)),
      );
    }
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}:chunks`),
      SecureStore.deleteItemAsync(key),
    ]);
  },
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const authRedirectUrl =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() || Linking.createURL('confirm');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        storage: Platform.OS === 'web' ? webStorage : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return supabase;
}

export function listenForAuthRefresh() {
  if (!supabase || Platform.OS === 'web') return () => undefined;
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
  return () => subscription.remove();
}
