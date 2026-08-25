import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SavedPack } from '../src/types';

/**
 * TASK v5.20 (독립 수노모드 뷰어, TASK C-3) — core/viewerRatingsImport.ts's
 * importViewerRatings calls core/ratingLedger.ts's recordRating, which opens
 * a real IndexedDB (ratingLedger.ts has no Node/in-memory fallback the way
 * core/library.ts does — no `indexedDB` global exists in this Vitest/Node
 * environment, confirmed: `typeof indexedDB` is 'undefined' here). Mocking
 * both core/library.ts (listFullPacksForWorkspace) and core/ratingLedger.ts
 * (recordRating/attributesFromSong) keeps this test focused on the actual
 * risk surface — songId/channelId+generatedAt/setName matching priority,
 * "중복이면 최신 우선" dedup, invalid-rating skipping, apiKey stripping —
 * without needing a real or fake IndexedDB.
 */

const recordRatingMock = vi.fn(async () => {});

vi.mock('../src/core/ratingLedger', () => ({
  recordRating: (...args: unknown[]) => recordRatingMock(...args),
  attributesFromSong: (song: { genreId?: string; bpm?: number; vocalType?: string }, channelId: string) => ({
    genreId: song.genreId || 'unknown',
    bpm: song.bpm ?? 0,
    vocalType: song.vocalType || 'unknown',
    channelId
  })
}));

const listFullPacksForWorkspaceMock = vi.fn(async (): Promise<SavedPack[]> => []);
vi.mock('../src/core/library', () => ({
  listFullPacksForWorkspace: (...args: unknown[]) => listFullPacksForWorkspaceMock(...(args as []))
}));

vi.mock('../src/core/workspaceScope', () => ({
  currentWorkspaceId: () => 'senior-oldpop'
}));

const { importViewerRatings } = await import('../src/core/viewerRatingsImport');

function makePack(overrides: Partial<SavedPack> = {}): SavedPack {
  return {
    id: 'pack-1',
    name: 'Good Morning Radio - Test Concept - 2026-08-06',
    savedAt: '2026-08-06T00:00:00.000Z',
    isAutosave: false,
    channelId: 'good-morning-memory-radio',
    channelName: 'Good Morning Memory Radio',
    projectTitle: 'Test Concept',
    songCount: 2,
    avgQualityScore: 80,
    blueprint: {
      projectTitle: 'Test Concept',
      channelName: 'Good Morning Memory Radio',
      oneLineConcept: '',
      songs: [
        { trackNo: 1, songId: 'song-1', genreId: 'oldpop-british-beat', bpm: 100, vocalType: 'male' } as never,
        { trackNo: 2, songId: 'song-2', genreId: 'oldpop-british-beat', bpm: 100, vocalType: 'female' } as never
      ],
      generatedAt: '2026-08-06T10:21:42.011Z'
    } as never,
    options: {} as never,
    ...overrides
  };
}

beforeEach(() => {
  recordRatingMock.mockClear();
  listFullPacksForWorkspaceMock.mockReset();
  listFullPacksForWorkspaceMock.mockResolvedValue([]);
});

describe('[v5.20] importViewerRatings — matching priority', () => {
  it('matches by songId first when the export carries a real one', async () => {
    listFullPacksForWorkspaceMock.mockResolvedValue([makePack()]);
    const result = await importViewerRatings({
      setName: 'no-match-name',
      ratings: [{ trackNo: 1, songId: 'song-1', rating: 'good', ratedAt: '2026-08-06T12:00:00.000Z' }]
    });
    expect(result.matched).toBe(1);
    expect(result.skipped).toBe(0);
    expect(recordRatingMock).toHaveBeenCalledWith(expect.objectContaining({ songId: 'song-1', packId: 'pack-1', rating: 'good' }));
  });

  it('falls back to channelId + packGeneratedAt (additive fields) when songId is absent', async () => {
    listFullPacksForWorkspaceMock.mockResolvedValue([makePack()]);
    const result = await importViewerRatings({
      setName: 'no-match-name',
      channelId: 'good-morning-memory-radio',
      packGeneratedAt: '2026-08-06T10:21:42.011Z',
      ratings: [{ trackNo: 2, rating: 'ok', ratedAt: '2026-08-06T12:00:00.000Z' }]
    });
    expect(result.matched).toBe(1);
    expect(recordRatingMock).toHaveBeenCalledWith(expect.objectContaining({ songId: 'song-2', rating: 'ok' }));
  });

  it('falls back to setName === pack.name as a last resort', async () => {
    listFullPacksForWorkspaceMock.mockResolvedValue([makePack()]);
    const result = await importViewerRatings({
      setName: 'Good Morning Radio - Test Concept - 2026-08-06',
      ratings: [{ trackNo: 1, rating: 'bad', ratedAt: '2026-08-06T12:00:00.000Z' }]
    });
    expect(result.matched).toBe(1);
    expect(recordRatingMock).toHaveBeenCalledWith(expect.objectContaining({ songId: 'song-1', rating: 'bad' }));
  });

  it('skips (never guesses) a rating that matches no pack by any strategy', async () => {
    listFullPacksForWorkspaceMock.mockResolvedValue([makePack()]);
    const result = await importViewerRatings({
      setName: 'totally-unrelated',
      ratings: [{ trackNo: 99, songId: 'song-does-not-exist', rating: 'good', ratedAt: '2026-08-06T12:00:00.000Z' }]
    });
    expect(result.matched).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.warnings.some(w => w.includes('건너뛰었습니다'))).toBe(true);
    expect(recordRatingMock).not.toHaveBeenCalled();
  });

  it('skips an entry with an invalid/missing rating value', async () => {
    listFullPacksForWorkspaceMock.mockResolvedValue([makePack()]);
    const result = await importViewerRatings({
      setName: 'Good Morning Radio - Test Concept - 2026-08-06',
      ratings: [{ trackNo: 1, rating: 'love-it', ratedAt: '2026-08-06T12:00:00.000Z' }]
    });
    expect(result.matched).toBe(0);
    expect(result.skipped).toBe(1);
    expect(recordRatingMock).not.toHaveBeenCalled();
  });
});

describe('[v5.20] importViewerRatings — dedup ("중복이면 최신 우선")', () => {
  it('keeps only the latest ratedAt when the same song appears twice', async () => {
    listFullPacksForWorkspaceMock.mockResolvedValue([makePack()]);
    const result = await importViewerRatings({
      setName: 'Good Morning Radio - Test Concept - 2026-08-06',
      ratings: [
        { trackNo: 1, songId: 'song-1', rating: 'bad', ratedAt: '2026-08-06T09:00:00.000Z' },
        { trackNo: 1, songId: 'song-1', rating: 'good', ratedAt: '2026-08-06T15:00:00.000Z' }
      ]
    });
    expect(result.matched).toBe(1);
    expect(recordRatingMock).toHaveBeenCalledTimes(1);
    expect(recordRatingMock).toHaveBeenCalledWith(expect.objectContaining({ rating: 'good', ratedAt: '2026-08-06T15:00:00.000Z' }));
  });
});

describe('[v5.20] importViewerRatings — malformed input / secrets', () => {
  it('returns a clean empty result for non-object input, never throws', async () => {
    const result = await importViewerRatings(null);
    expect(result).toEqual({ matched: 0, skipped: 0, warnings: expect.any(Array) });
  });

  it('warns (never uses) an apiKey field if present anywhere in the file', async () => {
    listFullPacksForWorkspaceMock.mockResolvedValue([makePack()]);
    const result = await importViewerRatings({
      setName: 'Good Morning Radio - Test Concept - 2026-08-06',
      apiKey: 'sk-should-be-ignored',
      ratings: [{ trackNo: 1, rating: 'good', ratedAt: '2026-08-06T12:00:00.000Z' }]
    });
    expect(result.warnings.some(w => w.includes('apiKey'))).toBe(true);
    expect(result.matched).toBe(1);
  });

  it('reports zero matches/skips with a warning for an empty ratings array', async () => {
    const result = await importViewerRatings({ setName: 'x', ratings: [] });
    expect(result.matched).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
