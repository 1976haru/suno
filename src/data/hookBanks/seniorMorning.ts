import type { HookVocabularyOverride } from '../hookParts';

/**
 * The shared default bank in data/hookParts.ts was written with this exact
 * archetype in mind (coffee, radio, letters, sweaters — the existing
 * '굿모닝 추억 라디오' channel's own imagery), so there's nothing to override
 * here. This file exists so the archetype registry has an explicit,
 * intentional entry rather than silently relying on "undefined = default."
 */
export const seniorMorningOverride: HookVocabularyOverride = {};
