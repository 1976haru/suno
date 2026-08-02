import type { WorkspaceId } from '../types';

/**
 * v3.82 (TASK A) — "청취로 확인된 사실을 시스템에 기록"하는 등록부. Real listening
 * feedback traced a genuine root cause (docs: T1/T4/T7 all scored good on
 * "필라델피아 스위트소울 81 BPM" regardless of vocal gender — T7's own male
 * lead disproved the earlier "여성 보컬 우위" hypothesis) but that finding
 * only ever lived in a chat transcript. This file is the registry the app
 * itself reads from — see core/verifiedCombos.ts for how it's combined with
 * user-approved (never auto-approved — this task's own "자동 등록하지
 * 말 것") entries and consulted when assigning the flagship (track 2-3)
 * slots (core/batchPreallocation.ts / core/localGenerator.ts).
 *
 * Both a `verdict: 'good'` entry and a `verdict: 'bad'` (rejected-hypothesis)
 * entry are seeded here deliberately — this task's own §7 "폐기된 가설을
 * 삭제하지 말 것: verdict: 'bad'로 남겨야 재발을 막습니다".
 */

export interface VerifiedCombo {
  id: string;
  workspaceId: WorkspaceId;
  /** This combo's genre axis. For a verdict:'bad' entry that isn't really about a genre (e.g. an arrangement/proximity hypothesis), 'any' means "not genre-specific" — see cautionsKo/noteKo for what was actually rejected. */
  genreId: string;
  bpmRange: [number, number];
  /** undefined means confirmed gender-independent (T7's own real result), not merely "not yet checked". */
  vocalType?: 'male' | 'female' | 'mixed';
  arrangementDensity?: 'sparse' | 'medium' | 'full';
  verdict: 'good' | 'mixed' | 'bad';
  sampleSize: number;
  /** Song codes (see core/setCode.ts) when known, else a plain trackNo label like 'T1' for pre-code-system samples. */
  sampleTracks: string[];
  /** ISO date (YYYY-MM-DD is enough — this is a listening-verification date, not a timestamp). */
  verifiedAt: string;
  noteKo: string;
  /** Real caveats observed on THIS combo specifically (e.g. a length risk) — never a generic warning. */
  cautionsKo: string[];
}

export const SEED_VERIFIED_COMBOS: VerifiedCombo[] = [
  {
    id: 'senior-philly-81',
    workspaceId: 'senior-oldpop',
    genreId: 'oldpop-philly-soul-sweet',
    bpmRange: [78, 86],
    vocalType: undefined,
    verdict: 'good',
    sampleSize: 3,
    sampleTracks: ['T1', 'T4', 'T7'],
    verifiedAt: '2026-08-02',
    noteKo: '필라델피아 스위트소울 81 BPM. 스트링 섹션과 비브라폰 편곡. 보컬 성별 무관(T7이 남성 리드로 확인 — 여성 보컬 우위 가설을 반증).',
    cautionsKo: ['섹션 9개 + 악기 구간 2개면 4분을 넘습니다 (T7 실측 4:16) — 대표곡 배정 시 섹션 7-8·악기 구간 1개로 제한하십시오.']
  },
  {
    id: 'senior-sparse-plate-REJECTED',
    workspaceId: 'senior-oldpop',
    genreId: 'any',
    bpmRange: [0, 999],
    arrangementDensity: 'sparse',
    verdict: 'bad',
    sampleSize: 1,
    sampleTracks: ['T2'],
    verifiedAt: '2026-08-02',
    noteKo: '표본 1곡(T2)만으로 "sparse 편곡 + plate 잔향이 좋다"는 가설을 세웠으나, T1·T4 재분석 결과 근거 없음. 실제 원인은 philly-soul-sweet + 81 BPM 조합(위 senior-philly-81)이었습니다. 이 조합을 다시 추천하지 마십시오.',
    cautionsKo: []
  }
];
