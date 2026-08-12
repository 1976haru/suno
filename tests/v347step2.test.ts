import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { lintInPackLyricDiversity } from '../src/core/diversityLinter';
import { lyricThemesForArchetype, lyricThemesForOptions } from '../src/data/lyricThemes';
import { channelPresets, genrePacks, makeOptions, testMoods, testSeason } from './fixtures';
import type { ChannelProfile, PreassignedSongSlot } from '../src/types';

const showaChannel = channelPresets.find(channel => channel.archetype === 'showa-cafe')!;
const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const oldpopLoungeChannel = channelPresets.find(channel => channel.archetype === 'oldpop-lounge')!;
const kidsChannel = channelPresets.find(channel => channel.archetype === 'kids')!;

function channelGenres(channel: ChannelProfile) {
  return genrePacks.filter(genre => channel.preferredGenres.includes(genre.id));
}

function noAdjacentRepeats(values: readonly (string | undefined)[]): boolean {
  return values.every((value, index) => index === 0 || value !== values[index - 1]);
}

function hasNoThreeRun(values: readonly (string | undefined)[]): boolean {
  for (let i = 2; i < values.length; i++) {
    if (values[i] === values[i - 1] && values[i] === values[i - 2]) return false;
  }
  return true;
}

function rawSongForSlot(slot: PreassignedSongSlot, index: number) {
  const hook = `Fresh Hook ${index + 1}`;
  return {
    trackNo: slot.trackNo,
    title: `Agent Title ${index + 1}`,
    seasonMoment: 'generic season',
    listenerSituation: 'generic listener situation from agent',
    emotionArc: 'agent arc',
    hookPhrase: hook,
    stylePrompt: 'warm pop, balanced small-combo arrangement',
    lyrics: [
      '[verse 1]',
      `Line ${index + 1} opens with a different object`,
      'A small hand finds the evening light',
      '',
      '[chorus]',
      hook,
      'We keep the chorus moving bright',
      hook,
      '',
      '[verse 2]',
      `Line ${index + 1} changes the second scene`,
      'Another detail turns the room',
      '',
      '[short bridge]',
      'A quiet breath before the lift',
      '',
      '[final chorus]',
      hook,
      'We keep the chorus moving bright',
      hook,
      '',
      '[end]'
    ].join('\n'),
    youtube: { title: `YT ${index + 1}`, description: 'desc', tags: ['tag'] }
  };
}

describe('[v3.47 Step 2] lyric theme data and slot plans', () => {
  it('keeps each checked channel on 12-120 concrete scene-level lyric themes', () => {
    // TASK v3.58 — ceiling raised 20 -> 30 (this app's real max single-pack
    // songCount, see scripts/sample.ts's cap): a pool of exactly 16 themes
    // for senior-morning was one short of covering a real 18-song pack
    // without a forced repeat (buildStridePlan can only spread duplicates
    // out once songCount exceeds the pool, never eliminate them) — measured
    // as 2 duplicate lyricTheme pairs in a real pack. The pool must have
    // real headroom above the largest songCount a single pack can request,
    // not just squeak past whatever songCount happened to be tested.
    // TASK v3.64 (TASK A) — ceiling raised 30 -> 50: senior-morning's pool
    // grew from 22 to 40 with 9 new scene frames (young-first-love,
    // summer-night, dance-saturday, ...) added deliberately to fix a real
    // 18/18-songs-one-frame homogeneity bug — a real, intentional expansion,
    // not accidental bloat. 50 still catches a runaway pool.
    // 지시문 14 (Phase 2 TASK B) — ceiling raised 50 -> 80: a real measured
    // gap (§2-2) found 11 of 13 archetypes couldn't sustain a 5-set avoid
    // window (3 couldn't even fill one 18-song set), so senior-morning grew
    // 40 -> 70 and showa-cafe/kids grew similarly, all deliberately, with
    // real material-family diversity (§B-3) — see lyricThemes.ts's own
    // "지시문 14 (Phase 2 TASK B)" doc comments at each archetype's block.
    // fix/theme-pool-hard-block — ceiling raised 80 -> 120 for the urgent
    // 110-theme target on senior-morning and oldpop-lounge. 120 still catches
    // accidental runaway growth above that explicit target.
    for (const channel of [showaChannel, seniorChannel, kidsChannel]) {
      const themes = lyricThemesForArchetype(channel.archetype);
      expect(themes.length).toBeGreaterThanOrEqual(12);
      expect(themes.length).toBeLessThanOrEqual(120);
      expect(themes.every(theme => theme.scene.split(/\s+/).length >= 8)).toBe(true);
      expect(themes.every(theme => theme.scene.toLowerCase() !== theme.labelKo.toLowerCase())).toBe(true);
    }
  });

  it('keeps senior-morning and oldpop-lounge at the 110-theme fixed-pool target', () => {
    expect(lyricThemesForArchetype(seniorChannel.archetype)).toHaveLength(110);
    expect(lyricThemesForArchetype(oldpopLoungeChannel.archetype)).toHaveLength(110);
  });

  it('adds the user direct-input scene to the lyric theme allocation pool', () => {
    const opts = makeOptions({
      channel: showaChannel,
      customLyricThemeScene: 'opening a faded photo envelope at a rainy cafe table before the last train'
    });
    const [custom] = lyricThemesForOptions(opts);
    expect(custom.id).toBe('custom-lyric-scene');
    expect(custom.scene).toBe(opts.customLyricThemeScene);
  });

  it('assigns at least 8 lyric scenes across a 10-song bridge plan with no adjacent repeat', () => {
    const opts = makeOptions({
      channel: showaChannel,
      genreIds: showaChannel.preferredGenres,
      moodIds: showaChannel.preferredMoods,
      songCount: 10
    });
    const slots = preallocateSongSlots(opts, channelGenres(showaChannel));
    const themeTexts = slots.map(slot => slot.lyricThemeText);
    expect(new Set(themeTexts).size).toBeGreaterThanOrEqual(8);
    expect(noAdjacentRepeats(themeTexts)).toBe(true);
    expect(slots.every(slot => slot.lyricTheme && slot.lyricThemeText && slot.lyricThemeArc)).toBe(true);
  });

  it('rotates POV per song and avoids three identical POVs in a row', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      genreIds: seniorChannel.preferredGenres,
      moodIds: seniorChannel.preferredMoods,
      songCount: 12,
      perspective: 'firstPerson'
    });
    const slots = preallocateSongSlots(opts, channelGenres(seniorChannel));
    const povs = slots.map(slot => slot.pov);
    expect(new Set(povs).size).toBeGreaterThanOrEqual(3);
    expect(hasNoThreeRun(povs)).toBe(true);
  });

  it('pairs verse and chorus lyric section styles with the structure plan', () => {
    const opts = makeOptions({ channel: showaChannel, songCount: 8 });
    const slots = preallocateSongSlots(opts, channelGenres(showaChannel));
    expect(slots.every(slot => slot.verseStyle && slot.verseStyleText && slot.chorusStyle && slot.chorusStyleText)).toBe(true);
    expect(slots.some(slot => slot.structureTemplate === 'T5' && slot.chorusStyle === 'hookRepeat')).toBe(true);
  });
});

describe('[v3.47 Step 2] bridge delivery, import repair, and lyric lint', () => {
  it('delivers lyric scenes, POV, and section styles through the bridge payload and instructions', () => {
    const opts = makeOptions({
      channel: showaChannel,
      genreIds: showaChannel.preferredGenres,
      moodIds: showaChannel.preferredMoods,
      songCount: 3
    });
    const slots = preallocateSongSlots(opts, channelGenres(showaChannel));
    const instruction = buildClaudeCodeInstruction(opts, channelGenres(showaChannel), testMoods, testSeason, undefined, slots, false);
    expect(instruction).toContain('lyricThemeText');
    expect(instruction).toContain('verseStyleText');
    expect(instruction).toContain('chorusStyleText');
    expect(instruction).toContain('pov');
    const payloadMatch = instruction.match(/```json\n([\s\S]*?)\n```/);
    const payload = JSON.parse(payloadMatch![1]);
    expect(payload.preassignedSongs[0].lyricThemeText).toBe(slots[0].lyricThemeText);
    expect(payload.preassignedSongs[0].verseStyleText).toBe(slots[0].verseStyleText);
  });

  it('repairs imported bridge songs when the agent omits lyric theme, POV, and section style fields', () => {
    const opts = makeOptions({
      channel: showaChannel,
      genreIds: showaChannel.preferredGenres,
      moodIds: showaChannel.preferredMoods,
      songCount: 2
    });
    const slots = preallocateSongSlots(opts, channelGenres(showaChannel));
    const raw = JSON.stringify({ songs: slots.map(rawSongForSlot) });
    const report = importSongsJson(raw, opts, channelGenres(showaChannel), testMoods, testSeason, slots);
    expect(report.blueprint).not.toBeNull();
    const [song] = report.blueprint!.songs;
    expect(song.lyricThemeText).toBe(slots[0].lyricThemeText);
    expect(song.listenerSituation).toBe(slots[0].lyricThemeText);
    expect(song.pov).toBe(slots[0].pov);
    expect(song.verseStyleText).toBe(slots[0].verseStyleText);
    expect(song.chorusStyleText).toBe(slots[0].chorusStyleText);
  });

  it('warns when imported lyrics reuse the same vocabulary and section shapes', () => {
    const repeatedLyrics = [
      '[verse 1]',
      'The same window keeps the same rain',
      'The same coffee keeps the same name',
      '',
      '[chorus]',
      'Same Light',
      'The same sentence turns again',
      'Same Light',
      '',
      '[verse 2]',
      'The same window keeps the same rain',
      '',
      '[final chorus]',
      'Same Light',
      'The same sentence turns again',
      'Same Light',
      '',
      '[end]'
    ].join('\n');
    const report = lintInPackLyricDiversity(Array.from({ length: 5 }, (_, index) => ({ trackNo: index + 1, lyrics: repeatedLyrics })));
    expect(report.warnings.length + report.errors.length).toBeGreaterThan(0);
    expect(report.repeatedFirstLinePatterns.length).toBeGreaterThan(0);
    expect(report.repeatedChorusStructures.length).toBeGreaterThan(0);
  });
});
