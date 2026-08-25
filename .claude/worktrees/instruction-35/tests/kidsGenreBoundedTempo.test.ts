import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { resolveTempoWithBand } from '../src/core/tempoPlan';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { GenerationOptions } from '../src/types';

/**
 * v5.8 (audit follow-up, docs/v58-report.md) — real measurement found
 * kr-kids's own `krkids-sleep-calm` genre (real tempoRange [62,84]) never
 * actually rendered calm: core/tempoPlan.ts's `resolveTempoWithBand` clamps
 * BPM against the AUDIENCE PROFILE's floor/ceiling, not the selected
 * genre's own range, so every kr-kids song landed in the same wide
 * workspace-level band regardless of genre. `genreBoundedTempo` (opt-in,
 * set only on KR_KIDS_AUDIENCE_PROFILE/JP_KIDS_AUDIENCE_PROFILE) remaps
 * each track's band position onto its own genre's real range instead.
 */
function buildOpts(channelId: string, songCount: number): GenerationOptions {
  const channel = channelPresets.find(c => c.id === channelId)!;
  const season = seasonPacks[0];
  return {
    channel,
    projectTitle: `Verify ${channelId}`,
    songCount,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: season.id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: ''
  };
}

function bpmByGenre(channelId: string): Map<string, number[]> {
  const opts = buildOpts(channelId, 18);
  const genres = genrePacks.filter(g => opts.channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => opts.channel.preferredMoods.includes(m.id));
  const season = seasonPacks.find(s => s.id === opts.seasonId)!;
  const bp = generateLocalBlueprint(opts, genres, moods, season);
  const byGenre = new Map<string, number[]>();
  for (const s of bp.songs) {
    const match = s.stylePrompt.match(/(\d{2,3})\s*BPM/i);
    if (!match) continue;
    const bpm = Number(match[1]);
    if (!byGenre.has(s.genreId)) byGenre.set(s.genreId, []);
    byGenre.get(s.genreId)!.push(bpm);
  }
  return byGenre;
}

describe('kr-kids genre-bounded tempo', () => {
  it('krkids-sleep-calm renders within its own real range on a real 18-song bedtime-lullaby-radio pack', () => {
    const byGenre = bpmByGenre('bedtime-lullaby-radio');
    const calmBpms = byGenre.get('krkids-sleep-calm');
    expect(calmBpms, 'krkids-sleep-calm should be selected at least once in 18 songs').toBeTruthy();
    for (const bpm of calmBpms!) {
      expect(bpm).toBeGreaterThanOrEqual(62);
      expect(bpm).toBeLessThanOrEqual(84);
    }
  });

  it('krkids-action stays energetic on a real 18-song follow-along-action-song pack (not dragged down by the wider workspace range)', () => {
    const byGenre = bpmByGenre('follow-along-action-song');
    const actionBpms = byGenre.get('krkids-action');
    expect(actionBpms, 'krkids-action should be selected at least once in 18 songs').toBeTruthy();
    for (const bpm of actionBpms!) {
      expect(bpm).toBeGreaterThanOrEqual(112);
      expect(bpm).toBeLessThanOrEqual(128);
    }
  });
});

describe('resolveTempoWithBand genreBounded flag', () => {
  it('is a strict no-op when omitted (existing senior/adult-workspace behavior unchanged)', () => {
    const withoutFlag = resolveTempoWithBand(62, 84, { low: 92, high: 101 }, 92, 128, 96);
    const explicitFalse = resolveTempoWithBand(62, 84, { low: 92, high: 101 }, 92, 128, 96, false);
    expect(explicitFalse).toBe(withoutFlag);
    // Without genreBounded, the result stays within the audience-wide band, never clamped to the genre's own [62,84].
    expect(withoutFlag).toBeGreaterThanOrEqual(92);
  });

  it('remaps into the genre range when true', () => {
    const result = resolveTempoWithBand(62, 84, { low: 92, high: 101 }, 92, 128, 96, true);
    expect(result).toBeGreaterThanOrEqual(62);
    expect(result).toBeLessThanOrEqual(84);
  });
});

describe('senior-oldpop BPM variety is unaffected (genreBoundedTempo unset)', () => {
  it('an 18-song senior pack still hits the real >=8 BPM stddev target', () => {
    const opts = buildOpts('good-morning-memory-radio', 18);
    const genres = genrePacks.filter(g => opts.channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => opts.channel.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === opts.seasonId)!;
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    const bpms = bp.songs.map(s => Number(s.stylePrompt.match(/(\d{2,3})\s*BPM/i)?.[1])).filter(n => !Number.isNaN(n));
    const mean = bpms.reduce((a, b) => a + b, 0) / bpms.length;
    const stddev = Math.sqrt(bpms.reduce((sum, v) => sum + (v - mean) ** 2, 0) / bpms.length);
    expect(stddev).toBeGreaterThanOrEqual(8);
  });
});
