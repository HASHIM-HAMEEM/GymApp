/**
 * Compatibility re-export. The mock in-memory store was replaced by the
 * Supabase-backed provider in `src/providers/AppProvider.tsx`; screens and
 * components keep importing `useApp` from here.
 */
export { AppProvider, useApp } from '@/providers/AppProvider';
