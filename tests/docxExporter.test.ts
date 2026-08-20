import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildSoundSignature } from '../src/core/soundSignature';
import { buildDocxPlainText, exportDocxBlob } from '../src/utils/docxExporter';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

async function makeDocxPack(songCount = 12, personaMode = true) {
  const opts = makeOptions({ songCount, personaMode });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  const soundSignature = buildSoundSignature(blueprint, opts, opts.channel);
  const input = { blueprint, soundSignature, personaMode, generatedAt: new Date('2026-07-15T00:00:00Z') };
  return { opts, blueprint, soundSignature, text: buildDocxPlainText(input), blob: await exportDocxBlob(input) };
}

describe('docx exporter', () => {
  it('creates a docx file for a 12 song pack', async () => {
    const { blob } = await makeDocxPack(12);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain('wordprocessingml.document');
  });

  it('includes sound signature and Persona name', async () => {
    const { text, soundSignature } = await makeDocxPack(12);
    expect(text).toContain(soundSignature.short);
    expect(text).toContain(soundSignature.personaName);
  });

  it('includes every song style prompt, lyrics, and YouTube metadata', async () => {
    const { text, blueprint } = await makeDocxPack(12);
    for (const song of blueprint.songs) {
      expect(text).toContain(song.stylePrompt);
      expect(text).toContain(song.lyrics);
      expect(text).toContain(song.youtube.title);
      expect(text).toContain(song.youtube.description);
      expect(text).toContain(song.youtube.tags[0]);
    }
  });

  it('marks the seed track', async () => {
    const { text, blueprint } = await makeDocxPack(12);
    expect(text).toContain(`${blueprint.songs[0].trackNo}. ${blueprint.songs[0].title}  [SEED TRACK]`);
  });

  it('includes Persona workflow guidance when personaMode is true', async () => {
    const { text } = await makeDocxPack(12, true);
    expect(text).toContain('Persona workflow');
    expect(text).toContain('Make Persona');
    expect(text).toContain('Generate tracks 2+');
  });

  it('creates a 30 song pack docx within practical size and time', async () => {
    const start = performance.now();
    const { blob } = await makeDocxPack(30);
    expect(performance.now() - start).toBeLessThan(3000);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.size).toBeLessThan(2_000_000);
  });
});
