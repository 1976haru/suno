import type { KidsAgeTierId } from '../data/kidsAgeTiers';
import { vocalPresets, type VocalPreset } from '../data/vocalPresets';
import type { LyricLanguage } from '../types';
import { shuffle } from './lyricEngine';
import { vocalDictionLanguage, vocalTypeMatchesPresetGender, VOCAL_DICTION_CLAUSE, type VocalType } from './vocalPlan';

/**
 * 지시문 63 (TASK B-3) — kidsAgeTierId(data/kidsAgeTiers.ts, 이 파일이
 * import조차 하지 않는다 — 그 정책 자체는 손대지 않는다는 §"하지 말 것"
 * 그대로)가 forKids 프리셋 10종 중 이 팩이 후보로 쓸 수 있는 부분집합을
 * 좁힌다. 나이대별 실제 발달 컷오프를 정확히 안다는 뜻이 아니라, "듀엣으로
 * 주고받기"·"돌림노래로 겹쳐 부르기"·"초등 톤" 같은 더 복잡한 형태일수록
 * 더 높은 나이대에만 후보로 남긴다는 정성적 매핑이다 — 추정치이며
 * verified: false. kids-t1(0~2세)은 가장 단순한 5종만, kids-t2(2~4세)는
 * 초등 톤 2종만 제외한 8종, kids-t3(4~7세, 초등 포함)는 10종 전부.
 */
const KIDS_PRESET_IDS_BY_TIER: Record<KidsAgeTierId, readonly string[]> = {
  'kids-t1': ['kid-boy', 'kid-girl', 'kid-choir', 'kid-choir-unison', 'kid-duet'],
  'kids-t2': ['kid-boy', 'kid-girl', 'kid-choir', 'kid-choir-unison', 'kid-choir-round', 'kid-lead-with-choir', 'kid-chant-clap', 'kid-duet'],
  'kids-t3': ['kid-boy', 'kid-girl', 'kid-choir', 'kid-boy-elementary', 'kid-girl-elementary', 'kid-duet', 'kid-choir-unison', 'kid-choir-round', 'kid-lead-with-choir', 'kid-chant-clap']
};

export function candidateKidsPresetsForTier(tierId: KidsAgeTierId): VocalPreset[] {
  const ids = new Set(KIDS_PRESET_IDS_BY_TIER[tierId]);
  return vocalPresets.filter(preset => preset.forKids && ids.has(preset.id));
}

// 지시문 63 (TASK B) — 실측: vocalPlan.ts의 buildVocalVariantPlan도 정확히
// 같은 오프셋 세트({male:0, female:4001, mixed:8009})로 "이 트랙의 변주
// 절"(kidsPresetVocalText의 variantIndex)을 고른다 — 이 파일이 처음에 그
// 오프셋을 그대로 복사해 썼더니, 같은 seed에서 두 셔플(프리셋 자체 선택 ·
// 변주 절 선택)이 상관돼 같은 타입의 서로 다른 트랙이 (같은 프리셋, 같은
// 변주 절) 조합으로 겹치는 실제 중복(15곡 중 2쌍, kr-kids-song 실측)이
// 나왔다 — "vocalText 15/15 고유"(지시문 56) 회귀. 서로 다른 소수로 바꿔
// 두 셔플을 비상관화한다.
const TYPE_SEED_OFFSET: Record<VocalType, number> = { male: 15013, female: 21017, mixed: 27061 };
const VOCAL_TYPES: VocalType[] = ['male', 'female', 'mixed'];

/**
 * 지시문 63 (TASK B) — vocalPlan.ts의 buildVocalVariantPlan과 같은
 * 모양(타입별로 독립된 셔플-랩 순환)이지만, 숫자 인덱스 대신 이 티어의
 * 후보 프리셋 자체를 곡마다 돌린다 — 15곡에 forKids 프리셋 5종 이상이
 * 실제로 쓰이게 하는 것이 이 함수의 목적(§B-2 완료 판정). 후보가 0개인
 * vocalType(이론상 없음 — 모든 티어가 male/female 프리셋을 최소 1개씩은
 * 갖는다)은 그 트랙만 undefined로 남기고 kidsVocalTextFor의 기존 폴백
 * (vocalDescriptionFor)에 맡긴다.
 */
export function buildKidsPresetPlan(
  vocalPlan: readonly VocalType[],
  tierId: KidsAgeTierId,
  seed: number
): (VocalPreset | undefined)[] {
  const candidates = candidateKidsPresetsForTier(tierId);
  const poolByType = new Map<VocalType, VocalPreset[]>(
    VOCAL_TYPES.map(type => [type, candidates.filter(preset => vocalTypeMatchesPresetGender(type, preset.gender))])
  );

  const sequenceByType = new Map<VocalType, VocalPreset[]>();
  const cursorByType = new Map<VocalType, number>();
  for (const type of VOCAL_TYPES) {
    const occurrences = vocalPlan.filter(entry => entry === type).length;
    const pool = poolByType.get(type) ?? [];
    if (!occurrences || !pool.length) continue;
    const sequence: VocalPreset[] = [];
    let lap = 0;
    while (sequence.length < occurrences) {
      const order = shuffle(Array.from({ length: pool.length }, (_, i) => i), seed + TYPE_SEED_OFFSET[type] + lap * 293);
      sequence.push(...order.map(i => pool[i]));
      lap += 1;
    }
    sequenceByType.set(type, sequence);
    cursorByType.set(type, 0);
  }

  return vocalPlan.map(type => {
    const cursor = cursorByType.get(type) ?? 0;
    cursorByType.set(type, cursor + 1);
    return sequenceByType.get(type)?.[cursor];
  });
}

/**
 * 지시문 63 (TASK B-4) — kidsVocalTextFor(vocalPlan.ts)의 matchedPreset
 * 분기는 하루가 화면에서 명시적으로 고른 "팩 전체 단일 프리셋" 경로
 * 전용으로 그대로 둔다(tests/kidsVocalPipeline.test.ts가 그 경로의 정확한
 * 문자열 일치를 이미 고정한다 — 같은 프리셋을 골랐으면 같은 문구가 나오는
 * 게 맞다). buildKidsPresetPlan의 자동 회전 경로는 트랙마다 프리셋
 * 자체(anchor)가 이미 대부분 다르지만, 후보 풀이 좁은 성별(§KIDS_PRESET_
 * IDS_BY_TIER 자기 doc — kids-t1의 남아 프리셋은 1종뿐)에서는 같은
 * 프리셋이 여러 트랙에 반복 배정된다. 프리셋 anchor는 그대로 두고
 * 변주 절을 더해 그 경우에도 vocalText가 트랙마다 달라지게 한다 — 지시문
 * 56이 성인 경로(presetVariantVocalText, batchPreallocation.ts)에 한 것과
 * 같은 "anchor + 곡별 변주" 구조.
 *
 * `variantIndex`는 (buildVocalVariantPlan이 주는 것과 같은) 트랙별 회전
 * 인덱스가 아니라, 호출자가 "이 프리셋 id가 이 팩에서 몇 번째로 쓰이는가"
 * 세는 0-베이스 재사용 카운터여야 한다(batchPreallocation.ts/
 * localGenerator.ts의 kidsPresetVariantCounter 참고) — 실측: 처음엔
 * buildVocalVariantPlan[idx]를 그대로 재사용했다가, 프리셋 자체의 셔플과
 * 변주 절의 셔플이 같은 seed 계열이라 상관돼(TYPE_SEED_OFFSET을 다르게
 * 둬도 확률적으로만 줄었을 뿐 여전히 발생) 같은 성별의 두 트랙이 (같은
 * 프리셋, 같은 절) 조합으로 겹치는 실제 사례가 나왔다("vocalText 15/15
 * 고유" 회귀). 재사용 카운터는 같은 프리셋의 N번째 등장이 항상 (N mod
 * 절 개수)번째 절을 쓰도록 강제해 — 결정적으로, 시드에 기대지 않고 —
 * 절대 겹치지 않는다.
 */
const KIDS_PRESET_VARIANT_CLAUSES = [
  'extra cheerful energy',
  'a touch softer and gentle',
  'extra bright and clear',
  'slightly slower, relaxed delivery',
  'extra playful bounce'
];

export function kidsPresetVocalText(preset: VocalPreset, language: LyricLanguage, variantIndex: number): string {
  const safeIndex = ((variantIndex % KIDS_PRESET_VARIANT_CLAUSES.length) + KIDS_PRESET_VARIANT_CLAUSES.length) % KIDS_PRESET_VARIANT_CLAUSES.length;
  const clause = KIDS_PRESET_VARIANT_CLAUSES[safeIndex];
  return `${preset.prompt}, ${clause}, ${VOCAL_DICTION_CLAUSE[vocalDictionLanguage(language)]}`;
}
