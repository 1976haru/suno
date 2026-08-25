import { describe, expect, it } from 'vitest';
import { allowedWorkspacesForGenre, isGenreForeignToWorkspace, GENRE_WORKSPACE_OWNERSHIP } from '../src/data/genreWorkspaceOwnership';
import { genrePacks } from '../src/data/presets';

/**
 * codex 지시문 02 (TASK H) — src/data/genreWorkspaceOwnership.ts is a
 * promotion of scripts/isolationAudit.ts's own GENRE_WORKSPACE_MAP/
 * isGenreForeignToWorkspace (see that file's own TASK H doc comment) under
 * the spec's literal names. This covers the module directly, independent of
 * the isolation-audit script; tests/workspaceDataIsolation.test.ts already
 * covers the checkL1 integration end of this via the same shared module.
 */
describe('[codex 지시문 02 TASK H] genreWorkspaceOwnership', () => {
  function realGenreIdWithPrefix(prefix: string): string {
    const id = genrePacks.find(g => g.id.startsWith(prefix))?.id;
    expect(id, `no real genre id with prefix ${prefix} found in genrePacks`).toBeDefined();
    return id!;
  }

  it('kr2030-/jp2030-/krkids-/jpkids- prefixed genres map to exactly one workspace each', () => {
    expect(allowedWorkspacesForGenre(realGenreIdWithPrefix('kr2030-'))).toEqual(['kr-2030']);
    expect(allowedWorkspacesForGenre(realGenreIdWithPrefix('jp2030-'))).toEqual(['jp-2030']);
    expect(allowedWorkspacesForGenre(realGenreIdWithPrefix('krkids-'))).toEqual(['kr-kids']);
    expect(allowedWorkspacesForGenre(realGenreIdWithPrefix('jpkids-'))).toEqual(['jp-kids']);
  });

  it('a real kridol- genre id maps to BOTH kr-idol-male and kr-idol-female (genuinely shared pool, not a leak)', () => {
    const kridolId = genrePacks.find(g => g.id.startsWith('kridol-'))?.id;
    expect(kridolId, 'no kridol- genre found in real genrePacks').toBeDefined();
    expect(allowedWorkspacesForGenre(kridolId!)).toEqual(['kr-idol-male', 'kr-idol-female']);
    expect(isGenreForeignToWorkspace(kridolId!, 'kr-idol-female')).toBe(false);
    expect(isGenreForeignToWorkspace(kridolId!, 'kr-idol-male')).toBe(false);
  });

  it('an unrecognized-prefix genre id defaults to senior-oldpop (the pre-C1 legacy pool)', () => {
    expect(allowedWorkspacesForGenre('some-legacy-genre-id')).toEqual(['senior-oldpop']);
  });

  it('isGenreForeignToWorkspace correctly flags a genre outside its own owning workspace(s)', () => {
    const kr2030Id = realGenreIdWithPrefix('kr2030-');
    expect(isGenreForeignToWorkspace(kr2030Id, 'jp-2030')).toBe(true);
    expect(isGenreForeignToWorkspace(kr2030Id, 'kr-2030')).toBe(false);
  });

  it('GENRE_WORKSPACE_OWNERSHIP has one real entry per registered genre pack', () => {
    for (const g of genrePacks) {
      expect(GENRE_WORKSPACE_OWNERSHIP[g.id], `missing ownership entry for ${g.id}`).toBeDefined();
    }
  });
});
