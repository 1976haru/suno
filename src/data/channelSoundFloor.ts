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

  minPaletteVariety: number;
  maxUncoveredGenreTracks: number;

  noteKo: string;
}

export const CHANNEL_SOUND_FLOORS: ChannelSoundFloor[] = [
  {
    id: 'senior-oldpop-floor',
    workspaceId: 'senior-oldpop',
    labelKo: '6070 올드팝 사운드 바닥',
    archetypeIds: ['senior-morning', 'showa-cafe', 'oldpop-lounge', 'showa-70s'],

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

    minPaletteVariety: 3,
    maxUncoveredGenreTracks: 4,

    noteKo: '어떤 컨셉이 와도 이 조건은 유지됩니다. 컨셉은 장면·감정·계절만 바꿉니다'
  }
];

export function channelSoundFloorForArchetype(archetype: ChannelArchetype | undefined): ChannelSoundFloor | undefined {
  if (!archetype) return undefined;
  return CHANNEL_SOUND_FLOORS.find(floor => !floor.archetypeIds || floor.archetypeIds.includes(archetype));
}
