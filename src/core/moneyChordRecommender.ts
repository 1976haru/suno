import type { ChannelArchetype, MoneyChordSectionAssignment } from '../types';
import { moneyChordPresets, moneyChordRotationPool, signatureMoneyChordId, type MoneyChordPreset } from '../data/moneyChords';
import { moneyChordAffinityForGenre } from '../data/genreMoneyChordAffinity';
import { scaleQuotaToSongCount } from './quotaScaling';
import { buildMoneyChordSectionPlan } from './moneyChordSectionPlan';
import { mulberry32 } from '../utils/prng';

/**
 * 지시문 39 (TASK A) — Step2Concept.tsx의 머니코드 선택 UI가 쓰는 채널
 * 필터와 정확히 같은 함수. core/vocalRecommender.ts의
 * suitablePresetsForArchetype과 같은 역할 — 픽커와 추천기가 서로 다른
 * 필터를 들고 있다가 어긋나는 일이 없도록 단일 source of truth로 둔다.
 * moneyChordRotationPool은 지시문 27이 13개 아키타입 전부에 이미 채워
 * 뒀다(동요는 kidsSimple/kidsBright/kidsMarch/kidsRound 4종).
 */
export function suitableProgressionsForArchetype(channelArchetype: ChannelArchetype | undefined): MoneyChordPreset[] {
  const pool = moneyChordRotationPool(channelArchetype);
  return pool.map(id => moneyChordPresets[id]).filter((preset): preset is MoneyChordPreset => Boolean(preset));
}

/**
 * 지시문 39 (TASK C) — 지시문 27이 정한 18곡 기준 배분(시그니처 6 · 보조
 * 2종 각 4 · 색깔 2종 각 2, 합 18)을 정책 필드로 둔다. 지시문 38이 만든
 * scaleQuotaToSongCount(core/quotaScaling.ts)를 재사용해 임의 곡 수로
 * 환산한다 — 새 스케일러를 만들지 않는다. 선택된 5개 진행(시그니처 +
 * 장르 적합도 상위 4개)에 순위대로 배정한다.
 */
const PROGRESSION_QUOTA_BASE_SONG_COUNT = 18;
const PROGRESSION_QUOTA_BASE_SHAPE = [6, 4, 4, 2, 2] as const;

function quotaForSelectedProgressions(selected: readonly string[], songCount: number): Record<string, number> {
  const base: Record<string, number> = {};
  selected.forEach((id, index) => {
    base[id] = PROGRESSION_QUOTA_BASE_SHAPE[index] ?? 1;
  });
  return scaleQuotaToSongCount(base, PROGRESSION_QUOTA_BASE_SONG_COUNT, songCount);
}

export interface MoneyChordRecommendationRequest {
  channelArchetype: ChannelArchetype | undefined;
  songCount: number;
  /** 트랙별 장르 id — data/genreMoneyChordAffinity.ts(지시문 27 TASK B-3)를 쓴다. */
  genrePlan: readonly (string | undefined)[];
  /** 트랙별 보컬 프리셋 id — 지시문 38의 결과(core/vocalRecommender.ts). advisory. */
  vocalPlan?: readonly (string | undefined)[];
  /** 트랙별 체감 에너지(1~5) — 지시문 23. advisory. */
  energyPlan?: readonly (number | undefined)[];
  seed: number;
}

export interface MoneyChordRecommendation {
  trackNo: number;
  /** 곡 안에서 쓸 진행들 (1~3개, TASK B) — 항상 chordIds[0]가 주 진행(시그니처/선호 진행). */
  chordIds: string[];
  /** 어느 섹션에 어느 진행인지 — chordIds.length가 1이면 빈 배열(섹션 구분 자체가 없는 단일 진행 곡). */
  sectionMap: MoneyChordSectionAssignment[];
  reasonKo: string;
}

/** 같은 진행이 연속으로 나올 수 있는 최대 길이(무겁게 감점, 하드 배제는 아님) — 설계 관문의 "머니코드 최대 곡수"(8곡, designGate.ts)와는 별개로 더 타이트하게 잡는다(지시문 39 A-5 "같은 진행 연속 2곡 이하"). */
const MAX_CONSECUTIVE_SAME_PROGRESSION = 2;

const ENERGY_LOW_THRESHOLD = 2;
const ENERGY_HIGH_THRESHOLD = 4;
/** 지시문 39 (A-2 ⑥) — 보컬·에너지와의 정합(advisory). 후보 안에서 순서만 조정한다 — 후보를 늘리거나 줄이지 않는다. */
const LOW_ENERGY_PREFERRED = new Set(['winterBallad', 'emotional']);
const HIGH_ENERGY_PREFERRED = new Set(['default', 'canon', 'komuro']);
const DUET_PREFERRED = new Set(['doowop', 'canon']);
const DUET_VOCAL_PRESET_IDS = new Set(['male-female-duet', 'kid-duet', 'mixed-harmony-group', 'kid-choir', 'kid-choir-unison', 'kid-choir-round', 'kid-lead-with-choir', 'kid-chant-clap']);

function reasonFor(preset: MoneyChordPreset, priorUses: number, matchedGenre: boolean, energyNote: string | undefined): string {
  const parts = [preset.audibleEffect];
  if (matchedGenre) parts.push('이 곡의 장르에도 잘 맞는 진행이에요.');
  if (energyNote) parts.push(energyNote);
  if (priorUses > 0) parts.push('다양성을 위해 다시 추천했어요.');
  return parts.join(' ');
}

/**
 * 지시문 39 (TASK A) — LLM/API 호출 없이 기존 18개 moneyChordPresets +
 * compatibleWith/bestFor/audibleEffect 메타데이터만으로 곡별 코드 진행을
 * 추천한다. 채널 회전 풀(moneyChordRotationPool, 지시문 27)과 장르 적합도
 * (genreMoneyChordAffinity, 지시문 27 TASK B-3)를 그대로 재사용하고, 이
 * 위에 보컬/에너지 정합(advisory)과 다양성/연속 방지, 곡 안 다중 진행
 * (TASK B, core/moneyChordSectionPlan.ts)을 얹는다.
 *
 * history — vocalRecommender.ts와 같은 계약: 호출부가 이미 갖고 있는
 * 최근 사용 이력(예: core/ratingLedger.ts가 채널별로 기록해 둔
 * moneyChordId)을 그대로 받는다. 새 원장을 만들지 않는다 — soft
 * 감점으로만 쓴다(하드 배제 아님).
 */
export function recommendMoneyChordPlan(request: MoneyChordRecommendationRequest, history: string[] = []): MoneyChordRecommendation[] {
  const { channelArchetype, songCount, genrePlan, vocalPlan, energyPlan, seed } = request;
  if (songCount <= 0) return [];

  const pool = moneyChordRotationPool(channelArchetype);
  const signature = signatureMoneyChordId(channelArchetype);
  const rng = mulberry32(seed + 6101);

  // 채널이 회전할 게 없으면(풀 1종) 전곡 시그니처 — usesMoneyChordQuota와 같은 기준.
  if (pool.length < 2) {
    const preset = moneyChordPresets[signature];
    return Array.from({ length: songCount }, (_, i) => ({
      trackNo: i + 1,
      chordIds: [signature],
      sectionMap: [],
      reasonKo: preset ? preset.audibleEffect : '이 채널의 유일한 진행입니다.'
    }));
  }

  // 1. 이 팩의 장르 구성이 실제로 선호하는 진행에 가산점(1순위 2점·2순위 1점).
  const affinityScore = new Map<string, number>(pool.map(id => [id, 0]));
  for (const genreId of genrePlan) {
    const preferences = moneyChordAffinityForGenre(genreId).filter(id => pool.includes(id));
    preferences.forEach((id, rank) => affinityScore.set(id, (affinityScore.get(id) ?? 0) + (rank === 0 ? 2 : 1)));
  }
  // 시그니처는 항상 선택, 나머지는 점수 내림차순으로 최대 4종 더(총 5종 상한) — TASK C의 6·4·4·2·2 배분이 5개 자리를 전제한다.
  const rankedOthers = pool.filter(id => id !== signature).sort((a, b) => (affinityScore.get(b) ?? 0) - (affinityScore.get(a) ?? 0));
  const selected = [signature, ...rankedOthers.slice(0, 4)];
  const quota = quotaForSelectedProgressions(selected, songCount);

  const usageCount = new Map<string, number>();
  const results: MoneyChordRecommendation[] = [];
  let lastId: string | undefined;
  let lastRunLength = 0;

  // 지시문 39 (TASK A) — 트랙 1(cold-open)은 기존 파이프라인(core/moneyChordPlan.ts의
  // buildGenreAwareProgressionPlan/buildProgressionPlan/buildFamilyProgressionPlan
  // 전부 동일)과 같은 규약으로 채널의 시그니처 진행에 고정한다 — "채널의
  // 정체성은 가장 먼저 들리는 트랙에 있어야 한다"는 실제 청취 검증 원칙을
  // 이 추천기도 어기지 않는다. 장르 기반 배정은 트랙 2부터만 적용한다.
  {
    const signaturePreset = moneyChordPresets[signature];
    usageCount.set(signature, 1);
    lastId = signature;
    lastRunLength = 1;
    results.push({
      trackNo: 1,
      chordIds: [signature],
      sectionMap: [],
      reasonKo: signaturePreset ? `${signaturePreset.audibleEffect} 이 채널의 시그니처 진행이라 첫 곡에 배정했습니다.` : ''
    });
  }

  for (let index = 1; index < songCount; index += 1) {
    const genreId = genrePlan[index];
    const preferences = moneyChordAffinityForGenre(genreId).filter(id => selected.includes(id));
    const vocalPresetId = vocalPlan?.[index];
    const energy = energyPlan?.[index];
    const energyNote = energy !== undefined
      ? (energy <= ENERGY_LOW_THRESHOLD ? '차분한 곡 흐름에 맞춰 배치했습니다.' : energy >= ENERGY_HIGH_THRESHOLD ? '에너지 높은 구간에 맞춰 배치했습니다.' : undefined)
      : undefined;
    const isDuetSlot = vocalPresetId ? DUET_VOCAL_PRESET_IDS.has(vocalPresetId) : false;

    let bestScore = -Infinity;
    let bestId: string | undefined;
    for (const id of selected) {
      let score = rng();
      const uses = usageCount.get(id) ?? 0;
      score -= uses * 0.4;
      if (uses >= (quota[id] ?? 0)) score -= 1000;
      if (id === lastId && lastRunLength >= MAX_CONSECUTIVE_SAME_PROGRESSION) score -= 1000;
      if (preferences[0] === id) score += 1.2;
      else if (preferences.includes(id)) score += 0.6;
      if (energy !== undefined) {
        if (energy <= ENERGY_LOW_THRESHOLD && LOW_ENERGY_PREFERRED.has(id)) score += 0.5;
        if (energy >= ENERGY_HIGH_THRESHOLD && HIGH_ENERGY_PREFERRED.has(id)) score += 0.5;
      }
      if (isDuetSlot && DUET_PREFERRED.has(id)) score += 0.4;
      if (history.includes(id)) score -= 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    const chosenId = bestId ?? selected[0];
    const preset = moneyChordPresets[chosenId];
    const priorUses = usageCount.get(chosenId) ?? 0;
    usageCount.set(chosenId, priorUses + 1);
    lastRunLength = chosenId === lastId ? lastRunLength + 1 : 1;
    lastId = chosenId;

    results.push({
      trackNo: index + 1,
      chordIds: [chosenId],
      sectionMap: [],
      reasonKo: preset ? reasonFor(preset, priorUses, preferences[0] === chosenId, energyNote) : ''
    });
  }

  // 지시문 39 (TASK B) — 위에서 고른 "주 진행" 시퀀스는 절대 바꾸지 않고,
  // core/moneyChordSectionPlan.ts의 워크스페이스 정책(동요 1개 우세·시니어
  // 2개 우세·2030/아이돌 2~3개)에 따라 일부 트랙만 다중 진행으로 확장한다
  // — 실제 생성 파이프라인(batchPreallocation.ts)이 쓰는 것과 같은 함수라,
  // 이 미리보기가 실제 배정과 어긋나지 않는다.
  const primaryIds = results.map(r => r.chordIds[0]);
  const sectionPlan = buildMoneyChordSectionPlan(primaryIds, channelArchetype, songCount, seed);
  return results.map((rec, index) => {
    const expansion = sectionPlan[index];
    if (!expansion || expansion.chordIds.length <= 1) return rec;
    const extraLabels = expansion.chordIds.slice(1).map(id => moneyChordPresets[id]?.labelKo ?? id).join(', ');
    return {
      ...rec,
      chordIds: expansion.chordIds,
      sectionMap: expansion.sectionMap,
      reasonKo: `${rec.reasonKo} 절/후렴에서 ${extraLabels}(으)로 바뀌는 다중 진행이에요.`
    };
  });
}

/** kids/senior/modern(2030·아이돌) 3버킷 분류 — data/moneyChordSectionCountPolicy.ts에서 쓴다. */
