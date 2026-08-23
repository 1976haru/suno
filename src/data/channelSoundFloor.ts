import type { ChannelArchetype, WorkspaceId } from '../types';

/**
 * TASK v4.7 (TASK A) — v4.6's eraCanonPalettes.ts guarantees a real 60s-70s
 * sound whenever a song's genre happens to fall inside one of its 7
 * palettes (~15 genre ids). Real testing found that once a concept picks a
 * genre outside that coverage (chanson, bossa-cafe, ...), the era feel
 * disappears again — v3.58 solved the analogous problem for senior
 * listenability by making `AudienceProfile` a per-song-guaranteed floor
 * the concept can't remove; this is the same pattern applied to the 60s-70s
 * *sound*, not the audience's listening comfort.
 *
 * A ChannelSoundFloor is workspace-level (not per-genre like a palette),
 * always-on regardless of which genre/concept a song ends up with.
 */
export interface ChannelSoundFloor {
  id: string;
  workspaceId: WorkspaceId;
  labelKo: string;

  /**
   * v4.7 own addition, not in the spec's literal type sketch — narrows
   * which archetypes WITHIN this workspace the floor actually applies to.
   * senior-oldpop workspace also holds modern-chill/city-night/lofi-study
   * (explicitly modern/digital-production archetypes by their own genre
   * definitions) and kids (a different concern entirely); applying "warm
   * analog, no digital synth pads" to those would contradict their own
   * established sound rather than protect it. Undefined = applies to every
   * archetype in the workspace (kept as an option for a future workspace
   * whose every archetype genuinely shares one production era).
   */
  archetypeIds?: ChannelArchetype[];

  /** Every song's stylePrompt. Concept can never remove these — see core/localGenerator.ts's ESSENTIAL_TERM_IDS treatment. */
  requiredAtoms: string[];
  /** Every song's excludePrompt. Concept can never remove these. */
  forbiddenAtoms: string[];

  /** Production eras this channel allows — informational (era-exclusion logic already exists in data/eraExclusions.ts; this documents the floor's own intent rather than driving new blocking). */
  productionEraTags: string[];

  /**
   * v5.7 (TASK C) — real investigation finding: core/setDirector.ts's own
   * palette-family selection (`mainFamilyId`/`capCompatibleFamilySongs`) and
   * core/designGate.ts's `paletteCoverageIssues` both used to key off mere
   * PRESENCE of a ChannelSoundFloor, not this flag — fine while senior-oldpop
   * was the only floor that existed, but data/paletteFamilies.ts and
   * data/eraCanonPalettes.ts only ever covered senior's ~15 oldpop genre ids.
   * Tracing `capCompatibleFamilySongs` by hand: for a workspace whose genres
   * have ZERO palette-family membership, `mainGenreIds` would be empty,
   * EVERY selected genre would count as "compatible" (not main), the whole
   * pack would exceed the 5-song compatible cap, and the removed songs would
   * have nowhere to go back to (no "main" genre exists to redistribute onto)
   * — silently shrinking an 18-song kr-2030 pack down to ~5 songs' worth of
   * genre allocation. `paletteCoverageIssues` had the same problem from the
   * other direction: `maxUncoveredGenreTracks` would trip on effectively
   * every track since none are ever "covered". Both are real regressions a
   * naive kr-2030/jp-2030/kr-idol-* floor entry would have introduced.
   * `requiredAtoms`/`forbiddenAtoms` (core/promptComposer.ts) have no such
   * coupling — they're a plain floor-presence lookup — so this flag scopes
   * ONLY the two palette-family-system call sites, defaulting false/
   * undefined for every floor except senior-oldpop's own (set explicitly
   * below, preserving its exact pre-existing behavior).
   */
  usesPaletteFamily?: boolean;

  /**
   * v5.7 (TASK C) — the three fields below are read ONLY by
   * core/designGate.ts's `paletteCoverageIssues`, which now bails out
   * entirely when `usesPaletteFamily` is falsy (see that field's own doc
   * comment) — for every floor other than senior-oldpop's, these three
   * numbers are inert placeholders, never actually consulted. Kept
   * non-optional/present (rather than `?`) so a future floor that DOES turn
   * on `usesPaletteFamily` can't forget to set them.
   */
  minPaletteVariety: number;
  /**
   * TASK v4.9 (TASK A, §1-4) — real listening feedback: "18곡 조합이 어색...
   * 맛있는 일식·중식·한식이 같이 나온 느낌" traced to the old minPaletteVariety:3
   * forcing 3+ distinct palettes into a set with no ceiling and no
   * family-cohesion concept — see data/paletteFamilies.ts's own doc comment.
   * A set now stays within one PaletteFamily (± a capped compatible-family
   * minority, enforced in core/setDirector.ts), so palette variety is
   * re-scoped to WITHIN that family: minPaletteVariety dropped 3->2 (2-4
   * distinct palettes from the same family reads as varied, not repetitive),
   * and this new ceiling stops the family-internal count from creeping back
   * up toward the old jumbled feel.
   */
  maxPaletteVariety: number;
  maxUncoveredGenreTracks: number;

  noteKo: string;
}

export const CHANNEL_SOUND_FLOORS: ChannelSoundFloor[] = [
  {
    id: 'senior-oldpop-floor',
    workspaceId: 'senior-oldpop',
    labelKo: '6070 올드팝 사운드 바닥',
    archetypeIds: ['senior-morning', 'showa-cafe', 'oldpop-lounge', 'showa-70s'],
    // v5.7 (TASK C) — the only floor that actually uses the palette-family
    // system; see `usesPaletteFamily`'s own doc comment. Explicit true here
    // preserves this floor's exact pre-existing behavior unchanged.
    usesPaletteFamily: true,

    requiredAtoms: [
      'warm analog studio sound',
      'acoustic instruments carry the arrangement',
      'narrow warm stereo image'
    ],

    forbiddenAtoms: [
      'gated reverb',
      'sidechain compression',
      'modern wide stereo production',
      'digital synth pads',
      'sub bass',
      'autotuned vocal',
      'trap hi-hats',
      'lo-fi vinyl crackle effect'
    ],

    productionEraTags: ['1950s-60s', '1970s', '1980s'],

    minPaletteVariety: 2,
    maxPaletteVariety: 4,
    maxUncoveredGenreTracks: 4,

    noteKo: '어떤 컨셉이 와도 이 조건은 유지됩니다. 컨셉은 장면·감정·계절만 바꿉니다'
  },
  /**
   * v5.7 (TASK C) — real audit finding: these 4 workspaces had no
   * ChannelSoundFloor at all, so nothing stopped a concept from drifting
   * into senior/vintage territory (the v5.6 audit's own contamination
   * findings). requiredAtoms/forbiddenAtoms below intentionally overlap in
   * substance with each workspace's own AudienceProfile constraints/
   * exclusions (data/audienceProfiles.ts, v5.7 TASK B) — that's expected,
   * not redundant: AudienceProfile's constraints are droppable under hard
   * promptBudget pressure (see AudienceProfile's own doc comment), while a
   * ChannelSoundFloor's atoms never are (core/localGenerator.ts's
   * ESSENTIAL_TERM_IDS treatment) — this is the same two-tier relationship
   * senior-oldpop's own two mechanisms already have. minPaletteVariety/
   * maxPaletteVariety/maxUncoveredGenreTracks are inert here (see
   * `usesPaletteFamily`'s own doc comment) — no ERA_CANON_PALETTES/
   * PaletteFamily data exists for any of these 4 workspaces' genres yet
   * (out of this task's scope; a real per-workspace palette system would be
   * its own future task).
   */
  {
    id: 'kr-2030-floor',
    workspaceId: 'kr-2030',
    labelKo: '한국 2030 사운드 바닥',
    archetypeIds: ['kr-2030-pop'],
    requiredAtoms: [
      'contemporary Korean urban-pop production',
      'bass and drums carry the groove'
    ],
    forbiddenAtoms: [
      'vintage tape saturation',
      '1970s AM-radio compression',
      'nostalgic senior-radio announcer tone'
    ],
    productionEraTags: ['2020s'],
    minPaletteVariety: 0,
    maxPaletteVariety: 0,
    maxUncoveredGenreTracks: 0,
    noteKo: '어떤 컨셉이 와도 이 조건은 유지됩니다 — 시니어/빈티지 질감으로 흘러가지 않게 막는 바닥입니다'
  },
  {
    id: 'jp-2030-floor',
    workspaceId: 'jp-2030',
    labelKo: '일본 2030 사운드 바닥',
    archetypeIds: ['jp-2030-pop'],
    requiredAtoms: [
      'contemporary Japanese melodic pop/rock production',
      'guitar and piano-led arrangement'
    ],
    forbiddenAtoms: [
      'vintage tape saturation',
      'showa-era AM-radio compression',
      'nostalgic senior-radio announcer tone'
    ],
    productionEraTags: ['2020s'],
    minPaletteVariety: 0,
    maxPaletteVariety: 0,
    maxUncoveredGenreTracks: 0,
    noteKo: '어떤 컨셉이 와도 이 조건은 유지됩니다 — 쇼와/빈티지 질감으로 흘러가지 않게 막는 바닥입니다'
  },
  {
    id: 'kr-idol-male-floor',
    workspaceId: 'kr-idol-male',
    labelKo: '한국 남자 아이돌 사운드 바닥',
    archetypeIds: ['kr-idol-male'],
    requiredAtoms: [
      'punchy contemporary K-pop production built for choreography',
      'driving rhythm section with a strong beat'
    ],
    forbiddenAtoms: [
      'vintage tape saturation',
      'nostalgic senior-radio announcer tone',
      'slow ballad pacing'
    ],
    productionEraTags: ['2020s'],
    minPaletteVariety: 0,
    maxPaletteVariety: 0,
    maxUncoveredGenreTracks: 0,
    noteKo: '어떤 컨셉이 와도 이 조건은 유지됩니다 — 시니어/빈티지 질감이나 느린 발라드 페이싱으로 흘러가지 않게 막는 바닥입니다'
  },
  {
    id: 'kr-idol-female-floor',
    workspaceId: 'kr-idol-female',
    labelKo: '한국 여자 아이돌 사운드 바닥',
    archetypeIds: ['kr-idol-female'],
    requiredAtoms: [
      'punchy contemporary K-pop production built for choreography',
      'driving rhythm section with a strong beat'
    ],
    forbiddenAtoms: [
      'vintage tape saturation',
      'nostalgic senior-radio announcer tone',
      'slow ballad pacing'
    ],
    productionEraTags: ['2020s'],
    minPaletteVariety: 0,
    maxPaletteVariety: 0,
    maxUncoveredGenreTracks: 0,
    noteKo: '어떤 컨셉이 와도 이 조건은 유지됩니다 — 시니어/빈티지 질감이나 느린 발라드 페이싱으로 흘러가지 않게 막는 바닥입니다'
  },
  {
    // 지시문 71 (TASK A) — 신규 워크스페이스, kr-2030-floor와 같은 성격
    // (성인 도시 프로덕션) — 팔레트 패밀리 시스템은 이 워크스페이스의
    // 장르에 데이터가 없으므로 usesPaletteFamily는 여전히 false(기본값).
    id: 'en-chillhop-floor',
    workspaceId: 'en-chillhop',
    labelKo: '칠랩·딥하우스 사운드 바닥',
    archetypeIds: ['en-chillhop'],
    requiredAtoms: [
      'contemporary urban production',
      'bass and drums carry the groove'
    ],
    forbiddenAtoms: [
      'vintage tape saturation',
      '1970s AM-radio compression',
      'nostalgic senior-radio announcer tone'
    ],
    productionEraTags: ['2020s'],
    minPaletteVariety: 0,
    maxPaletteVariety: 0,
    maxUncoveredGenreTracks: 0,
    noteKo: '어떤 컨셉이 와도 이 조건은 유지됩니다 — 시니어/빈티지 질감으로 흘러가지 않게 막는 바닥입니다'
  }
];

export function channelSoundFloorForArchetype(archetype: ChannelArchetype | undefined): ChannelSoundFloor | undefined {
  if (!archetype) return undefined;
  return CHANNEL_SOUND_FLOORS.find(floor => !floor.archetypeIds || floor.archetypeIds.includes(archetype));
}
