import { describe, expect, it } from 'vitest';
import {
  MIN_DISTINCT_BANKS_USED,
  QUIET_MORNING_BANK_ID,
  QUIET_MORNING_MAX_SHARE,
  SAME_BANK_MAX_SONGS,
  VOCABULARY_BANKS,
  vocabularyBankForScene
} from '../src/data/vocabularyBanks';
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from './fixtures';

describe('[v4.5 TASK C] VOCABULARY_BANKS — at least 8 scene/motion-based banks', () => {
  it('has at least 8 banks total', () => {
    expect(VOCABULARY_BANKS.length).toBeGreaterThanOrEqual(8);
  });

  it('quiet-morning is kept, not deleted (real listening feedback: "좋은 가사가 나오는 뱅크")', () => {
    expect(VOCABULARY_BANKS.some(bank => bank.id === QUIET_MORNING_BANK_ID)).toBe(true);
  });

  it('every scene bank has a non-empty avoid list or is explicitly frame-agnostic (seasonal/emotional)', () => {
    for (const bank of VOCABULARY_BANKS) {
      expect(Array.isArray(bank.avoid)).toBe(true);
    }
  });
});

describe('[v4.5 TASK C] vocabularyBankForScene', () => {
  it('matches dance-saturday frame to the dance-night bank', () => {
    const bank = vocabularyBankForScene('dance-saturday', '춤');
    expect(bank.id).toBe('dance-night');
    expect(bank.nouns).toContain('dance floor');
    expect(bank.avoid).toContain('quiet');
  });

  it('matches young-first-love frame to the young-romance bank', () => {
    const bank = vocabularyBankForScene('young-first-love', undefined);
    expect(bank.id).toBe('young-romance');
  });

  it('matches reunion-parting frame to the reunion-parting bank', () => {
    const bank = vocabularyBankForScene('reunion-parting', undefined);
    expect(bank.id).toBe('reunion-parting');
  });

  it('falls back to quiet-morning for solitary-object / no frame data (the ~80% of the theme pool that predates frameId)', () => {
    expect(vocabularyBankForScene('solitary-object', undefined).id).toBe(QUIET_MORNING_BANK_ID);
    expect(vocabularyBankForScene(undefined, undefined).id).toBe(QUIET_MORNING_BANK_ID);
  });

  it('is a pure function — same input always returns the same bank', () => {
    const a = vocabularyBankForScene('dance-saturday', '춤');
    const b = vocabularyBankForScene('dance-saturday', '춤');
    expect(a.id).toBe(b.id);
  });
});

describe('[v4.5 TASK C, 3-4] set-level distribution constants match the spec exactly', () => {
  it('quiet-morning cap is 40%, same-bank cap is 6 songs, min distinct banks is 4', () => {
    expect(QUIET_MORNING_MAX_SHARE).toBe(0.4);
    expect(SAME_BANK_MAX_SONGS).toBe(6);
    expect(MIN_DISTINCT_BANKS_USED).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// v4.5 (TASK D follow-up) — vocabularyBankId used to be metadata-only: the
// local composer's actual lyric text (core/lyricEngine.ts's composeLyrics)
// never drew from a track's own assigned scene bank, only from the older,
// separate CONCEPT_PRESETS/fallbackConcept mechanism in conceptDiversity.ts.
// A concept like "젊은 시절 춤추던 토요일 밤" could correctly get
// dance-saturday/dance-night assigned as metadata (TASK D's own allocation
// fix) while the sung lyrics stayed generic quiet/porch/strum imagery. This
// closes that gap by feeding a small sample of the matched bank's nouns into
// composeLyrics's genreFlavorImages for non-quiet-morning banks only.
// ---------------------------------------------------------------------------
describe('[v4.5 TASK D follow-up] scene vocabulary bank words actually reach local generation', () => {
  const seniorChannel = channelPresets.find(c => c.archetype === 'senior-morning')!;

  function generatePackFor(concept: string) {
    const plan = directSetLocal(concept, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
    const genreIds = Object.keys(genreAllocation.counts);
    const genres = genreIds.map(id => getGenreById(id)!).filter(Boolean);
    const opts = {
      channel: seniorChannel,
      projectTitle: concept,
      songCount: 18,
      lyricLanguage: 'english' as const,
      market: seniorChannel.market,
      audience: seniorChannel.audience,
      genreIds,
      moodIds: seniorChannel.preferredMoods,
      seasonId: 'spring-open',
      vocalTone: seniorChannel.defaultVocal,
      perspective: 'firstPerson' as const,
      lyricDepth: 'commercial' as const,
      durationTarget: 'under3m30' as const,
      moneyChordMode: 'default' as const,
      customMoneyChord: '',
      customConcept: concept,
      avoidWords: '',
      personaMode: false,
      diversityAllocations: plan.allocations
    };
    return generateLocalBlueprint(opts, genres, [], { id: 'spring-open', label: 'Spring', period: '', keywords: [], visualDirection: '' } as any);
  }

  it('a majority of dance-night-tagged tracks actually sing dance-night bank vocabulary', () => {
    const bp = generatePackFor('젊은 시절 춤추던 토요일 밤');
    const danceTagged = (bp.songs as any[]).filter(s => s.vocabularyBankId === 'dance-night');
    expect(danceTagged.length).toBeGreaterThan(0);
    const danceBank = VOCABULARY_BANKS.find(b => b.id === 'dance-night')!;
    const hitCount = danceTagged.filter(song => {
      const text = (song.lyrics || '').toLowerCase();
      return danceBank.nouns.some(noun => text.includes(noun.toLowerCase()));
    }).length;
    expect(hitCount / danceTagged.length).toBeGreaterThanOrEqual(0.5);
  });

  it('quiet-morning-tagged tracks are unaffected (no forced scene-bank words injected)', () => {
    const bp = generatePackFor('6070년대 향수가 느껴지는 올드팝');
    const quietTagged = (bp.songs as any[]).filter(s => s.vocabularyBankId === QUIET_MORNING_BANK_ID);
    expect(quietTagged.length).toBeGreaterThan(0);
    // Only the actually-injected phrase, and only the distinctive multi-word
    // one ('dance floor') — single common words like 'band'/'crowd' are
    // already used elsewhere in this app's generic templates (e.g. the
    // fixed "(instrumental hook, band plays the melody...)" tag, unrelated
    // to any vocabulary bank), so checking those would false-positive.
    const leaked = quietTagged.some(song => (song.lyrics || '').toLowerCase().includes('dance floor'));
    expect(leaked).toBe(false);
  });
});
