import type { HookVocabularyOverride } from '../hookParts';

/**
 * Deferred per the v3.4 spec's explicit instruction to build senior-morning
 * and showa-cafe first (the two channels actually in production). Falls
 * back to the shared default hook bank until this archetype has a real
 * channel using it.
 */
export const lofiStudyOverride: HookVocabularyOverride = {};
