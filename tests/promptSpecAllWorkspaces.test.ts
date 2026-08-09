import { describe, expect, it } from 'vitest';
import { auditStylePromptAgainstSpec } from '../src/core/promptSpec';

/**
 * codex 지시문 03 (TASK A) — see src/core/promptSpec.ts's own top doc
 * comment. promptSpecFromSlot/compilePromptSpec (and the tests that
 * exercised only them) were removed by the 정합성 점검 §3 dead-code cleanup —
 * neither was ever wired into a real generation path. This file now only
 * covers auditStylePromptAgainstSpec, the one function real callers
 * (core/fullAudit.ts, core/quality.ts) actually use.
 */
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
