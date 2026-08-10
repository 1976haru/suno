import type { KidsAgeTierId } from './kidsVocabularyWhitelist';

/**
 * TASK v3.67 (TASK A) — real user listening feedback: "킬링포인트도 없는
 *것 같고, 지루함도 느껴지고" (60-70/100). Diagnosis: the senior audience
 * profile's exclusions/earworm-mode text bans every device a real reference
 * song's memorable moment relies on (a belted long tone, an abrupt dynamic
 * jump, an unexpected key change) — see data/audienceProfiles.ts's
 * relaxableAtPeak/hardExclusions split, TASK B.
 *
 * A KillingPoint is ONE designed peak moment for ONE track — conveyed to
 * the composer as an intent ("the final chorus lifts a semitone — make
 * that the song's standout moment") never a forced verbatim phrase, and
 * never more than one atom of stylePrompt budget (see this task's own
 * "프롬프트 원자 2개 이상으로 만들지 말 것").
 */
// TASK D2 §4 — 'call-response' added for KIDS_KILLING_POINTS (data/killingPointsKids.ts):
// purely additive, never read/switched on by any logic in this file (placement is opaque
// descriptive metadata here), so every existing KILLING_POINTS entry's behavior is unchanged.
export type KillingPointPlacement = 'final-chorus' | 'bridge' | 'mid-instrumental' | 'pre-chorus' | 'outro' | 'call-response';

export interface KillingPoint {
  id: string;
  labelKo: string;
  /** Single style-prompt atom, kept under 8 words per this task's own dictionary spec. */
  descriptor: string;
  placement: KillingPointPlacement;
  /** Which of the senior profile's relaxableAtPeak entries this specific killing point needs permission to bend. Empty when the killing point needs no relaxation at all (e.g. an instrumental solo). */
  relaxes: string[];
  /** Loose, case-insensitive substrings matched against a track's own GenrePack.eraTag (e.g. "1970s AM-gold soft rock" contains "1970s" and "soft rock"). Undefined/empty means this killing point fits any era. */
  fitsEraTags?: string[];
  /** TASK D2 §4-4 — kids-only: which age tier(s) this killing point is appropriate for. Undefined for every existing senior KILLING_POINTS entry (adult content has no age-tier concept). */
  eligibleKidsTiers?: KidsAgeTierId[];
  /**
   * 지시문 30 TASK C — undefined (또는 true) means listening-verified, same
   * status every existing KILLING_POINTS entry already has (하루's 20260808
   * 청취: "킬링포인트 옥타브 상승이 들린다"). `false` marks a genre-convention
   * judgment call with zero real listening passes yet — every entry in
   * data/killingPointsKr2030.ts/killingPointsJp2030.ts/killingPointsKpop.ts
   * (지시문 30 TASK C) sets this explicitly. Purely descriptive metadata —
   * nothing in the generation pipeline branches on it or blocks generation
   * because of it (§공통 규약 7 "실측 없이 blocking을 만들지 않는다").
   */
  verified?: boolean;
}

export const KILLING_POINTS: KillingPoint[] = [
  {
    id: 'KP-01',
    labelKo: '마지막 후렴 반음 전조',
    descriptor: 'final chorus lifts a semitone',
    placement: 'final-chorus',
    relaxes: ['predictable diatonic phrase structure'],
    fitsEraTags: ['1960s', '1970s', 'british beat', 'soft rock']
  },
  {
    id: 'KP-02',
    labelKo: '하모니 3성 스택',
    descriptor: 'three-part harmony on the last chorus',
    placement: 'final-chorus',
    relaxes: ['abrupt dynamic jumps'],
    fitsEraTags: ['europop', 'disco', '1970s', '1980s']
  },
  {
    id: 'KP-03',
    labelKo: '악기 솔로 8마디',
    descriptor: 'eight-bar instrumental solo after the second chorus',
    placement: 'mid-instrumental',
    relaxes: []
  },
  {
    id: 'KP-04',
    labelKo: '브레이크다운 — 반주 멈추고 목소리만',
    descriptor: 'instruments drop out in the bridge',
    placement: 'bridge',
    relaxes: ['abrupt dynamic jumps'],
    fitsEraTags: ['chanson', 'jazz', 'bossa', 'cafe']
  },
  {
    id: 'KP-05',
    labelKo: '롱톤 착지',
    descriptor: 'sustained lead note into the final chorus',
    placement: 'final-chorus',
    relaxes: ['comfortable mid vocal register'],
    fitsEraTags: ['soft rock', 'adult contemporary', '1970s']
  },
  {
    id: 'KP-06',
    labelKo: '무반주 2마디',
    descriptor: 'two unaccompanied bars before the last chorus',
    placement: 'pre-chorus',
    relaxes: ['abrupt dynamic jumps'],
    fitsEraTags: ['chanson', 'jazz', 'ballad', 'acoustic']
  },
  {
    id: 'KP-07',
    labelKo: '단조 벌스에서 장조 후렴 전환',
    descriptor: 'minor verse opening into a major final chorus',
    placement: 'final-chorus',
    relaxes: ['predictable diatonic phrase structure'],
    fitsEraTags: ['europop', 'disco', '1970s']
  },
  {
    id: 'KP-08',
    labelKo: '무반주 훅 반복',
    descriptor: 'hook repeated almost a cappella as the outro',
    placement: 'outro',
    relaxes: [],
    fitsEraTags: ['chanson', 'folk', 'acoustic']
  },
  {
    id: 'KP-09',
    labelKo: '낮은 음역 착지',
    descriptor: 'lead drops low into the hook',
    placement: 'final-chorus',
    relaxes: ['comfortable mid vocal register'],
    fitsEraTags: ['soft rock', 'adult contemporary']
  },
  {
    id: 'KP-10',
    labelKo: '차용 화음 한 번',
    descriptor: 'one borrowed chord colours the bridge',
    placement: 'bridge',
    relaxes: ['predictable diatonic phrase structure'],
    fitsEraTags: ['british beat', '1960s', 'singer-songwriter']
  },
  {
    id: 'KP-11',
    labelKo: '유니즌 재진입',
    descriptor: 'full ensemble unison on the final hook',
    placement: 'final-chorus',
    relaxes: ['abrupt dynamic jumps', 'arrangement leaves space between phrases'],
    fitsEraTags: ['europop', 'disco', 'motown']
  },
  {
    id: 'KP-12',
    labelKo: '오블리가토 응답',
    descriptor: 'solo instrument answers the vocal line',
    placement: 'mid-instrumental',
    relaxes: [],
    fitsEraTags: ['soft rock', 'adult contemporary', 'orchestral']
  }
];

// TASK v5.21 (TASK C-3) — "같은 킬링포인트 최대 4곡 (기존 3곡에서 완화 가능)".
// Raised from 3 -> 4 alongside STRUCTURAL_BIAS below (which already pulls
// KP-01 well under this ceiling in practice) — the higher ceiling only
// matters for the KPs the bias now favors (KP-02/03/05/08), giving them
// room to actually reach their higher weight instead of being capped at
// the same 3 as everything else.
const MAX_SONGS_PER_KILLING_POINT = 4;

/**
 * TASK v5.21 (TASK C-3) — "킬링포인트 사전 재조정": real measurement found
 * KP-01 ("final chorus lifts a semitone") plus this same "final chorus
 * key-up" language baked into the winterBallad money-chord preset
 * (data/moneyChords.ts) together produced a same-ending-formula pattern in
 * 11/18 (61%) of a real pack's tracks — see this task's own §3-1 for the
 * full measurement. This bias is the killing-point side of that fix: a
 * fixed, always-applied selection-weight multiplier (independent of and
 * combined with the rating-based KillingPointBoostMap below, never
 * replacing it) that lowers how often KP-01 wins ties in
 * assignKillingPoints' rotation, and raises KP-02 (harmony stack) / KP-03
 * (instrumental solo) / KP-05 (sustained landing) / KP-08 (a cappella
 * outro) — the four non-modulation "ending treatment" alternatives §3-2's
 * own distribution table names. Every killing point not listed here keeps
 * its neutral weight of 1 (no opinion), same as the rating-boost map's own
 * convention.
 */
// TASK v5.21 (TASK C-3, tuning follow-up) — a first pass also up-weighted
// KP-02/03/05/08 (§3-2's own named alternatives), but the ranking here is a
// strict numeric sort (not weighted random sampling), so ANY weight > 1 for
// those 4 ids ALWAYS wins ties against the other 8 (including KP-01)
// regardless of how small the margin is — measured: even a mild 1.1 still
// deterministically collapsed pack-wide variety to exactly those 4 ids,
// failing the PRE-EXISTING, separate design-gate "killing-point-variety"
// check (core/designGate.ts, ≥6 distinct ids expected in an 18-song pack —
// a real, independent diversity requirement this task must not regress per
// its own §9 "회귀 방지"). Down-weighting ONLY KP-01 (never up-weighting
// specific alternatives) instead spreads KP-01's lost ties across all 11
// OTHER killing points via the existing seeded rotation, which measurably
// reduces KP-01's own share (the actual complaint) without concentrating
// the freed-up selections into a new, equally narrow formula.
const STRUCTURAL_BIAS: KillingPointBoostMap = {
  'KP-01': 0.6
};

/**
 * 지시문 36 (TASK C-4) — v5.21의 STRUCTURAL_BIAS(KP-01 가중치 0.6)만으로는
 * 실측 전조 비중이 여전히 11/18까지 올라간다(§1, 20260810_001 실측 — KP-01/
 * KP-07 둘 다 "전조/장조 전환" 계열이고, 가중치를 낮추는 것만으로는 둘을
 * 합친 총량에 상한이 없었다). 이 상수는 KP-01+KP-07 둘을 합친 절대 상한이다
 * — 개별 MAX_SONGS_PER_KILLING_POINT(4)보다 낮은, 전조라는 "종류" 자체에
 * 거는 별도 캡. 5~6이라는 목표(§C-4 "11/18 → 5~6/18")는 추정치다(하루의
 * 청취 없이 정한 숫자) — 상한을 6으로 두어 목표 범위의 상단을 넘지 않게
 * 하되, 0으로는 절대 만들지 않는다(§ "하지 말 것: 전조를 0으로 만들지
 * 말 것" — 킬링포인트 자체가 하루가 청취 검증한 축이라 완전히 없애면 안
 * 된다).
 */
const MODULATION_KILLING_POINT_IDS = new Set(['KP-01', 'KP-07']);
const MAX_MODULATION_KILLING_POINTS = 6;

export function killingPointById(id: string): KillingPoint | undefined {
  return KILLING_POINTS.find(kp => kp.id === id);
}

export interface KillingPointAssignmentInput {
  /** Structurally identical to core/arcPlan.ts's PeakStrength — not imported, to keep data/ from depending on core/ (see this file's own layering note). */
  peakStrength: 'none' | 'subtle' | 'strong';
  /** GenrePack.eraTag of this track's own lead genre, when known. */
  eraTag?: string;
}

function candidatesFor(eraTag: string | undefined, pool: readonly KillingPoint[]): KillingPoint[] {
  if (!eraTag) return [...pool];
  const lower = eraTag.toLowerCase();
  const eraMatches = pool.filter(kp => kp.fitsEraTags?.some(tag => lower.includes(tag.toLowerCase())));
  const rest = pool.filter(kp => !eraMatches.includes(kp));
  // Era-fitting killing points first (spec 2-3's "eraTag로 매칭"), any
  // killing point with no fitsEraTags restriction (or no match) still
  // available as a fallback so a genre with no match never goes without a
  // killing point entirely — a low-quality-but-present choice beats none.
  return [...eraMatches, ...rest];
}

/** v3.68 (TASK E) — per-killing-point-id selection weight, 1 meaning "no opinion". */
export type KillingPointBoostMap = Record<string, number>;

const MAX_BOOST_MULTIPLIER = 2;
const MIN_BOOST_MULTIPLIER = 0.5;

/**
 * v3.68 (TASK E) — converts accumulated rating insights (core/ratingAnalysis.ts)
 * into a per-killing-point selection weight. Structurally typed (not
 * importing AttributeInsight) to keep data/ from depending on core/ — see
 * this file's own layering note on KillingPointAssignmentInput.peakStrength.
 *
 * Only 'strong'-confidence insights ever apply (this task's own "strong
 * 인사이트만 반영하십시오"); weak/moderate/insufficient never touch
 * generation. Positive lift raises weight up to MAX_BOOST_MULTIPLIER;
 * negative lift lowers it, floored at MIN_BOOST_MULTIPLIER — never 0 (this
 * task's own "0으로 만들지 마십시오"), so a disliked killing point stays
 * reachable rather than vanishing, which would make it impossible to ever
 * re-measure whether it's still actually disliked.
 */
export function killingPointBoostFromInsights(
  insights: readonly { attribute: string; value: string; lift: number; confidence: string }[] = []
): KillingPointBoostMap {
  const boost: KillingPointBoostMap = {};
  for (const insight of insights) {
    if (insight.attribute !== 'killingPointId' || insight.confidence !== 'strong') continue;
    boost[insight.value] = insight.lift >= 0
      ? Math.min(MAX_BOOST_MULTIPLIER, 1 + insight.lift * 2)
      : Math.max(MIN_BOOST_MULTIPLIER, 1 + insight.lift * 2);
  }
  return boost;
}

/**
 * One killing point per track (undefined for peakStrength 'none' — the
 * arc's own "4 completely calm tracks" requirement, see arcPlan.ts). Caps
 * any single killing point at MAX_SONGS_PER_KILLING_POINT across the whole
 * input list so an 18-song pack doesn't lean on the same "moment" 6 times
 * — this cap is what keeps TASK E's boost well under any 50% share
 * (MAX_SONGS_PER_KILLING_POINT / a typical ~14-eligible-track pool is
 * nowhere near half), regardless of how strong a boost is applied.
 * Deterministic for a given seed (mirrors this codebase's seeded-rotation
 * convention elsewhere) rather than random, so the same input always
 * assigns the same killing points.
 */
export function assignKillingPoints(
  inputs: readonly KillingPointAssignmentInput[],
  seed = 0,
  boost: KillingPointBoostMap = {},
  // TASK D2 §4-5 — optional set override so kids workspaces can draw from
  // KIDS_KILLING_POINTS (data/killingPointsKids.ts) instead of the senior
  // KILLING_POINTS array above, without adding a single entry to that array
  // or changing any existing call site's behavior when omitted.
  killingPointSet: readonly KillingPoint[] = KILLING_POINTS
): (KillingPoint | undefined)[] {
  const usage = new Map<string, number>();
  // 지시문 36 (TASK C-4) — MODULATION_KILLING_POINT_IDS(KP-01+KP-07) 둘을
  // 합친 러닝 카운트. usage 맵과 별개로 두는 이유: usage는 "이 id가 몇 번
  // 쓰였는가"이고 이건 "전조라는 종류가 몇 번 쓰였는가" — 서로 다른 축의
  // 캡이라 하나로 합치면 안 된다.
  let modulationCount = 0;
  return inputs.map((input, idx) => {
    if (input.peakStrength === 'none') return undefined;
    const candidates = candidatesFor(input.eraTag, killingPointSet);
    const offset = Math.abs(seed + idx * 97) % candidates.length;
    const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
    // v3.68 (TASK E) — a stable sort by boost weight (ties keep the
    // rotation's own order) lets a boosted killing point win ties more
    // often without ever bypassing the MAX_SONGS_PER_KILLING_POINT cap
    // above, and without ever fully excluding a down-weighted one.
    // v5.21 (TASK C-3) — STRUCTURAL_BIAS is always combined in (multiplied,
    // never replacing the rating-based boost), so this ranking pass always
    // runs now, not just when a caller happened to pass real rating
    // insights — the whole point is a real listening pass isn't required
    // for KP-01's over-selection to be corrected.
    const effectiveWeight = (id: string) => (STRUCTURAL_BIAS[id] ?? 1) * (boost[id] ?? 1);
    const ranked = [...rotated].sort((a, b) => effectiveWeight(b.id) - effectiveWeight(a.id));
    // 지시문 36 (TASK C-4) — usage 캡을 통과한 후보 중, 전조 캡이 이미 찬
    // 상태라면 비-전조 후보를 우선한다. 후보 전부가 전조뿐이면(비-전조 후보가
    // 이 era/usage 조합에서 하나도 없으면) 캡을 넘겨서라도 배정한다 — 완전히
    // 0으로 만들지 않는다는 것과 같은 이유로, 캡이 "무엇도 배정하지 않는다"로
    // 이어지면 안 된다.
    const usageOk = (kp: KillingPoint) => (usage.get(kp.id) ?? 0) < MAX_SONGS_PER_KILLING_POINT;
    const withinModulationCap = (kp: KillingPoint) => !MODULATION_KILLING_POINT_IDS.has(kp.id) || modulationCount < MAX_MODULATION_KILLING_POINTS;
    const chosen = ranked.find(kp => usageOk(kp) && withinModulationCap(kp))
      ?? ranked.find(kp => usageOk(kp))
      ?? rotated[0];
    usage.set(chosen.id, (usage.get(chosen.id) ?? 0) + 1);
    if (MODULATION_KILLING_POINT_IDS.has(chosen.id)) modulationCount += 1;
    return chosen;
  });
}
