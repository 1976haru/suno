import { describe, expect, it } from 'vitest';
import { mergeAtom } from '../src/core/promptAxisMerge';
import { classifyClause, type PromptAxis } from '../src/data/promptAxisLexicon';

function axesOf(stylePrompt: string): PromptAxis[] {
  return stylePrompt.split(',').map(c => c.trim()).filter(Boolean)
    .map((text, index) => classifyClause(text, index === 0))
    .filter((axis): axis is PromptAxis => Boolean(axis));
}

/**
 * 지시문 16 (TASK B-3) — mergeAtom replaces appendVerbatimIfMissing's
 * string-only-match with axis-aware merging. Every scenario here is a real
 * measured bug (§1-2 intro contradiction, §1-3 duplicate lead-vocal
 * declaration, §1-4 duplicate token), not a hypothetical.
 */
describe('[지시문 16 TASK B-3] mergeAtom', () => {
  it('appends when the axis is not yet declared (single-declaration axis)', () => {
    const prompt = 'Sunshine Pop, late-1960s, 69 BPM';
    const result = mergeAtom(prompt, { axis: 'intro', text: 'warm string ensemble swell intro texture', locked: true });
    expect(result).toBe('Sunshine Pop, late-1960s, 69 BPM, warm string ensemble swell intro texture');
  });

  it('§1-2 실측: intro 축이 이미 있고 locked면 그 자리에서 replace — 모순이 사라진다', () => {
    // real T1 fixture text: "cold open straight into the hook" (immediate) already present.
    const prompt = 'Sunshine Pop, late-1960s, 69 BPM, cold open straight into the hook, 3:10-3:35';
    const result = mergeAtom(prompt, { axis: 'intro', text: 'warm string ensemble swell intro texture', locked: true });
    expect(result).toBe('Sunshine Pop, late-1960s, 69 BPM, warm string ensemble swell intro texture, 3:10-3:35');
    // exactly one intro-axis clause survives, at the original position — no contradiction.
    expect(axesOf(result).filter(a => a === 'intro')).toHaveLength(1);
  });

  it('creative(단일 선언 축)이면 이미 있는 LLM 표현을 존중하고 skip한다', () => {
    const prompt = 'Sunshine Pop, late-1960s, 69 BPM, cold open straight into the hook';
    const result = mergeAtom(prompt, { axis: 'intro', text: 'warm string ensemble swell intro texture', locked: false });
    expect(result).toBe(prompt);
  });

  it('§1-3 실측(T5): 단일 선언 축에 중복이 2개 있어도 locked replace 후 정확히 1개만 남는다', () => {
    const prompt = 'British Beat Pop, early-1960s, 116 BPM, male relaxed mid-range lead, jangly eighth-note pulse, sustained lead note carries into the last chorus';
    const result = mergeAtom(prompt, { axis: 'leadVocal', text: 'male relaxed mid-range lead', locked: true });
    expect(axesOf(result).filter(a => a === 'leadVocal')).toHaveLength(1);
    expect(result).toContain('male relaxed mid-range lead');
    expect(result).not.toContain('sustained lead note carries into the last chorus');
  });

  it('§1-4 실측(T14): "male male" 같은 중복 토큰도 leadVocal 축 단일화로 정리된다', () => {
    const prompt = 'Doo-Wop Close Harmony, 90 BPM, male male head-voice lead';
    const result = mergeAtom(prompt, { axis: 'leadVocal', text: 'male head-voice lead', locked: true });
    expect(result).toContain('male head-voice lead');
    expect(result).not.toContain('male male');
  });

  it('복수 허용 축(genre)은 같은 텍스트가 이미 있으면 skip한다', () => {
    const prompt = 'Sunshine Pop, late-1960s, harpsichord';
    const result = mergeAtom(prompt, { axis: 'genre', text: 'harpsichord', locked: true });
    expect(result).toBe(prompt);
  });

  it('복수 허용 축(harmony)은 서로 다른 텍스트면 둘 다 남는다', () => {
    const prompt = 'Sunshine Pop, late-1960s, I-vi-IV-V doo-wop progression';
    const result = mergeAtom(prompt, { axis: 'harmony', text: 'maj7 color', locked: true });
    expect(result).toContain('I-vi-IV-V doo-wop progression');
    expect(result).toContain('maj7 color');
  });

  it('빈 텍스트는 no-op이다 (appendVerbatimIfMissing의 기존 guard와 동일)', () => {
    const prompt = 'Sunshine Pop, late-1960s, 69 BPM';
    expect(mergeAtom(prompt, { axis: 'hookDevice', text: '', locked: true })).toBe(prompt);
    expect(mergeAtom(prompt, { axis: 'hookDevice', text: '   ', locked: true })).toBe(prompt);
  });

  it('단일 선언 축이 없을 때는 append — 기존 appendVerbatimIfMissing과 동일한 최소 동작', () => {
    const prompt = 'Sunshine Pop, harpsichord';
    const result = mergeAtom(prompt, { axis: 'duration', text: '3:10-3:35', locked: true });
    expect(result).toBe('Sunshine Pop, harpsichord, 3:10-3:35');
  });
});
