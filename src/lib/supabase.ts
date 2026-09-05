import 'react-native-url-polyfill/auto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const chunkSize = 1800;

function secureKey(key: string, suffix?: string) {
  const normalized = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return suffix ? `${normalized}.${suffix}` : normalized;
}

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

function chunkByBytes(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (utf8ByteLength(value.slice(start, i + 1)) > maxBytes) {
      chunks.push(value.slice(start, i));
      start = i;
    }
  }
  if (start < value.length) chunks.push(value.slice(start));
  return chunks;
}

export function parseManifestCount(raw: string | null): number | null {
  if (raw === null) return null;
  const count = Number.parseInt(raw, 10);
  return Number.isFinite(count) && count >= 1 ? count : null;
}

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

async function repairOrphans(key: string, count: number) {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(secureKey(key, String(index))).catch(() => undefined),
    ),
  );
  await SecureStore.deleteItemAsync(secureKey(key, 'chunks')).catch(() => undefined);
}

const secureStorage = {
  async getItem(key: string) {
    const count = parseManifestCount(await SecureStore.getItemAsync(secureKey(key, 'chunks')));
    if (count === null) return SecureStore.getItemAsync(secureKey(key));
    const values = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(secureKey(key, String(index)))),
    );
    if (values.some((value) => value === null)) {
      await repairOrphans(key, count);
      return null;
    }
    return values.join('');
  },
  async setItem(key: string, value: string) {
    const previousCount = parseManifestCount(await SecureStore.getItemAsync(secureKey(key, 'chunks'))) ?? 0;
    const chunks = chunkByBytes(value, chunkSize);
    try {
      await Promise.all(
        chunks.map((chunk, index) => SecureStore.setItemAsync(secureKey(key, String(index)), chunk)),
      );
    } catch {
      return;
    }
    await SecureStore.setItemAsync(secureKey(key, 'chunks'), String(chunks.length));
    if (previousCount > chunks.length) {
      await Promise.all(
        Array.from({ length: previousCount - chunks.length }, (_, offset) =>
          SecureStore.deleteItemAsync(secureKey(key, String(chunks.length + offset))).catch(() => undefined),
        ),
      );
    }
  },
  async removeItem(key: string) {
    const count = parseManifestCount(await SecureStore.getItemAsync(secureKey(key, 'chunks'))) ?? 0;
    if (count > 0) {
      await Promise.all(
        Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(secureKey(key, String(index)))),
      );
    }
    await Promise.all([
      SecureStore.deleteItemAsync(secureKey(key, 'chunks')),
      SecureStore.deleteItemAsync(secureKey(key)),
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
