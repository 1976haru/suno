/**
 * 지시문 38 (TASK A-3) — 하루가 기본 곡 수를 18에서 15로 바꾸면서, 18곡
 * 기준으로 튜닝된 여러 쿼터(BPM 대역·편곡 밀도·era-neutral 하한·보컬 쿼터)를
 * 비례 환산해야 했다. 실측해보니 그 넷은 이미 각자 largest-remainder 방식의
 * 비례 스케일링을 갖고 있었다(core/tempoPlan.ts의 scaleBandCounts,
 * core/promptComposer.ts의 arrangementDensityCounts, core/constraints.ts의
 * ensureEraNeutralFloor, core/vocalPlan.ts의 scaleVocalQuota) — 이 파일은
 * 그 넷을 대체하지 않는다(§공통 규약 5 "낡은 경로를 남긴 채 새 경로를
 * 추가하지 않는다"의 반대 방향 위험 — 이미 잘 동작하는 걸 새 함수로 갈아
 * 끼우면 검증 안 된 회귀 위험만 생긴다).
 *
 * 이 함수가 실제로 필요했던 유일한 자리는 data/emotionQuotaPolicy.ts의
 * targetCount(5·3·3·2·2·2·1 = 18) — core/emotionArcQuota.ts의
 * emotionQuotaAdvisory가 이 값을 화면 표시 텍스트("목표 N")에 그대로
 * 박아 넣고 있었고, 라벨도 "18곡 감정 분포"로 하드코딩돼 있었다. 15곡
 * 세트에서도 "목표 5"라고 보여주는 건 거짓 정보다.
 *
 * 같은 largest-remainder 알고리즘(스케일한 뒤 내림, 나머지를 소수부가 큰
 * 순서로 1씩 배분)을 재사용해 반올림 후 합이 항상 targetSongCount와 정확히
 * 맞는다 — core/tempoPlan.ts의 scaleBandCounts와 동일한 방식.
 */
export function scaleQuotaToSongCount(
  baseQuota: Record<string, number>,
  baseSongCount: number,
  targetSongCount: number
): Record<string, number> {
  if (targetSongCount <= 0 || baseSongCount <= 0) {
    return Object.fromEntries(Object.keys(baseQuota).map(key => [key, 0]));
  }
  if (targetSongCount === baseSongCount) return { ...baseQuota };

  const keys = Object.keys(baseQuota);
  const raw = keys.map(key => (baseQuota[key] / baseSongCount) * targetSongCount);
  const floors = raw.map(Math.floor);
  let remainder = targetSongCount - floors.reduce((sum, value) => sum + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  const counts = [...floors];
  for (let k = 0; k < byFraction.length && remainder > 0; k += 1, remainder -= 1) {
    counts[byFraction[k].index] += 1;
  }
  return Object.fromEntries(keys.map((key, index) => [key, counts[index]]));
}
