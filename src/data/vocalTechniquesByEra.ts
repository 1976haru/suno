import type { EraBucket } from './eraExclusions';

/**
 * v3.80 (TASK E) — era-specific vocal TECHNIQUES (how the voice is actually
 * used — harmony stacking, falsetto lifts, melisma), distinct from
 * data/vocalTraits.ts's register/delivery/timbre/proximity axes (WHAT the
 * voice sounds like) and data/vocalPresets.ts's whole-voice archetypes. A
 * real 1950s-60s doo-wop track and a 1980s adult-contemporary ballad
 * currently get the same 4-axis vocabulary regardless of era, even though
 * the actual singing technique of each era differs (four-part backing
 * harmony vs. a sustained power note): this file adds a small, era-matched
 * technique phrase on top of the existing axes, not a replacement for them.
 *
 * Each entry is capped at 8 words (this task's own explicit
 * "기법 서술은 8단어를 넘지 말 것") — core/vocalPlan.ts (or wherever this is
 * wired) enforces that as a real per-entry constraint, not just a
 * convention here; see this file's own test for the actual measured cap.
 */
export const VOCAL_TECHNIQUES_BY_ERA: Record<EraBucket, string[]> = {
  '1950s-60s': [
    'close four-part backing harmony',
    'nonsense-syllable backing vocals',
    'unison shout on the hook',
    'girl-group unison lead'
  ],
  '1970s': [
    'falsetto lift on the chorus',
    'alternating chest and falsetto',
    'gospel-inflected melisma',
    'double-tracked lead vocal',
    'smooth crooning legato'
  ],
  '1980s': [
    'wide stacked backing harmony',
    'sustained belt-free power note',
    'breathy intimate verse into full chorus',
    'octave-doubled hook line'
  ],
  timeless: [
    'warm conversational lead delivery',
    'gentle unhurried phrasing throughout',
    'plain unadorned melodic delivery'
  ]
};
