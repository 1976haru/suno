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

  it('the other 4 workspaces stay not-ready, and 3 of them are still fully skeletal (no archetypes)', () => {
    for (const id of ['kr-2030', 'jp-2030', 'kr-kids', 'jp-kids'] as const) {
      const ws = getWorkspace(id);
      expect(ws.ready).toBe(false);
      expect(ws.labelKo.length).toBeGreaterThan(0);
    }
    for (const id of ['jp-2030', 'kr-kids', 'jp-kids'] as const) {
      expect(getWorkspace(id).archetypeIds).toEqual([]);
    }
  });

  // TASK B1 — kr-2030's genre layer is filled in (6 kr2030-* genres, see
  // genreLibrary/index.ts's kr2030GenrePacks), but the workspace is
  // deliberately NOT flipped to ready=true yet — B2 (lyric world, hooks,
  // titles, thumbnails, UI) still owes that, since opening this workspace
  // today would still serve the senior lyric dictionary underneath it.
  it('kr-2030 has its single archetype registered but stays ready=false until B2', () => {
    const kr2030 = getWorkspace('kr-2030');
    expect(kr2030.archetypeIds).toEqual(['kr-2030-pop']);
    expect(kr2030.ready).toBe(false);
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
