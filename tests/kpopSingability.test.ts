import { describe, expect, it } from 'vitest';
import { measureKpopSingability } from '../src/core/kpopSingability';

function lyricsWith(hook: string, opts: { repeats?: number; chant?: boolean; chorusLine?: string } = {}) {
  const repeats = opts.repeats ?? 4;
  const chorusLine = opts.chorusLine ?? hook;
  const chorusBlock = ['[Chorus]', ...Array.from({ length: repeats }, () => chorusLine)].join('\n');
  const chantBlock = opts.chant ? '\n[Chant]\nhey hey hey' : '';
  return `[Verse 1]\n어떤 절 가사\n${chorusBlock}${chantBlock}`;
}

describe('지시문 37 (TASK C-1) — measureKpopSingability', () => {
  it('counts hook repeats and flags 4+ as ok', () => {
    const m = measureKpopSingability({ lyrics: lyricsWith('Own Way', { repeats: 4 }), hookPhrase: 'Own Way' });
    expect(m.hookRepeatCount).toBe(4);
    expect(m.hookRepeatCountOk).toBe(true);
  });

  it('flags fewer than 4 hook repeats as not ok', () => {
    const m = measureKpopSingability({ lyrics: lyricsWith('Own Way', { repeats: 2 }), hookPhrase: 'Own Way' });
    expect(m.hookRepeatCount).toBe(2);
    expect(m.hookRepeatCountOk).toBe(false);
  });

  it('hook line word count in 3-6 range is ok', () => {
    const m = measureKpopSingability({ lyrics: lyricsWith('I Stand Steady'), hookPhrase: 'I Stand Steady' });
    expect(m.hookLineWordCount).toBe(3);
    expect(m.hookLineWordCountOk).toBe(true);
  });

  it('a 1-word hook is outside the 3-6 range', () => {
    const m = measureKpopSingability({ lyrics: lyricsWith('Steady'), hookPhrase: 'Steady' });
    expect(m.hookLineWordCount).toBe(1);
    expect(m.hookLineWordCountOk).toBe(false);
  });

  it('detects a [Chant] section tag', () => {
    const m = measureKpopSingability({ lyrics: lyricsWith('Own Way', { chant: true }), hookPhrase: 'Own Way' });
    expect(m.chantLinePresent).toBe(true);
  });

  it('reports no chant line when none is tagged', () => {
    const m = measureKpopSingability({ lyrics: lyricsWith('Own Way', { chant: false }), hookPhrase: 'Own Way' });
    expect(m.chantLinePresent).toBe(false);
  });

  it('computes chorus syllable density from Hangul syllable count', () => {
    // "바람이 묻는 말에 대답해" = 10 Hangul syllables, matches real-pack chorus line length
    const m = measureKpopSingability({ lyrics: lyricsWith('Own Way', { chorusLine: '바람이 묻는 말에 대답해' }), hookPhrase: 'Own Way' });
    expect(m.chorusSyllableDensity).toBe(10);
    expect(m.chorusSyllableDensityOk).toBe(true);
  });

  it('flags an excessively dense chorus line as not ok', () => {
    const denseLine = '바람이불어오는날이면나는그길을따라걸어가며생각에잠긴다';
    const m = measureKpopSingability({ lyrics: lyricsWith('Own Way', { chorusLine: denseLine }), hookPhrase: 'Own Way' });
    expect(m.chorusSyllableDensityOk).toBe(false);
  });
});
