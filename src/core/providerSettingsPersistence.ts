import type { ProviderSettings } from '../types';

/**
 * TASK v3.17 — provider selection lived in App.tsx's useState only, with no
 * persistence anywhere, so every page refresh or dev-server restart reset
 * it to 'local' even after the user picked Anthropic in settings. These two
 * pure helpers own the persistence rules so they're testable without
 * rendering App.tsx (this repo has no jsdom/testing-library dependency —
 * see tests/stress.test.ts's S8 note on deliberately not adding
 * fake-indexeddb either).
 *
 * apiKey is excluded because it already lives at byok:{provider} in
 * IndexedDB (see SettingsModal) — re-storing it here would duplicate a
 * secret across two keys. accessToken is excluded because it's likewise
 * sensitive and not worth persisting.
 */
export function sanitizeProviderSettingsForPersistence(next: ProviderSettings): Omit<ProviderSettings, 'apiKey' | 'accessToken'> {
  const { apiKey, accessToken, ...persistable } = next;
  void apiKey;
  void accessToken;
  return persistable;
}

export function mergeRestoredProviderSettings(prev: ProviderSettings, saved: ProviderSettings | undefined | null): ProviderSettings {
  if (!saved || !saved.provider) return prev;
  return { ...prev, ...saved, apiKey: undefined, accessToken: undefined };
}
