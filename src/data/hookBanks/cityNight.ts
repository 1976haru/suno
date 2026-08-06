import type { HookVocabularyOverride } from '../hookParts';

/**
 * v5.17 (TASK C, isolation audit L4 fix) — `city-night` (senior-oldpop
 * workspace's own `city-night-drive` channel) targets audience
 * 'thirtiesForties' (see data/presets.ts's own `audience: 'thirtiesForties'`),
 * NOT the senior/oldpop cohort senior-morning's hook vocabulary is written
 * for. See hookBanks/modernChill.ts's own doc comment for the full
 * reasoning, including the verified nuance that this fixes a missing
 * explicit/auditable `case` — not an actual runtime vocabulary leak, since
 * seniorMorningOverride is itself `{}` and the old fallthrough resolved to
 * the exact same (shared default) vocabulary this file's own empty override
 * does.
 */
export const cityNightOverride: HookVocabularyOverride = {};
