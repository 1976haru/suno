import type { ChannelArchetype, GenrePack } from '../../types';

export type GenreTier = 'core' | 'extended';

export interface GenrePreset extends GenrePack {
  archetypes: ChannelArchetype[];
  tier: GenreTier;
}
