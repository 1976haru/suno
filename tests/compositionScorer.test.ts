import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { scoreComposition } from '../src/core/compositionScorer';
import type { SongIdea } from '../src/types';

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  // Deliberately 28 comma-separated descriptors (within the 25-35 range) so
  // tests that aren't specifically about the descriptor-count check don't
  // spuriously trip it.
  const stylePrompt = overrides.stylePrompt ?? [
    'oldpop-british-beat', '12-string electric guitar', 'melodic walking bass', 'tambourine backbeat',
    'I-vi-IV-V progression', 'mature male tenor lead', 'clear forward diction', '100 BPM', 'bright studio mix',
    'clean group harmony', 'singalong hook', 'no instrumental intro', 'hook heard immediately', '3:10-3:35',
    'narrow warm mono mix', 'tape compression on the drums', 'natural room reverb', 'bright backing vocals',
    'gentle rocking sway', 'nostalgic feel', 'simple diatonic hook', 'clean group vocal blend',
    'straightforward song structure', 'warm midrange tone', 'unhurried tempo feel', 'steady rhythm section',
    'plain chorus lift', 'radio-friendly mix'
  ].join(', ');
  return {
    trackNo: 1,
    title: 'Song One',
    seasonMoment: 'x',
    listenerSituation: 'walking through a quiet garden in the morning',
    emotionArc: 'x',
    hookPhrase: 'Song One Hook',
    stylePrompt,
    lyrics: '[verse 1]\nline a\nline b\n\n[chorus]\nSong One Hook\nline c\nSong One Hook\nline d\nline e\nline f\nSong One Hook\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song One', description: 'desc', tags: [] },
    ...overrides
  };
}

/**
 * TASK v3.62 (TASK 2) — C안's whole premise: the app plans, the LLM
 * composes, and the existing 28-odd checks this session already built
 * (v3.58-v3.61) finally do their intended job by BLOCKING a bad composition
 * instead of only reporting it after the fact. Almost every check here is
 * pure reuse (see compositionScorer.ts's own module comment); only the
 * descriptor-count and era-anachronism checks are new.
 */
describe('[v3.62 TASK 2] scoreComposition — reused blocking checks', () => {
  it('blocks a song whose lyrics sing an arrangement/instrument as the grammatical subject (TASK v3.60 TASK A, reused)', () => {
    const song = songWith({ lyrics: '[verse 1]\nThe straight-pop drums move softly\n\n[chorus]\nSong One Hook\nline\nSong One Hook\nline\nline\nline\nSong One Hook\n\n[end]' });
    const [score] = scoreComposition([song]);
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('편곡/악기 어휘'))).toBe(true);
  });

  it('blocks a song with an artist-name leak in stylePrompt, lyrics, or youtube metadata (TASK v3.58 TASK 3, reused)', () => {
    const styleLeak = songWith({ stylePrompt: 'in the style of the Beatles, jangly guitars, 100 BPM' });
    expect(scoreComposition([styleLeak])[0].blocking.some(b => b.includes('아티스트/밴드명 누출'))).toBe(true);

    const youtubeLeak = songWith({ youtube: { title: 'Beatles-style song', description: 'desc', tags: [] } });
    expect(scoreComposition([youtubeLeak])[0].blocking.some(b => b.includes('youtube'))).toBe(true);
  });

  it('blocks the pair of songs whose style prompts are too similar (TASK v3.58 TASK 1 threshold, reused)', () => {
    const identical = 'oldpop-british-beat, 12-string electric guitar, melodic walking bass, tambourine backbeat, mature male tenor lead, 100 BPM, bright studio mix';
    const songs = [songWith({ trackNo: 1, stylePrompt: identical }), songWith({ trackNo: 2, stylePrompt: identical, hookPhrase: 'Other Hook' })];
    const scores = scoreComposition(songs);
    expect(scores.every(s => !s.passed)).toBe(true);
    expect(scores[0].blocking.some(b => b.includes('유사도'))).toBe(true);
  });

  it('does not block two songs with genuinely different style prompts', () => {
    const songs = [
      songWith({ trackNo: 1, stylePrompt: 'oldpop-british-beat, 12-string electric guitar, melodic walking bass, tambourine backbeat, mature male tenor lead, 100 BPM' }),
      songWith({ trackNo: 2, stylePrompt: 'folk-pop, fingerpicked acoustic guitar, soft piano, upright bass, plainspoken lead vocal, 92 BPM', hookPhrase: 'Other Hook' })
    ];
    const scores = scoreComposition(songs);
    expect(scores.every(s => !s.blocking.some(b => b.includes('유사도')))).toBe(true);
  });
});

/** TASK v3.62 (TASK 2-2, NEW) — Suno reads a descriptor list, not prose; a real pack measured 106 comma-separated descriptors in one stylePrompt because the old dictation approach had to fill every protected atom regardless of need. */
describe('[v3.62 TASK 2-2] scoreComposition — descriptor-count check (NEW)', () => {
  it('blocks a style prompt with fewer than 20 descriptors', () => {
    const song = songWith({ stylePrompt: 'warm pop, acoustic guitar, 92 BPM' });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(true);
  });

  it('blocks a style prompt with more than 40 descriptors', () => {
    const manyDescriptors = Array.from({ length: 45 }, (_, i) => `descriptor ${i}`).join(', ');
    const song = songWith({ stylePrompt: manyDescriptors });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(true);
  });

  it('adds only an advisory (never blocks) for 20-24 or 36-40 descriptors', () => {
    const twentyTwo = Array.from({ length: 22 }, (_, i) => `descriptor ${i}`).join(', ');
    const score = scoreComposition([songWith({ stylePrompt: twentyTwo })])[0];
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(false);
    expect(score.advisory.some(a => a.includes('서술어'))).toBe(true);
  });

  it('adds no descriptor-count warning at all for 25-35 descriptors', () => {
    const thirty = Array.from({ length: 30 }, (_, i) => `descriptor ${i}`).join(', ');
    const score = scoreComposition([songWith({ stylePrompt: thirty })])[0];
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(false);
    expect(score.advisory.some(a => a.includes('서술어'))).toBe(false);
  });
});

/** TASK v3.62 (TASK 2-2, NEW) — era-anachronism check, reading from the same src/data/eraExclusions.ts table the bridge instruction's prevention bullet reads from. */
describe('[v3.62 TASK 2-2] scoreComposition — era-anachronism check (NEW)', () => {
  it('blocks a real 1962-flavored British-beat stylePrompt containing "string pad" (the real reported bug)', () => {
    const song = songWith({
      genreId: 'oldpop-british-beat',
      stylePrompt: 'early-1960s British beat pop, 12-string electric guitar, melodic walking bass, warm string pad swell intro texture (INTRO ONLY), 100 BPM'
    });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('1950s-60s') && b.includes('string pad'))).toBe(true);
  });

  it('does not block an era-appropriate 1962 British-beat stylePrompt with no anachronistic terms', () => {
    const song = songWith({
      genreId: 'oldpop-british-beat',
      stylePrompt: 'early-1960s British beat pop, 12-string electric guitar, melodic walking bass, tambourine backbeat, bright mono-leaning studio mix, 100 BPM'
    });
    const score = scoreComposition([song])[0];
    expect(score.blocking.some(b => b.includes('1950s-60s'))).toBe(false);
  });

  it('does not apply any era restriction to a genre with no era bucket (e.g. adult-contemporary)', () => {
    const song = songWith({ genreId: 'adult-contemporary', stylePrompt: 'warm adult contemporary pop, string pad, synth pad, gated reverb, 96 BPM' });
    const score = scoreComposition([song])[0];
    expect(score.blocking.some(b => b.includes('시대'))).toBe(false);
  });

  it('blocks a 1980s oldpop track using a too-early "mono-leaning mix"', () => {
    const song = songWith({ genreId: 'oldpop-adult-contemporary-80s', stylePrompt: '1980s warm adult contemporary pop, warm electric piano, sustained synth pad, mono-leaning mix, 92 BPM' });
    const score = scoreComposition([song])[0];
    expect(score.blocking.some(b => b.includes('1980s') && b.includes('mono-leaning mix'))).toBe(true);
  });
});

describe('[v3.62 TASK 2] scoreComposition — advisory (never-blocking) checks reused from earlier tasks', () => {
  it('adds an advisory for a hook/scene time-of-day mismatch (TASK v3.60 TASK E, reused)', () => {
    const song = songWith({ listenerSituation: 'sitting with morning coffee before the day begins', hookPhrase: 'Stay with Me Tonight' });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(true);
    expect(score.advisory.some(a => a.includes('time-of-day'))).toBe(true);
  });

  it('adds an advisory for a title/hook zero-overlap (v3.58 TASK 5-6, reused)', () => {
    const song = songWith({ title: 'Tableglow', hookPhrase: 'Stay with Me Tonight' });
    const score = scoreComposition([song])[0];
    expect(score.advisory.some(a => a.includes('shares no word'))).toBe(true);
  });

  it('a fully clean song passes with no blocking and no advisory', () => {
    const song = songWith({ title: 'Guitar Morning', hookPhrase: 'Guitar Morning Song' });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(true);
    expect(score.blocking).toEqual([]);
  });
});

const realPackPath = path.resolve(__dirname, '..', 'songs-output.json');
const describeRealPack = existsSync(realPackPath) ? describe : describe.skip;

describeRealPack('[v3.62 TASK 2] scoreComposition against the real bridge-path pack', () => {
  const data = existsSync(realPackPath) ? JSON.parse(readFileSync(realPackPath, 'utf-8')) : { songs: [] };

  it('flags the real oldpop-british-beat track (track 1) for its "string pad" anachronism', () => {
    const scores = scoreComposition(data.songs);
    const track1 = scores.find(s => s.trackNo === 1)!;
    expect(track1.blocking.some(b => b.includes('1950s-60s') && b.includes('string pad'))).toBe(true);
  });

  it('no song in this real, old-dictation-generated pack fully passes (every one has at least a descriptor-count issue)', () => {
    const scores = scoreComposition(data.songs);
    expect(scores.every(s => !s.passed)).toBe(true);
  });
});
