/**
 * 지시문 79 (TASK A-2) — "이 컨셉이 이 채널에서 표현될 수 있는가"의 단일
 * 판정 함수.
 *
 * 왜 필요한가(실측): `showa-seventies` 채널에 "60년대 올드팝" 컨셉을 넣으면
 * 그 채널의 코어 장르 4종 전부가 1970s 버킷이라 1950s-60s 후보가 0종이다.
 * 예전에는 그 사실이 어디에도 표시되지 않은 채 core/constraints.ts의
 * applyEraQuota가 인접 상한(25%)으로 12곡을 걷어내고 되돌릴 후보를 못 찾아
 * 살아남은 장르 1종에 15곡을 전부 몰았다(실측 15/15). TASK A-1이 그 붕괴
 * 자체는 막았지만, **컨셉과 채널이 안 맞는다는 사실 자체는 여전히 사용자에게
 * 알려야 한다** — 안 그러면 "60년대를 골랐는데 60년대가 하나도 없다"는
 * 결과만 남는다.
 *
 * 판정은 두 축이다. 두 축 모두 "컨셉이 무언가를 명시적으로 요구했는데 이
 * 채널의 후보 집합에 그것이 0종"일 때만 어긋남으로 본다 — 컨셉이 아무것도
 * 요구하지 않았으면(unspecified / 장르 키워드 없음) 어긋남이 아니다.
 *
 *   ① 시대 축   컨셉이 특정 연대를 명시했는데(extractEraConstraint) 그
 *               연대의 장르가 이 채널 후보에 0종. applyEraQuota가 실제로
 *               건너뛰는 조건과 **같은 기준**을 쓴다(그 함수의
 *               primaryCandidateCount와 같은 계산) — 두 곳이 다른 기준을
 *               쓰면 "경고는 나오는데 배분은 바뀐다"가 된다.
 *   ② 장르 축   컨셉 키워드가 장르를 지목했는데(genreWeights) 그중 이
 *               아키타입의 코어 티어에 있는 것이 0종. core/conceptAgent.ts의
 *               rankFromRules가 `if (!coreGenreIds.has(id)) continue`로
 *               버리는 것과 같은 판정이다.
 *
 * **감점하지 않는다** — 사용자 입력이 채널과 안 맞는 것이지 생성 결함이
 * 아니다(지시문 79 §8). core/quality.ts의 detectVocalGenreConflict 경고와
 * 같은 성격이며, 같은 이유로 경고만 남긴다.
 */
import { genreLibrary, getCoreGenreIdsForArchetype, getGenreById, isGenreEligibleForArchetype } from '../data/genreLibrary';
import { ERA_LABEL, eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { matchConceptRules } from '../data/conceptKeywords';
import { applyWorkspaceEraFloor, extractEraConstraint } from './constraints';
import type { ChannelArchetype } from '../types';

export interface ConceptChannelFit {
  /** 두 축 모두 어긋나지 않았는가. 컨셉이 비어 있으면 항상 true. */
  fits: boolean;
  /** 사용자에게 그대로 보여줄 한국어 문장. fits면 빈 배열. */
  reasonsKo: string[];
  /** ① 시대 축 — 컨셉이 명시한 주 시대(없으면 undefined). */
  eraPrimary?: EraBucket;
  /** ① 시대 축 — 그 시대의 장르가 이 채널 후보에 몇 종 있는가. */
  eraCandidateCount: number;
  /** ② 장르 축 — 컨셉 키워드가 지목한 장르 id 전체. */
  pointedGenreIds: string[];
  /** ② 장르 축 — 그중 이 아키타입 코어 티어에 있는 것. */
  coreIntersection: string[];
}

/**
 * `poolGenreIds`는 사용자가 실제로 고른 장르(opts.genreIds)다. 넘기면 그
 * 풀도 후보로 함께 센다 — applyEraQuota가 "기존 풀에 이미 있으면 새로 열
 * 필요가 없다"고 보는 것과 같다. 넘기지 않으면 아키타입 전체 후보로만
 * 판정한다(Step2에서 장르를 아직 안 고른 시점 등).
 */
export function evaluateConceptChannelFit(
  concept: string | undefined,
  archetype: ChannelArchetype | undefined,
  poolGenreIds: readonly string[] = []
): ConceptChannelFit {
  const text = concept?.trim() ?? '';
  const empty: ConceptChannelFit = { fits: true, reasonsKo: [], eraCandidateCount: 0, pointedGenreIds: [], coreIntersection: [] };
  if (!text || !archetype) return empty;

  const reasonsKo: string[] = [];

  // ① 시대 축
  const era = applyWorkspaceEraFloor(extractEraConstraint(text), archetype);
  let eraPrimary: EraBucket | undefined;
  let eraCandidateCount = 0;
  // era.floorApplied는 사용자가 쓴 게 아니라 채널 바닥이 넣은 것이므로
  // "사용자 컨셉이 채널과 안 맞는다"의 근거가 될 수 없다 — 제외한다.
  if (!era.unspecified && !era.floorApplied) {
    eraPrimary = era.primary;
    const inPool = poolGenreIds.filter(id => eraBucketForGenreId(id) === era.primary).length;
    eraCandidateCount = inPool > 0
      ? inPool
      : genreLibrary.filter(genre => isGenreEligibleForArchetype(genre, archetype) && eraBucketForGenreId(genre.id) === era.primary).length;
    if (eraCandidateCount === 0) {
      reasonsKo.push(`이 채널에는 ${ERA_LABEL[era.primary]} 장르가 하나도 없습니다 — 컨셉이 요청한 시대를 이 채널의 장르로는 표현할 수 없어, 시대 배분을 적용하지 않고 선택하신 장르 구성을 그대로 씁니다.`);
    }
  }

  // ② 장르 축
  const coreIds = getCoreGenreIdsForArchetype(archetype);
  const coreIdSet = new Set(coreIds);
  const pointed = new Set<string>();
  for (const rule of matchConceptRules(text, archetype)) {
    for (const id of Object.keys(rule.genreWeights ?? {})) pointed.add(id);
  }
  const pointedGenreIds = [...pointed];
  const coreIntersection = pointedGenreIds.filter(id => coreIdSet.has(id));
  if (pointedGenreIds.length > 0 && coreIntersection.length === 0) {
    const sample = pointedGenreIds
      .slice(0, 3)
      .map(id => getGenreById(id)?.label ?? id)
      .join(' · ');
    reasonsKo.push(`컨셉이 지목한 장르(${sample}${pointedGenreIds.length > 3 ? ` 외 ${pointedGenreIds.length - 3}종` : ''})가 이 채널의 장르 목록에 하나도 없습니다 — 채널이 원래 쓰는 장르로 대신 배분합니다.`);
  }

  return { fits: reasonsKo.length === 0, reasonsKo, eraPrimary, eraCandidateCount, pointedGenreIds, coreIntersection };
}

/** 여러 문장을 곡 warnings 한 줄로 합칠 때 쓰는 공통 포맷 — 호출부마다 다르게 잇지 않는다. */
export function conceptChannelFitWarningKo(fit: ConceptChannelFit): string | undefined {
  return fit.reasonsKo.length ? fit.reasonsKo.join(' ') : undefined;
}
