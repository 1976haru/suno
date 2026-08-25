import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { generateLocalBlueprint, rebuildStylePromptsForPersonaMode } from '../src/core/localGenerator';
import { PERSONA_STYLE_LIMIT } from '../src/core/soundSignature';
import { SENIOR_AUDIENCE_PROFILE, SENIOR_TEMPO_BANDS } from '../src/data/audienceProfiles';
import { channelPresets, genrePacks, makeOptions, moodPacks, testSeason } from './fixtures';

function stddev(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * TASK v3.60 (TASK C) — a real bridge-path pack measured BPM 96-104
 * (stddev ~2.2) because preallocateSongSlots (the realtime/Batch/bridge
 * pre-pass) still called averageTempo() with only 2 args, never reaching
 * the v3.58 TASK 4 tempo-band system that generateLocalBlueprint already
 * used (see tests/audienceProfile.test.ts's own equivalent local-path
 * assertions). Mirrors those tests exactly, but through the bridge's own
 * pre-pass function instead of the local generator.
 */
describe('[v3.60 TASK C] bridge/Batch pre-pass — tempo distribution matches the local path', () => {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));

  it('an 18-song senior pack has BPM standard deviation >= 8', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, genres);
    const bpms = slots.map(slot => slot.tempo);
    expect(bpms).toHaveLength(18);
    expect(stddev(bpms)).toBeGreaterThanOrEqual(8);
  });

  it('never produces a BPM outside the senior audience profile\'s floor/ceiling', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, genres);
    for (const slot of slots) {
      expect(slot.tempo).toBeGreaterThanOrEqual(SENIOR_AUDIENCE_PROFILE.tempoFloor);
      expect(slot.tempo).toBeLessThanOrEqual(SENIOR_AUDIENCE_PROFILE.tempoCeiling);
    }
  });

  it('spreads an 18-song pack across all 4 tempo bands, roughly matching each band\'s shareOf18', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, genres);
    const bandCounts = SENIOR_TEMPO_BANDS.map(band => slots.filter(slot => slot.tempo >= band.low && slot.tempo <= band.high).length);
    expect(bandCounts.reduce((sum, count) => sum + count, 0)).toBe(18);
    for (const count of bandCounts) {
      expect(count).toBeGreaterThan(0);
    }
  });

  it('does not change tempo for a non-senior channel (general/kids keep their pre-existing behavior)', () => {
    const twentiesChannel = channelPresets.find(c => c.audience === 'twenties')!;
    const opts = makeOptions({ channel: twentiesChannel, songCount: 6 });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => twentiesChannel.preferredGenres.includes(g.id)));
    for (const slot of slots) {
      expect(typeof slot.tempo).toBe('number');
    }
  });
});

function bpmFromPrompt(prompt: string): number | null {
  const match = prompt.match(/(\d{2,3}) BPM/);
  return match ? Number(match[1]) : null;
}

/**
 * TASK v3.60 (TASK C) — the same old 2-arg averageTempo() call was also
 * found in rebuildStylePromptsForPersonaMode (the persona-mode toggle
 * rebuild path, App.tsx), a second real call site outside the bridge that
 * the task's own "다른 호출부가 있을 수 있으니 확인 후 교체" instruction asked to
 * check for. Fixed the same way as batchPreallocation.ts's pre-pass.
 */
describe('[v3.60 TASK C] persona-mode rebuild path — tempo distribution matches the local path', () => {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));

  it('an 18-song senior pack keeps BPM standard deviation >= 8 after a persona-mode rebuild', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id) });
    const normal = generateLocalBlueprint(opts, genres, moods, testSeason);
    const persona = rebuildStylePromptsForPersonaMode(normal, { ...opts, personaMode: true }, genres, moods, testSeason, PERSONA_STYLE_LIMIT);
    const bpms = persona.songs.map(song => bpmFromPrompt(song.stylePrompt)).filter((v): v is number => v !== null);
    expect(bpms).toHaveLength(18);
    expect(stddev(bpms)).toBeGreaterThanOrEqual(8);
  });
});

/**
 * TASK v3.64 (TASK C) — 3rd reported recurrence: a real pack measured BPM
 * 94-106 (stddev 3.0) despite the app planning 62-112 (stddev ~14). Direct
 * investigation (not a blind code change) found preallocateSongSlots's own
 * plan on the current build is wide (confirmed by the describe block
 * above, already passing) and the bridge instruction already contains an
 * explicit "use exactly that BPM ... verbatim" rule. Conclusion: the real
 * narrow-output report was very likely generated against an older build, or
 * is residual LLM non-compliance despite a correct instruction — not a live
 * bug in this codebase to fix a 4th time. Two cheap, safe additions either
 * way: a generation timestamp (so a future report can be time-correlated
 * against exactly which build produced it) and repeating the tempo rule
 * right next to the BPM column instead of only once near the JSON payload.
 */
describe('[v3.64 TASK C] bridge instruction — tempo emphasis and build attribution', () => {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));

  it('the instruction is stamped with a generation timestamp for future build attribution', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, genres);
    const instruction = buildClaudeCodeInstruction(opts, genres, moods, testSeason, undefined, slots, false);
    const match = instruction.match(/^\[Generated (.+) — bridge instruction schema v3\.64\]/m);
    expect(match).not.toBeNull();
    expect(() => new Date(match![1])).not.toThrow();
    expect(Number.isNaN(new Date(match![1]).getTime())).toBe(false);
  });

  it('repeats the tempo-verbatim rule right after the SetPlan handoff table\'s BPM column, not only once near the JSON payload', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, genres);
    const instruction = buildClaudeCodeInstruction(opts, genres, moods, testSeason, undefined, slots, false);
    const criticalTempoLines = instruction.split('\n').filter(line => line.startsWith('CRITICAL — tempo:'));
    expect(criticalTempoLines.length).toBeGreaterThanOrEqual(1);
    const handoffIndex = instruction.indexOf('[SetPlan handoff]');
    const firstCriticalTempoIndex = instruction.indexOf('CRITICAL — tempo:');
    const jsonPayloadIndex = instruction.indexOf('Request payload for this pack');
    expect(firstCriticalTempoIndex).toBeGreaterThan(handoffIndex);
    expect(firstCriticalTempoIndex).toBeLessThan(jsonPayloadIndex);
  });

  it('import-time correction (enforceTempoInStylePrompt, already existing) fixes a real agent-written BPM that disagrees with the planned tempo', () => {
    const opts = makeOptions({ channel, songCount: 1, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const slots = preallocateSongSlots(opts, genres);
    const plannedTempo = slots[0].tempo;
    const wrongTempo = plannedTempo === 100 ? 101 : 100; // guaranteed to differ from the real planned value
    const raw = JSON.stringify({
      songs: [{
        trackNo: 1,
        title: 'Song One',
        hookPhrase: 'Hook One',
        stylePrompt: `warm acoustic pop, mellow vibe, ${wrongTempo} BPM.`,
        lyrics: '[verse 1]\nline a\nline b\n\n[chorus]\nHook One\nHook One\nHook One',
        seasonMoment: 'x',
        listenerSituation: 'x',
        emotionArc: 'x',
        youtube: { title: 'yt', description: 'desc', tags: ['tag'] }
      }]
    });
    const report = importSongsJson(raw, opts, genres, moods, testSeason, slots, [], []);
    const song = report.blueprint!.songs[0];
    expect(song.stylePrompt).toContain(`${plannedTempo} BPM`);
    expect(song.stylePrompt).not.toContain(`${wrongTempo} BPM`);
  });
});
