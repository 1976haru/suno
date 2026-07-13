import type { HookVocabularyOverride } from '../hookParts';

/**
 * Deferred per the v3.4 spec's explicit instruction to build senior-morning
 * and showa-cafe first (the two channels actually in production) rather
 * than filling out all 5 archetypes from scratch. Christmas content is
 * already covered elsewhere by the season-pack system (data/presets.ts's
 * `christmas`/`year-end` SeasonPack entries), which is orthogonal to
 * channel identity — this falls back to the shared default hook bank.
 */
export const christmasOverride: HookVocabularyOverride = {};
