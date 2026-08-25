import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { scoreSongs, scoreSong } from '../src/core/quality';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

const BEATLES_CONCEPT = '비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝';

/**
 * TASK v3.59 (TASK B) — a real generated pack scored 94-95 down to 72-78 on
 * every one of 18 songs with "Artist imitation risk: remove singer/style-
 * copy wording." This was a genuine design contradiction: TASK 3's whole
 * purpose is to let a user say "비틀즈 스타일로" naturally and decompose it
 * into safe, generic descriptors — which worked (0/18 leaks in stylePrompt)
 * — but a *different* guard (quality.ts's imitationPatterns scan) was
 * penalizing the user for having typed that natural phrase in the first
 * place, via localGenerator.ts's buildYoutubeMetadata echoing the raw
 * customConcept text verbatim into the public youtube.description field
 * ("Concept: 비틀즈 스타일로, 아침에..."), which the same risk scan reads.
 *
 * Root-cause fix (B-1): buildYoutubeMetadata/thumbnailWorksetExport/
 * videoExport now use conceptDiversity.ts's safeConceptSummaryForDisplay,
 * which only echoes the raw concept text when it carries no detected
 * artist reference/style-framing — otherwise it substitutes the existing
 * safe fallback (channel.promise / oneLineConcept). This alone closes every
 * currently-reachable path from customConcept into a scanned field, so
 * quality.ts's own risk-scan scope (which field to check, not not have any
 * change) is left untouched — narrowing it further was explored and
 * reverted: this repo already has a purpose-built regression test
 * (tests/quality.test.ts's "flags artist-imitation language when it
 * appears only in the title") guarding a *different*, still-real risk (an
 * AI-creative title/description that itself contains imitation language,
 * regardless of source) that a scope-narrowing change would have broken.
 */
describe('[v3.59 TASK B] the Beatles/morning-coffee concept no longer self-penalizes', () => {
  it('produces zero "Artist imitation risk" warnings across an 18-song pack', () => {
    const opts = makeOptions({ songCount: 18, customConcept: BEATLES_CONCEPT });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const scored = scoreSongs(bp.songs, opts.channel);
    for (const song of scored) {
      expect(song.warnings.some(w => w.startsWith('Artist imitation risk')), JSON.stringify(song.warnings)).toBe(false);
    }
  });

  it('style prompts still carry zero artist-name leaks (TASK 3\'s own guard, unaffected)', () => {
    const opts = makeOptions({ songCount: 18, customConcept: BEATLES_CONCEPT });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.stylePrompt).not.toContain('비틀즈');
    }
  });

  it('the public youtube.description never contains the artist name either (the actual root cause, fixed by B-1)', () => {
    const opts = makeOptions({ songCount: 18, customConcept: BEATLES_CONCEPT });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.youtube.description).not.toContain('비틀즈');
    }
  });

  it('a genuine imitation phrase deliberately injected into the style prompt is still caught (the guard is alive, not gutted)', () => {
    const song: SongIdea = {
      trackNo: 1,
      title: 'Test Song',
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      hookPhrase: 'Test Song',
      stylePrompt: 'warm acoustic pop, in the style of the Beatles, I-V-vi-IV progression, repeats chorus 4x, 92 BPM',
      lyrics: '[verse 1]\nline one\n\n[chorus]\nTest Song\nTest Song\nTest Song\n\n[end]',
      warnings: [],
      qualityScore: 0,
      youtube: { title: 'Test Song', description: 'A song.', tags: ['tag'] }
    };
    const scored = scoreSong(song);
    expect(scored.warnings.some(w => w.startsWith('Artist imitation risk'))).toBe(true);
  });
});
