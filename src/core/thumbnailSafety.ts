export const REQUIRED_THUMBNAIL_NEGATIVE_TERMS = [
  'no text',
  'no logo',
  'no watermark',
  'no identifiable person',
  'no celebrity',
  'no film character'
] as const;

export const FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS: RegExp[] = [
  /\bin the style of\b/i,
  /\bsame composition as\b/i,
  /\bcopy (the )?pose\b/i,
  /\bfrom the movie\b/i,
  /\bmovie scene from\b/i,
  /\bfilm still from\b/i,
  /\bscreenshot from\b/i,
  /\bas seen in\b/i,
  /\bknown creator style\b/i,
  /\byoutube channel\b/i,
  /\b(disney|pixar|marvel|netflix|hbo|ghibli|a24)\b/i,
  /\b(miyazaki|nolan|spielberg|tarantino|kubrick|wes anderson)\b/i,
  /\b(tom hanks|leonardo dicaprio|scarlett johansson|meryl streep)\b/i,
  /시소웨이브/i
];

export function normalizeThumbnailClause(clause: string): string {
  return clause.trim().replace(/\s+/g, ' ');
}

export function uniqueThumbnailClauses(clauses: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const clause of clauses.map(normalizeThumbnailClause).filter(Boolean)) {
    const key = clause.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clause);
  }
  return result;
}

/**
 * TASK v3.38 Part B5 — a brand/studio name appearing *inside* a "Negative: ...
 * no Disney-style character ..." clause is the safe direction (explicitly
 * banning it, as the kids archetypes' forbiddenElements now do), not the
 * unsafe one FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS exists to catch (a
 * *positive* reference like "in the style of Disney"). Strips the Negative
 * clause's own extent (up to its terminating period, or end of string if
 * none) before running that scan, so a legitimate ban never self-flags.
 */
function stripNegativeClause(prompt: string): string {
  return prompt.replace(/Negative:[^.]*\.?/gi, '');
}

export function thumbnailPromptSafetyIssues(prompt: string): string[] {
  const issues: string[] = [];
  const lower = prompt.toLowerCase();
  for (const required of REQUIRED_THUMBNAIL_NEGATIVE_TERMS) {
    if (!lower.includes(required)) issues.push(`missing required negative term: ${required}`);
  }
  const promptWithoutNegativeClause = stripNegativeClause(prompt);
  for (const pattern of FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS) {
    if (pattern.test(promptWithoutNegativeClause)) issues.push(`forbidden direct-reference pattern: ${pattern.source}`);
  }
  return issues;
}

export function isThumbnailPromptSafe(prompt: string): boolean {
  return thumbnailPromptSafetyIssues(prompt).length === 0;
}
