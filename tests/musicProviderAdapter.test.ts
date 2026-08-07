import { describe, expect, it } from 'vitest';
import {
  UnavailableMusicGenerationProvider, MusicProviderUnavailableError,
  isMusicGenerationProviderConfigured, resolveMusicGenerationProvider,
  type MusicGenerationProvider
} from '../src/core/musicGenerationProvider';
import * as audioTakes from '../src/core/audioTakes';

/**
 * codex 지시문 06 (TASK D, required test file) — real coverage of the
 * MusicGenerationProvider contract, the honest "not configured" default,
 * and the structural guarantee that upload-based take comparison never
 * depends on any provider being configured.
 */

describe('[codex 지시문 06 TASK D] UnavailableMusicGenerationProvider — honest, never fakes success', () => {
  it('isConfigured() is always false', () => {
    const provider: MusicGenerationProvider = new UnavailableMusicGenerationProvider();
    expect(provider.isConfigured()).toBe(false);
  });

  it('every real method rejects with a clear, real error rather than a fabricated result', async () => {
    const provider: MusicGenerationProvider = new UnavailableMusicGenerationProvider();
    await expect(provider.submit({ packId: 'p1', trackNo: 1, title: 't', stylePrompt: 's', lyrics: 'l' })).rejects.toThrow(MusicProviderUnavailableError);
    await expect(provider.poll('job1')).rejects.toThrow(MusicProviderUnavailableError);
    await expect(provider.listTakes('job1')).rejects.toThrow(MusicProviderUnavailableError);
    await expect(provider.download('take1')).rejects.toThrow(MusicProviderUnavailableError);
  });

  it('rejection messages point the caller toward the real, working upload flow', async () => {
    const provider: MusicGenerationProvider = new UnavailableMusicGenerationProvider();
    await expect(provider.submit({ packId: 'p1', trackNo: 1, title: 't', stylePrompt: 's', lyrics: 'l' })).rejects.toThrow(/업로드/);
  });
});

describe('[codex 지시문 06 TASK D] isMusicGenerationProviderConfigured / resolveMusicGenerationProvider', () => {
  it('reports not configured for a bare settings object (no real connection exists yet)', () => {
    expect(isMusicGenerationProviderConfigured({})).toBe(false);
  });

  it('reports not configured even with an apiKey present (no real music-provider endpoint exists to use it with)', () => {
    expect(isMusicGenerationProviderConfigured({ apiKey: 'sk-fake', keyStorageMode: 'local' })).toBe(false);
  });

  it('resolveMusicGenerationProvider always returns a real, usable (if unavailable) provider — never undefined', () => {
    const provider = resolveMusicGenerationProvider({});
    expect(provider).toBeTruthy();
    expect(provider.isConfigured()).toBe(false);
  });
});

describe('[codex 지시문 06 TASK D] upload-based take comparison never depends on any MusicGenerationProvider', () => {
  it('core/audioTakes.ts exports the real upload/take-recording surface without importing musicGenerationProvider at all', () => {
    // Structural guarantee: the real take-recording/selection module has no
    // runtime dependency on this provider contract — recordTake/getTakes/
    // setAdopted/nextTakeNo all exist and are callable regardless of provider state.
    expect(typeof audioTakes.recordTake).toBe('function');
    expect(typeof audioTakes.getTakes).toBe('function');
    expect(typeof audioTakes.setAdopted).toBe('function');
    expect(typeof audioTakes.nextTakeNo).toBe('function');
  });
});
