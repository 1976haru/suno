import { describe, expect, it } from 'vitest';
import { getWorkspace, getWorkspaceTerm, isFeatureHidden, workspaceDefinitions } from '../src/data/workspaces';

describe('[v4.0 TASK A] workspaceDefinitions', () => {
  it('defines exactly the 7 spec workspaces, each with a unique id', () => {
    const ids = workspaceDefinitions.map(w => w.id);
    expect(ids).toEqual(['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female']);
    expect(new Set(ids).size).toBe(7);
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
  // kr-2030-pop/jp-2030-pop.
  // TASK E1 — kr-kids's genre/lyric-theme/hook-bank/thumbnail/concept/
  // channel-preset layers all landed and were verified via real 18-song
  // generation (0/18 titles carry senior vocabulary across 3 channels), so
  // this workspace is now fully built — ready=true, same transition
  // kr-2030/jp-2030 made after B2/C2.
  // TASK F1 — jp-kids's own genre/lyric-theme/onomatopoeia/hook-bank/
  // thumbnail/concept/channel-preset layers all landed and were verified via
  // real 18-song generation (0/54 titles carry senior vocabulary across 3
  // channels; see docs/f1-report.md), so jp-kids is now fully built too.
  it('kr-kids and jp-kids are both fully built: real archetypes, ready=true', () => {
    const krKids = getWorkspace('kr-kids');
    expect(krKids.ready).toBe(true);
    expect(krKids.archetypeIds).toEqual(['kr-kids-song']);
    expect(krKids.labelKo.length).toBeGreaterThan(0);

    const jpKids = getWorkspace('jp-kids');
    expect(jpKids.ready).toBe(true);
    expect(jpKids.archetypeIds).toEqual(['jp-kids-song']);
    expect(jpKids.labelKo.length).toBeGreaterThan(0);
  });

  // TASK K2 — kr-idol-male's genre/section-genre-plan-preset/lyric-theme/
  // hook-bank/thumbnail/concept/channel-preset layers all landed and were
  // verified via real 18-song generation across 3 channels (0/54 titles
  // carry senior or kr-2030 vocabulary, 0 female-only vocal songs with the
  // vocalQuotaOverride applied; see docs/k2-report.md), so this workspace
  // is now fully built too.
  // v5.7 — the v5.6 real-execution audit found K2's own `ready: true` didn't
  // hold up under real generation/isolation testing (shared senior lyric
  // templates, no real audience profile, no idolExpressionLint pipeline
  // gate). v5.7-B..I fixed those findings; v5.7-J re-verified via real
  // 18-song generation (0 contamination, 0 idol-expression violations) and
  // re-flipped ready=true — see data/workspaces/index.ts's own KR_IDOL_M
  // `ready` comment and docs/v57-report.md.
  it('kr-idol-male is fully built (v5.7 re-verified): real archetype, ready=true', () => {
    const kridolM = getWorkspace('kr-idol-male');
    expect(kridolM.ready).toBe(true);
    expect(kridolM.archetypeIds).toEqual(['kr-idol-male']);
    expect(kridolM.labelKo.length).toBeGreaterThan(0);
  });

  // TASK K3 — kr-idol-female's lyric-theme/hook-bank/thumbnail/concept/
  // channel-preset/idol-vocal-description layers all landed and were
  // verified via real 18-song generation (0/54 titles carry senior/kr2030/
  // kr-idol-male vocabulary, 0 male-only vocal songs with the
  // vocalQuotaOverride applied, 0 core/idolExpressionLint.ts violations
  // across both this workspace's own output AND kr-idol-male's; see
  // docs/k3-report.md), so this workspace is now fully built too.
  // v5.7 — same v5.6 audit fix/re-verification as kr-idol-male above.
  it('kr-idol-female is fully built (v5.7 re-verified): real archetype, ready=true', () => {
    const kridolF = getWorkspace('kr-idol-female');
    expect(kridolF.ready).toBe(true);
    expect(kridolF.archetypeIds).toEqual(['kr-idol-female']);
    expect(kridolF.labelKo.length).toBeGreaterThan(0);
  });

  // TASK C2 — jp-2030's lyric world/hooks/titles/thumbnails/channel presets
  // all landed and were verified via real 18-song generation (0/18 titles
  // carry senior/showa vocabulary), so this workspace is now fully built —
  // ready=true, same transition kr-2030 made after B2 (see the next test).
  // v5.7 — same v5.6 audit fix/re-verification as kr-idol-male/female above
  // (see data/workspaces/index.ts's own JP_2030 `ready` comment).
  it('jp-2030 is fully built (v5.7 re-verified): real archetype, ready=true', () => {
    const jp2030 = getWorkspace('jp-2030');
    expect(jp2030.archetypeIds).toEqual(['jp-2030-pop']);
    expect(jp2030.ready).toBe(true);
    expect(jp2030.contentTier).toBe('adult');
  });

  // TASK B2 — kr-2030's lyric world/hooks/titles/thumbnails/channel presets
  // all landed and were verified via real 18-song generation (0/18 titles
  // carry senior vocabulary), so this workspace is now fully built —
  // ready=true, same status as senior-oldpop.
  // v5.7 — same v5.6 audit fix/re-verification as the workspaces above (see
  // data/workspaces/index.ts's own KR_2030 `ready` comment).
  it('kr-2030 is fully built (v5.7 re-verified): real archetype, ready=true', () => {
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
    expect(accents.size).toBe(7);
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
