import { describe, expect, it } from 'vitest';
import { buildSunoViewerHtml, SUNO_VIEWER_FILE_NAME, SUNO_VIEWER_VERSION } from '../src/core/sunoViewerExport';

/**
 * TASK v5.20 (독립 수노모드 뷰어) — structural checks for the data-free
 * viewer, same style as tests/standaloneProgressExport.test.ts (this repo
 * has no jsdom/React-rendering test infra — see that file's own established
 * convention, followed here rather than reinvented). Real interactive
 * verification (double-click, load a lyrics/*.json file, keyboard
 * shortcuts, localStorage persistence across reopen, Network tab) was done
 * by hand in a real browser — see this task's own completion report.
 */
describe('[v5.20] buildSunoViewerHtml — offline/self-contained', () => {
  const html = buildSunoViewerHtml();

  it('produces a single self-contained HTML document with no external network references', () => {
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('</html>');
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('fetch(');
  });

  it('stays well within the 300KB budget (data-free — no baked pack data at all)', () => {
    const bytes = Buffer.byteLength(html, 'utf-8');
    expect(bytes).toBeLessThan(300 * 1024);
  });

  it('does not bundle React or any framework runtime', () => {
    expect(html).not.toContain('react');
    expect(html).not.toContain('React');
  });

  it('starts with no song data baked in — SONGS is an empty array until a file is loaded', () => {
    expect(html).toContain('var SONGS = [];');
    expect(html).toContain('var FILE_LOADED = false;');
  });

  it('reads files via FileReader only, never fetch', () => {
    expect(html).toContain('new FileReader()');
    expect(html).toContain('reader.readAsText(file)');
    expect(html).not.toContain('fetch(');
  });

  it('preserves keyboard-shortcut parity with the single-pack export (1/2/3/4 copy, G/O/B rating, Enter/ArrowRight/ArrowLeft nav)', () => {
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

  it('supports all three documented JSON shapes (meta+songs, bare array, songs-only)', () => {
    expect(html).toContain('function parseLyricsFile(parsed, fallbackName)');
    expect(html).toContain('Array.isArray(parsed)');
    expect(html).toContain('Array.isArray(parsed.songs)');
  });

  it('persists progress per opened file, keyed by setName/filename — never the raw file content', () => {
    expect(html).toContain("'sunoViewer:progress:' + key");
    expect(html).toContain("'sunoViewer:recent'");
    // The recent-files index only ever stores name/key/count metadata, never SONGS/lyrics text.
    expect(html).toMatch(/list\.unshift\(\{ key: key, displayName: displayName, songCount: songCount/);
  });

  it('probes localStorage availability and warns instead of silently losing progress on file://', () => {
    expect(html).toContain('LOCAL_STORAGE_OK');
    expect(html).toContain('file://');
  });

  it('never trusts an apiKey field if present in an imported file', () => {
    expect(html).toContain('function containsApiKey(value, depth)');
    expect(html).toContain("hasOwnProperty.call(value, 'apiKey')");
  });

  it('shows the viewer version in the footer', () => {
    expect(html).toContain(SUNO_VIEWER_VERSION);
    expect(html).toContain('VIEWER_VERSION');
  });

  it('exports ratings in the documented shape (setName/exportedAt/source/viewerVersion/ratings[])', () => {
    expect(html).toContain("source: 'suno-viewer'");
    expect(html).toContain('viewerVersion: VIEWER_VERSION');
    expect(html).toContain('setName: META.setName');
  });
});

describe('[v5.20] SUNO_VIEWER_FILE_NAME', () => {
  it('is a stable, always-the-same filename — the viewer is received once and reused', () => {
    expect(SUNO_VIEWER_FILE_NAME).toBe('suno-mode.html');
  });
});
