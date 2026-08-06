import { describe, expect, it } from 'vitest';
import { normalizeChannel, validateChannelProfile } from '../src/utils/channelProfile';
import { genrePacks, moodPacks } from '../src/data/presets';

/**
 * TASK v5.18 (TASK F, P2) — coverage for validateChannelProfile, the
 * present-but-wrong guard normalizeChannel itself doesn't provide (see that
 * function's own doc comment: it fills in what's MISSING, this checks what's
 * PRESENT but not a real/recognized value).
 */
describe('[v5.18 TASK F] validateChannelProfile', () => {
  it('a freshly normalized draft channel is valid', () => {
    const channel = normalizeChannel({ name: 'Test Channel' });
    const result = validateChannelProfile(channel);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags an unknown market value', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, market: 'atlantis' as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('market'))).toBe(true);
  });

  it('flags an unknown primaryLanguage value', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, primaryLanguage: 'klingon' as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('primaryLanguage'))).toBe(true);
  });

  it('flags an unknown audience value', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, audience: 'toddlers' as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('audience'))).toBe(true);
  });

  it('flags an unknown archetype value', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, archetype: 'not-a-real-archetype' as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('archetype'))).toBe(true);
  });

  it('allows an undefined archetype (legacy channel, not itself invalid)', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, archetype: undefined });
    expect(result.valid).toBe(true);
  });

  it('flags a preferredGenres id that does not exist in any real genre pack', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, preferredGenres: ['totally-made-up-genre-id'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('장르'))).toBe(true);
  });

  it('flags a preferredMoods id that does not exist in any real mood pack', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, preferredMoods: ['totally-made-up-mood-id'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('무드'))).toBe(true);
  });

  it('accepts real genre/mood ids drawn from the actual packs', () => {
    const channel = normalizeChannel({
      name: 'Test',
      preferredGenres: [genrePacks[0].id, genrePacks[1].id],
      preferredMoods: [moodPacks[0].id, moodPacks[1].id]
    });
    const result = validateChannelProfile(channel);
    expect(result.valid).toBe(true);
  });

  it('flags a vocalQuotaOverride whose three values are all zero (no generatable vocal slot)', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, vocalQuotaOverride: { male: 0, female: 0, mixed: 0 } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('vocalQuotaOverride'))).toBe(true);
  });

  it('allows a vocalQuotaOverride with at least one non-zero slot', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, vocalQuotaOverride: { male: 15, female: 0, mixed: 3 } });
    expect(result.valid).toBe(true);
  });

  it('flags a blank id/name even though normalizeChannel would never produce one directly', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, id: '  ', name: '  ' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
    expect(result.errors.some(e => e.includes('이름'))).toBe(true);
  });
});
