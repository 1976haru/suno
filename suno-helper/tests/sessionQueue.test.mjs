import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionQueue, DEFAULT_MAX_SONGS_PER_SESSION } from '../src/sessionQueue.mjs';

test('DEFAULT_MAX_SONGS_PER_SESSION is a conservative 20', () => {
  assert.equal(DEFAULT_MAX_SONGS_PER_SESSION, 20);
});

test('resolveSessionQueue returns every song unlimited when under the default cap', () => {
  const songs = Array.from({ length: 12 }, (_, i) => i + 1);
  const { queue, limited, limit } = resolveSessionQueue(songs);
  assert.deepEqual(queue, songs);
  assert.equal(limited, false);
  assert.equal(limit, 20);
});

test('resolveSessionQueue truncates to the default cap when there are more than 20 songs', () => {
  const songs = Array.from({ length: 40 }, (_, i) => i + 1);
  const { queue, limited, limit } = resolveSessionQueue(songs);
  assert.equal(queue.length, 20);
  assert.equal(limited, true);
  assert.equal(limit, 20);
});

test('resolveSessionQueue honors an explicit --max override', () => {
  const songs = Array.from({ length: 40 }, (_, i) => i + 1);
  const { queue, limited } = resolveSessionQueue(songs, 40);
  assert.equal(queue.length, 40);
  assert.equal(limited, false);
});

test('resolveSessionQueue falls back to the default for an invalid maxSongs value', () => {
  const songs = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.equal(resolveSessionQueue(songs, 0).limit, 20);
  assert.equal(resolveSessionQueue(songs, -5).limit, 20);
  assert.equal(resolveSessionQueue(songs, NaN).limit, 20);
  assert.equal(resolveSessionQueue(songs, 'not a number').limit, 20);
});
