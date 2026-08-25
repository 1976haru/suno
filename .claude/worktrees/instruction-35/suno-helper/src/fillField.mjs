/**
 * TASK v3.31 (Part 2) — tries each candidate selector in order; the first
 * one that becomes visible within `timeoutMs` gets `.fill(value)` called on
 * it. `page` is duck-typed (only needs `.locator()` returning something with
 * `.first()`/`.waitFor()`/`.fill()`, and `.evaluate()`) so this is testable
 * against a plain mock object — no real browser or Playwright install
 * required to run these tests.
 *
 * IMPORTANT — this file must never call anything that submits/creates a
 * song. It only ever fills text fields. See tests/noAutoCreate.test.mjs for
 * the automated check that guards this invariant.
 */
export async function fillField(page, selectorCandidates, value, options = {}) {
  const timeoutMs = options.timeoutMs ?? 2000;
  if (!value) {
    return { filled: false, usedSelector: null, fallback: false, clipboardOk: null };
  }

  for (const selector of selectorCandidates || []) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });
      await locator.fill(value);
      return { filled: true, usedSelector: selector, fallback: false, clipboardOk: null };
    } catch {
      // this candidate didn't resolve in time — try the next one
    }
  }

  const clipboardOk = await copyToClipboard(page, value);
  return { filled: false, usedSelector: null, fallback: true, clipboardOk };
}

/** Best-effort clipboard write through the already-open page (avoids adding an OS-clipboard dependency just for this fallback path). Returns false (never throws) so callers can print the raw text as a last resort. */
export async function copyToClipboard(page, text) {
  try {
    await page.evaluate(async t => {
      await navigator.clipboard.writeText(t);
    }, text);
    return true;
  } catch {
    return false;
  }
}
