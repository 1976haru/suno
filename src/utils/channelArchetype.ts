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
