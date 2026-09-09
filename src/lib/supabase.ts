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

type SecureManifest = { bank: 'a' | 'b' | null; count: number };

function parseSecureManifest(raw: string | null): SecureManifest | null {
  if (raw === null) return null;
  const versioned = /^v2:([ab]):([1-9][0-9]*)$/.exec(raw);
  if (versioned) return { bank: versioned[1] as 'a' | 'b', count: Number(versioned[2]) };
  const count = Number.parseInt(raw, 10);
  return Number.isFinite(count) && count >= 1 ? { bank: null, count } : null;
}

export function parseManifestCount(raw: string | null): number | null {
  return parseSecureManifest(raw)?.count ?? null;
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

function chunkKey(key: string, bank: SecureManifest['bank'], index: number): string {
  return secureKey(key, bank ? `${bank}.${index}` : String(index));
}

async function repairOrphans(key: string, manifest: SecureManifest) {
  await Promise.all(
    Array.from({ length: manifest.count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, manifest.bank, index)).catch(() => undefined),
    ),
  );
  await SecureStore.deleteItemAsync(secureKey(key, 'chunks')).catch(() => undefined);
}

const secureStorage = {
  async getItem(key: string) {
    const manifest = parseSecureManifest(await SecureStore.getItemAsync(secureKey(key, 'chunks')));
    if (manifest === null) return SecureStore.getItemAsync(secureKey(key));
    const values = await Promise.all(
      Array.from({ length: manifest.count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, manifest.bank, index))),
    );
    if (values.some((value) => value === null)) {
      await repairOrphans(key, manifest);
      return null;
    }
    return values.join('');
  },
  async setItem(key: string, value: string) {
    const previous = parseSecureManifest(await SecureStore.getItemAsync(secureKey(key, 'chunks')));
    const nextBank: 'a' | 'b' = previous?.bank === 'a' ? 'b' : 'a';
    const chunks = chunkByBytes(value, chunkSize);
    if (chunks.length === 0) chunks.push('');
    try {
      await Promise.all(
        chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, nextBank, index), chunk)),
      );
      await SecureStore.setItemAsync(secureKey(key, 'chunks'), `v2:${nextBank}:${chunks.length}`);
    } catch (error) {
      await Promise.all(
        chunks.map((_, index) => SecureStore.deleteItemAsync(chunkKey(key, nextBank, index)).catch(() => undefined)),
      );
      throw error;
    }
    if (previous) {
      await Promise.all(
        Array.from({ length: previous.count }, (_, index) =>
          SecureStore.deleteItemAsync(chunkKey(key, previous.bank, index)).catch(() => undefined),
        ),
      );
    }
  },
  async removeItem(key: string) {
    const manifest = parseSecureManifest(await SecureStore.getItemAsync(secureKey(key, 'chunks')));
    if (manifest) {
      await Promise.all(
        Array.from({ length: manifest.count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, manifest.bank, index))),
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
