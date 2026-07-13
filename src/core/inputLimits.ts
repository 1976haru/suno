/**
 * TASK A2 (v3.6) — free-text fields that flow into the "essential" prompt
 * terms (see promptComposer.ts's ESSENTIAL_TERM_IDS) are never dropped by
 * composeStylePrompt's budget pass, so an unbounded vocalTone/customMoneyChord/
 * avoidWords/customConcept can only be kept in check by clamping the input
 * itself. quality.ts's enforcePromptLengthBudget is still the final backstop
 * on the assembled stylePrompt, but catching this at input time gives the
 * user a visible reason instead of a silently-trimmed output.
 */
export const INPUT_LIMITS = {
  vocalTone: 160,
  customMoneyChord: 100,
  avoidWords: 150,
  customConcept: 300
} as const;

export type InputLimitField = keyof typeof INPUT_LIMITS;

export function clampToLimit(field: InputLimitField, value: string): string {
  const limit = INPUT_LIMITS[field];
  return value.length > limit ? value.slice(0, limit) : value;
}

/**
 * TASK A2 (v3.6) — run on every pack load (see App.tsx's usePackLibrary
 * callback): a pack saved before INPUT_LIMITS existed, or edited outside
 * the app (import), can carry an over-limit free-text field. Returns the
 * clamped fields plus which ones were actually cut, so the caller can warn.
 */
export function clampOversizedFields<T extends Partial<Record<InputLimitField, string>>>(
  source: T
): { clamped: T; truncatedFields: InputLimitField[] } {
  const truncatedFields: InputLimitField[] = [];
  const clamped = { ...source };
  for (const field of Object.keys(INPUT_LIMITS) as InputLimitField[]) {
    const value = source[field];
    if (typeof value !== 'string') continue;
    if (value.length > INPUT_LIMITS[field]) {
      truncatedFields.push(field);
      (clamped as Record<InputLimitField, string>)[field] = clampToLimit(field, value);
    }
  }
  return { clamped, truncatedFields };
}
