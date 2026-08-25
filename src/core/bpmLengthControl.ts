import type { StructureTemplateId } from './lyricEngine';

/**
 * 지시문 40 — 실측 기반(추정 아님) 재작성. 하루의 실제 음원 35곡(260810_001·
 * 002, 20260809_올드팝라운지_60년대올드팝명곡.json 설계값과 짝지음)을
 * librosa로 측정해 회귀했다. 기존 estimateSongLengthSec은 "명목 마디 시간 ×
 * 1.35"만 썼는데, BPM과 실제 길이의 상관은 +0.456인 반면 단어 수와의 상관은
 * +0.466로 더 강했다 — 계수(1.35)를 아무리 조정해도(0.75~1.35 전수 스캔)
 * ±20초 이내가 최선 15/35(43%)에 그쳤다. 변수 선택 자체가 틀렸던 것이다.
 *
 * 새 모델: 0.80×단어수 + 0.20×명목마디시간 — 절대오차 중앙 12.9초 ·
 * ±20초 이내 27/35(77%). §1 "단순하게 가려면 wordCount×0.96만으로도
 * 26/35"라고 명시하지만, 명목항을 남기면 극단적 템포에서 방어가 된다는
 * 이유로 결합 모델을 채택한다.
 *
 * TASK B — 이 회귀가 드러낸 진짜 원인: BPM_LENGTH_TIERS가 BPM 대역과 단어
 * 예산을 하나로 묶고 있어서 "BPM을 내리면 단어 예산도 함께 내려가는" 문제가
 * 있었다(§4-2 실측 표 — 목표 3:05~3:25에 필요한 단어 수는 178~223으로 BPM과
 * 거의 무관한데, 기존 티어는 155~220으로 크게 흔들렸다). BPM_ENERGY_BANDS
 * (체감 에너지·간주 허용 — 하루의 청취 검증값, 건드리지 않는다)와
 * wordBudgetForTarget(목표 길이에서 역산한 단어·섹션 예산)으로 분리한다.
 * sectionRange는 이 분리 이후에도 예전과 같은 BPM 경계·같은 값을 그대로
 * 쓴다 — §B-3 "섹션 수를 임의로 늘리지 말 것, 섹션당 줄 수를 늘리는 쪽을
 * 먼저 검토한다"는 하루 자신의 지시에 따라, 늘어난 단어 예산은 섹션 수가
 * 아니라 섹션당 줄 수로 흡수되게 둔다(그 판단은 lyricEngine.ts의 몫이며
 * 이 파일은 건드리지 않는다).
 */

// ---------------------------------------------------------------------------
// BPM_ENERGY_BANDS — 체감 에너지 · 간주 허용치. 하루의 청취 검증값(62-72 ·
// 73-84 · 85-94 · 95-100 대역 경계)은 그대로 두고, TASK C가 101 이상 3개
// 대역만 추가한다(§C-1 "resolveBpmLengthTier가 100 초과를 마지막 티어로
// 클램프해 K-pop 112 BPM이 95-100 티어로 처리된다"의 수정).
// ---------------------------------------------------------------------------
export interface BpmEnergyBand {
  minBpm: number;
  maxBpm: number;
  /** Total instrumental-only sections allowed, INCLUDING the intro if it's instrumental. */
  maxInstrumentalSections: number;
}

export const BPM_ENERGY_BANDS: readonly BpmEnergyBand[] = [
  { minBpm: 62, maxBpm: 72, maxInstrumentalSections: 1 },
  { minBpm: 73, maxBpm: 84, maxInstrumentalSections: 1 },
  { minBpm: 85, maxBpm: 94, maxInstrumentalSections: 2 },
  // 지시문 74 (TASK A) — 옛 95-100 대역에서 95만 떼어낸 것. 값(2)은 그대로다.
  // §8 "95 BPM 이하 곡의 섹션 구조를 바꾸지 말 것" 때문에 96부터가 새 정책
  // 대역이 되어야 해서 경계만 나뉘었고, 하루의 청취 검증값(62-72·73-84·
  // 85-94·95)은 하나도 건드리지 않았다.
  { minBpm: 95, maxBpm: 95, maxInstrumentalSections: 2 },
  // 지시문 74 (TASK A) — verified: false. MIN_TOTAL_SECTION_BANDS가 96 이상
  // 대역의 섹션 하한을 9·11·13으로 올렸으므로, 늘어난 섹션을 보컬이 아니라
  // 간주로 채우려면(§1.2 "섹션 수를 늘릴 때 보컬 섹션만 늘리지 말 것") 간주
  // 허용치도 함께 올라가야 한다. 대역 경계를 MIN_TOTAL_SECTION_BANDS와 같게
  // 맞춰(96-110 · 111-125 · 126-150) 두 표가 어긋나지 않게 했다.
  // 값의 근거: 이 대역의 섹션 하한 − T1~T5 보컬 뼈대(6~8섹션)의 하한.
  //   96-110  → 9섹션  − 6(T4) = 3
  //   111-125 → 11섹션 − 8(T1) = 3, T4(6)면 5가 필요하지만 §1.3 권장 구조
  //             (Intro/Breakdown/Instrumental Break/Outro = 4)를 상한으로 둔다
  //   126-150 → 13섹션 − 8(T1) = 5
  { minBpm: 96, maxBpm: 110, maxInstrumentalSections: 3 },
  { minBpm: 111, maxBpm: 125, maxInstrumentalSections: 4 },
  { minBpm: 126, maxBpm: 150, maxInstrumentalSections: 5 }
];

/** Clamps out-of-table BPM to the nearest edge band rather than throwing — a design-time estimate always needs SOME target. */
export function resolveBpmEnergyBand(bpm: number): BpmEnergyBand {
  if (bpm <= BPM_ENERGY_BANDS[0].maxBpm) return BPM_ENERGY_BANDS[0];
  const last = BPM_ENERGY_BANDS[BPM_ENERGY_BANDS.length - 1];
  if (bpm >= last.minBpm) return last;
  return BPM_ENERGY_BANDS.find(band => bpm >= band.minBpm && bpm <= band.maxBpm) ?? last;
}

// ---------------------------------------------------------------------------
// 섹션 범위 — BPM 경계는 BPM_ENERGY_BANDS와 같지만, §B-3에 따라 이 지시문
// 에서는 "값 자체"를 그대로 유지한다(62-72·73-84 → 5-6, 85-94·95-100 → 6-7,
// 기존 BPM_LENGTH_TIERS와 바이트 단위로 동일). 101 이상 3개는 TASK C가
// 새로 추가하는 것이라 기존 값이 없다 — 85-100의 추세(빠를수록 섹션 여유가
// 조금 는다)를 그대로 이어간 추정치(verified: false)로 채운다.
// ---------------------------------------------------------------------------
interface SectionRangeByBpmBand {
  minBpm: number;
  maxBpm: number;
  sectionRange: [number, number];
}

const SECTION_RANGE_BANDS: readonly SectionRangeByBpmBand[] = [
  { minBpm: 62, maxBpm: 72, sectionRange: [5, 6] },
  { minBpm: 73, maxBpm: 84, sectionRange: [5, 6] },
  { minBpm: 85, maxBpm: 94, sectionRange: [6, 7] },
  { minBpm: 95, maxBpm: 100, sectionRange: [6, 7] },
  // verified: false — TASK C 확장분, 85-100 추세를 이어간 추정치.
  { minBpm: 101, maxBpm: 115, sectionRange: [6, 7] },
  { minBpm: 116, maxBpm: 130, sectionRange: [6, 8] },
  { minBpm: 131, maxBpm: 150, sectionRange: [6, 8] }
];

/** BPM만으로 정해지는 섹션 범위(§B-3, 목표 길이와 무관 — wordBudgetForTarget이 내부적으로 이 함수를 쓴다). structureTemplatePlan.ts 등 단어 예산 없이 섹션 범위만 필요한 호출부를 위해 별도로 export한다. */
export function sectionRangeForBpm(bpm: number): [number, number] {
  if (bpm <= SECTION_RANGE_BANDS[0].maxBpm) return SECTION_RANGE_BANDS[0].sectionRange;
  const last = SECTION_RANGE_BANDS[SECTION_RANGE_BANDS.length - 1];
  if (bpm >= last.minBpm) return last.sectionRange;
  return (SECTION_RANGE_BANDS.find(band => bpm >= band.minBpm && bpm <= band.maxBpm) ?? last).sectionRange;
}

// ---------------------------------------------------------------------------
// 지시문 74 (TASK A) — BPM 구간별 "총 섹션 수" 하한.
//
// 실측 근거(§1.1): 20260824_AfterHoursDeepHouse 12곡에서 114 BPM 딥하우스
// 트랙이 가사 238단어(팩 전체 최다)인데도 7섹션에 그쳐 1:58로 끝났다. 가사가
// 부족해서가 아니다 — 섹션 수가 BPM과 무관하게 6~8로 고정돼 있었다.
// 4/4 한 마디 = 4×60/BPM 초, 섹션당 8마디로 잡으면
//    77 BPM  → 3.12초/마디 × 64마디(8섹션) = 200초 = 3:20  ✓
//   114 BPM  → 2.11초/마디 × 56마디(7섹션) = 118초 = 1:58  ✗
// stylePrompt의 "3:10-3:35" 텍스트를 Suno가 지키지 않는다는 것도 같은 실측에서
// 확인됐다(§1.2) — 실제 길이를 정하는 것은 가사의 섹션 구성이다.
//
// 이 표는 SECTION_RANGE_BANDS(위)를 대체하지 않는다. 위 표는 여전히
// structureTemplatePlan.ts가 T1~T5 중 어느 "보컬 뼈대"를 고를지 판단하는
// 데 쓰이고(템플릿은 6~8섹션뿐이라 이 하한을 그대로 적용하면 어떤 템플릿도
// 적격이 아니게 된다), 이 표는 그 뼈대에 간주 섹션을 덧붙인 "총 섹션 수"의
// 하한이다. 늘어나는 분량은 보컬이 아니라 간주로 채운다(§1.2, §8).
//
// 95 BPM 이하는 이 표를 타지 않는다 — §8 "95 BPM 이하 곡의 섹션 구조를
// 바꾸지 말 것". 실측상 3:20으로 목표를 달성하고 있다.
// ---------------------------------------------------------------------------
interface MinTotalSectionBand {
  minBpm: number;
  maxBpm: number;
  /** 3:10(190초)을 섹션당 8마디로 채우는 데 필요한 최소 섹션 수(§1.2 표). */
  minSections: number;
}

const MIN_TOTAL_SECTION_BANDS: readonly MinTotalSectionBand[] = [
  { minBpm: 96, maxBpm: 110, minSections: 9 },
  { minBpm: 111, maxBpm: 125, minSections: 11 },
  { minBpm: 126, maxBpm: 999, minSections: 13 }
];

/** 지시문 74 (TASK A) — 이 BPM에서 요구되는 총 섹션 수 하한. 95 이하는 0(=이 정책 비적용, SECTION_RANGE_BANDS가 그대로 지배). */
export function minTotalSectionsForBpm(bpm: number): number {
  return MIN_TOTAL_SECTION_BANDS.find(band => bpm >= band.minBpm && bpm <= band.maxBpm)?.minSections ?? 0;
}

/**
 * 지시문 74 (TASK A) — 가사에 실제로 써야 할 총 섹션 수 범위. 95 이하에서는
 * sectionRangeForBpm과 완전히 같은 값을 돌려주므로(같은 배열 참조는 아니지만
 * 값이 동일) 기존 세트의 구조가 한 곡도 바뀌지 않는다. 96 이상에서만 하한이
 * 올라가고, 상한은 하한+2로 둔다 — 상한을 더 벌리면 3:35 목표를 넘겨 지시문
 * 40이 잡아놓은 LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC 쪽과 싸우게 된다.
 */
export function totalSectionRangeForBpm(bpm: number): [number, number] {
  const floor = minTotalSectionsForBpm(bpm);
  if (!floor) return sectionRangeForBpm(bpm);
  return [floor, floor + 2];
}

/**
 * 지시문 74 (TASK A) — 배정된 structureTemplate의 보컬 뼈대(6~8섹션) 위에
 * 몇 개의 간주 전용 섹션을 덧붙여야 하한을 채우는지. 브릿지 지시문이 이
 * 숫자를 에이전트에게 그대로 넘긴다(§1.2 "늘어나는 분량은 인스트루멘탈
 * 섹션으로 채운다"). 95 이하 · 이미 하한을 넘긴 템플릿은 0.
 */
export function instrumentalExtensionForBpm(bpm: number, structureTemplate?: StructureTemplateId): number {
  const floor = minTotalSectionsForBpm(bpm);
  if (!floor) return 0;
  const spine = structureTemplate ? (TEMPLATE_SECTION_COUNT[structureTemplate] ?? DEFAULT_TEMPLATE_SECTION_COUNT) : DEFAULT_TEMPLATE_SECTION_COUNT;
  return Math.max(0, floor - spine);
}

/**
 * Nominal bar count per structureTemplate, derived from
 * lyricEngine.ts's own STRUCTURE_TEMPLATE_SECTION_NOTES section lists
 * (read-only reference — this file never imports/touches lyricEngine.ts's
 * actual generation logic). Standard 8-bar phrase per full section
 * (verse/chorus/bridge/breakdown/key-lift-final-chorus), 4-bar for a short
 * intro/pre-chorus/hook-only section.
 */
const TEMPLATE_BARS: Record<StructureTemplateId, number> = {
  // intro4 + verse8 + pre-chorus4 + chorus8 + verse8 + chorus8 + bridge8 + final-chorus8
  T1: 56,
  // cold-hook-intro4 + verse8 + chorus8 + verse8 + chorus8 + breakdown8 + final-chorus8
  T2: 52,
  // intro4 + verse8 + pre-chorus4 + chorus8 + verse8 + chorus8 + key-lift-final-chorus8
  T3: 48,
  // instrumental-hook-intro4 + verse8 + chorus8 + verse8 + chorus8 + final-chorus8 (no bridge/pre-chorus)
  T4: 44,
  // a-cappella-hook-intro4 + verse8 + chorus8 + verse8 + bridge8 + chorus8 + final-chorus8
  T5: 52
};
const DEFAULT_TEMPLATE_BARS = TEMPLATE_BARS.T1;

/**
 * v4.6 (TASK C) — section count per structureTemplate, read from the same
 * STRUCTURE_TEMPLATE_SECTION_NOTES lists TEMPLATE_BARS above already
 * documents (T1=8, T2=7, T3=7, T4=6, T5=7).
 */
export const TEMPLATE_SECTION_COUNT: Record<StructureTemplateId, number> = {
  T1: 8,
  T2: 7,
  T3: 7,
  T4: 6,
  T5: 7
};

/** 지시문 74 (TASK A) — structureTemplate을 모르는 호출부용 보컬 뼈대 기본값(T1). */
const DEFAULT_TEMPLATE_SECTION_COUNT = TEMPLATE_SECTION_COUNT.T1;

/** 3:45, this task's own explicit blocking bar (§2-4: "추정이 3:45를 넘으면 관문 1에서 blocking하십시오") — unchanged by 지시문 40. */
export const LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC = 225;

/**
 * 지시문 40 (TASK A-1) — 실측 35곡 회귀값. 절대오차 중앙 12.9초 · ±20초
 * 이내 27/35(77%). §하지 말 것 "0.80/0.20을 임의로 바꾸지 말 것 — 실측
 * 35곡 회귀값이다. 바꾸려면 다시 회귀한다."
 */
export const WORD_WEIGHT = 0.80;
export const NOMINAL_WEIGHT = 0.20;

function nominalSecFor(bpm: number, structureTemplate?: StructureTemplateId): number {
  const bars = structureTemplate ? (TEMPLATE_BARS[structureTemplate] ?? DEFAULT_TEMPLATE_BARS) : DEFAULT_TEMPLATE_BARS;
  const safeBpm = bpm > 0 ? bpm : 90;
  return (bars * 4 * 60) / safeBpm;
}

/**
 * 지시문 40 (TASK A-2) — wordCount를 모르는 호출부(설계안 단계, 아직 가사가
 * 없음)를 위한 대체값: 그 BPM에서 senior-oldpop의 기본 목표 길이
 * (3:05~3:25, 185~205초)로 역산한 단어 예산의 중앙값. "예산이 맞으면
 * 예상도 맞는다" — TASK B가 실제 워크스페이스별 목표 길이로 예산을 고치면
 * (core/audienceProfiles.ts의 songLengthSecondsRange를 실제로 쓰는 호출부는)
 * 이 값도 자동으로 정확해진다. 이 함수 자체는 senior의 기본값을 쓰는
 * "아무 것도 모를 때의 안전한 대체값"일 뿐 — 실제 워크스페이스를 아는
 * 호출부는 wordBudgetForTarget을 자기 audienceProfile.songLengthSecondsRange로
 * 직접 불러 더 정확한 값을 얻는다(§A-3).
 */
const DEFAULT_TARGET_SEC_RANGE: [number, number] = [185, 205];

export function expectedWordCount(bpm: number, structureTemplate?: StructureTemplateId): number {
  const { wordRange } = wordBudgetForTarget(DEFAULT_TARGET_SEC_RANGE, bpm, structureTemplate);
  return Math.round((wordRange[0] + wordRange[1]) / 2);
}

/**
 * 지시문 40 (TASK B-1) — 목표 길이에서 단어·섹션 예산을 역산한다. 공식은
 * estimateSongLengthSec과 완전히 같은 회귀 모델을 뒤집은 것뿐이다:
 *   targetSec = WORD_WEIGHT × word + NOMINAL_WEIGHT × nominalSec
 *   → word = (targetSec − NOMINAL_WEIGHT × nominalSec) / WORD_WEIGHT
 * §4-2/§C-3의 실측 표(예: 63 BPM·185초→178단어, 100 BPM·205초→223단어,
 * 112 BPM·150초→158단어)를 그대로 재현한다(실측치와 정확히 일치 확인됨).
 * sectionRange는 목표 길이가 아니라 BPM만으로 정해진다(§B-3, 위
 * SECTION_RANGE_BANDS 참고) — 단어 예산이 커져도 섹션 수 자체는 그대로다.
 */
export function wordBudgetForTarget(
  targetSecRange: [number, number],
  bpm: number,
  structureTemplate?: StructureTemplateId
): { wordRange: [number, number]; sectionRange: [number, number] } {
  const nominalSec = nominalSecFor(bpm, structureTemplate);
  const wordFor = (targetSec: number) => Math.max(0, Math.round((targetSec - NOMINAL_WEIGHT * nominalSec) / WORD_WEIGHT));
  const wordRange: [number, number] = [wordFor(targetSecRange[0]), wordFor(targetSecRange[1])];
  // 지시문 74 (TASK A) — 96 BPM 이상에서만 총 섹션 하한(MIN_TOTAL_SECTION_BANDS)
  // 이 적용된 범위를 돌려준다. 95 이하는 sectionRangeForBpm과 값이 같다.
  return { wordRange, sectionRange: totalSectionRangeForBpm(bpm) };
}

/**
 * 지시문 40 (TASK A-1) — 실측 회귀 공식. wordCount를 아는 호출부(가져오기
 * 후, 실제 가사가 있음)는 그 실제 단어 수를 넘긴다. 모르는 호출부(설계안
 * 단계)는 expectedWordCount(bpm)로 대체한다 — BPM만으로 추정하는 옛 경로는
 * 남기지 않는다(§하지 말 것).
 */
export function estimateSongLengthSec(bpm: number, structureTemplate?: StructureTemplateId, wordCount?: number): number {
  const nominalSec = nominalSecFor(bpm, structureTemplate);
  const effectiveWordCount = wordCount && wordCount > 0 ? wordCount : expectedWordCount(bpm, structureTemplate);
  return WORD_WEIGHT * effectiveWordCount + NOMINAL_WEIGHT * nominalSec;
}

export function formatEstimatedLength(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
