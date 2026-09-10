import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { KPOP_WORKSPACE_POLICIES } from '../src/core/kpopWorkspacePolicy';
import { modern2030PolicyFor } from '../src/core/modern2030Policy';
import { checkJp2030Translationese, findKatakanaOveruse } from '../src/core/jp2030Policy';
import { effectiveSunoEngineForOptions, auditSunoV6Prompt, compileSunoStylePromptV6, recommendedMaxModeForSong, resolveSunoEngineProfile, SUNO_V6_ENGINE_PROFILES } from '../src/core/sunoV6';
import { getWorkspace, workspaceDefinitions } from '../src/data/workspaces';
import { overrideForArchetype } from '../src/data/hookBanks';
import { audienceProfileById, audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { DEFAULT_KIDS_AGE_TIER_ID, KIDS_AGE_TIERS, kidsAgeTierFor } from '../src/data/kidsAgeTiers';
import { buildKpopSectionStyleShiftPlan } from '../src/core/kpopSectionStyleShiftPlan';
import { buildResolvedGenerationContract, userChoicesFromOptions } from '../src/core/userChoices';
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

  it('uses the real K-pop and JP2030 registry IDs and keeps their existing policies separate from CHILI STORY', () => {
    expect(workspaceDefinitions.map(workspace => workspace.id)).toEqual(expect.arrayContaining(['kr-idol-male', 'kr-idol-female', 'jp-2030']));
    expect(getWorkspace('kr-idol-male').archetypeIds).toEqual(['kr-idol-male']);
    expect(getWorkspace('kr-idol-female').archetypeIds).toEqual(['kr-idol-female']);
    expect(getWorkspace('jp-2030').archetypeIds).toEqual(['jp-2030-pop']);
    expect(getWorkspace('jp-2030').defaultAudienceProfileId).toBe('jp-2030-melodic');
    expect(channelPresets.filter(channel => channel.archetype === 'kr-idol-male').map(channel => channel.id)).toEqual(['stage-night', 'drive-kpop-playlist', 'dawn-confession']);
    expect(channelPresets.filter(channel => channel.archetype === 'kr-idol-female').map(channel => channel.id)).toEqual(['daylight-city-kpop', 'nonstop-playlist', 'songs-for-after-its-over']);
    expect(channelPresets.filter(channel => channel.archetype === 'jp-2030-pop').map(channel => channel.id)).toEqual(['reiwa-way-home-jpop', 'tokyo-night-melodic-pop', 'want-to-cry-band-playlist']);
    expect(KPOP_WORKSPACE_POLICIES['kr-idol-male']).toBeDefined();
    expect(KPOP_WORKSPACE_POLICIES['kr-idol-female']).toBeDefined();
    expect(modern2030PolicyFor('jp-2030')?.language).toBe('japanese');
  });

  it('preserves K-pop v6 structure, hook, vocal diversity, and safety policy across engine switches', () => {
    const channel = channelPresets.find(item => item.id === 'stage-night')!;
    const base = makeOptions({ channel, songCount: 15, lyricLanguage: 'korean', sunoEngine: { ...SUNO_V6_ENGINE_PROFILES.v6 } });
    const genres = genrePacks.filter(genre => base.genreIds.includes(genre.id));
    const moods = moodPacks.filter(mood => base.moodIds.includes(mood.id));
    const baselineSlots = preallocateSongSlots(base, genres);
    const baselineContract = buildResolvedGenerationContract(base, userChoicesFromOptions(base), baselineSlots, 'kr-idol-male');
    expect(baselineSlots).toHaveLength(15);
    const baselineVocalCounts = {
      male: baselineSlots.filter(slot => slot.vocalType === 'male').length,
      female: baselineSlots.filter(slot => slot.vocalType === 'female').length,
      mixed: baselineSlots.filter(slot => slot.vocalType === 'mixed').length
    };
    expect(baselineVocalCounts).toEqual({ male: 13, female: 0, mixed: 2 });
    expect(new Set(baselineSlots.map(slot => slot.vocalText)).size).toBeGreaterThan(1);
    expect(new Set(baselineSlots.map(slot => slot.structureTemplate)).size).toBeGreaterThan(1);
    expect(new Set(baselineSlots.map(slot => slot.hookDeviceText)).size).toBeGreaterThan(1);
    expect(baselineSlots.every(slot => slot.introTextureText)).toBe(true);
    expect(baselineSlots.every(slot => slot.chorusContrastText)).toBe(true);
    expect(buildKpopSectionStyleShiftPlan(15, 7).length).toBe(15);
    expect(overrideForArchetype('kr-idol-male', 'korean').imperativeObjects.length).toBeGreaterThan(0);
    expect(channel.forbiddenCliches.join(' ')).toMatch(/imitation|soundalike|signature hook/i);

    for (const model of ['v6', 'v6-wild', 'v6-mini'] as const) {
      const opts = { ...base, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] } };
      const slots = preallocateSongSlots(opts, genres);
      const contract = buildResolvedGenerationContract(opts, userChoicesFromOptions(opts), slots, 'kr-idol-male');
      const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots);
      expect({
        vocal: {
          male: slots.filter(slot => slot.vocalType === 'male').length,
          female: slots.filter(slot => slot.vocalType === 'female').length,
          mixed: slots.filter(slot => slot.vocalType === 'mixed').length
        },
        plan: slots.map(slot => ({ genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase, structure: slot.structureTemplate }))
      }, model).toEqual({
        vocal: baselineVocalCounts,
        plan: baselineSlots.map(slot => ({ genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase, structure: slot.structureTemplate }))
      });
      expect(contract.vocal.effectiveQuota, model).toEqual(baselineContract.vocal.effectiveQuota);
      expect(instruction, model).toContain(`Model: ${model}`);
      expect(instruction, model).toContain('hookDeviceText');
      expect(instruction, model).toContain('chorusContrastText');
      expect(instruction, model).toContain('Do not use "in the style of"');
      expect(instruction, model).not.toContain('[JP CHILI LAB STORY CONTRACT]');
    }
  });

  it('keeps JP2030 native Japanese policy and saved plan fields stable across all v6 engines without CHILI leakage', () => {
    const channel = channelPresets.find(item => item.id === 'reiwa-way-home-jpop')!;
    const base = makeOptions({ channel, songCount: 15, lyricLanguage: 'japanese', sunoEngine: { ...SUNO_V6_ENGINE_PROFILES.v6 } });
    const genres = genrePacks.filter(genre => base.genreIds.includes(genre.id));
    const moods = moodPacks.filter(mood => base.moodIds.includes(mood.id));
    const slots = preallocateSongSlots(base, genres);
    const baseline = {
      language: base.lyricLanguage,
      genreIds: base.genreIds,
      vocalQuota: base.vocalQuota,
      moodIds: base.moodIds,
      hooks: slots.map(slot => slot.hookPhrase),
      savedPlan: slots.map(slot => ({ trackNo: slot.trackNo, genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase }))
    };
    const policy = modern2030PolicyFor('jp-2030')!;
    expect(policy.language).toBe('japanese');
    expect(policy.modernSceneFamilies.length).toBeGreaterThan(0);
    expect(policy.staleClicheFamilies.length).toBeGreaterThan(0);
    expect(overrideForArchetype('jp-2030-pop', 'japanese').imperativeObjects.length).toBeGreaterThan(0);
    expect(findKatakanaOveruse([{ trackNo: 1, lyrics: 'これは自然な日本語の歌詞です。' }])).toEqual([]);
    expect(checkJp2030Translationese([{ trackNo: 1, lyrics: '今日は駅まで歩いて、君に会う。' }])).toEqual([]);

    for (const model of ['v6', 'v6-wild', 'v6-mini'] as const) {
      const opts = { ...base, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] } };
      const switchedSlots = preallocateSongSlots(opts, genres);
      const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, switchedSlots);
      expect({ language: opts.lyricLanguage, genreIds: opts.genreIds, vocalQuota: opts.vocalQuota, moodIds: opts.moodIds, hooks: switchedSlots.map(slot => slot.hookPhrase), savedPlan: switchedSlots.map(slot => ({ trackNo: slot.trackNo, genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase })) }, model).toEqual(baseline);
      expect(instruction, model).toContain(`Model: ${model}`);
      expect(instruction, model).toContain('Japanese');
      expect(instruction, model).not.toContain('[JP CHILI LAB STORY CONTRACT]');
      expect(instruction, model).not.toContain('[JP CAFE CHILI LAB STORY CONTRACT]');
    }
  });

  it('falls back old saved options without an engine to v6 while retaining JP2030 language and allocations', () => {
    const channel = channelPresets.find(item => item.id === 'tokyo-night-melodic-pop')!;
    const saved = makeOptions({ channel, lyricLanguage: 'japanese', songCount: 12 });
    delete saved.sunoEngine;
    const restored = { ...saved, sunoEngine: effectiveSunoEngineForOptions(saved) };
    expect(restored.sunoEngine).toMatchObject({ model: 'v6', recommendedVariety: 0, purpose: 'production' });
    expect(restored.lyricLanguage).toBe('japanese');
    expect(restored.genreIds).toEqual(saved.genreIds);
    expect(restored.vocalQuota).toEqual(saved.vocalQuota);
  });

  it('uses the real senior, oldpop, and children registry structure without cross-audience aliases', () => {
    expect(getWorkspace('senior-oldpop').archetypeIds).toContain('senior-morning');
    expect(getWorkspace('senior-oldpop').archetypeIds).toContain('oldpop-lounge');
    expect(getWorkspace('kr-kids').archetypeIds).toEqual(['kr-kids-song']);
    expect(getWorkspace('jp-kids').archetypeIds).toEqual(['jp-kids-song']);
    expect(channelPresets.filter(channel => channel.archetype === 'senior-morning').map(channel => channel.id)).toEqual(['good-morning-memory-radio']);
    expect(channelPresets.filter(channel => channel.archetype === 'oldpop-lounge').map(channel => channel.id)).toEqual(['oldpop-lounge-main']);
    expect(channelPresets.filter(channel => channel.archetype === 'kids').map(channel => channel.id)).toEqual(['little-singalong-radio']);
    expect(channelPresets.filter(channel => channel.archetype === 'kr-kids-song').map(channel => channel.id)).toEqual(['follow-along-action-song', 'daily-habit-learning-song', 'bedtime-lullaby-radio']);
    expect(channelPresets.filter(channel => channel.archetype === 'jp-kids-song').map(channel => channel.id)).toEqual(['teasobi-hiroba', 'minna-de-taiso', 'oyasumi-mae-no-uta']);
    expect(getWorkspace('senior-oldpop').defaultAudienceProfileId).toBe('senior');
    expect(getWorkspace('kr-kids').defaultAudienceProfileId).toBe('kr-kids');
    expect(getWorkspace('jp-kids').defaultAudienceProfileId).toBe('jp-kids');
    expect(DEFAULT_KIDS_AGE_TIER_ID).toBe('kids-t2');
    expect(Object.keys(KIDS_AGE_TIERS)).toEqual(['kids-t1', 'kids-t2', 'kids-t3']);
    expect(audienceProfileById('senior')?.id).toBe('senior');
    expect(audienceProfileById('kr-kids')?.id).toBe('kr-kids');
    expect(audienceProfileById('jp-kids')?.id).toBe('jp-kids');
  });

  it('keeps senior vocal comfort, familiar sound, scene breadth, and non-uniform production across v6 engines', () => {
    const channels = ['good-morning-memory-radio', 'oldpop-lounge-main'].map(id => channelPresets.find(channel => channel.id === id)!);
    const seniorProfile = audienceProfileById('senior')!;
    expect(seniorProfile.constraints.join(' ')).toMatch(/clear|audible|warm|comfortable|singable/i);
    expect(seniorProfile.exclusions.join(' ')).toMatch(/bel[t|ted]|aggressive|rapid|harsh/i);

    for (const channel of channels) {
      const base = makeOptions({ channel, songCount: 15, lyricLanguage: channel.primaryLanguage, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES.v6 } });
      const genres = genrePacks.filter(genre => base.genreIds.includes(genre.id));
      const moods = moodPacks.filter(mood => base.moodIds.includes(mood.id));
      const baselineSlots = preallocateSongSlots(base, genres);
      const baseline = baselineSlots.map(slot => ({ genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase, tempo: slot.tempo }));
      const profile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
      expect(profile.id).toBe('senior');
      expect(baselineSlots.every(slot => !slot.genreId?.startsWith('krkids') && !slot.genreId?.startsWith('jpkids'))).toBe(true);
      expect(new Set(baselineSlots.map(slot => slot.genreId)).size).toBeGreaterThan(1);
      expect(new Set(baselineSlots.map(slot => slot.vocalText)).size).toBeGreaterThan(1);
      const instruction = buildClaudeCodeInstruction(base, genres, moods, season, { usedTitles: [], usedHooks: [] }, baselineSlots);
      expect(instruction).toContain('[SUNO ENGINE]');
      expect(instruction).not.toContain('[JP CHILI LAB STORY CONTRACT]');
      expect(instruction).not.toContain('[JP CAFE CHILI LAB STORY CONTRACT]');

      for (const model of ['v6', 'v6-wild', 'v6-mini'] as const) {
        const opts = { ...base, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] } };
        const slots = preallocateSongSlots(opts, genres);
        expect(slots.map(slot => ({ genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase, tempo: slot.tempo })), `${channel.id}/${model}`).toEqual(baseline);
        expect(buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots), `${channel.id}/${model}`).toContain(`Model: ${model}`);
      }
    }
  });

  it('keeps every real kids age tier, language, lyric difficulty, hook, and safety boundary through engine switching', () => {
    const channels = [
      channelPresets.find(channel => channel.id === 'bedtime-lullaby-radio')!,
      channelPresets.find(channel => channel.id === 'daily-habit-learning-song')!,
      channelPresets.find(channel => channel.id === 'follow-along-action-song')!,
      channelPresets.find(channel => channel.id === 'little-singalong-radio')!
    ];
    for (const channel of channels) {
      const tierId = channel.kidsAgeTierId ?? DEFAULT_KIDS_AGE_TIER_ID;
      const tier = kidsAgeTierFor(tierId);
      const base = makeOptions({ channel, songCount: 15, lyricLanguage: channel.primaryLanguage, kidsAgeTierId: tierId, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES.v6 } });
      const genres = genrePacks.filter(genre => base.genreIds.includes(genre.id));
      const moods = moodPacks.filter(mood => base.moodIds.includes(mood.id));
      const baselineSlots = preallocateSongSlots(base, genres);
      const baseline = baselineSlots.map(slot => ({ genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase, tier: slot.effectiveKidsAgeTierId }));
      expect(tier.ageRange[0]).toBeGreaterThanOrEqual(0);
      expect(tier.totalWordTarget).toBeGreaterThan(0);
      expect(tier.minHookRepeats).toBeGreaterThan(0);
      expect(channel.forbiddenCliches.join(' ')).toMatch(/adult romantic|senior|nursery rhyme|scary/i);
      expect(baselineSlots.every(slot => slot.effectiveKidsAgeTierId === tierId), channel.id).toBe(true);
      expect(baselineSlots.every(slot => !slot.genreId?.startsWith('oldpop') && !slot.genreId?.startsWith('kridol'))).toBe(true);
      const baselineInstruction = buildClaudeCodeInstruction(base, genres, moods, season, { usedTitles: [], usedHooks: [] }, baselineSlots);
      expect(baselineInstruction).not.toContain('[JP CHILI LAB STORY CONTRACT]');
      expect(baselineInstruction).not.toContain('[JP CAFE CHILI LAB STORY CONTRACT]');

      for (const model of ['v6', 'v6-wild', 'v6-mini'] as const) {
        const opts = { ...base, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] } };
        const slots = preallocateSongSlots(opts, genres);
        const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots);
        expect({ language: opts.lyricLanguage, tier: opts.kidsAgeTierId, plan: slots.map(slot => ({ genreId: slot.genreId, vocalType: slot.vocalType, hook: slot.hookPhrase, tier: slot.effectiveKidsAgeTierId })) }, `${channel.id}/${model}`).toEqual({ language: base.lyricLanguage, tier: tierId, plan: baseline });
        expect(instruction, `${channel.id}/${model}`).toContain(`Model: ${model}`);
        expect(instruction, `${channel.id}/${model}`).toContain('preassignedSongs');
      }
    }
  });

  it('loads a v5.5-era senior and kids saved option shape with v6 fallback only', () => {
    for (const id of ['good-morning-memory-radio', 'bedtime-lullaby-radio']) {
      const channel = channelPresets.find(item => item.id === id)!;
      const saved = makeOptions({ channel, songCount: 12, lyricLanguage: channel.primaryLanguage, kidsAgeTierId: channel.kidsAgeTierId });
      delete saved.sunoEngine;
      const restored = { ...saved, sunoEngine: effectiveSunoEngineForOptions(saved) };
      expect(restored.sunoEngine, id).toMatchObject({ model: 'v6', recommendedVariety: 0, purpose: 'production' });
      expect(restored.lyricLanguage, id).toBe(saved.lyricLanguage);
      expect(restored.genreIds, id).toEqual(saved.genreIds);
      expect(restored.vocalQuota, id).toEqual(saved.vocalQuota);
      expect(restored.kidsAgeTierId, id).toBe(saved.kidsAgeTierId);
    }
  });
});
