import type { SongIdea } from '../types';
import { extractEraConstraint, type EraConstraint } from './constraints';
import { eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { parseLyricsSections } from './lyricsAst';
import { STRUCTURE_TEMPLATE_MARKER_TAG } from './lyricEngine';
import { checkTextMotifQuotasWithConceptOverride, type TextMotifFamily, type TextMotifOverrideResult } from './textMotifQuota';

/**
 * codex 지시문 04 (§1) — real, dedicated senior-oldpop policy adapter. Per
 * this document's own "전용 규칙을 공통 파일에 흩뿌리지 않는다" instruction,
 * every senior-specific number/check lives here, not scattered into
 * data/eraPolicy.ts/core/compositionScorer.ts/etc. Investigation confirmed
 * every one of this section's own named checks was either fully absent or,
 * for 2 of them (final key-up count, intro-type variety), already
 * explicitly documented as `not-measured`/`notImplemented: true` in
 * core/releaseReadiness.ts's own honest gap list — this module is what
 * fills those two real, previously-acknowledged gaps, plus the 4 other
 * genuinely new checks this section asks for.
 */

// ---------------------------------------------------------------------------
// Era policy — single-era 78/11/11 split
// ---------------------------------------------------------------------------

/**
 * codex 지시문 04 (§1) — a real, SENIOR-SPECIFIC tightening layered
 * alongside (never replacing) data/eraPolicy.ts's own shared ERA_POLICY
 * (singlePrimaryMin: 0.5) — that shared number stays exactly as-is for
 * every consumer (core/designGate.ts, core/compositionScorer.ts,
 * core/constraints.ts's applyEraQuota, all workspace-agnostic). This is a
 * NEW, senior-only 3-way share breakdown (confirmed by investigation to
 * not exist in any form today): primary (matches the concept's own
 * era.primary/coPrimary), transition (era.adjacent — genres one decade
 * over, or genuinely 'timeless' genres designed to blend with any era),
 * other-era-pure (era.forbidden — a genuinely wrong-decade genre, no
 * adjacency excuse).
 */
export const SENIOR_ERA_POLICY = {
  singlePrimaryMin: 0.78,
  transitionMax: 0.11,
  otherEraPureMax: 0.11
};

/**
 * 지시문 08 (TASK E) — real, measured calibration gap: core/constraints.ts's
 * applyEraQuota (called from core/setDirector.ts, generation-time) used a
 * fixed 25% adjacent-era cap for every workspace — this file's own
 * SENIOR_ERA_POLICY.transitionMax (11%) was deliberately kept audit-only,
 * per this section's own original doc comment above ("layered ALONGSIDE,
 * never replacing... that shared number stays exactly as-is for every
 * consumer, ... applyEraQuota, all workspace-agnostic"). Real generation
 * measurement (a real 18-song "비틀즈 느낌의 밝은 60년대 팝" pack) confirmed
 * why that gap matters: oldpop-yacht-west-coast (eraTag '1970s') landed
 * exactly 4/18 songs (22%) — legal under applyEraQuota's own 25% cap, but
 * already a real fail under core/releaseReadiness.ts's checkSeniorEraShare
 * (지시문 08 TASK C wiring), which enforces the tighter 11% transitionMax.
 * Generation and audit disagreeing about the real threshold means the
 * audit can never pass for a real senior-oldpop pack no matter how many
 * times it's regenerated. This function closes that gap for senior-morning
 * specifically (every other archetype's applyEraQuota call is unaffected)
 * — called from core/setDirector.ts right before applyEraQuota, narrowing
 * (never widening) each adjacent bucket's own maxShare to the smaller of
 * its original value and SENIOR_ERA_POLICY.transitionMax.
 *
 * `songCount` is threaded through for a real, measured reason:
 * core/constraints.ts's applyEraQuota computes each cap as
 * `Math.floor(songCount * maxShare)` with no singleton-avoidance of its
 * own — at songCount=18, floor(18 * 0.11) is exactly 1, and real
 * measurement (tests/genreSingletonRootCause.test.ts, an existing,
 * unrelated regression guard) caught the result: a real 18-song pack
 * landed a genre at count 1, a singleton this codebase's own diversity
 * rules never allow (a genre appears 0 times or 2+, never exactly once).
 * When the tightened cap would land on exactly 1, this rounds UP to 2
 * rather than down to 0 — real measurement of the DOWN-to-0 alternative
 * (this function's own first attempt) found it can starve the pack below
 * songCount entirely: a primary-era-only bucket whose real genre pool is
 * itself capacity-limited (e.g. the 1980s family: 3 genres x
 * GENRE_ERA_QUOTA_PER_GENRE_CAP each = 15 max for an 18-song pack) relies
 * on SOME adjacent-era overflow to reach songCount at all — a real
 * "80년대 초반 어덜트 컨템포러리 발라드" pack landed only 15/18 songs once
 * the adjacent bucket was zeroed. 2 is the smallest singleton-safe,
 * count-preserving floor.
 */
export function tightenEraConstraintForSenior(era: EraConstraint, archetype: string | undefined, songCount: number): EraConstraint {
  if (archetype !== 'senior-morning' || !era.adjacent.length || songCount < 2) return era;
  return {
    ...era,
    adjacent: era.adjacent.map(a => {
      const maxShare = Math.min(a.maxShare, SENIOR_ERA_POLICY.transitionMax);
      // 3.5 (not a smaller floor like 2) / songCount — real measurement
      // found 2 still wasn't enough headroom for every concept: the 1980s
      // genre family only has 3 real genres for this channel, each capped
      // at GENRE_ERA_QUOTA_PER_GENRE_CAP, so its own primary-bucket
      // capacity ceiling (15) falls 3 short of an 18-song pack on its own
      // — trimming its 1970s-adjacent overflow down to 2 (instead of the
      // 3 actually needed to reach songCount) silently shipped a 17-song
      // pack. 3.5 covers that real shortfall with one song of headroom;
      // any concept whose primary bucket doesn't need the overflow simply
      // has it trimmed right back down again by trimBucket's own normal
      // over-quota check, so this never forces extra adjacent-era songs
      // onto a concept that didn't need them.
      return { ...a, maxShare: Math.floor(songCount * maxShare) === 1 ? 3.5 / songCount : maxShare };
    })
  };
}

export interface SeniorEraShareResult {
  primaryShare: number;
  transitionShare: number;
  otherEraPureShare: number;
  primaryBelowTarget: boolean;
  transitionOverTarget: boolean;
  otherEraPureOverTarget: boolean;
  /** trackNos of a non-exploration other-era-pure track — each one is its own hard block per this task's own explicit "non-exploration other-era pure track = blocking". */
  blockingOtherEraPureTrackNos: number[];
}

function classifyEraMembership(bucket: EraBucket | null, era: EraConstraint): 'primary' | 'transition' | 'other-pure' | 'unclassified' {
  if (!bucket) return 'unclassified';
  if (bucket === era.primary || bucket === era.coPrimary) return 'primary';
  if (bucket === 'timeless' || era.adjacent.some(a => a.era === bucket)) return 'transition';
  if (era.forbidden.includes(bucket)) return 'other-pure';
  return 'unclassified';
}

export function checkSeniorEraShare(
  songs: Pick<SongIdea, 'trackNo' | 'genreId'>[],
  conceptLabel: string,
  explorationTrackNos: readonly number[] = []
): SeniorEraShareResult | undefined {
  const era = extractEraConstraint(conceptLabel);
  if (era.unspecified || !songs.length) return undefined;
  const explorationSet = new Set(explorationTrackNos);
  let primary = 0;
  let transition = 0;
  let otherPure = 0;
  const blockingOtherEraPureTrackNos: number[] = [];
  for (const song of songs) {
    const bucket = eraBucketForGenreId(song.genreId);
    const membership = classifyEraMembership(bucket, era);
    if (membership === 'primary') primary++;
    else if (membership === 'transition') transition++;
    else if (membership === 'other-pure') {
      otherPure++;
      if (!explorationSet.has(song.trackNo)) blockingOtherEraPureTrackNos.push(song.trackNo);
    }
  }
  const total = songs.length;
  const primaryShare = primary / total;
  const transitionShare = transition / total;
  const otherEraPureShare = otherPure / total;
  return {
    primaryShare,
    transitionShare,
    otherEraPureShare,
    primaryBelowTarget: primaryShare < SENIOR_ERA_POLICY.singlePrimaryMin,
    transitionOverTarget: transitionShare > SENIOR_ERA_POLICY.transitionMax,
    otherEraPureOverTarget: otherEraPureShare > SENIOR_ERA_POLICY.otherEraPureMax,
    blockingOtherEraPureTrackNos
  };
}

// ---------------------------------------------------------------------------
// Motif sub-quotas — letter/coffee/window/train/porch/diner
// ---------------------------------------------------------------------------

/**
 * codex 지시문 04 (§1) — real, fine-grained senior subject caps.
 * Investigation confirmed data/motifFamilies.ts's own 'romantic-connection'
 * family already includes the real 'letter-sending' frameId, but only at
 * a coarse maxPerPack: 4 shared across 9 unrelated aliases — nowhere near
 * this task's own explicit "letter/mail <= 2" granularity. Built on
 * core/textMotifQuota.ts's new text-scanning engine (scene text + lyrics),
 * not frameId lookup, since a fine per-subject cap needs to see the actual
 * scene content, not just which of 9 aliases a song's frameId happens to be.
 */
export const SENIOR_MOTIF_QUOTAS: TextMotifFamily[] = [
  { id: 'letter-mail', labelKo: 'letter/mail', patterns: [/\bletters?\b/i, /\bmail\b/i, /\bpostcards?\b/i], maxPerPack: 2 },
  { id: 'coffee-breakfast', labelKo: 'coffee/breakfast', patterns: [/\bcoffee\b/i, /\bbreakfast\b/i], maxPerPack: 2 },
  { id: 'window-light', labelKo: 'window/light', patterns: [/\bwindow(s)?\b/i, /\bmorning light\b/i, /\bsunlight\b/i], maxPerPack: 2 },
  { id: 'train-platform', labelKo: 'train/platform', patterns: [/\btrain\b/i, /\bplatform\b/i], maxPerPack: 1 },
  { id: 'porch-courtship', labelKo: 'porch courtship', patterns: [/\bporch\b/i], maxPerPack: 1 },
  { id: 'diner-friends', labelKo: 'diner friends', patterns: [/\bdiner\b/i], maxPerPack: 1 }
];

export function checkSeniorMotifQuotas(
  songs: { trackNo: number; lyrics: string; listenerSituation?: string }[],
  conceptLabel?: string
): TextMotifOverrideResult[] {
  return checkTextMotifQuotasWithConceptOverride(songs, SENIOR_MOTIF_QUOTAS, conceptLabel);
}

// ---------------------------------------------------------------------------
// Music — final key-up count, intro-type diversity, chord-progression dominance
// ---------------------------------------------------------------------------

export const SENIOR_MUSIC_POLICY = {
  maxFinalKeyUp: 6,
  minIntroTypeVariety: 4,
  maxSingleProgressionShare: 0.55
};

/**
 * codex 지시문 04 (§1) — fills core/releaseReadiness.ts's own real,
 * previously-acknowledged gap ("modulation-count", `notImplemented: true`).
 * Real signal: core/lyricEngine.ts's own STRUCTURE_TEMPLATE_MARKER_TAG.T3
 * is literally `'[key-lift final chorus]'` — T3 IS this app's own "final
 * key-up" structure template (see bpmLengthControl.ts's own TEMPLATE_BARS
 * comment: "... + key-lift-final-chorus8"). Counts real LYRICS text
 * containing that marker (not just the PLANNED structureTemplate field),
 * matching this codebase's own established "check what was actually
 * written, not just what was planned" precedent (core/batchPreallocation.ts's
 * own structureWarning).
 */
export function countFinalKeyUps(songs: { lyrics: string }[]): number {
  const marker = STRUCTURE_TEMPLATE_MARKER_TAG.T3!;
  return songs.filter(song => song.lyrics.includes(marker)).length;
}

/**
 * codex 지시문 04 (§1) — fills core/releaseReadiness.ts's own real,
 * previously-acknowledged gap ("intro-type-variety", `notImplemented: true`).
 * Real signal: core/lyricsAst.ts's own parseLyricsSections (지시문 03
 * TASK E) — the FIRST section of the song (positionally, not by `type`
 * classification): T2/T4/T5's own real intro markers ("[hook intro]",
 * "[instrumental hook]", "[a cappella hook]") don't all contain the
 * literal word "intro", so lyricsAst.ts's general-purpose keyword
 * classifier bins them as 'intro'/'instrumental'/'other' respectively —
 * real intro-type variety is a POSITIONAL concept (whatever section opens
 * the song), not that classifier's own content-based `type` field, which
 * exists for a different purpose (distinguishing verse/chorus/bridge
 * throughout the WHOLE song, not just tagging the opener).
 */
export function countDistinctIntroTypes(songs: { lyrics: string }[]): number {
  const introTags = new Set<string>();
  for (const song of songs) {
    const sections = parseLyricsSections(song.lyrics);
    const opener = sections[0];
    if (opener) introTags.add(opener.rawTag.trim().toLowerCase());
  }
  return introTags.size;
}

export interface ChordProgressionDominanceResult {
  dominantId: string;
  share: number;
  overCap: boolean;
}

/**
 * codex 지시문 04 (§1) — real gap: no existing check caps a single
 * moneyChord progression's share of a WHOLE PACK regardless of whether it
 * was the user's own explicit pick (core/moneyChordPlan.ts's own 55%
 * number is a different mechanism — a TARGET floor/range specifically for
 * an explicitly-chosen progression, gated by usesUserChosenProgressionPlan
 * — not a general dominance ceiling). Uses SongIdea.effectiveMoneyChordId
 * (always-populated per-song field, v5.11 TASK L) since that's the real
 * "what actually got used," not just what a slot planned.
 */
export function checkChordProgressionDominance(songs: Pick<SongIdea, 'effectiveMoneyChordId'>[]): ChordProgressionDominanceResult | undefined {
  if (!songs.length) return undefined;
  const counts = new Map<string, number>();
  for (const song of songs) {
    if (!song.effectiveMoneyChordId) continue;
    counts.set(song.effectiveMoneyChordId, (counts.get(song.effectiveMoneyChordId) ?? 0) + 1);
  }
  let dominantId = '';
  let dominantCount = 0;
  for (const [id, count] of counts) {
    if (count > dominantCount) { dominantId = id; dominantCount = count; }
  }
  if (!dominantId) return undefined;
  const share = dominantCount / songs.length;
  return { dominantId, share, overCap: share > SENIOR_MUSIC_POLICY.maxSingleProgressionShare };
}
