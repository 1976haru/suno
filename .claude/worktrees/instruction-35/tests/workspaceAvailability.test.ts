import { describe, expect, it } from 'vitest';
import { workspaceAvailability, workspaceAvailabilityFor } from '../src/data/workspaceAvailability';
import { workspaceDefinitions } from '../src/data/workspaces';
import { FEATURES } from '../src/data/featureFlags';

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

/**
 * codex 지시문 07 (TASK G) — "UI·preflight·routing·tests에서 같은 상태": real
 * cross-consistency coverage. workspaceAvailability (by id) and
 * workspaceAvailabilityFor (already-resolved object) must always agree for
 * a real workspace, and data/featureFlags.ts's own derived 4 kr2030/jp2030/
 * krKids/jpKids statuses must match workspaceAvailability's own verdict —
 * one real status, read the same way everywhere, not three independently-
 * correct-today copies.
 */
describe('[codex 지시문 07 TASK G] workspaceAvailability / workspaceAvailabilityFor / featureFlags — one shared status', () => {
  it('the by-id and already-resolved-object variants agree for every real workspace', () => {
    for (const ws of workspaceDefinitions) {
      expect(workspaceAvailabilityFor(ws)).toEqual(workspaceAvailability(ws.id));
    }
  });

  it('data/featureFlags.ts\'s own kr2030/jp2030/krKids/jpKids statuses match workspaceAvailability\'s real verdict for each workspace', () => {
    const pairs: [keyof typeof FEATURES, string][] = [['kr2030', 'kr-2030'], ['jp2030', 'jp-2030'], ['krKids', 'kr-kids'], ['jpKids', 'jp-kids']];
    for (const [featureKey, workspaceId] of pairs) {
      const expected = workspaceAvailability(workspaceId as Parameters<typeof workspaceAvailability>[0]).status === 'ready' ? 'production' : 'scaffold';
      expect(FEATURES[featureKey]).toBe(expected);
    }
  });
});
