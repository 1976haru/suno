import type { HookVocabularyOverride } from '../hookParts';

/**
 * v5.17 (TASK C, isolation audit L4 fix) — `modern-chill` (senior-oldpop
 * workspace's own `chill-hours` channel) targets audience 'twenties' (see
 * data/presets.ts's own `audience: 'twenties'`), NOT the senior/oldpop
 * cohort senior-morning's hook vocabulary is written for — unlike
 * `oldpop-lounge` (audience 'seniors', see utils/channelProfile.ts's own
 * ARCHETYPE_AUDIENCE map), which legitimately reuses seniorMorningOverride
 * (hookBanks/index.ts's own documented case).
 *
 * Before this file existed, `modern-chill` had no `case` in
 * hookBanks/index.ts's switch, so it silently fell through to `default`
 * (seniorMorningOverride). Important nuance, verified rather than assumed:
 * seniorMorningOverride is ITSELF `{}` (see seniorMorning.ts's own doc
 * comment — the shared data/hookParts.ts defaultHookParts bank was written
 * WITH senior-morning in mind, so there was "nothing to override" there),
 * so the OLD fallthrough and this file's own empty override resolve to the
 * exact same runtime vocabulary (resolveHookParts's `{...defaultHookParts,
 * ...{}}`) — there was never a live word-for-word leak to fix here. What
 * this file fixes is the missing explicit, auditable `case` itself: without
 * one, "genuinely not-yet-built" and "accidentally forgotten" were
 * indistinguishable by inspection, which is what tripped
 * `npm run audit:isolation`'s L4 check. Deliberately left empty rather than
 * fabricated placeholder vocabulary — real chill/twenties-audience hook
 * phrasing is separate content-authoring work (same "Deferred" shape as
 * hookBanks/christmas.ts). See scripts/isolationAudit.ts's
 * L4_INTENTIONAL_SENIOR_MATCH for why this still needs an explicit registry
 * entry even though the override is empty (that check treats "empty" as
 * "identical to senior" by construction — see its own comment there).
 */
export const modernChillOverride: HookVocabularyOverride = {};
