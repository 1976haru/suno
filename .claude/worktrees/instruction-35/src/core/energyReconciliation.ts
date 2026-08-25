/**
 * 지시문 31 (§1) — "검사는 되는데 배분이 안 된다." 지시문 23이 이미 만든
 * 관찰 항목(체감 에너지 vs 아크 강도 불일치·세트 에너지 급변, npm run
 * audit의 관찰 항목 섹션)이 문제를 정확히 찾아내고 있었다 — 새 검사기를
 * 만들지 않는다(§하지 말 것). 이 파일은 그 검사가 찾아낸 두 결함 중 실제로
 * 안전하게 고칠 수 있는 것(②)을 배정(preallocateSongSlots) 단계에서
 * 조정한다.
 *
 * ① 불일치(|perceivedEnergy - intensity| >= 2)를 슬롯의 "내용"(장르)을
 * 다시 골라 고치는 것도 시도했다 — 같은 팩 안에서 두 트랙의 genreId를
 * 맞바꾸면 장르 배분 총량은 항상 보존된다는 게 설계였다. 그런데 실측
 * (tests/moneyChordPlan.test.ts 회귀)에서 진짜 문제를 찾았다:
 * buildGenreAwareProgressionPlan(core/moneyChordPlan.ts, moneyChordMode가
 * 'default'일 때의 통상 경로)이 이미 원래 genrePlan을 보고 트랙별
 * moneyChordText를 먼저 계산해 둔다 — genreId만 사후에 맞바꾸면
 * moneyChordText(그리고 장르의 avoidTraits를 참조하는 negativeStyleText
 * 등)가 새 장르와 안 맞는 채로 남는다. 이걸 제대로 고치려면 장르 배정을
 * "먼저" 끝내고 나서 나머지 필드(머니코드·제외 프롬프트·훅 디바이스 등)를
 * "그다음" 계산하도록 파이프라인 자체를 재구성해야 한다 — 이 세션에서 이미
 * §2가 겪은 것과 같은 종류의 깊은 상호의존이라, 안전하게 끝내기엔 남은
 * 범위를 벗어난다고 판단해 ①은 미구현으로 정직하게 남긴다(§공통 규약 7
 * "실측 없이 blocking을 만들지 않는다"의 반대 방향 위험 — 검증 안 된 채
 * 억지로 밀어붙이지 않는다). 지시문 23의 관찰 항목(감사에 그대로 남아
 * 있음)이 계속 이 불일치를 보고한다 — 그 자체가 회귀는 아니다, §0 원본
 * 수치 그대로다.
 *
 * ② 급변(인접 곡 |perceivedEnergy 차이| >= 3)은 트랙 "위치"만 바꾸면 되고,
 * core/slotOrderOverride.ts의 applySlotOrderOverride(지시문 27 TASK C-2,
 * 곡 내용은 그대로 두고 trackNo만 재배열하는 이미 검증된 메커니즘)를 그대로
 * 재사용한다 — 새 재배열 로직을 만들지 않는다. computePerceivedEnergy가
 * 이미 계산해 둔 slot.perceivedEnergy만 읽는다 — 이것도 새로 계산하지
 * 않는다.
 */
import type { PreassignedSongSlot } from '../types';

/** 지시문 31 (§1-4 완료 판정) — "1건 이하"가 기준이지 0건이 아니다(§하지 말 것 "완전히 매끄러운 곡선은 오히려 단조롭다"). */
const ADJACENT_JUMP_THRESHOLD = 3;

/**
 * 지시문 31 (§1-4 실측 회귀) — 처음 구현은 인접 에너지 차이만 보고 스왑을
 * 받아들여, tests/setDirectorSegments.test.ts의 "같은 세그먼트(=서로 겹치지
 * 않는 genreId 집합) 연속 2곡 이하" 보장을 3곡 연속으로 깼다. 재배열은
 * 내용을 안 바꾸니 무해할 거라는 가정이 틀렸다 — 위치 재배열도 "같은
 * genreId(≈세그먼트) 연속" 같은 순서 자체에 걸린 제약을 깰 수 있다. 그래서
 * 매 스왑 후보마다 전체 순서에서 genreId 최장 연속 구간이 스왑 전보다
 * 늘어나면 그 스왑을 버린다 — §1-4 "재배열이 다른 배분을 깨지 않게 할 것"을
 * 에너지 급변 완화보다 우선한다.
 */
function maxConsecutiveRun(order: readonly number[], keyOf: (trackNo: number) => string | undefined): number {
  let max = 0;
  let current = 0;
  let last: string | undefined;
  for (const trackNo of order) {
    const key = keyOf(trackNo);
    if (key !== undefined && key === last) current += 1;
    else { current = 1; last = key; }
    max = Math.max(max, current);
  }
  return max;
}

/**
 * 인접 곡 급변(§1-3 ②)을 줄이는 trackNo 순서를 계산한다 — 실제 재배열은
 * applySlotOrderOverride(위 doc comment)가 한다, 이 함수는 그 함수가 받는
 * `order: number[]`만 만든다. 탐욕적 인접-스왑: 급변 지점을 훑으며, 두 자리
 * 뒤(i+1과 i+2)를 맞바꾸면 그 지점의 에너지 차이 합이 줄어들 때만, 그리고
 * genreId 최장 연속 구간을 늘리지 않을 때만 바꾼다.
 */
export function reorderForEnergyContinuity(slots: readonly PreassignedSongSlot[]): number[] {
  const order = slots.map(slot => slot.trackNo);
  const energyAt = (trackNo: number) => slots.find(s => s.trackNo === trackNo)?.perceivedEnergy;
  const genreIdAt = (trackNo: number) => slots.find(s => s.trackNo === trackNo)?.genreId;

  const jumpAt = (currentOrder: readonly number[], i: number) => {
    const a = energyAt(currentOrder[i]);
    const b = energyAt(currentOrder[i + 1]);
    return a === undefined || b === undefined ? 0 : Math.abs(a - b);
  };

  let changed = true;
  let guard = 0;
  while (changed && guard < order.length * 2) {
    changed = false;
    guard += 1;
    for (let i = 0; i < order.length - 1; i++) {
      if (jumpAt(order, i) < ADJACENT_JUMP_THRESHOLD) continue;
      if (i + 2 >= order.length) continue; // swap 대상(i+1과 i+2)이 없음
      const before = jumpAt(order, i) + jumpAt(order, i + 1);
      const swapped = [...order];
      [swapped[i + 1], swapped[i + 2]] = [swapped[i + 2], swapped[i + 1]];
      const after = jumpAt(swapped, i) + jumpAt(swapped, i + 1);
      if (after >= before) continue;
      const runBefore = maxConsecutiveRun(order, genreIdAt);
      const runAfter = maxConsecutiveRun(swapped, genreIdAt);
      if (runAfter > runBefore) continue; // §1-4 — 다른 배분(장르 연속 배치)을 깨지 않는다
      order[i + 1] = swapped[i + 1];
      order[i + 2] = swapped[i + 2];
      changed = true;
    }
  }
  return order;
}
