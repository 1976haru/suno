import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'src');

/**
 * TASK v3.31 (Part 2, verification requirement) — the single most important
 * invariant of this whole tool: it must never click Create/Generate. This
 * doesn't try to guess every possible way a click could be spelled; it
 * asserts the much stronger, simpler property that the word ".click(" does
 * not appear anywhere in src/ at all — this tool only ever calls .fill()
 * and .waitFor(), so if a .click( call is ever added, this test is the
 * tripwire, regardless of what element it targets.
 */
test('no source file under src/ calls .click( anywhere', () => {
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.mjs'));
  assert.ok(files.length > 0, 'expected to find .mjs files under src/');
  for (const file of files) {
    const contents = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    assert.doesNotMatch(contents, /\.click\s*\(/, `${file} must never call .click( — this tool only fills fields, a human always clicks Create`);
  }
});

test('no source file under src/ references a create/generate selector or action', () => {
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.mjs'));
  for (const file of files) {
    const contents = fs.readFileSync(path.join(SRC_DIR, file), 'utf8').toLowerCase();
    assert.doesNotMatch(contents, /button\[.*(create|generate).*\]/, `${file} should not reference a create/generate button selector`);
  }
});
