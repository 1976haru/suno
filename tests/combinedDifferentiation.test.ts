import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { vocalPresets } from '../src/data/vocalPresets';
import { makeOptions } from './fixtures';
import type { ChannelArchetype, GenerationOptions } from '../src/types';

/**
 * v3.14 PART D — reproduces what the user actually did: change genre, vocal,
 * and money chord together, same concept/season, and check whether the
 * results are actually audibly different. This is the integration-level
 * check that catches interactions PART A-C's narrower unit tests could miss.
 */

function lineSet(text: string): Set<string> {
  return new Set(
    text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('[') && !line.startsWith('Title:')).map(line => line.toLowerCase())
  );
}

function lineOverlap(a: string, b: string): number {
  const setA = lineSet(a);
  const setB = lineSet(b);
  let common = 0;
  for (const line of setA) if (setB.has(line)) common += 1;
  return common / Math.max(setA.size, setB.size);
}

interface Combo {
  genreId: string;
  vocalId: string;
  moneyChordMode: GenerationOptions['moneyChordMode'];
}

const seniorMorningCombos: Combo[] = [
  { genreId: 'adult-contemporary', vocalId: 'warm-mature-male', moneyChordMode: 'default' },
  { genreId: 'acoustic-pop', vocalId: 'soft-female', moneyChordMode: 'emotional' },
  { genreId: 'jazz-pop', vocalId: 'low-calm-male', moneyChordMode: 'jazzColor' },
  { genreId: 'lofi-cafe', vocalId: 'clear-light-male', moneyChordMode: 'cityPop' },
  { genreId: 'christmas-soft-pop', vocalId: 'mature-female', moneyChordMode: 'winterBallad' }
];

const showaCafeCombos: Combo[] = [
  { genreId: 'showa-modern', vocalId: 'warm-mature-male', moneyChordMode: 'showaModern' },
  { genreId: 'city-pop-soft', vocalId: 'soft-female', moneyChordMode: 'cityPop' },
  { genreId: 'jazz-pop', vocalId: 'low-calm-male', moneyChordMode: 'jazzColor' },
  { genreId: 'bossa-cafe', vocalId: 'clear-light-male', moneyChordMode: 'default' },
  { genreId: 'piano-ballad', vocalId: 'mature-female', moneyChordMode: 'emotional' }
];

function channelForArchetype(archetype: ChannelArchetype) {
  const base = archetype === 'showa-cafe'
    ? channelPresets.find(c => c.id === 'morning-showa-cafe')!
    : channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  return { ...base, archetype };
}

function generateCombo(archetype: ChannelArchetype, combo: Combo, language: GenerationOptions['lyricLanguage'] = 'english') {
  const channel = channelForArchetype(archetype);
  const genre = genrePacks.find(g => g.id === combo.genreId)!;
  const vocal = vocalPresets.find(v => v.id === combo.vocalId)!;
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id)).slice(0, 2);
  const season = seasonPacks.find(s => s.id === 'first-snow') || seasonPacks[0];
  const opts = makeOptions({
    channel,
    songCount: 4,
    lyricLanguage: language,
    genreIds: [genre.id],
    moodIds: moods.map(m => m.id),
    seasonId: season.id,
    vocalTone: vocal.prompt,
    moneyChordMode: combo.moneyChordMode,
    customConcept: '그 겨울이 생각나는 노래'
  });
  return generateLocalBlueprint(opts, [genre], moods, season);
}

describe.each([
  ['senior-morning' as ChannelArchetype, seniorMorningCombos, 'english' as const],
  ['showa-cafe' as ChannelArchetype, showaCafeCombos, 'english' as const]
])('v3.14 combined differentiation — %s', (archetype, combos) => {
  it('5 genre+vocal+moneyChord combinations produce 5 mutually distinct stylePrompts (0 exact duplicate pairs)', () => {
    const prompts = combos.map(combo => generateCombo(archetype, combo).songs[3].stylePrompt);
    const duplicatePairs: [number, number][] = [];
    for (let i = 0; i < prompts.length; i++) {
      for (let j = i + 1; j < prompts.length; j++) {
        if (prompts[i] === prompts[j]) duplicatePairs.push([i, j]);
      }
    }
    expect(duplicatePairs, `identical stylePrompt pairs: ${JSON.stringify(duplicatePairs)}`).toEqual([]);
  });

  it('no pair of the 5 combinations has >= 90% lyric line overlap on a non-cold-open track', () => {
    const lyrics = combos.map(combo => generateCombo(archetype, combo).songs[3].lyrics);
    for (let i = 0; i < lyrics.length; i++) {
      for (let j = i + 1; j < lyrics.length; j++) {
        const overlap = lineOverlap(lyrics[i], lyrics[j]);
        expect(overlap, `combo ${i} vs ${j}: ${Math.round(overlap * 100)}% overlap`).toBeLessThan(0.9);
      }
    }
  });
});

describe('v3.14 combined differentiation — showaModern harmony visibility', () => {
  it('a combo using the showaModern money chord preset shows IVmaj7-family harmony text in the stylePrompt, not the generic fallback', () => {
    const bp = generateCombo('showa-cafe', showaCafeCombos[0]); // showaModern combo
    const style = bp.songs[3].stylePrompt;
    expect(style.toLowerCase()).not.toContain('money chord progression');
    expect(style).toMatch(/IVmaj7/i);
  });
});
