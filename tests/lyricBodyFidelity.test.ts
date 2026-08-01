import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { vocalPresets } from '../src/data/vocalPresets';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.58 (TASK 5-3, part 1) — the non-cold-open [short intro] tag used
 * to be followed by an unlabeled instrumental descriptor line ("Soft
 * Rhodes, acoustic guitar, close warm vocal."), which Suno could (and a
 * real pack measurably did, 9/18) sing as if it were an actual lyric line,
 * since nothing under a bare instrumental tag marks it as non-sung. The
 * same instrumentation color is already carried non-singably by the style
 * prompt's own introTexture atom, so the fix simply drops the line instead
 * of relabeling it.
 */
describe('[v3.58 TASK 5-3] no singable line directly under [short intro]', () => {
  it('whenever a track\'s structure includes [short intro], its section is the bare tag only', () => {
    // Only T1/T3 (and a non-hook-forward/hum-intro cold-open) use [short
    // intro] at all; T2/T4/T5 open with a differently-tagged hook section
    // instead (see lyricEngine.ts's per-template `lines` shapes) — this
    // asserts on whichever tracks happen to land on a template that has it.
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    const withShortIntro = bp.songs.filter(song => song.lyrics.includes('[short intro]'));
    expect(withShortIntro.length).toBeGreaterThan(0);
    for (const song of withShortIntro) {
      const lines = song.lyrics.split('\n');
      const introIdx = lines.findIndex(line => line.trim() === '[short intro]');
      // Next non-blank line after the tag must be the next section tag, not prose.
      const next = lines.slice(introIdx + 1).find(line => line.trim() !== '');
      expect(next?.trim().startsWith('['), song.lyrics).toBe(true);
    }
  });
});

/**
 * TASK v3.58 (TASK 5-3, part 2) — a 'duet' vocal selection (adult
 * 'male-female-duet') already promises "alternating verses, close harmony
 * on the chorus" in its own preset text, but only a single blanket
 * [duet vocal] tag was ever added at the very top of the lyrics — nothing
 * told Suno which section is which singer. See vocalPlan.ts's
 * applyDuetSectionVocalTags.
 */
describe('[v3.58 TASK 5-3] duet selections get per-section vocal-assignment tags', () => {
  const duetPreset = vocalPresets.find(p => p.id === 'male-female-duet')!;

  it('verse 1 is tagged male, verse 2 is tagged female, choruses are tagged as a duet', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 4, vocalTone: duetPreset.prompt }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.lyrics, song.lyrics).toContain('[verse 1: male vocal]');
      expect(song.lyrics, song.lyrics).toContain('[verse 2: female vocal]');
      expect(song.lyrics, song.lyrics).toMatch(/\[(final )?chorus: male and female duet\]/);
    }
  });

  it('a solo (non-duet) vocal selection is left with plain, untagged section tags', () => {
    // TASK v3.72 (TASK A) — must be a preset whose prompt text differs from
    // the test channel's own defaultVocal: usesVocalQuota() now treats
    // "vocalTone === channel.defaultVocal" as untouched/default and engages
    // the auto male/female/duet quota there, which would make some of these
    // 4 songs female/duet and break this test's "plain, untagged" premise.
    // 'warm-mature-male' happens to be byte-identical to the default test
    // channel's defaultVocal, so it no longer isolates this scenario;
    // 'low-calm-male' is a distinct explicit single-preset pick instead.
    const soloPreset = vocalPresets.find(p => p.id === 'low-calm-male')!;
    const bp = generateLocalBlueprint(makeOptions({ songCount: 4, vocalTone: soloPreset.prompt }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.lyrics).toContain('[verse 1]');
      expect(song.lyrics).toContain('[verse 2]');
      expect(song.lyrics).not.toContain('[verse 1: male vocal]');
      expect(song.lyrics).not.toContain('male and female duet');
    }
  });
});
