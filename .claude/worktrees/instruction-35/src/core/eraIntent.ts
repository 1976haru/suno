/**
 * 지시문 10 (TASK A) — decade-level era intent: derived once from concept
 * text (reusing core/constraints.ts's existing extractEraConstraint/
 * decadeLabelForBucket — no new Korean-text parser), then used for two
 * DIFFERENT real checks that this task's own investigation found measure
 * two genuinely different things:
 *  - genre CANDIDATE exclusion (eligibleGenreIds) — which genre.eraTag
 *    buckets should even be considered at slot-preallocation time. Reuses
 *    ERA_BUCKET_BY_GENRE_ID (genre-data granularity).
 *  - stylePrompt TEXT claim checking (extractEraClaims/
 *    checkEraPromptAgainstIntent) — what the bridge LLM actually WROTE,
 *    independent of which genre was assigned. Real measurement found these
 *    diverge: a track assigned an eraTag='1970s' genre (e.g.
 *    oldpop-motown-pop-soul) can still honestly write "1960s" prose with
 *    zero "1970s" mention — genre-bucket classification alone
 *    (core/seniorOldpopPolicy.ts's existing checkSeniorEraShare) would
 *    misclassify that as "transition" even though the actual prose never
 *    claims the adjacent era at all.
 *
 * Thresholds are NOT reinvented here — SENIOR_ERA_POLICY
 * (core/seniorOldpopPolicy.ts) already carries the real, task-04-calibrated
 * 78/11/11 split; this module imports it rather than hardcoding a second
 * copy that could drift.
 */
import { eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { extractEraConstraint, decadeLabelForBucket, type EraIntentDecade } from './constraints';
import { SENIOR_ERA_POLICY } from './seniorOldpopPolicy';
import type { EraIntent } from '../types';

export type { EraIntentDecade };

/**
 * undefined exactly when the concept text has no era/decade signal at all
 * (extractEraConstraint's own era.unspecified) — callers must not force an
 * era in that case, same principle EraConstraint.unspecified already
 * documents (see this app's repeated "억지로 시대를 정하지 말 것").
 */
export function deriveEraIntent(freeText: string, artistReferenceEraTags: string[] = []): EraIntent | undefined {
  const era = extractEraConstraint(freeText, artistReferenceEraTags);
  if (era.unspecified) return undefined;

  const primary = decadeLabelForBucket(era.primary, freeText);

  if (era.coPrimary) {
    // Compound concept ("60~70년대") — both decades are co-equal primaries.
    // EraIntent's shape only has one primary + one secondary slot, so the
    // second co-primary decade rides in `secondary` with NO secondaryMaxShare
    // (undefined here is the signal "co-equal, not a capped transition
    // bucket" — see checkEraPromptAgainstIntent's own handling below).
    return {
      primary,
      secondary: decadeLabelForBucket(era.coPrimary, freeText),
      primaryMinShare: 0.4,
      transitionAllowed: true
    };
  }

  const secondaryBucket = era.adjacent[0]?.era;
  return {
    primary,
    secondary: secondaryBucket ? decadeLabelForBucket(secondaryBucket, freeText) : undefined,
    primaryMinShare: SENIOR_ERA_POLICY.singlePrimaryMin,
    secondaryMaxShare: secondaryBucket ? SENIOR_ERA_POLICY.transitionMax : undefined,
    transitionAllowed: Boolean(secondaryBucket)
  };
}

/**
 * 지시문 10 (TASK A-3) — hard candidate exclusion: a genre whose own
 * ERA_BUCKET_BY_GENRE_ID bucket is neither the intent's primary/secondary
 * decade's bucket nor 'timeless' (genuinely era-neutral by design) is
 * dropped from the candidate pool outright — never just soft-scored. Genres
 * with no era bucket at all (every non-oldpop genre) are always eligible;
 * this only ever narrows the oldpop-* family. `explorationGenreIds` is the
 * v5.23 exploration-slot exception (a track explicitly sanctioned to
 * deviate) — those ids stay eligible regardless of bucket.
 */
export function eraDeviantGenreIds(
  intent: EraIntent,
  genreIds: readonly string[],
  explorationGenreIds: ReadonlySet<string> = new Set()
): { eligible: string[]; excluded: string[] } {
  const REAL_BUCKETS: EraBucket[] = ['1950s-60s', '1970s', '1980s', '2000s'];
  const allowedBuckets = new Set<EraBucket>(
    REAL_BUCKETS.filter(bucket => decadeLabelForBucket(bucket, '') === intent.primary || decadeLabelForBucket(bucket, '') === intent.secondary)
  );
  allowedBuckets.add('timeless');

  const eligible: string[] = [];
  const excluded: string[] = [];
  for (const id of genreIds) {
    const bucket = eraBucketForGenreId(id);
    if (!bucket || allowedBuckets.has(bucket) || explorationGenreIds.has(id)) {
      eligible.push(id);
    } else {
      excluded.push(id);
    }
  }
  return { eligible, excluded };
}

const DECADE_CLAIM_PATTERN = /19[5-9]0s|20[0-2]0s/g;

/** All decades literally named in this stylePrompt's own prose — order of first appearance, deduped. Never infers from genre/BPM/instrumentation, only what the text itself says. */
export function extractEraClaims(stylePrompt: string): EraIntentDecade[] {
  const found = new Set<EraIntentDecade>();
  for (const match of stylePrompt.match(DECADE_CLAIM_PATTERN) ?? []) {
    found.add(match as EraIntentDecade);
  }
  return [...found];
}

export interface EraPromptCheckResult {
  primaryShare: number;
  transitionShare: number;
  otherEraPureShare: number;
  primaryBelowTarget: boolean;
  transitionOverTarget: boolean;
  otherEraPureOverTarget: boolean;
  /** trackNos of a non-exploration track whose stylePrompt claims ONLY a non-primary/non-secondary decade — each is its own blocking finding, same convention core/seniorOldpopPolicy.ts's checkSeniorEraShare already established for its genre-bucket counterpart. */
  blockingOtherEraPureTrackNos: number[];
}

/**
 * 지시문 10 (TASK A-4) — the prose-claim counterpart to
 * core/seniorOldpopPolicy.ts's checkSeniorEraShare (which classifies by
 * ASSIGNED GENRE bucket). This classifies by what the stylePrompt TEXT
 * itself claims: no decade mention at all -> unclassified (never penalized —
 * a genuinely timeless prompt honestly claims nothing); claims include
 * primary but no non-primary/non-secondary decade -> primary; claims include
 * BOTH primary and secondary -> transition; claims a decade that is neither
 * primary nor secondary, OR claims secondary alone with no primary mention
 * at all -> other-era-pure.
 */
export function checkEraPromptAgainstIntent(
  songs: readonly { trackNo: number; stylePrompt: string }[],
  intent: EraIntent,
  explorationTrackNos: ReadonlySet<number> = new Set()
): EraPromptCheckResult {
  const explorationSet = explorationTrackNos;
  let primary = 0;
  let transition = 0;
  let otherPure = 0;
  const blockingOtherEraPureTrackNos: number[] = [];
  let classified = 0;

  for (const song of songs) {
    const claims = extractEraClaims(song.stylePrompt);
    if (!claims.length) continue; // no claim at all — not counted against any share, matches the honest-ambiguity treatment 'timeless' genres already get
    classified++;
    const claimsPrimary = claims.includes(intent.primary);
    const claimsSecondary = intent.secondary ? claims.includes(intent.secondary) : false;
    const claimsOther = claims.some(c => c !== intent.primary && c !== intent.secondary);

    if (claimsPrimary && claimsSecondary) {
      transition++;
    } else if (claimsPrimary && !claimsOther) {
      primary++;
    } else {
      // other-era-pure: claims something other than primary alone (secondary
      // alone with no primary counts here too — see this function's own doc
      // comment).
      otherPure++;
      if (!explorationSet.has(song.trackNo)) blockingOtherEraPureTrackNos.push(song.trackNo);
    }
  }

  const total = songs.length || 1;
  const primaryShare = primary / total;
  const transitionShare = transition / total;
  const otherEraPureShare = otherPure / total;

  return {
    primaryShare,
    transitionShare,
    otherEraPureShare,
    // classified === 0 means no song made any explicit era claim at all —
    // never fails a pack for silence (matches this file's own no-claim
    // handling above); only a real, explicit off-target claim counts.
    primaryBelowTarget: classified > 0 && primaryShare < intent.primaryMinShare,
    transitionOverTarget: intent.secondaryMaxShare !== undefined && transitionShare > intent.secondaryMaxShare,
    otherEraPureOverTarget: intent.secondaryMaxShare !== undefined && otherEraPureShare > SENIOR_ERA_POLICY.otherEraPureMax,
    blockingOtherEraPureTrackNos
  };
}
