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
export type KillingPointPlacement = 'final-chorus' | 'bridge' | 'mid-instrumental' | 'pre-chorus' | 'outro';

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
    descriptor: 'backing harmony stacks to three parts on the last chorus',
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
    descriptor: 'instruments drop out leaving the voice alone in the bridge',
    placement: 'bridge',
    relaxes: ['abrupt dynamic jumps'],
    fitsEraTags: ['chanson', 'jazz', 'bossa', 'cafe']
  },
  {
    id: 'KP-05',
    labelKo: '롱톤 착지',
    descriptor: 'lead holds one long sustained note entering the final chorus',
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
    descriptor: 'lead drops to a low chest-register line landing the hook',
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
    descriptor: 'full ensemble re-enters in unison on the final hook',
    placement: 'final-chorus',
    relaxes: ['abrupt dynamic jumps', 'arrangement leaves space between phrases'],
    fitsEraTags: ['europop', 'disco', 'motown']
  },
  {
    id: 'KP-12',
    labelKo: '오블리가토 응답',
    descriptor: 'a solo instrument answers each vocal line after the second verse',
    placement: 'mid-instrumental',
    relaxes: [],
    fitsEraTags: ['soft rock', 'adult contemporary', 'orchestral']
  }
];

const MAX_SONGS_PER_KILLING_POINT = 3;

export function killingPointById(id: string): KillingPoint | undefined {
  return KILLING_POINTS.find(kp => kp.id === id);
}

export interface KillingPointAssignmentInput {
  /** Structurally identical to core/arcPlan.ts's PeakStrength — not imported, to keep data/ from depending on core/ (see this file's own layering note). */
  peakStrength: 'none' | 'subtle' | 'strong';
  /** GenrePack.eraTag of this track's own lead genre, when known. */
  eraTag?: string;
}

function candidatesFor(eraTag: string | undefined): KillingPoint[] {
  if (!eraTag) return KILLING_POINTS;
  const lower = eraTag.toLowerCase();
  const eraMatches = KILLING_POINTS.filter(kp => kp.fitsEraTags?.some(tag => lower.includes(tag.toLowerCase())));
  const rest = KILLING_POINTS.filter(kp => !eraMatches.includes(kp));
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
  boost: KillingPointBoostMap = {}
): (KillingPoint | undefined)[] {
  const usage = new Map<string, number>();
  return inputs.map((input, idx) => {
    if (input.peakStrength === 'none') return undefined;
    const candidates = candidatesFor(input.eraTag);
    const offset = Math.abs(seed + idx * 97) % candidates.length;
    const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
    // v3.68 (TASK E) — a stable sort by boost weight (ties keep the
    // rotation's own order) lets a boosted killing point win ties more
    // often without ever bypassing the MAX_SONGS_PER_KILLING_POINT cap
    // above, and without ever fully excluding a down-weighted one.
    const ranked = Object.keys(boost).length ? [...rotated].sort((a, b) => (boost[b.id] ?? 1) - (boost[a.id] ?? 1)) : rotated;
    const chosen = ranked.find(kp => (usage.get(kp.id) ?? 0) < MAX_SONGS_PER_KILLING_POINT) ?? rotated[0];
    usage.set(chosen.id, (usage.get(chosen.id) ?? 0) + 1);
    return chosen;
  });
}
