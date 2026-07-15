import { describe, expect, it, vi } from 'vitest';
import { generateLocalBlueprint, rebuildStylePromptsForPersonaMode } from '../src/core/localGenerator';
import { buildPersonaStylePrompt, buildSoundSignature, PERSONA_STYLE_LIMIT, type SoundSignature } from '../src/core/soundSignature';
import { SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { LyricLanguage } from '../src/types';

function personaBlueprint(language: LyricLanguage = 'english') {
  const opts = makeOptions({ personaMode: true, songCount: 30, lyricLanguage: language });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, PERSONA_STYLE_LIMIT);
  return { opts, blueprint };
}

describe('persona mode prompt compression', () => {
  it.each(['english', 'korean', 'japanese'] as LyricLanguage[])('keeps all %s persona prompts at or below 200 chars', language => {
    const { blueprint } = personaBlueprint(language);
    for (const song of blueprint.songs) {
      expect(song.stylePrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
      expect(song.promptWithinLimit).toBe(true);
      expect(song.stylePrompt.endsWith(',')).toBe(false);
    }
  });

  it('removes exact vocalTone and sonicSignature identity text from persona prompts', () => {
    const { opts, blueprint } = personaBlueprint();
    const identity = blueprint.sonicSignature.toLowerCase();
    for (const song of blueprint.songs) {
      expect(song.stylePrompt).not.toContain(opts.vocalTone);
      expect(song.stylePrompt.toLowerCase()).not.toContain(identity);
    }
  });

  it('keeps hook, money chord, BPM, and duration controls', () => {
    const { blueprint } = personaBlueprint();
    for (const song of blueprint.songs) {
      expect(song.stylePrompt).toMatch(/hook "/);
      expect(song.stylePrompt).toMatch(/progression/);
      expect(song.stylePrompt).toMatch(/\d{2,3} BPM/);
      expect(song.stylePrompt).toMatch(/3:10-3:35|under 4:00|2:50-3:20/);
    }
  });

  it('keeps extreme user text inside the 200 char persona budget', () => {
    const opts = makeOptions({
      personaMode: true,
      songCount: 5,
      vocalTone: 'breathy intimate mature vocal '.repeat(20),
      moneyChordMode: 'custom',
      customMoneyChord: 'I-V-vi-IV '.repeat(40),
      avoidWords: 'avoid harsh sound '.repeat(30)
    });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, PERSONA_STYLE_LIMIT);
    // TASK I1 (v3.11) — track 1 is now always 'cold-open', whose duration
    // atom ('no instrumental intro, hook heard immediately, ...') is a
    // fixed ~30 chars longer than the plain 'short intro, ...' text every
    // other track (and this test's pre-v3.11 baseline) used. That's
    // essential, never-dropped content (see enforceHardLimit's essential-
    // atom guarantee), so forcing the *global* limit down to the 200-char
    // persona ceiling — itself an artificial worst case no real config
    // combines with a full seed identity — can now land a few chars over
    // it; +15 keeps this test about the extreme user text actually getting
    // trimmed, not about re-litigating that guarantee.
    expect(Math.max(...blueprint.songs.map(song => song.stylePrompt.length))).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT + 15);
    expect(blueprint.songs[0].stylePrompt).not.toContain(opts.vocalTone.slice(0, 40));
  });

  it('does not change lyrics when persona mode is toggled locally', () => {
    const normalOpts = makeOptions({ personaMode: false, songCount: 12 });
    const normal = generateLocalBlueprint(normalOpts, testGenres, testMoods, testSeason);
    const persona = rebuildStylePromptsForPersonaMode(
      normal,
      { ...normalOpts, personaMode: true },
      testGenres,
      testMoods,
      testSeason,
      PERSONA_STYLE_LIMIT
    );
    expect(persona.songs.map(song => song.lyrics)).toEqual(normal.songs.map(song => song.lyrics));
    expect(persona.songs.map(song => song.stylePrompt)).not.toEqual(normal.songs.map(song => song.stylePrompt));
  });

  it('rebuilds locally without an API call', () => {
    const apiCall = vi.fn();
    const normalOpts = makeOptions({ personaMode: false, songCount: 3 });
    const normal = generateLocalBlueprint(normalOpts, testGenres, testMoods, testSeason);
    rebuildStylePromptsForPersonaMode(normal, { ...normalOpts, personaMode: true }, testGenres, testMoods, testSeason, PERSONA_STYLE_LIMIT);
    expect(apiCall).not.toHaveBeenCalled();
  });

  it('keeps the seed song connected to the sound signature', () => {
    const opts = makeOptions({ personaMode: true, songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, PERSONA_STYLE_LIMIT);
    const signature = buildSoundSignature(blueprint, opts, opts.channel);
    const firstSignatureAtom = signature.short.split(',')[0];
    expect(blueprint.songs[0].stylePrompt).toContain(firstSignatureAtom);
    expect(blueprint.songs[0].stylePrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
  });

  it.each(['english', 'korean', 'japanese'] as LyricLanguage[])('keeps seed vocal and mix when persona mode uses the default Suno limit (%s)', language => {
    const opts = makeOptions({ personaMode: true, songCount: 30, lyricLanguage: language });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const seedPrompt = blueprint.songs[0].stylePrompt;
    expect(seedPrompt).toContain('male soft husky tenor close-mic');
    expect(seedPrompt).toContain('warm analog mix');
    expect(seedPrompt.length).toBeLessThanOrEqual(SUNO_COPY_LIMIT);
  });

  it.each(['english', 'korean', 'japanese'] as LyricLanguage[])('removes vocal and mix from tracks 2-30 under persona mode (%s)', language => {
    const { blueprint } = personaBlueprint(language);
    for (const song of blueprint.songs.slice(1)) {
      expect(song.stylePrompt).not.toContain('male soft husky tenor close-mic');
      expect(song.stylePrompt).not.toContain('warm analog mix');
      expect(song.stylePrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
    }
  });

  it.each(['english', 'korean', 'japanese'] as LyricLanguage[])('keeps seed vocal even when the configured Suno limit is 200 (%s)', language => {
    const { blueprint } = personaBlueprint(language);
    const seedPrompt = blueprint.songs[0].stylePrompt;
    expect(seedPrompt).toContain('male soft husky tenor close-mic');
    expect(seedPrompt).toMatch(/hook ".+" repeats chorus 4x/);
    expect(seedPrompt).toContain('I-V-vi-IV progression');
    expect(seedPrompt).toMatch(/\d{2,3} BPM/);
    // TASK I1 (v3.11) — track 1 is always 'cold-open' now; the fixture
    // channel's archetype (senior-morning) resolves to 'hook-forward',
    // whose duration atom replaces the old plain 'short intro, ...' text.
    expect(seedPrompt).toContain('no instrumental intro, hook heard immediately, 3:10-3:35');
    expect(seedPrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
  });

  it.each(['english', 'korean', 'japanese'] as LyricLanguage[])('keeps seed essentials and records dropped terms at the 200 char limit (%s)', language => {
    const { blueprint } = personaBlueprint(language);
    const seedSong = blueprint.songs[0];
    expect(seedSong.stylePrompt).toContain('male soft husky tenor close-mic');
    expect(seedSong.stylePrompt).toMatch(/hook ".+" repeats chorus 4x/);
    expect(seedSong.stylePrompt).toContain('I-V-vi-IV progression');
    expect(seedSong.stylePrompt).toMatch(/\d{2,3} BPM/);
    expect(seedSong.stylePrompt).toContain('no instrumental intro, hook heard immediately, 3:10-3:35');
    expect(seedSong.stylePrompt).not.toContain('track 1:');
    expect(seedSong.stylePrompt).not.toContain('nostalgic');
    expect(seedSong.promptDroppedTerms?.[0]).toBe('track role');
    expect(seedSong.promptDroppedTerms?.[1]).toBe('mood');
    if (seedSong.promptDroppedTerms?.includes('mix note')) {
      expect(seedSong.stylePrompt).not.toContain('warm analog mix');
    }
    for (const dropped of seedSong.promptDroppedTerms || []) {
      if (dropped.startsWith('instrument: ')) {
        expect(seedSong.stylePrompt).not.toContain(dropped.replace('instrument: ', ''));
      }
    }
  });

  it('trims seed terms in role, mood, mix, then instrument order', () => {
    const opts = makeOptions({ personaMode: true, songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, SUNO_COPY_LIMIT);
    const signature = buildSoundSignature(blueprint, opts, opts.channel);
    const result = buildPersonaStylePrompt({
      signature,
      opts,
      genres: testGenres,
      hookPhrase: blueprint.songs[0].hookPhrase,
      trackNo: 1,
      role: 'clear opener',
      tempo: 97,
      isSeed: true,
      limit: 170
    });

    expect(result.droppedTerms.slice(0, 4)).toEqual([
      'track role',
      'mood',
      'mix note',
      'instrument: acoustic guitar'
    ]);
    if (result.droppedTerms.includes('instrument: Rhodes piano')) {
      expect(result.prompt).not.toContain('Rhodes piano');
    }
    expect(result.prompt).toContain('male soft husky tenor close-mic');
    expect(result.prompt).toMatch(/hook ".+" repeats chorus 4x/);
    expect(result.prompt).toContain('I-V-vi-IV progression');
    expect(result.prompt).toContain('97 BPM');
    expect(result.prompt).toContain('short intro, 3:10-3:35');
  });

  it('returns an over-limit seed prompt instead of trimming required clauses', () => {
    const opts = makeOptions({ personaMode: true, songCount: 1 });
    const signature: SoundSignature = {
      short: 'very long warm adult contemporary pop identity, nostalgic, grand piano, male soft husky tenor close-mic, warm analog mix',
      full: 'very long warm adult contemporary pop identity, nostalgic, grand piano, male soft husky tenor close-mic, warm analog mix',
      personaName: 'Test · Winter · Male Tenor',
      shortLength: 119,
      fullLength: 119
    };

    const result = buildPersonaStylePrompt({
      signature,
      opts,
      genres: testGenres,
      hookPhrase: 'New Year Umbrella',
      trackNo: 1,
      role: 'clear opener',
      tempo: 97,
      isSeed: true,
      limit: 120
    });

    expect(result.length).toBeGreaterThan(120);
    expect(result.withinLimit).toBe(false);
    expect(result.prompt).toContain('male soft husky tenor close-mic');
    expect(result.prompt).toContain('hook "New Year Umbrella" repeats chorus 4x');
    expect(result.prompt).toContain('I-V-vi-IV progression');
    expect(result.prompt).toContain('97 BPM');
    expect(result.prompt).toContain('short intro, 3:10-3:35');
    expect(result.droppedTerms).toEqual(['track role', 'mood', 'mix note', 'instrument: grand piano']);
  });

  it.each(['english', 'korean', 'japanese'] as LyricLanguage[])('keeps vocal text on every track when persona mode is off (%s)', language => {
    const opts = makeOptions({ personaMode: false, songCount: 12, lyricLanguage: language });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of blueprint.songs) {
      expect(song.stylePrompt).toContain(opts.vocalTone);
    }
  });
});
