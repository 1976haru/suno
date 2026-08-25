import test from 'node:test';
import assert from 'node:assert/strict';
import { fillField, copyToClipboard } from '../src/fillField.mjs';

/**
 * TASK v3.31 (Part 2) — a minimal fake Playwright `page`: `.locator()`
 * returns an object whose `.first()`/`.waitFor()`/`.fill()` are configurable
 * per test, so the selector-fallback logic is fully testable without a real
 * browser. `visibleSelectors` simulates which selectors would actually
 * resolve to a visible element on the real page.
 */
function makeFakePage({ visibleSelectors = [], evaluateShouldFail = false } = {}) {
  const filledCalls = [];
  const evaluateCalls = [];
  const page = {
    locator(selector) {
      return {
        first() {
          return {
            async waitFor() {
              if (!visibleSelectors.includes(selector)) {
                throw new Error(`selector "${selector}" not visible (fake)`);
              }
            },
            async fill(value) {
              filledCalls.push({ selector, value });
            }
          };
        }
      };
    },
    async evaluate(fn, arg) {
      evaluateCalls.push(arg);
      if (evaluateShouldFail) throw new Error('clipboard permission denied (fake)');
    }
  };
  return { page, filledCalls, evaluateCalls };
}

test('fillField fills the first selector candidate that is visible', async () => {
  const { page, filledCalls } = makeFakePage({ visibleSelectors: ['textarea.style'] });
  const result = await fillField(page, ['textarea.missing', 'textarea.style'], 'my style prompt');
  assert.equal(result.filled, true);
  assert.equal(result.usedSelector, 'textarea.style');
  assert.equal(result.fallback, false);
  assert.deepEqual(filledCalls, [{ selector: 'textarea.style', value: 'my style prompt' }]);
});

test('fillField tries candidates in order and stops at the first visible one', async () => {
  const { page, filledCalls } = makeFakePage({ visibleSelectors: ['textarea.a', 'textarea.b'] });
  await fillField(page, ['textarea.a', 'textarea.b'], 'value');
  assert.equal(filledCalls.length, 1);
  assert.equal(filledCalls[0].selector, 'textarea.a');
});

test('fillField falls back to clipboard copy when no candidate selector is visible', async () => {
  const { page, filledCalls, evaluateCalls } = makeFakePage({ visibleSelectors: [] });
  const result = await fillField(page, ['textarea.missing1', 'textarea.missing2'], 'lyrics text');
  assert.equal(result.filled, false);
  assert.equal(result.fallback, true);
  assert.equal(result.clipboardOk, true);
  assert.equal(filledCalls.length, 0);
  assert.deepEqual(evaluateCalls, ['lyrics text']);
});

test('fillField reports clipboardOk=false when the clipboard write itself fails (e.g. no permission)', async () => {
  const { page } = makeFakePage({ visibleSelectors: [], evaluateShouldFail: true });
  const result = await fillField(page, ['textarea.missing'], 'lyrics text');
  assert.equal(result.fallback, true);
  assert.equal(result.clipboardOk, false);
});

test('fillField is a no-op for an empty/falsy value (e.g. no excludePrompt)', async () => {
  const { page, filledCalls, evaluateCalls } = makeFakePage({ visibleSelectors: ['textarea.exclude'] });
  const result = await fillField(page, ['textarea.exclude'], '');
  assert.equal(result.filled, false);
  assert.equal(result.fallback, false);
  assert.equal(filledCalls.length, 0);
  assert.equal(evaluateCalls.length, 0);
});

test('copyToClipboard returns true on success and false (never throws) on failure', async () => {
  const ok = makeFakePage({ evaluateShouldFail: false });
  assert.equal(await copyToClipboard(ok.page, 'text'), true);

  const fail = makeFakePage({ evaluateShouldFail: true });
  assert.equal(await copyToClipboard(fail.page, 'text'), false);
});
