import { describe, expect, it } from 'vitest';
import { exportCsv, exportMarkdown } from '../src/utils/exporters';
import type { PlaylistBlueprint, SongIdea } from '../src/types';

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song One',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On',
    stylePrompt: 'style',
    lyrics: '[chorus]\nline\n[end]',
    youtube: { title: 'yt title', description: 'yt desc', tags: ['tag'] },
    qualityScore: 90,
    warnings: [],
    ...overrides
  };
}

function makeBlueprint(songs: SongIdea[]): PlaylistBlueprint {
  return {
    projectTitle: 'Test Pack',
    channelName: 'Test Channel',
    oneLineConcept: 'concept',
    sonicSignature: 'sig',
    vocalSignature: 'vocal',
    lyricRules: [],
    harmonyRules: [],
    visualRules: [],
    songs
  };
}

/**
 * TASK v3.23 — thumbnailText became optional (the API no longer generates
 * it; user makes thumbnails externally). These verify exportMarkdown/
 * exportCsv don't print the literal string "undefined" when it's absent,
 * and still render it correctly for old saved packs that still have it.
 */
describe('[v3.23] exportMarkdown omits the Thumbnail line when absent, shows it when present', () => {
  it('a song with no thumbnailText anywhere produces no "Thumbnail:" line and never prints "undefined"', () => {
    const blueprint = makeBlueprint([makeSong()]);
    const markdown = exportMarkdown(blueprint);

    expect(markdown).not.toContain('Thumbnail:');
    expect(markdown).not.toContain('undefined');
  });

  it('an old saved song with youtube.thumbnailText still renders the line', () => {
    const blueprint = makeBlueprint([makeSong({ youtube: { title: 'yt', description: 'd', tags: [], thumbnailText: 'Legacy Thumb' } })]);
    const markdown = exportMarkdown(blueprint);

    expect(markdown).toContain('Thumbnail: Legacy Thumb');
  });

  it('an old saved song with only the top-level thumbnailText (not nested in youtube) still renders the line', () => {
    const blueprint = makeBlueprint([makeSong({ thumbnailText: 'Top-level Legacy Thumb' })]);
    const markdown = exportMarkdown(blueprint);

    expect(markdown).toContain('Thumbnail: Top-level Legacy Thumb');
  });
});

describe('[v3.23] exportCsv never renders the literal string "undefined" for a missing thumbnailText', () => {
  it('a song with no thumbnailText anywhere produces an empty CSV cell, not "undefined"', () => {
    const blueprint = makeBlueprint([makeSong()]);
    const csv = exportCsv(blueprint);

    expect(csv).not.toContain('undefined');
  });

  it('an old saved song with a thumbnailText still includes it in the CSV output', () => {
    const blueprint = makeBlueprint([makeSong({ youtube: { title: 'yt', description: 'd', tags: [], thumbnailText: 'Legacy Thumb' } })]);
    const csv = exportCsv(blueprint);

    expect(csv).toContain('Legacy Thumb');
  });
});
