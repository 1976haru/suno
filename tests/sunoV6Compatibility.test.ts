import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { effectiveSunoEngineForOptions, auditSunoV6Prompt, compileSunoStylePromptV6, recommendedMaxModeForSong, resolveSunoEngineProfile, SUNO_V6_ENGINE_PROFILES } from '../src/core/sunoV6';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';

const channel = channelPresets[0];
const season = seasonPacks[0];

describe('Suno v6 compatibility layer', () => {
  it('defaults missing and unknown saved engine values to v6 Production', () => {
    expect(resolveSunoEngineProfile(undefined)).toMatchObject({ model: 'v6', recommendedVariety: 0, executionMode: 'standard', purpose: 'production' });
    expect(resolveSunoEngineProfile({ model: 'v5.5' })).toMatchObject({ model: 'v6', recommendedVariety: 0 });
    expect(effectiveSunoEngineForOptions({})).toMatchObject({ model: 'v6', promptCompiler: 'v6', stylePromptBudget: 900 });
    expect(SUNO_V6_ENGINE_PROFILES['v6-wild']).toMatchObject({ model: 'v6-wild', recommendedVariety: 50, purpose: 'exploration' });
    expect(SUNO_V6_ENGINE_PROFILES['v6-mini']).toMatchObject({ model: 'v6-mini', recommendedVariety: 0, purpose: 'draft' });
  });

  it('compiles in constraint order, dedupes optional clauses, and never drops required constraints', () => {
    const input = {
      genre: 'chill rap',
      bpm: '92 BPM',
      vocal: 'male vocal hard lock',
      rhythm: 'laid-back pocket',
      instrumentation: 'Rhodes and warm bass',
      moneyChord: 'emotional money chord lift',
      structure: 'verse, chorus, bridge, final chorus',
      distinctiveProduction: 'close-mic dry verse, wider final chorus',
      scene: 'rainy station window source-local scene',
      duration: '3:10-3:35 target',
      optional: ['warm mood', 'warm mood', 'extra decorative adjective '.repeat(20)]
    };
    const prompt = compileSunoStylePromptV6(input);
    expect(prompt.length).toBeLessThanOrEqual(900);
    expect(auditSunoV6Prompt(prompt, input)).toMatchObject({ ok: true, withinBudget: true, missingConstraints: [] });
    expect(prompt.indexOf(input.genre)).toBeLessThan(prompt.indexOf(input.bpm));
    expect(prompt.split('warm mood').length - 1).toBe(1);
  });

  it('treats Max as a recommendation and keeps draft tracks standard', () => {
    expect(recommendedMaxModeForSong({ durationSec: 190, songRole: 'flagship' })).toBe(true);
    expect(recommendedMaxModeForSong({ durationSec: 90, songRole: 'flagship' })).toBe(false);
    expect(recommendedMaxModeForSong({ durationSec: 190, songRole: 'draft idea' })).toBe(false);
  });

  it('emits v6 recommendation metadata on the official bridge instruction without inventing an API field', () => {
    const opts = makeOptions({ channel, sunoEngine: undefined, songCount: 3 });
    const genres = genrePacks.filter(genre => opts.genreIds.includes(genre.id));
    const moods = moodPacks.filter(mood => opts.moodIds.includes(mood.id));
    const slots = preallocateSongSlots(opts, genres);
    const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots);
    expect(instruction).toContain('[SUNO ENGINE]');
    expect(instruction).toContain('Model: v6');
    expect(instruction).toContain('Recommended Variety: 0');
    expect(instruction).toContain('Prompt Compiler: v6');
    expect(instruction).toContain('"sunoEngine"');
    expect(instruction).not.toContain('sunoApiEndpoint');
    expect(instruction).not.toContain('varietySlider');
  });
});
