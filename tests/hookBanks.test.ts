import { describe, expect, it } from 'vitest';
import { composeHook, HOOK_SHAPES } from '../src/core/lyricEngine';
import { overrideForArchetype } from '../src/data/hookBanks';
import { resolveHookParts } from '../src/data/hookParts';
import { migrateArchetype } from '../src/data/presets';
import { normalizeChannel } from '../src/utils/channelProfile';
import type { ChannelArchetype } from '../src/types';

function allCombinatorialHooks(archetype: ChannelArchetype): Set<string> {
  const parts = resolveHookParts('english', overrideForArchetype(archetype, 'english'));
  const out = new Set<string>();
  const used = new Set<string>();
  for (const shape of HOOK_SHAPES) {
    for (let i = 0; i < 60; i++) {
      const hook = composeHook(i * 8191 + 17, { language: 'english', shape, usedHooks: used, archetype });
      used.add(hook.phrase);
      out.add(hook.phrase);
    }
  }
  return out;
}

describe('archetype hook banks (TASK X3, v3.4)', () => {
  it('senior-morning and kids never produce the same hook string', () => {
    const seniorMorning = allCombinatorialHooks('senior-morning');
    const kids = allCombinatorialHooks('kids');
    const overlap = [...seniorMorning].filter(hook => kids.has(hook));
    expect(overlap, `unexpected overlap between senior-morning and kids: ${overlap.join(', ')}`).toEqual([]);
  });

  it('senior-morning and showa-cafe never produce the same hook string', () => {
    const seniorMorning = allCombinatorialHooks('senior-morning');
    const showaCafe = allCombinatorialHooks('showa-cafe');
    const overlap = [...seniorMorning].filter(hook => showaCafe.has(hook));
    expect(overlap, `unexpected overlap between senior-morning and showa-cafe: ${overlap.join(', ')}`).toEqual([]);
  });

  it('kids vocabulary contains no breakup/longing/alcohol imagery', () => {
    const forbiddenWords = ['heart', 'love', 'darling', 'wine', 'lonely', 'forget', 'goodbye', 'miss'];
    const override = overrideForArchetype('kids', 'english');
    const allWords = [
      ...(override.imperativeObjects ?? []),
      ...(override.nounModifiers ?? []),
      ...(override.nounObjects ?? []),
      ...(override.vocativeAddressees ?? [])
    ].join(' ').toLowerCase();
    for (const word of forbiddenWords) {
      expect(allWords.includes(word), `kids vocabulary unexpectedly contains "${word}"`).toBe(false);
    }
  });

  it('christmas and lofi-study fall back to the shared default bank (documented deferred archetypes)', () => {
    expect(overrideForArchetype('christmas', 'english')).toEqual({});
    expect(overrideForArchetype('lofi-study', 'english')).toEqual({});
  });

  it('an unrecognized/undefined archetype falls back to senior-morning', () => {
    expect(overrideForArchetype(undefined, 'english')).toEqual(overrideForArchetype('senior-morning', 'english'));
  });

  it('migrateArchetype assigns senior-morning to a channel with no archetype field', () => {
    const legacyChannel = { id: 'legacy', name: 'Legacy Channel' } as never;
    const migrated = migrateArchetype(legacyChannel);
    expect(migrated.archetype).toBe('senior-morning');
  });

  it('migrateArchetype leaves an existing archetype untouched', () => {
    const channel = { id: 'x', name: 'X', archetype: 'kids' as ChannelArchetype } as never;
    expect(migrateArchetype(channel).archetype).toBe('kids');
  });

  it('normalizeChannel (used for all custom/imported channels) also defaults archetype to senior-morning', () => {
    const normalized = normalizeChannel({ id: 'imported', name: 'Imported Channel' });
    expect(normalized.archetype).toBe('senior-morning');
  });
});
