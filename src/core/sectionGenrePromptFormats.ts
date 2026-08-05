import type { SectionGenrePlan } from '../types';
import type { ComposedSectionGenres } from './sectionGenrePlan';

/**
 * TASK K1 §6 — three candidate ways to hand a SectionGenrePlan's composed
 * traits to Suno, none of which can be verified by code (§6-3: "이건 코드로
 * 검증할 수 없습니다") — only real listening tells us whether Suno actually
 * honors a per-section instruction or just averages it across the whole
 * song. These renderers exist so 하루 can paste all three into Suno and
 * compare; nothing here is wired into any real generation path, and none of
 * it touches core/promptComposer.ts's own existing assembly functions.
 *
 * Format A — section descriptors folded into the STYLE PROMPT text.
 * Format B — section descriptors folded into the LYRIC SECTION TAGS
 *            (e.g. "[chorus - rock guitars open up]").
 * Format C — both A and B at once, so a listen can isolate which channel
 *            (if either) Suno actually reads section instructions from.
 */

const MAX_SECTION_DESCRIPTOR_WORDS = 12;
const SECTION_DESCRIPTIONS_CHAR_BUDGET = 200;

function capWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text : words.slice(0, maxWords).join(' ');
}

/**
 * §6-2 — "무엇이 바뀌는가"만 서술: the section's own top instrumentation +
 * harmony item, not the unchanging spine axes (BPM/vocal/production are
 * stated once, separately — see renderSpineClause).
 */
function sectionDescriptor(section: ComposedSectionGenres['sections'][number]): string {
  const instrument = section.traits.instrumentation.find(item => item !== section.traits.instrumentation[0]) ?? section.traits.instrumentation[0];
  const harmony = section.traits.harmonyTraits[0];
  const parts = [instrument, harmony].filter(Boolean);
  return capWords(parts.join(', '), MAX_SECTION_DESCRIPTOR_WORDS);
}

function spineClause(spine: ComposedSectionGenres['spine']): string {
  return [spine.vocalTraits.join(', '), spine.productionTraits.join(', '), `${spine.bpm} BPM`, spine.eraTag].filter(Boolean).join(', ');
}

export interface FormatARender {
  stylePromptAddition: string;
  sectionDescriptionsLength: number;
  totalLength: number;
}

/**
 * Format A — appends a compact "section map" clause to the style prompt:
 * the spine described once, then each section's own delta at up to
 * MAX_SECTION_DESCRIPTOR_WORDS words, budgeted to
 * SECTION_DESCRIPTIONS_CHAR_BUDGET chars total (§6-2). Outro is always
 * abbreviated to a return-to-X note rather than getting its own full
 * descriptor, per §6-2's explicit instruction.
 */
function descriptorPartsAtDetail(composed: ComposedSectionGenres, itemsPerSection: 1 | 2): string[] {
  return composed.sections.map((section, i) => {
    const label = section.sectionId;
    if (label === 'outro') {
      const returnsTo = composed.sections.slice(0, i).reverse().find(s => s.genreId === section.genreId);
      return `${label} returns to ${returnsTo?.sectionId ?? 'verse'} texture`;
    }
    const instrument = section.traits.instrumentation.find(item => item !== section.traits.instrumentation[0]) ?? section.traits.instrumentation[0];
    const harmony = section.traits.harmonyTraits[0];
    const parts = itemsPerSection === 2 ? [instrument, harmony] : [instrument];
    return `${label} ${capWords(parts.filter(Boolean).join(', '), MAX_SECTION_DESCRIPTOR_WORDS)}`;
  });
}

/**
 * §6-2's 200-char section-description budget is enforced, not aspirational:
 * tries the full 2-item-per-section descriptor first, and falls back to a
 * 1-item (instrument only) descriptor per section if that doesn't fit.
 * Still reports the real achieved length either way — a caller relying on
 * this to always land under 200 without checking would be trusting an
 * unverified guarantee.
 */
export function renderFormatA(plan: SectionGenrePlan, composed: ComposedSectionGenres, baseStylePrompt: string): FormatARender {
  const spine = spineClause(composed.spine);
  let descriptorParts = descriptorPartsAtDetail(composed, 2);
  let sectionDescriptions = descriptorParts.join('; ');
  if (sectionDescriptions.length > SECTION_DESCRIPTIONS_CHAR_BUDGET) {
    descriptorParts = descriptorPartsAtDetail(composed, 1);
    sectionDescriptions = descriptorParts.join('; ');
  }
  const stylePromptAddition = `${baseStylePrompt}, spine: ${spine}, section map: ${sectionDescriptions}`;
  return {
    stylePromptAddition,
    sectionDescriptionsLength: sectionDescriptions.length,
    totalLength: stylePromptAddition.length
  };
}

/**
 * Format B — expands each section's real lyric tag line (e.g. "[chorus]")
 * into "[chorus - rock guitars open up]", leaving every sung line
 * untouched. `realTags` maps this plan's sectionId to the literal tag
 * string already present in a real composed lyric (core/lyricEngine.ts's
 * own SECTION_TAGS, e.g. '[pre-chorus]', '[short bridge]') — this function
 * never invents new lyric content, only annotates existing tag lines.
 */
export function renderFormatBTags(composed: ComposedSectionGenres, realTags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of composed.sections) {
    const tag = realTags[section.sectionId];
    if (!tag) continue;
    const descriptor = section.sectionId === 'outro' ? 'returns to opening texture' : sectionDescriptor(section);
    const inner = tag.slice(1, -1);
    out[section.sectionId] = `[${inner} - ${descriptor}]`;
  }
  return out;
}

/**
 * Every occurrence of a section's plain tag gets the same annotation (a
 * real lyric can repeat [chorus] several times) — split/join rather than a
 * single .replace() so no repeat is left unannotated.
 */
export function applyFormatBTagsToLyrics(lyrics: string, tagReplacements: Record<string, string>): string {
  let result = lyrics;
  for (const [, replacement] of Object.entries(tagReplacements)) {
    const plainTag = `[${replacement.slice(1, replacement.indexOf(' - '))}]`;
    result = result.split(plainTag).join(replacement);
  }
  return result;
}
