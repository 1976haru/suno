import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { scoreSongs } from '../src/core/quality';
import { buildPackVideoDescription } from '../src/core/videoExport';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.59 — found incidentally while assembling this task's own
 * completion report (running the exact required scenario with a project
 * title that itself echoes the artist-style concept, matching how a real
 * user would naturally name such a pack). opts.projectTitle is just as
 * much a free-text, user-authorable field as customConcept
 * (Step2Concept.tsx's plain <input>, no decomposition/safety pass at all),
 * but it flowed straight into public YouTube description text unguarded —
 * the same self-penalty class of bug TASK B fixed for customConcept, on a
 * different field. Fixed via the same safeConceptSummaryForDisplay guard,
 * applied to localGenerator.ts's buildYoutubeMetadata and videoExport.ts's
 * buildPackVideoDescription.
 */
describe('[v3.59] a project title that echoes an artist reference no longer self-penalizes', () => {
  const RISKY_PROJECT_TITLE = 'Beatles-Style Morning Coffee Pop';

  it('produces zero "Famous artist reference risk" warnings when only the project title carries the reference', () => {
    const opts = makeOptions({ songCount: 6, projectTitle: RISKY_PROJECT_TITLE });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const scored = scoreSongs(bp.songs, opts.channel);
    for (const song of scored) {
      expect(song.warnings.some(w => w.startsWith('Famous artist reference risk')), JSON.stringify(song.warnings)).toBe(false);
    }
  });

  it('the public youtube.description never contains the risky project title verbatim', () => {
    const opts = makeOptions({ songCount: 3, projectTitle: RISKY_PROJECT_TITLE });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.youtube.description).not.toContain(RISKY_PROJECT_TITLE);
    }
  });

  it('the compiled whole-pack video description never contains the risky project title verbatim either', () => {
    const opts = makeOptions({ songCount: 3, projectTitle: RISKY_PROJECT_TITLE });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const description = buildPackVideoDescription(bp, opts);
    expect(description).not.toContain(RISKY_PROJECT_TITLE);
  });

  it('a benign project title still appears verbatim (no over-broad stripping)', () => {
    const opts = makeOptions({ songCount: 1, projectTitle: 'Autumn Coffee Playlist' });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    expect(bp.songs[0].youtube.description).toContain('Autumn Coffee Playlist');
  });
});
