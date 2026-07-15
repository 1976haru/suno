import { describe, expect, it, vi } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { regenerateTrack } from '../src/providers';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings, SongIdea } from '../src/types';

function stubFetchResponse(song: SongIdea) {
  return new Response(
    JSON.stringify({
      blueprint: {
        projectTitle: 'P',
        channelName: 'C',
        oneLineConcept: 'x',
        sonicSignature: 'x',
        vocalSignature: 'x',
        lyricRules: [],
        harmonyRules: [],
        visualRules: [],
        songs: [song]
      }
    }),
    { status: 200 }
  );
}

// Distinct enough per track that the diversity check (jaccard similarity
// against the rest of the pack) won't flag two refined tracks as duplicates
// of each other — a real refine call would naturally vary this much.
const LYRIC_VARIANTS = [
  'the harbor lights flicker low\nsalt wind through the empty pier',
  'a paper lantern drifts downstream\nvoices fading past the bend',
  'chalk dust settles on the desk\nafternoon sun through the blinds',
  'the subway hums a tired tune\nstrangers sharing one umbrella',
  'wildflowers push through cracked stone\na dog barking somewhere far off'
];

// Mirrors what useGenerationFlow.refineSelected does in the app: call
// regenerateTrack once per selected track, feeding each result forward.
async function refineSelected(
  blueprint: PlaylistBlueprint,
  trackNos: number[],
  opts: ReturnType<typeof makeOptions>,
  settings: ProviderSettings
) {
  let current = blueprint;
  for (const trackNo of trackNos) {
    const { blueprint: next } = await regenerateTrack(current, trackNo, opts, testGenres, testMoods, testSeason, settings);
    current = next;
  }
  return current;
}

describe('hybrid mode selective refine', () => {
  it('calls the API exactly once per selected track, never for unselected ones', async () => {
    const opts = makeOptions({ songCount: 10 });
    const draft = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };

    let callCount = 0;
    const requestedTrackOffsets: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        callCount += 1;
        const body = JSON.parse(init.body as string);
        requestedTrackOffsets.push(body.user.trackNoOffset);
        return stubFetchResponse({
          trackNo: body.user.trackNoOffset + 1,
          title: `Refined ${body.user.trackNoOffset + 1}`,
          seasonMoment: 'x',
          listenerSituation: 'x',
          emotionArc: 'x',
          hookPhrase: `Refined hook ${body.user.trackNoOffset + 1}`,
          stylePrompt: 'warm pop, hook "test" repeats chorus 4x, I-V-vi-IV progression',
          lyrics: `[verse 1]\n${LYRIC_VARIANTS[body.user.trackNoOffset % LYRIC_VARIANTS.length]}\n[chorus]\nhold on till the morning light\nwe'll be alright, we'll be alright\n[end]`,
          thumbnailText: 'x',
          youtube: { title: 'yt', description: 'desc', tags: ['tag'], thumbnailText: 'th' },
          qualityScore: 0,
          warnings: []
        });
      })
    );

    const selected = [2, 5];
    const result = await refineSelected(draft, selected, opts, settings);

    expect(callCount).toBe(selected.length);

    // Untouched tracks are byte-identical to the local draft — never sent anywhere.
    for (const song of draft.songs) {
      if (selected.includes(song.trackNo)) continue;
      expect(result.songs.find(s => s.trackNo === song.trackNo)).toEqual(song);
    }

    // Selected tracks were actually replaced with the API's response.
    for (const trackNo of selected) {
      expect(result.songs.find(s => s.trackNo === trackNo)?.title).toBe(`Refined ${trackNo}`);
    }

    vi.unstubAllGlobals();
  });

  it('makes zero API calls when nothing is selected', async () => {
    const opts = makeOptions({ songCount: 5 });
    const draft = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await refineSelected(draft, [], opts, settings);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual(draft);
    vi.unstubAllGlobals();
  });
});
