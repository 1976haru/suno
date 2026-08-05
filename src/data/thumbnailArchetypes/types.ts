import type { ChannelArchetype, ThumbnailTypographyGuide } from '../../types';

export type { ThumbnailTypographyGuide };

/**
 * TASK v3.38 Part A — full replacement of the v3.38-draft English minimal-
 * editorial set. User-approved direction: an autumn window scene + a fixed
 * left-third text zone + thin Korean serif headline ("그날, 기억나?") + a
 * thin divider + a small subtitle ("추억 감성 플레이리스트"), verified
 * legible down to 168px (desktop sidebar thumbnail size). 6 seasonal
 * archetypes share this one fixed grammar.
 *
 * TASK v3.38 Part B — 3 additional archetypes for the 'kids' channel
 * archetype, deliberately a different visual grammar (bright/saturated,
 * bold rounded Korean font, no thin serif) — see kids*Typography below.
 */
export type ThumbnailArchetypeCategory =
  | 'autumn-window-golden'
  | 'winter-window-snow'
  | 'spring-blossom-window'
  | 'summer-sea-morning'
  | 'rain-window-quiet'
  | 'night-city-warm'
  | 'city-roma'
  | 'city-paris'
  | 'city-barcelona'
  | 'city-prague'
  | 'city-kyoto'
  | 'village-provence'
  | 'showa-70s-kissaten-film'
  | 'j2000s-digital-station'
  | 'modern-chill-neon-room'
  | 'city-night-drive-neon'
  | 'kids-animal-meadow'
  | 'kids-playground-sky'
  | 'kids-cozy-room'
  // TASK B2 — kr-2030 workspace's 3 new archetypes (see kr2030CafeNight.ts /
  // kr2030SeoulStreet.ts / kr2030PersonSilhouette.ts).
  | 'kr2030-cafe-night'
  | 'kr2030-seoul-street'
  | 'kr2030-person-silhouette'
  // TASK C2 — jp-2030 workspace's 3 new archetypes (see jp2030Seasonal.ts /
  // jp2030StationPlatform.ts / jp2030CityNight.ts).
  | 'jp2030-seasonal'
  | 'jp2030-station-platform'
  | 'jp2030-city-night'
  // TASK E1 — kr-kids workspace's 4 new archetypes (see
  // krkidsDailyHabitBathroom.ts / krkidsCountingBlocks.ts /
  // krkidsRoleplayMarket.ts / krkidsBilingualAlphabet.ts).
  | 'krkids-daily-habit-bathroom'
  | 'krkids-counting-blocks'
  | 'krkids-roleplay-market'
  | 'krkids-bilingual-alphabet';

export type ThumbnailArchetypeId = ThumbnailArchetypeCategory;

/**
 * TASK v3.38 Part A — the left-third-for-text / right-two-thirds-for-scene
 * layout is now a fixed structural rule shared by every archetype (channel
 * consistency), not a per-variant choice like the old left/right/top
 * rotation. Kept as a union (rather than removing the concept outright) so
 * the composer's existing zone-threading code didn't need a structural
 * rewrite — every archetype's pool simply contains this one value.
 */
export type ThumbnailTextSafeZone = 'left-third';

export type ThumbnailPeopleMode = 'none' | 'distant-silhouette';

export type ThumbnailTimeOfDay = 'morning' | 'afternoon' | 'golden-hour' | 'evening' | 'night';

export interface ThumbnailArchetype {
  id: ThumbnailArchetypeId;
  category: ThumbnailArchetypeCategory;
  labelKo: string;
  /**
   * TASK B2 — optional channel-archetype scope. Undefined (the existing 19
   * archetypes, left untouched) means "visible for every channel archetype",
   * the exact pre-existing behavior — see
   * thumbnailArchetypes/index.ts's thumbnailArchetypesForArchetype. Only set
   * on new workspace-specific archetypes going forward.
   */
  suitedArchetypes?: ChannelArchetype[];
  /** Place-series scene variants, used by city/village archetypes. */
  sceneCore?: string[];
  /** Small-screen-safe recurring objects for city/village archetypes; max 3. */
  signatureObjects?: string[];
  /** Place-series summary fields for prompt/export readability. */
  lighting?: string;
  palette?: string;
  cameraFeel?: string;
  /** Marker for inheriting the shared app-level negative block. */
  negatives?: string[];
  /** Text-composition defaults, never interpolated into image prompts. */
  placeSeries?: {
    topSubcaption: string;
    mainPhrase: string;
    bottomBrandLine: string;
    bindSeriesTone: boolean;
  };
  subjectPool: string[];
  settingPool: string[];
  compositionPool: string[];
  lightingPool: string[];
  palettePool: string[];
  propPool: string[];
  cameraPool: string[];
  textSafeZone: ThumbnailTextSafeZone[];
  peoplePolicy: string;
  forbiddenElements: string[];
  promptTemplate: string;
  /** TASK v3.38 — recommended on-image typography; never written into promptTemplate or any generated image prompt. */
  recommendedTypography: ThumbnailTypographyGuide;
}

/** TASK v3.38 Part A — the 6 seasonal archetypes' shared typography rule. */
export const KOREAN_SERIF_TYPOGRAPHY: ThumbnailTypographyGuide = {
  font: 'thin Korean serif (e.g. Noto Serif KR Light/ExtraLight), regular weight, up to 2 lines',
  color: '#3A2A1E dark brown on light backgrounds, #FFFFFF white on dark backgrounds',
  outline: 'none',
  shadow: 'very soft, minimal — only enough for legibility',
  divider: true,
  subtitle: true
};

/** TASK v3.38 Part B — the 3 kids archetypes' shared typography rule: bold, rounded, bright, no thin serif. */
export const KIDS_BRIGHT_TYPOGRAPHY: ThumbnailTypographyGuide = {
  font: 'bold rounded Korean font (e.g. Jua, Black Han Sans), single weight, up to 2 lines',
  color: '#FFFFFF white with a bright saturated outline color',
  outline: 'thick, bright, rounded (e.g. deep orange or blue) — child-friendly, not the serif grammar\'s "none"',
  shadow: 'soft drop shadow for pop and legibility',
  divider: false,
  subtitle: false
};
