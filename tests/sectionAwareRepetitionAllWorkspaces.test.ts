import { describe, expect, it } from 'vitest';
import { parseLyricsSections } from '../src/core/lyricsAst';
import {
  findLongTextCopyAcrossSections,
  findExcessNonChorusLineRepeats,
  maxNonChorusLineRepeatsAllowed,
  checkSectionAwareRepetition
} from '../src/core/sectionAwareRepetition';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import type { ChannelArchetype } from '../src/types';

/**
 * codex 지시문 03 (TASK F) — real gap this closes: no section-aware
 * repetition check existed anywhere (see src/core/sectionAwareRepetition.ts's
 * own doc comment). ALLOW: chorus<->final-chorus repetition (this app's own
 * by-design convention), hook repeats, kids' pedagogical repetition (real
 * per-age-tier ceiling via data/kidsAgeTiers.ts's minHookRepeats).
 * BLOCK: verse<->verse / bridge<->verse long-text copy, the same sentence
 * 3+ times across different non-chorus sections.
 */
describe('[codex 지시문 03 TASK F] findLongTextCopyAcrossSections', () => {
  it('flags a real near-verbatim copy between two different verses', () => {
    const sections = parseLyricsSections(
      '[verse 1]\nWalking down the empty street tonight alone\nThinking of the days we used to know\n\n[verse 2]\nWalking down the empty street tonight alone\nSomething different here instead'
    );
    expect(findLongTextCopyAcrossSections(sections).length).toBeGreaterThan(0);
  });

  it('flags a real near-verbatim copy between a bridge and a verse', () => {
    const sections = parseLyricsSections(
      '[verse 1]\nWalking down the empty street tonight alone\nThinking of the days we used to know\n\n[short bridge]\nWalking down the empty street tonight alone\nEverything is different now'
    );
    expect(findLongTextCopyAcrossSections(sections).length).toBeGreaterThan(0);
  });

  it('never flags chorus <-> final-chorus repetition (by-design, not a defect)', () => {
    const sections = parseLyricsSections(
      '[chorus]\nHold on to this feeling tonight my love\nWe will never let it go\n\n[final chorus]\nHold on to this feeling tonight my love\nWe will never let it go'
    );
    expect(findLongTextCopyAcrossSections(sections)).toHaveLength(0);
  });

  it('does not flag two genuinely different verses', () => {
    const sections = parseLyricsSections(
      '[verse 1]\nMorning light comes soft across the floor\nCoffee steam rises slow and warm\n\n[verse 2]\nEvening falls quiet on the old back porch\nCrickets sing the summer down'
    );
    expect(findLongTextCopyAcrossSections(sections)).toHaveLength(0);
  });

  it('a short accidental overlap of a few common words is not flagged', () => {
    const sections = parseLyricsSections(
      '[verse 1]\nWe will always remember this town\n\n[verse 2]\nWe will find another way home somehow'
    );
    expect(findLongTextCopyAcrossSections(sections)).toHaveLength(0);
  });
});

describe('[codex 지시문 03 TASK F] findExcessNonChorusLineRepeats', () => {
  it('flags a real sentence appearing in 3+ different non-chorus sections (default, non-kids)', () => {
    const sections = parseLyricsSections(
      '[verse 1]\nHold my hand and never let go\n\n[pre-chorus]\nHold my hand and never let go\n\n[short bridge]\nHold my hand and never let go'
    );
    const findings = findExcessNonChorusLineRepeats(sections);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('does not flag a line repeated within its own single section only (call-and-response/chant device)', () => {
    const sections = parseLyricsSections('[verse 1]\nClap your hands\nClap your hands\nClap your hands');
    expect(findExcessNonChorusLineRepeats(sections)).toHaveLength(0);
  });

  it('does not flag when the same line appears in only 2 different sections (under the default limit of 2)', () => {
    const sections = parseLyricsSections('[verse 1]\nHold my hand and never let go\n\n[short bridge]\nHold my hand and never let go');
    expect(findExcessNonChorusLineRepeats(sections)).toHaveLength(0);
  });

  it('kids workspaces get a real, higher per-age-tier ceiling (minHookRepeats) rather than the default', () => {
    expect(maxNonChorusLineRepeatsAllowed('kids-t1')).toBe(6);
    expect(maxNonChorusLineRepeatsAllowed('kids-t2')).toBe(5);
    expect(maxNonChorusLineRepeatsAllowed('kids-t3')).toBe(4);
    expect(maxNonChorusLineRepeatsAllowed(undefined)).toBe(2);
  });

  it('a repetition pattern that would fail the default limit passes under a kids age tier\'s real, higher ceiling', () => {
    const sections = parseLyricsSections(
      '[verse 1]\nWash your hands and count to ten\n\n[pre-chorus]\nWash your hands and count to ten\n\n[short bridge]\nWash your hands and count to ten'
    );
    expect(findExcessNonChorusLineRepeats(sections)).toHaveLength(1);
    expect(findExcessNonChorusLineRepeats(sections, 'kids-t1')).toHaveLength(0);
  });
});

describe('[codex 지시문 03 TASK F] checkSectionAwareRepetition — combined entry point', () => {
  it('returns findings from both sub-checks', () => {
    const sections = parseLyricsSections(
      '[verse 1]\nWalking down the empty street tonight alone\nThinking of the days we used to know\n\n[verse 2]\nWalking down the empty street tonight alone\nSomething different here instead'
    );
    const findings = checkSectionAwareRepetition(sections);
    expect(findings.some(f => f.kind === 'long-text-copy')).toBe(true);
  });
});

const WORKSPACE_ARCHETYPES: ChannelArchetype[] = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-kids-song', 'jp-kids-song', 'kr-idol-male', 'kr-idol-female'];

describe('[codex 지시문 03 TASK F] real generated lyrics across all 7 workspaces have zero long-text-copy violations', () => {
  it.each(WORKSPACE_ARCHETYPES)('%s: a real 6-song local-generation fixture never copies a verse/bridge verbatim into another section', archetype => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel, `no channel for ${archetype}`).toBeDefined();
    const genres = genrePacks.filter(g => channel!.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel!.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: channel!, songCount: 6 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    for (const song of blueprint.songs) {
      const sections = parseLyricsSections(song.lyrics);
      const findings = findLongTextCopyAcrossSections(sections);
      expect(findings, `${archetype} track ${song.trackNo}: ${findings.map(f => f.detail).join(' | ')}`).toHaveLength(0);
    }
  });
});
