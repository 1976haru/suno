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

/**
 * codex 지시문 01 (TASK J) — coverage for the real gaps found by direct
 * investigation before writing this: kidsAgeTierId was never checked at
 * all; the old vocalQuotaOverride check only summed the 3 fields (a NaN
 * or a single negative field offset by a larger positive one both
 * silently passed); preferredGenres/preferredMoods/forbiddenCliches/
 * seoKeywords were assumed to already be real arrays with no runtime
 * guard, which would throw (not produce a validation error) on a
 * hand-edited blob carrying the wrong type.
 */
describe('[codex 지시문 01 TASK J] validateChannelProfile — kidsAgeTierId / vocalQuota / array-shape', () => {
  it('allows an undefined kidsAgeTierId (non-kids channel)', () => {
    const channel = normalizeChannel({ name: 'Test' });
    expect(validateChannelProfile(channel).valid).toBe(true);
  });

  it('allows a real kidsAgeTierId', () => {
    const channel = normalizeChannel({ name: 'Test', kidsAgeTierId: 'kids-t2' });
    expect(validateChannelProfile(channel).valid).toBe(true);
  });

  it('flags an unknown kidsAgeTierId value', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, kidsAgeTierId: 'kids-t99' as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('kidsAgeTierId'))).toBe(true);
  });

  it('flags a NaN vocalQuotaOverride field even though the 3-way sum would otherwise look positive', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, vocalQuotaOverride: { male: NaN, female: 10, mixed: 10 } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('male') && e.includes('숫자'))).toBe(true);
  });

  it('flags a negative vocalQuotaOverride field even though a larger positive field offsets the sum', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, vocalQuotaOverride: { male: -5, female: 20, mixed: 0 } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('male') && e.includes('음수'))).toBe(true);
  });

  it('flags preferredGenres when it is not a real array', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, preferredGenres: 'pop' as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('preferredGenres'))).toBe(true);
  });

  it('flags preferredMoods when it is not a real array', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, preferredMoods: { bad: true } as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('preferredMoods'))).toBe(true);
  });

  it('flags forbiddenCliches/seoKeywords when present but not real arrays', () => {
    const channel = normalizeChannel({ name: 'Test' });
    const result = validateChannelProfile({ ...channel, forbiddenCliches: 'x' as never, seoKeywords: 42 as never });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('forbiddenCliches'))).toBe(true);
    expect(result.errors.some(e => e.includes('seoKeywords'))).toBe(true);
  });
});

/**
 * codex 지시문 01 (TASK J) — real gap this closes: normalizeChannel used to
 * pass `input.preferredGenres`/etc. straight through by reference whenever
 * non-empty, so two channels normalized from the same source array could
 * end up sharing the identical array object. Confirms the fix: mutating
 * the INPUT array after normalizing never leaks into the returned channel.
 */
describe('[codex 지시문 01 TASK J] normalizeChannel — array fields are real copies, not shared references', () => {
  it('preferredGenres is a copy — mutating the input array does not affect the normalized channel', () => {
    const input = ['adult-contemporary', 'acoustic-pop'];
    const channel = normalizeChannel({ name: 'Test', preferredGenres: input });
    input.push('injected-genre');
    expect(channel.preferredGenres).not.toContain('injected-genre');
  });

  it('two channels normalized from the SAME input array never share the returned array reference', () => {
    const shared = ['warm', 'hopeful'];
    const channelA = normalizeChannel({ name: 'A', preferredMoods: shared });
    const channelB = normalizeChannel({ name: 'B', preferredMoods: shared });
    expect(channelA.preferredMoods).not.toBe(channelB.preferredMoods);
    channelA.preferredMoods.push('mutated-on-a');
    expect(channelB.preferredMoods).not.toContain('mutated-on-a');
  });

  it('forbiddenCliches/seoKeywords are also real copies, not the same reference as the input', () => {
    const cliches = ['famous artist imitation'];
    const keywords = ['music', 'playlist'];
    const channel = normalizeChannel({ name: 'Test', forbiddenCliches: cliches, seoKeywords: keywords });
    expect(channel.forbiddenCliches).not.toBe(cliches);
    expect(channel.seoKeywords).not.toBe(keywords);
  });
});
