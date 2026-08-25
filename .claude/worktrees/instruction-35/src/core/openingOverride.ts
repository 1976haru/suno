import type { GenerationOptions, PlaylistBlueprint, SongIdea } from '../types';
import { openingDurationText } from './soundSignature';
import { resolveOpeningStyle } from './localGenerator';

export type PromotableRole = 'cold-open' | 'flagship';

export interface PromoteResult {
  blueprint: PlaylistBlueprint;
  warning?: string;
}

function findFlagshipHolder(songs: SongIdea[], excludeTrackNo: number): SongIdea | undefined {
  return songs.find(song => song.songRole === 'flagship' && song.trackNo !== excludeTrackNo);
}

/**
 * TASK I3 (v3.11, PART D-4) — lets a user override the automatic cold-open/
 * flagship pick without ever touching trackNo (see the brief's "곡 순서를
 * 사후에 물리적으로 재배치하지 말 것" — hookLedger/batch/thumbnail all key off
 * trackNo). Instead this swaps `songRole` (+ the opening-directive part of
 * the style prompt) between the target track and whichever track currently
 * holds that role. Lyrics are never touched — only the duration atom's
 * text, via an exact string replace (safe because song.stylePrompt is only
 * ever set by the generator's own composeStylePrompt output; manual edits
 * in SongCard's textarea are local UI state, never written back here).
 */
export function promoteTrackToOpeningRole(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  targetTrackNo: number,
  role: PromotableRole
): PromoteResult {
  const songs = blueprint.songs;
  const target = songs.find(song => song.trackNo === targetTrackNo);
  if (!target) return { blueprint, warning: '해당 곡을 찾을 수 없습니다.' };
  if (target.songRole === role) return { blueprint };

  const holder = role === 'cold-open' ? songs.find(song => song.trackNo === 1) : findFlagshipHolder(songs, targetTrackNo);
  if (!holder || holder.trackNo === target.trackNo) {
    return { blueprint, warning: '교체할 대상 곡을 찾지 못했습니다.' };
  }

  const targetOldRole = target.songRole || 'unknown';
  const targetOldOpeningStyle = target.openingStyle;
  const newOpeningStyleForTarget = role === 'cold-open' ? resolveOpeningStyle(opts.openingStyle, opts.channel.archetype) : undefined;

  function applyRoleSwap(
    song: SongIdea,
    oldRole: string,
    oldOpeningStyle: 'hook-forward' | 'hum-intro' | undefined,
    newRole: string,
    newOpeningStyle: 'hook-forward' | 'hum-intro' | undefined
  ): SongIdea {
    const oldText = openingDurationText(oldRole, oldOpeningStyle, opts.durationTarget);
    const newText = openingDurationText(newRole, newOpeningStyle, opts.durationTarget);
    const nextStylePrompt = oldText !== newText && song.stylePrompt.includes(oldText)
      ? song.stylePrompt.replace(oldText, newText)
      : song.stylePrompt;
    return { ...song, songRole: newRole, openingStyle: newOpeningStyle, stylePrompt: nextStylePrompt };
  }

  const nextTarget = applyRoleSwap(target, targetOldRole, targetOldOpeningStyle, role, newOpeningStyleForTarget);
  const nextHolder = applyRoleSwap(holder, holder.songRole || 'unknown', holder.openingStyle, targetOldRole, targetOldOpeningStyle);

  const nextSongs = songs.map(song => {
    if (song.trackNo === nextTarget.trackNo) return nextTarget;
    if (song.trackNo === nextHolder.trackNo) return nextHolder;
    return song;
  });

  // TASK I3 — defensive re-check only: promotion never changes hookPhrase or
  // title, so this should never actually fire. Kept because the brief
  // explicitly asks for hook-collision re-validation on promotion.
  const seenHooks = new Map<string, number[]>();
  for (const song of nextSongs) {
    const key = song.hookPhrase.trim().toLowerCase();
    seenHooks.set(key, [...(seenHooks.get(key) || []), song.trackNo]);
  }
  const collisions = Array.from(seenHooks.values()).filter(trackNos => trackNos.length > 1);
  const warning = collisions.length
    ? `승격 후 훅이 겹치는 곡이 있습니다: ${collisions.map(trackNos => trackNos.join('/')).join(', ')}`
    : undefined;

  return { blueprint: { ...blueprint, songs: nextSongs }, warning };
}
