'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_AUDIO_FILES,
  assertAudioExtension,
  assertImageExtension,
  buildChapterText,
  buildFilterGraph,
  createJobId,
  formatTimestamp,
  isJobId,
  parseProgressLine,
  sanitizeName,
  validateRemoteAudioUrl,
  validateRenderSpec
} = require('../electron/mediaCore.cjs');

test('sanitizeName blocks Windows-reserved names and forbidden characters', () => {
  const values = ['CON', 'PRN.txt', 'a<b>c:d"e/f\\g|h?i*j', '... ', '', '\u0000bad'];
  for (const value of values) {
    const result = sanitizeName(value, 'fallback', 60);
    assert.ok(result.length > 0);
    assert.doesNotMatch(result, /[<>:"/\\|?*\u0000-\u001f]/);
    assert.doesNotMatch(result, /[ .]$/);
    assert.ok(!['CON', 'PRN'].includes(result.toUpperCase()));
  }
});

test('sanitizeName survives 10,000 randomized Unicode-heavy inputs', () => {
  const alphabet = ['가', '힣', 'A', 'z', '0', '9', '.', ' ', '<', '>', ':', '"', '/', '\\', '|', '?', '*', '🎵', '\u0000'];
  for (let i = 0; i < 10_000; i += 1) {
    let input = '';
    const length = 1 + Math.floor(Math.random() * 250);
    for (let j = 0; j < length; j += 1) input += alphabet[Math.floor(Math.random() * alphabet.length)];
    const result = sanitizeName(input, 'fallback', 80);
    assert.ok(Array.from(result).length <= 81);
    assert.doesNotMatch(result, /[<>:"/\\|?*\u0000-\u001f]/);
    assert.doesNotMatch(result, /[ .]$/);
  }
});

test('formatTimestamp and progress parsing cover long playlists', () => {
  assert.equal(formatTimestamp(0), '0:00');
  assert.equal(formatTimestamp(65.9), '1:05');
  assert.equal(formatTimestamp(3661), '1:01:01');
  assert.equal(parseProgressLine('out_time_ms=2500000'), 2.5);
  assert.equal(parseProgressLine('out_time=00:01:02.50'), 62.5);
  assert.equal(parseProgressLine('frame=1 time=00:00:03.25 bitrate=1'), 3.25);
  assert.equal(parseProgressLine('garbage'), null);
});

test('extension guards accept supported media and reject executables', () => {
  for (const ext of ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']) assert.equal(assertAudioExtension(`a.${ext}`), `.${ext}`);
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) assert.equal(assertImageExtension(`a.${ext}`), `.${ext}`);
  assert.throws(() => assertAudioExtension('malware.exe'));
  assert.throws(() => assertImageExtension('image.svg'));
});

test('remote URL validation rejects SSRF-prone targets', () => {
  assert.equal(validateRemoteAudioUrl('https://cdn.example.com/audio.mp3').protocol, 'https:');
  for (const url of [
    'http://cdn.example.com/a.mp3',
    'https://localhost/a.mp3',
    'https://127.0.0.1/a.mp3',
    'https://10.0.0.2/a.mp3',
    'https://192.168.1.2/a.mp3',
    'https://169.254.1.1/a.mp3',
    'https://[::1]/a.mp3',
    'https://user:pass@example.com/a.mp3',
    'https://example.com:8443/a.mp3'
  ]) assert.throws(() => validateRemoteAudioUrl(url));
});

test('render spec clamps safe video settings and enforces cardinality', () => {
  const valid = validateRenderSpec({
    audioFileIds: ['a', 'b'],
    imageFileId: 'img',
    outName: '../CON?.mp4',
    playlist: '../../My Playlist',
    options: { width: 1280, imageMode: 'cover', preset: 'medium', normalizeAudio: true }
  });
  assert.equal(valid.options.width, 1280);
  assert.equal(valid.options.height, 720);
  assert.equal(valid.options.imageMode, 'cover');
  assert.doesNotMatch(valid.outName, /[<>:"/\\|?*]/);
  assert.throws(() => validateRenderSpec({ audioFileIds: [], imageFileId: 'img' }));
  assert.throws(() => validateRenderSpec({ audioFileIds: ['x', 'x'], imageFileId: 'img' }));
  assert.throws(() => validateRenderSpec({ audioFileIds: Array.from({ length: MAX_AUDIO_FILES + 1 }, (_, i) => String(i)), imageFileId: 'img' }));
});

test('filter graph normalizes mixed sample rates and channels before concatenation', () => {
  const graph = buildFilterGraph(20, { width: 1920, imageMode: 'contain', normalizeAudio: false });
  assert.match(graph, /scale=1920:1080/);
  assert.equal((graph.match(/aresample=48000/g) || []).length, 20);
  assert.equal((graph.match(/channel_layouts=stereo/g) || []).length, 20);
  assert.match(graph, /concat=n=20:v=0:a=1\[aout\]/);
  assert.ok(graph.length < 20_000);
});

test('filter graph handles maximum track count without duplicate labels', () => {
  const graph = buildFilterGraph(MAX_AUDIO_FILES, { width: 1280, imageMode: 'cover' });
  for (let i = 0; i < MAX_AUDIO_FILES; i += 1) {
    assert.equal((graph.match(new RegExp(`\\[a${i}\\]`, 'g')) || []).length, 2);
  }
});

test('job IDs are unpredictable fixed-width tokens', () => {
  const ids = new Set(Array.from({ length: 10_000 }, createJobId));
  assert.equal(ids.size, 10_000);
  for (const id of ids) assert.ok(isJobId(id));
  assert.equal(isJobId('../bad'), false);
});

test('chapter text uses cumulative real durations', () => {
  assert.equal(buildChapterText(['A', 'B', 'C'], [60.9, 120.2, 3661]), '0:00 A\n1:00 B\n3:01 C\n');
});
