import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PreassignedSongSlot } from '../src/types';

const avoid = { usedTitles: ['Old Title'], usedHooks: ['Old Hook Phrase'] };

describe('[v3.24] buildClaudeCodeInstruction produces a self-contained, file-output-oriented prompt', () => {
  it('includes alreadyUsedTitles/alreadyUsedHooks so a coding agent avoids the same collisions a real API call would', () => {
    const opts = makeOptions({ songCount: 3 });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, [], false);

    expect(instruction).toContain('Old Title');
    expect(instruction).toContain('Old Hook Phrase');
    expect(instruction).toContain('alreadyUsedTitles');
    expect(instruction).toContain('alreadyUsedHooks');
  });

  it('includes the preassigned title/hook per track and instructs the agent to copy them verbatim', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);

    expect(instruction).toContain('preassignedSongs');
    expect(instruction).toContain(slots[0].title);
    expect(instruction).toContain(slots[0].hookPhrase);
    expect(instruction).toContain('copied verbatim');
  });

  it('tells the agent to write output to songs-output.json, as raw JSON with no markdown fences inside the file', () => {
    const opts = makeOptions({ songCount: 2 });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, [], false);

    expect(instruction).toContain('songs-output.json');
    expect(instruction).toContain('{ "songs": [ ... ] }');
    expect(instruction).toContain('no markdown fences');
  });

  it('narrows outputShape to songs only — the agent is told not to invent pack-level identity fields', () => {
    const opts = makeOptions({ songCount: 2 });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, [], false);

    expect(instruction).toContain('Do NOT include projectTitle, channelName, oneLineConcept, sonicSignature, vocalSignature, lyricRules, harmonyRules, or visualRules');
    const payloadMatch = instruction.match(/```json\n([\s\S]*?)\n```/);
    expect(payloadMatch).not.toBeNull();
    const payload = JSON.parse(payloadMatch![1]);
    expect(Object.keys(payload.outputShape)).toEqual(['songs']);
  });

  it('generateThumbnailText=false (default): no thumbnailText field appears in the per-song schema', () => {
    const opts = makeOptions({ songCount: 1 });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, [], false);
    expect(instruction).not.toContain('thumbnailText');
  });

  it('generateThumbnailText=true: thumbnailText appears in the per-song schema', () => {
    const opts = makeOptions({ songCount: 1 });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, [], true);
    expect(instruction).toContain('thumbnailText');
  });
});

function songJson(overrides: Record<string, unknown> = {}) {
  return {
    trackNo: 1,
    title: 'Morning Light',
    hookPhrase: 'Morning Light',
    stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo',
    lyrics: '[verse 1]\nSome line\n[chorus]\nMorning Light\nSome other line\nMorning Light\n[verse 2]\nAnother line\n[chorus]\nMorning Light\nSome other line\nMorning Light\n[end]',
    seasonMoment: 'a quiet morning',
    listenerSituation: 'waking up slowly',
    emotionArc: 'calm to hopeful',
    youtube: { title: 'Morning Light', description: 'A gentle morning song.', tags: ['morning', 'pop'] },
    ...overrides
  };
}

describe('[v3.24] importSongsJson runs an external coding agent\'s output through the same pipeline as any API-generated pack', () => {
  it('imports a valid { songs: [...] } file and produces a full blueprint with scored songs', () => {
    const opts = makeOptions({ songCount: 2 });
    const raw = JSON.stringify({ songs: [songJson({ trackNo: 1 }), songJson({ trackNo: 2, title: 'Evening Calm', hookPhrase: 'Evening Calm' })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.importedCount).toBe(2);
    expect(report.skippedCount).toBe(0);
    expect(report.blueprint).not.toBeNull();
    expect(report.blueprint!.songs.map(s => s.trackNo)).toEqual([1, 2]);
    expect(report.blueprint!.songs[0].qualityScore).toBeGreaterThan(0);
    // identity fields come from local context (buildSignatureBlueprint), not from the imported JSON
    expect(report.blueprint!.projectTitle).toBe(opts.projectTitle);
    expect(report.blueprint!.channelName).toBe(opts.channel.name);
  });

  it('accepts a bare array (no {"songs": ...} wrapper) as a lenient fallback', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify([songJson()]);

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.importedCount).toBe(1);
    expect(report.blueprint).not.toBeNull();
  });

  it('strips a ```json fence around the output, same lenient parsing as api/generate.js and api/batch.js', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = '```json\n' + JSON.stringify({ songs: [songJson()] }) + '\n```';

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.importedCount).toBe(1);
  });

  it('recovers JSON surrounded by prose ("Sure, here is the file: {...} Hope that helps!")', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = `Sure, here is the file:\n${JSON.stringify({ songs: [songJson()] })}\nHope that helps!`;

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.importedCount).toBe(1);
  });

  it('skips a song missing a required field (title/hookPhrase/stylePrompt/lyrics) and reports why, while still importing the rest', () => {
    const opts = makeOptions({ songCount: 2 });
    const raw = JSON.stringify({
      songs: [
        songJson({ trackNo: 1, lyrics: '' }), // missing lyrics
        songJson({ trackNo: 2, title: 'Evening Calm', hookPhrase: 'Evening Calm' })
      ]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.importedCount).toBe(1);
    expect(report.skippedCount).toBe(1);
    expect(report.skippedReasons[0]).toContain('lyrics');
    expect(report.blueprint!.songs).toHaveLength(1);
  });

  it('renumbers surviving songs to a continuous 1..N range after a skip leaves a gap', () => {
    const opts = makeOptions({ songCount: 3 });
    const raw = JSON.stringify({
      songs: [
        songJson({ trackNo: 1 }),
        songJson({ trackNo: 2, lyrics: '' }), // skipped
        songJson({ trackNo: 3, title: 'Closing Time', hookPhrase: 'Closing Time' })
      ]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.importedCount).toBe(2);
    expect(report.blueprint!.songs.map(s => s.trackNo)).toEqual([1, 2]);
  });

  it('reconciles against preassignedSongs: the locally pre-decided title/hookPhrase wins even if the agent wrote something else', () => {
    const opts = makeOptions({ songCount: 1 });
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'Preassigned Title', hookPhrase: 'Preassigned Hook', songRole: 'cold-open', tempo: 100, emotionArc: 'steady calm' }
    ];
    const raw = JSON.stringify({ songs: [songJson({ trackNo: 1, title: 'Something Else', hookPhrase: 'Something Else' })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, slots);

    expect(report.blueprint!.songs[0].title).toBe('Preassigned Title');
    expect(report.blueprint!.songs[0].hookPhrase).toBe('Preassigned Hook');
    expect(report.blueprint!.songs[0].songRole).toBe('cold-open');
  });

  it('B3: copyright/imitation-risk content is flagged by the same scoreSong safety net every API-generated song passes through, no exceptions', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify({
      songs: [songJson({ stylePrompt: 'in the style of Taylor Swift, I-V-vi-IV progression, repeats chorus 4x' })]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.blueprint!.songs[0].warnings.some(w => /imitation|artist/i.test(w))).toBe(true);
    expect(report.blueprint!.songs[0].qualityScore).toBeLessThan(100);
  });

  it('completely unparseable input returns a null blueprint with a reason, not a crash', () => {
    const opts = makeOptions({ songCount: 1 });
    const report = importSongsJson('not json at all {{{', opts, testGenres, testMoods, testSeason);

    expect(report.blueprint).toBeNull();
    expect(report.skippedReasons.length).toBeGreaterThan(0);
  });

  it('a songs array where every entry fails validation returns a null blueprint with per-song reasons', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify({ songs: [{ title: 'No Lyrics Here' }] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.blueprint).toBeNull();
    expect(report.skippedCount).toBe(1);
    expect(report.skippedReasons[0]).toContain('No Lyrics Here');
  });
});
