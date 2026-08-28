import { getGenreById } from '../data/genreLibrary';
import { isKidsArchetype } from '../utils/channelArchetype';
import type { ChannelArchetype, GenerationOptions } from '../types';
import { DEFAULT_ADULT_VOCAL_QUOTA, DEFAULT_KIDS_VOCAL_QUOTA, type VocalQuota, type VocalType } from './vocalPlan';

/**
 * 지시문 63 (TASK A) — deriveVocalQuotaFromGenrePlan's own return shape:
 * the derived quota plus a Korean sentence explaining how it was derived,
 * so Step2Concept.tsx can show "왜 이 비율인지" instead of a bare number
 * triple (this task's own §A-3 "화면에 보여준다" requirement).
 */
export interface DerivedVocalQuota extends VocalQuota {
  reasonKo: string;
  /**
   * 지시문 79 (TASK C-3) — reasonKo에 이미 들어 있는 "장르 구성" 부분만
   * 따로 꺼낸 것. 2차 감사 §1의 실제 원인: 화면의 "장르에 맞춰 배정" 카드가
   * reasonKo를 그대로 쓰는데, reasonKo의 숫자는 **성별 쏠림(leaning)을
   * 적용하기 전** 값이라 사용자가 보컬 프리셋을 고른 순간 실제 생성값과
   * 어긋났다(실측: 화면 남6·여5·혼4 / 생성 남8·여3·듀4).
   *
   * 계산 로직은 건드리지 않는다(§지시문 79 §3.3 "계산 로직을 건드리지 말
   * 것") — 문장을 만들 재료만 노출해, 화면이 **실제 적용될 쿼터**로
   * 문장을 다시 조립하게 한다. reasonKo 자체도 그대로 둔다(쏠림이 없는
   * 호출부는 예전 문장을 계속 쓸 수 있다).
   * 장르 선호 정보가 전혀 없어 균등 배정된 경우에는 undefined다.
   */
  genreSummaryKo?: string;
}

const VOCAL_TYPES: VocalType[] = ['male', 'female', 'mixed'];

/**
 * 지시문 63 (TASK A-5) — "역산이 한쪽으로 몰릴 수 있다 ... 하한을 둔다
 * (각 성별 최소 2곡, 15곡 기준, 추정치, verified: false)"가 본문의 출발점
 * 숫자지만, 실측 결과 이 앱의 기존 관문 1(core/designGate.ts의
 * BREADTH_THRESHOLDS.balanced.vocal.minPerTypeRatio = 3/18)이 songCount
 * 15~18 구간에서 이미 타입당 최소 3곡을 요구한다 — 역산 쿼터를 2로만
 * 두면 회귀 방지 목록의 "다섯 워크스페이스 설계 관문 5/5"를 새로
 * 위반한다(실측: evaluateGenerationRequest가 vocal-type-min 경고를 낸다).
 * "채널 쿼터가 0을 명시하면 그것이 우선한다"는 이 함수가 호출되는 시점
 * 자체가 opts.vocalQuota/channel.vocalQuotaOverride 둘 다 없는 경우로
 * 이미 좁혀져 있어(resolveBaseVocalQuota의 `??` 체인 참고) 그대로 지켜진다.
 * 같은 비율(3/18)을 그대로 재사용해 그 기존 관문과 절대 어긋나지 않게
 *하되, songCount가 작아 floor*3이 songCount를 넘는 경우(예: songCount=1)는
 * 강제하지 않는다 — vocalPlan.ts의 leaningAdultVocalQuota own minEach
 * 스케일 다운과 같은 이유.
 */
const DESIGN_GATE_MIN_PER_TYPE_RATIO = 3 / 18;

function minFloorFor(songCount: number): number {
  const desired = Math.round(songCount * DESIGN_GATE_MIN_PER_TYPE_RATIO);
  return Math.max(0, Math.min(desired, Math.floor(songCount / 3)));
}

/** Largest-remainder integerization of 3 non-negative fractional shares into integers summing to exactly `total` — same family of algorithm as vocalPlan.ts's own scaleVocalQuota. */
function integerizeByLargestRemainder(shares: Record<VocalType, number>, total: number): VocalQuota {
  const floors: Record<VocalType, number> = {
    male: Math.floor(shares.male),
    female: Math.floor(shares.female),
    mixed: Math.floor(shares.mixed)
  };
  let remainder = total - (floors.male + floors.female + floors.mixed);
  const byRemainderDesc = VOCAL_TYPES.slice().sort((a, b) => (shares[b] - floors[b]) - (shares[a] - floors[a]));
  const result = { ...floors };
  let i = 0;
  while (remainder > 0) {
    result[byRemainderDesc[i % byRemainderDesc.length]] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

/** Raises every VocalType below `floor` up to it, taking the deficit from whichever type currently holds the most above its own floor — never lets the total drift away from songCount. */
function applyMinFloor(quota: VocalQuota, floor: number): VocalQuota {
  if (floor <= 0) return quota;
  const result = { ...quota };
  let deficit = 0;
  for (const type of VOCAL_TYPES) {
    if (result[type] < floor) {
      deficit += floor - result[type];
      result[type] = floor;
    }
  }
  while (deficit > 0) {
    const donor = VOCAL_TYPES.slice().sort((a, b) => result[b] - result[a])[0];
    if (result[donor] <= floor) break; // every type already at the floor — nothing left to redistribute from
    result[donor] -= 1;
    deficit -= 1;
  }
  return result;
}

/**
 * 지시문 63 (TASK A) — 채널 쿼터를 5·5·5 균등 고정 대신 이 팩의 실제
 * 장르 구성(genrePlan)에서 역산한다. 각 트랙의 lead 장르가 가진
 * GenrePack.vocalPreference(지시문 57/61이 채운 가중치)를 곡 수만큼
 * 가중 합산해 정수로 배분한다 — vocalPreference가 없는(또는 합이 0인)
 * 트랙은 1/3씩 균등하게 취급해 전체 합산에서 "의견 없음"으로만 반영된다.
 *
 * §A-2 예시(8/13 조합·15곡)가 요구하는 정확한 계산 순서를 그대로 따른다:
 * 트랙별 비중 합산 -> 곡 수에 맞춘 정수 배분(largest-remainder) -> 최소
 * 하한 보정. 계산 결과를 그대로 쓴다 — "하지 말 것"의 "5·5·5로 되돌리지
 * 말 것"대로, 결과가 균등에 가깝게 나오는 것과 균등으로 강제 반올림하는
 * 것은 다르다.
 */
export function deriveVocalQuotaFromGenrePlan(
  genrePlan: readonly (string | undefined)[],
  songCount: number,
  _archetype: ChannelArchetype | undefined
): DerivedVocalQuota {
  if (songCount <= 0) return { male: 0, female: 0, mixed: 0, reasonKo: '곡이 없어 배정할 수 없습니다.' };
  if (!genrePlan.length) {
    const even = songCount / 3;
    return { ...integerizeByLargestRemainder({ male: even, female: even, mixed: even }, songCount), reasonKo: '장르 구성을 알 수 없어 고르게 배정했습니다.' };
  }

  const shares: Record<VocalType, number> = { male: 0, female: 0, mixed: 0 };
  let trackedTracks = 0;
  const nameCounts = new Map<string, number>();

  for (let i = 0; i < songCount; i++) {
    const genreId = genrePlan[i % genrePlan.length];
    const genre = genreId ? getGenreById(genreId) : undefined;
    const preference = genre?.vocalPreference;
    const total = preference ? preference.male + preference.female + preference.mixed : 0;
    if (preference && total > 0) {
      shares.male += preference.male / total;
      shares.female += preference.female / total;
      shares.mixed += preference.mixed / total;
      trackedTracks += 1;
      if (genre) nameCounts.set(genre.label, (nameCounts.get(genre.label) ?? 0) + 1);
    } else {
      shares.male += 1 / 3;
      shares.female += 1 / 3;
      shares.mixed += 1 / 3;
    }
  }

  const scaled = integerizeByLargestRemainder(shares, songCount);
  const floored = applyMinFloor(scaled, minFloorFor(songCount));

  const genreSummary = [...nameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} ${count}곡`)
    .join(' · ');
  const reasonKo = trackedTracks > 0
    ? `선택하신 장르 구성(${genreSummary})에서 계산했습니다 — 남 ${floored.male} · 여 ${floored.female} · 혼성 ${floored.mixed}.`
    : '선택하신 장르에 성별 선호 정보가 없어 고르게 배정했습니다.';

  return { ...floored, reasonKo, ...(trackedTracks > 0 ? { genreSummaryKo: genreSummary } : {}) };
}

/**
 * 지시문 63 (TASK A) — batchPreallocation.ts/localGenerator.ts/designGate.ts/
 * userChoices.ts가 각자 따로 갖고 있던 `opts.vocalQuota ?? opts.channel.
 * vocalQuotaOverride ?? (isKidsArchetype ? DEFAULT_KIDS_VOCAL_QUOTA :
 * DEFAULT_ADULT_VOCAL_QUOTA)` 폴백 체인의 단일 source of truth. 우선순위는
 * 예전과 동일하게 유지된다 — opts.vocalQuota(직접 지정) > channel.
 * vocalQuotaOverride(채널 고정, kr-idol 등) — 이 지시문이 바꾸는 것은 그
 * 체인의 마지막 항 하나뿐이다: 균등 5·5·5 고정값 대신, opts.vocalQuotaMode가
 * 명시적으로 'balanced'가 아닌 한 이 팩의 genrePlan에서 역산한 값을 쓴다.
 * "고르게 배정" 선택지는 opts.vocalQuotaMode==='balanced'로 여전히 살아있다
 * (§하지 말 것 — "고르게 배정" 선택지를 없애지 말 것).
 */
/**
 * 지시문 63 (TASK C) — "그 곡의 장르가 원하는 성별과 실제 배정이 맞는
 * 비율"을 재려면 먼저 "이 장르가 원하는 성별"이 무엇인지부터 한 곳에서
 * 정의해야 한다 — core/fullAudit.ts의 vocal_genre_fit 항목과
 * scripts/checkVocalGenreFit.ts가 서로 다른 판정 기준을 쓰면 두 숫자가
 * 드리프트한다. vocalPreference의 최댓값 항목을 "원하는 성별"로 보되,
 * 1·2등 차이가 DOMINANCE_MARGIN 미만이면(추정 임계값, verified: false)
 * "뚜렷한 선호 없음"으로 판단해 null을 반환한다 — 그런 장르는 어느
 * vocalType이 배정돼도 "부합"으로 센다(분모에서 빼는 게 아니라 항상
 * fit으로 취급 — 장르가 명시적으로 반대하지 않는 한 불일치로 벌점을 주지
 * 않는다는 뜻).
 */
const DOMINANCE_MARGIN = 0.15;

export function dominantVocalTypeForGenre(preference: VocalQuota | undefined): VocalType | null {
  if (!preference) return null;
  const entries = VOCAL_TYPES.map(type => [type, preference[type]] as const).sort((a, b) => b[1] - a[1]);
  const [topType, topValue] = entries[0];
  const [, secondValue] = entries[1];
  if (topValue - secondValue < DOMINANCE_MARGIN) return null;
  return topType;
}

export function resolveBaseVocalQuota(
  opts: Pick<GenerationOptions, 'channel' | 'vocalQuota' | 'vocalQuotaMode' | 'songCount'>,
  genrePlan: readonly (string | undefined)[]
): VocalQuota {
  if (opts.vocalQuota) return opts.vocalQuota;
  if (opts.channel.vocalQuotaOverride) return opts.channel.vocalQuotaOverride;
  if (opts.vocalQuotaMode === 'balanced') {
    return isKidsArchetype(opts.channel.archetype) ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA;
  }
  return deriveVocalQuotaFromGenrePlan(genrePlan, opts.songCount, opts.channel.archetype);
}
