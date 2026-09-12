import { supabaseUrl } from './supabase';

/** Real reachability probe: any HTTP response (even 4xx/5xx) means the network path works. */
export async function probeInternet(timeoutMs = 5000): Promise<boolean> {
  const base = supabaseUrl?.replace(/\/$/, '');
  const url = base ? `${base}/auth/v1/health` : 'https://clients3.google.com/generate_204';
  try {
    await fetch(url, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}
