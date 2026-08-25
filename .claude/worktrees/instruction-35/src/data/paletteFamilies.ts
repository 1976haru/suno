import { ERA_CANON_PALETTES, PARTIAL_PALETTE_FALLBACK } from './eraCanonPalettes';

/**
 * TASK v4.9 (TASK A) — real listening feedback: "18곡 조합이 어색... 맛있는
 * 일식·중식·한식이 같이 나온 느낌" traced to v4.7's own
 * channelSoundFloor.minPaletteVariety:3, which forced 3+ distinct
 * data/eraCanonPalettes.ts palettes into every set regardless of whether
 * they actually belonged together — a Simon & Garfunkel-style folk-duo
 * palette, an ABBA-style europop palette, and a Motown-style soul palette
 * are each individually "1970s", but hearing all three back to back in one
 * 18-song set reads as incoherent rather than varied. A PaletteFamily is a
 * musically-coherent cluster of palettes a set can freely rotate WITHIN
 * (matching the v4.7 diversity intent) while staying OUT of clusters that
 * don't actually sit well together (matching this task's own listening
 * feedback). Distinct from data/genreFamilies.ts's pre-existing GenreFamily
 * (a v3.63 UI-facing genre-picker grouping whose own blendsWellWith is
 * explicitly advisory-only, never enforced — see that file's own doc
 * comment on familiesBlendWell, "never used to block a selection") — this
 * one operates at the PALETTE level (data/eraCanonPalettes.ts, the fixed
 * v4.6/v4.7 canonical-sound vocabulary set) and IS enforced, by
 * core/setDirector.ts's genre-pool filtering and core/eraCanonPalettePlan.ts's
 * within-family diversity floor/ceiling — see this task's own explicit
 * "가족 안에서만 섞기".
 */
export interface PaletteFamily {
  id: string;
  labelKo: string;
  paletteIds: string[];
  /** Other families a set built primarily from this one may still draw a minority of songs from (core/setDirector.ts caps this at 5 songs / 28%). */
  compatibleWith: string[];
  /** True when this family alone has enough distinct palettes/genres to fill an 18-song set without borrowing from any other family. */
  standalone: boolean;
  koreanNoteKo: string;
}

export const PALETTE_FAMILIES: PaletteFamily[] = [
  {
    id: 'family-acoustic-soft',
    labelKo: '어쿠스틱 포크·소프트',
    // 지시문 21 (TASK B) — canon-tremolo-blues-ballad(oldpop-rainy-ballad-blues
    // 전용 신규 palette) 추가. 어느 PALETTE_FAMILIES에도 등록하지 않으면
    // paletteFamilyForGenreId가 undefined를 반환해 showa-seventies 때와
    // 같은 미등록 결함이 재현된다(실측으로 확인). 기타 중심·인티메이트·
    // 싱어송라이터 성향이 이 family의 이글스/존 덴버 계열과 가장 가까워
    // 여기 편입 — family-orchestral(오케스트럴)이나 family-soul(가스펠)
    // 보다 훨씬 근접한 근거.
    paletteIds: [
      'canon-folk-duo', 'canon-soft-pop-duo', 'canon-country-folk',
      'canon-soft-rock-band', 'canon-warm-gentle-acoustic', 'canon-tremolo-blues-ballad'
    ],
    compatibleWith: ['family-bright-pop', 'family-orchestral'],
    standalone: true,
    koreanNoteKo: '사이먼앤가펑클 · 카펜터스 · 이글스 · 존 덴버 계열'
  },
  {
    id: 'family-bright-pop',
    labelKo: '브라이트 팝',
    paletteIds: ['canon-europop-glow', 'canon-british-beat', 'canon-doowop-girlgroup'],
    compatibleWith: ['family-acoustic-soft', 'family-orchestral'],
    standalone: true,
    koreanNoteKo: '아바 · 비틀즈 · 걸그룹 계열'
  },
  {
    id: 'family-orchestral',
    labelKo: '오케스트럴·크루너',
    paletteIds: ['canon-crooner-standard', 'canon-piano-orchestral-ballad'],
    compatibleWith: ['family-acoustic-soft', 'family-bright-pop'],
    standalone: true,
    koreanNoteKo: '톰 존스 · 엥겔베르트 · 오케스트럴 발라드 계열'
  },
  {
    id: 'family-soul',
    labelKo: '소울',
    paletteIds: ['canon-motown-soul', 'canon-soulful-rnb', 'canon-quiet-storm-synth'],
    // TASK v4.9 (§1-3) — "느린 세트에서 튄다" (soul pop reads as a different
    // emotional register against a slow acoustic/orchestral pack) — soul
    // never blends, matching this task's own explicit "다른 그룹과 섞으면 튑니다".
    compatibleWith: [],
    standalone: true,
    koreanNoteKo: '모타운 · 필라델피아 소울 계열. 다른 그룹과 섞으면 튑니다'
  },
  // P2 fix (정합성 점검 §1) — canon-showa-kayokyoku (eraCanonPalettes.ts)
  // already existed with fitsGenreIds ['kayokyoku-70s', 'new-music-70s',
  // 'showa-groove-70s'] but was never referenced by any PaletteFamily — see
  // dominantPaletteFamilyId's own doc comment above, which already
  // documented this exact gap ("a palette that isn't in any PaletteFamily
  // at all"). Real effect: showa-70s's own ChannelSoundFloor
  // (usesPaletteFamily true) made resolveMainFamilyId land on
  // family-acoustic-soft (the only family any of this channel's genres
  // belonged to, via japanese-folk-70s's own canon-folk-duo membership) and
  // then filtered the other 3 preferredGenres out as "not compatible with
  // the main family" — forcing every set onto japanese-folk-70s alone (18
  // consecutive same-genre songs).
  //
  // This entry fixes the case where a user explicitly picks this family
  // (Step2Plan's own "이 세트의 계열" picker, or paletteFamilyOverride) — all
  // 4 preferredGenres verified reachable and balanced then. It does NOT yet
  // fix the fully-automatic zero-history default: resolveMainFamilyId's own
  // tie-break (setDirector.ts) falls back to whichever family is FIRST in
  // PALETTE_FAMILIES (family-acoustic-soft) when no recency history or
  // keyword hint exists, regardless of this entry's existence. Making that
  // tie-break channel/language-aware would touch shared resolution logic
  // 3 other archetypes (senior-morning/showa-cafe/oldpop-lounge) also
  // depend on — deliberately left alone here rather than risking their
  // already-passing behavior for one channel's cold-start case.
  {
    id: 'family-showa-kayokyoku',
    labelKo: '쇼와 가요쿄쿠·그루브',
    paletteIds: ['canon-showa-kayokyoku'],
    compatibleWith: ['family-acoustic-soft'],
    standalone: false,
    koreanNoteKo: '일본 70년대 가요쿄쿠·뉴뮤직·쇼와 그루브 계열'
  }
];

export function getPaletteFamilyById(id: string): PaletteFamily | undefined {
  return PALETTE_FAMILIES.find(family => family.id === id);
}

export function paletteFamilyForPaletteId(paletteId: string): PaletteFamily | undefined {
  return PALETTE_FAMILIES.find(family => family.paletteIds.includes(paletteId));
}

const genreIdsByFamilyCache = new Map<string, Set<string>>();

/**
 * genreIds reachable from this family's own palettes, via both a direct
 * data/eraCanonPalettes.ts fitsGenreIds match and the PARTIAL_PALETTE_FALLBACK
 * borrow-map (a genre with no direct palette fit but close enough to borrow
 * one palette's productionTraits — see that file's own doc comment). Memoized
 * since ERA_CANON_PALETTES/PARTIAL_PALETTE_FALLBACK are both static.
 */
export function genreIdsForPaletteFamily(familyId: string): Set<string> {
  const cached = genreIdsByFamilyCache.get(familyId);
  if (cached) return cached;
  const family = getPaletteFamilyById(familyId);
  const ids = new Set<string>();
  if (family) {
    for (const palette of ERA_CANON_PALETTES) {
      if (!family.paletteIds.includes(palette.id)) continue;
      for (const genreId of palette.fitsGenreIds) ids.add(genreId);
    }
    for (const [genreId, paletteId] of Object.entries(PARTIAL_PALETTE_FALLBACK)) {
      if (family.paletteIds.includes(paletteId)) ids.add(genreId);
    }
  }
  genreIdsByFamilyCache.set(familyId, ids);
  return ids;
}

/** genreIds reachable from `familyId` itself plus every family it lists as compatibleWith — the "주 그룹 + 인접 그룹" pool core/setDirector.ts draws from. */
export function genreIdsForFamilyAndCompatible(familyId: string): Set<string> {
  const family = getPaletteFamilyById(familyId);
  const ids = new Set(genreIdsForPaletteFamily(familyId));
  if (family) {
    for (const compatibleId of family.compatibleWith) {
      for (const genreId of genreIdsForPaletteFamily(compatibleId)) ids.add(genreId);
    }
  }
  return ids;
}

/** Which family (if any) a genreId belongs to — first match wins; a genreId reachable from multiple families (e.g. oldpop-orchestral-easy, shared by europop-glow and crooner-standard) is resolved by PALETTE_FAMILIES' own declared order. */
export function paletteFamilyForGenreId(genreId: string | undefined): PaletteFamily | undefined {
  if (!genreId) return undefined;
  return PALETTE_FAMILIES.find(family => genreIdsForPaletteFamily(family.id).has(genreId));
}

/**
 * TASK v4.14 (TASK B) — this pack's dominant family, read straight off its
 * own already-decided genrePlan (majority vote across all tracks) rather
 * than re-deriving it from freeText/history the way core/setDirector.ts's
 * resolveMainFamilyId does at plan time. Used by core/moneyChordPlan.ts to
 * decide whether a pack qualifies for family-aware money-chord distribution
 * at all — a channel/concept whose genres never map to any family (most
 * non-oldpop archetypes) correctly returns undefined, same as before this
 * task. Ties broken by PALETTE_FAMILIES' own declared order (stable,
 * deterministic — never seed-random) since this only ever matters for a
 * pack that's already near-evenly split, which is rare given
 * core/setDirector.ts's own main-family-first genre selection.
 */
export function dominantPaletteFamilyId(genrePlan: readonly (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const genreId of genrePlan) {
    const family = paletteFamilyForGenreId(genreId);
    if (!family) continue;
    counts.set(family.id, (counts.get(family.id) ?? 0) + 1);
  }
  if (!counts.size) return undefined;
  let bestId: string | undefined;
  let bestCount = -1;
  for (const family of PALETTE_FAMILIES) {
    const count = counts.get(family.id) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestId = family.id;
    }
  }
  // A real majority, not just whichever family happens to claim one
  // incidental genre overlap (e.g. showa-cafe's japanese-folk-70s falls
  // under family-acoustic-soft via canon-folk-duo's fitsGenreIds even
  // though the rest of that archetype's genres — kayokyoku-70s,
  // new-music-70s — belong to canon-showa-kayokyoku, a palette that isn't
  // in any PaletteFamily at all). Without this guard a single stray genre
  // could hijack the whole pack's family-aware money-chord distribution
  // away from an archetype's own bespoke rotation pool.
  if (bestCount * 2 < genrePlan.length) return undefined;
  return bestId;
}
