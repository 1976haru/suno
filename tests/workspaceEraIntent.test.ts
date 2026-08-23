import { describe, expect, it } from 'vitest';
import { extractEraConstraint, resolveConstraints } from '../src/core/constraints';
import { eraIntentForWorkspace, WORKSPACE_ERA_INTENT } from '../src/data/workspaceEraIntent';
import { KIDS_AUDIENCE_PROFILE, SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

/**
 * codex 지시문 02 (TASK J) — two real, bounded additions this covers:
 * (1) extractEraConstraint can now detect an explicit "2000년대"/"Y2K"/
 *     "헤이세이" reference (data/eraExclusions.ts's own '2000s' EraBucket
 *     already existed with real genre data — kr2030-y2k-retro/
 *     jp2030-heisei-nostalgia — but no regex here ever tested for it).
 * (2) data/workspaceEraIntent.ts's per-workspace EraIntent registry, wired
 *     into resolveConstraints for the one mode with a real behavior
 *     difference — 'safety-over-era' (kids workspaces) forces
 *     unspecified:true even when text happens to match a decade word. The
 *     other 3 modes are documented as already-matching real behavior, not
 *     additional code paths — see workspaceEraIntent.ts's own doc comment
 *     for why extending the genre-quota system itself to 2010s/2020s/
 *     "current" is deliberately left undone (no real genre-era data exists
 *     to back it, and fabricating it would wrongly cap real 2030/kpop
 *     generic-bucket genres).
 */
describe('[codex 지시문 02 TASK J] extractEraConstraint — 2000s detection', () => {
  it('an explicit "2000년대" reference resolves primary to 2000s, not unspecified', () => {
    const era = extractEraConstraint('2000년대 감성의 드라이브 팝');
    expect(era.unspecified).toBe(false);
    expect(era.primary).toBe('2000s');
  });

  it('an explicit "Y2K" reference (English, word-boundary) resolves primary to 2000s', () => {
    const era = extractEraConstraint('Y2K retro Korean pop');
    expect(era.unspecified).toBe(false);
    expect(era.primary).toBe('2000s');
  });

  it('"헤이세이"/"heisei" resolves primary to 2000s (jp2030-heisei-nostalgia\'s own keyword)', () => {
    expect(extractEraConstraint('헤이세이 노스탤지어 무드').primary).toBe('2000s');
    expect(extractEraConstraint('heisei drama theme song mood').primary).toBe('2000s');
  });

  it('a 2000s-only concept forbids the 3 oldpop decades (same mechanism as an explicit 60s/70s/80s concept)', () => {
    const era = extractEraConstraint('2000년대 Y2K 무드');
    expect(era.forbidden.sort()).toEqual(['1950s-60s', '1970s', '1980s']);
  });

  it('ordinary text with no decade/Y2K signal at all is still unspecified (no over-eager matching)', () => {
    const era = extractEraConstraint('신나는 드라이브 팝');
    expect(era.unspecified).toBe(true);
  });

});

describe('[codex 지시문 02 TASK J] WORKSPACE_ERA_INTENT registry', () => {
  it('has a real entry for all 8 workspaces', () => {
    const ids = Object.keys(WORKSPACE_ERA_INTENT);
    expect(ids.sort()).toEqual(
      ['jp-2030', 'jp-kids', 'kr-2030', 'kr-idol-female', 'kr-idol-male', 'kr-kids', 'senior-oldpop', 'en-chillhop'].sort()
    );
  });

  it('senior-oldpop is strict-decade (the workspace applyEraQuota was actually built for)', () => {
    expect(eraIntentForWorkspace('senior-oldpop').mode).toBe('strict-decade');
  });

  it('kr-2030/jp-2030 are current-implied', () => {
    expect(eraIntentForWorkspace('kr-2030').mode).toBe('current-implied');
    expect(eraIntentForWorkspace('jp-2030').mode).toBe('current-implied');
  });

  it('kr-kids/jp-kids are safety-over-era', () => {
    expect(eraIntentForWorkspace('kr-kids').mode).toBe('safety-over-era');
    expect(eraIntentForWorkspace('jp-kids').mode).toBe('safety-over-era');
  });

  it('kr-idol-male/kr-idol-female are only-when-referenced', () => {
    expect(eraIntentForWorkspace('kr-idol-male').mode).toBe('only-when-referenced');
    expect(eraIntentForWorkspace('kr-idol-female').mode).toBe('only-when-referenced');
  });
});

describe('[codex 지시문 02 TASK J] resolveConstraints — safety-over-era wiring', () => {
  it('a kr-kids concept that happens to mention an explicit decade is forced back to unspecified (safety wins)', () => {
    const resolved = resolveConstraints(
      { conceptLabel: '1980년대 신스팝 느낌의 동요' },
      { id: 'kr-kids' },
      KIDS_AUDIENCE_PROFILE,
      6
    );
    expect(resolved.era.unspecified).toBe(true);
    expect(resolved.era.primary).toBe('timeless');
    expect(resolved.genreCandidates).toEqual([]);
    expect(resolved.warnings.some(w => w.includes('안전 우선'))).toBe(true);
  });

  it('the SAME concept text for senior-oldpop (strict-decade) still resolves the real 1980s era — the override is workspace-scoped, not global', () => {
    const resolved = resolveConstraints(
      { conceptLabel: '1980년대 신스팝 느낌' },
      { id: 'senior-oldpop' },
      SENIOR_AUDIENCE_PROFILE,
      18
    );
    expect(resolved.era.unspecified).toBe(false);
    expect(resolved.era.primary).toBe('1980s');
  });

  it('a kr-kids concept with NO decade signal at all is unaffected (no spurious warning, same as before this task)', () => {
    const resolved = resolveConstraints(
      { conceptLabel: '신나는 동물 친구들 동요' },
      { id: 'kr-kids' },
      KIDS_AUDIENCE_PROFILE,
      6
    );
    expect(resolved.era.unspecified).toBe(true);
    expect(resolved.warnings.some(w => w.includes('안전 우선'))).toBe(false);
  });
});
