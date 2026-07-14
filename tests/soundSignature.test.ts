import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildSoundSignature } from '../src/core/soundSignature';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks, testGenres, testMoods, testSeason } from './fixtures';

describe('sound signature', () => {
  const opts = makeOptions({ songCount: 30 });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  const signature = buildSoundSignature(blueprint, opts, opts.channel);

  it('keeps short and full signatures inside Suno budgets', () => {
    expect(signature.shortLength).toBeLessThanOrEqual(200);
    expect(signature.fullLength).toBeLessThanOrEqual(1000);
    expect(signature.short.length).toBe(signature.shortLength);
    expect(signature.full.length).toBe(signature.fullLength);
  });

  it('does not include song-specific or visual terms', () => {
    const text = `${signature.short} ${signature.full}`.toLowerCase();
    const firstSong = blueprint.songs[0];
    expect(text).not.toContain(firstSong.title.toLowerCase());
    expect(text).not.toContain(firstSong.hookPhrase.toLowerCase());
    expect(text).not.toContain(`track ${firstSong.trackNo}`);
    expect(text).not.toContain('bpm');
    expect(text).not.toContain('thumbnail');
    expect(text).not.toContain('typography');
    expect(text).not.toContain('serif');
  });

  it('orders clauses as genre, mood, instruments, vocal, production', () => {
    const text = signature.full.toLowerCase();
    const genreIndex = text.indexOf('warm adult contemporary pop');
    const moodIndex = text.indexOf('nostalgic');
    const instrumentIndex = text.indexOf('rhodes piano');
    const vocalIndex = text.indexOf('male');
    const productionIndex = text.indexOf('analog mix');
    expect(genreIndex).toBeGreaterThanOrEqual(0);
    expect(moodIndex).toBeGreaterThan(genreIndex);
    expect(instrumentIndex).toBeGreaterThan(moodIndex);
    expect(vocalIndex).toBeGreaterThan(instrumentIndex);
    expect(productionIndex).toBeGreaterThan(vocalIndex);
  });

  it('uses no more than three instruments', () => {
    const instrumentHits = testGenres[0].instruments.filter(instrument => signature.full.toLowerCase().includes(instrument.toLowerCase()));
    expect(instrumentHits.length).toBeLessThanOrEqual(3);
  });

  it('builds a readable channel season vocal persona name', () => {
    const parts = signature.personaName.split(/\s+/).filter(Boolean);
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(signature.personaName).toContain(opts.channel.name);
  });

  it('uses two middle-dot separators in personaName', () => {
    expect(signature.personaName.match(/ · /g) || []).toHaveLength(2);
    expect(signature.personaName).not.toContain('  ');
  });

  it('builds localized Korean and Japanese persona names', () => {
    const koreanSignature = signature;
    const japanChannel = channelPresets.find(channel => channel.id === 'morning-showa-cafe')!;
    const japaneseOpts = makeOptions({
      channel: japanChannel,
      genreIds: japanChannel.preferredGenres,
      moodIds: japanChannel.preferredMoods
    });
    const japaneseGenres = genrePacks.filter(genre => japaneseOpts.genreIds.includes(genre.id));
    const japaneseMoods = moodPacks.filter(mood => japaneseOpts.moodIds.includes(mood.id));
    const season = seasonPacks.find(pack => pack.id === japaneseOpts.seasonId)!;
    const japaneseBlueprint = generateLocalBlueprint(japaneseOpts, japaneseGenres, japaneseMoods, season);
    const japaneseSignature = buildSoundSignature(japaneseBlueprint, japaneseOpts, japanChannel);

    expect(koreanSignature.personaName).toBe('굿모닝 추억라디오 · 겨울 · 남성테너');
    expect(japaneseSignature.personaName).toBe('朝の昭和喫茶 · 冬 · 男性テナー');
  });

  it('is identical across every song in the same pack', () => {
    const unique = new Set(blueprint.songs.map(() => buildSoundSignature(blueprint, opts, opts.channel).short));
    expect(unique.size).toBe(1);
  });
});
