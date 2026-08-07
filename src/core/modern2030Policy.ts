import type { BilingualPair, WorkspaceId } from '../types';
import type { TextMotifFamily } from './textMotifQuota';

/**
 * codex 지시문 04 (§9) — shared kr-2030/jp-2030 policy shape. The spec's own
 * literal interface sketch names `modernSceneFamilies: MotifFamily[]` /
 * `staleClicheFamilies: MotifFamily[]` (data/motifFamilies.ts's own
 * frameId-based type, 지시문 02 TASK C) — investigation confirmed this
 * task's own named subject vocabulary (phone/rain/subway/cafe/rooftop/
 * social-media for kr-2030; convenience-store/train/rain/riverbank/
 * apartment/vending-machine for jp-2030) does NOT map onto any real
 * frameId in data/lyricThemes.ts's kr-2030/jp-2030 pools (confirmed by
 * direct search — these read as objects/settings mentioned INSIDE a
 * scene's prose, not the scene's own frameId). Deliberately deviates from
 * the spec's literal `MotifFamily[]` to `TextMotifFamily[]`
 * (core/textMotifQuota.ts, 지시문 04's own new text-scanning engine) —
 * building a fake frameId mapping for categories that don't structurally
 * fit would be worse than an honest, working substitute.
 *
 * "현재 유행어를 코드에 하드코딩하지 않는다" (don't hardcode current slang) —
 * this is why `staleClicheFamilies` targets STRUCTURAL repetition (a
 * specific fixed OPENING PHRASE, or a specific TITLE SUFFIX pattern,
 * repeated across a pack) rather than a list of "currently trendy words"
 * that would go stale on its own — see krClicheOpeningPatterns/
 * jaClicheTitlePatterns below, both real, bounded, structural checks, not
 * a slang dictionary.
 */

export interface TitleShapePolicy {
  /** No single title word-count shape (short/mid/long — core/titleHookRelationship.ts's own titleWordCountShape) may exceed this share of the pack. */
  maxDominantShapeShare: number;
}

export interface Modern2030Policy {
  language: 'korean' | 'japanese';
  bilingualPair: BilingualPair;
  modernSceneFamilies: TextMotifFamily[];
  staleClicheFamilies: TextMotifFamily[];
  titleShapePolicy: TitleShapePolicy;
  trendSensitivity: 'stable' | 'moderate';
}

const KR_2030_MODERN_SCENE_FAMILIES: TextMotifFamily[] = [
  { id: 'phone-message', labelKo: 'phone/message', patterns: [/휴대폰|핸드폰|메시지|문자/], maxPerPack: 2 },
  { id: 'rain-umbrella', labelKo: 'rain/umbrella', patterns: [/\b비\b|우산|장맛비/], maxPerPack: 2 },
  { id: 'subway-last-train', labelKo: 'subway/last-train', patterns: [/지하철|막차/], maxPerPack: 1 },
  { id: 'cafe-alone', labelKo: 'cafe-alone', patterns: [/혼자.{0,6}카페|카페.{0,6}혼자/], maxPerPack: 1 },
  { id: 'rooftop-city-light', labelKo: 'rooftop/city-light', patterns: [/옥상|야경/], maxPerPack: 1 },
  { id: 'social-media-memory', labelKo: 'social-media-memory', patterns: [/sns|소셜\s*미디어|피드/i], maxPerPack: 1 }
];

/** 오늘도/너 없는/이 밤 — this task's own explicit named opening-phrase overuse example, structural (position + phrase), never a slang list. */
const KR_2030_STALE_CLICHE_FAMILIES: TextMotifFamily[] = [
  { id: 'opening-oneuldo', labelKo: '"오늘도" 도입', patterns: [/^\s*오늘도/], maxPerPack: 2 },
  { id: 'opening-neo-eobsneun', labelKo: '"너 없는" 도입', patterns: [/^\s*너\s*없는/], maxPerPack: 2 },
  { id: 'opening-i-bam', labelKo: '"이 밤" 도입', patterns: [/^\s*이\s*밤/], maxPerPack: 2 }
];

const JP_2030_MODERN_SCENE_FAMILIES: TextMotifFamily[] = [
  { id: 'convenience-store', labelKo: 'convenience store', patterns: [/コンビニ/], maxPerPack: 2 },
  { id: 'train-commute', labelKo: 'train/home commute', patterns: [/電車|通勤|帰り道/], maxPerPack: 2 },
  { id: 'rain-umbrella', labelKo: 'rain/transparent umbrella', patterns: [/雨|傘/], maxPerPack: 2 },
  { id: 'riverbank', labelKo: 'riverbank', patterns: [/河原|川辺/], maxPerPack: 1 },
  { id: 'small-apartment', labelKo: 'small apartment', patterns: [/一人暮らし|アパート/], maxPerPack: 1 },
  { id: 'vending-machine', labelKo: 'late-night vending machine', patterns: [/自動販売機|自販機/], maxPerPack: 1 }
];

/** 〜の夜/〜の帰り道 — this task's own explicit named title-suffix overuse example. Applied to TITLES, not lyric body text (see jaTitleSuffixOveruse in core/jp2030Policy.ts's own consumer). */
const JP_2030_STALE_CLICHE_FAMILIES: TextMotifFamily[] = [
  { id: 'title-no-yoru', labelKo: '「〜の夜」제목', patterns: [/の夜$/], maxPerPack: 2 },
  { id: 'title-no-kaerimichi', labelKo: '「〜の帰り道」제목', patterns: [/の帰り道$/], maxPerPack: 2 }
];

export const MODERN_2030_POLICIES: Partial<Record<WorkspaceId, Modern2030Policy>> = {
  'kr-2030': {
    language: 'korean',
    bilingualPair: 'en-ko',
    modernSceneFamilies: KR_2030_MODERN_SCENE_FAMILIES,
    staleClicheFamilies: KR_2030_STALE_CLICHE_FAMILIES,
    titleShapePolicy: { maxDominantShapeShare: 0.5 },
    trendSensitivity: 'moderate'
  },
  'jp-2030': {
    language: 'japanese',
    bilingualPair: 'en-ja',
    modernSceneFamilies: JP_2030_MODERN_SCENE_FAMILIES,
    staleClicheFamilies: JP_2030_STALE_CLICHE_FAMILIES,
    titleShapePolicy: { maxDominantShapeShare: 0.5 },
    trendSensitivity: 'moderate'
  }
};

export function modern2030PolicyFor(workspaceId: WorkspaceId): Modern2030Policy | undefined {
  return MODERN_2030_POLICIES[workspaceId];
}
