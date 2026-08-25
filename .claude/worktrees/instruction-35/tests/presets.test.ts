import { describe, expect, it } from 'vitest';
import { channelPresets } from '../src/data/presets';
import { migrateLegacyChannelNames } from '../src/core/library';
import { makeOptions } from './fixtures';
import type { SavedPack } from '../src/types';

const HANGUL = /[가-힣]/;

describe('[P2] Japanese channel preset uses an actual Japanese name', () => {
  const japaneseChannel = channelPresets.find(c => c.id === 'morning-showa-cafe')!;

  it("name is '朝の昭和喫茶', not a Korean placeholder", () => {
    expect(japaneseChannel.name).toBe('朝の昭和喫茶');
    expect(HANGUL.test(japaneseChannel.name)).toBe(false);
  });

  it('englishName reads as an actual English/romanized name', () => {
    expect(japaneseChannel.englishName).toBe('Morning Showa Café');
  });

  it('seoKeywords contain no Korean text', () => {
    for (const keyword of japaneseChannel.seoKeywords) {
      expect(HANGUL.test(keyword)).toBe(false);
    }
  });
});

describe('[P2] Korean channel preset name matches the real channel name', () => {
  it("name is '굿모닝 추억라디오' (no internal space)", () => {
    const koreanChannel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    expect(koreanChannel.name).toBe('굿모닝 추억라디오');
  });
});

describe('[P2] migrateLegacyChannelNames (saved-pack channel-name resync)', () => {
  function makePack(overrides: Partial<SavedPack> = {}): SavedPack {
    const opts = makeOptions();
    return {
      id: 'pack-1',
      name: 'Test Pack',
      savedAt: new Date().toISOString(),
      isAutosave: false,
      channelId: 'morning-showa-cafe',
      channelName: '모닝 쇼와 카페',
      projectTitle: 'Test',
      songCount: 1,
      avgQualityScore: 90,
      blueprint: { projectTitle: 'Test', channelName: '모닝 쇼와 카페', oneLineConcept: '', sonicSignature: '', vocalSignature: '', lyricRules: [], harmonyRules: [], visualRules: [], songs: [] },
      options: { ...opts, channel: { ...opts.channel, id: 'morning-showa-cafe', name: '모닝 쇼와 카페', englishName: 'Morning Showa Cafe' } },
      ...overrides
    };
  }

  it('rewrites a stale Korean-named Japanese-channel pack to the current Japanese name', () => {
    const migrated = migrateLegacyChannelNames(makePack());
    expect(migrated.channelName).toBe('朝の昭和喫茶');
    expect(migrated.options.channel.name).toBe('朝の昭和喫茶');
  });

  it('leaves a pack already on the current name untouched', () => {
    const pack = makePack({ channelName: '朝の昭和喫茶', options: undefined as never });
    const opts = makeOptions();
    const upToDate = makePack({
      channelName: '朝の昭和喫茶',
      options: { ...opts, channel: { ...opts.channel, id: 'morning-showa-cafe', name: '朝の昭和喫茶', englishName: 'Morning Showa Café' } }
    });
    const migrated = migrateLegacyChannelNames(upToDate);
    expect(migrated).toEqual(upToDate);
    void pack;
  });

  it('never touches a custom (non-preset) channel id', () => {
    const pack = makePack({ channelId: 'my-custom-channel', channelName: 'My Custom Channel' });
    const migrated = migrateLegacyChannelNames(pack);
    expect(migrated).toEqual(pack);
  });
});
