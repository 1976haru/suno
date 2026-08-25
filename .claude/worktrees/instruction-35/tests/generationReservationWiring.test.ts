import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * codex 지시문 01 (TASK I) — Step3Generate.tsx isn't unit-testable directly
 * (no jsdom/React-rendering test infra — see tests/bridgeImportSrtOnly.test.ts's
 * own identical "source-level regression guard" precedent). This asserts,
 * textually, that every real bridge-copy action reserves, every real
 * successful-import action releases, and the consumption side (folding
 * sibling reservations into bridgeAvoid) is wired.
 */
describe('[codex 지시문 01 TASK I] Step3Generate.tsx reservation wiring', () => {
  const source = readFileSync(resolve(__dirname, '../src/components/steps/Step3Generate.tsx'), 'utf8');

  function extractFunctionBody(name: string): string {
    const signatureIndex = source.indexOf(`function ${name}(`);
    expect(signatureIndex, `function ${name} not found`).toBeGreaterThan(-1);
    const parenStart = source.indexOf('(', signatureIndex);
    let parenDepth = 0;
    let parenEnd = -1;
    for (let i = parenStart; i < source.length; i++) {
      if (source[i] === '(') parenDepth++;
      else if (source[i] === ')') {
        parenDepth--;
        if (parenDepth === 0) { parenEnd = i; break; }
      }
    }
    expect(parenEnd, `unbalanced parameter list for ${name}`).toBeGreaterThan(-1);
    const braceStart = source.indexOf('{', parenEnd);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(braceStart, i + 1);
      }
    }
    throw new Error(`Unbalanced braces while extracting ${name}`);
  }

  it('imports reserveGeneration/releaseReservation/reservedAvoidLists', () => {
    expect(source).toContain("from '../../core/generationReservationLedger'");
    expect(source).toContain('reserveGeneration');
    expect(source).toContain('releaseReservation');
    expect(source).toContain('reservedAvoidLists');
  });

  for (const name of ['handleCopyClaudeCodeInstruction', 'handleCopyMasterInstruction', 'handleCopySetInstruction']) {
    it(`${name} reserves the generation`, () => {
      const body = extractFunctionBody(name);
      expect(body).toContain('reserveGeneration({');
      expect(body).toContain('runId: generationRunId');
    });
  }

  for (const name of ['handleImportSongsFile', 'handleMultiImportFiles']) {
    it(`${name} releases the reservation on a real successful import`, () => {
      const body = extractFunctionBody(name);
      expect(body).toContain('releaseReservation(generationRunId)');
    });
  }

  it('bridgeAvoid folds in reservedSiblingAvoid (the consumption side, not just record-keeping)', () => {
    expect(source).toContain('reservedSiblingAvoid.titles');
    expect(source).toContain('reservedSiblingAvoid.hooks');
  });

  it('a stable generationRunId is scoped to channel+language, not regenerated every render', () => {
    expect(source).toMatch(/const generationRunId = useMemo\(/);
  });
});
