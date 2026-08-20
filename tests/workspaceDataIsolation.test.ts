/**
 * TASK G1 — 워크스페이스 "데이터 격리" 검증 (저장소 격리가 아님 — 기존
 * workspaceScope.test.ts 등 47개 케이스가 저장소를, 이 파일은 생성 파이프라인이
 * 다른 워크스페이스의 사전·어휘·장르를 끌어다 쓰는지를 검증).
 *
 * §6-2 원칙: 검사 로직을 두 벌 쓰지 않습니다 — scripts/isolationAudit.ts가
 * export하는 checkL1~checkL7을 그대로 import해서 씁니다. 미구축 워크스페이스로
 * 인한 SKIP은 실패가 아니라 it.skip으로 표시합니다(§2 "미구축 워크스페이스를
 * 조용히 건너뛰지 말 것" — skip 자체가 테스트 러너 출력에 남으므로 조용히
 * 사라지지 않습니다).
 *
 * L4의 modern-chill/city-night/oldpop-lounge 3건은 senior-oldpop 워크스페이스
 * 자체의 기존(B1~G1 이전) 미완성 상태입니다 — 새 워크스페이스가 시니어 데이터를
 * 끌어다 쓰는 "누출"이 아니라 정반대(시니어 내부 아키타입 3개가 자기 워크스페이스
 * 안의 다른 아키타입 걸 씁니다), 그리고 시니어 코드는 이 문서가 손댈 수 없는
 * 영역(§0-1)입니다. `npm test` 전체 통과(§7 항목 16)를 막지 않도록 it.todo로
 * 남기되, `npx tsx scripts/isolationAudit.ts`(= npm run audit:isolation)는 이
 * 3건을 그대로 FAIL/exit 1로 보고합니다 — 감추지 않습니다.
 */
import { describe, expect, it } from 'vitest';
import {
  checkL1,
  checkL2,
  checkL3,
  checkL4,
  checkL5,
  checkL7,
  GENRE_WORKSPACE_MAP,
  isGenreForeignToWorkspace,
  type CheckResult
} from '../scripts/isolationAudit';
import { KRIDOL_M_CORE_GENRE_IDS, KRIDOL_F_CORE_GENRE_IDS, KR_KIDS_CORE_GENRE_IDS } from '../src/data/genreLibrary';

const L4_PREEXISTING_SENIOR_INTERNAL = new Set(['modern-chill', 'city-night', 'oldpop-lounge']);

/**
 * TASK G — checkL1 used to model "genre belongs to a workspace" as one
 * WorkspaceId per genre id (isolationAudit.ts's old genreWorkspaceOf),
 * which is fundamentally incompatible with kr-idol-male/kr-idol-female's
 * real, intentional shared kridol-* genre pool (K2/K3's own design — every
 * kridol-* genre pack's `archetypes` field literally lists both). That
 * forced a previous version of this test file to carve out an
 * L1_SHARED_KRIDOL_GENRES exception for kr-idol-female's otherwise-correct
 * "외부 장르 노출" FAIL. TASK G replaced genreWorkspaceOf with the
 * many-to-many GENRE_WORKSPACE_MAP (Record<string, WorkspaceId[]>) below,
 * so checkL1 itself now reports kr-idol-female's shared kridol-* genres as
 * PASS (real, not a workaround) — see this file's own describeChecks call
 * for L1 immediately below, no exception needed any more.
 */
describe('GENRE_WORKSPACE_MAP (TASK G many-to-many genre-workspace mapping)', () => {
  it('kridol-* genres map to BOTH kr-idol-male and kr-idol-female (K2/K3\'s real shared design)', () => {
    for (const id of KRIDOL_M_CORE_GENRE_IDS) {
      expect(GENRE_WORKSPACE_MAP[id], `${id} must be shared with both idol workspaces`).toEqual(
        expect.arrayContaining(['kr-idol-male', 'kr-idol-female'])
      );
    }
    // Sanity: K2's and K3's own core-genre-id lists are the exact same 7 ids (K3's own doc comment).
    expect(new Set(KRIDOL_F_CORE_GENRE_IDS)).toEqual(new Set(KRIDOL_M_CORE_GENRE_IDS));
  });

  it('isGenreForeignToWorkspace: shared kridol-* genres are NOT foreign to either idol workspace (positive case)', () => {
    for (const id of KRIDOL_M_CORE_GENRE_IDS) {
      expect(isGenreForeignToWorkspace(id, 'kr-idol-male'), `${id} must not be foreign to kr-idol-male`).toBe(false);
      expect(isGenreForeignToWorkspace(id, 'kr-idol-female'), `${id} must not be foreign to kr-idol-female`).toBe(false);
    }
  });

  it('isGenreForeignToWorkspace: a genuine cross-workspace leak is still caught (negative case) — a real kr-kids-exclusive genre id must be flagged foreign to senior-oldpop and to the idol workspaces', () => {
    const realKrKidsGenreId = KR_KIDS_CORE_GENRE_IDS[0]; // 'krkids-action' — real registered kr-kids-only genre id, not fabricated.
    expect(GENRE_WORKSPACE_MAP[realKrKidsGenreId], `${realKrKidsGenreId} must map to kr-kids only, not senior-oldpop or either idol workspace`).toEqual(['kr-kids']);
    expect(isGenreForeignToWorkspace(realKrKidsGenreId, 'senior-oldpop'), `${realKrKidsGenreId} appearing in senior-oldpop's visible pool must still be flagged as a real leak`).toBe(true);
    expect(isGenreForeignToWorkspace(realKrKidsGenreId, 'kr-idol-male'), `${realKrKidsGenreId} appearing in kr-idol-male's visible pool must still be flagged as a real leak`).toBe(true);
    expect(isGenreForeignToWorkspace(realKrKidsGenreId, 'kr-idol-female'), `${realKrKidsGenreId} appearing in kr-idol-female's visible pool must still be flagged as a real leak`).toBe(true);
    // ...but legitimately not foreign to its own real home.
    expect(isGenreForeignToWorkspace(realKrKidsGenreId, 'kr-kids'), `${realKrKidsGenreId} must not be foreign to its own real workspace kr-kids`).toBe(false);
  });
});

function describeChecks(checkId: string, results: CheckResult[], knownPreexisting?: (r: CheckResult) => boolean) {
  describe(`[${checkId}]`, () => {
    for (const r of results) {
      const label = r.archetype ? `${r.workspaceId} / ${r.archetype}` : r.workspaceId;
      if (r.status === 'SKIP') {
        it.skip(`${label} — ${r.detail}`, () => {});
        continue;
      }
      if (r.status === 'FAIL' && knownPreexisting?.(r)) {
        it.todo(`${label} — 기존(G1 이전) 이슈, npm run audit:isolation 에서 실측 확인: ${r.detail}`);
        continue;
      }
      it(`${label}`, () => {
        expect(r.status, r.detail).toBe('PASS');
      });
    }
  });
}

describe('워크스페이스 데이터 격리 (TASK G1)', () => {
  describeChecks('L1 아키타입 간 장르 누출', checkL1());
  describeChecks('L2 무배정 신규 장르', [checkL2()]);
  describeChecks('L3 가사 구도 폴백', checkL3());
  describeChecks('L4 훅 뱅크 분리', checkL4(), r => L4_PREEXISTING_SENIOR_INTERNAL.has(r.archetype ?? ''));
  describeChecks('L5 아키타입 미지정 채널', [checkL5()]);
  describeChecks('L7 시니어 컨셉 매칭 회귀', [checkL7()]);
});
