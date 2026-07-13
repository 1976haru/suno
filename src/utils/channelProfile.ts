import type { ChannelProfile } from '../types';

const STORAGE_KEY = 'suno-weaver-custom-channels-v2';

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44) || `channel-${Date.now()}`;
}

export function makeUniqueId(label: string, existingIds: Set<string>, currentId?: string) {
  const root = slugify(label);
  let candidate = root;
  let suffix = 2;
  while (existingIds.has(candidate) && candidate !== currentId) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function normalizeChannel(input: Partial<ChannelProfile>): ChannelProfile {
  return {
    id: input.id || `channel-${Date.now()}`,
    name: input.name?.trim() || 'Untitled Channel',
    englishName: input.englishName?.trim() || input.name?.trim() || 'Untitled Channel',
    market: input.market || 'custom',
    primaryLanguage: input.primaryLanguage || 'english',
    audience: input.audience || 'allAges',
    promise: input.promise?.trim() || 'custom playlist channel concept',
    visualIdentity: input.visualIdentity?.trim() || 'consistent thumbnail layout, readable typography, recognizable channel colors',
    defaultVocal: input.defaultVocal?.trim() || 'clear emotional vocal, polished playlist-friendly delivery',
    preferredGenres: input.preferredGenres?.length ? input.preferredGenres : ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: input.preferredMoods?.length ? input.preferredMoods : ['warm', 'hopeful'],
    forbiddenCliches: input.forbiddenCliches?.length ? input.forbiddenCliches : ['famous artist imitation', 'copied song structure'],
    seoKeywords: input.seoKeywords || [],
    // v3.4 — channels saved before archetypes existed have no `archetype` field;
    // they fall back to 'senior-morning' rather than an unscoped/empty hook bank.
    archetype: input.archetype || 'senior-morning'
  };
}

export function createDraftChannel(name = 'New Playlist Channel'): ChannelProfile {
  return normalizeChannel({
    id: slugify(name),
    name,
    englishName: name,
    market: 'custom',
    primaryLanguage: 'english',
    audience: 'allAges',
    promise: 'creator-defined playlist channel with a clear listener promise',
    visualIdentity: 'consistent colors, readable thumbnail typography, clear seasonal object',
    defaultVocal: 'clear emotional vocal, polished playlist-friendly delivery',
    preferredGenres: ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: ['warm', 'hopeful'],
    forbiddenCliches: ['famous artist imitation', 'copied song structure'],
    seoKeywords: []
  });
}

export function readStoredChannels(): ChannelProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => normalizeChannel(item)).filter(channel => channel.id);
  } catch {
    return [];
  }
}

export function writeStoredChannels(channels: ChannelProfile[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  } catch {
    // Storage can be blocked in private or embedded browser contexts.
  }
}
