/**
 * 지시문 27 (TASK C-2) — GenerationOptions.slotOrderOverride의 실제 적용
 * 지점. preallocateSongSlots(batchPreallocation.ts)/generateLocalBlueprint
 * (localGenerator.ts) 둘 다 자기 자신의 평소 파이프라인으로 슬롯/곡을 전부
 * 만든 *뒤에* 이 함수를 마지막 한 단계로 거친다 — 곡 내용은 전혀 다시
 * 계산하지 않고, 어느 trackNo의 내용물이 어느 위치에 오는지만 바꾼다
 * (§C-2 "슬롯 순서를 재배열한다. 곡 내용은 그대로").
 */
export function applySlotOrderOverride<T extends { trackNo: number }>(items: T[], order: number[] | undefined): T[] {
  if (!order || !order.length) return items;
  if (order.length !== items.length) return items;
  const byTrackNo = new Map(items.map(item => [item.trackNo, item]));
  const reordered: T[] = [];
  for (const originalTrackNo of order) {
    const item = byTrackNo.get(originalTrackNo);
    if (!item) return items; // 원래 trackNo 집합과 안 맞음 — 오염된 override 무시
    reordered.push(item);
  }
  return reordered.map((item, index) => ({ ...item, trackNo: index + 1 }));
}
