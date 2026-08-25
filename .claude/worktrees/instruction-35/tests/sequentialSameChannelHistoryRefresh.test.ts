import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * codex 지시문 01 (TASK H) — real, confirmed gap this closes: generating and
 * saving set A for a channel, then staying on Step3Generate.tsx (same
 * channel, same language, no navigation) and copying a bridge instruction
 * for set B, could show an avoid-list that never saw what set A just wrote
 * — that screen's own bridgeAvoid/bridgeConceptSceneContext state used to
 * be fetched once per channel/language change via a plain useEffect, never
 * again. App.tsx/Step3Generate.tsx aren't unit-testable directly (no jsdom/
 * React-rendering test infra — see tests/bridgeImportSrtOnly.test.ts's own
 * identical "source-level regression guard" precedent), so this asserts,
 * textually, that every real history-changing function actually bumps the
 * revision, and that Step3Generate.tsx's own avoid-list state is sourced
 * from the revision-aware hook instead of its own fetch-once effects.
 */
describe('[codex 지시문 01 TASK H] every real history-changing function bumps the revision', () => {
  const packLibrarySource = readFileSync(resolve(__dirname, '../src/hooks/usePackLibrary.ts'), 'utf8');
  const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');

  function extractFunctionBody(source: string, name: string): string {
    const signatureIndex = source.indexOf(`function ${name}(`);
    expect(signatureIndex, `function ${name} not found`).toBeGreaterThan(-1);
    // Some of these functions (saveGeneratedSet's setMeta: {...} param,
    // handleGenerationSuccess's sourceOpts: X = {...} default) have object
    // braces INSIDE their own parameter list — skip past the matching
    // closing paren of the parameter list first, so the brace-depth walk
    // below starts at the real function-body opening brace, not a
    // parameter's own type/default-value brace.
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

  it('usePackLibrary.ts imports bumpGenerationHistoryRevision', () => {
    expect(packLibrarySource).toContain("import { bumpGenerationHistoryRevision } from '../core/generationHistoryRevision';");
  });

  for (const name of ['saveCurrentPack', 'saveGeneratedSet', 'saveImportedPack', 'remove', 'importAll', 'deleteAll']) {
    it(`usePackLibrary.ts's ${name} bumps the history revision`, () => {
      const body = extractFunctionBody(packLibrarySource, name);
      expect(body).toContain('bumpGenerationHistoryRevision()');
    });
  }

  it('App.tsx\'s handleGenerationSuccess (the real single-pack autosave choke point) bumps the history revision', () => {
    const body = extractFunctionBody(appSource, 'handleGenerationSuccess');
    expect(body).toContain('bumpGenerationHistoryRevision()');
  });
});

describe('[codex 지시문 01 TASK H] Step3Generate.tsx sources its avoid-list from the revision-aware hook', () => {
  const source = readFileSync(resolve(__dirname, '../src/components/steps/Step3Generate.tsx'), 'utf8');

  it('imports and calls useGenerationHistorySnapshot', () => {
    expect(source).toContain("import { useGenerationHistorySnapshot } from '../../hooks/useGenerationHistorySnapshot';");
    expect(source).toContain('useGenerationHistorySnapshot(opts.channel.id, opts.lyricLanguage)');
  });

  it('no longer has its own separate safeAvoidSet-driven bridgeAvoid effect (the real staleness bug)', () => {
    expect(source).not.toContain("from '../../hooks/useGenerationFlow'");
    expect(source).not.toMatch(/void safeAvoidSet\(/);
  });

  it('bridgeAvoid/bridgeConceptSceneContext are derived from historySnapshot, not their own useState', () => {
    expect(source).not.toMatch(/useState<\{ usedTitles: string\[\]; usedHooks: string\[\] \}>/);
    expect(source).toContain('historySnapshot.usedTitles');
    expect(source).toContain('historySnapshot.recentSituations');
  });
});
