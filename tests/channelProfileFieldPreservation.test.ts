import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDraftChannel, normalizeChannel, readStoredChannels, writeStoredChannels } from '../src/utils/channelProfile';
import { presetsForWorkspace } from '../src/hooks/useChannelManager';
import { setCurrentWorkspace, __resetWorkspaceScopeForTests } from '../src/core/workspaceScope';
import type { ChannelProfile } from '../src/types';

/**
 * v5.12 — real, verified bug: normalizeChannel's return object never
 * included `vocalQuotaOverride` at all, so EVERY channel that passed
 * through it (readStoredChannels on load, writeStoredChannels's callers on
 * save, createDraftChannel on draft creation — i.e. almost every real
 * channel) silently lost a set gender-quota override. Concretely:
 * kr-idol-male's own channel presets (data/presets.ts) carry
 * `{ male: 15, female: 0, mixed: 3 }`; after normalizeChannel the field
 * came back `undefined`, silently falling back to the generic adult 6/6/6
 * quota — defeating the entire point of TASK K2 §5-1's per-workspace
 * override (a "male idol" channel could end up generating female-only
 * songs). createDraftChannel's v5.9 template-copy path had the same
 * class of bug for six more fields (promise/visualIdentity/preferredMoods/
 * forbiddenCliches/seoKeywords/vocalQuotaOverride) — those were hardcoded
 * generic defaults regardless of `templateChannel`, unlike the other six
 * fields that path already cloned.
 *
 * A minimal in-memory `window.localStorage` is installed only for this
 * file's own beforeEach/afterEach (Node's vitest environment has no
 * `window` at all — see workspaceScope.test.ts's own comment on this —
 * so readStoredChannels/writeStoredChannels are silent no-ops without it).
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: new MemoryStorage() };
});

afterEach(() => {
  __resetWorkspaceScopeForTests();
  delete (globalThis as unknown as { window?: unknown }).window;
});

// Every field on ChannelProfile — kept as an explicit list (not
// Object.keys on a real preset) so a future field added to the interface
// but never wired into this list still gets caught by the "count of keys
// audited" assertion below, rather than silently passing.
const ALL_CHANNEL_PROFILE_FIELDS: (keyof ChannelProfile)[] = [
  'id', 'name', 'englishName', 'market', 'primaryLanguage', 'audience',
  'promise', 'visualIdentity', 'defaultVocal', 'preferredGenres',
  'preferredMoods', 'forbiddenCliches', 'seoKeywords', 'archetype',
  'vocalQuotaOverride'
];

const CREATE_DRAFT_TEMPLATE_CHECKLIST: (keyof ChannelProfile)[] = [
  'archetype', 'audience', 'market', 'primaryLanguage', 'defaultVocal',
  'preferredGenres', 'preferredMoods', 'forbiddenCliches', 'seoKeywords',
  'vocalQuotaOverride', 'visualIdentity', 'promise'
];

describe('[v5.12] normalizeChannel preserves vocalQuotaOverride (real bug: it used to be silently dropped)', () => {
  it('an input with vocalQuotaOverride set comes back with the SAME override, not undefined', () => {
    const channel = normalizeChannel({
      id: 'x', name: 'x', archetype: 'kr-idol-male',
      vocalQuotaOverride: { male: 15, female: 0, mixed: 3 }
    });
    expect(channel.vocalQuotaOverride).toEqual({ male: 15, female: 0, mixed: 3 });
  });

  it('an input with NO vocalQuotaOverride stays undefined — never invents a default', () => {
    const channel = normalizeChannel({ id: 'x', name: 'x', archetype: 'senior-morning' });
    expect(channel.vocalQuotaOverride).toBeUndefined();
  });

  it('the real kr-idol-male preset survives normalizeChannel with its override intact', () => {
    const preset = presetsForWorkspace('kr-idol-male')[0];
    expect(preset.vocalQuotaOverride).toEqual({ male: 15, female: 0, mixed: 3 });
    const normalized = normalizeChannel(preset);
    expect(normalized.vocalQuotaOverride).toEqual({ male: 15, female: 0, mixed: 3 });
  });

  it('the real kr-idol-female preset survives normalizeChannel with its override intact', () => {
    const preset = presetsForWorkspace('kr-idol-female')[0];
    expect(preset.vocalQuotaOverride).toEqual({ male: 0, female: 15, mixed: 3 });
    const normalized = normalizeChannel(preset);
    expect(normalized.vocalQuotaOverride).toEqual({ male: 0, female: 15, mixed: 3 });
  });
});

describe('[v5.12] systematic full-field audit — every ChannelProfile field must survive normalizeChannel unchanged when present on input', () => {
  it('a fully-populated ChannelProfile (every field set to a recognizable non-default value) comes back byte-identical, field by field', () => {
    const full: ChannelProfile = {
      id: 'audit-id',
      name: 'Audit Name',
      englishName: 'Audit English Name',
      market: 'japan',
      primaryLanguage: 'japanese',
      audience: 'thirtiesForties',
      promise: 'AUDIT PROMISE VALUE',
      visualIdentity: 'AUDIT VISUAL IDENTITY VALUE',
      defaultVocal: 'AUDIT DEFAULT VOCAL VALUE',
      preferredGenres: ['audit-genre-1', 'audit-genre-2'],
      preferredMoods: ['audit-mood-1'],
      forbiddenCliches: ['audit-cliche-1', 'audit-cliche-2'],
      seoKeywords: ['audit-seo-1'],
      archetype: 'kr-idol-male',
      vocalQuotaOverride: { male: 15, female: 0, mixed: 3 }
    };

    const out = normalizeChannel(full);

    // Confirms this test's own checklist actually covers every field on the
    // interface — if a new field is added to ChannelProfile in types.ts but
    // never added to ALL_CHANNEL_PROFILE_FIELDS above, this length check
    // (not the interface itself) is what would need updating, making the
    // omission visible instead of silently untested.
    expect(ALL_CHANNEL_PROFILE_FIELDS).toHaveLength(Object.keys(full).length);

    const dropped: string[] = [];
    for (const key of ALL_CHANNEL_PROFILE_FIELDS) {
      if (JSON.stringify(full[key]) !== JSON.stringify(out[key])) dropped.push(key);
    }
    expect(dropped).toEqual([]);
  });
});

describe('[v5.12] createDraftChannel template-copy path — full checklist, every field must clone templateChannel', () => {
  it.each(['kr-idol-male', 'kr-idol-female'] as const)('%s workspace default preset: every checklist field clones through, only id/name/englishName get fresh values', (workspaceId) => {
    const template = presetsForWorkspace(workspaceId)[0];
    const draft = createDraftChannel('테스트 채널', template);

    for (const key of CREATE_DRAFT_TEMPLATE_CHECKLIST) {
      expect(draft[key], `field "${key}" should clone templateChannel's value`).toEqual(template[key]);
    }
    // identity fields must NOT clone the template — they're the caller's own
    expect(draft.name).toBe('테스트 채널');
    expect(draft.id).not.toBe(template.id);
    expect(draft.englishName).toBe('테스트 채널');
  });

  it('no templateChannel: vocalQuotaOverride stays undefined (no invented default), rest of the old fallback behavior is unchanged', () => {
    const draft = createDraftChannel('오늘 만든 채널');
    expect(draft.vocalQuotaOverride).toBeUndefined();
    expect(draft.archetype).toBe('senior-morning');
    expect(draft.forbiddenCliches).toEqual(['famous artist imitation', 'copied song structure']);
  });
});

describe('[v5.12] round-trip: draft -> normalizeChannel -> writeStoredChannels -> readStoredChannels', () => {
  it.each([
    ['kr-idol-male', { male: 15, female: 0, mixed: 3 }],
    ['kr-idol-female', { male: 0, female: 15, mixed: 3 }]
  ] as const)('%s: vocalQuotaOverride and every other checklist field survive a full save/load cycle', (workspaceId, expectedQuota) => {
    setCurrentWorkspace(workspaceId);
    const template = presetsForWorkspace(workspaceId)[0];
    expect(template.archetype).toBe(workspaceId);
    expect(template.forbiddenCliches).toHaveLength(6);
    expect(template.vocalQuotaOverride).toEqual(expectedQuota);

    const draft = createDraftChannel('저장 테스트 채널', template);

    // simulate save
    writeStoredChannels([draft]);
    // simulate load (goes through normalizeChannel again internally)
    const [loaded] = readStoredChannels();

    expect(loaded).toBeDefined();
    expect(loaded.vocalQuotaOverride).toEqual(expectedQuota);
    expect(loaded.forbiddenCliches).toHaveLength(6);
    expect(loaded.forbiddenCliches).toEqual(template.forbiddenCliches);

    for (const key of CREATE_DRAFT_TEMPLATE_CHECKLIST) {
      expect(loaded[key], `field "${key}" should survive the save/load round trip`).toEqual(template[key]);
    }
    // the draft's own identity survives too, untouched by the template
    expect(loaded.name).toBe('저장 테스트 채널');
    expect(loaded.id).toBe(draft.id);
  });

  it('a channel with NO vocalQuotaOverride round-trips to still-undefined, never gains a phantom default', () => {
    setCurrentWorkspace('senior-oldpop');
    const draft = createDraftChannel('일반 채널');
    expect(draft.vocalQuotaOverride).toBeUndefined();

    writeStoredChannels([draft]);
    const [loaded] = readStoredChannels();
    expect(loaded.vocalQuotaOverride).toBeUndefined();
  });
});
