/**
 * codex 지시문 04 — real gap confirmed by investigation across senior-oldpop
 * (letter/coffee/window/train/porch/diner), kr-2030 (phone/rain/subway/
 * cafe/rooftop/social-media), jp-2030 (convenience-store/train/rain/
 * riverbank/apartment/vending-machine), and both kr-idol workspaces (fire/
 * crown/run/mirror/night/spotlight; queen/diamond/shine/mirror/fire/
 * runway): NONE of these named subject/imagery groups map onto
 * data/motifFamilies.ts's own frameId-membership model (지시문 02 TASK C) —
 * they are lexical/imagery word groups that need to be found by scanning
 * actual scene/lyric TEXT, not by looking up a song's pre-assigned frameId.
 * This is a genuinely different quota mechanism, architecturally, from
 * motifFamilyCooldown.ts's frameId-based one — built once here as a real,
 * reusable engine every one of the 5 named workspace adapters instantiates
 * with its own real word list, rather than 5 independent copies of the same
 * "scan text, count distinct songs, cap at N" logic.
 */

export interface TextMotifFamily {
  id: string;
  labelKo: string;
  /** Real, literal keyword patterns — matched case-insensitively, word-boundary-scoped for Latin script (Korean/Japanese don't need \b — see matchesFamily's own handling). */
  patterns: RegExp[];
  maxPerPack: number;
}

export interface TextMotifFinding {
  familyId: string;
  labelKo: string;
  count: number;
  maxPerPack: number;
  trackNos: number[];
}

export interface TextMotifSong {
  trackNo: number;
  lyrics: string;
  /** Optional — a song's own scene/listenerSituation text often names the subject more directly than the lyric body itself (e.g. "an old letter after breakfast"). Included in the scan when present. */
  listenerSituation?: string;
}

function songMatchesFamily(song: TextMotifSong, family: TextMotifFamily): boolean {
  const haystack = `${song.listenerSituation ?? ''} ${song.lyrics}`;
  return family.patterns.some(pattern => pattern.test(haystack));
}

/**
 * One song counts AT MOST ONCE per family regardless of how many times/
 * where the keyword appears in that song — this is a "how many DIFFERENT
 * songs lean on this subject" quota (matches every named example's own
 * phrasing, e.g. "letter/mail 2" reads as "at most 2 songs about a
 * letter", not "the word letter appears at most twice").
 */
export function checkTextMotifQuotas(songs: TextMotifSong[], families: readonly TextMotifFamily[]): TextMotifFinding[] {
  const findings: TextMotifFinding[] = [];
  for (const family of families) {
    const matchingTrackNos = songs.filter(song => songMatchesFamily(song, family)).map(song => song.trackNo);
    if (matchingTrackNos.length > family.maxPerPack) {
      findings.push({ familyId: family.id, labelKo: family.labelKo, count: matchingTrackNos.length, maxPerPack: family.maxPerPack, trackNos: matchingTrackNos });
    }
  }
  return findings;
}

/**
 * codex 지시문 04 §1 — "사용자 콘셉트가 소재 자체인 경우 policy override를
 * 명시적으로 기록한다": real gap confirmed absent everywhere (no existing
 * concept-driven quota-exemption mechanism, only core/constraints.ts's own
 * unrelated breadthOverride/breadthSource provenance pair for era/breadth
 * detection). Mirrors that exact real precedent's shape (a source tag,
 * 'user' vs 'auto') rather than inventing a new provenance model: when the
 * user's own concept text names a family's own keyword, the quota is
 * still reported (never silently hidden — the pack may still be worth a
 * second look), but flagged with `overridden: true` and a real reason
 * instead of being reported as an unexplained policy violation.
 */
export interface TextMotifOverrideResult extends TextMotifFinding {
  overridden: boolean;
  overrideReasonKo?: string;
}

export function checkTextMotifQuotasWithConceptOverride(
  songs: TextMotifSong[],
  families: readonly TextMotifFamily[],
  conceptLabel: string | undefined
): TextMotifOverrideResult[] {
  const findings = checkTextMotifQuotas(songs, families);
  const conceptText = conceptLabel?.trim();
  return findings.map(finding => {
    const family = families.find(f => f.id === finding.familyId);
    const conceptNamesFamily = Boolean(conceptText && family?.patterns.some(pattern => pattern.test(conceptText)));
    return {
      ...finding,
      overridden: conceptNamesFamily,
      ...(conceptNamesFamily ? { overrideReasonKo: `사용자 콘셉트("${conceptText}")가 이 소재를 직접 지정 — 쿼터 초과가 정책 위반이 아니라 의도된 선택으로 기록됨` } : {})
    };
  });
}
