import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { countBpmTextMentions } from '../src/core/bpmDedupe';
import { hookDeviceIdsForNarrative } from '../src/core/hookDevicePlan';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { composeStylePrompt, SUNO_COPY_LIMIT, TERM_LABELS_KO } from '../src/core/promptBudget';
import { arrangementNarrativeForGenres } from '../src/core/promptComposer';
import { LEAD_ARRANGEMENT_NARRATIVES } from '../src/data/genreLibrary';
import { channelPresets, genrePacks, makeOptions, moodPacks, testSeason } from './fixtures';

const LEAD_NARRATIVE_IDS = Object.keys(LEAD_ARRANGEMENT_NARRATIVES).sort();
const imitationOrArtistTerms = /\b(in the style of|sounds like|as sung by|voice like|clone of|copy of|cover of|rewrite of|melody from|lyrics from|adele|beatles|beyonce|bts|bruno mars|celine dion|ed sheeran|iu|queen|taylor swift|the weeknd|yoasobi|utada)\b/i;
const bpmRangeOrApproxTerms = /\b(?:around|about|approx(?:imately)?|circa|near)\s+\d{2,3}\s*bpm\b|\bbpm\s*\d{2,3}\s*(?:-|~|to)\s*\d{2,3}\b|\b\d{2,3}\s*(?:-|~|to)\s*\d{2,3}\s*bpm\b|\b(?:medium\s+to\s+upbeat|mid|medium|moderate|slow|fast|upbeat|down)[-\s]?tempo\b/i;

function genreById(id: string) {
  const genre = genrePacks.find(item => item.id === id);
  if (!genre) throw new Error(`Missing test genre: ${id}`);
  return genre;
}

function channelForGenre(id: string) {
  if (id.startsWith('kids-')) {
    return channelPresets.find(channel => channel.id === 'little-singalong-radio')!;
  }
  if (id === 'showa-modern' || id === 'city-pop-soft' || id === 'jazz-pop') {
    return channelPresets.find(channel => channel.id === 'morning-showa-cafe')!;
  }
  return channelPresets.find(channel => channel.id === 'good-morning-memory-radio')!;
}

function moodsForChannel(channelId: string) {
  const channel = channelPresets.find(item => item.id === channelId)!;
  return moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
}

describe('[v3.47 Step 4] lead genre arrangement narratives', () => {
  it('attaches narratives to the six lead preset genres only', () => {
    const narratedPresetIds = genrePacks
      .filter(genre => genre.arrangementNarrative)
      .map(genre => genre.id)
      .sort();

    expect(narratedPresetIds).toEqual(LEAD_NARRATIVE_IDS);
  });

  it('describes section movement, hook entry, and mix character without artist imitation terms', () => {
    for (const id of LEAD_NARRATIVE_IDS) {
      const narrative = genreById(id).arrangementNarrative!;
      expect(narrative, id).toMatch(/\bverse\b/i);
      expect(narrative, id).toMatch(/\bpre-chorus\b/i);
      expect(narrative, id).toMatch(/\bchorus\b/i);
      expect(narrative, id).toMatch(/hook entry|downbeat|dropout|one-beat pause|rising sweep|drum pickup|walk-up|stop-and-go/i);
      expect(narrative, id).toMatch(/\bmix\b|close-mic|radio polish|tape warmth|analog|small-room|clean|natural/i);
      expect(narrative, id).not.toMatch(imitationOrArtistTerms);
    }
  });

  it('keeps narrative prompts under the Suno style limit with exactly one injected BPM', () => {
    for (const id of LEAD_NARRATIVE_IDS) {
      const genre = genreById(id);
      const channel = channelForGenre(id);
      const opts = makeOptions({
        channel,
        genreIds: [id],
        moodIds: channel.preferredMoods,
        songCount: 1
      });
      const blueprint = generateLocalBlueprint(opts, [genre], moodsForChannel(channel.id), testSeason, undefined, SUNO_COPY_LIMIT);
      const stylePrompt = blueprint.songs[0].stylePrompt;

      expect(stylePrompt.length, id).toBeLessThanOrEqual(SUNO_COPY_LIMIT);
      expect(countBpmTextMentions(stylePrompt), `${id}: ${stylePrompt}`).toBe(1);
      expect(stylePrompt, id).not.toMatch(bpmRangeOrApproxTerms);
      expect(stylePrompt, id).toMatch(/\bverse\b/i);
      expect(stylePrompt, id).toMatch(/\bpre-chorus\b/i);
      expect(stylePrompt, id).toMatch(/\bchorus\b/i);
      expect(stylePrompt, id).toMatch(/hook entry|downbeat|dropout|one-beat pause|rising sweep|drum pickup|walk-up|stop-and-go/i);
    }
  });

  it('keeps auxiliary hookDeviceText for narrative genres, filtered away from the narrative cue', () => {
    const narrativeChannel = channelPresets.find(channel => channel.id === 'morning-showa-cafe')!;
    const narrativeGenres = narrativeChannel.preferredGenres.map(genreById);
    const narrativeOpts = makeOptions({
      channel: narrativeChannel,
      genreIds: narrativeChannel.preferredGenres,
      moodIds: narrativeChannel.preferredMoods,
      songCount: 5
    });
    const narrativeSlots = preallocateSongSlots(narrativeOpts, narrativeGenres);
    const allowedIds = new Set(hookDeviceIdsForNarrative(arrangementNarrativeForGenres(narrativeGenres)));
    expect(narrativeSlots.every(slot => slot.hookDeviceText)).toBe(true);
    expect(narrativeSlots.every(slot => allowedIds.has(slot.hookDeviceId!))).toBe(true);

    const flatGenre = genreById('lofi-cafe');
    const flatOpts = makeOptions({ genreIds: [flatGenre.id], songCount: 5 });
    const flatSlots = preallocateSongSlots(flatOpts, [flatGenre]);
    expect(flatSlots.every(slot => slot.hookDeviceText)).toBe(true);
  });

  it('strips BPM ranges from the narrative before final tempo injection', () => {
    const showa = genreById('showa-modern');
    const sanitized = arrangementNarrativeForGenres([showa])!;
    expect(showa.arrangementNarrative).toMatch(/BPM 92-104/i);
    expect(sanitized).not.toMatch(/BPM 92-104/i);
    expect(countBpmTextMentions(sanitized)).toBe(0);
  });

  it('drops lower-priority extras before the genre narrative under a tight clause budget', () => {
    const result = composeStylePrompt([
      { id: 'vocal', text: 'close vocal' },
      { id: 'genreNarrative', text: 'Verse begins close, pre-chorus widens harmony, chorus opens clearly, hook entry uses a pause, mix stays warm' },
      { id: 'moneyChord', text: 'I-V-vi-IV progression' },
      { id: 'introTexture', text: 'Rhodes intro texture, INTRO ONLY' },
      { id: 'hookDevice', text: 'stop-time chorus accent' },
      { id: 'mixNotes', text: 'same channel vocal signature and mix balance across the full playlist set' }
    ], 240, 200);

    expect(result.length).toBeLessThanOrEqual(240);
    expect(result.prompt).toContain('Verse begins close');
    expect(result.prompt).toContain('hook entry uses');
    expect(result.prompt).toContain('I-V-vi-IV progression');
    expect(result.droppedTerms).toContain(TERM_LABELS_KO.mixNotes);
    expect(result.droppedTerms).not.toContain(TERM_LABELS_KO.genreNarrative);
  });
});
