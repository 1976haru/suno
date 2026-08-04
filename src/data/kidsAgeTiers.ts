/**
 * TASK D1 §4 — age-tier data. Before this file, age-tier code was 0건
 * (§1's own measurement table): a single 107-115 BPM band covered every
 * age from infant to early-elementary, and KIDS_AUDIENCE_PROFILE's
 * tempoFloor/tempoCeiling (92/128) can't even represent T1's 60-100 range.
 *
 * Pure data only — nothing here is wired into generation (§2-1: that's
 * A3's job, once safetyPolicyId/songLengthRange/tempo-band-allocation land
 * on AudienceProfile). Values come only from the D1 doc's own §4 table;
 * anywhere the table gives a category instead of a number (T2/T3's
 * "짧은 문장"/"문장 가능" sentence-length descriptions, "다수"/"중간" repeat
 * counts), the field is left `undefined` rather than guessed — see §4-3's
 * own instruction and §11-3's "미정(자료 없음)" reporting requirement.
 */
import type { KidsAgeTierId, KidsWhitelistLanguage } from './kidsVocabularyWhitelist';
import { kidsVocabularyWhitelistFor } from './kidsVocabularyWhitelist';

export type { KidsAgeTierId };

export interface KidsAgeTier {
  id: KidsAgeTierId;
  labelKo: string;
  ageRange: [number, number];
  tempoRange: [number, number];
  /** Words per line. `undefined` where the doc's §4 table gives only a category, not a number (T2/T3). */
  maxWordsPerLine: number | undefined;
  totalWordTarget: number;
  /** `undefined` where the doc's §4 table gives only a category, not a number (T2/T3: "다수"/"중간"). */
  minHookRepeats: number | undefined;
  allowedInstruments: string[];
  forbiddenTraits: string[];
  /**
   * Tier-appropriate emotion vocabulary. The doc's own KidsAgeTier shape
   * (§4-3) has no per-language axis — unlike kidsVocabularyWhitelist.ts's
   * 3-language whitelists (§3-3), this is one flat list per tier. Reuses
   * that Korean-language emotionWords list as the canonical source (Korean
   * is this file's own labelKo convention) rather than inventing separate
   * content; full per-language emotion vocabulary lives in
   * kidsVocabularyWhitelist.ts and is what the safety checker actually uses.
   */
  emotionVocabulary: string[];
}

const KIDS_COMMON_FORBIDDEN_TRAITS = ['타악 과다', '급격한 다이내믹', '고음 자극'];

function emotionVocabularyFor(tierId: KidsAgeTierId, language: KidsWhitelistLanguage = 'korean'): string[] {
  return [...kidsVocabularyWhitelistFor(tierId, language).emotionWords];
}

export const KIDS_AGE_TIERS: Record<KidsAgeTierId, KidsAgeTier> = {
  'kids-t1': {
    id: 'kids-t1',
    labelKo: 'T1 (0~2세)',
    ageRange: [0, 2],
    tempoRange: [60, 100],
    maxWordsPerLine: 5,
    totalWordTarget: 60,
    minHookRepeats: 6,
    allowedInstruments: ['부드러운 벨', '피아노', '우쿨렐레'],
    forbiddenTraits: KIDS_COMMON_FORBIDDEN_TRAITS,
    emotionVocabulary: emotionVocabularyFor('kids-t1')
  },
  'kids-t2': {
    id: 'kids-t2',
    labelKo: 'T2 (2~4세)',
    ageRange: [2, 4],
    tempoRange: [100, 130],
    maxWordsPerLine: undefined,
    totalWordTarget: 90,
    minHookRepeats: undefined,
    allowedInstruments: ['우쿨렐레', '마림바', '실로폰', '핸드클랩', '밝은 신스'],
    forbiddenTraits: KIDS_COMMON_FORBIDDEN_TRAITS,
    emotionVocabulary: emotionVocabularyFor('kids-t2')
  },
  'kids-t3': {
    id: 'kids-t3',
    labelKo: 'T3 (4~7세)',
    ageRange: [4, 7],
    tempoRange: [105, 140],
    maxWordsPerLine: undefined,
    totalWordTarget: 120,
    minHookRepeats: undefined,
    allowedInstruments: ['우쿨렐레', '마림바', '실로폰', '핸드클랩', '밝은 신스'],
    forbiddenTraits: KIDS_COMMON_FORBIDDEN_TRAITS,
    emotionVocabulary: emotionVocabularyFor('kids-t3')
  }
};

/** §4: "T2가 시장성이 가장 큽니다. 기본값으로 두십시오." */
export const DEFAULT_KIDS_AGE_TIER_ID: KidsAgeTierId = 'kids-t2';

export function kidsAgeTierFor(id: KidsAgeTierId): KidsAgeTier {
  return KIDS_AGE_TIERS[id];
}

/**
 * §4-4 — vocal composition is per-18-song-set and independent of age tier;
 * data only, wiring is D2/E1/F1's job (§2-2/§7).
 */
export const KIDS_VOCAL_COMPOSITION_PER_18: { male: number; female: number; mixed: number } = {
  male: 6,
  female: 6,
  mixed: 6
};
