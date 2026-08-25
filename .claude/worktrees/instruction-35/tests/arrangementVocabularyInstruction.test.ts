import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { auditAlbum } from '../src/core/albumAudit';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

const avoid = { usedTitles: [] as string[], usedHooks: [] as string[] };

/**
 * TASK v3.60 (TASK A-1) — the bridge instruction told an agent to weave
 * introTextureText/instrumentSet/arrangementDensity/hookDeviceText/
 * moneyChordText verbatim into stylePrompt, but never said those words (or
 * instrument/arrangement/production terms generally) must never also
 * appear in the lyric body — a real bridge-imported pack sang its own
 * arrangement instructions in 15/17 songs. This is now an explicit
 * CRITICAL bullet in buildSystemInstruction (promptComposer.ts), shared by
 * both the bridge instruction and every real API provider's own system
 * prompt.
 */
describe('[v3.60 TASK A-1] bridge instruction prohibits arrangement vocabulary in lyrics', () => {
  it('includes an explicit prohibition against arrangement/production vocabulary in the lyric body', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);
    expect(instruction).toContain('arrangement/production vocabulary belongs ONLY in "stylePrompt"');
    expect(instruction).toContain('never in "lyrics"');
    expect(instruction).toContain('Spiccato strings flicker over quiet water');
  });
});

describe('[v3.60 TASK A-3] auditAlbum escalates arrangement-vocabulary leaks past 30% of the pack to a blocking error', () => {
  function songWith(trackNo: number, lyrics: string): SongIdea {
    return {
      trackNo,
      title: `Song ${trackNo}`,
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      hookPhrase: `Hook ${trackNo}`,
      stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo, 92 BPM',
      lyrics,
      warnings: [],
      qualityScore: 90,
      youtube: { title: `Song ${trackNo}`, description: 'desc', tags: [] }
    };
  }

  it('stays a warning (not an error) when under 30% of the pack is affected', () => {
    const clean = '[verse 1]\nI hold my father\'s guitar\nand hum a quiet tune\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]';
    const leaked = '[verse 1]\nThe straight-pop drums move softly\n\n[chorus]\nHook 2\nHook 2\nHook 2\n\n[end]';
    const songs = [songWith(1, clean), songWith(2, clean), songWith(3, clean), songWith(4, leaked)];
    const report = auditAlbum(songs);
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.includes('편곡/악기 어휘'))).toBe(true);
  });

  it('escalates to a blocking error when over 30% of the pack is affected (matches the real 88% measured pack)', () => {
    const leaked = '[verse 1]\nThe straight-pop drums move softly\n\n[chorus]\nHook X\nHook X\nHook X\n\n[end]';
    const clean = '[verse 1]\nI hold my father\'s guitar\n\n[chorus]\nHook Y\nHook Y\nHook Y\n\n[end]';
    const songs = [songWith(1, leaked), songWith(2, leaked), songWith(3, clean)];
    const report = auditAlbum(songs);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('편곡/악기 어휘'))).toBe(true);
  });
});
