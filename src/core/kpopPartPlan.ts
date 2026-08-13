import type { KpopMemberSlot, KpopPartPlan, KpopPartRole } from '../types';
import type { StructureTemplateId } from './lyricEngine';
import type { KpopWorkspacePolicy } from './kpopWorkspacePolicy';
import type { VocalGender } from './vocalPlan';
import { mulberry32 } from '../utils/prng';
import { assignMemberTimbres } from '../data/kpopMemberTimbres';

/**
 * 지시문 37 (TASK A) — "K-pop 아이돌 특징 ① 여러 명이 부른다"가 완전
 * 미구현이었다(실측: 18곡 전부 [Verse 1]/[Chorus]만 있고 멤버 지정이
 * 전혀 없음). 이 파일은 moneyChordText/hookDeviceText/chorusContrastText와
 * 같은 신뢰 모델로 이 트랙의 파트 계획을 앱이 한 번 계산해 슬롯에 싣는다
 * — LLM이 스스로 파트를 창작하지 않는다.
 *
 * TEMPLATE_VOCAL_SECTIONS는 core/lyricEngine.ts의 STRUCTURE_TEMPLATE_SECTION_NOTES
 * (T1~T5)가 서술하는 실제 섹션 순서에서 보컬이 있는 섹션만 뽑은 것이다
 * (Intro/Breakdown/Dance Break류 순수 악기 섹션은 파트 배정 대상이 아니다).
 */
const TEMPLATE_VOCAL_SECTIONS: Record<StructureTemplateId, string[]> = {
  T1: ['Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Final Chorus'],
  T2: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Final Chorus'],
  T3: ['Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Chorus', 'Final Chorus'],
  T4: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Final Chorus'],
  T5: ['Verse 1', 'Chorus', 'Verse 2', 'Bridge', 'Chorus', 'Final Chorus']
};

const ALL_CHORUS_SECTIONS = new Set(['Chorus', 'Final Chorus']);

function memberIdFor(index: number): string {
  return String.fromCharCode(65 + index); // 'A', 'B', 'C', ...
}

/**
 * 지시문 37 (TASK A-2) — 멤버 명단. 리드/서브/래퍼 역할을 로스터에 고정
 * 배치하고(연기별 트랙마다 이 로스터에서 섹션별로 골라 쓴다), vocalGender가
 * 'duet'인 트랙(채널 vocalQuotaOverride의 "혼" 슬롯)에서만 그룹 성별과
 * 반대인 게스트 멤버 1명을 추가한다 — TASK A-3 "파트 배분은 그 성별
 * 안에서만 이루어진다"를 지키면서 실측에서 본 남녀 듀엣 트랙(예: "Rooftop
 * Noon")도 표현할 수 있게 한다.
 */
function buildRoster(memberCount: number, groupGender: 'male' | 'female', includeGuest: boolean): KpopMemberSlot[] {
  const roster: KpopMemberSlot[] = [];
  const rosterSize = includeGuest ? memberCount - 1 : memberCount;
  for (let i = 0; i < rosterSize; i++) {
    let role: KpopPartRole;
    if (i === 0) role = 'main-vocal';
    else if (i === 1) role = 'lead-vocal';
    else if (i === 2 && rosterSize >= 4) role = 'main-rapper';
    else if (i === 3 && rosterSize >= 5) role = 'lead-rapper';
    else role = 'sub-vocal';
    roster.push({ memberId: memberIdFor(i), role, gender: groupGender, timbreId: '', timbreText: '' });
  }
  if (includeGuest) {
    roster.push({ memberId: memberIdFor(rosterSize), role: 'lead-vocal', gender: groupGender === 'male' ? 'female' : 'male', timbreId: '', timbreText: '' });
  }
  return roster;
}

function roleForSection(section: string): KpopPartRole {
  if (ALL_CHORUS_SECTIONS.has(section)) return 'all';
  if (section === 'Bridge') return 'main-vocal';
  if (section === 'Pre-Chorus') return 'lead-vocal';
  return 'sub-vocal'; // Verse 1 / Verse 2 — see A-2 "1~2명 · sub/lead vocal"
}

function countForSection(section: string): number {
  if (ALL_CHORUS_SECTIONS.has(section)) return 0; // 'all' — no explicit memberIds needed
  if (section === 'Pre-Chorus') return 2;
  if (section === 'Bridge') return 1;
  // Verse 1 / Verse 2 — A-2 allows "1~2명"; using 2 here (not 1) is what keeps
  // even the shortest templates (T2/T4, only 2 non-chorus/non-bridge
  // sections) able to reach the "최소 3명 등장" floor without a section count
  // the templates don't have.
  return 2;
}

/**
 * 지시문 37 (TASK A-2) — 매 섹션마다 "아직 이 곡에 등장하지 않은 멤버"를
 * 우선 배정한다(fresh-first greedy). TEMPLATE_VOCAL_SECTIONS의 모든
 * 템플릿은 non-'all' 섹션이 연속 2개를 넘지 않게 짜여 있으므로("같은
 * 멤버가 연속 두 섹션을 넘지 않는다") 별도의 연속-카운트 추적 없이도 그
 * 규칙은 구조적으로 항상 성립한다 — 여기서는 직전 섹션과 100% 겹치는
 * 배정만 피한다(avoidImmediate). fresh-first 전략은 "한 곡에 최소
 * 3명이 등장한다"도 로스터 4명 이상에서 항상 만족시킨다(Verse 1이 항상
 * 2명의 새 멤버로 시작하고, 그다음 non-all 섹션이 fresh pool에서 또
 * 채워지므로).
 */
function assignSection(candidates: KpopMemberSlot[], count: number, rng: () => number, avoidImmediate: Set<string>, usedSoFar: Set<string>): string[] {
  const notAdjacent = candidates.filter(m => !avoidImmediate.has(m.memberId));
  const pool = notAdjacent.length >= count ? notAdjacent : candidates;
  const fresh = shuffle(pool.filter(m => !usedSoFar.has(m.memberId)), rng);
  const stale = shuffle(pool.filter(m => usedSoFar.has(m.memberId)), rng);
  return [...fresh, ...stale].slice(0, Math.min(count, pool.length)).map(m => m.memberId);
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 지시문 37 (TASK A-3) — "남자 그룹에 여성 멤버 태그가 들어가면 blocking."
 * buildKpopPartPlan은 구조상 이 위반을 만들지 않는다(로스터 성별이
 * 항상 policy.groupGender이고, vocalGender가 'duet'인 트랙에서만 정확히
 * 1명의 반대 성별 게스트를 허용 — buildRoster 참고). 이 함수는 그 불변식이
 * 실제로 지켜지는지 리포트/회귀 테스트에서 확인하기 위한 순수 검사이며,
 * 위반이 있으면(있어서는 안 되지만) 위반한 멤버 목록을 반환한다.
 */
export function findKpopPartPlanGenderViolations(plan: KpopPartPlan, groupGender: 'male' | 'female', vocalGender: VocalGender | undefined): KpopMemberSlot[] {
  const allowedOppositeCount = vocalGender === 'duet' ? 1 : 0;
  const opposite = plan.members.filter(m => m.gender !== groupGender);
  return opposite.length > allowedOppositeCount ? opposite : [];
}

export function buildKpopPartPlan(
  vocalGender: VocalGender | undefined,
  structureTemplate: StructureTemplateId | undefined,
  policy: KpopWorkspacePolicy,
  seed: number
): KpopPartPlan {
  const sections = TEMPLATE_VOCAL_SECTIONS[structureTemplate ?? 'T1'];
  const rng = mulberry32(seed >>> 0);
  const [min, max] = policy.memberCountRange;
  const memberCount = min + Math.floor(rng() * (max - min + 1));
  const includeGuest = vocalGender === 'duet';
  const roster = buildRoster(memberCount, policy.groupGender, includeGuest);
  // 지시문 52 (TASK A-1/A-3) — 로스터 확정 직후, 같은 rng 시퀀스를 이어서
  // 멤버별 음색을 배정한다(결정성 유지 — 같은 seed면 같은 결과).
  assignMemberTimbres(roster, rng);
  const rapperPool = roster.filter(m => m.role === 'main-rapper' || m.role === 'lead-rapper');

  const sectionAssignments: KpopPartPlan['sectionAssignments'] = [];
  let lastAssigned = new Set<string>();
  const usedSoFar = new Set<string>();

  sections.forEach(section => {
    const role = roleForSection(section);
    if (role === 'all') {
      sectionAssignments.push({ section, memberIds: ['all'], role: 'all' });
      lastAssigned = new Set();
      return;
    }
    const count = countForSection(section);
    // TASK A-2 — Verse 2는 랩 배분 관행(§C 실측 "part-split-XX"의 rap
    // verse 패턴)에 맞춰 래퍼가 맡을 확률을 결정한다(로스터에 래퍼가 있을
    // 때만). count가 2일 때 두 자리 모두 rapperPool로 제한하면(4명 로스터에는
    // 래퍼가 1명뿐이라) 나머지 한 자리를 채울 수 없어 다양성이 줄어드므로,
    // 래퍼 1명은 고정하고 나머지 자리는 fresh-first로 전체 로스터에서 뽑는다.
    // 지시문 43 (TASK D-4) — 고정 50%였던 확률을 policy.rapPolicy.targetRatio
    // (kpopWorkspacePolicy.ts, 15곡 기준 12곡 목표 = 0.8)에 그대로 연동한다.
    // 실측(20260810 세트) 랩 언급 4/18(22%)에서 목표 80%로 올리는 것이므로
    // 확률도 그만큼 커야 한다 — releaseReadiness.ts의 checkKpopRapShare가
    // 검사하는 목표와 여기서 실제로 배정하는 확률이 항상 같은 정책값을
    // 공유해 둘이 어긋나지 않는다.
    const useRapper = section === 'Verse 2' && rapperPool.length > 0 && rng() < policy.rapPolicy.targetRatio;
    let memberIds: string[];
    let effectiveRole: KpopPartRole;
    if (useRapper) {
      const [rapper] = assignSection(rapperPool, 1, rng, lastAssigned, usedSoFar);
      effectiveRole = rapperPool.find(m => m.memberId === rapper)?.role ?? 'main-rapper';
      const rest = count > 1 ? assignSection(roster.filter(m => m.memberId !== rapper), count - 1, rng, lastAssigned, usedSoFar) : [];
      memberIds = [rapper, ...rest];
    } else {
      effectiveRole = role;
      memberIds = assignSection(roster, count, rng, lastAssigned, usedSoFar);
    }

    memberIds.forEach(id => usedSoFar.add(id));
    lastAssigned = new Set(memberIds);
    sectionAssignments.push({ section, memberIds, role: effectiveRole });
  });

  return { memberCount: roster.length, members: roster, sectionAssignments };
}
