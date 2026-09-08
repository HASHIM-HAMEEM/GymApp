import { StartupState } from '@/components/StartupState';

/**
 * Session router. It remains the root anchor so protected-route fallbacks
 * always resolve deterministically instead of landing on an auth callback.
 */
export default function Index() {
  return <StartupState />;
}
