/**
 * TASK G1 — 워크스페이스 데이터 격리 검증. §0-2 "고치는 문서가 아닙니다": 이 스크립트는
 * 누출을 찾아 보고만 합니다 — 발견된 문제를 이 파일이 직접 고치지 않습니다.
 *
 * 기존 47개 워크스페이스 테스트(workspaceScope.test.ts 등)는 "저장소 격리"
 * (저장된 레코드가 워크스페이스별로 분리되는가)를 검증합니다. 이 스크립트는
 * "데이터 격리"(생성 파이프라인이 다른 워크스페이스의 사전·어휘·장르를 끌어다
 * 쓰지 않는가)를 검증합니다 — 기존 47개 케이스 중 어느 것도 이걸 잡지 못합니다.
 *
 * §6-2 원칙: 이 파일의 각 checkL* 함수를 tests/workspaceDataIsolation.test.ts가
 * 그대로 import해서 재사용합니다 — 검사 로직을 두 벌 쓰지 않습니다.
 *
 * Usage: npx tsx scripts/isolationAudit.ts  (또는 npm run audit:isolation)
 */
import { workspaceDefinitions, type WorkspaceDefinition } from '../src/data/workspaces';
import { genrePacks as resolvedGenrePacks, channelPresets } from '../src/data/presets';
import { lyricThemesForArchetype, adultLyricThemes } from '../src/data/lyricThemes';
import { overrideForArchetype } from '../src/data/hookBanks';
import { defaultHookParts, type HookVocabularyOverride, type HookPartBank } from '../src/data/hookParts';
import { thumbnailArchetypesForArchetype, thumbnailArchetypes } from '../src/data/thumbnailArchetypes';
import { matchConceptRules } from '../src/data/conceptKeywords';
import type { ChannelArchetype, WorkspaceId } from '../src/types';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Shared result shape
// ---------------------------------------------------------------------------
export type CheckStatus = 'PASS' | 'FAIL' | 'SKIP';

export interface CheckResult {
  checkId: string;
  workspaceId: WorkspaceId;
  archetype?: ChannelArchetype;
  status: CheckStatus;
  detail: string;
}

/**
 * "이 워크스페이스가 구축됐는가"의 기준은 §2의 예시 표(§2-2)가 워크스페이스
 * 단위로 잡고 있는 그대로 따릅니다 — WorkspaceDefinition.ready. C1이 이미
 * jp-2030의 장르 레이어(archetypeIds/genrePacks)를 채워 넣었더라도, C2(가사
 * 세계/훅뱅크/썸네일)가 아직이면 이 워크스페이스는 "미구축"입니다. archetypeIds
 * 자체가 비어 있는 워크스페이스(kr-kids/jp-kids)는 순회할 아키타입이 없으므로
 * 자연히 결과가 없습니다 — 별도 처리가 필요 없습니다.
 */
function isBuilt(ws: WorkspaceDefinition): boolean {
  return ws.ready;
}

/**
 * TASK G — many-to-many replacement for the old single-workspace
 * genreWorkspaceOf(). Real-source-verified (data/genreLibrary/index.ts,
 * data/workspaces/index.ts): every kridol-* genre pack's own `archetypes`
 * field literally lists BOTH `['kr-idol-male', 'kr-idol-female']` (K2's own
 * design, K3 deliberately reused it per §3-1 "신규 장르는 만들지 않는 것이
 * 기본") — kr-idol-male and kr-idol-female are two DIFFERENT WorkspaceIds
 * that legitimately share one genre pool. The old function forced a single
 * WorkspaceId per genre id, so kr-idol-female's real, intended access to
 * K2's own genres was indistinguishable from an actual leak — see
 * tests/workspaceDataIsolation.test.ts's now-removed L1_SHARED_KRIDOL_GENRES
 * workaround for the false-positive this produced.
 *
 * Deliberately still keyed off the genre id's own naming PREFIX (not
 * re-derived from genrePack.archetypes) — checkL1 below compares "what the
 * id's own naming convention says this genre's legitimate home(s) are"
 * against "what workspace(s) genrePack.archetypes currently grants it to".
 * Building this map FROM genrePack.archetypes instead would make that
 * comparison vacuously true (the field would be checked against itself) and
 * blind L1 to the exact class of bug it exists to catch — e.g. a future
 * genrePack.archetypes edit accidentally adding a kr-kids-song archetype to
 * a kr2030-* genre would then just silently "match" its own map entry.
 */
function genreWorkspacesOf(genreId: string): WorkspaceId[] {
  if (genreId.startsWith('kr2030-')) return ['kr-2030'];
  if (genreId.startsWith('jp2030-')) return ['jp-2030'];
  if (genreId.startsWith('krkids-')) return ['kr-kids'];
  if (genreId.startsWith('jpkids-')) return ['jp-kids'];
  // TASK K2/K3 — kridol-* is the one genuinely shared genre pool in the
  // codebase today (verified: every kridolMaleGenrePacks entry in
  // data/genreLibrary/index.ts sets `archetypes: ['kr-idol-male', 'kr-idol-female']`).
  if (genreId.startsWith('kridol-')) return ['kr-idol-male', 'kr-idol-female'];
  return ['senior-oldpop'];
}

/**
 * TASK G — real Record<string, WorkspaceId[]> built from every genre id
 * actually registered in resolvedGenrePacks (data/presets.ts's genrePacks),
 * via genreWorkspacesOf's id-prefix rule above. Exported per this task's own
 * required shape.
 */
export const GENRE_WORKSPACE_MAP: Record<string, WorkspaceId[]> = Object.fromEntries(
  resolvedGenrePacks.map(g => [g.id, genreWorkspacesOf(g.id)])
);

function themeWorkspaceOf(theme: { id: string }): WorkspaceId {
  if (theme.id.startsWith('kr2030-')) return 'kr-2030';
  if (theme.id.startsWith('jp2030-')) return 'jp-2030';
  if (theme.id.startsWith('krkids-')) return 'kr-kids';
  if (theme.id.startsWith('jpkids-')) return 'jp-kids';
  // TASK K2 — kr-idol-male's own theme prefix, same reasoning as
  // genreWorkspaceOf above.
  if (theme.id.startsWith('kridol-')) return 'kr-idol-male';
  // TASK K3 — kr-idol-female's own theme prefix (krkidolf-, distinct from
  // K2's kridol- since K3's lyric themes ARE its own, unlike genres above).
  if (theme.id.startsWith('krkidolf-')) return 'kr-idol-female';
  return 'senior-oldpop';
}

// ---------------------------------------------------------------------------
// L1 — 아키타입 간 장르 누출
// ---------------------------------------------------------------------------
/**
 * TASK G — the one real predicate checkL1 uses to decide "foreign", pulled
 * out so tests/workspaceDataIsolation.test.ts (or any other test) can prove
 * it still catches a genuine leak without duplicating the logic (§6-2) and
 * without needing to mutate real production data to fabricate one — a genre
 * id's own GENRE_WORKSPACE_MAP entry is real, checkable data on its own.
 */
export function isGenreForeignToWorkspace(genreId: string, workspaceId: WorkspaceId): boolean {
  return !(GENRE_WORKSPACE_MAP[genreId] ?? ['senior-oldpop']).includes(workspaceId);
}

export function checkL1(): CheckResult[] {
  const results: CheckResult[] = [];
  for (const ws of workspaceDefinitions) {
    for (const archetype of ws.archetypeIds) {
      // v4.14+ 코드베이스 실측: genrePacks(archetype).length === 0 은 "이
      // 아키타입에 배정된 장르가 아직 하나도 없다"는 뜻 — 장르 레이어 자체가
      // 미구축이므로 SKIP. 0보다 크면 실제로 검사합니다(워크스페이스
      // .ready 여부와 무관 — C1이 증명했듯 장르 레이어는 .ready 이전에도
      // 채워질 수 있고, 그 상태에서도 격리는 실측 가능/필요합니다).
      const visible = resolvedGenrePacks.filter(g => g.archetypes?.includes(archetype));
      if (!visible.length) {
        results.push({ checkId: 'L1', workspaceId: ws.id, archetype, status: 'SKIP', detail: '이 아키타입에 배정된 장르 0개 — 장르 레이어 미구축' });
        continue;
      }
      const foreign = visible.filter(g => isGenreForeignToWorkspace(g.id, ws.id));
      results.push({
        checkId: 'L1',
        workspaceId: ws.id,
        archetype,
        status: foreign.length ? 'FAIL' : 'PASS',
        detail: foreign.length
          ? `외부 장르 ${foreign.length}건 노출: ${foreign.map(g => `${g.id}(${(GENRE_WORKSPACE_MAP[g.id] ?? ['senior-oldpop']).join('/')})`).join(', ')}`
          : `대상 ${visible.length}개 장르, 외부 노출 0건`
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// L2 — 무배정 신규 장르 (기존 320종은 inferArchetypes() 대상이라 제외)
// ---------------------------------------------------------------------------
function isNewGenreId(id: string): boolean {
  return /^(kr2030-|jp2030-|krkids-|jpkids-)/.test(id);
}

export function checkL2(): CheckResult {
  const orphans = resolvedGenrePacks.filter(g => isNewGenreId(g.id) && (!g.archetypes || g.archetypes.length === 0));
  return {
    checkId: 'L2',
    workspaceId: 'senior-oldpop', // 전체 라이브러리 대상 — 특정 워크스페이스에 속하지 않는 검사
    status: orphans.length ? 'FAIL' : 'PASS',
    detail: orphans.length ? `무배정 신규 장르 ${orphans.length}건: ${orphans.map(g => g.id).join(', ')}` : `신규 장르 전수(${resolvedGenrePacks.filter(g => isNewGenreId(g.id)).length}개) 아키타입 배정 확인`
  };
}

// ---------------------------------------------------------------------------
// L3 — 가사 구도 폴백 (12개 임계값)
// ---------------------------------------------------------------------------
export function checkL3(): CheckResult[] {
  const results: CheckResult[] = [];
  for (const ws of workspaceDefinitions) {
    for (const archetype of ws.archetypeIds) {
      const suitedCount = adultLyricThemes.filter(t => t.suitedArchetypes?.includes(archetype)).length;
      if (suitedCount === 0) {
        results.push({ checkId: 'L3', workspaceId: ws.id, archetype, status: 'SKIP', detail: '이 아키타입 전용 가사 구도 0개 — 가사 세계 미구축' });
        continue;
      }
      // 언어 인자를 일부러 생략합니다: senior-oldpop은 아키타입별로 언어가
      // 갈리는 다중언어 워크스페이스(showa-70s/j2000s는 일본어 전용 테마를
      // 쓰는 등)라서 ws.defaultLyricLanguage(워크스페이스 단위 기본값)를
      // 넘기면 그 아키타입의 실제 채널 언어와 달라 suited가 0으로 필터링돼
      // 진짜 폴백이 아닌데도 폴백처럼 보이는 오탐이 실측으로 확인됐습니다.
      // L3가 검사하려는 것은 언어 필터링이 아니라 워크스페이스/아키타입
      // 스코핑이므로, 언어 축은 여기서 분리합니다.
      const pool = lyricThemesForArchetype(archetype);
      const foreign = pool.filter(t => themeWorkspaceOf(t) !== ws.id);
      const fallbackTriggered = suitedCount < 12;
      results.push({
        checkId: 'L3',
        workspaceId: ws.id,
        archetype,
        status: fallbackTriggered || foreign.length ? 'FAIL' : 'PASS',
        detail: fallbackTriggered
          ? `FALLBACK TRIGGERED — 전용 구도 ${suitedCount}개 < 임계값 12, pool.length=${pool.length}(전체 풀로 폴백)`
          : foreign.length
            ? `외부 워크스페이스 테마 ${foreign.length}건 혼입`
            : `전용 구도 ${suitedCount}개, 폴백 없음, 외부 혼입 0건`
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// L4 — 훅 뱅크 분리 (+ 어휘 교집합)
// ---------------------------------------------------------------------------
// senior-oldpop 워크스페이스 내부의 기존(B1~G1 이전) 아키타입들 — 데이터
// 격리(워크스페이스 경계 침범) 대상이 아니라 senior-oldpop 자체의 완성도
// 문제이므로 예외 처리합니다. 이유가 서로 달라 실측 코드를 인용해 구분:
//   - senior-morning: 이 값 자체가 기준(비교 대상), 항상 동일
//   - j2000s: hookBanks/index.ts 자체 주석 — "의도적으로 seniorMorningOverride를 그대로 씁니다"
//   - christmas/lofi-study: hookBanks/christmas.ts·lofiStudy.ts 자체 주석 —
//     "Deferred per the v3.4 spec's explicit instruction to build
//     senior-morning and showa-cafe first" — override가 `{}`(빈 객체)라
//     seniorMorningOverride(마찬가지로 `{}`)와 동일하게 나오는 것은 "누출"이
//     아니라 v3.4 시절부터 문서화된 "아직 안 만듦" 상태입니다.
const L4_INTENTIONAL_SENIOR_MATCH: Record<string, string> = {
  'senior-morning': '비교 기준 자기 자신',
  'j2000s': 'hookBanks/index.ts 자체 주석 — 의도적으로 seniorMorningOverride 재사용',
  'christmas': 'hookBanks/christmas.ts 자체 주석 — v3.4부터 "Deferred", override={}로 문서화된 미구축 상태(누출 아님)',
  'lofi-study': 'hookBanks/lofiStudy.ts 자체 주석 — v3.4부터 "Deferred", override={}로 문서화된 미구축 상태(누출 아님)'
};

function hookOverrideFields(o: HookVocabularyOverride): (keyof HookVocabularyOverride)[] {
  return ['imperativeObjects', 'nounModifiers', 'nounObjects', 'vocativeLeads', 'vocativeAddressees', 'declarativeStems'];
}

function deepEqualOverride(a: HookVocabularyOverride, b: HookVocabularyOverride): boolean {
  return hookOverrideFields(a).every(field => JSON.stringify(a[field] ?? []) === JSON.stringify(b[field] ?? []));
}

export function checkL4(): CheckResult[] {
  const results: CheckResult[] = [];
  for (const ws of workspaceDefinitions) {
    for (const archetype of ws.archetypeIds) {
      if (archetype in L4_INTENTIONAL_SENIOR_MATCH) {
        results.push({ checkId: 'L4', workspaceId: ws.id, archetype, status: 'PASS', detail: `의도적 예외 — ${L4_INTENTIONAL_SENIOR_MATCH[archetype]}` });
        continue;
      }
      const lang = ws.defaultLyricLanguage;
      const override = overrideForArchetype(archetype, lang === 'bilingual' ? 'english' : lang);
      const seniorOverride = overrideForArchetype('senior-morning', lang === 'bilingual' ? 'english' : lang);
      const identical = deepEqualOverride(override, seniorOverride);
      if (identical) {
        // switch에 case가 없어 default(senior)로 떨어진 것 — 훅뱅크가
        // 아직 없는 것(미구축)인지, 있어야 하는데 빠진 것(진짜 누출)인지는
        // 이 시점에서 코드만으로 구분 불가하므로 워크스페이스 ready로 판단.
        results.push({
          checkId: 'L4',
          workspaceId: ws.id,
          archetype,
          status: isBuilt(ws) ? 'FAIL' : 'SKIP',
          detail: isBuilt(ws)
            ? `senior-morning override와 완전 동일 — switch에 case 없음(누출)`
            : `senior-morning override와 동일 — 훅뱅크 미구축(워크스페이스 미완성)`
        });
        continue;
      }
      const defaults = defaultHookParts(lang === 'bilingual' ? 'english' : lang);
      const vocabOverlaps: string[] = [];
      for (const field of hookOverrideFields(override)) {
        const overrideWords = new Set((override[field] ?? []).map(w => w.toLowerCase()));
        const defaultWords = new Set(((defaults as unknown as Record<string, string[]>)[field] ?? []).map(w => w.toLowerCase()));
        const overlap = [...overrideWords].filter(w => defaultWords.has(w));
        if (overlap.length) vocabOverlaps.push(`${field}:${overlap.join(',')}`);
      }
      results.push({
        checkId: 'L4',
        workspaceId: ws.id,
        archetype,
        status: vocabOverlaps.length ? 'FAIL' : 'PASS',
        detail: vocabOverlaps.length ? `언어 기본 어휘와 교집합: ${vocabOverlaps.join(' / ')}` : '고유 override 확인, 언어 기본 어휘와 교집합 0건'
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// L5 — 아키타입 미지정 채널
// ---------------------------------------------------------------------------
export function checkL5(): CheckResult {
  const missing = channelPresets.filter(c => !c.archetype);
  return {
    checkId: 'L5',
    workspaceId: 'senior-oldpop',
    status: missing.length ? 'FAIL' : 'PASS',
    detail: missing.length ? `아키타입 미지정 채널 ${missing.length}건: ${missing.map(c => c.id).join(', ')}` : `채널 프리셋 ${channelPresets.length}개 전부 아키타입 명시`
  };
}

// ---------------------------------------------------------------------------
// L6 — 썸네일 아키타입 노출
// ---------------------------------------------------------------------------
export function checkL6(): CheckResult[] {
  const results: CheckResult[] = [];
  const unscopedCount = thumbnailArchetypes.filter(a => !a.suitedArchetypes).length;
  for (const ws of workspaceDefinitions) {
    for (const archetype of ws.archetypeIds) {
      const scoped = thumbnailArchetypes.filter(a => a.suitedArchetypes);
      const suited = scoped.filter(a => a.suitedArchetypes!.includes(archetype));
      if (!suited.length) {
        results.push({ checkId: 'L6', workspaceId: ws.id, archetype, status: 'SKIP', detail: `전용 썸네일 아키타입 0개(기존 ${unscopedCount}종은 전 아키타입 정상 노출, 제외) — 미구축` });
        continue;
      }
      const list = thumbnailArchetypesForArchetype(archetype);
      const foreign = list.filter(a => a.suitedArchetypes && !a.suitedArchetypes.includes(archetype));
      results.push({
        checkId: 'L6',
        workspaceId: ws.id,
        archetype,
        status: foreign.length ? 'FAIL' : 'PASS',
        detail: foreign.length ? `부적합 노출 ${foreign.length}건: ${foreign.map(a => a.id).join(', ')}` : `전용 ${suited.length}개 확인, 부적합 노출 0건(기존 무제한 ${unscopedCount}종 별도)`
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// L7 — 컨셉 규칙 회귀
// ---------------------------------------------------------------------------
export const L7_SENIOR_CONCEPTS = ['아침 카페', '추억의 라디오', '첫눈', '오래된 우정', '비 오는 밤'];

/**
 * 실측 스냅샷 — 기준 커밋 `201a4c6`(v4.1 TASK A2, B1/B2/C1 이전)의
 * data/conceptKeywords.ts를 `git show 201a4c6:...`로 추출해 그 시점의
 * matchConceptRules(freeText)를 5개 문구에 대해 직접 실행한 실측값입니다
 * (추정하지 않음 — 이 문서 §9 "추정값 금지" 원칙). 새 워크스페이스 규칙
 * (kr2030-* 등)이 추가되어도 이 5개 시니어 문구가 매칭하는 "기존" 규칙
 * 집합이 그대로여야 합니다 — 새 규칙이 우선순위/정규식 충돌로 기존 규칙을
 * 밀어내거나 새로 끼어들면 여기서 잡힙니다.
 */
const L7_SNAPSHOT: Record<string, string[]> = {
  '아침 카페': ['cafe'],
  '추억의 라디오': [],
  '첫눈': ['winter'],
  '오래된 우정': [],
  '비 오는 밤': ['rain']
};

export function checkL7(): CheckResult {
  const mismatches: string[] = [];
  for (const concept of L7_SENIOR_CONCEPTS) {
    const matched = matchConceptRules(concept).map(r => r.id).sort();
    const expected = [...(L7_SNAPSHOT[concept] ?? [])].sort();
    if (JSON.stringify(matched) !== JSON.stringify(expected)) {
      mismatches.push(`"${concept}": 기대 [${expected.join(',')}] 실측 [${matched.join(',')}]`);
    }
  }
  return {
    checkId: 'L7',
    workspaceId: 'senior-oldpop',
    status: mismatches.length ? 'FAIL' : 'PASS',
    detail: mismatches.length ? `매칭 변화 ${mismatches.length}건: ${mismatches.join(' / ')}` : `시니어 컨셉 ${L7_SENIOR_CONCEPTS.length}개 매칭 결과 스냅샷과 동일`
  };
}

// ---------------------------------------------------------------------------
// 실행 / 리포트
// ---------------------------------------------------------------------------
export function runAllChecks(): CheckResult[] {
  return [...checkL1(), checkL2(), ...checkL3(), ...checkL4(), checkL5(), ...checkL6(), checkL7()];
}

function main() {
  const results = runAllChecks();
  const byCheck = new Map<string, CheckResult[]>();
  for (const r of results) {
    if (!byCheck.has(r.checkId)) byCheck.set(r.checkId, []);
    byCheck.get(r.checkId)!.push(r);
  }

  console.log('');
  console.log('=== TASK G1 — 워크스페이스 데이터 격리 검증 ===');
  console.log('');

  for (const checkId of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']) {
    const rs = byCheck.get(checkId) ?? [];
    console.log(`[${checkId}]`);
    for (const r of rs) {
      const label = r.archetype ? `${r.workspaceId} / ${r.archetype}` : r.workspaceId;
      console.log(`  ${label.padEnd(28)} ${r.status.padEnd(5)} ${r.detail}`);
    }
    console.log('');
  }

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;
  console.log(`요약: PASS ${passCount} / FAIL ${failCount} / SKIP ${skipCount}`);
  console.log('');
  if (failCount) {
    console.log('FAIL 항목은 이 스크립트가 고치지 않습니다 — §0-2에 따라 책임 문서(B1/B2/C1/D1/...)로 되돌리십시오.');
  }

  process.exit(failCount ? 1 : 0);
}

// ESM-safe "is this the entry point" check (this repo is "type": "module",
// so require.main is not available) — npx tsx scripts/isolationAudit.ts runs
// main(); importing runAllChecks()/checkL*() from a test does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
