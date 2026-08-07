import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * codex 지시문 02 (TASK E) — Step3Generate.tsx isn't unit-testable directly
 * (no jsdom/React-rendering test infra — see tests/generationReservationWiring.test.ts's
 * own identical "source-level regression guard" precedent). This asserts,
 * textually, that GenerationContractPanel's real 19-row display was
 * genuinely extended with the 5 new rows this task adds — referenceMood/
 * negativeStyle/avoidWords (already real GenerationChoiceProvenance-tracked
 * fields that were simply never shown before) and bilingualPair/
 * scenePlanningMode (deliberately display-only, no fake provenance entry —
 * see this file's own doc comments in Step3Generate.tsx for why, mirroring
 * openingStyle's own pre-existing precedent).
 */
describe('[codex 지시문 02 TASK E] Step3Generate.tsx GenerationContractPanel — expanded contract display', () => {
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

  const panelBody = extractFunctionBody('GenerationContractPanel');

  it('surfaces referenceMood, the one real provenance-tracked field that was never shown before', () => {
    expect(panelBody).toContain('opts.referenceMood');
    expect(panelBody).toContain('Reference mood');
  });

  it('surfaces negativeStyle', () => {
    expect(panelBody).toContain('opts.negativeStyle');
    expect(panelBody).toContain('Exclude 스타일');
  });

  it('surfaces avoidWords', () => {
    expect(panelBody).toContain('opts.avoidWords');
    expect(panelBody).toContain('가사에서 피할 것');
  });

  it('surfaces bilingualPair via the real resolver (resolveBilingualPair), not a fake provenance entry', () => {
    expect(panelBody).toContain('resolveBilingualPair(opts)');
    expect(panelBody).toContain('이중 언어 조합');
  });

  it('surfaces scenePlanningMode via the real resolver (resolveScenePlanningMode)', () => {
    expect(panelBody).toContain('resolveScenePlanningMode(opts');
    expect(panelBody).toContain('장면 계획 방식');
  });

  it('bilingualPair row is conditionally rendered (hidden entirely when no real pair resolves, never a fake "-" row for every non-bilingual generation)', () => {
    expect(panelBody).toMatch(/\{bilingualPairValue && \(/);
  });

  it('imports both new resolvers from their real source modules', () => {
    expect(source).toContain("resolveBilingualPair");
    expect(source).toContain("from '../../core/localGenerator'");
    expect(source).toMatch(/resolveScenePlanningMode.*from '\.\.\/\.\.\/core\/bridgeInstruction'/);
  });
});
