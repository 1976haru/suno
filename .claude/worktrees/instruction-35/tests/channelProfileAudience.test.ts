import { describe, expect, it } from 'vitest';
import { createDraftChannel, normalizeChannel } from '../src/utils/channelProfile';

/**
 * v3.77 (TASK C) — real bug found investigating why a real custom
 * "oldpoplounge" channel likely ended up on the general/allAges audience
 * profile (no senior-tuned tempo bands, narrow BPM) despite its archetype
 * defaulting to 'senior-morning': normalizeChannel derived `archetype` and
 * `audience` from two INDEPENDENT defaults ('senior-morning' vs a flat
 * 'allAges'), so a channel created via the quick-create flow (which sets
 * neither field) ended up with a mismatched pair instead of the same
 * "senior" identity on both fields.
 */
describe('[v3.77 TASK C] channel audience derives consistently from archetype', () => {
  it('a brand-new draft channel (quick-create flow) gets a consistent senior-morning + seniors pair, never a mismatched allAges', () => {
    const channel = createDraftChannel('오늘 만든 채널');
    expect(channel.archetype).toBe('senior-morning');
    expect(channel.audience).toBe('seniors');
  });

  it('normalizeChannel derives audience from an explicit oldpop-lounge archetype when audience is omitted', () => {
    const channel = normalizeChannel({ id: 'oldpoplounge', name: 'oldpoplounge', archetype: 'oldpop-lounge' });
    expect(channel.audience).toBe('seniors');
  });

  it('an explicit audience always wins over the archetype-derived default', () => {
    const channel = normalizeChannel({ id: 'x', name: 'x', archetype: 'oldpop-lounge', audience: 'twenties' });
    expect(channel.audience).toBe('twenties');
  });

  it('audience is never left undefined, even for an archetype with no explicit table entry (defensive)', () => {
    const channel = normalizeChannel({ id: 'x', name: 'x' });
    expect(channel.audience).toBeTruthy();
  });

  it('kids archetype derives the kids audience', () => {
    const channel = normalizeChannel({ id: 'k', name: 'k', archetype: 'kids' });
    expect(channel.audience).toBe('kids');
  });
});
