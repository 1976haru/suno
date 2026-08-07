/**
 * codex 지시문 02 (TASK I) — thin, literal-API wrapper the spec asks for.
 * Real-source-verified precedent: WorkspaceDefinition.ready (this file's own
 * doc comment, data/workspaces/index.ts) is already the one live mechanism
 * that gates workspace usability — WorkspaceSelectScreen.tsx's card styling
 * and core/generationPreflight.ts's workspaceScaffoldHardBlock both read it
 * directly (see that function's own doc comment for why data/featureFlags.ts's
 * separate, currently-unread 'scaffold' FeatureStatus values for kr2030/
 * jp2030/krKids/jpKids are NOT the real gate). No live workspace today needs
 * 'beta' or 'disabled' — every one of the 7 shipped workspaces has
 * `ready: true` — so this is future-proofing the API shape, not fixing a bug
 * (matches data/featureFlags.ts's own statusForWorkspace precedent: derive
 * from `ready`, never hand-maintain a second value that can drift).
 */
import type { WorkspaceId } from '../types';
import { getWorkspace } from './workspaces';

export interface WorkspaceAvailability {
  status: 'ready' | 'beta' | 'scaffold' | 'disabled';
  reason?: string;
}

export function workspaceAvailability(id: WorkspaceId): WorkspaceAvailability {
  const workspace = getWorkspace(id);
  if (workspace.ready) return { status: 'ready' };
  return { status: 'scaffold', reason: `"${workspace.labelKo}" 워크스페이스는 아직 준비 중입니다.` };
}
