import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildThumbnailWorksetMarkdown } from '../src/core/thumbnailWorksetExport';
import type { SavedPack } from '../src/types';
import { channelPresets, makeOptions, seasonPacks, testGenres, testMoods } from './fixtures';

function makePack(setIndex: number, setTotal: number): SavedPack {
  const seasonId = setIndex % 2 === 0 ? 'spring-open' : 'may-cafe';
  const season = seasonPacks.find(item => item.id === seasonId) ?? seasonPacks[0];
  const opts = makeOptions({
    projectTitle: `Roma Series Set ${String(setIndex + 1).padStart(2, '0')}`,
    songCount: 3,
    seasonId,
    customConcept: `set-${String(setIndex + 1).padStart(2, '0')} Roman morning terrace`,
    channel: channelPresets[0]
  });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, season);
  return {
    id: `pack-${setIndex}`,
    name: `Pack ${setIndex}`,
    savedAt: new Date(2026, 0, setIndex + 1).toISOString(),
    isAutosave: false,
    channelId: opts.channel.id,
    channelName: opts.channel.name,
    projectTitle: blueprint.projectTitle,
    songCount: blueprint.songs.length,
    avgQualityScore: 90,
    blueprint,
    options: opts,
    personaMode: false,
    setGroupId: 'roma-series',
    setIndex,
    setTotal
  };
}

describe('[v3.40 D5] buildThumbnailWorksetMarkdown', () => {
  it('exports 10 image worksets in set order with composition, motion, and all prompt tabs', () => {
    const packs = Array.from({ length: 10 }, (_, index) => makePack(index, 10)).reverse();
    const markdown = buildThumbnailWorksetMarkdown({
      groupLabel: 'Roma Series (10 sets)',
      packs,
      archetypeId: 'city-roma'
    });

    const headings = Array.from(markdown.matchAll(/^## Set \d{2} of 10:/gm)).map(match => match[0]);
    expect(headings).toHaveLength(10);
    expect(headings[0]).toContain('Set 01');
    expect(headings[9]).toContain('Set 10');
    expect(markdown.indexOf('set-01 Roman morning terrace')).toBeLessThan(markdown.indexOf('set-10 Roman morning terrace'));

    expect(markdown.match(/\*\*Composition guide\*\*/g)).toHaveLength(10);
    expect(markdown.match(/\*\*Motion guide\*\*/g)).toHaveLength(10);
    expect(markdown.match(/Loop advice: 5~10초 루프 클립/g)).toHaveLength(10);
    expect(markdown.match(/Thumbnail 16:9 prompt - Generic \(ChatGPT\/DALL-E\)/g)).toHaveLength(10);
    expect(markdown.match(/Portrait 4:5 prompt - Qwen Image/g)).toHaveLength(10);
    expect(markdown.match(/Cover 1:1 prompt - Stable Diffusion/g)).toHaveLength(10);
    expect(markdown).toContain('--ar 16:9');
    expect(markdown).toContain('--ar 4:5');
    expect(markdown).toContain('--ar 1:1');
    expect(markdown).toContain('Kodak Portra 400');
    expect(markdown).toContain('no branded IP');
  });
});
