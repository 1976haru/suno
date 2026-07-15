import { moneyChordPresets } from '../data/moneyChords';
import { vocalPresets } from '../data/vocalPresets';
import { genrePacks } from '../data/presets';
import { getCoreGenreIdsForArchetype } from '../data/genreLibrary';
import { compactGenreKeyword, compactVocalAtom } from './soundSignature';

export type DiversityDimension = 'genre' | 'vocal' | 'moneyChord';

export interface DiversityReport {
  dimension: DiversityDimension;
  totalPresets: number;
  duplicateGroups: string[][];
  genericFallbackCount: number;
  passed: boolean;
}

/**
 * TASK H4 (v3.14) — the exact content-free strings a broken compact*
 * function has historically fallen back to when it failed to extract
 * anything meaningful from a preset (see compactMoneyChord's pre-v3.14
 * regex bug). A preset landing on one of these is a red flag even if it
 * doesn't collide with another preset's output.
 */
const GENERIC_FALLBACKS: Record<DiversityDimension, string[]> = {
  moneyChord: ['money chord progression'],
  vocal: ['soft close-mic vocal', 'soft vocal'],
  genre: ['warm original pop']
};

function presetOutputs(dimension: DiversityDimension): { id: string; output: string }[] {
  if (dimension === 'moneyChord') {
    return Object.values(moneyChordPresets).map(preset => ({ id: preset.id, output: preset.compactProgression }));
  }
  if (dimension === 'vocal') {
    return vocalPresets.map(preset => ({ id: preset.id, output: compactVocalAtom(preset.prompt) }));
  }
  // 'genre' — core-tier genres across both real production archetypes,
  // deduped by id (a genre shared between archetypes' core lists is only
  // checked once).
  const coreIds = new Set([...getCoreGenreIdsForArchetype('senior-morning'), ...getCoreGenreIdsForArchetype('showa-cafe')]);
  const seen = new Set<string>();
  const out: { id: string; output: string }[] = [];
  for (const id of coreIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const genre = genrePacks.find(g => g.id === id);
    if (!genre) continue;
    out.push({ id, output: compactGenreKeyword([genre]) });
  }
  return out;
}

/**
 * TASK H4 (v3.14) — the systemic regression guard this whole file exists
 * for: "changed the preset, but the compacted Suno-facing text is identical
 * (or empty) to another preset" is exactly the bug class that let the
 * moneyChord regression (and, before it, v3.13's instruments/mood drop)
 * ship undetected across multiple releases. This one check catches any
 * future preset addition/edit that collapses this way, without needing a
 * bespoke test per dimension per preset.
 */
export function lintPresetDiversity(dimension: DiversityDimension): DiversityReport {
  const entries = presetOutputs(dimension);
  const byOutput = new Map<string, string[]>();
  for (const entry of entries) {
    const group = byOutput.get(entry.output) ?? [];
    group.push(entry.id);
    byOutput.set(entry.output, group);
  }

  const duplicateGroups = [...byOutput.values()].filter(group => group.length > 1);
  const fallbacks = new Set(GENERIC_FALLBACKS[dimension]);
  const genericFallbackCount = entries.filter(entry => fallbacks.has(entry.output)).length;

  return {
    dimension,
    totalPresets: entries.length,
    duplicateGroups,
    genericFallbackCount,
    passed: duplicateGroups.length === 0 && genericFallbackCount === 0
  };
}
