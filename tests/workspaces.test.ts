import { describe, expect, it } from 'vitest';
import { getWorkspace, getWorkspaceTerm, isFeatureHidden, workspaceDefinitions } from '../src/data/workspaces';

describe('[v4.0 TASK A] workspaceDefinitions', () => {
  it('defines exactly the 5 spec workspaces, each with a unique id', () => {
    const ids = workspaceDefinitions.map(w => w.id);
    expect(ids).toEqual(['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids']);
    expect(new Set(ids).size).toBe(5);
  });

  it('senior-oldpop is fully filled in: real archetypes, ready=true', () => {
    const senior = getWorkspace('senior-oldpop');
    expect(senior.ready).toBe(true);
    expect(senior.archetypeIds.length).toBeGreaterThan(0);
    expect(senior.archetypeIds).toContain('kids'); // this task moves current behavior as-is, nothing removed
    expect(senior.contentTier).toBe('adult');
  });

  // TASK D1 §3-2/§5 — Approach A gave kr-kids/jp-kids their own archetypes
  // (kr-kids-song/jp-kids-song), same per-workspace-archetype convention as
  // kr-2030-pop/jp-2030-pop; still not ready — E1/F1 flip that once each
  // workspace's actual content (genres, hook vocab, thumbnails) lands.
  it('the 2 not-yet-built workspaces stay not-ready, own archetype set but no content yet', () => {
    const expectedArchetypeIds: Record<'kr-kids' | 'jp-kids', string[]> = {
      'kr-kids': ['kr-kids-song'],
      'jp-kids': ['jp-kids-song']
    };
    for (const id of ['kr-kids', 'jp-kids'] as const) {
      const ws = getWorkspace(id);
      expect(ws.ready).toBe(false);
      expect(ws.labelKo.length).toBeGreaterThan(0);
      expect(ws.archetypeIds).toEqual(expectedArchetypeIds[id]);
    }
  });

  // TASK C2 — jp-2030's lyric world/hooks/titles/thumbnails/channel presets
  // all landed and were verified via real 18-song generation (0/18 titles
  // carry senior/showa vocabulary), so this workspace is now fully built —
  // ready=true, same transition kr-2030 made after B2 (see the next test).
  it('jp-2030 is fully built: real archetype, ready=true', () => {
    const jp2030 = getWorkspace('jp-2030');
    expect(jp2030.archetypeIds).toEqual(['jp-2030-pop']);
    expect(jp2030.ready).toBe(true);
    expect(jp2030.contentTier).toBe('adult');
  });

  // TASK B2 — kr-2030's lyric world/hooks/titles/thumbnails/channel presets
  // all landed and were verified via real 18-song generation (0/18 titles
  // carry senior vocabulary), so this workspace is now fully built —
  // ready=true, same status as senior-oldpop.
  it('kr-2030 is fully built: real archetype, ready=true', () => {
    const kr2030 = getWorkspace('kr-2030');
    expect(kr2030.archetypeIds).toEqual(['kr-2030-pop']);
    expect(kr2030.ready).toBe(true);
    expect(kr2030.contentTier).toBe('adult');
  });

  it('kids workspaces are contentTier=children, the 2030 workspaces are adult', () => {
    expect(getWorkspace('kr-kids').contentTier).toBe('children');
    expect(getWorkspace('jp-kids').contentTier).toBe('children');
    expect(getWorkspace('kr-2030').contentTier).toBe('adult');
    expect(getWorkspace('jp-2030').contentTier).toBe('adult');
  });

  it('every workspace has a distinct theme accent', () => {
    const accents = new Set(workspaceDefinitions.map(w => w.theme.accent));
    expect(accents.size).toBe(5);
  });
});

describe('[v4.0 TASK E] getWorkspaceTerm / isFeatureHidden', () => {
  it('falls back to the caller default when a term is not defined for this workspace', () => {
    const ws = getWorkspace('senior-oldpop');
    expect(getWorkspaceTerm(ws, 'setLabel', '플레이리스트 세트')).toBe('플레이리스트 세트');
  });

  it('never hides anything when hiddenFeatures is empty', () => {
    const ws = getWorkspace('senior-oldpop');
    expect(isFeatureHidden(ws, 'artistReferenceInput')).toBe(false);
  });
});
