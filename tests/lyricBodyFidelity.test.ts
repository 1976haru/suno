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
    // TASK v4.9 (TASK E) — core/bpmLengthControl.ts's own BPM_LENGTH_TIERS
    // narrowed T1's (8-section) eligible BPM band to 105-112 only (was
    // 93-112), so an 18-song pack's own random tempo spread doesn't
    // reliably land at least one track there; songCount raised to keep this
    // assertion meaningful rather than occasionally vacuous.
    const bp = generateLocalBlueprint(makeOptions({ songCount: 40 }), testGenres, testMoods, testSeason);
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

  it('a duet-assigned track is tagged male verse1/female verse2/duet choruses', () => {
    // v3.77 (TASK A) — vocalTone alone only LEANS the quota now (see
    // vocalPlan.ts's leaningGenderFor); an explicit opts.vocalQuota override
    // is what deterministically guarantees every track here is a duet.
    const bp = generateLocalBlueprint(makeOptions({ songCount: 4, vocalTone: duetPreset.prompt, vocalQuota: { male: 0, female: 0, mixed: 1 } }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.lyrics, song.lyrics).toContain('[verse 1: male vocal]');
      expect(song.lyrics, song.lyrics).toContain('[verse 2: female vocal]');
      expect(song.lyrics, song.lyrics).toMatch(/\[(final )?chorus: male and female duet\]/);
    }
  });

  it('a solo (non-duet) vocal selection is left with plain, untagged section tags', () => {
    // v3.77 (TASK A) — same reasoning as above: opts.vocalQuota
    // deterministically guarantees no track here is a duet, which a bare
    // vocalTone lean can no longer promise (see vocalPlan.ts's
    // leaningAdultVocalQuota — leaning male still leaves a minimum share
    // for female/duet, by design, so a small pack could otherwise land a
    // duet by chance and break this test's "plain, untagged" premise).
    const soloPreset = vocalPresets.find(p => p.id === 'low-calm-male')!;
    const bp = generateLocalBlueprint(makeOptions({ songCount: 4, vocalTone: soloPreset.prompt, vocalQuota: { male: 1, female: 0, mixed: 0 } }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.lyrics).toContain('[verse 1]');
      expect(song.lyrics).toContain('[verse 2]');
      expect(song.lyrics).not.toContain('[verse 1: male vocal]');
      expect(song.lyrics).not.toContain('male and female duet');
    }
  });
});

describe('[v3.77 TASK A] vocalTone leans the auto quota without eliminating other genders', () => {
  it('a male-leaning vocalTone still leaves female and duet tracks in an 18-song pack', () => {
    const malePreset = vocalPresets.find(p => p.id === 'low-calm-male')!;
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18, vocalTone: malePreset.prompt }), testGenres, testMoods, testSeason);
    const byType = { male: 0, female: 0, mixed: 0 } as Record<string, number>;
    for (const song of bp.songs) {
      if (song.vocalType) byType[song.vocalType] = (byType[song.vocalType] ?? 0) + 1;
    }
    expect(byType.male).toBeGreaterThan(9);
    expect(byType.female).toBeGreaterThanOrEqual(3);
    expect(byType.mixed).toBeGreaterThanOrEqual(3);
    // Male tracks themselves should still vary (not one fixed sentence).
    const maleStylePrompts = new Set(bp.songs.filter(song => song.vocalType === 'male').map(song => song.stylePrompt));
    expect(maleStylePrompts.size).toBeGreaterThan(1);
  });
});
