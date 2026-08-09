/**
 * codex 지시문 02 (TASK J, second half) — per-workspace era stance. Real
 * gap: core/constraints.ts's extractEraConstraint is pure text detection
 * with zero workspace awareness — every workspace shares one "decade regex
 * fired or not" behavior, with no place to say "this workspace should never
 * be era-gated even if a stray word matches" (kids safety) or "this
 * workspace's own real behavior already IS the desired stance, nothing to
 * change" (2030/kpop — documented explicitly below, not silently assumed).
 *
 * Deliberately NOT extended into core/constraints.ts's applyEraQuota/
 * genreCandidates machinery beyond the one real, safe wiring below
 * (resolveConstraints's 'safety-over-era' override) — REAL_ERA_BUCKETS/
 * ERA_BUCKET_BY_GENRE_ID only have real genre data for 4 buckets
 * (1950s-60s/1970s/1980s/2000s; see data/eraExclusions.ts). Inventing a
 * '2010s'/'2020s'/'current' EraBucket with NO backing genre data would make
 * genreCandidates resolve to an empty array and would wrongly cap every
 * kr-2030/jp-2030/kr-idol genre (all 'generic'-bucketed, since none of them
 * have per-decade genre data) to applyEraQuota's 20% generic-share ceiling
 * the moment a concept said something as ordinary as "요즘 감성" or "2020년대"
 * — a real regression, not a feature, for workspaces whose entire genre
 * pool is intentionally era-unmapped. That gap is left explicitly
 * undone here (미구현) rather than fabricated with invented data, per this
 * file's own "don't force an era" / "없는 조건을 지어내지 마십시오" precedent
 * (core/constraints.ts's own extractEraConstraint doc comment,
 * data/eraExclusions.ts's own TASK B1 comment).
 */
import type { WorkspaceId } from '../types';

export type EraIntentMode = 'strict-decade' | 'current-implied' | 'only-when-referenced' | 'safety-over-era';

export interface WorkspaceEraIntent {
  mode: EraIntentMode;
  /** Why this mode, in this workspace's own terms — surfaced nowhere in UI today, kept for the next reader (mirrors WorkspaceDefinition.humanCreativeInterventionNote's own "place to record intent, not a feature" precedent). */
  noteKo: string;
  /**
   * 지시문 12 (TASK A-3) — era-neutral(era-buckets.ts) 장르 비중의 워크스페이스별
   * 상한. undefined = 상한 없음(이 워크스페이스는 시대가 판정 대상이 아님 —
   * kr-2030/jp-2030/kids/kr-idol이 여기 해당, mode가 이미 그 성격을 반영).
   * 정의된 값은 core/designGate.ts의 (구) era-unspecified-share 블로킹 관문을
   * 대체하는 era-neutral-share 관문이 사용한다 — era.unspecified=false로 시대가
   * 명시된 컨셉에서만 실제로 검사된다(strict-decade인 senior-oldpop이 사실상
   * 유일한 실사용처).
   *
   * senior-oldpop의 6/18 ≈ 0.33은 지시문 12 §A-3 원문의 예시값을 그대로 쓴
   * **추정치**다 — 청취로 검증된 값이 아니다. 실측 근거가 생기면 교체할 것.
   */
  eraNeutralMaxShare?: number;
}

export const WORKSPACE_ERA_INTENT: Record<WorkspaceId, WorkspaceEraIntent> = {
  // The one workspace extractEraConstraint's decade-quota machinery was
  // actually built for (1950s-60s/1970s/1980s + applyEraQuota) — real,
  // enforced narrowing when a concept explicitly names a decade.
  // eraNeutralMaxShare: 6/18 ≈ 0.33 — 지시문 12 §A-3 예시값, 추정치(청취 미검증).
  'senior-oldpop': { mode: 'strict-decade', noteKo: '60/70/80년대 등 명시된 시대를 실제 장르 쿼터로 강제 적용 — applyEraQuota의 원래 대상.', eraNeutralMaxShare: 6 / 18 },
  // Real, current behavior already matches this mode: no genre data ties
  // "2020s"/"current" to a bucket, so extractEraConstraint stays
  // unspecified:true for ordinary concept text and never over-narrows —
  // exactly what "current-implied, don't force a decade" should look like.
  // The one real addition (this task's own 2000s regex above) lets an
  // EXPLICIT "Y2K"/"2000년대"/"헤이세이" concept still narrow toward its own
  // real genre (kr2030-y2k-retro/jp2030-heisei-nostalgia).
  'kr-2030': { mode: 'current-implied', noteKo: '별도 시대 언급이 없으면 "지금" 감성으로 간주 — 억지로 연대를 강제하지 않음(기존 동작과 동일, Y2K류 명시 언급만 예외).' },
  'jp-2030': { mode: 'current-implied', noteKo: '별도 시대 언급이 없으면 "지금" 감성으로 간주 — 억지로 연대를 강제하지 않음(기존 동작과 동일, 헤이세이류 명시 언급만 예외).' },
  // Safety-relevant: era gating must never be the thing that decides a
  // kids-workspace generation's genre pool, even from an accidental word
  // match — resolveConstraints below forces unspecified:true here.
  'kr-kids': { mode: 'safety-over-era', noteKo: '시대 신호가 우연히 잡히더라도 안전/연령 정책이 항상 우선 — era gating을 아예 비활성화.' },
  'jp-kids': { mode: 'safety-over-era', noteKo: '시대 신호가 우연히 잡히더라도 안전/연령 정책이 항상 우선 — era gating을 아예 비활성화.' },
  // Real, current behavior already matches this mode: extractEraConstraint
  // only ever fires on an explicit decade/artist-era reference in the
  // concept text — there is no ambient/default decade assumption for
  // kr-idol today, so "only when referenced" is a description of existing
  // behavior, not a new restriction.
  'kr-idol-male': { mode: 'only-when-referenced', noteKo: '컨셉 텍스트가 실제로 특정 시대를 언급할 때만 반응 — 기본값으로 시대를 가정하지 않음(기존 동작과 동일).' },
  'kr-idol-female': { mode: 'only-when-referenced', noteKo: '컨셉 텍스트가 실제로 특정 시대를 언급할 때만 반응 — 기본값으로 시대를 가정하지 않음(기존 동작과 동일).' }
};

export function eraIntentForWorkspace(id: WorkspaceId): WorkspaceEraIntent {
  return WORKSPACE_ERA_INTENT[id] ?? { mode: 'only-when-referenced', noteKo: '레지스트리에 없는 워크스페이스 — 가장 보수적인 기본값(명시적 언급시에만 반응).' };
}
