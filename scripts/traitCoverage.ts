/**
 * v3.65 (TASK A-5) — reports how well the GenreTraits decomposition (see
 * src/data/genreTraits.ts) actually covers the genre library, and flags
 * signs of a lazy/rushed decomposition (single-item axes, cross-axis
 * duplication, two genres whose axes read as near-identical, and any
 * signatureSound wording that didn't make it into any traits axis).
 *
 * Usage: npx tsx scripts/traitCoverage.ts
 */
import { genreLibrary } from '../src/data/genreLibrary';
import type { GenreTraits } from '../src/types';

const AXES: (keyof GenreTraits)[] = ['instrumentation', 'rhythmFeel', 'harmonyTraits', 'productionTraits', 'vocalTraits', 'structureTraits'];

const withTraits = genreLibrary.filter(g => g.traits);

console.log('=== 1. Coverage ===');
console.log(`traits present: ${withTraits.length} / ${genreLibrary.length} total genres`);
console.log('');

console.log('=== 2. Average items per axis (across genres with traits) ===');
for (const axis of AXES) {
  const counts = withTraits.map(g => (g.traits![axis] as string[]).length);
  const avg = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  console.log(`  ${axis}: avg ${avg.toFixed(2)}, min ${min}, max ${max}`);
}
console.log('');

console.log('=== 3. Axes with fewer than 2 or more than 5 items (quality-bar violations) ===');
let violationCount = 0;
for (const g of withTraits) {
  for (const axis of AXES) {
    const len = (g.traits![axis] as string[]).length;
    if (len < 2 || len > 5) {
      console.log(`  ${g.id}.${axis}: ${len} item(s)`);
      violationCount += 1;
    }
  }
}
console.log(`  total violations: ${violationCount}`);
console.log('');

console.log('=== 4. Cross-axis category leakage (a word belonging to a DIFFERENT axis\'s category shows up here — e.g. "waltz" in instrumentation) ===');
function words(items: string[]): Set<string> {
  return new Set(items.flatMap(item => item.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3)));
}
// Category vocabulary an axis's OWN items are expected to use freely.
// Flagging is scoped to words that belong to a *different* axis's category
// leaking into this one (e.g. a rhythm term inside instrumentation), not
// incidental English overlap (shared words like "warm"/"soft"/"with" across
// two genuinely different descriptions are not duplication).
const RHYTHM_WORDS = ['waltz', 'swing', 'shuffle', 'backbeat', 'syncopation', 'syncopated', 'tempo', 'groove', 'pulse', 'pocket', 'triplet'];
const HARMONY_WORDS = ['chord', 'chords', 'progression', 'cadence', 'turnaround', 'diatonic', 'modal', 'harmony'];
const INSTRUMENT_WORDS = ['guitar', 'piano', 'bass', 'drums', 'accordion', 'saxophone', 'strings', 'vibraphone', 'trumpet', 'cello', 'harpsichord', 'synth'];
const VOCAL_WORDS = ['falsetto', 'vibrato', 'crooning', 'phrasing', 'diction'];
const FOREIGN_VOCAB: Partial<Record<keyof GenreTraits, string[]>> = {
  instrumentation: [...RHYTHM_WORDS, ...HARMONY_WORDS, ...VOCAL_WORDS],
  rhythmFeel: [...INSTRUMENT_WORDS, ...HARMONY_WORDS],
  harmonyTraits: [...INSTRUMENT_WORDS, ...RHYTHM_WORDS],
  vocalTraits: [...INSTRUMENT_WORDS, ...HARMONY_WORDS]
};
let leakCount = 0;
for (const g of withTraits) {
  for (const axis of AXES) {
    const foreign = FOREIGN_VOCAB[axis];
    if (!foreign) continue;
    const axisWords = words(g.traits![axis] as string[]);
    const hits = foreign.filter(w => axisWords.has(w));
    if (hits.length) {
      console.log(`  ${g.id}.${axis}: contains ${hits.join(', ')}`);
      leakCount += 1;
    }
  }
}
console.log(`  total category-leakage hits: ${leakCount}`);
console.log('');

console.log('=== 5. Pairwise axis similarity (20 random genre pairs, token-overlap per axis) ===');
function tokenOverlap(a: string[], b: string[]): number {
  const setA = words(a);
  const setB = words(b);
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}
function pick<T>(arr: T[], n: number, seed: number): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}
const pairs: [string, string][] = [];
const ids = withTraits.map(g => g.id);
const shuffledIds = pick(ids, ids.length, 42);
for (let i = 0; i + 1 < shuffledIds.length && pairs.length < 20; i += 2) {
  pairs.push([shuffledIds[i], shuffledIds[i + 1]]);
}
let highSimilarityCount = 0;
for (const [idA, idB] of pairs) {
  const a = genreLibrary.find(g => g.id === idA)!.traits!;
  const b = genreLibrary.find(g => g.id === idB)!.traits!;
  const perAxis = AXES.map(axis => `${axis}=${tokenOverlap(a[axis] as string[], b[axis] as string[]).toFixed(2)}`).join(' ');
  const anyHigh = AXES.some(axis => tokenOverlap(a[axis] as string[], b[axis] as string[]) > 0.6);
  if (anyHigh) highSimilarityCount += 1;
  console.log(`  ${idA} vs ${idB}: ${perAxis}${anyHigh ? '  <-- HIGH (possible under-differentiation)' : ''}`);
}
console.log(`  pairs with >0.6 same-axis similarity: ${highSimilarityCount} / ${pairs.length}`);
console.log('');

console.log('=== 6. signatureSound words missing from every traits axis ===');
let missingWordTotal = 0;
for (const g of withTraits) {
  if (!g.signatureSound) continue;
  const sigWords = g.signatureSound.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
  const allTraitWords = new Set(AXES.flatMap(axis => [...words(g.traits![axis] as string[])]));
  const missing = [...new Set(sigWords)].filter(w => !allTraitWords.has(w));
  if (missing.length) {
    console.log(`  ${g.id}: ${missing.join(', ')}`);
    missingWordTotal += missing.length;
  }
}
console.log(`  total missing-word occurrences: ${missingWordTotal}`);
