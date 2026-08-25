import { describe, expect, it } from 'vitest';
import { buildSetConceptLine } from '../src/core/setConcept';
import { channelPresets } from './fixtures';

describe('[v3.35] buildSetConceptLine (lightweight stand-in for v3.33 Part B1)', () => {
  const seniorMorning = channelPresets.find(c => c.archetype === 'senior-morning')!;
  const showaCafe = channelPresets.find(c => c.archetype === 'showa-cafe')!;

  it('includes the 1-based set position out of the total', () => {
    expect(buildSetConceptLine(seniorMorning, 'Christmas', 0, 5)).toContain('Set 1/5');
    expect(buildSetConceptLine(seniorMorning, 'Christmas', 4, 5)).toContain('Set 5/5');
  });

  it('includes the season label', () => {
    expect(buildSetConceptLine(seniorMorning, 'Christmas', 0, 3)).toContain('season: Christmas');
  });

  it('rotates the lead genre across sets (round-robin through the archetype\'s core genres)', () => {
    const lines = Array.from({ length: 6 }, (_, i) => buildSetConceptLine(seniorMorning, 'Christmas', i, 6));
    const genreMentions = lines.map(line => line.match(/lead genre: ([^—]+)/)?.[1]?.trim());
    expect(genreMentions.every(Boolean)).toBe(true);
    // Not all 6 sets should land on the exact same lead genre (there are multiple core genres to rotate through).
    expect(new Set(genreMentions).size).toBeGreaterThan(1);
  });

  it('consecutive sets never repeat the same lead genre (as long as the archetype has more than one core genre)', () => {
    const lines = Array.from({ length: 4 }, (_, i) => buildSetConceptLine(seniorMorning, 'Christmas', i, 4));
    const genreMentions = lines.map(line => line.match(/lead genre: ([^—]+)/)?.[1]?.trim());
    for (let i = 1; i < genreMentions.length; i++) {
      expect(genreMentions[i]).not.toBe(genreMentions[i - 1]);
    }
  });

  it('different archetypes draw from their own core genre list (senior-morning vs showa-cafe differ)', () => {
    const line1 = buildSetConceptLine(seniorMorning, 'Christmas', 0, 1);
    const line2 = buildSetConceptLine(showaCafe, 'Christmas', 0, 1);
    expect(line1).not.toBe(line2);
  });
});
