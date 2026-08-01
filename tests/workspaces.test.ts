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

  it('the other 4 workspaces are skeletal only: no archetypes yet, ready=false', () => {
    for (const id of ['kr-2030', 'jp-2030', 'kr-kids', 'jp-kids'] as const) {
      const ws = getWorkspace(id);
      expect(ws.ready).toBe(false);
      expect(ws.archetypeIds).toEqual([]);
      expect(ws.labelKo.length).toBeGreaterThan(0);
    }
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
