import type { WorkspaceId } from '../types';

/**
 * v5.23 (TASK C) — "규칙을 줄이지 않습니다. 규칙의 위치를 바꿉니다": 3-4 of an
 * 18-song set are "exploration slots" that waive STYLE-allocation rules
 * (genre/vocal/arrangement-density/moneyChord distribution quotas, BPM
 * position within the audience profile's own range) while keeping every
 * SAFETY constraint (senior hardExclusions, forbiddenAtoms, artist/
 * copyright, English grammar, cross-set duplication, song length). Gated
 * to 'senior-oldpop' only (§11) — the one workspace with two months of real
 * listening feedback to judge whether an exploration attempt actually
 * helped; every other workspace has zero listening verification, so a bad
 * exploration attempt there would be indistinguishable from a bad
 * workspace design (§11-2's own reasoning).
 */

export const EXPLORATION_AXES = ['genre', 'structure', 'vocal', 'harmony', 'tempo', 'arrangement', 'lyricForm'] as const;
export type ExplorationAxis = (typeof EXPLORATION_AXES)[number];

const EXPLORATION_ENABLED_WORKSPACES: WorkspaceId[] = ['senior-oldpop'];

/** Spec's own §3-2 "7세트 주기로 회전하십시오" — `setSequence` is a monotonically increasing count of exploration-eligible sets generated so far (core/explorationLedger.ts's own record count), NOT reset daily. */
export function explorationAxisForSequence(setSequence: number): ExplorationAxis {
  const index = ((setSequence % EXPLORATION_AXES.length) + EXPLORATION_AXES.length) % EXPLORATION_AXES.length;
  return EXPLORATION_AXES[index];
}

export interface ExplorationSlotPlan {
  enabled: boolean;
  trackNos: number[];
  axis: ExplorationAxis | null;
  /** Spec's own §11-3 "reason: 'not-enabled-for-workspace'" — present only when enabled is false. */
  reason?: 'not-enabled-for-workspace' | 'set-too-small';
}

/**
 * Spec's own §3-4 "탐색 슬롯을 1~3번에 두지 마십시오... 권장 6~8번 · 12~14번" —
 * scaled proportionally (35%/44%/67%/78% of songCount) rather than the
 * literal 18-song numbers, so a differently-sized set still lands in the
 * same "past the opening, in the rising/easing arc region" zone. Always
 * clamps below songCount and above 3, and de-dupes.
 */
export function selectExplorationTrackNos(songCount: number, workspaceId: WorkspaceId, setSequence: number): ExplorationSlotPlan {
  if (!EXPLORATION_ENABLED_WORKSPACES.includes(workspaceId)) {
    return { enabled: false, trackNos: [], axis: null, reason: 'not-enabled-for-workspace' };
  }
  // Spec's own §3-1 "18곡 -> 14~15곡 검증된 조합 + 3~4곡 탐색" ratio — a set
  // too small to spare 3 tracks past the opening 3 gets none rather than a
  // degenerate 1-track "exploration".
  if (songCount < 8) {
    return { enabled: false, trackNos: [], axis: null, reason: 'set-too-small' };
  }
  const slotCount = songCount >= 12 ? 4 : 3;
  const candidatePositions = [0.35, 0.44, 0.67, 0.78]
    .map(fraction => Math.max(4, Math.min(songCount - 1, Math.round(songCount * fraction))))
    .filter((value, index, arr) => arr.indexOf(value) === index) // de-dupe positions that round to the same track at small songCounts
    .slice(0, slotCount);
  const trackNos = candidatePositions.sort((a, b) => a - b);
  return { enabled: true, trackNos, axis: explorationAxisForSequence(setSequence) };
}

const AXIS_LABEL_KO: Record<ExplorationAxis, string> = {
  genre: '장르 조합',
  structure: '구조',
  vocal: '보컬',
  harmony: '화성',
  tempo: '템포',
  arrangement: '편곡',
  lyricForm: '가사 형식'
};

const AXIS_PROMPT_KO: Record<ExplorationAxis, string[]> = {
  genre: ['이 채널에서 안 쓰던 장르 2종을 조합해 보십시오.'],
  structure: [
    '일반적인 벌스-후렴 구조를 벗어나 보십시오.',
    '  후렴을 한 번만 쓰기',
    '  브리지 없이 벌스 3개',
    '  후렴으로 시작하기',
    '  마지막 벌스가 후렴이 되기'
  ],
  vocal: ['안 쓰던 음색 조합이나 화자 전환을 시도해 보십시오.'],
  harmony: ['안 쓰던 머니코드를 다른 계열의 곡에 써 보십시오.'],
  tempo: ['프로파일이 허용하는 범위 안에서, 이 채널이 잘 안 쓰던 템포 대역을 시도해 보십시오.'],
  arrangement: ['악기 하나만으로, 또는 무반주 구간을 넣어 편곡해 보십시오.'],
  lyricForm: ['대화체·편지체·나열형 등 평소와 다른 가사 형식을 시도해 보십시오.']
};

/**
 * v5.23 (TASK C §3-5) — the exact instruction shape the task spec's own
 * §3-5 example shows. "실패해도 됩니다" is a REQUIRED literal line (spec's
 * own §9 "하지 말 것" — never drop it, it's what keeps the agent from
 * playing it safe). `kidsMode` softens the framing per spec §11-6 (never
 * implemented for exploration itself since kids workspaces don't reach
 * this function — EXPLORATION_ENABLED_WORKSPACES excludes them — but kept
 * as a documented parameter so a future kr-kids/jp-kids expansion doesn't
 * have to rediscover this constraint; see §11-5's own WorkspaceExplorationPolicy).
 */
export function buildExplorationInstructionLines(plan: ExplorationSlotPlan): string[] {
  if (!plan.enabled || !plan.axis || !plan.trackNos.length) return [];
  const trackLabel = plan.trackNos.map(n => `T${n}`).join(' · ');
  return [
    '',
    `[탐색 슬롯 — ${trackLabel}]`,
    '',
    `  이 ${plan.trackNos.length}곡은 다른 ${plan.trackNos.length === 3 ? '15' : '14'}곡과 다른 방식으로 만드십시오.`,
    `  이번 세트의 탐색 축은 "${AXIS_LABEL_KO[plan.axis]}"입니다.`,
    '',
    ...AXIS_PROMPT_KO[plan.axis].map(line => `  ${line}`),
    '',
    '  단, 다음은 지키십시오',
    '    시니어가 듣기 편한 음역과 다이내믹',
    '    아날로그 프로덕션',
    '    3:05~3:25 길이',
    '',
    '  실패해도 됩니다. 이 슬롯 중 하나만 좋아도 성공입니다.'
  ];
}
