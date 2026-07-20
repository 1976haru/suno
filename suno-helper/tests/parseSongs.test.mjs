import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractSongsArray, normalizeSong, parseSongsJson, loadSongsFromFile } from '../src/parseSongs.mjs';

function song(overrides = {}) {
  return {
    trackNo: 1,
    title: 'Morning Light',
    stylePrompt: 'warm pop, I-V-vi-IV',
    lyrics: '[chorus]\nMorning Light\n[end]',
    excludePrompt: 'no drums',
    ...overrides
  };
}

test('extractSongsArray accepts a bare array', () => {
  const songs = [song()];
  assert.deepEqual(extractSongsArray(songs), songs);
});

test('extractSongsArray accepts a { songs: [...] } wrapper (Claude Code bridge output)', () => {
  const songs = [song()];
  assert.deepEqual(extractSongsArray({ songs }), songs);
});

test('extractSongsArray accepts a spread PlaylistBlueprint (the main app\'s exportJson output) — songs sits alongside other top-level fields', () => {
  const songs = [song()];
  const exported = { projectTitle: 'Test Pack', channelName: 'Test Channel', songs, personaMode: false };
  assert.deepEqual(extractSongsArray(exported), songs);
});

test('extractSongsArray returns [] for anything else', () => {
  assert.deepEqual(extractSongsArray(null), []);
  assert.deepEqual(extractSongsArray({}), []);
  assert.deepEqual(extractSongsArray('not json'), []);
});

test('normalizeSong keeps only the four fields this tool actually uses, defaulting trackNo to index+1', () => {
  const normalized = normalizeSong(song({ trackNo: undefined, qualityScore: 90, warnings: [] }), 4);
  assert.deepEqual(normalized, {
    trackNo: 5,
    title: 'Morning Light',
    stylePrompt: 'warm pop, I-V-vi-IV',
    lyrics: '[chorus]\nMorning Light\n[end]',
    excludePrompt: 'no drums'
  });
});

test('normalizeSong defaults excludePrompt to an empty string when absent', () => {
  const normalized = normalizeSong(song({ excludePrompt: undefined }), 0);
  assert.equal(normalized.excludePrompt, '');
});

test('normalizeSong throws a clear error when a required field is missing', () => {
  assert.throws(() => normalizeSong(song({ lyrics: '' }), 0), /missing required field.*lyrics/);
});

test('normalizeSong throws for a non-object entry', () => {
  assert.throws(() => normalizeSong('not an object', 2), /Song #3 is not a JSON object/);
});

test('parseSongsJson sorts songs by trackNo', () => {
  const raw = JSON.stringify({ songs: [song({ trackNo: 3, title: 'Third' }), song({ trackNo: 1, title: 'First' })] });
  const parsed = parseSongsJson(raw);
  assert.deepEqual(parsed.map(s => s.title), ['First', 'Third']);
});

test('parseSongsJson throws when there is no songs array at all', () => {
  assert.throws(() => parseSongsJson(JSON.stringify({ foo: 'bar' })), /No "songs" array/);
});

test('loadSongsFromFile reads and parses a real file', () => {
  const tmpFile = path.join(os.tmpdir(), `suno-helper-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({ songs: [song()] }));
  try {
    const songs = loadSongsFromFile(tmpFile);
    assert.equal(songs.length, 1);
    assert.equal(songs[0].title, 'Morning Light');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
