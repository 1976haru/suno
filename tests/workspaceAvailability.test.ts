import { describe, expect, it } from 'vitest';
import { workspaceAvailability } from '../src/data/workspaceAvailability';
import { workspaceDefinitions } from '../src/data/workspaces';

/**
 * codex 지시문 02 (TASK I) — workspaceAvailability is a thin wrapper around
 * the already-real WorkspaceDefinition.ready mechanism (see the module's own
 * doc comment). This just proves the derivation is correct and stays correct
 * for every real workspace, not just one hand-picked case.
 */
describe('[codex 지시문 02 TASK I] workspaceAvailability', () => {
  it('every currently-shipped workspace (ready: true) reports status "ready"', () => {
    for (const ws of workspaceDefinitions) {
      expect(ws.ready, `expected ${ws.id} to be ready in today's real data`).toBe(true);
      expect(workspaceAvailability(ws.id)).toEqual({ status: 'ready' });
    }
  });

  it('no live workspace exercises the "scaffold" branch today (matches generationPreflight.ts\'s own workspaceScaffoldHardBlock doc comment: kept as a structural guard, no current live trigger)', () => {
    expect(workspaceDefinitions.every(ws => ws.ready)).toBe(true);
  });
});
