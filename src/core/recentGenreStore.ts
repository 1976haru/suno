const STORAGE_KEY = 'suno-weaver-recent-genres-v1';
const MAX_RECENT_PER_CHANNEL = 12;

type RecentGenreMap = Record<string, string[]>;

function readMap(): RecentGenreMap {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: RecentGenreMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Recent genres are a convenience; blocked storage should not break generation.
  }
}

export function readRecentGenreIds(channelId: string): string[] {
  const map = readMap();
  return Array.isArray(map[channelId]) ? map[channelId] : [];
}

export function rememberRecentGenreId(channelId: string, genreId: string) {
  const map = readMap();
  const current = Array.isArray(map[channelId]) ? map[channelId] : [];
  map[channelId] = [genreId, ...current.filter(id => id !== genreId)].slice(0, MAX_RECENT_PER_CHANNEL);
  writeMap(map);
}
