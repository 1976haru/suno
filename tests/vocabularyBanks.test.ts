import { describe, expect, it } from 'vitest';
import {
  MIN_DISTINCT_BANKS_USED,
  QUIET_MORNING_BANK_ID,
  QUIET_MORNING_MAX_SHARE,
  SAME_BANK_MAX_SONGS,
  VOCABULARY_BANKS,
  vocabularyBankForScene
} from '../src/data/vocabularyBanks';

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
