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
    paletteIds: [
      'canon-folk-duo', 'canon-soft-pop-duo', 'canon-country-folk',
      'canon-soft-rock-band', 'canon-warm-gentle-acoustic'
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
