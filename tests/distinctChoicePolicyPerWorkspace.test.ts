import { describe, expect, it } from 'vitest';
import { distinctChoicePolicyForWorkspace, safetyForbiddenRuleIdsForWorkspace } from '../src/data/distinctChoicePolicy';
import { ALL_WORKSPACE_IDS } from './distinctChoiceWorkspaceFixtures';

/**
 * 지시문 15 (TASK C, 필수 테스트 파일) — "워크스페이스마다 값이 다르게
 * 정해졌는가"를 직접 실증한다. §B-2의 핵심 원칙("구조는 7개 워크스페이스
 * 공통, 차단 권한은 실측된 곳에만 준다")이 실제 정책 데이터에 반영됐는지,
 * "모든 워크스페이스에 동일한 정책 값을 복사"하지 않았는지를 확인한다.
 */

describe('[지시문 15 TASK C] distinctChoice 정책 — 7개 워크스페이스 전부 등록됨', () => {
  it('7개 워크스페이스 전부 정책을 가진다', () => {
    for (const workspaceId of ALL_WORKSPACE_IDS) {
      expect(() => distinctChoicePolicyForWorkspace(workspaceId)).not.toThrow();
      const policy = distinctChoicePolicyForWorkspace(workspaceId);
      expect(policy.allowedRuleIds.length).toBeGreaterThan(0);
    }
  });
});

describe('[지시문 15 TASK C] verified — 실측된 senior-oldpop 딱 하나만 true', () => {
  it('senior-oldpop만 verified:true, 나머지 6개는 전부 false', () => {
    const verifiedWorkspaces = ALL_WORKSPACE_IDS.filter(id => distinctChoicePolicyForWorkspace(id).verified);
    expect(verifiedWorkspaces).toEqual(['senior-oldpop']);
  });

  it('senior-oldpop은 promoteAfterMeasuredSongs가 0(이미 verified) — 나머지 6개는 전부 양수(승격에 실측 필요)', () => {
    expect(distinctChoicePolicyForWorkspace('senior-oldpop').promoteAfterMeasuredSongs).toBe(0);
    for (const workspaceId of ALL_WORKSPACE_IDS.filter(id => id !== 'senior-oldpop')) {
      expect(distinctChoicePolicyForWorkspace(workspaceId).promoteAfterMeasuredSongs).toBeGreaterThan(0);
    }
  });
});

describe('[지시문 15 TASK C] 정책 값이 워크스페이스마다 실제로 다르다 — 복사-붙여넣기 아님', () => {
  it('7개 워크스페이스가 하나의 정책 값으로 뭉개지지 않는다(언어쌍끼리는 같을 수 있어도 전체가 동일하진 않다)', () => {
    // kr-2030/jp-2030, kr-idol-male/female, kr-kids/jp-kids처럼 언어만 다른
    // 쌍은 오늘 시점 실제로 같은 값을 쓴다(둘 다 미검증·추정치라 진짜 값이
    // 같다) — "복사-붙여넣기 금지"가 뜻하는 건 7개 전부가 서로소여야 한다는
    // 게 아니라, 최소 3개 이상의 서로 다른 정책 "모양"이 실제로 존재해야
    // 한다는 것이다(시니어/2030군 vs 아이돌군 vs 키즈군).
    const serialized = ALL_WORKSPACE_IDS.map(id => JSON.stringify(distinctChoicePolicyForWorkspace(id)));
    expect(new Set(serialized).size).toBeGreaterThanOrEqual(4);
  });

  it('allowedRuleIds가 그룹마다 실제로 다른 규칙 집합이다(시니어/2030 vs 아이돌 vs 키즈)', () => {
    const senior = new Set(distinctChoicePolicyForWorkspace('senior-oldpop').allowedRuleIds);
    const idolMale = new Set(distinctChoicePolicyForWorkspace('kr-idol-male').allowedRuleIds);
    const krKids = new Set(distinctChoicePolicyForWorkspace('kr-kids').allowedRuleIds);
    // idol 목록은 VOCAL_TOGETHER를 포함하고 시니어/키즈에는 아예 없다 — 진짜 다른 축.
    expect(idolMale.has('VOCAL_TOGETHER')).toBe(true);
    expect(senior.has('VOCAL_TOGETHER')).toBe(false);
    expect(krKids.has('VOCAL_TOGETHER')).toBe(false);
    // 세 그룹이 완전히 동일한 집합이 아니다.
    expect([...senior].sort()).not.toEqual([...idolMale].sort());
    expect([...senior].sort()).not.toEqual([...krKids].sort());
    expect([...idolMale].sort()).not.toEqual([...krKids].sort());
  });

  it('minComplianceRate가 그룹마다 다르다(키즈가 가장 엄격, 시니어/2030이 가장 느슨)', () => {
    const senior = distinctChoicePolicyForWorkspace('senior-oldpop').minComplianceRate;
    const kr2030 = distinctChoicePolicyForWorkspace('kr-2030').minComplianceRate;
    const idolFemale = distinctChoicePolicyForWorkspace('kr-idol-female').minComplianceRate;
    const jpKids = distinctChoicePolicyForWorkspace('jp-kids').minComplianceRate;
    expect(senior).toBe(kr2030);
    expect(jpKids).toBeGreaterThan(idolFemale);
    expect(idolFemale).toBeGreaterThan(senior);
  });

  it('sameGenderVocalOnly는 idol 워크스페이스에서만 true, 나머지 5개는 전부 false', () => {
    const trueWorkspaces = ALL_WORKSPACE_IDS.filter(id => distinctChoicePolicyForWorkspace(id).sameGenderVocalOnly);
    expect(trueWorkspaces.sort()).toEqual(['kr-idol-female', 'kr-idol-male']);
  });
});

describe('[지시문 15 TASK C] 안전 제약(safetyForbiddenRuleIds) — verified와 무관하게 그룹마다 실제로 다르다', () => {
  it('kids 2곳은 NO_CHORUS·FINAL_QUESTION 둘 다 금지', () => {
    expect(safetyForbiddenRuleIdsForWorkspace('kr-kids').sort()).toEqual(['FINAL_QUESTION', 'NO_CHORUS']);
    expect(safetyForbiddenRuleIdsForWorkspace('jp-kids').sort()).toEqual(['FINAL_QUESTION', 'NO_CHORUS']);
  });

  it('idol 2곳은 NO_CHORUS만 금지(FINAL_QUESTION은 금지 아님 — kids와 다른 축)', () => {
    expect(safetyForbiddenRuleIdsForWorkspace('kr-idol-male')).toEqual(['NO_CHORUS']);
    expect(safetyForbiddenRuleIdsForWorkspace('kr-idol-female')).toEqual(['NO_CHORUS']);
  });

  it('senior-oldpop·kr-2030·jp-2030은 ruleId 단위 안전 금지가 없다(빈 배열)', () => {
    expect(safetyForbiddenRuleIdsForWorkspace('senior-oldpop')).toEqual([]);
    expect(safetyForbiddenRuleIdsForWorkspace('kr-2030')).toEqual([]);
    expect(safetyForbiddenRuleIdsForWorkspace('jp-2030')).toEqual([]);
  });
});
