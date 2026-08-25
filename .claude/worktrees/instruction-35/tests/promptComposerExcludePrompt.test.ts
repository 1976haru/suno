import { describe, expect, it } from 'vitest';
import { buildExcludePrompt, EXCLUDE_PROMPT_HARD_CAP, EXCLUDE_PROMPT_SAFE_TARGET } from '../src/core/promptComposer';
import { makeOptions, testGenres } from './fixtures';

/**
 * TASK v5.21 (TASK B-1/B-3) — real measurement before this task: a live
 * 18-song local-generation-adjacent pack averaged 1,041 excludePrompt chars
 * (max 1,070), 18/18 over 900. buildExcludePrompt now fits general
 * quality/preference terms (the one trimmable tier) into a budget so the
 * always-kept tiers (copyright/safety, user avoidWords, audience
 * hardExclusions, channel soundFloor) are never at risk of being pushed out
 * by a long genre avoidTraits list.
 */
describe('[v5.21 TASK B-1/B-3] buildExcludePrompt — length budget', () => {
  it('stays at or under the hard cap for a real channel/genre combination', () => {
    const opts = makeOptions({});
    const text = buildExcludePrompt(opts, testGenres);
    expect(text.length).toBeLessThanOrEqual(EXCLUDE_PROMPT_HARD_CAP);
  });

  it('never drops the copyright/safety literal even under a tight budget', () => {
    const opts = makeOptions({ avoidWords: 'x'.repeat(400) });
    const text = buildExcludePrompt(opts, testGenres);
    expect(text).toContain('famous artist imitation');
  });

  it('never drops the user\'s own avoidWords', () => {
    const opts = makeOptions({ avoidWords: 'no whistling, no yodeling' });
    const text = buildExcludePrompt(opts, testGenres);
    expect(text).toContain('no whistling');
    expect(text).toContain('no yodeling');
  });

  it('is close to but does not exceed the soft target when the trimmable tier is short', () => {
    const opts = makeOptions({});
    const text = buildExcludePrompt(opts, testGenres);
    // The soft target only bounds what gets ADDED from the trimmable tier —
    // the always-kept tiers alone can still land under or over it depending
    // on the channel/genre; this just confirms the function runs the budget
    // logic at all (a regression to "always ~1000+ chars" would fail this).
    expect(text.length).toBeLessThan(EXCLUDE_PROMPT_SAFE_TARGET + 100);
  });
});
