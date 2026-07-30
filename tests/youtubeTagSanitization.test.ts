import { describe, expect, it } from 'vitest';
import { importSongsJson } from '../src/core/claudeCodeBridge';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { sanitizePublicYoutubeTags, AI_DISCLOSURE_LINE } from '../src/core/exportCompliance';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.58 (TASK 5-5) — YoutubeMetadata.description legitimately states
 * AI_DISCLOSURE_LINE once (required policy disclosure), but the discrete
 * `tags` field is public discoverability metadata: a bridge-imported song's
 * tags array came from a remote model with zero filtering, so a tag like
 * "suno ai music" could reach a real YouTube upload as keyword-stuffing.
 * See core/exportCompliance.ts's sanitizePublicYoutubeTags.
 */
describe('[v3.58 TASK 5-5] public YouTube tags never carry Suno/AI keyword-stuffing', () => {
  it('sanitizePublicYoutubeTags strips Suno/AI/model keywords but keeps ordinary tags', () => {
    const tags = ['suno ai music', 'AI-generated', 'morning coffee', 'city pop', 'Udio cover', 'ChatGPT lyrics', 'retro playlist'];
    const cleaned = sanitizePublicYoutubeTags(tags);
    expect(cleaned).toEqual(['morning coffee', 'city pop', 'retro playlist']);
  });

  it('a bridge-imported song with tainted tags has them stripped on import', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify({
      songs: [{
        trackNo: 1,
        title: 'Morning Light',
        hookPhrase: 'Morning Light',
        stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo',
        lyrics: '[verse 1]\nMorning Light\nMorning Light\n\n[chorus]\nMorning Light\nMorning Light\n\n[end]',
        seasonMoment: 'a quiet morning',
        listenerSituation: 'waking up slowly',
        emotionArc: 'calm to hopeful',
        youtube: {
          title: 'Morning Light',
          description: 'A gentle morning song.',
          tags: ['suno ai song', 'ai-generated music', 'morning coffee', 'lofi']
        }
      }]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);
    expect(report.importedCount).toBe(1);
    const tags = report.blueprint!.songs[0].youtube.tags;
    expect(tags).toEqual(['morning coffee', 'lofi']);
  });

  it('a locally generated pack never puts Suno/AI keywords in youtube.tags, and the disclosure sentence stays intact in the description', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 4 }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(sanitizePublicYoutubeTags(song.youtube.tags)).toEqual(song.youtube.tags);
      expect(song.youtube.description).toContain(AI_DISCLOSURE_LINE);
    }
  });
});
