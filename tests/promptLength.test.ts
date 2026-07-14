import { describe, expect, it } from 'vitest';
import {
  composeStylePrompt,
  dedupeTerms,
  ESSENTIAL_TERM_IDS,
  PROMPT_PRIORITY,
  SAFE_TARGET,
  SUNO_STYLE_LIMIT,
  TERM_LABELS_KO
} from '../src/core/promptComposer';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { enforcePromptLengthBudget, scoreSongs } from '../src/core/quality';
import { buildGenrePromptSummary } from '../src/core/promptComposer';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { makeOptions } from './fixtures';
import type { LyricLanguage } from '../src/types';

const LANGUAGES: LyricLanguage[] = ['english', 'korean', 'japanese'];

describe('[P0-1] every generated stylePrompt fits Suno\'s 1,000-char style field', () => {
  it('30 songs x 3 languages x every channel/season combo never exceeds SUNO_STYLE_LIMIT', () => {
    let checked = 0;
    for (const channel of channelPresets) {
      const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
      const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
      for (const language of LANGUAGES) {
        for (const season of seasonPacks) {
          const opts = makeOptions({ channel, lyricLanguage: language, seasonId: season.id, songCount: 30 });
          const blueprint = generateLocalBlueprint(opts, genres, moods, season);
          const scored = scoreSongs(blueprint.songs, channel, language);
          for (const song of scored) {
            checked += 1;
            expect(song.stylePrompt.length, `${channel.id}/${language}/${season.id} track ${song.trackNo}`).toBeLessThanOrEqual(SUNO_STYLE_LIMIT);
            expect(song.promptWithinLimit).toBe(true);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('[A2] essential terms (genre/vocal/hook/moneyChord/duration/tempo) are never excluded, even under a tiny budget', () => {
    const parts = [
      { id: 'genre' as const, text: 'warm adult contemporary pop' },
      { id: 'vocal' as const, text: 'mature soulful male tenor' },
      { id: 'hook' as const, text: 'hook "Hold On" must open and close every chorus' },
      { id: 'moneyChord' as const, text: 'money chord foundation: I-V-vi-IV' },
      { id: 'duration' as const, text: 'complete song around 3 minutes 10 seconds' },
      { id: 'tempo' as const, text: '98 BPM' },
      { id: 'mood' as const, text: 'nostalgic, warm, hopeful' },
      { id: 'instruments' as const, text: 'Rhodes piano, acoustic guitar' },
      { id: 'season' as const, text: 'new year mood' },
      { id: 'safety' as const, text: 'avoid famous artist imitation' },
      { id: 'songRole' as const, text: 'track 1 role: clear opener' },
      { id: 'motif' as const, text: 'use recurring playlist motif: train ticket' },
      { id: 'listenerScene' as const, text: 'listener scene: morning coffee' },
      { id: 'mixNotes' as const, text: 'same channel vocal signature and mix balance' }
    ];
    const result = composeStylePrompt(parts, 100, 80); // absurdly small budget
    for (const id of ESSENTIAL_TERM_IDS) {
      expect(result.droppedTerms).not.toContain(TERM_LABELS_KO[id]);
      const originalText = parts.find(p => p.id === id)!.text;
      // essential text (or its still-present atoms) must survive in full
      for (const atom of originalText.split(',').map(s => s.trim())) {
        expect(result.prompt).toContain(atom);
      }
    }
  });

  it('[A2] once the safe target is crossed, lowest-priority ids are dropped first and recorded in droppedTerms', () => {
    const parts = PROMPT_PRIORITY.map(id => ({ id, text: `${id} filler text that takes up a good amount of space here` }));
    const result = composeStylePrompt(parts, 1000, 250);
    expect(result.droppedTerms.length).toBeGreaterThan(0);
    // lowest-priority ids (mixNotes, listenerScene, motif, songRole) should be
    // the ones dropped before any essential or higher-priority id is.
    expect(result.droppedTerms).toContain(TERM_LABELS_KO.mixNotes);
    for (const id of ESSENTIAL_TERM_IDS) {
      expect(result.droppedTerms).not.toContain(TERM_LABELS_KO[id]);
    }
  });

  it('a prompt is never cut mid-phrase — it never ends with a trailing comma or dangling separator', () => {
    for (const channel of channelPresets) {
      const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
      const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
      const season = seasonPacks[0];
      const opts = makeOptions({ channel, songCount: 5, seasonId: season.id });
      const blueprint = generateLocalBlueprint(opts, genres, moods, season);
      for (const song of blueprint.songs) {
        expect(song.stylePrompt.trim().endsWith(',')).toBe(false);
        expect(song.stylePrompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('[A3] duplicate-term suppression', () => {
  it('dedupeTerms removes exact duplicates', () => {
    expect(dedupeTerms(['acoustic guitar', 'acoustic guitar', 'piano'])).toEqual(['acoustic guitar', 'piano']);
  });

  it('dedupeTerms keeps only the more specific side of a containment pair', () => {
    const result = dedupeTerms(['acoustic guitar', 'fingerpicked acoustic guitar']);
    expect(result).toEqual(['fingerpicked acoustic guitar']);
  });

  it('dedupeTerms strips a repeated adjective past its cap instead of dropping the whole atom', () => {
    const result = dedupeTerms(['warm morning', 'warm cafe', 'warm light', 'cozy']);
    const warmCount = result.filter(atom => /\bwarm\b/i.test(atom)).length;
    expect(warmCount).toBeLessThanOrEqual(2);
    expect(result).toHaveLength(4); // atoms are kept, just stripped of the word
  });

  it('a real generated stylePrompt never repeats the same instrument atom twice', () => {
    const channel = channelPresets[0];
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === 'christmas')!;
    const opts = makeOptions({ channel, songCount: 3, seasonId: season.id });
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of blueprint.songs) {
      const atoms = song.stylePrompt.split(',').map(a => a.trim().toLowerCase());
      expect(new Set(atoms).size).toBe(atoms.length);
    }
  });

  it("dedupeTerms caps a repeated adjective at 2 within the non-essential segments it's given (mood/instruments/season/safety all pass through it)", () => {
    // "genre"/"vocal"/"moneyChord"/"duration"/"hook"/"tempo" are essential and
    // deliberately never rewritten (a channel's own genre styleCore is allowed
    // to say "warm" once), so this checks the specific non-essential inputs
    // (mood/instruments/season/safety) the way composeStylePrompt actually
    // feeds them to dedupeTerms — many "warm ..." fragments piling up here is
    // exactly the padding the real bug report measured.
    const atoms = dedupeTerms(['warm', 'comforting', 'gentle', 'warm memory', 'radio mood', 'warm morning cafe', 'radio', 'coffee steam']);
    const warmCount = atoms.filter(a => /\bwarm\b/i.test(a)).length;
    expect(warmCount).toBeLessThanOrEqual(2);
  });
});

describe('[A4] channel visualIdentity never leaks into the music stylePrompt', () => {
  it('showa-cafe\'s distinctive "refined retro typography" never appears in stylePrompt', () => {
    const channel = channelPresets.find(c => c.id === 'morning-showa-cafe')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === 'early-autumn')!;
    const opts = makeOptions({ channel, songCount: 3, seasonId: season.id });
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of blueprint.songs) {
      expect(song.stylePrompt).not.toContain('typography');
      expect(song.stylePrompt).not.toContain(channel.visualIdentity);
    }
  });

  it('no channel\'s visualIdentity substring ever appears in any generated stylePrompt', () => {
    for (const channel of channelPresets) {
      const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
      const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
      const season = seasonPacks[0];
      const opts = makeOptions({ channel, songCount: 2, seasonId: season.id });
      const blueprint = generateLocalBlueprint(opts, genres, moods, season);
      for (const song of blueprint.songs) {
        expect(song.stylePrompt).not.toContain(channel.visualIdentity);
      }
    }
  });
});

describe('SAFE_TARGET / SUNO_STYLE_LIMIT invariants', () => {
  it('SAFE_TARGET stays comfortably under SUNO_STYLE_LIMIT', () => {
    expect(SAFE_TARGET).toBeLessThan(SUNO_STYLE_LIMIT);
  });
});

describe('[v3.7] primary/secondary genre prompt budgeting', () => {
  it('primary + two secondary genres + three moods stays <= 1,000 chars', () => {
    const genres = ['adult-contemporary', 'acoustic-pop', 'jazz-pop'].map(id => genrePacks.find(genre => genre.id === id)!);
    const moods = ['nostalgic', 'warm', 'hopeful'].map(id => moodPacks.find(mood => mood.id === id)!);
    const opts = makeOptions({ genreIds: genres.map(genre => genre.id), moodIds: moods.map(mood => mood.id), songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    for (const song of blueprint.songs) {
      expect(song.stylePrompt.length).toBeLessThanOrEqual(SUNO_STYLE_LIMIT);
      expect(song.stylePrompt.trim().endsWith(',')).toBe(false);
    }
  });

  it('extreme free-text inputs still drop non-essential terms first and never silently truncate essential atoms', () => {
    // TASK F5 (v3.7) — this used to assert a hard <=1000 ceiling even here,
    // but the only way the old code met that was by hard-dropping whole
    // essential atoms (including vocalTone itself) once the budget ran out —
    // silently discarding the user's vocal description is worse than a
    // prompt that runs long and visibly warns the user to trim it (see
    // enforceHardLimit's essential-atom guarantee). A single essential
    // field this pathologically long (500 chars typed into vocalTone) is
    // the actual cause of the overflow here, not a composer bug.
    const genres = ['adult-contemporary', 'acoustic-pop', 'jazz-pop'].map(id => genrePacks.find(genre => genre.id === id)!);
    const moods = ['nostalgic', 'warm', 'hopeful'].map(id => moodPacks.find(mood => mood.id === id)!);
    const opts = makeOptions({
      genreIds: genres.map(genre => genre.id),
      moodIds: moods.map(mood => mood.id),
      songCount: 1,
      vocalTone: 'mature close vocal '.repeat(30).slice(0, 500),
      moneyChordMode: 'custom',
      customMoneyChord: 'I-V-vi-IV emotional chorus lift '.repeat(12).slice(0, 300),
      avoidWords: 'avoid harsh belting and copied artist references '.repeat(10).slice(0, 300)
    });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    const song = blueprint.songs[0];
    expect(song.stylePrompt).toContain('mature close vocal');
    expect(song.stylePrompt.trim().endsWith(',')).toBe(false);
    expect(song.promptDroppedTerms?.length).toBeGreaterThan(0);
    expect(song.promptWithinLimit).toBe(false);
  });

  it('secondary genres contribute keywords, not their full styleCore text', () => {
    const genres = ['adult-contemporary', 'acoustic-pop', 'jazz-pop'].map(id => genrePacks.find(genre => genre.id === id)!);
    const summary = buildGenrePromptSummary(genres);
    expect(summary.genreText).toContain(genres[0].styleCore);
    expect(summary.genreText).not.toContain(genres[1].styleCore);
    expect(summary.genreText).not.toContain(genres[2].styleCore);
    expect(summary.genreText.split(',').map(atom => atom.trim()).filter(Boolean).length).toBeLessThanOrEqual(7);
  });

  it('limits combined instruments to five unique entries', () => {
    const genres = ['adult-contemporary', 'acoustic-pop', 'jazz-pop'].map(id => genrePacks.find(genre => genre.id === id)!);
    const summary = buildGenrePromptSummary(genres);
    expect(summary.instruments.length).toBeLessThanOrEqual(5);
    expect(new Set(summary.instruments.map(instrument => instrument.toLowerCase())).size).toBe(summary.instruments.length);
  });

  it('hard-limit trimming never leaves a dangling comma', () => {
    const fitted = enforcePromptLengthBudget(Array.from({ length: 60 }, (_, i) => `clause ${i} with some useful prompt detail`).join(', '), 1000, 900);
    expect(fitted.prompt.length).toBeLessThanOrEqual(1000);
    expect(fitted.prompt.trim().endsWith(',')).toBe(false);
  });
});
