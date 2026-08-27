/**
 * 지시문 77 — 컨셉 → 발성(음 시작 방식) 축.
 *
 * 배경(§1 실측): 컨셉 자유 텍스트로 장르·계절·무드는 지목할 수 있는데
 * **보컬 음색만 지목할 방법이 없었다.** CONCEPT_KEYWORD_RULES 231개 규칙의
 * 키는 id/patterns/seasonWeights/genreWeights/moodWeights/axis/archetypeScope
 * 뿐이고 보컬 관련 규칙 수가 0개였다 — "숨소리 섞인 목소리로 부르는 칠
 * 딥하우스"에서 장르(en-chillhop 딥하우스 2종)는 잡히는데 "숨소리 섞인
 * 목소리로"는 어디에도 반영되지 않았다. 프리셋(airy-whisper-female /
 * whisper-male / soft-female / airy-falsetto-male)은 이미 en-chillhop에
 * 등록돼 있었는데 **도달 경로가 없었다**(이 저장소에서 반복된 유형 —
 * 지시문 68·72).
 *
 * 이 모듈이 그 경로 전부다. 설계 제약 세 가지를 구조로 지킨다.
 *
 *  ① suitablePresetsForArchetype 하드 필터를 우회하지 않는다(§2.2).
 *     지시문 38 TASK D2가 이 필터를 승격시킨 근거는 실제 청취 피드백
 *     ("시니어 채널인데 로리 계열 목소리도 나온다")이다. 컨셉이 지목한
 *     프리셋이 그 아키타입에 등록돼 있지 않으면 **무시하고 경고**한다 —
 *     resolveConceptVocalIntent의 unavailablePresetIds가 그 경고다.
 *  ② 성별 쿼터를 깨뜨리지 않는다(§2.2). buildConceptVocalPresetPlan은
 *     이미 확정된 vocalPlan(트랙별 vocalType)을 **입력으로만** 받고 절대
 *     바꾸지 않는다 — 여성 슬롯이 6개면 그 6개 "안에서" 어떤 프리셋을
 *     고를지에만 개입한다. 지시문 63의 장르→쿼터 역산은 그대로다.
 *  ③ 장르와 충돌하면 장르가 이긴다(§5.2). 발성은 장르 안의 변주이지
 *     장르의 상위가 아니다 — 발성 때문에 장르가 바뀌면 세트의 대역 구성과
 *     BPM 고정(지시문 76 TASK A)이 흔들린다. 충돌 판정은 장르 id 하드코딩
 *     목록이 아니라 **장르의 `vocal`/`styleCore` 문구**로 한다(지시문 72·73에서
 *     반복된 "장르가 추가될 때마다 누락" 패턴을 피한다).
 */
import type { ChannelArchetype, GenrePack } from '../types';
import { vocalPresets, type VocalPreset } from '../data/vocalPresets';
import { CONCEPT_KEYWORD_RULES, matchConceptRules } from '../data/conceptKeywords';
import { getGenreById } from '../data/genreLibrary';
import { suitablePresetsForArchetype } from './vocalRecommender';
import { vocalTypeMatchesPresetGender, type VocalType } from './vocalPlan';

/**
 * 발성 계열 id. 이름은 "무엇처럼 들리는가"가 아니라 **성대가 어떻게
 * 움직이는가**(onset)를 기준으로 한다 — §4.1의 지적("공기 반 소리 반"의
 * 기술적 실체는 성대 폐쇄가 불완전한 것, 즉 soft glottal onset이고, 그게
 * 없으면 Suno가 단순히 볼륨이 작은 목소리로 해석한다)에 대응한다.
 */
export type VocalFamilyId = 'breathy' | 'belted' | 'clean' | 'husky' | 'dark';

export interface VocalFamily {
  id: VocalFamilyId;
  labelKo: string;
  /**
   * §4.2 — stylePrompt에 들어갈 발성 표현. **절 개수를 늘리지 않는다**:
   * applyVocalOnsetPhrasing이 아래 redundantClausePattern에 걸리는 기존
   * 절을 먼저 빼고 그 자리에 넣는다(지시문 74 TASK C의 60단어 압축을
   * 되돌리지 않기 위해).
   */
  onsetClauses: string[];
  /**
   * 이 계열의 onset 절과 의미가 겹쳐 함께 들어가면 중복이 되는 기존 보컬
   * 절(§4.2의 "whisper-soft delivery + soft glottal onset은 중복" 예시).
   */
  redundantClausePattern: RegExp;
  /**
   * §4.3 — Suno의 기본값은 성대를 닫는 현대 팝 발성이라 긍정 지시만으로는
   * 약하다. excludePrompt로 반대편을 눌러 준다. 총량은 늘리지 않는다 —
   * promptComposer.ts의 buildExcludePrompt가 이 항목들을 trimmable
   * arrangement 티어 **맨 앞**에 넣어, 같은 티어의 덜 중요한 기존 항목이
   * 기존 fitWithinBudget 예산에서 자동으로 밀려나게 한다.
   */
  excludeTerms: string[];
  /**
   * §5.1/5.2 — 장르의 `vocal`/`styleCore` 문구가 이 패턴에 걸리면 그 장르는
   * 정의 자체가 이 발성과 반대다(예: en-deep-house-soulful의 "powerful
   * soulful vocal hook riding the groove"). 장르 id 목록이 아니라 문구다.
   */
  conflictingGenreWording: RegExp;
}

export const VOCAL_FAMILIES: Record<VocalFamilyId, VocalFamily> = {
  breathy: {
    id: 'breathy',
    labelKo: '숨소리 섞인 발성',
    onsetClauses: ['soft glottal onset', 'audible breath between phrases, never pushed'],
    redundantClausePattern: /^(?:.*\b(?:whisper-soft|breathy|airy breath|just above a whisper|half-whispered|breath-forward)\b.*)$/i,
    excludeTerms: ['belted chorus', 'chest-heavy projection', 'hard glottal attack'],
    conflictingGenreWording: /\b(?:powerful|belted|big[- ]voiced|full[- ]throated|gospel-style|anthemic|soaring|full sung chorus|diva)\b/i
  },
  belted: {
    id: 'belted',
    labelKo: '힘 있게 뻗는 발성',
    onsetClauses: ['firm glottal closure', 'sustained chest projection through the hook'],
    redundantClausePattern: /^(?:.*\b(?:powerful|projected|full-voiced|belted|expressive but controlled runs)\b.*)$/i,
    excludeTerms: ['breathy half-voice', 'whispered delivery', 'airy unsupported tone'],
    conflictingGenreWording: /\b(?:whisper|breathy|hushed|half-whispered|murmured|spoken-word|barely above a whisper)\b/i
  },
  // 지시문 78 — 신설 2계열. §0의 청취 피드백이 든 세 단어 중 "공기 반 소리
  // 반"만 지시문 77이 지목할 수 있었고 "허스키"·"동굴 소리"는 이 축에 계열
  // 자체가 없어 여전히 지목 불가였다. 78이 그 목소리를 만들었으니 라우팅도
  // 함께 연다 — 프리셋만 늘리고 도달 경로를 안 만들면 이 저장소가 반복해 온
  // "재료는 있는데 경로가 없다"(지시문 68·72·77 §1.4)가 그대로 재현된다.
  husky: {
    id: 'husky',
    labelKo: '허스키한 발성',
    onsetClauses: ['audible fold rasp', 'dry grain left in the tone'],
    redundantClausePattern: /^(?:.*(?:husky|smoky|slight rasp|grainy).*)$/i,
    excludeTerms: ['glassy clean tone', 'polished studio smoothness', 'pitch-perfect sheen'],
    conflictingGenreWording: /(?:bell-like|pristine|crystalline|pure clean tone|choirboy)/i
  },
  dark: {
    id: 'dark',
    labelKo: '어두운 공명 발성',
    onsetClauses: ['lowered larynx', 'deep pharyngeal resonance'],
    redundantClausePattern: /^(?:.*(?:dark cavernous|dark velvet|late-night tone).*)$/i,
    excludeTerms: ['bright forward placement', 'thin nasal tone', 'high lifted larynx'],
    conflictingGenreWording: /(?:bright airy vocal|sunlit|sparkling top|high bright lead)/i
  },
  clean: {
    id: 'clean',
    labelKo: '담백한 발성',
    onsetClauses: ['even unforced onset', 'straight tone, minimal ornament'],
    redundantClausePattern: /^(?:.*\b(?:clean simple delivery|restrained|understated|plain delivery)\b.*)$/i,
    excludeTerms: ['heavy melisma runs', 'theatrical vibrato', 'over-ornamented phrasing'],
    conflictingGenreWording: /\b(?:runs and riffs|melismatic|gospel-style|ad-lib runs|heavily ornamented)\b/i
  }
};

/**
 * 프리셋 → 발성 계열 매핑. **vocalPresets.ts의 `prompt` 문구를 근거로만**
 * 배정했다(§3.2 "기존 프리셋의 prompt 필드를 전부 읽고 어느 프리셋이 어느
 * 계열인지 매핑할 것"). 근거가 애매한 프리셋은 **어느 계열에도 넣지
 * 않는다** — 여기 없는 것이 정상이며, 미매핑 사유는 지시문 77 보고서와
 * scripts/checkConceptVocalAxis.ts의 출력에 남는다.
 *
 * 미매핑(의도적):
 *  - soulful-female — 지시문 78 §3.2: 'controlled runs, flexible chest-to-head
 *    mix'는 레지스터 전환 축이라 belted(흉성 투사)도 clean도 아니다.
 *  - warm-mature-male — "mature soulful male tenor"(흉성 계열)와 "soft
 *    slightly husky close-mic delivery, gentle"(비투사 계열)이 한 프리셋
 *    안에서 서로 반대 방향을 가리킨다.
 *  - male-female-duet / mixed-harmony-group — 앙상블 프리셋이라 단일
 *    onset 정체성이 없다(구성원 각각의 발성은 이 축이 다루지 않는다).
 */
export const VOCAL_FAMILY_BY_PRESET_ID: Record<string, VocalFamilyId> = {
  // breathy — prompt에 breath/whisper/airy가 명시된 4종.
  'airy-whisper-female': 'breathy',   // "soft female voice just above a whisper, airy breath tone, slow intimate delivery"
  'whisper-male': 'breathy',          // "soft male voice just above a whisper, intimate close-mic breath, very gentle and slow"
  'soft-female': 'breathy',           // "soft warm female alto, gentle breathy delivery, intimate and calm"
  'airy-falsetto-male': 'breathy',    // "soft male falsetto, airy head voice, smooth city-pop phrasing, light and floating"
  // belted — 지시문 78 TASK B의 신설 2종. 지시문 77은 soulful-female을 이
  // 계열로 뒀지만, 78 §3.2가 그 프리셋의 'controlled runs, flexible
  // chest-to-head mix'는 절제·레지스터 축이지 흉성 투사가 아니라고 확정해
  // 여기서 뺐다 — soulful-female은 이제 의도적 미매핑이다.
  'belted-male': 'belted',            // "full-voiced male tenor, firm glottal closure, sustained chest projection into the chorus"
  'belted-female': 'belted',          // "full-voiced female alto, firm glottal closure, chest-driven projection lifting the chorus"
  // dark — 지시문 78 TASK B 신설.
  'dark-resonant-male': 'dark',       // "male baritone with lowered larynx, deep pharyngeal resonance, dark cavernous tone"
  'dark-resonant-female': 'dark',     // "female alto with lowered larynx, deep pharyngeal resonance, dark velvet tone"
  // husky — 장르 중립 2종(지시문 78 신설) + 재즈 문맥 2종(기존).
  'husky-grain-male': 'husky',        // "male voice with audible fold rasp, dry grainy texture, plainspoken and direct"
  'husky-grain-female': 'husky',      // "female voice with audible fold rasp, worn grainy edge, direct and unpolished"
  'husky-jazz-female': 'husky',       // "husky female alto, audible fold rasp, smoky jazz phrasing, laid-back swing feel"
  'smoky-jazz-male': 'husky',         // "smoky male baritone, ... lounge microphone warmth, audible fold rasp"
  // clean — "clean/clear/restrained/fresh and open"이 명시된 계열.
  'clear-light-male': 'clean',        // "clear light male tenor, clean simple delivery, youthful and sincere"
  'bright-young-male': 'clean',       // "bright young male voice, clean modern pop delivery, fresh and open tone"
  'bright-young-female': 'clean',     // "bright young female voice, clean modern pop delivery, fresh and open tone"
  'bright-clear-female': 'clean',     // "bright clear female soprano, bell-like clarity, light and uplifting delivery"
  'low-calm-male': 'clean',           // "low calm male baritone, restrained emotional delivery, warm late-night tone"
  'mature-female': 'clean'            // "mature elegant female mezzo-soprano, warm restrained delivery, sophisticated tone"
};

export interface ConceptVocalIntent {
  familyId: VocalFamilyId;
  family: VocalFamily;
  /** 이 의도를 만든 규칙 id들 — 실측/디버깅용(어느 규칙이 걸렸는지 보고서에 그대로 적는다). */
  ruleIds: string[];
  /** 규칙들이 지목한 프리셋 id → 누적 가중치(아키타입 필터 이전의 원본). */
  weights: Record<string, number>;
  /** 지목됐지만 이 아키타입의 suitablePresetsForArchetype에 없어 무시된 프리셋 id(§2.2 "무시하고 경고"). */
  unavailablePresetIds: string[];
  /** 실제로 쓸 수 있는 프리셋(하드 필터 통과분). 비어 있으면 이 컨셉의 발성 지목은 이 채널에서 아무 것도 못 한다. */
  availablePresets: VocalPreset[];
}

function familyOf(presetId: string): VocalFamilyId | undefined {
  return VOCAL_FAMILY_BY_PRESET_ID[presetId];
}

/**
 * 컨셉 자유 텍스트 → 발성 의도. 매칭이 없으면 undefined(기존 동작과 완전히
 * 동일 — 이 축은 전부 additive다).
 *
 * 두 계열이 동시에 걸리면(예: "숨소리 나는데 힘 있게") 가중치 합이 큰 쪽을
 * 택하고, 그래도 동점이면 undefined를 돌려준다 — 사용자 입력 자체가 서로
 * 반대라 어느 쪽으로 밀어도 근거가 없다(추측으로 고르지 않는다).
 */
export function resolveConceptVocalIntent(
  freeText: string | undefined,
  archetype: ChannelArchetype | undefined
): ConceptVocalIntent | undefined {
  const text = (freeText ?? '').trim();
  if (!text) return undefined;
  const matched = matchConceptRules(text, archetype).filter(rule => rule.vocalPresetWeights);
  if (!matched.length) return undefined;

  const weights: Record<string, number> = {};
  const ruleIdsByFamily = new Map<VocalFamilyId, string[]>();
  const familyScore = new Map<VocalFamilyId, number>();
  for (const rule of matched) {
    for (const [presetId, weight] of Object.entries(rule.vocalPresetWeights!)) {
      weights[presetId] = (weights[presetId] ?? 0) + weight;
      const family = familyOf(presetId);
      if (!family) continue;
      familyScore.set(family, (familyScore.get(family) ?? 0) + weight);
      const ids = ruleIdsByFamily.get(family) ?? [];
      if (!ids.includes(rule.id)) ids.push(rule.id);
      ruleIdsByFamily.set(family, ids);
    }
  }
  if (!familyScore.size) return undefined;
  const ranked = [...familyScore.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return undefined;
  const familyId = ranked[0][0];

  const pool = suitablePresetsForArchetype(archetype);
  const poolIds = new Set(pool.map(preset => preset.id));
  const wantedIds = Object.keys(weights).filter(id => familyOf(id) === familyId);
  const availablePresets = pool
    .filter(preset => wantedIds.includes(preset.id))
    .sort((a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0));
  const unavailablePresetIds = wantedIds.filter(id => !poolIds.has(id));

  return {
    familyId,
    family: VOCAL_FAMILIES[familyId],
    ruleIds: ruleIdsByFamily.get(familyId) ?? [],
    weights,
    unavailablePresetIds,
    availablePresets
  };
}

/**
 * §2.2 핵심 — 이미 확정된 vocalPlan(트랙별 성별/듀엣)을 **그대로 두고**,
 * 각 트랙에 그 성별로 부를 수 있는 발성 프리셋을 배정한다. 배정할 수 없는
 * 트랙(그 성별의 후보가 이 계열에 없다 — 예: breathy 계열에 듀엣 프리셋이
 * 없다)은 undefined로 남겨 기존 폴백 경로를 그대로 탄다.
 *
 * 같은 프리셋이 세트를 독차지하지 않도록 후보가 2종 이상이면 가중치 순으로
 * 회전 배정한다 — vocalRecommender.ts의 MAX_PRESET_SHARE와 같은 취지지만,
 * 여기서는 "이 계열로 몰아준다"가 목적이므로 계열 밖으로 나가지는 않는다.
 */
export function buildConceptVocalPresetPlan(
  intent: ConceptVocalIntent | undefined,
  vocalPlan: readonly (VocalType | undefined)[] | null | undefined,
  /**
   * 지시문 77 (TASK D) — 트랙별 lead 장르 id. 그 장르의 정의 자체가 이
   * 발성과 반대인 트랙은 **배정하지 않는다**(§5.2 "장르를 우선하고 발성
   * 지목은 무시한다"). 경고는 core/quality.ts가 따로 낸다 — 여기서는
   * 조용히 건너뛰고, SongIdea.conceptVocalFamilyId는 그대로 실려 그
   * 경고의 근거가 된다. 생략하면 충돌 검사 없이 전부 배정한다(기존 동작).
   */
  genrePlan?: readonly (string | undefined)[]
): (VocalPreset | undefined)[] | null {
  if (!intent || !intent.availablePresets.length || !vocalPlan?.length) return null;
  const byType = new Map<VocalType, VocalPreset[]>();
  for (const type of ['male', 'female', 'mixed'] as VocalType[]) {
    byType.set(type, intent.availablePresets.filter(preset => vocalTypeMatchesPresetGender(type, preset.gender)));
  }
  const cursor = new Map<VocalType, number>();
  let assigned = 0;
  const plan = vocalPlan.map((type, idx) => {
    if (!type) return undefined;
    if (genrePlan && detectVocalGenreConflict(getGenreById(genrePlan[idx] ?? ''), intent.familyId)) return undefined;
    const candidates = byType.get(type) ?? [];
    if (!candidates.length) return undefined;
    const at = cursor.get(type) ?? 0;
    cursor.set(type, at + 1);
    assigned += 1;
    return candidates[at % candidates.length];
  });
  return assigned ? plan : null;
}

/**
 * §4.2 — 발성 표현을 vocalText에 넣되 **절 개수를 늘리지 않는다.**
 * 이 계열의 onset 절과 의미가 겹치는 기존 절을 먼저 빼고, 그 자리에 넣는다.
 * 뺄 절이 없으면 원문 절 수를 유지하기 위해 맨 뒤 절 하나를 밀어낸다 —
 * 지시문 74 TASK C가 압축한 stylePrompt 길이를 이 축이 되돌리지 않게 하는
 * 유일한 안전장치라, 어떤 경로로도 결과 절 수가 입력보다 많아지지 않는다.
 */
export function applyVocalOnsetPhrasing(vocalText: string, family: VocalFamily): string {
  const parts = vocalText.split(',').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return family.onsetClauses[0];
  const budget = parts.length;
  const alreadyHasOnset = parts.some(part => family.onsetClauses.some(clause => part.toLowerCase() === clause.toLowerCase()));
  if (alreadyHasOnset) return parts.join(', ');
  // 정체성 절(첫 절 — 성별/음역대)은 어떤 경우에도 유지한다. 이걸 빼면
  // 프리셋을 쓴 의미 자체가 사라진다(batchPreallocation.ts의
  // presetVariantVocalText가 anchor를 고정하는 것과 같은 이유).
  const anchor = parts[0];
  const rest = parts.slice(1).filter(part => !family.redundantClausePattern.test(part));
  const droppedFromRest = parts.length - 1 - rest.length;
  const anchorIsRedundant = family.redundantClausePattern.test(anchor);
  const additions = family.onsetClauses.slice(0, Math.max(1, droppedFromRest));
  // onset 절은 anchor 바로 뒤에 둔다 — 맨 뒤에 붙이면 아래 budget 컷에서
  // 그대로 잘려 "프리셋만 바뀌고 문구는 그대로"인 §4.1 상태로 되돌아간다
  // (실측: 첫 구현이 정확히 이 이유로 stylePrompt에 한 번도 도달하지 않았다).
  // anchor 자신이 이미 whisper/breathy를 말하고 있어도(anchorIsRedundant)
  // onset은 별개의 정보다 — '속삭인다'는 음량이고 onset은 성대 폐쇄다.
  void anchorIsRedundant;
  const merged = [anchor, ...additions, ...rest];
  return merged.slice(0, Math.max(budget, 1)).join(', ');
}

/** §4.3 — 이 계열이 지목됐을 때 excludePrompt 앞쪽에 얹을 항목. */
export function conceptVocalExclusionTerms(intent: ConceptVocalIntent | undefined): string[] {
  return intent ? [...intent.family.excludeTerms] : [];
}

/**
 * §5.1/5.2 — 이 장르의 정의 자체가 이 발성과 반대인가. **장르 id 목록이
 * 아니라 장르 자신의 `vocal`/`styleCore` 문구**로 판정한다 — 장르가
 * 추가돼도 누락되지 않는다(지시문 72·73에서 반복된 패턴의 회피).
 *
 * 판정만 하고 아무것도 바꾸지 않는다: 장르도 그대로, 발성도 강행하지 않고,
 * 경고만 남긴다(core/quality.ts). 감점도 하지 않는다 — 사용자 입력이 서로
 * 안 맞는 것이지 생성 결함이 아니다.
 */
export function detectVocalGenreConflict(
  genre: Pick<GenrePack, 'id' | 'label' | 'vocal' | 'styleCore'> | undefined,
  familyId: VocalFamilyId | undefined
): { genreId: string; genreLabel: string; evidence: string } | undefined {
  if (!genre || !familyId) return undefined;
  const family = VOCAL_FAMILIES[familyId];
  if (!family) return undefined;
  const haystack = [...(genre.vocal ?? []), genre.styleCore ?? ''].filter(Boolean);
  for (const line of haystack) {
    if (family.conflictingGenreWording.test(line)) {
      return { genreId: genre.id, genreLabel: genre.label, evidence: line };
    }
  }
  return undefined;
}

/**
 * 검사 스크립트(scripts/checkConceptVocalAxis.ts)가 쓰는 헬퍼 — 규칙이
 * 실존하지 않는 프리셋 id를 지목하고 있는지. 지시문 72에서 확인된
 * "존재하지 않는 id는 필터에서 조용히 버려진다" 패턴을 실측으로 막는다.
 */
export function unknownVocalPresetIdsInRules(): Array<{ ruleId: string; presetId: string }> {
  const known = new Set(vocalPresets.map(preset => preset.id));
  const problems: Array<{ ruleId: string; presetId: string }> = [];
  for (const rule of CONCEPT_KEYWORD_RULES) {
    for (const presetId of Object.keys(rule.vocalPresetWeights ?? {})) {
      if (!known.has(presetId)) problems.push({ ruleId: rule.id, presetId });
    }
  }
  return problems;
}

/** 검사/보고용 — vocalPresetWeights를 가진 규칙 전체. */
export function conceptVocalRules() {
  return CONCEPT_KEYWORD_RULES.filter(rule => rule.vocalPresetWeights);
}
