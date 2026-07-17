import { describe, expect, it } from 'vitest';
import { mergeRestoredProviderSettings, sanitizeProviderSettingsForPersistence } from '../src/core/providerSettingsPersistence';
import type { ProviderSettings } from '../src/types';

/**
 * TASK v3.17 — App.tsx's `provider` useState had no persistence anywhere,
 * so every page refresh / dev-server restart silently reset it to 'local'
 * even after the user picked Anthropic. These are the two pure functions
 * that back App.tsx's persistProvider callback and its restore-on-mount
 * effect (see App.tsx around PROVIDER_SETTINGS_KEY).
 *
 * Note: settingsStore.ts calls `indexedDB.open(...)` directly with no
 * Node fallback (unlike src/core/library.ts, which falls back to an
 * in-memory Map when `typeof indexedDB === 'undefined'`), and this repo
 * has no jsdom/testing-library dependency to render App.tsx (see
 * tests/stress.test.ts's S8 note on deliberately not adding
 * fake-indexeddb either) — so these tests exercise the pure persistence
 * logic directly rather than spying on getSetting/setSetting through a
 * rendered component.
 */
describe('[v3.17] sanitizeProviderSettingsForPersistence', () => {
  it('strips apiKey before the object would be handed to setSetting', () => {
    const next: ProviderSettings = {
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      temperature: 0.8,
      apiKey: 'sk-ant-super-secret-should-not-persist'
    };
    const persisted = sanitizeProviderSettingsForPersistence(next);
    expect(persisted).not.toHaveProperty('apiKey');
    expect(JSON.stringify(persisted)).not.toContain('sk-ant-super-secret-should-not-persist');
  });

  it('strips accessToken as well', () => {
    const next: ProviderSettings = {
      provider: 'anthropic',
      temperature: 0.8,
      accessToken: 'gate-token-should-not-persist'
    };
    const persisted = sanitizeProviderSettingsForPersistence(next);
    expect(persisted).not.toHaveProperty('accessToken');
    expect(JSON.stringify(persisted)).not.toContain('gate-token-should-not-persist');
  });

  it('keeps non-sensitive fields — provider, model, temperature, keyStorageMode', () => {
    const next: ProviderSettings = {
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      temperature: 0.7,
      keyStorageMode: 'local',
      batchSize: 6,
      apiKey: 'secret',
      accessToken: 'secret-token'
    };
    const persisted = sanitizeProviderSettingsForPersistence(next);
    expect(persisted).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      temperature: 0.7,
      keyStorageMode: 'local',
      batchSize: 6
    });
  });
});

describe('[v3.17] mergeRestoredProviderSettings', () => {
  it('restores a saved provider (e.g. anthropic) over the local-only useState default', () => {
    const initial: ProviderSettings = { provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' };
    const saved: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-5', temperature: 0.8, keyStorageMode: 'local' };
    const merged = mergeRestoredProviderSettings(initial, saved);
    expect(merged.provider).toBe('anthropic');
    expect(merged.model).toBe('claude-sonnet-5');
    expect(merged.keyStorageMode).toBe('local');
  });

  it('leaves the initial state untouched when nothing was saved yet (undefined/null)', () => {
    const initial: ProviderSettings = { provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' };
    expect(mergeRestoredProviderSettings(initial, undefined)).toEqual(initial);
    expect(mergeRestoredProviderSettings(initial, null)).toEqual(initial);
  });

  it('leaves the initial state untouched when the saved record has no provider field (corrupt/legacy value)', () => {
    const initial: ProviderSettings = { provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' };
    const corrupt = { temperature: 0.9 } as ProviderSettings;
    expect(mergeRestoredProviderSettings(initial, corrupt)).toEqual(initial);
  });

  it('never restores apiKey or accessToken even if an old stored record somehow carried one', () => {
    const initial: ProviderSettings = { provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' };
    const savedWithLeakedSecrets = {
      provider: 'anthropic',
      temperature: 0.8,
      apiKey: 'sk-ant-leaked',
      accessToken: 'leaked-token'
    } as ProviderSettings;
    const merged = mergeRestoredProviderSettings(initial, savedWithLeakedSecrets);
    expect(merged.apiKey).toBeUndefined();
    expect(merged.accessToken).toBeUndefined();
  });

  it('round-trips: sanitize -> (simulated) storage -> merge reproduces the persisted fields without secrets', () => {
    const initial: ProviderSettings = { provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' };
    const userChoice: ProviderSettings = {
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      temperature: 0.9,
      keyStorageMode: 'local',
      apiKey: 'sk-ant-should-not-round-trip',
      accessToken: 'should-not-round-trip'
    };

    // What persistProvider would hand to setSetting:
    const storedRecord = sanitizeProviderSettingsForPersistence(userChoice);
    // What the mount-time effect would get back from getSetting on next launch:
    const restored = mergeRestoredProviderSettings(initial, storedRecord as ProviderSettings);

    expect(restored.provider).toBe('anthropic');
    expect(restored.model).toBe('claude-opus-4-8');
    expect(restored.temperature).toBe(0.9);
    expect(restored.keyStorageMode).toBe('local');
    expect(restored.apiKey).toBeUndefined();
    expect(restored.accessToken).toBeUndefined();
  });
});
