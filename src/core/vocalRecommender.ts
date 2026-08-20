import type { ChannelArchetype } from '../types';
import { vocalPresets, type VocalPreset } from '../data/vocalPresets';
import { isKidsArchetype } from '../utils/channelArchetype';
import { buildVocalPlan, vocalTypeMatchesPresetGender, type VocalQuota, type VocalType } from './vocalPlan';
import { MALE_VOCAL_TRAIT_AXES, FEMALE_VOCAL_TRAIT_AXES } from '../data/vocalTraits';
import { vocalAffinityForGenre, vocalAvoidForGenre } from '../data/genreVocalAffinity';
import { mulberry32 } from '../utils/prng';

/**
 * 지시문 38 (TASK D2) — Step2Concept.tsx의 보컬 프리셋 그리드가 쓰는
 * 필터와 정확히 같은 함수. 두 곳이 서로 다른 필터 로직을 각자 들고
 * 있으면 "픽커 카드에는 보이는데 추천은 안 나온다"류의 불일치가 생기기
 * 쉬우므로 단일 source of truth로 공유한다. forKids 프리셋은 forKids만으로
 * 이미 배타적으로 걸러지므로(suitedArchetypes를 쓰지 않는다) 그대로
 * 통과시키고, 나머지(성인) 프리셋은 이 채널이 suitedArchetypes에 없으면
 * 제외한다 — data/vocalPresets.ts의 13-아키타입 적합성 매트릭스 주석 참고.
 */
export function suitablePresetsForArchetype(channelArchetype: ChannelArchetype | undefined): VocalPreset[] {
  const archetype = channelArchetype ?? 'senior-morning';
  const kids = isKidsArchetype(archetype);
  return vocalPresets.filter(preset =>
    Boolean(preset.forKids) === kids && (preset.forKids || Boolean(preset.suitedArchetypes?.includes(archetype)))
  );
}

export interface VocalRecommendationRequest {
  channelArchetype: ChannelArchetype | undefined;
  songCount: number;
  /**
   * 이미 해석된 쿼터 — TASK C의 직접 비율 입력(opts.vocalQuota), 채널의
   * 고정 vocalQuotaOverride, 또는 균등배정 기본값(DEFAULT_ADULT_VOCAL_QUOTA/
   * DEFAULT_KIDS_VOCAL_QUOTA) 중 호출부가 이미 고른 것 — 이 함수는 어느 쪽이
   * 왔는지 모른다. core/vocalPlan.ts의 buildVocalPlan/scaleVocalQuota가
   * 이미 songCount 비례 환산을 하므로 여기서 다시 하지 않는다.
   */
  vocalQuota: VocalQuota;
  seed: number;
  /**
   * 지시문 38 (TASK D2-6, 선택) — 트랙별 실제 장르 id(songCount와 같은
   * 길이, 곡 순서와 대응). 있으면 data/genreVocalAffinity.ts를 advisory로
   * 참고해 그 트랙의 장르에 어울리는 프리셋을 가산점으로 우대한다 —
   * 채널 필터(suitablePresetsForArchetype)를 통과한 후보 안에서 순서만
   * 조정할 뿐, 후보 자체를 늘리거나 줄이지 않는다. 생략하면(기존 호출부)
   * 이 가산점이 전혀 없는 지금까지의 동작 그대로다.
   */
  genrePlan?: readonly (string | undefined)[];
}

export interface VocalRecommendation {
  trackNo: number;
  vocalType: VocalType;
  /** 이 채널에 맞는 후보가 하나도 없을 때만 ''(방어적 폴백 — 현재 매트릭스로는
   * kids를 제외한 13개 아키타입 전부에서 발생하지 않는다, scripts/checkVocalRecommenderCoverage
   * 류의 실측으로 확인). */
  presetId: string;
  presetLabel: string;
  reasonKo: string;
}

/** 같은 프리셋이 연속으로 나올 수 있는 최대 길이 — 이걸 넘기면 무겁게 감점한다(하드 배제는 아니다, 후보가 하나뿐인 극단적 경우까지 죽이지 않기 위해). */
const MAX_CONSECUTIVE_SAME_PRESET = 2;
/**
 * 지시문 38 (TASK D-4 ③) — "같은 프리셋을 세트 내에서 최대 N곡까지 —
 * 15곡 기준 한 프리셋 최대 4곡 (추정치)"를 정책 필드로 둔다. 4/15는
 * 지시문 본문이 준 추정치이고, 다른 곡 수에서는 이 비율 그대로 스케일된다
 * (songCount * MAX_PRESET_SHARE, 최소 1). 청취 검증값이 아니라 추정치이므로
 * 실측 후 조정될 수 있다.
 */
const MAX_PRESET_SHARE = 4 / 15;
/**
 * 지시문 46 (TASK C-3) — genreVocalAffinity의 avoid 필터가 채널 후보 풀을
 * 이 아래로 줄이지 않게 하는 정책 하한. 지시문 38의 "13개 아키타입 전부
 * 최소 4개 이상(대부분 5개 이상) 확보" 관측에 맞춘 추정치 — verified: false.
 */
const MIN_VOCAL_CANDIDATE_POOL = 5;

const VOCAL_TYPES: VocalType[] = ['male', 'female', 'mixed'];

function extractRegisterTag(preset: VocalPreset): string | undefined {
  const axes = preset.gender === 'female' ? FEMALE_VOCAL_TRAIT_AXES : MALE_VOCAL_TRAIT_AXES;
  return axes.register.find(term => preset.prompt.includes(term));
}

/** 지시문 38 (TASK D2-6) — genreVocalAffinity 목록에서 preset.id의 순위(0=1순위)를 찾는다. 없으면 undefined. */
function genreAffinityRank(presetId: string, genreId: string | undefined): number | undefined {
  const preferences = vocalAffinityForGenre(genreId);
  const rank = preferences.indexOf(presetId);
  return rank === -1 ? undefined : rank;
}

function reasonFor(preset: VocalPreset, channelArchetype: ChannelArchetype | undefined, priorUses: number, genreId: string | undefined): string {
  const suited = channelArchetype ? preset.suitedArchetypes?.includes(channelArchetype) : false;
  const base = suited ? `이 채널에 어울리는 음색이에요 — ${preset.description}` : preset.description;
  const affinityRank = genreAffinityRank(preset.id, genreId);
  const withGenre = affinityRank !== undefined ? `${base} 이 곡의 장르와도 잘 맞아요.` : base;
  return priorUses > 0 ? `${withGenre} (다양성을 위해 톤을 바꿔가며 다시 추천했어요)` : withGenre;
}

/**
 * 지시문 38 (TASK D) — LLM/API 호출 없이 기존 26개 vocalPresets +
 * suitedArchetypes/forKids 메타데이터만으로 곡별 보컬 프리셋을 추천한다.
 * per-song 보컬 "성별/듀엣" 시퀀스 자체는 새로 만들지 않고 core/vocalPlan.ts의
 * buildVocalPlan(이미 largest-remainder 배분 + 연속 실행 보정을 하는 검증된
 * 함수)을 그대로 재사용하고, 이 함수는 그 위에 "어떤 구체적 프리셋을 쓸지"만
 * 얹는다.
 *
 * history — core/vocalComboLedger.ts의 getRecentVocalCombos가 이미
 * 돌려주는 "M:<register>|F:<register>" 시그니처 배열(newest first)을
 * 그대로 받는다. 새 히스토리 저장소를 만들지 않고(§하지 말 것) 있는 걸
 * 재사용한다 — 프리셋 자체가 아니라 "최근에 많이 쓴 음역대"를 아는
 * 유일한 기존 신호라, 여기서는 하드 배제가 아니라 약한(soft) 감점으로만
 * 쓴다(register 문구가 프리셋 prompt 문자열에 그대로 들어있을 때만
 * 매칭되므로 항상 걸리는 건 아니다 — best-effort 신호).
 */
export function recommendVocalPlan(request: VocalRecommendationRequest, history: string[] = []): VocalRecommendation[] {
  const { channelArchetype, songCount, vocalQuota, seed, genrePlan } = request;
  if (songCount <= 0) return [];

  const pool = suitablePresetsForArchetype(channelArchetype);
  const typePlan = buildVocalPlan(vocalQuota, songCount, seed);
  const rng = mulberry32(seed + 5501);

  const candidatesByType = new Map<VocalType, VocalPreset[]>();
  for (const type of VOCAL_TYPES) {
    candidatesByType.set(type, pool.filter(preset => vocalTypeMatchesPresetGender(type, preset.gender)));
  }

  const usageCount = new Map<string, number>();
  const maxAllowedPerPreset = Math.max(1, Math.ceil(songCount * MAX_PRESET_SHARE));
  const recommendations: VocalRecommendation[] = [];
  let lastPresetId: string | undefined;
  let lastRunLength = 0;

  typePlan.forEach((vocalType, index) => {
    const candidates = candidatesByType.get(vocalType) ?? [];
    if (!candidates.length) {
      recommendations.push({
        trackNo: index + 1,
        vocalType,
        presetId: '',
        presetLabel: '',
        reasonKo: '이 채널에 맞는 프리셋 후보가 없습니다 — 직접 골라주세요.'
      });
      lastPresetId = undefined;
      lastRunLength = 0;
      return;
    }

    const trackGenreId = genrePlan?.[index];
    // 지시문 46 (TASK C-3) — genreVocalAffinity의 avoid 목록을 실제 필터로
    // 쓴다(기존엔 advisory 가산점만 있었다). §하지 말 것 "후보가 5종
    // 미만이 되지 않게 한다" — 채널 전체 풀(이 vocalType만이 아니라
    // suitablePresetsForArchetype 전체)이 필터 후에도 5종 이상 남을 때만
    // 적용하고, 그렇지 않으면(작은 채널 풀) 조용히 건너뛴다. 이 vocalType의
    // 후보가 전부 회피 대상이 되는 극단적 경우도 같은 이유로 건너뛴다 —
    // 하드 배제가 추천 자체를 막아서는 안 된다.
    const avoidIds = new Set(vocalAvoidForGenre(trackGenreId));
    const filteredByAvoid = avoidIds.size ? candidates.filter(preset => !avoidIds.has(preset.id)) : candidates;
    const poolAfterAvoid = avoidIds.size ? pool.filter(preset => !avoidIds.has(preset.id)) : pool;
    const effectiveCandidates = avoidIds.size && filteredByAvoid.length && poolAfterAvoid.length >= MIN_VOCAL_CANDIDATE_POOL
      ? filteredByAvoid
      : candidates;
    const scored = effectiveCandidates.map(preset => {
      let score = rng();
      const uses = usageCount.get(preset.id) ?? 0;
      score -= uses * 0.5;
      if (uses >= maxAllowedPerPreset) score -= 1000;
      if (preset.id === lastPresetId && lastRunLength >= MAX_CONSECUTIVE_SAME_PRESET) score -= 1000;
      const registerTag = extractRegisterTag(preset);
      if (registerTag && history.some(signature => signature.includes(registerTag))) score -= 0.3;
      // 지시문 38 (TASK D2-6) — 장르 적합도는 advisory 가산점일 뿐, 다양성
      // 상한/연속 방지의 -1000 하드 페널티를 절대 못 이긴다 — 순서만 조정한다.
      const affinityRank = genreAffinityRank(preset.id, trackGenreId);
      if (affinityRank === 0) score += 1.2;
      else if (affinityRank !== undefined) score += 0.6;
      return { preset, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].preset;
    const priorUses = usageCount.get(chosen.id) ?? 0;

    usageCount.set(chosen.id, priorUses + 1);
    lastRunLength = chosen.id === lastPresetId ? lastRunLength + 1 : 1;
    lastPresetId = chosen.id;

    recommendations.push({
      trackNo: index + 1,
      vocalType,
      presetId: chosen.id,
      presetLabel: chosen.label,
      reasonKo: reasonFor(chosen, channelArchetype, priorUses, trackGenreId)
    });
  });

  return recommendations;
}
