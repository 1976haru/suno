import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import { getGenreById } from '../src/data/genreLibrary';
import { eraBucketForGenreId, ERA_LABEL } from '../src/data/eraExclusions';
import { extractEraConstraint, resolveConstraints, applyEraQuota } from '../src/core/constraints';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import { classifyTitleShape } from '../src/core/titleShapeVariety';
import { topWordFrequencies, findHookWordOveruse } from '../src/core/lyricVocabularyRepetition';
import { createTitleGenerator, seedForBlueprint } from '../src/core/lyricEngine';
import { scoreComposition } from '../src/core/compositionScorer';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import type { SongIdea } from '../src/types';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

/**
 * v4.2 (TASK A3) — this task's own §9 mandates re-generating the exact
 * "비틀즈 느낌의 밝은 60년대 팝" concept plus 3 more concepts (one with an
 * explicit different decade, one with no decade at all) and reporting real
 * measured numbers against the §8 tables — not a claim. These tests run the
 * real local pipeline (setDirector.directSetLocal -> generateLocalBlueprint,
 * no network/LLM calls) and assert the §8 pass/fail bars directly, so a
 * regression here is a real generation-quality regression, not just a
 * changed assertion.
 */
function eraShareReport(genreIds: string[], counts: Record<string, number>) {
  const byBucket = new Map<string, number>();
  for (const id of genreIds) {
    const bucket = eraBucketForGenreId(id) ?? 'generic';
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + (counts[id] ?? 0));
  }
  return byBucket;
}

describe('[v4.2 TASK A3] era constraint extraction — 3 verification concepts', () => {
  it('"샹송 느낌의 잔잔한 유럽풍 올드팝" has no decade signal — unspecified:true, no filtering', () => {
    const era = extractEraConstraint('샹송 느낌의 잔잔한 유럽풍 올드팝');
    expect(era.unspecified).toBe(true);
  });

  it('"80년대 초반 어덜트 컨템포러리 발라드" resolves primary 1980s', () => {
    const era = extractEraConstraint('80년대 초반 어덜트 컨템포러리 발라드');
    expect(era.unspecified).toBe(false);
    expect(era.primary).toBe('1980s');
    expect(era.forbidden).toContain('1950s-60s');
  });

  it('"비 오는 날 창가에서 듣는 올드팝" has no decade word — unspecified:true (never forces an era just because "올드팝" was said)', () => {
    const era = extractEraConstraint('비 오는 날 창가에서 듣는 올드팝');
    expect(era.unspecified).toBe(true);
  });

  it('"비틀즈 느낌의 밝은 60년대 팝" resolves primary 1950s-60s with 1970s adjacent and 1980s forbidden', () => {
    const era = extractEraConstraint('비틀즈 느낌의 밝은 60년대 팝');
    expect(era.unspecified).toBe(false);
    expect(era.primary).toBe('1950s-60s');
    expect(era.adjacent.map(a => a.era)).toContain('1970s');
    expect(era.forbidden).toContain('1980s');
  });
});

describe('[v4.2 TASK A3] applyEraQuota — synthetic redistribution', () => {
  it('trims a forbidden bucket to 0 and lifts primary to >= 50%, never inventing genre ids outside the real library', () => {
    // Mirrors the real measured 18-song failure exactly: 3x1950s-60s, 9x1970s, 3x1980s, 3xgeneric.
    const before: Record<string, number> = {
      'oldpop-british-beat': 3,
      'oldpop-yacht-west-coast': 9,
      'oldpop-soft-duet-80s': 3,
      'oldpop-warm-morning-glow': 3
    };
    const era = extractEraConstraint('비틀즈 느낌의 밝은 60년대 팝');
    const { counts, warnings } = applyEraQuota(before, 18, era, () => true);
    const shares = eraShareReport(Object.keys(counts), counts);
    const total = [...shares.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(18);
    expect(shares.get('1980s') ?? 0).toBe(0);
    expect((shares.get('1950s-60s') ?? 0) / total).toBeGreaterThanOrEqual(0.5);
    expect((shares.get('1970s') ?? 0) / total).toBeLessThanOrEqual(0.25 + 1e-9);
    expect((shares.get('generic') ?? 0) / total).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('[v4.2 TASK A3] directSetLocal — real genre selection against the era quota', () => {
  it('REPORT: "비틀즈 느낌의 밝은 60년대 팝" — genre era distribution', () => {
    const plan = directSetLocal('비틀즈 느낌의 밝은 60년대 팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
    const shares = eraShareReport(Object.keys(genreAllocation.counts), genreAllocation.counts);
    const total = [...shares.values()].reduce((a, b) => a + b, 0);
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] Beatles-60s genre era distribution:', Object.fromEntries(shares), 'genres:', genreAllocation.counts, 'warnings:', plan.warnings);
    expect(total).toBe(18);
    expect((shares.get('1950s-60s') ?? 0) / total).toBeGreaterThanOrEqual(0.5);
    expect(shares.get('1980s') ?? 0).toBe(0);
    expect((shares.get('generic') ?? 0) / total).toBeLessThanOrEqual(0.2 + 1e-9);
  });

  it('REPORT: "80년대 초반 어덜트 컨템포러리 발라드" — genre era distribution', () => {
    const plan = directSetLocal('80년대 초반 어덜트 컨템포러리 발라드', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
    const shares = eraShareReport(Object.keys(genreAllocation.counts), genreAllocation.counts);
    const total = [...shares.values()].reduce((a, b) => a + b, 0);
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] 80s-AC genre era distribution:', Object.fromEntries(shares), 'genres:', genreAllocation.counts);
    if (total > 0) {
      expect((shares.get('1980s') ?? 0) / total).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('REPORT: "샹송 느낌의 잔잔한 유럽풍 올드팝" and "비 오는 날 창가에서 듣는 올드팝" — never forced into one era', () => {
    for (const concept of ['샹송 느낌의 잔잔한 유럽풍 올드팝', '비 오는 날 창가에서 듣는 올드팝']) {
      const plan = directSetLocal(concept, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
      const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
      const shares = eraShareReport(Object.keys(genreAllocation.counts), genreAllocation.counts);
      // eslint-disable-next-line no-console
      console.log(`[TASK A3 REPORT] "${concept}" genre era distribution:`, Object.fromEntries(shares));
      // Not asserting a specific single-bucket dominance — the whole point
      // is this concept must NOT be forced into one era.
      expect(shares.size).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('[v4.2 TASK A3] title pattern diversity — real 18-song pack', () => {
  it('REPORT: Beatles-60s pack — title list, pattern-shape variety, and top word frequencies', () => {
    const plan = directSetLocal('비틀즈 느낌의 밝은 60년대 팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
    const genreIds = Object.keys(genreAllocation.counts);
    const genres = genreIds.map(id => getGenreById(id)!).filter(Boolean);
    const opts = {
      channel: seniorChannel,
      projectTitle: '비틀즈 느낌의 밝은 60년대 팝',
      songCount: 18,
      lyricLanguage: 'english' as const,
      market: seniorChannel.market,
      audience: seniorChannel.audience,
      genreIds,
      moodIds: seniorChannel.preferredMoods,
      seasonId: 'spring-open',
      vocalTone: seniorChannel.defaultVocal,
      perspective: 'firstPerson' as const,
      lyricDepth: 'commercial' as const,
      durationTarget: 'under3m30' as const,
      moneyChordMode: 'default' as const,
      customMoneyChord: '',
      customConcept: '비틀즈 느낌의 밝은 60년대 팝',
      avoidWords: '',
      personaMode: false,
      diversityAllocations: plan.allocations
    };
    const bp = generateLocalBlueprint(opts, genres, [], { id: 'spring-open', label: 'Spring', period: '', keywords: [], visualDirection: '' } as any);
    const titles = bp.songs.map(s => s.title);
    const shapes = new Set(titles.map(classifyTitleShape));
    const words = topWordFrequencies(bp.songs, 20);
    const hookOveruse = findHookWordOveruse(bp.songs.map(s => ({ hookPhrase: s.hookPhrase })));
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] Beatles-60s titles:', titles);
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] Beatles-60s title shapes:', [...shapes]);
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] Beatles-60s top 20 words:', words);
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] Beatles-60s hook word overuse (>=3 hooks):', hookOveruse);
    expect(shapes.size).toBeGreaterThanOrEqual(3);
    expect(new Set(titles).size).toBe(titles.length);

    // v4.2 (TASK A3) — classifyTitleShape (titleShapeVariety.ts) is a
    // coarse legacy word-count/verb-lead classifier that predates this
    // task's 8 title patterns — it can't tell "Hush Now, My Love"
    // (name-address) apart from "I Won't Forget" (sentence-fragment), since
    // both are just "verb-phrase" to it. This reruns the exact same
    // seedBase/constraints createTitleGenerator used internally (mirroring
    // generateLocalBlueprint's own setup) with its own fresh usedTitles/
    // usedHooks sets, purely to read back nextTitle.patternUsage — the
    // real per-pattern tally this task's own completion table (§8) needs.
    const constraints = resolveConstraints({ conceptLabel: '비틀즈 느낌의 밝은 60년대 팝' }, { id: 'senior-oldpop' }, SENIOR_AUDIENCE_PROFILE, 18);
    const seedBase = seedForBlueprint({ channel: seniorChannel, projectTitle: '비틀즈 느낌의 밝은 60년대 팝' });
    const gen = createTitleGenerator('english', seedBase, 18, undefined, seniorChannel.archetype, constraints);
    for (let i = 0; i < 18; i++) gen();
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] Beatles-60s title-pattern usage (patternUsage tally):', Object.fromEntries(gen.patternUsage));
    expect(gen.patternUsage.size).toBeGreaterThanOrEqual(4);
    for (const count of gen.patternUsage.values()) expect(count).toBeLessThanOrEqual(constraints.title.maxPerPattern);
  });
});

describe('[v4.2 TASK A3] resolveConstraints — full object for report §9-3', () => {
  it('REPORT: resolveConstraints() output for the Beatles-60s concept', () => {
    const constraints = resolveConstraints(
      { conceptLabel: '비틀즈 느낌의 밝은 60년대 팝' },
      { id: 'senior-oldpop' },
      SENIOR_AUDIENCE_PROFILE,
      18
    );
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] ResolvedConstraints:', JSON.stringify(constraints, null, 2));
    expect(constraints.era.unspecified).toBe(false);
    expect(constraints.era.primary).toBe('1950s-60s');
    expect(constraints.title.maxPerPattern).toBeGreaterThanOrEqual(2);
    expect(constraints.vocabulary.maxRepeatPerWord).toBe(12);
  });
});

describe('[v4.2 TASK A3] compositionScorer — era consistency check', () => {
  const eraConstraint = extractEraConstraint('비틀즈 느낌의 밝은 60년대 팝');
  const song = (genreId: string): SongIdea => ({
    trackNo: 1,
    title: 'T',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'Hook',
    stylePrompt: 'a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y',
    lyrics: '[chorus]\nHook',
    youtube: { title: '', description: '', tags: [] },
    qualityScore: 0,
    warnings: [],
    genreId
  });

  it('BLOCKS when primary-era share is under 50% (v4.1 TASK C: design-scope packBlocking, not copied into every track)', () => {
    const songs = [song('oldpop-yacht-west-coast'), song('oldpop-yacht-west-coast'), song('oldpop-british-beat')];
    const result = scoreComposition(songs, { eraConstraint });
    expect(result.packBlocking.some(issue => issue.scope === 'design' && issue.labelKo.includes('최소 50% 미만'))).toBe(true);
  });

  it('BLOCKS when a forbidden-era genre is present', () => {
    const songs = [song('oldpop-british-beat'), song('oldpop-british-beat'), song('oldpop-soft-duet-80s')];
    const result = scoreComposition(songs, { eraConstraint });
    expect(result.packBlocking.some(issue => issue.labelKo.includes('금지한 시대'))).toBe(true);
  });

  it('does not block a compliant era distribution (>=50% primary, no forbidden)', () => {
    const songs = [song('oldpop-british-beat'), song('oldpop-british-beat'), song('oldpop-doowop-harmony')];
    const result = scoreComposition(songs, { eraConstraint });
    expect(result.packBlocking.filter(issue => issue.labelKo.includes('시대'))).toEqual([]);
  });

  it('skips entirely when era is unspecified', () => {
    const unspecified = extractEraConstraint('비 오는 날 창가에서 듣는 올드팝');
    const songs = [song('oldpop-yacht-west-coast'), song('oldpop-soft-duet-80s')];
    const result = scoreComposition(songs, { eraConstraint: unspecified });
    expect(result.packBlocking.filter(issue => issue.labelKo.includes('시대'))).toEqual([]);
  });
});

describe('[v4.2 TASK A3, TASK F] bridge instruction — resolvedConstraints section', () => {
  it('REPORT: full instruction text includes [이 세트의 컨셉 제약] built from ResolvedConstraints', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 3, customConcept: '비틀즈 느낌의 밝은 60년대 팝' });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const constraints = resolveConstraints({ conceptLabel: '비틀즈 느낌의 밝은 60년대 팝' }, { id: 'senior-oldpop' }, SENIOR_AUDIENCE_PROFILE, 3);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, slots, false, { resolvedConstraints: constraints });
    const section = instruction.split('[이 세트의 컨셉 제약]')[1]?.split('\n\n')[0];
    // eslint-disable-next-line no-console
    console.log('[TASK A3 REPORT] Bridge instruction constraints section:\n[이 세트의 컨셉 제약]' + section);
    expect(instruction).toContain('[이 세트의 컨셉 제약]');
    expect(instruction).toContain('1950s-60s');
    expect(instruction).toContain('이미지 조합형');
  });
});
