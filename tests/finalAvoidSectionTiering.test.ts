import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';

/**
 * v5.23 (TASK F §7) — "안전(절대) / 품질(강함) / 스타일(권고)로 나누십시오":
 * verifies the final avoid section (already consolidated by TASK A) is now
 * explicitly tiered, and re-checks the ≤30 line / ≤30% budget TASK A's own
 * §1-3 measured against (68 prohibition spots, 1,531-line instruction) still
 * holds for this section specifically.
 */
function buildRealInstruction() {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio') ?? channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({
    channel, songCount: 18, lyricLanguage: 'english', genreIds: genres.map(g => g.id),
    moodIds: moods.map(m => m.id), seasonId: season.id
  });
  const slots = preallocateSongSlots(opts, genres);
  return buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: ['Old Title'], usedHooks: ['Old Hook'] }, slots, false, {});
}

describe('[v5.23 TASK F] final avoid section is tiered into 안전/품질', () => {
  it('labels a safety-absolute tier and a quality tier, each before their own bullets', () => {
    const instruction = buildRealInstruction();
    const sectionStart = instruction.indexOf('[마지막으로, 이것만은 피하십시오]');
    const section = instruction.slice(sectionStart, sectionStart + 1500);
    const safetyIdx = section.indexOf('안전 (절대 완화하지 않음)');
    const qualityIdx = section.indexOf('품질 (항상 지킴');
    expect(safetyIdx).toBeGreaterThan(-1);
    expect(qualityIdx).toBeGreaterThan(safetyIdx);
    // The artist/copyright bullet is the one safety-absolute item, and it must sit under the 안전 header, before 품질's.
    const artistIdx = section.indexOf('실제 아티스트');
    expect(artistIdx).toBeGreaterThan(safetyIdx);
    expect(artistIdx).toBeLessThan(qualityIdx);
  });

  it('the whole final avoid section stays within a ~30 line budget', () => {
    const instruction = buildRealInstruction();
    const sectionStart = instruction.indexOf('[마지막으로, 이것만은 피하십시오]');
    const nextSectionIdx = instruction.indexOf('\n\n', instruction.indexOf('negativeStyleText는'));
    const section = instruction.slice(sectionStart, nextSectionIdx === -1 ? sectionStart + 2000 : nextSectionIdx);
    const lineCount = section.split('\n').filter(line => line.trim().length > 0).length;
    expect(lineCount).toBeLessThanOrEqual(30);
  });
});
