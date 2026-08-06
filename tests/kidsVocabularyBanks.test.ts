import { describe, expect, it } from 'vitest';
import {
  JP_KIDS_VOCABULARY_BANKS,
  KR_KIDS_VOCABULARY_BANKS,
  VOCABULARY_BANKS,
  vocabularyBankForScene
} from '../src/data/vocabularyBanks';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';

// v5.10 (TASK H) — kr-kids/jp-kids used to have ZERO entries in
// VOCABULARY_BANKS, so vocabularyBankForScene's workspace filter always
// produced an empty scoped list and silently fell back to the FULL unscoped
// list (senior-oldpop's own banks declared first) — a kr-kids/jp-kids track
// could resolve to '1960s-youth' or similar senior vocabulary as its
// "matched scene bank" metadata, and that same bank's `avoid` list feeds
// core/bridgeInstruction.ts's per-track "words to use/avoid" line for the
// Claude Code bridge path. These tests confirm the fix: kr-kids/jp-kids now
// resolve to their own real banks, and this bank's `avoid` list now also
// reaches the real generated excludePrompt for kids channels.

describe('[v5.10 TASK H] KR/JP kids vocabulary banks — structural sanity', () => {
  it('registers 5 kr-kids banks and 5 jp-kids banks, all merged into VOCABULARY_BANKS', () => {
    expect(KR_KIDS_VOCABULARY_BANKS).toHaveLength(5);
    expect(JP_KIDS_VOCABULARY_BANKS).toHaveLength(5);
    for (const bank of [...KR_KIDS_VOCABULARY_BANKS, ...JP_KIDS_VOCABULARY_BANKS]) {
      expect(VOCABULARY_BANKS).toContain(bank);
    }
  });

  it('every kr-kids bank is scoped to kr-kids only, with non-empty nouns/verbs/adjectives/avoid', () => {
    for (const bank of KR_KIDS_VOCABULARY_BANKS) {
      expect(bank.fitsWorkspaces).toEqual(['kr-kids']);
      expect(bank.nouns.length).toBeGreaterThan(0);
      expect(bank.verbs.length).toBeGreaterThan(0);
      expect(bank.adjectives.length).toBeGreaterThan(0);
      expect(bank.avoid.length).toBeGreaterThan(0);
    }
  });

  it('every jp-kids bank is scoped to jp-kids only, with non-empty nouns/verbs/adjectives/avoid', () => {
    for (const bank of JP_KIDS_VOCABULARY_BANKS) {
      expect(bank.fitsWorkspaces).toEqual(['jp-kids']);
      expect(bank.nouns.length).toBeGreaterThan(0);
      expect(bank.verbs.length).toBeGreaterThan(0);
      expect(bank.adjectives.length).toBeGreaterThan(0);
      expect(bank.avoid.length).toBeGreaterThan(0);
    }
  });

  it('kr-kids banks share one avoid list, and it never overlaps a jp-kids avoid word', () => {
    const krAvoidSets = KR_KIDS_VOCABULARY_BANKS.map(bank => bank.avoid.join('|'));
    expect(new Set(krAvoidSets).size).toBe(1);
    const jpAvoidSets = JP_KIDS_VOCABULARY_BANKS.map(bank => bank.avoid.join('|'));
    expect(new Set(jpAvoidSets).size).toBe(1);
    expect(KR_KIDS_VOCABULARY_BANKS[0].avoid).toEqual(
      expect.arrayContaining(['그리움', '추억', '회상', '이별', '외로움', '쓸쓸함', '창가', '주전자', '사진첩', '편지', '라디오'])
    );
    expect(JP_KIDS_VOCABULARY_BANKS[0].avoid).toEqual(
      expect.arrayContaining(['さびしい', 'かなしい', 'わかれ', 'こわい', 'おもいで'])
    );
  });
});

describe('[v5.10 TASK H] vocabularyBankForScene now resolves kr-kids/jp-kids to their own banks, not a senior/adult fallback', () => {
  it('a kr-kids call returns a kids-kr-* bank (before this fix it fell through to the unscoped list, e.g. senior\'s own "1960s-youth")', () => {
    const bank = vocabularyBankForScene(undefined, undefined, 'kr-kids');
    expect(bank.id.startsWith('kids-kr-')).toBe(true);
    expect(bank.fitsWorkspaces).toEqual(['kr-kids']);
    expect(bank.id).not.toBe('1960s-youth');
  });

  it('a jp-kids call returns a kids-jp-* bank, never a kr-kids/senior/adult bank', () => {
    const bank = vocabularyBankForScene(undefined, undefined, 'jp-kids');
    expect(bank.id.startsWith('kids-jp-')).toBe(true);
    expect(bank.fitsWorkspaces).toEqual(['jp-kids']);
  });

  it('is deterministic for the same kids workspace input', () => {
    const a = vocabularyBankForScene(undefined, undefined, 'kr-kids');
    const b = vocabularyBankForScene(undefined, undefined, 'kr-kids');
    expect(a.id).toBe(b.id);
  });
});

describe('[v5.10 TASK H] the kids avoid list reaches the real generated excludePrompt via actual generation', () => {
  const krKidsChannel = channelPresets.find(c => c.id === 'follow-along-action-song')!;
  const jpKidsChannel = channelPresets.find(c => c.id === 'teasobi-hiroba')!;
  const season = seasonPacks[0];

  function optionsFor(channel: typeof krKidsChannel, lyricLanguage: 'korean' | 'japanese') {
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    return {
      channel,
      genres,
      moods,
      opts: {
        channel,
        projectTitle: 'Test Kids Pack',
        songCount: 12,
        lyricLanguage,
        market: channel.market,
        audience: channel.audience,
        genreIds: channel.preferredGenres,
        moodIds: channel.preferredMoods,
        seasonId: season.id,
        vocalTone: channel.defaultVocal,
        perspective: 'firstPerson' as const,
        lyricDepth: 'commercial' as const,
        durationTarget: 'under3m30' as const,
        moneyChordMode: 'default' as const,
        customMoneyChord: '',
        customConcept: '',
        avoidWords: '',
        personaMode: false
      }
    };
  }

  it('a kr-kids pack\'s generated songs carry the kr-kids avoid words in excludePrompt', () => {
    const { genres, moods, opts } = optionsFor(krKidsChannel, 'korean');
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    expect(bp.songs.length).toBeGreaterThan(0);
    const krAvoidWords = KR_KIDS_VOCABULARY_BANKS[0].avoid;
    const withAvoidWord = bp.songs.filter(song =>
      krAvoidWords.some(word => (song.excludePrompt || '').includes(word))
    );
    expect(withAvoidWord.length).toBeGreaterThan(0);
    // Sanity: it's a real substring of a real generated field, not test fakery.
    const example = withAvoidWord[0]!.excludePrompt!;
    expect(krAvoidWords.some(word => example.includes(word))).toBe(true);
  });

  it('a jp-kids pack\'s generated songs carry the jp-kids avoid words in excludePrompt', () => {
    const { genres, moods, opts } = optionsFor(jpKidsChannel, 'japanese');
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    expect(bp.songs.length).toBeGreaterThan(0);
    const jpAvoidWords = JP_KIDS_VOCABULARY_BANKS[0].avoid;
    const withAvoidWord = bp.songs.filter(song =>
      jpAvoidWords.some(word => (song.excludePrompt || '').includes(word))
    );
    expect(withAvoidWord.length).toBeGreaterThan(0);
  });

  it('preallocateSongSlots (the Batch/bridge path) also carries a kids-scoped vocabularyBankId and matching negativeStyleText avoid words', () => {
    const { genres, opts } = optionsFor(krKidsChannel, 'korean');
    const slots = preallocateSongSlots(opts, genres);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every(slot => slot.vocabularyBankId?.startsWith('kids-kr-'))).toBe(true);
    const krAvoidWords = KR_KIDS_VOCABULARY_BANKS[0].avoid;
    const withAvoidWord = slots.filter(slot => krAvoidWords.some(word => (slot.negativeStyleText || '').includes(word)));
    expect(withAvoidWord.length).toBeGreaterThan(0);
  });

  it('a non-kids channel\'s excludePrompt is unaffected (no kids avoid words injected)', () => {
    const seniorChannel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const genres = genrePacks.filter(g => seniorChannel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => seniorChannel.preferredMoods.includes(m.id));
    const opts = {
      channel: seniorChannel,
      projectTitle: 'Test Senior Pack',
      songCount: 12,
      lyricLanguage: 'english' as const,
      market: seniorChannel.market,
      audience: seniorChannel.audience,
      genreIds: seniorChannel.preferredGenres,
      moodIds: seniorChannel.preferredMoods,
      seasonId: season.id,
      vocalTone: seniorChannel.defaultVocal,
      perspective: 'firstPerson' as const,
      lyricDepth: 'commercial' as const,
      durationTarget: 'under3m30' as const,
      moneyChordMode: 'default' as const,
      customMoneyChord: '',
      customConcept: '',
      avoidWords: '',
      personaMode: false
    };
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    const krAvoidWords = KR_KIDS_VOCABULARY_BANKS[0].avoid;
    const leaked = bp.songs.some(song => krAvoidWords.some(word => (song.excludePrompt || '').includes(word)));
    expect(leaked).toBe(false);
  });
});
