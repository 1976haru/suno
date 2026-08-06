import { describe, expect, it } from 'vitest';
import { buildStandaloneProgressHtml, standaloneProgressFileName, type StandaloneProgressMeta } from '../src/core/standaloneProgressExport';
import type { SongIdea } from '../src/types';

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Song',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'hook',
    stylePrompt: 'warm acoustic pop, mid tempo',
    lyrics: '[verse]\nline one\nline two\n[chorus]\nhook',
    youtube: { title: 'Test Song', description: '', tags: [] },
    qualityScore: 80,
    warnings: [],
    songId: 'song-1',
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

const BASE_META: StandaloneProgressMeta = {
  packId: 'pack-1',
  channelId: 'channel-1',
  channelLabel: '굿모닝 추억라디오',
  conceptLabel: '비 오는 날의 올드팝',
  generatedAt: '2026-07-31T09:00:00+09:00'
};

describe('[v3.69] TASK A: standaloneProgressFileName', () => {
  it('uses the same <setName>_수노모드.html scheme as every other v3.69 set-level export', () => {
    expect(standaloneProgressFileName(BASE_META)).toBe('20260731_굿모닝추억라디오_비오는날의올드팝_수노모드.html');
  });
});

describe('[v3.69] TASK A: buildStandaloneProgressHtml', () => {
  it('produces a single self-contained HTML document with no external network references', () => {
    const html = buildStandaloneProgressHtml([makeSong()], BASE_META);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('</html>');
    // No CDN/external script or stylesheet references — everything is inline.
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('stays well within the 300KB budget for an 18-song pack', () => {
    const songs = Array.from({ length: 18 }, (_, i) => makeSong({
      trackNo: i + 1,
      title: `Song ${i + 1}`,
      songId: `song-${i + 1}`,
      stylePrompt: 'warm acoustic pop, mid tempo, soft vocal, verse-chorus structure, gentle strings',
      lyrics: '[verse]\nsome lyric line here\nanother lyric line\n[chorus]\nhook line repeated\nhook line repeated'
    }));
    const html = buildStandaloneProgressHtml(songs, BASE_META);
    const bytes = Buffer.byteLength(html, 'utf-8');

    expect(bytes).toBeLessThan(300 * 1024);
  });

  it('preserves keyboard-shortcut parity with SunoProgressMode.tsx (1/2/3/4 copy, G/O/B rating, Enter/ArrowRight/ArrowLeft nav)', () => {
    const html = buildStandaloneProgressHtml([makeSong()], BASE_META);

    expect(html).toContain("event.key === '1'");
    expect(html).toContain("event.key === '2'");
    expect(html).toContain("event.key === '3'");
    expect(html).toContain("event.key === '4'");
    expect(html).toContain("event.key.toLowerCase() === 'g'");
    expect(html).toContain("event.key.toLowerCase() === 'o'");
    expect(html).toContain("event.key.toLowerCase() === 'b'");
    expect(html).toContain("event.key === 'Enter' || event.key === 'ArrowRight'");
    expect(html).toContain("event.key === 'ArrowLeft'");
  });

  it('persists progress/ratings to localStorage (not IndexedDB — this file has no access to the app\'s own databases)', () => {
    const html = buildStandaloneProgressHtml([makeSong()], BASE_META);

    expect(html).toContain('localStorage.getItem');
    expect(html).toContain('localStorage.setItem');
    expect(html).toContain("'suno-standalone-progress:' + META.packId");
    expect(html).toContain("'suno-standalone-ratings:' + META.packId");
  });

  it('embeds the song data inline as JSON, safely escaping a "</script>" sequence inside lyrics so it cannot close the enclosing <script> tag early', () => {
    const dangerousSong = makeSong({ lyrics: '[verse]\nline with a literal </script> tag inside it\n[chorus]\nhook' });
    const html = buildStandaloneProgressHtml([dangerousSong], BASE_META);

    // Exactly one real closing </script> tag exists in the whole document (the actual tag).
    const scriptCloseCount = (html.match(/<\/script>/g) || []).length;
    expect(scriptCloseCount).toBe(1);

    // v4.0 (TASK C) — matches up to the next `var` declaration generically
    // (not literally "var META") since EXPORT_META now sits between SONGS
    // and META in the generated script.
    const songsMatch = html.match(/var SONGS = (\[[\s\S]*?\]);\n\s*var \w+/);
    expect(songsMatch).not.toBeNull();
    const parsedSongs = JSON.parse(songsMatch![1]);
    expect(parsedSongs[0].lyrics).toContain('</script>');
  });

  it('round-trips every song field the vanilla-JS copy workflow needs (title/stylePrompt/lyrics/excludePrompt/songId)', () => {
    const song = makeSong({ excludePrompt: 'no metal, no screaming', trackNo: 7 });
    const html = buildStandaloneProgressHtml([song], BASE_META);

    // v4.0 (TASK C) — matches up to the next `var` declaration generically
    // (not literally "var META") since EXPORT_META now sits between SONGS
    // and META in the generated script.
    const songsMatch = html.match(/var SONGS = (\[[\s\S]*?\]);\n\s*var \w+/);
    const parsed = JSON.parse(songsMatch![1]);
    expect(parsed[0]).toMatchObject({
      trackNo: 7,
      title: 'Test Song',
      stylePrompt: 'warm acoustic pop, mid tempo',
      lyrics: '[verse]\nline one\nline two\n[chorus]\nhook',
      excludePrompt: 'no metal, no screaming',
      songId: 'song-1'
    });
  });

  it('includes the channel/concept/date/song-count header and a ratings export button', () => {
    const songs = [makeSong({ trackNo: 1 }), makeSong({ trackNo: 2, songId: 'song-2' })];
    const html = buildStandaloneProgressHtml(songs, BASE_META);

    // Header text is embedded as a literal HTML <title>/<h1>-adjacent string (real UTF-8), not a JS escape.
    expect(html).toContain('굿모닝 추억라디오');
    expect(html).toContain('비 오는 날의 올드팝');
    // The rating-export button label lives inside the inline <script> as a JS
    // Unicode escape sequence (this whole file deliberately encodes Korean UI
    // text that way — see buildStandaloneProgressHtml's render() function),
    // so assert on the escape form rather than the literal characters.
    expect(html).toContain('[\\uD3C9\\uAC00 \\uB0B4\\uBCF4\\uB0B4\\uAE30]');
    expect(html).toContain('20260731_굿모닝추억라디오_비오는날의올드팝_평가.json');
  });

  it('does not bundle React or any framework runtime — plain DOM APIs only', () => {
    const html = buildStandaloneProgressHtml([makeSong()], BASE_META);

    expect(html).not.toContain('react');
    expect(html).not.toContain('React');
    expect(html).not.toContain('createElement(React');
  });
});
