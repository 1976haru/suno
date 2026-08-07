/**
 * codex 지시문 02 (TASK H) — promotion of scripts/isolationAudit.ts's own
 * GENRE_WORKSPACE_MAP/isGenreForeignToWorkspace into an src/-importable
 * location, under the spec's own literal names. Real-source-verified prior
 * art (see isolationAudit.ts's own TASK G doc comment this was moved from):
 * this many-to-many genre-to-workspace mapping already existed — GenrePack's
 * own `archetypes?: ChannelArchetype[]` field is already an array (kridol-*
 * genres already list both kr-idol-male and kr-idol-female), so this is a
 * genuine promotion/rename, not a new data model. isolationAudit.ts now
 * imports from here instead of keeping its own copy (this codebase's own
 * established §6-2 "don't duplicate the check logic" principle).
 */
import { genrePacks as resolvedGenrePacks } from './presets';
import type { WorkspaceId } from '../types';

export type GenreWorkspaceOwnership = Record<string, WorkspaceId[]>;

function genreWorkspacesOf(genreId: string): WorkspaceId[] {
  if (genreId.startsWith('kr2030-')) return ['kr-2030'];
  if (genreId.startsWith('jp2030-')) return ['jp-2030'];
  if (genreId.startsWith('krkids-')) return ['kr-kids'];
  if (genreId.startsWith('jpkids-')) return ['jp-kids'];
  // The one genuinely shared genre pool in the codebase today (verified:
  // every kridol-* genre pack entry sets `archetypes: ['kr-idol-male', 'kr-idol-female']`).
  if (genreId.startsWith('kridol-')) return ['kr-idol-male', 'kr-idol-female'];
  return ['senior-oldpop'];
}

export const GENRE_WORKSPACE_OWNERSHIP: GenreWorkspaceOwnership = Object.fromEntries(
  resolvedGenrePacks.map(g => [g.id, genreWorkspacesOf(g.id)])
);

export function allowedWorkspacesForGenre(genreId: string): WorkspaceId[] {
  return GENRE_WORKSPACE_OWNERSHIP[genreId] ?? ['senior-oldpop'];
}

export function isGenreForeignToWorkspace(genreId: string, workspaceId: WorkspaceId): boolean {
  return !allowedWorkspacesForGenre(genreId).includes(workspaceId);
}
