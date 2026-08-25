import { eraCanonPalettesForGenreId, partialPaletteForGenreId, type EraCanonPalette } from '../data/eraCanonPalettes';
import { shuffle } from './lyricEngine';
import { hashSeed } from '../utils/prng';

/** TASK v4.6 (§1-4) — "같은 팔레트 최대 6곡". */
const MAX_SONGS_PER_PALETTE = 6;
/**
 * TASK v4.6 (§1-4) — "사용 팔레트 종류 최소 3종". Only enforced when the
 * pack's own genre mix actually reaches this many distinct eligible palettes
 * — see buildEraCanonPalettePlan's own doc comment. Fallback default only:
 * data/channelSoundFloor.ts's own `minPaletteVariety` (2 since v4.9, that
 * field's own doc comment) is the real, current policy number and should be
 * threaded in by both real callers (designGate.ts/localGenerator.ts) via
 * buildEraCanonPalettePlan's minPaletteTypes parameter — this constant only
 * covers a caller that genuinely has no ChannelSoundFloor to read from.
 */
const MIN_PALETTE_TYPES = 3;

/**
 * TASK v4.7 (TASK B, §2-3) — `partial: true` for a genre that has no direct
 * eraCanonPalette match (data/eraCanonPalettes.ts's PARTIAL_PALETTE_FALLBACK,
 * e.g. chanson/bossa-cafe) but borrows a nearby palette's productionTraits
 * only — see rotatingEraPaletteAtoms below, which emits just 1 atom (not
 * 3-4) for a partial assignment so a chanson track never gets a British-beat
 * palette's full instrumentation/harmony/vocal description.
 */
export interface PaletteAssignment {
  palette: EraCanonPalette;
  partial: boolean;
}

function pickOne<T>(items: readonly T[], seed: number): T {
  const index = Math.abs(seed) % items.length;
  return items[index];
}

/**
 * 지시문 74 (TASK B-1) — 같은 축에서 서로 다른 원자를 count개 뽑는다(중복
 * 없음). 항목이 count보다 적으면 있는 만큼만 돌려준다 — 팔레트마다
 * productionTraits 개수가 2~3개로 다르기 때문에 없는 것을 지어내지 않는다.
 */
function pickDistinct<T>(items: readonly T[], seed: number, count: number): T[] {
  if (!items.length) return [];
  const take = Math.min(count, items.length);
  const start = Math.abs(seed) % items.length;
  if (items.length < 2) return [items[start]];
  // 지시문 74 (TASK B-1) — 두 번째 이후 원자를 인접 인덱스가 아니라 seed로
  // 정해지는 stride만큼 떨어뜨려 뽑는다. 인접 고정이면 같은 팔레트를 쓰는 두
  // 곡이 start까지 같아질 때 뽑힌 원자가 통째로 겹쳐, 자매 장르 쌍의
  // stylePrompt 유사도가 실측으로 올라간다(tests/oldpopGenreFamily.test.ts).
  const stride = 1 + (Math.abs(seed * 31 + 7) % (items.length - 1));
  return Array.from({ length: take }, (_, offset) => items[(start + offset * stride) % items.length]);
}

/**
 * Deterministic (seeded) per-song palette assignment: each song can only
 * draw from palettes whose fitsGenreIds includes that song's own genreId
 * (an oldpop-soft-rock-am track never gets a British-beat palette), so this
 * is a constrained pick, not a free rotation like buildHookDevicePlan/
 * buildIntroTexturePlan. Songs whose genre matches no palette (every
 * non-oldpop workspace) get undefined — rotatingEraPaletteAtoms below
 * already treats that as "no atoms," so callers never need to branch on it.
 *
 * 정합성 점검 §1 결함1/palette-variety-max fix — real measured bug: the
 * initial assignment used to draw independently per song (seeded shuffle,
 * first pick), with zero awareness of what earlier songs in the SAME pack
 * already picked. Several eraCanonPalettes.ts palettes cover multiple genre
 * ids at once (e.g. canon-soft-pop-duo fits both oldpop-soft-rock-am and
 * oldpop-adult-contemporary-80s) specifically so a pack mixing those genres
 * CAN consolidate onto one palette — but independent-per-song drawing never
 * exploited that, so widening a pack's genre selection (e.g. designGate.ts's
 * 'variety' breadth, which legitimately wants 6+ distinct genres) routinely
 * pushed distinctPaletteIds.size past data/channelSoundFloor.ts's own
 * maxPaletteVariety (4 for senior-morning) even when the actual selected
 * genres could have consolidated to 3. Now prefers a palette this song is
 * ALREADY eligible for AND that's already in use elsewhere in the pack
 * (ties broken toward the most-used one, then id order, both deterministic)
 * before falling back to the original seeded shuffle — this never assigns a
 * palette the song's own genre doesn't fit, only changes WHICH of its
 * already-eligible palettes gets picked first.
 *
 * Repair passes are best-effort, not exhaustive optimization: (1) cap each
 * palette at MAX_SONGS_PER_PALETTE by reassigning the latest-index excess
 * occurrences to another eligible palette for that same song, when one
 * exists; (2) if the whole plan still uses fewer than minPaletteTypes
 * distinct palettes, reassign one song per missing palette (the first song
 * whose own eligible set includes it) to pull it in. Both passes only ever
 * reassign a song to a palette that already fits its own genreId — this
 * never puts a British-beat descriptor on a folk-rock track.
 */
export function buildEraCanonPalettePlan(
  genrePlan: readonly (string | undefined)[],
  seed: number,
  /**
   * 정합성 점검 §1 결함1/palette-variety-max fix — data/channelSoundFloor.ts's
   * own `minPaletteVariety` (2 for senior-morning since v4.9) is the real,
   * current policy number; this module's own MIN_PALETTE_TYPES constant (3)
   * had drifted stale relative to it (never updated when that field was
   * lowered) and was actively forcing MORE distinct palettes than the
   * current policy wants — fighting the consolidation fix above. Defaults to
   * the module constant only for a caller with no ChannelSoundFloor to read.
   */
  minPaletteTypes: number = MIN_PALETTE_TYPES
): (PaletteAssignment | undefined)[] {
  const eligibleByIndex = genrePlan.map(genreId => eraCanonPalettesForGenreId(genreId));
  const partialByIndex = genrePlan.map(genreId => partialPaletteForGenreId(genreId));

  const plan: (PaletteAssignment | undefined)[] = [];
  const countById = new Map<string, number>();
  for (let idx = 0; idx < eligibleByIndex.length; idx++) {
    const eligible = eligibleByIndex[idx];
    if (eligible.length) {
      const reused = eligible
        .filter(candidate => (countById.get(candidate.id) ?? 0) > 0 && (countById.get(candidate.id) ?? 0) < MAX_SONGS_PER_PALETTE)
        .sort((a, b) => (countById.get(b.id) ?? 0) - (countById.get(a.id) ?? 0) || a.id.localeCompare(b.id))[0];
      const chosen = reused ?? shuffle(eligible, seed + idx * 337)[0];
      plan.push({ palette: chosen, partial: false });
      countById.set(chosen.id, (countById.get(chosen.id) ?? 0) + 1);
      continue;
    }
    const partial = partialByIndex[idx];
    plan.push(partial ? { palette: partial, partial: true } : undefined);
  }

  // Pass 1 — cap at MAX_SONGS_PER_PALETTE. Partial assignments (§2-3
  // fallback) don't compete for this cap or the diversity floor below —
  // they're a last-resort substitute for a genre with no real palette fit,
  // not a genuine member of that palette's own rotation. countById already
  // reflects the initial assignment above (built incrementally, including
  // the reuse preference), so it's reused as-is rather than recomputed.
  for (let idx = 0; idx < plan.length; idx++) {
    const current = plan[idx];
    if (!current || current.partial) continue;
    if ((countById.get(current.palette.id) ?? 0) <= MAX_SONGS_PER_PALETTE) continue;
    const alternative = eligibleByIndex[idx].find(candidate => candidate.id !== current.palette.id && (countById.get(candidate.id) ?? 0) < MAX_SONGS_PER_PALETTE);
    if (!alternative) continue;
    countById.set(current.palette.id, (countById.get(current.palette.id) ?? 0) - 1);
    countById.set(alternative.id, (countById.get(alternative.id) ?? 0) + 1);
    plan[idx] = { palette: alternative, partial: false };
  }

  // Pass 2 — diversity floor, only when the pack's own genre mix actually
  // offers minPaletteTypes distinct options at all (a channel using only 1-2
  // oldpop sub-genres can never reach the floor regardless of reassignment).
  const reachablePaletteIds = new Set(eligibleByIndex.flat().map(p => p.id));
  if (reachablePaletteIds.size >= minPaletteTypes) {
    let usedPaletteIds = new Set(plan.filter((a): a is PaletteAssignment => !!a && !a.partial).map(a => a.palette.id));
    for (const paletteId of reachablePaletteIds) {
      if (usedPaletteIds.size >= minPaletteTypes) break;
      if (usedPaletteIds.has(paletteId)) continue;
      const targetIdx = eligibleByIndex.findIndex((eligible, idx) => {
        const current = plan[idx];
        return eligible.some(p => p.id === paletteId) && (!current || current.partial || (countById.get(current.palette.id) ?? 0) > 1);
      });
      if (targetIdx === -1) continue;
      const palette = eligibleByIndex[targetIdx].find(p => p.id === paletteId)!;
      const previous = plan[targetIdx];
      if (previous && !previous.partial) countById.set(previous.palette.id, (countById.get(previous.palette.id) ?? 0) - 1);
      countById.set(paletteId, (countById.get(paletteId) ?? 0) + 1);
      plan[targetIdx] = { palette, partial: false };
      usedPaletteIds = new Set(plan.filter((a): a is PaletteAssignment => !!a && !a.partial).map(a => a.palette.id));
    }
  }

  return plan;
}

/**
 * TASK v4.6 (§1-4) — "각 축에서 1개씩, 총 3~4개 서술어". Always draws
 * instrumentation/harmonyTraits/vocalTraits (3 atoms); productionTraits used
 * to be added on roughly half of songs (seed-parity) to land the total at
 * 3-4 as specified, rather than always 4 (which would compete harder against
 * the concept atom's own budget floor — see localGenerator.ts's
 * CONCEPT_FLOOR_ATOMS).
 *
 * 지시문 74 (TASK B-1) — 그 seed-parity를 없앴다. 실측 청취 피드백("일본
 * 시니어도 2000년대 가수가 6070 노래 부르는 느낌")을 §2.1이 실제 산출물에서
 * 추적한 결과, 시대를 가르는 신호가 stylePrompt 22개 절 중 3개뿐이었고 그
 * 3개가 전부 프로덕션 계열이었다. 프로덕션이 시대를 가르는 가장 강한
 * 신호인데 뽑힐 수도 안 뽑힐 수도 있는 유일한 축이었던 셈이다. 이제
 * productionTraits는 항상 2개를 뽑는다(그 팔레트에 1개뿐이면 1개). 총
 * 원자 수는 3~4 → 5로 늘어나므로, 늘어난 만큼은 TASK B-4가 BPM 절을 뒤로
 * 보내고 중복 절을 정리해 총량을 유지한다(§4 "stylePrompt 단어 수를 늘리지
 * 말 것").
 *
 * TASK v4.7 (팔레트 커버리지 확장) — `genreId` folded into the selection seed:
 * several v4.7 palettes now cover MULTIPLE genre ids at once (e.g.
 * canon-doowop-girlgroup spans oldpop-doowop-harmony/oldpop-brill-building/
 * oldpop-girl-group-wall). Before this, two songs sharing a palette at the
 * same track index picked the exact same atoms (selection only varied by
 * pack seed + track index, never by which genre was actually playing),
 * which collapsed those genres' style prompts toward each other — a real
 * regression caught by tests/oldpopGenreFamily.test.ts's pre-existing
 * cross-genre similarity check once coverage widened enough for two genres
 * in the same test pack to share a palette. Hashing genreId in means
 * different genres drawing the same palette still pick different specific
 * descriptors from it.
 */
export function rotatingEraPaletteAtoms(assignment: PaletteAssignment | undefined, seed: number, index: number, genreId?: string): string[] {
  if (!assignment) return [];
  const { palette, partial } = assignment;
  const genreSalt = genreId ? hashSeed(genreId) : 0;
  const base = seed + index * 97 + genreSalt;
  // TASK v4.7 (TASK B, §2-3) — a partial (fallback) assignment only borrows
  // productionTraits: the genre's own real instrumentation/harmony/vocal
  // character (chanson's accordion, bossa's clave) must not be overwritten
  // by a palette it doesn't actually belong to.
  // 지시문 74 (TASK B-1) — partial도 2개다. partial이 빌려오는 축은 원래
  // productionTraits 하나뿐이고(그 시대의 프로덕션은 인접 장르끼리 실제로
  // 공유된다), 이 지시문이 "productionTraits 최소 2개 항상"을 요구하는 이유가
  // 바로 그 축이 시대를 가르는 가장 강한 신호이기 때문이다 — 부분 적용이라고
  // 해서 그 신호만 절반으로 줄일 이유가 없다. 그 팔레트에 1개뿐이면 1개.
  if (partial) return pickDistinct(palette.productionTraits, base + 59, 2);
  // 지시문 74 (TASK B-1) — 총 4개로 고정한다. 이전에는 3개(+seed 홀짝으로
  // production 1개) = 평균 3.5개였다. production을 2개로 올리되 전체 개수는
  // 거의 그대로 두라는 §2.4-B1의 단서("전체 개수는 무리하게 늘리지 말 것 —
  // §2.3-3의 길이 문제와 충돌한다")를 지키기 위해, harmony와 vocal 중 한
  // 축만 뽑는다. 어느 쪽을 뽑을지는 seed로 갈라지므로 팩 전체로 보면 두 축이
  // 모두 등장한다.
  //
  // 5개로 뽑아 본 실측: tests/seniorBaseline.test.ts의 프롬프트 길이 하한이
  // 725→794로(허용 745 초과), tests/oldpopGenreFamily.test.ts의 장르 쌍
  // 유사도가 0.579로(허용 0.56 초과) 둘 다 깨졌다 — 원자를 늘리는 방향
  // 자체가 그 두 회귀 지표와 정면으로 부딪힌다는 실측 확인이다.
  const axes = [palette.instrumentation, palette.harmonyTraits, palette.vocalTraits];
  const rotating = axes[Math.abs(base + 23) % axes.length];
  return [
    pickOne(rotating, base + 11),
    ...pickDistinct(palette.productionTraits, base + 59, 2)
  ];
}
