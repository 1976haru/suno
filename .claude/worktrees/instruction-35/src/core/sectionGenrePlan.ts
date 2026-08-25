import type { GenrePack, GenreTraits, SectionGenrePlan, SectionGenreSlot, SpineTraits } from '../types';
import { ERA_FORBIDDEN_DESCRIPTORS, eraBucketForGenreId } from '../data/eraExclusions';

/**
 * TASK K1 — K-pop's multi-genre songs aren't an average of several genres,
 * they're a SEQUENCE of genres, one per section (verse R&B, pre-chorus
 * house, chorus rock, ...). core/genreBlend.ts's blendGenreTraits recombines
 * exactly two genres into one whole-song GenreTraits, and its own §0-2
 * measured limits (documented on that file, unchanged here) mean chaining
 * it more than once silently overwrites harmonyTraits with only the last
 * flavor's — it was never meant for N genres or per-section assignment.
 * This module is a separate, additive engine: it never calls
 * blendGenreTraits, never touches genreBlend.ts/setDirector.ts/
 * promptComposer.ts, and produces a fundamentally different shape (one
 * GenreTraits slice per section, plus a shared "spine") rather than one
 * flat GenreTraits for the whole song.
 *
 * None of the five existing workspaces (senior-oldpop/kr-2030/jp-2030/
 * kr-kids/jp-kids) reference this file — it exists for the future idol
 * workspaces (K2/K3) and is entirely opt-in.
 */

export type SectionGenreTraits = Pick<GenreTraits, 'instrumentation' | 'rhythmFeel' | 'harmonyTraits'>;

export interface ComposedSectionGenres {
  spine: SpineTraits;
  sections: Array<{ sectionId: string; genreId: string; presence: SectionGenreSlot['presence']; traits: SectionGenreTraits }>;
  /** Era-safety filter (§5-3) — instrumentation items dropped for being anachronistic against the chorus genre's own era bucket, reusing the same ERA_FORBIDDEN_DESCRIPTORS table blendGenreTraits already uses. */
  droppedInstrumentCount: number;
  warnings: string[];
}

const PER_SECTION_CAPS = { instrumentation: 3, rhythmFeel: 2, harmonyTraits: 2 } as const;
const SPINE_CAPS = { vocalTraits: 3, productionTraits: 2, structureTraits: 2 } as const;

const DYNAMIC_RANGE_ORDER: GenreTraits['dynamicRange'][] = ['low', 'medium', 'wide'];

/**
 * §5-2 — the opposite choice from genreBlend.ts's own lowerDynamicRange:
 * K-pop's section-to-section contrast is the point, so the spine takes the
 * WIDEST dynamic range among the sections' genres rather than the calmest.
 * A new, separate function — lowerDynamicRange itself is untouched.
 */
function widerDynamicRange(values: GenreTraits['dynamicRange'][]): GenreTraits['dynamicRange'] {
  return values.reduce((widest, value) =>
    DYNAMIC_RANGE_ORDER.indexOf(value) > DYNAMIC_RANGE_ORDER.indexOf(widest) ? value : widest
  );
}

function resolveGenre(genreId: string, library: GenrePack[]): GenrePack {
  const genre = library.find(g => g.id === genreId);
  if (!genre) throw new Error(`composeSectionGenres: genre "${genreId}" not found in library`);
  if (!genre.traits) throw new Error(`composeSectionGenres: genre "${genreId}" has no .traits`);
  return genre;
}

/**
 * §4-2 authoring rules, checked separately from composition itself so a
 * caller can inspect what's wrong with a plan without composeSectionGenres
 * having to guess a fallback. Returns [] for a valid plan.
 */
export function validateSectionGenrePlan(plan: SectionGenrePlan): string[] {
  const issues: string[] = [];
  const count = plan.sections.length;
  if (count < 4 || count > 6) issues.push(`구간 수는 4-6이어야 합니다 (현재 ${count})`);

  const distinctGenres = new Set(plan.sections.map(s => s.genreId)).size;
  if (distinctGenres < 3 || distinctGenres > 6) issues.push(`서로 다른 장르 수는 3-6이어야 합니다 (현재 ${distinctGenres})`);

  let consecutive = 1;
  for (let i = 1; i < plan.sections.length; i++) {
    consecutive = plan.sections[i].genreId === plan.sections[i - 1].genreId ? consecutive + 1 : 1;
    if (consecutive >= 3) issues.push(`같은 장르("${plan.sections[i].genreId}")가 연속 3구간 이상입니다`);
  }

  const chorus = plan.sections.filter(s => s.sectionId === 'chorus');
  if (!chorus.length) issues.push('chorus 구간이 없습니다');
  if (chorus.some(s => s.presence !== 'primary')) issues.push('chorus 구간은 presence가 반드시 primary여야 합니다');

  return issues;
}

/**
 * §5-1/§5-4 — composes a SectionGenrePlan into per-section traits plus a
 * whole-song "spine" (§4-3/§4-4: the axes that stay fixed so the song
 * doesn't fall apart into unrelated segments — BPM, vocal delivery, and
 * production character all come from the CHORUS section's genre, since the
 * chorus is the song's identity). Per-section axes (instrumentation/
 * rhythmFeel/harmonyTraits) are replaced wholesale per section rather than
 * merged — the opposite of blendGenreTraits's anchor/flavor recombination,
 * because here every section IS its own genre, not a blend of two.
 *
 * One instrumentation item from the chorus genre is threaded through every
 * section's own instrumentation list (spine.sharedInstrument) so a listener
 * hears continuity even as the rest of the arrangement changes underneath.
 *
 * Throws if any referenced genre is missing from `library` or has no
 * `.traits` — same fail-loud contract as blendGenreTraits for the same
 * reason (nothing meaningful to compose from a flat styleCore string).
 */
export function composeSectionGenres(plan: SectionGenrePlan, library: GenrePack[]): ComposedSectionGenres {
  const chorusSlot = plan.sections.find(s => s.sectionId === 'chorus');
  if (!chorusSlot) throw new Error('composeSectionGenres: plan has no chorus section — see §4-4, the spine is always sourced from chorus');
  const chorusGenre = resolveGenre(chorusSlot.genreId, library);
  const chorusTraits = chorusGenre.traits!;

  const sharedInstrument = chorusTraits.instrumentation[0] ?? chorusGenre.instruments[0] ?? '';
  const bpm = Math.round((chorusGenre.tempoRange[0] + chorusGenre.tempoRange[1]) / 2);

  const eraBucket = eraBucketForGenreId(chorusGenre.id);
  const forbidden = eraBucket ? ERA_FORBIDDEN_DESCRIPTORS[eraBucket] : [];

  let droppedInstrumentCount = 0;
  const sections: ComposedSectionGenres['sections'] = plan.sections.map(slot => {
    const genre = resolveGenre(slot.genreId, library);
    const traits = genre.traits!;

    const rawInstruments = [...new Set([sharedInstrument, ...traits.instrumentation])].filter(Boolean);
    const safeInstruments = rawInstruments.filter(item => !forbidden.some(term => item.toLowerCase().includes(term)));
    droppedInstrumentCount += rawInstruments.length - safeInstruments.length;
    const instrumentation = safeInstruments.slice(0, PER_SECTION_CAPS.instrumentation);
    // Guarantee the shared spine instrument survives the era filter/cap even
    // if it would otherwise have been trimmed — it's the one thread that
    // must never disappear (§4-3).
    const finalInstrumentation = instrumentation.includes(sharedInstrument) || !sharedInstrument
      ? instrumentation
      : [sharedInstrument, ...instrumentation.slice(0, PER_SECTION_CAPS.instrumentation - 1)];

    return {
      sectionId: slot.sectionId,
      genreId: slot.genreId,
      presence: slot.presence,
      traits: {
        instrumentation: finalInstrumentation,
        rhythmFeel: traits.rhythmFeel.slice(0, PER_SECTION_CAPS.rhythmFeel),
        harmonyTraits: traits.harmonyTraits.slice(0, PER_SECTION_CAPS.harmonyTraits)
      }
    };
  });

  const spine: SpineTraits = {
    eraTag: chorusTraits.eraTag,
    vocalTraits: chorusTraits.vocalTraits.slice(0, SPINE_CAPS.vocalTraits),
    productionTraits: chorusTraits.productionTraits.slice(0, SPINE_CAPS.productionTraits),
    dynamicRange: widerDynamicRange(plan.sections.map(slot => resolveGenre(slot.genreId, library).traits!.dynamicRange)),
    structureTraits: chorusTraits.structureTraits.slice(0, SPINE_CAPS.structureTraits),
    bpm,
    sharedInstrument
  };

  const warnings: string[] = [];
  if (droppedInstrumentCount > 0) {
    warnings.push(`시대 필터로 악기 ${droppedInstrumentCount}개 제거됨 (chorus 장르 "${chorusGenre.id}"의 시대 기준)`);
  }

  return { spine, sections, droppedInstrumentCount, warnings };
}
