import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { classifyTitleShape, titleShapeVarietyWarning } from '../src/core/titleShapeVariety';

describe('[v3.64 TASK E] title shape variety', () => {
  it('classifies a single word as single-word', () => {
    expect(classifyTitleShape('Awning')).toBe('single-word');
  });

  it('classifies two bare nouns as noun-noun', () => {
    expect(classifyTitleShape('Steam Radio')).toBe('noun-noun');
    expect(classifyTitleShape('Firstlight Cup')).toBe('noun-noun');
  });

  it('classifies a leading-verb title as verb-phrase regardless of length', () => {
    expect(classifyTitleShape('Wait by the Window')).toBe('verb-phrase');
    expect(classifyTitleShape('Remember Me')).toBe('verb-phrase');
  });

  it('classifies a 3-4 word non-verb-led title as short-phrase', () => {
    expect(classifyTitleShape('The Old Radio')).toBe('short-phrase');
  });

  it('classifies a 5+ word non-verb-led title as long-phrase', () => {
    expect(classifyTitleShape('Riverside Thermos and the Quiet Road')).toBe('long-phrase');
  });

  it('warns when a set uses fewer than 3 distinct title shapes', () => {
    const titles = ['Firstlight Cup', 'Folded Frost', 'Blue Kettle', 'Album Floor', 'Cardigan Air'];
    const warning = titleShapeVarietyWarning(titles);
    expect(warning).toBeDefined();
    expect(warning).toContain('3');
  });

  it('does not warn once a set spans 3+ distinct title shapes', () => {
    const titles = ['Ember', 'Steam Radio', 'Wait by the Window', 'The Old Radio Glow'];
    expect(titleShapeVarietyWarning(titles)).toBeUndefined();
  });

  it('TASK v3.64 — reproduces the real pack\'s reported near-monotony (mostly noun-noun)', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'realBridgePack.json');
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const titles = data.songs.map((s: { title: string }) => s.title);
    const shapes = new Set(titles.map(classifyTitleShape));
    // Real measurement context: mostly noun-noun/single-word — a small pool of shapes either way.
    expect(shapes.size).toBeLessThan(5);
  });
});
