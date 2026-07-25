import { describe, expect, it } from 'vitest';
import { applySetTitlePrefixesToBlueprint, stripSetTitlePrefix } from '../src/utils/generation';
import { buildSongTxt } from '../src/utils/exporters';
import { dedupeTitlesAcrossPack } from '../src/core/lyricEngine';
import type { PlaylistBlueprint, SongIdea } from '../src/types';

// TASK v3.43 Step 3 (Part B1/B2) — real measurement: applySetTitlePrefixesToBlueprint
// only ever touched song.title, so youtube.title and the lyrics' own "Title:"
// line shipped unnumbered while buildSongTxt's own trackNo prefix doubled up
// with the already-applied song.title prefix ("01. 01. Creative Title 1").

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Creative Title 1',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On',
    stylePrompt: 'warm pop, I-V-vi-IV progression',
    lyrics: 'Title: Creative Title 1\n\n[verse 1]\nline one\n[chorus]\nHold On\nHold On\n[end]',
    youtube: { title: 'Creative Title 1 - Test Channel Playlist', description: 'desc', tags: ['tag'] },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

function makeBlueprint(songs: SongIdea[]): PlaylistBlueprint {
  return {
    projectTitle: 'Test Pack',
    channelName: 'Test Channel',
    oneLineConcept: 'x',
    sonicSignature: 'x',
    vocalSignature: 'x',
    lyricRules: [],
    harmonyRules: [],
    visualRules: [],
    songs
  };
}

function lyricsTitleLine(lyrics: string): string | undefined {
  return lyrics.split('\n').find(line => line.startsWith('Title:'));
}

describe('[v3.43 Step 3] title numbering is unified across song.title, youtube.title, and the lyrics Title: line', () => {
  it('setNumberPrefix: true -> all three surfaces start with "NN. ", and the exported .txt header carries the number exactly once', () => {
    const blueprint = makeBlueprint([
      makeSong({ trackNo: 1, title: 'Creative Title 1', lyrics: 'Title: Creative Title 1\n\n[verse 1]\nline\n[chorus]\nHold On\nHold On\n[end]', youtube: { title: 'Creative Title 1 - Test Channel Playlist', description: 'desc', tags: ['tag'] } })
    ]);

    const prefixed = applySetTitlePrefixesToBlueprint(blueprint, true);
    const [song] = prefixed.songs;

    expect(song.title).toBe('01. Creative Title 1');
    expect(song.youtube.title).toBe('01. Creative Title 1 - Test Channel Playlist');
    expect(lyricsTitleLine(song.lyrics)).toBe('Title: 01. Creative Title 1');

    const txt = buildSongTxt(song);
    const headerLine = txt.split('\n')[0];
    expect(headerLine).toBe('01. Creative Title 1');
    // exactly one "01." across the whole header line, not "01. 01."
    expect(headerLine.match(/\b01\./g)?.length ?? 0).toBe(1);
  });

  it('setNumberPrefix: false -> none of the three surfaces carry a prefix', () => {
    const blueprint = makeBlueprint([
      makeSong({ trackNo: 1, title: '01. Creative Title 1', lyrics: 'Title: 01. Creative Title 1\n\n[verse 1]\nline\n[chorus]\nHold On\nHold On\n[end]', youtube: { title: '01. Creative Title 1 - Test Channel Playlist', description: 'desc', tags: ['tag'] } })
    ]);

    const stripped = applySetTitlePrefixesToBlueprint(blueprint, false);
    const [song] = stripped.songs;

    expect(song.title).toBe('Creative Title 1');
    expect(song.youtube.title).toBe('Creative Title 1 - Test Channel Playlist');
    expect(lyricsTitleLine(song.lyrics)).toBe('Title: Creative Title 1');
  });

  it('idempotency: applying the prefix twice never produces "01. 01." on any surface', () => {
    const blueprint = makeBlueprint([makeSong({ trackNo: 1 })]);

    const once = applySetTitlePrefixesToBlueprint(blueprint, true);
    const twice = applySetTitlePrefixesToBlueprint(once, true);
    const [song] = twice.songs;

    expect(song.title).toBe('01. Creative Title 1');
    expect(song.youtube.title).toBe('01. Creative Title 1 - Test Channel Playlist');
    expect(lyricsTitleLine(song.lyrics)).toBe('Title: 01. Creative Title 1');
    expect(song.title).not.toMatch(/^01\. 01\./);
    expect(song.youtube.title).not.toMatch(/^01\. 01\./);
    expect(lyricsTitleLine(song.lyrics)).not.toMatch(/Title: 01\. 01\./);
  });

  it('a lyrics Title: line that isn\'t the very first line (a vocal meta tag sits ahead of it) is still found and prefixed', () => {
    const blueprint = makeBlueprint([
      makeSong({
        trackNo: 4,
        lyrics: '[male vocal]\nTitle: Creative Title 1\n\n[verse 1]\nline\n[chorus]\nHold On\nHold On\n[end]'
      })
    ]);
    const prefixed = applySetTitlePrefixesToBlueprint(blueprint, true);
    expect(lyricsTitleLine(prefixed.songs[0].lyrics)).toBe('Title: 04. Creative Title 1');
    expect(prefixed.songs[0].lyrics.startsWith('[male vocal]')).toBe(true);
  });

  it('lyrics with no "Title:" line at all (kids-channel songs never write one) are left untouched', () => {
    const blueprint = makeBlueprint([
      makeSong({ trackNo: 1, lyrics: '[intro]\nsome kids lyrics\n[chorus]\nHold On\nHold On\n[end]' })
    ]);
    const prefixed = applySetTitlePrefixesToBlueprint(blueprint, true);
    expect(prefixed.songs[0].lyrics).toBe(blueprint.songs[0].lyrics);
  });

  it('multi-set regression: each set independently restarts youtube.title/lyrics numbering at 01, no cross-set leakage', () => {
    const buildSet = (trackCount: number) => makeBlueprint(
      Array.from({ length: trackCount }, (_, i) => makeSong({
        trackNo: i + 1,
        title: `Song ${i + 1}`,
        lyrics: `Title: Song ${i + 1}\n\n[verse 1]\nline\n[chorus]\nHold On\nHold On\n[end]`,
        youtube: { title: `Song ${i + 1} - Channel`, description: 'desc', tags: ['tag'] }
      }))
    );

    const set1 = applySetTitlePrefixesToBlueprint(buildSet(3), true);
    const set2 = applySetTitlePrefixesToBlueprint(buildSet(3), true);

    for (const set of [set1, set2]) {
      expect(set.songs.map(s => s.title)).toEqual(['01. Song 1', '02. Song 2', '03. Song 3']);
      expect(set.songs.map(s => s.youtube.title)).toEqual(['01. Song 1 - Channel', '02. Song 2 - Channel', '03. Song 3 - Channel']);
      expect(set.songs.map(s => lyricsTitleLine(s.lyrics))).toEqual(['Title: 01. Song 1', 'Title: 02. Song 2', 'Title: 03. Song 3']);
    }
  });

  it('dedup/hookLedger logic (stripSetTitlePrefix-based) is unaffected: the same core title with different set prefixes still collides for dedup purposes', () => {
    const set1Song = makeSong({ trackNo: 1, title: 'Winterglass' });
    const set2Song = makeSong({ trackNo: 5, title: 'Winterglass' });
    const prefixedSet1 = applySetTitlePrefixesToBlueprint(makeBlueprint([set1Song]), true).songs[0];
    const prefixedSet2 = applySetTitlePrefixesToBlueprint(makeBlueprint([set2Song]), true).songs[0];

    expect(stripSetTitlePrefix(prefixedSet1.title)).toBe(stripSetTitlePrefix(prefixedSet2.title));

    // dedupeTitlesAcrossPack should still flag/rename a real collision using
    // the bare (prefix-stripped) title, unaffected by youtube.title/lyrics
    // also now carrying prefixes.
    const { songs: deduped, changedTrackNos } = dedupeTitlesAcrossPack([prefixedSet2], [prefixedSet1.title]);
    expect(changedTrackNos).toContain(prefixedSet2.trackNo);
    expect(stripSetTitlePrefix(deduped[0].title)).not.toBe(stripSetTitlePrefix(prefixedSet1.title));
  });
});
