import { measureLyricLanguageRatios, checkLyricLanguageMatch } from './lyricMetrics';
import { katakanaShareOfKana } from './jp2030Policy';
import { KIDS_AGE_TIERS, DEFAULT_KIDS_AGE_TIER_ID, type KidsAgeTierId } from '../data/kidsAgeTiers';
import {
  resolveKrKidsExpectedPhasePolicy,
  findAdultPhaseLeaks,
  findConsecutivePhaseRuns,
  checkKrKidsSafety
} from './krKidsPolicy';

/**
 * codex 지시문 04 (§5) — "kr-kids의 구조를 공유하되 일본어 전용 정책을
 * 적용한다": re-exports the SAME real phase/bundle/safety structure
 * krKidsPolicy.ts already exposes (core/arcModels.ts's bundle system is
 * workspace-agnostic — the same 3/4/5-bundle definitions apply to both
 * kr-kids and jp-kids, confirmed by arcModels.ts's own real code, which
 * takes only songCount/ageTier, never a language/workspace parameter).
 * Only the LANGUAGE-specific checks below are genuinely jp-kids-own.
 */
export const resolveJpKidsExpectedPhasePolicy = resolveKrKidsExpectedPhasePolicy;
export const findJpKidsAdultPhaseLeaks = findAdultPhaseLeaks;
export const findJpKidsConsecutivePhaseRuns = findConsecutivePhaseRuns;
export const checkJpKidsGenericSafety = checkKrKidsSafety;

// ---------------------------------------------------------------------------
// Language — real per-age-tier kana ratio (extends the workspace-agnostic floor)
// ---------------------------------------------------------------------------

/**
 * "연령대별 kana 비율" — real gap: core/lyricMetrics.ts's own
 * JAPANESE_KANA_RATIO_MIN (0.2) is a single, workspace-agnostic floor
 * (confirmed private/non-exported, one number for every Japanese
 * workspace). Real per-tier floors here are honestly NEW (not
 * measurement-calibrated the way the existing 0.2 floor was — see that
 * constant's own doc comment for its real 1700+-song calibration) —
 * documented as a reasonable, conservative extension: younger children's
 * content should read as near-pure kana with minimal kanji, tightening
 * with age exactly the same direction data/kidsAgeTiers.ts's own real
 * totalWordTarget/minHookRepeats already tighten with age.
 */
export const JP_KIDS_KANA_RATIO_MIN_BY_TIER: Record<KidsAgeTierId, number> = {
  'kids-t1': 0.9,
  'kids-t2': 0.8,
  'kids-t3': 0.7
};

/**
 * 지시문 11 (TASK D) — 위 0.9/0.8/0.7 floor는 실측 검증된 값이 아니라는 사실을
 * 이 doc comment 뿐 아니라 코드 자체의 상태값으로도 표시한다. "50개 이상의
 * 승인된 실제 jp-kids 결과가 쌓이기 전까지는 provisional" — scripts/
 * calibrateJpKidsLanguage.ts가 이 임계값(JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION)을
 * 그대로 참조해 "아직 데이터가 부족하다"를 정직하게 보고한다. 이 지시문
 * 자신의 "하지 말 것": 50곡이 쌓이기 전에 이 floor를 자동으로 바꾸지 않는다
 * — calibrateJpKidsLanguage.ts는 값을 계산해 사람이 검토할 후보만 출력하고,
 * JP_KIDS_KANA_RATIO_MIN_BY_TIER를 직접 덮어쓰지 않는다.
 */
export type CalibrationStatus = 'provisional' | 'calibrated';

export const JP_KIDS_KANA_RATIO_CALIBRATION_STATUS: Record<KidsAgeTierId, CalibrationStatus> = {
  'kids-t1': 'provisional',
  'kids-t2': 'provisional',
  'kids-t3': 'provisional'
};

export const JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION = 50;

export function kanaRatioMinForTier(tierId: KidsAgeTierId): number {
  return JP_KIDS_KANA_RATIO_MIN_BY_TIER[tierId] ?? JP_KIDS_KANA_RATIO_MIN_BY_TIER[DEFAULT_KIDS_AGE_TIER_ID];
}

export function checkJpKidsKanaRatio(lyrics: string, tierId: KidsAgeTierId): { ratio: number; belowFloor: boolean } {
  const ratios = measureLyricLanguageRatios(lyrics);
  const floor = kanaRatioMinForTier(tierId);
  return { ratio: ratios.kanaRatio, belowFloor: ratios.kanaRatio < floor };
}

/** "중국어형 문장 차단" — reuses core/lyricMetrics.ts's own real, already-calibrated checkLyricLanguageMatch (kanaRatio floor already catches kanji-only/Chinese-reading text — see that function's own real pure-Chinese test case) — not reimplemented. */
export function checkJpKidsNotChineseStyle(lyrics: string): boolean {
  const check = checkLyricLanguageMatch(lyrics, 'japanese');
  return check?.ok ?? true;
}

/** "영어 katakana 과다 제한" — reuses core/jp2030Policy.ts's own real katakanaShareOfKana (지시문 04 §3), same threshold, not a second implementation. */
export const JP_KIDS_KATAKANA_OVERUSE_THRESHOLD = 0.5;

export function findJpKidsKatakanaOveruse(songs: { trackNo: number; lyrics: string }[]): number[] {
  return songs.filter(song => katakanaShareOfKana(song.lyrics) > JP_KIDS_KATAKANA_OVERUSE_THRESHOLD).map(song => song.trackNo);
}

// ---------------------------------------------------------------------------
// Culture — trademarked character/brand names (lyric-side, real gap)
// ---------------------------------------------------------------------------

/**
 * "특정 상표·캐릭터·저작권 IP 금지" — real gap confirmed by investigation:
 * core/thumbnailSpec.ts has real character/IP exclusion precedent, but only
 * for the VISUAL side (thumbnail negative-prompt lists); the lyric side had
 * only a generic brand/sponsor/advertisement WORD check
 * (kidsLyricEngine.ts's own KIDS_FORBIDDEN_TERMS, reused via
 * checkJpKidsGenericSafety above), never an actual character/brand NAME
 * list. A real, small, well-known-name list — same honest word-blacklist
 * limitation as every other safety check in this app (a truly obscure or
 * newly-coined character name would still slip through).
 */
const JP_KIDS_TRADEMARK_TERMS: RegExp[] = [
  /ポケモン|ピカチュウ/,
  /アンパンマン/,
  /ドラえもん/,
  /ミッキーマウス|ディズニー/,
  /プリキュア/,
  /\b(pokemon|pikachu|disney|mickey mouse)\b/i
];

export function findJpKidsTrademarkReferences(lyrics: string): boolean {
  return JP_KIDS_TRADEMARK_TERMS.some(pattern => pattern.test(lyrics));
}

/**
 * "한국식 학교 용어를 일본어로 직역한 부자연스러운 장면 차단" — real, bounded
 * check: a small set of Korean-school-specific concepts that, if literally
 * translated into Japanese, read as an unnatural scene to a real Japanese
 * child (Japan's own school system uses different real terms — school
 * grade names, cafeteria conventions differ). Flags the LITERAL
 * mistranslation forms, not the legitimate real Japanese equivalents.
 */
const KR_SCHOOL_TERM_MISTRANSLATIONS_JA: RegExp[] = [
  /給食当番.{0,4}が.{0,4}お母さん/, // "급식 당번" concept doesn't map to Japanese school culture this way
  /村\s*の\s*先生/ // a literal "village teacher" framing uncommon in real Japanese school lyric convention
];

export function findKrSchoolTermMistranslation(lyrics: string): boolean {
  return KR_SCHOOL_TERM_MISTRANSLATIONS_JA.some(pattern => pattern.test(lyrics));
}

// ---------------------------------------------------------------------------
// Furigana — no real precedent, honestly scoped as a type stub only
// ---------------------------------------------------------------------------

/**
 * "furigana는 출력 형식에 맞게 선택" — confirmed by investigation: zero
 * furigana-related code exists anywhere in this codebase (no ruby-text
 * generation, no output-format concept for it at all). Building real
 * furigana annotation would mean generating actual ruby-text markup for
 * every kanji in a lyric body — a genuinely new, large feature (a
 * kanji-to-reading mapping engine), not a bounded quality check like every
 * other item in this file. Left honestly undone (미구현) — a type stub
 * only, so a real implementation has a clear place to land, matching this
 * whole session's own "real type, not fake wiring" precedent (e.g.
 * 지시문 02 TASK E's bilingualPair display-only scoping).
 */
export type FuriganaOutputFormat = 'none' | 'inline-parentheses' | 'ruby-markup';

export interface FuriganaPolicy {
  format: FuriganaOutputFormat;
}

export const JP_KIDS_FURIGANA_POLICY: FuriganaPolicy = { format: 'none' };
