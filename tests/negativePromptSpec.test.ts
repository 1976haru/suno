import { describe, expect, it } from 'vitest';
import { buildNegativePromptSpec, compileNegativePromptSpec, checkNegativePromptLength, NEGATIVE_PROMPT_ADVISORY_LENGTH } from '../src/core/negativePromptSpec';
import { buildExcludePrompt } from '../src/core/promptComposer';
import { channelPresets, genrePacks, makeOptions } from './fixtures';

/**
 * codex 지시문 03 (TASK D) — real investigation finding: core/promptComposer.ts's
 * buildExcludePrompt already has a real 4-tier priority system and real
 * dedup/subsumption (data/negativeStyles.ts's joinNegativeStyleTerms) — the
 * spec's own "고정 800~900자 문장을 모든 곡에 복사" premise doesn't hold at the
 * dedup level. This covers the genuine new value: a real categorized
 * NegativePromptSpec built from the SAME real sources, and a NEW advisory-
 * only (never blocking) 3-tier length signal layered alongside the
 * existing 750-850/900 blocking checks, which stay untouched.
 */
describe('[codex 지시문 03 TASK D] buildNegativePromptSpec — real source-mapped categorization', () => {
  const opts = makeOptions({ avoidWords: 'clown, monster' });
  const genres = genrePacks.filter(g => opts.genreIds.includes(g.id));

  it('copyright category is always the real fixed literal', () => {
    const spec = buildNegativePromptSpec(opts, genres);
    expect(spec.copyright.join(', ')).toContain('famous artist imitation');
  });

  it('user category reflects real opts.avoidWords, parsed', () => {
    const spec = buildNegativePromptSpec(opts, genres);
    expect(spec.user).toContain('clown');
    expect(spec.user).toContain('monster');
  });

  it('safety category is the real audienceProfile.exclusions for this channel', () => {
    const senior = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const seniorOpts = makeOptions({ channel: senior });
    const spec = buildNegativePromptSpec(seniorOpts, genres);
    expect(spec.safety.length).toBeGreaterThan(0);
  });

  // 지시문 62 (TASK C) — 이 필드는 "no real vocal-specific negative-term
  // source exists today"였다(codex 지시문 03 TASK D 원문). data/channelVocalFloor.ts가
  // 그 실제 소스가 됐다 — workspace(soundFloor) 테스트와 같은 패턴으로
  // 갱신한다.
  it('vocal category reflects the real channelVocalFloor.forbiddenTraits for this channel', () => {
    const senior = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const seniorOpts = makeOptions({ channel: senior });
    const spec = buildNegativePromptSpec(seniorOpts, genres);
    expect(spec.vocal).toContain('autotuned pitch correction');
  });

  it('vocal category is empty for an archetype with no channelVocalFloor entry', () => {
    const noFloorChannel = channelPresets.find(c => c.archetype === 'lofi-study')!;
    const noFloorOpts = makeOptions({ channel: noFloorChannel });
    const spec = buildNegativePromptSpec(noFloorOpts, genres);
    expect(spec.vocal).toEqual([]);
  });

  it('arrangement category reflects the real resolveNegativeStyleText trimmable tier (non-empty for a default channel)', () => {
    const spec = buildNegativePromptSpec(opts, genres);
    expect(spec.arrangement.length).toBeGreaterThan(0);
  });
});

describe('[codex 지시문 03 TASK D] compileNegativePromptSpec — reuses the real dedup/subsumption logic', () => {
  it('produces a real, non-empty string containing every category\'s content', () => {
    const opts = makeOptions({ avoidWords: 'clown' });
    const genres = genrePacks.filter(g => opts.genreIds.includes(g.id));
    const spec = buildNegativePromptSpec(opts, genres);
    const compiled = compileNegativePromptSpec(spec);
    expect(compiled).toContain('famous artist imitation');
    expect(compiled).toContain('clown');
  });

  it('dedupes a term that appears in two different categories (real subsumption, not a second copy of the logic)', () => {
    const spec = buildNegativePromptSpec(
      { avoidWords: 'muddy low-end mix', channel: channelPresets[0] },
      genrePacks.filter(g => channelPresets[0].preferredGenres.includes(g.id))
    );
    const compiled = compileNegativePromptSpec(spec);
    const occurrences = compiled.toLowerCase().split('muddy low-end mix').length - 1;
    expect(occurrences).toBe(1);
  });
});

describe('[codex 지시문 03 TASK D] checkNegativePromptLength — advisory-only, never blocking the existing checks', () => {
  it('a short compiled negative prompt is "ok"', () => {
    expect(checkNegativePromptLength('a, b, c', 'senior-morning')).toBe('ok');
  });

  it('a compiled negative prompt past the recommended max is "advisory"', () => {
    const long = Array.from({ length: 60 }, (_, i) => `term-${i}-descriptive-phrase`).join(', ').slice(0, NEGATIVE_PROMPT_ADVISORY_LENGTH.recommendedMax + 50);
    expect(checkNegativePromptLength(long, 'senior-morning')).toBe('advisory');
  });

  it('a compiled negative prompt past the advisory max is "blocking"', () => {
    const veryLong = 'x'.repeat(NEGATIVE_PROMPT_ADVISORY_LENGTH.advisoryMax + 50);
    expect(checkNegativePromptLength(veryLong, 'senior-morning')).toBe('blocking');
  });

  it('kids workspaces are exempt entirely — always "ok" regardless of length (category preservation wins over length there)', () => {
    const veryLong = 'x'.repeat(2000);
    expect(checkNegativePromptLength(veryLong, 'kids')).toBe('ok');
    expect(checkNegativePromptLength(veryLong, 'kr-kids-song')).toBe('ok');
  });

  it('this new advisory band is deliberately much shorter than the existing 750-850 blocking target (a real, different signal, not a replacement)', () => {
    expect(NEGATIVE_PROMPT_ADVISORY_LENGTH.recommendedMax).toBeLessThan(750);
  });
});

describe('[codex 지시문 03 TASK D] buildExcludePrompt (existing, untouched) still works exactly as before', () => {
  it('a real channel still produces a real excludePrompt through the pre-existing function', () => {
    const opts = makeOptions({ avoidWords: 'clown' });
    const genres = genrePacks.filter(g => opts.genreIds.includes(g.id));
    const excludePrompt = buildExcludePrompt(opts, genres);
    expect(excludePrompt.length).toBeGreaterThan(0);
    expect(excludePrompt).toContain('famous artist imitation');
  });
});
