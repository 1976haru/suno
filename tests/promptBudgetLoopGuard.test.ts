import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { conceptStyleText } from '../src/core/conceptDiversity';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { composeStylePrompt, ESSENTIAL_TERM_IDS, STYLE_PROMPT_OVER_LIMIT_WARNING, SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';
import type { ChannelProfile, GenrePack } from '../src/types';

function moodsForChannel(channel: ChannelProfile) {
  const moods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  return moods.length ? moods : [moodPacks[0]];
}

function genreDescriptorLength(genre: GenrePack): number {
  return [
    genre.signatureSound,
    genre.arrangementNarrative,
    genre.styleCore,
    genre.shortPrompt,
    genre.productionGuidance,
    genre.instruments.join(', ')
  ].filter(Boolean).join(', ').length;
}

function longestGenre(): GenrePack {
  return [...genrePacks].sort((a, b) => genreDescriptorLength(b) - genreDescriptorLength(a))[0];
}

function longestConcept(): string {
  const candidates = [
    'morning cafe',
    'rainy night',
    'city lights',
    'youth and dreams',
    'old radio',
    'season change',
    'old friendship',
    'seaside memory',
    'garden walk',
    'long drive',
    'christmas cafe',
    'first snow',
    'Roman holiday morning cafe terrace with old radio letters, rainy windows, neon city light, long drive memories, and first snow'
  ];
  return candidates
    .map(concept => ({
      concept,
      length: Math.max(...Array.from({ length: 6 }, (_, index) => conceptStyleText(concept, index)?.length ?? 0))
    }))
    .sort((a, b) => b.length - a.length)[0].concept;
}

function musicClauseSet(prompt: string): Set<string> {
  return new Set(
    prompt
      .split(',')
      .map(clause => clause.trim().toLowerCase())
      .filter(clause => !/^\d{2,3} bpm$/.test(clause))
      // TASK v4.8 (TASK A) — 'hook repeats \dx' added: hookStyleDirectives'
      // compressed no-comma atom (was "strong repeated chorus hook, repeats
      // chorus 4x"), still shared boilerplate that must stay excluded here.
      .filter(clause => !/repeats chorus|repeated chorus hook|hook repeats \d+x|same channel vocal signature/.test(clause))
      .filter(clause => !/\b(vocal|voice|tenor|alto|soprano|choir|singer)\b/.test(clause))
      .filter(clause => !/progression|3:10-3:35|short intro|radio edit|complete song/.test(clause))
      .filter(clause => !/^concept (cue|emphasis):/.test(clause))
      // TASK v4.11 (TASK B) — data/openingHooks.ts's OPENING_LOUDNESS_DESCRIPTORS:
      // 3 fixed, non-genre-specific mix/production phrases (track 1's own
      // idx-0 slot always gets one), same shared-boilerplate category as the
      // hook-repeat/vocal/progression filters above.
      .filter(clause => !/full arrangement from the first bar|no quiet fade-in|opening is as loud and full as the chorus/.test(clause))
      .filter(Boolean)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const clause of a) if (b.has(clause)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

describe('[v3.55] prompt budget loop guard', () => {
  it('keeps concept removable and shortens genreSignature instead of dropping it', () => {
    expect(ESSENTIAL_TERM_IDS.has('concept')).toBe(false);
    expect(ESSENTIAL_TERM_IDS.has('genreSignature')).toBe(true);

    const result = composeStylePrompt([
      { id: 'vocal', text: 'warm vocal' },
      {
        id: 'genreSignature',
        text: 'swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised solo, warm analog room tone',
        shortForm: 'swing feel, walking upright bass, ii-V-I turnarounds'
      },
      { id: 'concept', text: 'concept cue: long rainy cafe story, concept emphasis: handwritten letter under the old radio, arrangement focus: wide bridge bloom' },
      { id: 'genre', text: 'jazz-pop' },
      { id: 'hook', text: 'strong repeated chorus hook' },
      { id: 'moneyChord', text: 'ii-V-I progression' },
      { id: 'duration', text: 'short song' },
      { id: 'introTexture', text: 'brief piano intro' },
      { id: 'tempo', text: '92 BPM' }
    ], 190, 190);

    expect(result.withinLimit).toBe(true);
    expect(result.prompt).toContain('swing feel');
    expect(result.prompt).toContain('walking upright bass');
    expect(result.prompt).toContain('ii-V-I turnarounds');
    expect(result.prompt).not.toContain('brushed snare with ride cymbal comping');
    expect(result.prompt).not.toContain('concept cue: long rainy cafe story');
  });

  it('returns with a warning when essential text alone cannot fit', () => {
    const result = composeStylePrompt([
      { id: 'vocal', text: 'essential vocal identity '.repeat(80) },
      { id: 'genreSignature', text: 'swing feel, walking upright bass, ii-V-I turnarounds' },
      { id: 'genre', text: 'jazz-pop' },
      { id: 'hook', text: 'strong repeated chorus hook' },
      { id: 'moneyChord', text: 'ii-V-I progression' },
      { id: 'duration', text: 'short song' },
      { id: 'introTexture', text: 'brief piano intro' },
      { id: 'tempo', text: '92 BPM' }
    ], SUNO_COPY_LIMIT, SUNO_COPY_LIMIT);

    expect(result.length).toBeGreaterThan(SUNO_COPY_LIMIT);
    expect(result.withinLimit).toBe(false);
    expect(result.warnings).toContain(STYLE_PROMPT_OVER_LIMIT_WARNING);
  });

  it('generates one song for every channel and every genre within 3 seconds per combination', () => {
    let checked = 0;
    for (const channel of channelPresets) {
      const moods = moodsForChannel(channel);
      const season = seasonPacks[0];
      for (const genre of genrePacks) {
        const opts = makeOptions({
          channel,
          genreIds: [genre.id],
          moodIds: moods.map(mood => mood.id),
          seasonId: season.id,
          lyricLanguage: channel.primaryLanguage,
          songCount: 1
        });

        const started = performance.now();
        const blueprint = generateLocalBlueprint(opts, [genre], moods, season, undefined, SUNO_COPY_LIMIT);
        const elapsed = performance.now() - started;

        checked += 1;
        expect(blueprint.songs).toHaveLength(1);
        expect(blueprint.songs[0].stylePrompt.trim().length, `${channel.id}/${genre.id}`).toBeGreaterThan(0);
        expect(elapsed, `${channel.id}/${genre.id}`).toBeLessThan(3000);
      }
    }
    expect(checked).toBe(channelPresets.length * genrePacks.length);
  }, 180_000);

  it('returns for longest genre, longest concept, and persona mode within 3 seconds', () => {
    const channel = channelPresets[0];
    const genre = longestGenre();
    const moods = moodsForChannel(channel);
    const season = seasonPacks[0];
    const opts = makeOptions({
      channel,
      genreIds: [genre.id],
      moodIds: moods.map(mood => mood.id),
      seasonId: season.id,
      customConcept: longestConcept(),
      personaMode: true,
      songCount: 1
    });

    const started = performance.now();
    const blueprint = generateLocalBlueprint(opts, [genre], moods, season, undefined, SUNO_COPY_LIMIT);
    const elapsed = performance.now() - started;

    expect(blueprint.songs).toHaveLength(1);
    expect(blueprint.songs[0].stylePrompt.trim().length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(3000);
  }, 10_000);

  it('keeps jazz-pop and adult-contemporary style similarity below 0.35', () => {
    const channel = channelPresets.find(item => item.id === 'good-morning-memory-radio')!;
    const moods = moodsForChannel(channel);
    const season = seasonPacks[0];
    const adult = genrePacks.find(genre => genre.id === 'adult-contemporary')!;
    const jazz = genrePacks.find(genre => genre.id === 'jazz-pop')!;
    const adultPrompt = generateLocalBlueprint(
      makeOptions({ channel, genreIds: [adult.id], moodIds: moods.map(mood => mood.id), seasonId: season.id, songCount: 1 }),
      [adult], moods, season
    ).songs[0].stylePrompt;
    const jazzPrompt = generateLocalBlueprint(
      makeOptions({ channel, genreIds: [jazz.id], moodIds: moods.map(mood => mood.id), seasonId: season.id, songCount: 1 }),
      [jazz], moods, season
    ).songs[0].stylePrompt;

    const similarity = jaccard(musicClauseSet(adultPrompt), musicClauseSet(jazzPrompt));
    expect(similarity).toBeLessThan(0.35);
  });
});
