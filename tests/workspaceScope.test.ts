import { afterEach, describe, expect, it } from 'vitest';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, scopedKey, scopeFilter, setCurrentWorkspace, __resetWorkspaceScopeForTests } from '../src/core/workspaceScope';

afterEach(() => {
  __resetWorkspaceScopeForTests();
});

describe('[v4.0 TASK B] currentWorkspaceId / setCurrentWorkspace', () => {
  it('defaults to senior-oldpop before anything is ever selected', () => {
    expect(currentWorkspaceId()).toBe('senior-oldpop');
    expect(DEFAULT_WORKSPACE_ID).toBe('senior-oldpop');
  });

  it('reflects the last workspace set, in-memory (Node has no window/localStorage)', () => {
    setCurrentWorkspace('kr-2030');
    expect(currentWorkspaceId()).toBe('kr-2030');
  });
});

describe('[v4.0 TASK B] scopedKey', () => {
  it('prefixes a key with the current workspace id', () => {
    setCurrentWorkspace('jp-kids');
    expect(scopedKey('recentGenres')).toBe('jp-kids::recentGenres');
  });

  it('two different workspaces get two different keys for the same logical name', () => {
    setCurrentWorkspace('kr-2030');
    const a = scopedKey('custom-channels');
    setCurrentWorkspace('jp-2030');
    const b = scopedKey('custom-channels');
    expect(a).not.toBe(b);
  });
});

describe('[v4.0 TASK B] scopeFilter', () => {
  it('keeps only records tagged with the current workspace', () => {
    setCurrentWorkspace('kr-2030');
    const items = [
      { id: 1, workspaceId: 'kr-2030' as const },
      { id: 2, workspaceId: 'jp-2030' as const },
      { id: 3, workspaceId: 'kr-2030' as const }
    ];
    expect(scopeFilter(items).map(i => i.id)).toEqual([1, 3]);
  });

  it('treats a record with no workspaceId as senior-oldpop (pre-migration safety net), never hides it silently', () => {
    setCurrentWorkspace('senior-oldpop');
    const items = [{ id: 1 }, { id: 2, workspaceId: 'kr-2030' as const }];
    expect(scopeFilter(items).map(i => i.id)).toEqual([1]);
  });

  it('an unscoped record does not leak into a non-default workspace', () => {
    setCurrentWorkspace('kr-2030');
    const items = [{ id: 1 }];
    expect(scopeFilter(items)).toEqual([]);
  });

  it('never throws on an empty list', () => {
    expect(scopeFilter([])).toEqual([]);
  });

  it('an explicit forWorkspace override reads a DIFFERENT workspace without touching the shared current-workspace global', () => {
    setCurrentWorkspace('senior-oldpop');
    const items = [
      { id: 1, workspaceId: 'senior-oldpop' as const },
      { id: 2, workspaceId: 'kr-2030' as const }
    ];
    expect(scopeFilter(items, 'kr-2030').map(i => i.id)).toEqual([2]);
    // the override must never leak into the module-level "current" workspace
    expect(currentWorkspaceId()).toBe('senior-oldpop');
  });

  it('two concurrent overrides never race each other (no shared mutable state to interleave)', async () => {
    setCurrentWorkspace('senior-oldpop');
    const items = [
      { id: 1, workspaceId: 'senior-oldpop' as const },
      { id: 2, workspaceId: 'kr-2030' as const }
    ];
    const [a, b] = await Promise.all([
      Promise.resolve(scopeFilter(items, 'senior-oldpop')),
      Promise.resolve(scopeFilter(items, 'kr-2030'))
    ]);
    expect(a.map(i => i.id)).toEqual([1]);
    expect(b.map(i => i.id)).toEqual([2]);
  });
});
