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

// 지시문 21 (TASK A) — kr2030-noir-deep-house는 강사 원문에 따라
// archetypes: ['kr-2030-pop', 'city-night'] 둘 다를 명시적으로 요구한다.
// city-night는 senior-oldpop 워크스페이스 소속이라, prefix 기반 기본값
// (kr2030- -> kr-2030 단독 소유)만으로는 이 장르가 senior-oldpop의
// city-night 풀에 나타날 때 checkL1이 진짜 누출로 오판한다 — kridol-*가
// kr-idol-male/kr-idol-female 두 워크스페이스에 의도적으로 공유되는 것과
// 동일한 논리로, 이 한 장르만 명시적 다대다 소유로 등록한다(비밀리에
// 격리 규칙을 우회하는 게 아니라 정직하게 선언).
// 지시문 71 (TASK A) — chill-rap/boom-bap-mellow/jazz-rap/lofi-hiphop-study/
// trap-soul/alt-rnb는 §11 "하지 말 것"에 따라 소유권을 옮기지 않는다(원래
// senior-oldpop 소유, prefix 없는 레거시 id라 아래 기본값으로 떨어진다) —
// en-chillhop을 "참조"로만 추가한다. kr2030-noir-deep-house와 같은 명시적
// 다대다 소유 패턴.
const EXPLICIT_MULTI_WORKSPACE_GENRE_IDS: Readonly<Record<string, WorkspaceId[]>> = {
  'kr2030-noir-deep-house': ['kr-2030', 'senior-oldpop'],
  'chill-rap': ['senior-oldpop', 'en-chillhop'],
  'boom-bap-mellow': ['senior-oldpop', 'en-chillhop'],
  'jazz-rap': ['senior-oldpop', 'en-chillhop'],
  'lofi-hiphop-study': ['senior-oldpop', 'en-chillhop'],
  'trap-soul': ['senior-oldpop', 'en-chillhop'],
  'alt-rnb': ['senior-oldpop', 'en-chillhop']
};

function genreWorkspacesOf(genreId: string): WorkspaceId[] {
  if (EXPLICIT_MULTI_WORKSPACE_GENRE_IDS[genreId]) return EXPLICIT_MULTI_WORKSPACE_GENRE_IDS[genreId];
  if (genreId.startsWith('kr2030-')) return ['kr-2030'];
  if (genreId.startsWith('jp2030-')) return ['jp-2030'];
  if (genreId.startsWith('krkids-')) return ['kr-kids'];
  if (genreId.startsWith('jpkids-')) return ['jp-kids'];
  // The one genuinely shared genre pool in the codebase today (verified:
  // every kridol-* genre pack entry sets `archetypes: ['kr-idol-male', 'kr-idol-female']`).
  if (genreId.startsWith('kridol-')) return ['kr-idol-male', 'kr-idol-female'];
  // 지시문 71 (TASK A) — en-deep-house-*/en-house-garage-swing, 이
  // 워크스페이스 전용 신규 id.
  if (genreId.startsWith('en-')) return ['en-chillhop'];
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
