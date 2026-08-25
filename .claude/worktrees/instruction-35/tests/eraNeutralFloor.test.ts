import { describe, expect, it } from 'vitest';
import { applyEraQuota, ensureEraNeutralFloor, eraPrimaryShareOf, eraSharesOf, type EraConstraint } from '../src/core/constraints';
import { eraIntentForWorkspace } from '../src/data/workspaceEraIntent';
import { ERA_POLICY } from '../src/data/eraPolicy';

/**
 * 지시문 33 (§1) — "발라드가 60~70년대스러움과 시니어 채널 톤을 잇는다"는
 * 하루의 청취 관찰에 근거한 era-neutral 하한(minTracks) 실제 배정 검증.
 * eraNeutralPolicy.verified는 false다 — 이 테스트는 "정책이 적용된다"만
 * 확인하지, "3곡이 최선의 값"이라고 주장하지 않는다(§ "하지 말 것").
 *
 * era-neutral 판정은 bucketKeyOf(거친 5버킷, 'generic')를 쓴다 —
 * eraSharesOf/eraNeutralShareOf(기존 상한 검사가 이미 쓰는 것)와 반드시
 * 같은 기준이어야 한다(구현 자신의 doc comment 참고: 세밀 분류를 썼다가
 * v379EraParsing.test.ts를 실측으로 깨뜨린 적이 있다). 이 테스트도 같은
 * eraSharesOf로 검증한다 — 구현과 다른 잣대로 재지 않는다.
 */
const SENIOR_POLICY = eraIntentForWorkspace('senior-oldpop').eraNeutralPolicy!;

function genericCount(counts: Record<string, number>): number {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return Math.round((eraSharesOf(counts).generic ?? 0) * total);
}

describe('[지시문 33 §1] ensureEraNeutralFloor', () => {
  it('정책이 없으면(undefined) 아무것도 바꾸지 않는다', () => {
    const counts = { 'oldpop-warm-morning-glow': 18 };
    const { counts: result, warnings } = ensureEraNeutralFloor(counts, 18, undefined, () => true);
    expect(result).toEqual(counts);
    expect(warnings).toEqual([]);
  });

  it('이미 하한(3곡)을 충족하면 아무것도 바꾸지 않는다', () => {
    const counts = { 'oldpop-soft-rock-am': 15, 'healing-ballad': 3 };
    expect(genericCount(counts), '이 fixture 자체가 generic 3곡을 이미 갖고 있는지 먼저 확인').toBeGreaterThanOrEqual(3);
    const { counts: result, warnings } = ensureEraNeutralFloor(counts, 18, SENIOR_POLICY, () => true);
    expect(result).toEqual(counts);
    expect(warnings).toEqual([]);
  });

  it('era-neutral이 0곡이면 큰 장르들에서 라운드로빈으로 회수해 하한(3곡)을 채운다', () => {
    const counts = { 'oldpop-soft-rock-am': 10, 'oldpop-motown-pop-soul': 8 };
    const { counts: result, warnings } = ensureEraNeutralFloor(counts, 18, SENIOR_POLICY, () => true);
    const total = Object.values(result).reduce((sum, n) => sum + n, 0);
    expect(total, '전체 곡 수는 변하지 않는다').toBe(18);
    expect(genericCount(result), '하한 3곡 이상 확보').toBeGreaterThanOrEqual(3);
    expect(warnings).toEqual([]);
  });

  it('회수 대상 비-era-neutral 장르가 하나도 없으면(전부 era-neutral) 그대로 두고 경고 없이 반환한다', () => {
    const counts = { 'healing-ballad': 18 };
    const { counts: result, warnings } = ensureEraNeutralFloor(counts, 18, SENIOR_POLICY, () => true);
    expect(result).toEqual(counts);
    expect(warnings).toEqual([]);
  });

  it('songCount이 18이 아니면 minTracks를 비례 스케일한다 (9곡 세트 → 최소 1~2곡)', () => {
    const counts = { 'oldpop-soft-rock-am': 9 };
    const { counts: result } = ensureEraNeutralFloor(counts, 9, SENIOR_POLICY, () => true);
    const expectedFloor = Math.round((SENIOR_POLICY.minTracks / 18) * 9);
    expect(genericCount(result)).toBeGreaterThanOrEqual(expectedFloor);
  });

  it('새로 싱글톤(count===1)을 만들지 않는다 — genreSingletonRootCause.test.ts와 같은 불변식', () => {
    const counts = { 'oldpop-soft-rock-am': 5, 'oldpop-motown-pop-soul': 15 };
    const { counts: result } = ensureEraNeutralFloor(counts, 18, SENIOR_POLICY, () => true);
    for (const [id, count] of Object.entries(result)) {
      if (id === 'oldpop-soft-rock-am' || id === 'oldpop-motown-pop-soul') {
        expect(count, `${id}=${count} — 회수 후에도 1곡짜리를 만들면 안 된다`).not.toBe(1);
      }
    }
  });

  it('2곡 이하인 장르는 절대 건드리지 않는다', () => {
    const counts = { 'oldpop-soft-rock-am': 2, 'oldpop-motown-pop-soul': 2, 'oldpop-doowop-harmony': 14 };
    const { counts: result } = ensureEraNeutralFloor(counts, 18, SENIOR_POLICY, () => true);
    expect(result['oldpop-soft-rock-am']).toBe(2);
    expect(result['oldpop-motown-pop-soul']).toBe(2);
  });
});

describe('[지시문 33 §1] applyEraQuota → ensureEraNeutralFloor 통합 — primary 비중이 유지되는가', () => {
  it('era-neutral 하한을 확보해도 eraPrimaryShareOf(분모에서 era-neutral 제외)로 잰 primary 비중은 ERA_POLICY.singlePrimaryMin 이상을 유지한다', () => {
    const era: EraConstraint = { primary: '1970s', adjacent: [{ era: '1950s-60s', maxShare: 0.25 }], forbidden: [], unspecified: false };
    const songCount = 18;
    const { counts: quotaCounts } = applyEraQuota({ 'oldpop-adult-contemporary-80s': songCount }, songCount, era, () => true);
    const { counts: floored, warnings } = ensureEraNeutralFloor(quotaCounts, songCount, SENIOR_POLICY, () => true);

    const total = Object.values(floored).reduce((sum, n) => sum + n, 0);
    const primaryShare = eraPrimaryShareOf(floored, '1970s');

    expect(total, '전체 곡 수는 18로 유지된다').toBe(songCount);
    expect(genericCount(floored), 'era-neutral 하한(3곡) 확보').toBeGreaterThanOrEqual(SENIOR_POLICY.minTracks);
    expect(primaryShare, `실측 ${Math.round(primaryShare * 100)}% — ${warnings.join(' / ')}`).toBeGreaterThanOrEqual(ERA_POLICY.singlePrimaryMin);
  });
});
