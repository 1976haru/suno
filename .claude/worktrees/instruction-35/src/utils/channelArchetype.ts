/**
 * TASK D1 §3-2 (Approach A, per user decision) — every one of the 55
 * `archetype === 'kids'` / `archetype !== 'kids'` runtime branches measured
 * across the codebase now goes through this helper instead, so 'kids',
 * 'kr-kids-song', and 'jp-kids-song' all take the same kids-safe code path.
 * The senior workspace's little-singalong-radio channel (archetype: 'kids')
 * is unaffected — isKidsArchetype('kids') === true, same as the old
 * `=== 'kids'` check.
 *
 * Typed as `string | undefined` (not `ChannelArchetype | undefined`) since
 * a few call sites (data/moneyChords.ts) already type their own archetype
 * param as a plain string — ChannelArchetype is a subtype of string, so
 * every other call site's typed value still passes through unaffected.
 */
export function isKidsArchetype(archetype: string | undefined): boolean {
  return archetype === 'kids' || archetype === 'kr-kids-song' || archetype === 'jp-kids-song';
}

/**
 * TASK: Step1 archetype cards filtered by workspace — Step1Channel.tsx's
 * archetypeChoices grid used to render every archetype from every
 * workspace unconditionally, so a user in e.g. kr-kids saw senior-oldpop's
 * 10+ cards too, and could pick one that useChannelManager's saveEditorProfile
 * (v5.9 TASK §3) would then reject at save time with no warning until then.
 * Pure so it's testable without mounting the component (this codebase's
 * tests are vitest logic-level, not DOM-rendering — see
 * tests/channelDraftWorkspaceScope.test.ts's own presetsForWorkspace/
 * findArchetypeMismatches tests for the same pattern this mirrors). Generic
 * over the choice shape so Step1Channel.tsx's own richer archetypeChoices
 * item type (label/description/vocal/moods/market/audience/primaryLanguage)
 * doesn't need to be duplicated or imported here.
 */
export function partitionArchetypeChoicesByWorkspace<T extends { id: string }>(
  choices: T[],
  workspaceArchetypeIds: string[]
): { inWorkspace: T[]; other: T[] } {
  const allowed = new Set(workspaceArchetypeIds);
  const inWorkspace: T[] = [];
  const other: T[] = [];
  for (const choice of choices) {
    (allowed.has(choice.id) ? inWorkspace : other).push(choice);
  }
  return { inWorkspace, other };
}
