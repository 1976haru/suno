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
console.log('');

/**
 * TASK G1 §6-3 — 워크스페이스 내 전수 + 워크스페이스 간 전수 유사도.
 * §0-1 순수 추가 원칙: 위 1~6번(기존 §5의 무작위 20쌍 표본, 축별 개별 비교,
 * 0.6 임계값)은 그대로 두고 새 섹션만 추가합니다 — 기존 함수(words/
 * tokenOverlap/pick 등)는 재사용하되 수정하지 않습니다. 이 섹션은 "축별
 * 개별 비교"가 아니라 이 앱의 실제 유사도 판정 기준(core/compositionScorer.ts의
 * STYLE_SIMILARITY_BLOCK_THRESHOLD=0.28, core/diversityLinter.ts의
 * jaccardSimilarity와 동일한 전체-원자-집합 자카드 방식)으로 워크스페이스
 * 경계를 검사합니다 — "kr2030 장르끼리는 서로 다르게 들리는가"와 "kr2030과
 * jp2030은 서로 다르게 들리는가"를 같은 척도로 봅니다.
 */
console.log('=== 7. 워크스페이스 내/간 전수 유사도 (TASK G1 §6-3) ===');
function flattenTraits(g: (typeof genreLibrary)[number]): Set<string> {
  if (!g.traits) return new Set();
  return words(AXES.flatMap(axis => g.traits![axis] as string[]));
}
function fullJaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
const WORKSPACE_GENRE_GROUPS: Record<string, string[]> = {
  'kr-2030': withTraits.filter(g => g.id.startsWith('kr2030-')).map(g => g.id),
  'jp-2030': withTraits.filter(g => g.id.startsWith('jp2030-')).map(g => g.id)
};
function summarizePairs(idsA: string[], idsB: string[], sameGroup: boolean): { avg: number; max: number; pairCount: number } {
  const vectors = new Map(withTraits.map(g => [g.id, flattenTraits(g)]));
  let total = 0, max = 0, count = 0;
  for (let i = 0; i < idsA.length; i++) {
    for (let j = sameGroup ? i + 1 : 0; j < idsB.length; j++) {
      if (sameGroup && idsA[i] === idsB[j]) continue;
      const sim = fullJaccard(vectors.get(idsA[i])!, vectors.get(idsB[j])!);
      total += sim;
      max = Math.max(max, sim);
      count++;
    }
  }
  return { avg: count ? total / count : 0, max, pairCount: count };
}
for (const [wsId, ids] of Object.entries(WORKSPACE_GENRE_GROUPS)) {
  if (!ids.length) {
    console.log(`  ${wsId} (워크스페이스 내): 장르 0개 — 미구축, SKIP`);
    continue;
  }
  const { avg, max, pairCount } = summarizePairs(ids, ids, true);
  const flag = avg > 0.28 || max > 0.4 ? '  <-- 기준 초과(평균 ≤0.28 / 최대 ≤0.40)' : '';
  console.log(`  ${wsId} (워크스페이스 내, ${ids.length}종 ${pairCount}쌍): 평균 ${avg.toFixed(3)} / 최대 ${max.toFixed(3)}${flag}`);
}
const groupIds = Object.keys(WORKSPACE_GENRE_GROUPS).filter(k => WORKSPACE_GENRE_GROUPS[k].length);
for (let i = 0; i < groupIds.length; i++) {
  for (let j = i + 1; j < groupIds.length; j++) {
    const a = WORKSPACE_GENRE_GROUPS[groupIds[i]];
    const b = WORKSPACE_GENRE_GROUPS[groupIds[j]];
    const { avg, max, pairCount } = summarizePairs(a, b, false);
    const flag = avg > 0.28 || max > 0.4 ? '  <-- 기준 초과(평균 ≤0.28 / 최대 ≤0.40)' : '';
    console.log(`  ${groupIds[i]} x ${groupIds[j]} (워크스페이스 간, ${pairCount}쌍): 평균 ${avg.toFixed(3)} / 최대 ${max.toFixed(3)}${flag}`);
  }
}
console.log('');
