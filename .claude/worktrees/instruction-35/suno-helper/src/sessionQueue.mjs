/**
 * TASK v3.31 (Part 2, ②-2 안전·안내) — hard guard on how many songs one
 * helper run will touch. Default is conservative (20) since this tool
 * drives the user's real Suno account; --max=N can raise or lower it, but
 * nothing about this function makes the default any less conservative.
 */
export const DEFAULT_MAX_SONGS_PER_SESSION = 20;

export function resolveSessionQueue(songs, maxSongs = DEFAULT_MAX_SONGS_PER_SESSION) {
  const limit = Number.isFinite(Number(maxSongs)) && Number(maxSongs) > 0 ? Math.floor(Number(maxSongs)) : DEFAULT_MAX_SONGS_PER_SESSION;
  const queue = songs.slice(0, limit);
  return { queue, limited: songs.length > limit, limit };
}
