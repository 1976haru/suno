/**
 * TASK v3.69 (TASK B) — one filename scheme shared by every artifact tied to
 * a single generated set (Claude Code bridge output, standalone Suno
 * Progress Mode export, SRT zip, rating export, thumbnail workset): before
 * this, each export built its own name independently (`songs-output.json`
 * always the same name — no history, overwritten every time; SRT zip named
 * from projectTitle alone) — see this task's own §0 problem statement.
 *
 * Deliberately its own module (not folded into utils/zipExporter.ts) since
 * `parseSetName` is a real inverse operation other code depends on (the
 * import screen recovers channel/date from a filename — see TASK C), not
 * just a one-way formatter.
 */

export interface SetNameParts {
  date: Date;
  channelLabel: string;
  conceptLabel: string;
  sequence?: number;
}

const MAX_CONCEPT_LENGTH = 20;

/**
 * Keeps only Unicode letters/numbers — deliberately stricter than
 * utils/zipExporter.ts's safeFileName (which only strips filesystem-illegal
 * characters like `/:*?"<>|` but leaves spaces/punctuation/underscores
 * alone). This scheme's own `_` separators must never be ambiguous with a
 * literal underscore *inside* a channel or concept label, so every
 * character that isn't a letter or digit (including spaces, hyphens, and
 * underscores themselves) is dropped rather than replaced.
 */
export function sanitizeLabel(label: string): string {
  return label.replace(/[^\p{L}\p{N}]/gu, '');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export function buildSetName(parts: SetNameParts): string {
  const datePart = formatDate(parts.date);
  const channelPart = sanitizeLabel(parts.channelLabel) || 'channel';
  const conceptPart = (sanitizeLabel(parts.conceptLabel) || 'set').slice(0, MAX_CONCEPT_LENGTH);
  const base = `${datePart}_${channelPart}_${conceptPart}`;
  return parts.sequence && parts.sequence > 1 ? `${base}_${pad2(parts.sequence)}` : base;
}

const DATE_TOKEN = /^(\d{4})(\d{2})(\d{2})$/;
const SEQUENCE_TOKEN = /^\d{2}$/;

/**
 * Inverse of buildSetName. Returns null for anything that doesn't start
 * with a YYYYMMDD token followed by at least a channel and concept segment
 * — including files that predate this scheme (e.g. plain "songs-output"),
 * so callers can fall back to their own pre-v3.69 behavior rather than
 * crash on an unparseable name.
 */
export function parseSetName(name: string): SetNameParts | null {
  const stripped = name.replace(/\.[^./\\]+$/, '');
  const segments = stripped.split('_').filter(Boolean);
  if (segments.length < 3) return null;
  const dateMatch = DATE_TOKEN.exec(segments[0]);
  if (!dateMatch) return null;
  const [, yearStr, monthStr, dayStr] = dateMatch;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  const last = segments[segments.length - 1];
  const hasSequence = segments.length >= 4 && SEQUENCE_TOKEN.test(last);
  const conceptEnd = hasSequence ? segments.length - 1 : segments.length;
  const channelLabel = segments[1];
  const conceptLabel = segments.slice(2, conceptEnd).join('_');
  if (!channelLabel || !conceptLabel) return null;

  return {
    date,
    channelLabel,
    conceptLabel,
    ...(hasSequence ? { sequence: Number(last) } : {})
  };
}
