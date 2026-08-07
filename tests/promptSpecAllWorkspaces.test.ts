import { describe, expect, it } from 'vitest';
import { compilePromptSpec, promptSpecFromSlot, auditStylePromptAgainstSpec, type PromptSpec } from '../src/core/promptSpec';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks, makeOptions } from './fixtures';
import type { ChannelArchetype, WorkspaceId } from '../src/types';

/**
 * codex 지시문 03 (TASK A) — real, correctly-typed PromptSpec contract
 * where lead vocal / BPM / intro mode / duration each exist as exactly one
 * field (see src/core/promptSpec.ts's own top doc comment for the full
 * scoping decision: a real type + real compiler + real audit bridge, NOT a
 * full rewrite of the 3 existing generation-path subsystems — that would
 * be a multi-week architecture migration, out of scope for one session).
 */
const WORKSPACE_ARCHETYPES: { archetype: ChannelArchetype; workspaceId: WorkspaceId }[] = [
  { archetype: 'senior-morning', workspaceId: 'senior-oldpop' },
  { archetype: 'kr-2030-pop', workspaceId: 'kr-2030' },
  { archetype: 'jp-2030-pop', workspaceId: 'jp-2030' },
  { archetype: 'kr-kids-song', workspaceId: 'kr-kids' },
  { archetype: 'jp-kids-song', workspaceId: 'jp-kids' },
  { archetype: 'kr-idol-male', workspaceId: 'kr-idol-male' },
  { archetype: 'kr-idol-female', workspaceId: 'kr-idol-female' }
];

describe('[codex 지시문 03 TASK A] promptSpecFromSlot — real projection across all 7 workspaces', () => {
  it.each(WORKSPACE_ARCHETYPES)('$workspaceId: a real preallocated slot projects into a well-formed PromptSpec', ({ archetype, workspaceId }) => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel, `no channel for ${archetype}`).toBeDefined();
    const opts = makeOptions({ channel: channel!, songCount: 6 });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const spec = promptSpecFromSlot(slot, { workspaceId, durationRange: [180, 210] });
      // Single-field invariants are enforced by the TYPE itself (tempo.bpm
      // is a bare number, vocal is one VocalSpec object, duration.range is
      // one tuple) — these assertions just confirm the projection actually
      // populated them from real data, not that the shape is respected
      // (that's compile-time, already proven by this file typechecking).
      expect(spec.workspaceId).toBe(workspaceId);
      expect(typeof spec.tempo.bpm).toBe('number');
      expect(spec.tempo.bpm).toBeGreaterThan(0);
      expect(Array.isArray(spec.instrumentation.instruments)).toBe(true);
      expect(spec.duration.range).toEqual([180, 210]);
    }
  });
});

describe('[codex 지시문 03 TASK A] compilePromptSpec', () => {
  function realSpec(overrides: Partial<PromptSpec> = {}): PromptSpec {
    return {
      workspaceId: 'senior-oldpop',
      genre: { ids: ['oldpop-soft-rock-am'], text: 'AM-gold soft rock, warm strings' },
      tempo: { bpm: 92 },
      vocal: { gender: 'male', text: 'warm male baritone lead vocal' },
      instrumentation: { instruments: ['acoustic guitar', 'piano'] },
      harmony: { moneyChordText: 'I-V-vi-IV progression' },
      structure: { template: 'T1' },
      hook: {},
      arrangement: { density: 'medium', introMode: 'vocal-immediate' },
      mix: {},
      duration: { range: [180, 210] },
      negatives: { safety: [], copyright: [], workspace: [], vocal: [], arrangement: [], user: [] },
      ...overrides
    };
  }

  it('produces exactly one BPM mention and one lead-vocal declaration', () => {
    const spec = realSpec();
    const compiled = compilePromptSpec(spec);
    expect(compiled).toContain('92 BPM');
    expect((compiled.match(/\bBPM\b/gi) ?? []).length).toBe(1);
    expect(compiled).toContain('warm male baritone lead vocal');
  });

  it('every real workspace-representative spec compiles to a non-empty, single-BPM string', () => {
    for (const { workspaceId } of WORKSPACE_ARCHETYPES) {
      const compiled = compilePromptSpec(realSpec({ workspaceId }));
      expect(compiled.length).toBeGreaterThan(0);
      expect((compiled.match(/\bBPM\b/gi) ?? []).length).toBe(1);
    }
  });
});

describe('[codex 지시문 03 TASK A] auditStylePromptAgainstSpec — the real type-to-string bridge', () => {
  it('flags a real dual-BPM stylePrompt', () => {
    const spec = { vocal: { gender: 'male' as const, text: 'warm male baritone lead vocal' } };
    const violations = auditStylePromptAgainstSpec('warm male baritone lead vocal, acoustic guitar, 92 BPM, mid tempo, 100 BPM', spec);
    expect(violations.some(v => v.field === 'tempo')).toBe(true);
  });

  it('flags a real dual-gender stylePrompt for a single-gender resolution', () => {
    const spec = { vocal: { gender: 'male' as const, text: 'warm male baritone lead vocal' } };
    const violations = auditStylePromptAgainstSpec('warm male baritone lead vocal, airy female vocal, 92 BPM', spec);
    expect(violations.some(v => v.field === 'vocal')).toBe(true);
  });

  it('a clean stylePrompt produces no violations', () => {
    const spec = { vocal: { gender: 'male' as const, text: 'warm male baritone lead vocal' } };
    const violations = auditStylePromptAgainstSpec('warm male baritone lead vocal, acoustic guitar, 92 BPM', spec);
    expect(violations).toHaveLength(0);
  });

  it('a duet/mixed resolution is never flagged for having both genders present (that is correct, not a violation)', () => {
    const spec = { vocal: { gender: 'duet' as const, text: 'male and female duet' } };
    const violations = auditStylePromptAgainstSpec('male and female duet, acoustic guitar, 92 BPM', spec);
    expect(violations).toHaveLength(0);
  });
});
