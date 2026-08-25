/**
 * v3.79 (TASK D) — 하루님's own request: "음원분석도 데이터잖아. 좀 체계적으로
 * 관리(연번 코드 같은 거 붙여서)해서 엑셀 등으로 출력도 하면 좋을 것 같아."
 * A stable, dense identifier scheme layered on top of (never replacing)
 * utils/setNaming.ts's existing human-readable setName:
 *
 *   Set code    S20260802-01          date + that day's sequence number
 *   Song code   S20260802-01-T07      set code + track number
 *   Take code   S20260802-01-T07-A    + version letter (mirrors AudioTake.versionLabel)
 *
 * Deliberately its own tiny module (not folded into utils/setNaming.ts) —
 * this task's own explicit instruction is to never change what
 * buildSetName/parseSetName currently return, so the new scheme lives
 * alongside it rather than inside it.
 */

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** YYYYMMDD, using the date's LOCAL calendar fields (same convention as utils/setNaming.ts's formatDate) — never UTC, so a set generated late at night stays on the day the user actually experienced. */
export function formatSetDateCode(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export function buildSetCode(date: Date, sequence: number): string {
  return `S${formatSetDateCode(date)}-${pad2(sequence)}`;
}

export function buildSongCode(setCode: string, trackNo: number): string {
  return `${setCode}-T${pad2(trackNo)}`;
}

/** `versionLabel` is used as-is (already a bare letter like "A"/"B" — see AudioTake.versionLabel), never re-derived. */
export function buildTakeCode(songCode: string, versionLabel: string): string {
  return `${songCode}-${versionLabel}`;
}

const SET_CODE_PATTERN = /^S(\d{8})-(\d{2})$/;

export interface ParsedSetCode {
  dateCode: string;
  sequence: number;
}

/** Inverse of buildSetCode. Returns null for anything not in this exact shape — including every set code-less pack from before this task, so callers can treat "no code" and "malformed code" the same way. */
export function parseSetCode(code: string | undefined | null): ParsedSetCode | null {
  if (!code) return null;
  const match = SET_CODE_PATTERN.exec(code);
  if (!match) return null;
  return { dateCode: match[1], sequence: Number(match[2]) };
}

/**
 * "the Nth set generated/saved that same calendar day" — the simplest
 * correct derivation per this task's own instruction: count how many of the
 * caller's already-known set codes share today's date segment, then add one.
 * No separate counter store; the caller (core/library.ts's savePack) is
 * expected to pass in every existing pack's setCode it already has cheap
 * access to (listPacks()' meta-only read), scoped to whichever workspace the
 * new set is being saved into.
 */
export function nextDailySetSequence(date: Date, existingSetCodes: readonly (string | undefined | null)[]): number {
  const dateCode = formatSetDateCode(date);
  const matching = existingSetCodes.filter(code => parseSetCode(code ?? undefined)?.dateCode === dateCode);
  return matching.length + 1;
}

export function assignSetCode(date: Date, existingSetCodes: readonly (string | undefined | null)[]): string {
  return buildSetCode(date, nextDailySetSequence(date, existingSetCodes));
}
