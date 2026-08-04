import type { ChannelArchetype, DisplayLanguage } from '../types';
import {
  detectMoodCategory,
  eraFlavorFor,
  localizedTitleCandidates,
  MOOD_CATEGORY_BY_ARC_PHASE,
  type TitleMoodCategory
} from '../data/titleLocalizationBank';
import { hashSeed } from '../utils/prng';
import { isKidsArchetype } from '../utils/channelArchetype';

/**
 * v4.3 (TASK A) — local-generation-path builder for the packaging-language
 * title (SongIdea.titleLocalized/titleDisplay). See
 * data/titleLocalizationBank.ts's own top comment for why this never touches
 * `title`'s own English words (structurally can't produce a literal
 * translation) and why the REAL creative reinterpretation happens in the
 * bridge path instead (core/bridgeInstruction.ts's titleLocalizedInstructionLineFor) —
 * this module only backs the offline/local preview path
 * (core/localGenerator.ts) and the bridge-import fallback for a song whose
 * agent output omitted titleLocalized despite the instruction asking for it.
 */

const MAX_LENGTH_BY_LANGUAGE: Record<'korean' | 'japanese', number> = {
  korean: 10,
  japanese: 12
};

export interface LocalizedTitleInput {
  emotionArc: string;
  listenerSituation: string;
  arcPhase?: 'opening' | 'rising' | 'peak' | 'easing' | 'closing';
  /** GenrePack.eraTag — see eraFlavorFor's own doc comment for why this is a plain string, not the EraBucket union. */
  eraTag?: string;
  archetype?: ChannelArchetype;
  /** Seed base, e.g. `${seedBase}-${trackNo}` — must be stable per song so re-scoring the same pack doesn't reshuffle titles. */
  seed: number;
}

/**
 * Builds a non-literal packaging-language title for one song. Returns
 * undefined for 'english' packaging (nothing to show — see this task's own
 * "없으면 표시하지 않음") or if every candidate in the bank is exhausted
 * against `usedLocalizedTitles` (extremely unlikely given the pool size).
 */
export function buildLocalizedTitle(
  packagingLanguage: DisplayLanguage,
  input: LocalizedTitleInput,
  usedLocalizedTitles: Set<string>
): string | undefined {
  if (packagingLanguage === 'english') return undefined;
  const language = packagingLanguage;
  const fallbackCategory: TitleMoodCategory = input.arcPhase ? MOOD_CATEGORY_BY_ARC_PHASE[input.arcPhase] : 'nostalgia';
  const category = detectMoodCategory(`${input.emotionArc} ${input.listenerSituation}`, fallbackCategory);
  const eraFlavor = eraFlavorFor(input.eraTag, isKidsArchetype(input.archetype));
  const maxLength = MAX_LENGTH_BY_LANGUAGE[language];

  const candidates = localizedTitleCandidates(language, category, eraFlavor, input.seed);
  for (const candidate of candidates) {
    const text = candidate.text;
    if (text.length > maxLength) continue;
    if (usedLocalizedTitles.has(text)) continue;
    usedLocalizedTitles.add(text);
    return text;
  }
  return undefined;
}

/** "Blue Cup" + "식어가는 찻잔" -> "Blue Cup (식어가는 찻잔)". Never used for the Suno-input title field — see SongIdea.titleDisplay's own doc comment. */
export function buildTitleDisplay(title: string, titleLocalized: string | undefined): string | undefined {
  if (!titleLocalized) return undefined;
  return `${title} (${titleLocalized})`;
}

/** Deterministic per-song seed so re-running generation with the same seedBase reproduces the same localized titles. */
export function localizedTitleSeed(seedBase: string, trackNo: number): number {
  return hashSeed(`${seedBase}-titleLocalized-${trackNo}`);
}
