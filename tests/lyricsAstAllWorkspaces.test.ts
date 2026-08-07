import { describe, expect, it } from 'vitest';
import {
  parseLyricsSections,
  findEmptyBridge,
  coldVocalIntroEmptyWarning,
  missingRequiredSections,
  rapSectionsMissingVocalist,
  duetPartDistributionIssue,
  instrumentalSectionsAllowedEmpty
} from '../src/core/lyricsAst';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import type { ChannelArchetype } from '../src/types';

/**
 * codex 지시문 03 (TASK E) — real gap this closes: nothing parsed raw
 * `lyrics: string` into a structured section tree before this (see
 * src/core/lyricsAst.ts's own doc comment — every existing consumer
 * independently re-split on `\n`/`[...]` and discarded tag identity).
 */
describe('[codex 지시문 03 TASK E] parseLyricsSections — real tag parsing', () => {
  it('classifies the real fixed section-tag vocabulary correctly', () => {
    const lyrics = '[short intro]\nla la\n\n[verse 1]\nline a\nline b\n\n[pre-chorus]\nbuild up\n\n[chorus]\nHook\nHook\n\n[verse 2]\nline c\n\n[short bridge]\nbridge line\n\n[final chorus]\nHook\nHook\n\n[end]';
    const sections = parseLyricsSections(lyrics);
    const types = sections.map(s => s.type);
    expect(types).toEqual(['intro', 'verse', 'pre-chorus', 'chorus', 'verse', 'bridge', 'final-chorus', 'outro']);
  });

  it('skips a leading vocal-meta-tag line (not a section)', () => {
    const sections = parseLyricsSections('[male vocal]\n[verse 1]\nline a');
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe('verse');
  });

  it('skips a Title: line', () => {
    const sections = parseLyricsSections('Title: My Song\n[verse 1]\nline a');
    expect(sections).toHaveLength(1);
    expect(sections[0].lines).toEqual(['line a']);
  });

  it('extracts a vocalist from a colon-suffixed tag (duet/idol-part shape)', () => {
    const sections = parseLyricsSections('[verse 1: male vocal]\nline a\n\n[chorus: male and female duet]\nHook');
    expect(sections[0].vocalist).toBe('male vocal');
    expect(sections[1].vocalist).toBe('male and female duet');
  });

  it('an instrumental section legitimately has zero lines', () => {
    const sections = parseLyricsSections('[intro]\n[instrumental]\n\n[verse 1]\nline a');
    const instrumental = sections.find(s => s.type === 'instrumental');
    expect(instrumental?.lines).toEqual([]);
  });

  it('production-adjective tags (key-lift final chorus, instrumental hook) still classify correctly', () => {
    expect(parseLyricsSections('[key-lift final chorus]\nHook')[0].type).toBe('final-chorus');
    expect(parseLyricsSections('[instrumental hook]')[0].type).toBe('instrumental');
    expect(parseLyricsSections('[rap verse: C]\nspit bars')[0].type).toBe('rap');
    expect(parseLyricsSections('[breakdown]')[0].type).toBe('breakdown');
    expect(parseLyricsSections('[post-chorus chant]\nhey hey')[0].type).toBe('post-chorus');
  });
});

describe('[codex 지시문 03 TASK E] findEmptyBridge', () => {
  it('flags a bridge tag with no lines under it', () => {
    const sections = parseLyricsSections('[verse 1]\nline a\n\n[short bridge]\n\n[chorus]\nHook');
    expect(findEmptyBridge(sections)).toHaveLength(1);
  });

  it('does not flag a real bridge with content', () => {
    const sections = parseLyricsSections('[short bridge]\nreal bridge line here');
    expect(findEmptyBridge(sections)).toHaveLength(0);
  });

  it('never flags an instrumental section as an "empty bridge" (different type entirely)', () => {
    const sections = parseLyricsSections('[instrumental]\n\n[chorus]\nHook');
    expect(findEmptyBridge(sections)).toHaveLength(0);
    expect(instrumentalSectionsAllowedEmpty(sections)).toHaveLength(1);
  });
});

describe('[codex 지시문 03 TASK E] coldVocalIntroEmptyWarning', () => {
  it('flags an empty [intro] when introMode expects an early sung line', () => {
    const sections = parseLyricsSections('[intro]\n\n[verse 1]\nline a');
    expect(coldVocalIntroEmptyWarning(sections, 'vocal-immediate')).toBeDefined();
    expect(coldVocalIntroEmptyWarning(sections, 'vocal-after-texture')).toBeDefined();
  });

  it('does not flag an empty [intro] when introMode is instrumental (correct, by design)', () => {
    const sections = parseLyricsSections('[intro]\n\n[verse 1]\nline a');
    expect(coldVocalIntroEmptyWarning(sections, 'instrumental')).toBeUndefined();
  });

  it('does not flag a real, non-empty intro', () => {
    const sections = parseLyricsSections('[intro]\nsung line here\n\n[verse 1]\nline a');
    expect(coldVocalIntroEmptyWarning(sections, 'vocal-immediate')).toBeUndefined();
  });

  it('is a no-op when there is no intro section at all', () => {
    const sections = parseLyricsSections('[verse 1]\nline a');
    expect(coldVocalIntroEmptyWarning(sections, 'vocal-immediate')).toBeUndefined();
  });
});

describe('[codex 지시문 03 TASK E] missingRequiredSections', () => {
  it('flags a song with no chorus at all', () => {
    const sections = parseLyricsSections('[verse 1]\nline a\n\n[verse 2]\nline b');
    expect(missingRequiredSections(sections)).toContain('chorus');
  });

  it('a real complete song has no missing required sections', () => {
    const sections = parseLyricsSections('[verse 1]\nline a\n\n[chorus]\nHook');
    expect(missingRequiredSections(sections)).toHaveLength(0);
  });
});

describe('[codex 지시문 03 TASK E] rapSectionsMissingVocalist / duetPartDistributionIssue', () => {
  it('flags a rap section with no vocalist assignment', () => {
    const sections = parseLyricsSections('[rap]\nspit bars');
    expect(rapSectionsMissingVocalist(sections)).toHaveLength(1);
  });

  it('does not flag a rap section with a real vocalist assignment', () => {
    const sections = parseLyricsSections('[rap: C]\nspit bars');
    expect(rapSectionsMissingVocalist(sections)).toHaveLength(0);
  });

  it('flags a duet whose sections never actually distribute two different vocalists', () => {
    const sections = parseLyricsSections('[verse 1]\nline a\n\n[chorus]\nHook');
    expect(duetPartDistributionIssue(sections, 'duet')).toBeDefined();
  });

  it('does not flag a real duet with two distinct vocalist assignments', () => {
    const sections = parseLyricsSections('[verse 1: male vocal]\nline a\n\n[verse 2: female vocal]\nline b');
    expect(duetPartDistributionIssue(sections, 'duet')).toBeUndefined();
  });

  it('is a no-op for a non-duet vocalGender', () => {
    const sections = parseLyricsSections('[verse 1]\nline a');
    expect(duetPartDistributionIssue(sections, 'male')).toBeUndefined();
  });
});

const WORKSPACE_ARCHETYPES: ChannelArchetype[] = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-kids-song', 'jp-kids-song', 'kr-idol-male', 'kr-idol-female'];

describe('[codex 지시문 03 TASK E] real generated lyrics across all 7 workspaces parse cleanly and pass the required-section check', () => {
  it.each(WORKSPACE_ARCHETYPES)('%s: a real 6-song local-generation fixture has at least one verse and one chorus per song, and zero empty bridges', archetype => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel, `no channel for ${archetype}`).toBeDefined();
    const genres = genrePacks.filter(g => channel!.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel!.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: channel!, songCount: 6 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    for (const song of blueprint.songs) {
      const sections = parseLyricsSections(song.lyrics);
      expect(sections.length, `${archetype} track ${song.trackNo}: no sections parsed at all from "${song.lyrics.slice(0, 80)}..."`).toBeGreaterThan(0);
      const missing = missingRequiredSections(sections);
      expect(missing, `${archetype} track ${song.trackNo} missing: ${missing.join(',')}`).toHaveLength(0);
      expect(findEmptyBridge(sections), `${archetype} track ${song.trackNo} has an empty bridge`).toHaveLength(0);
    }
  });
});
