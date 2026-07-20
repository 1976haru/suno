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
    // TASK v3.30 — real Codex-bridge output showed 20/20 titles and 19/20
    // hooks copied verbatim from these "avoid" lists (reshuffled to
    // different tracks); the instruction now states the exact forbidden
    // count and an explicit before-writing self-check instead of one buried
    // "never reuse" line.
    expect(instruction).toContain('is FORBIDDEN for this pack');
    expect(instruction).toContain('Before writing the file, check every song\'s "title" and "hookPhrase" against both lists');

    const payloadMatch = instruction.match(/```json\n([\s\S]*?)\n```/);
    expect(payloadMatch).not.toBeNull();
    const payload = JSON.parse(payloadMatch![1]);
    expect(payload.alreadyUsedHooks).toEqual(['Old Hook Phrase']);
  });

  it('TASK v3.30: states the exact forbidden title/hook counts so a coding agent can self-check its own output', () => {
    const opts = makeOptions({ songCount: 20 });
    const wideAvoid = {
      usedTitles: Array.from({ length: 20 }, (_, i) => `Title ${i + 1}`),
      usedHooks: Array.from({ length: 20 }, (_, i) => `Hook ${i + 1}`)
    };
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, wideAvoid, [], false);

    expect(instruction).toContain('Every one of the 20 titles in "alreadyUsedTitles"');
    expect(instruction).toContain('every one of the 20 hooks in "alreadyUsedHooks"');
  });

  it('includes the preassigned hook per track and, by default (titleMode="ai-creative"), tells the agent to write its own title instead of copying the placeholder', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);

    expect(instruction).toContain('preassignedSongs');
    expect(instruction).toContain(slots[0].hookPhrase);
    expect(instruction).toContain('fallback placeholder');
    expect(instruction).toContain('Write your OWN original title');
  });

  it('titleMode="local" instructs the agent to copy the preassigned title verbatim (old behavior, unchanged)', () => {
    const opts = makeOptions({ songCount: 3, titleMode: 'local' });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);

    expect(instruction).toContain('preassignedSongs');
    expect(instruction).toContain(slots[0].title);
    expect(instruction).toContain(slots[0].hookPhrase);
    expect(instruction).toContain('Copy the preassigned title');
    expect(instruction).toContain('JSON hook and chorus hook diverge');
  });

  it('tells the bridge agent that hookPhrase and lyrics must stay matched because import preserves that pair', () => {
    const opts = makeOptions({ songCount: 1 });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);

    expect(instruction).toContain('hookPhrase');
    expect(instruction).toContain('lyrics');
    expect(instruction).toContain('matched pair');
    expect(instruction).toContain('will not rewrite hooks to match preassignedSongs');
    expect(instruction).not.toContain('Do NOT invent a different hookPhrase');
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

function lyricsWithHook(hookPhrase: string) {
  return `[verse 1]\nSome line\n[chorus]\n${hookPhrase}\nSome other line\n${hookPhrase}\n[verse 2]\nAnother line\n[chorus]\n${hookPhrase}\nSome other line\n${hookPhrase}\n[end]`;
}

function songJson(overrides: Record<string, unknown> = {}) {
  const hookPhrase = typeof overrides.hookPhrase === 'string' ? overrides.hookPhrase : 'Morning Light';
  return {
    trackNo: 1,
    title: 'Morning Light',
    hookPhrase,
    stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo',
    lyrics: lyricsWithHook(hookPhrase),
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

  it('bridge import preserves the agent hook/lyrics pair instead of overwriting hookPhrase from preassignedSongs', () => {
    const opts = makeOptions({ songCount: 1 });
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'Preassigned Title', hookPhrase: 'Preassigned Hook', songRole: 'cold-open', tempo: 100, emotionArc: 'steady calm' }
    ];
    const raw = JSON.stringify({ songs: [songJson({ trackNo: 1, title: 'Something Else', hookPhrase: 'Something Else' })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, slots);

    expect(report.blueprint!.songs[0].hookPhrase).toBe('Something Else');
    expect(report.blueprint!.songs[0].songRole).toBe('cold-open');
  });

  it('does not create a false hook-0x warning when the bridge file hook differs from the preassigned slot hook', () => {
    const opts = makeOptions({ songCount: 1 });
    const agentHook = 'Soft Window Light';
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'Slot Title', hookPhrase: 'Slot Hook', songRole: 'flagship', tempo: 98, emotionArc: 'slot arc' }
    ];
    const raw = JSON.stringify({ songs: [songJson({ trackNo: 1, title: 'Lantern Hour', hookPhrase: agentHook })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, slots);
    const imported = report.blueprint!.songs[0];
    const hookCount = imported.lyrics.split(agentHook).length - 1;

    expect(imported.hookPhrase).toBe(agentHook);
    expect(hookCount).toBe(4);
    expect(imported.warnings.some(w => w.includes('Hook appears only 0x'))).toBe(false);
  });

  it('TASK v3.27: default titleMode (ai-creative) trusts the agent\'s own title over the preassigned placeholder', () => {
    const opts = makeOptions({ songCount: 1 });
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'Preassigned Title', hookPhrase: 'Preassigned Hook', songRole: 'cold-open', tempo: 100, emotionArc: 'steady calm' }
    ];
    const raw = JSON.stringify({ songs: [songJson({ trackNo: 1, title: 'Agent Written Title', hookPhrase: 'Something Else' })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, slots);

    expect(report.blueprint!.songs[0].title).toBe('Agent Written Title');
  });

  it('TASK v3.27: titleMode="local" still forces the title back to the preassigned slot (old behavior, unchanged)', () => {
    const opts = makeOptions({ songCount: 1, titleMode: 'local' });
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'Preassigned Title', hookPhrase: 'Preassigned Hook', songRole: 'cold-open', tempo: 100, emotionArc: 'steady calm' }
    ];
    const raw = JSON.stringify({ songs: [songJson({ trackNo: 1, title: 'Something Else', hookPhrase: 'Something Else' })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, slots);

    expect(report.blueprint!.songs[0].title).toBe('Preassigned Title');
  });

  it('warns but does not auto-rewrite bridge hooks that duplicate within the imported pack', () => {
    const opts = makeOptions({ songCount: 2 });
    const raw = JSON.stringify({
      songs: [
        songJson({ trackNo: 1, title: 'First Song', hookPhrase: 'Shared Hook', lyrics: '[verse 1]\nLine\n[chorus]\nShared Hook\nLine\nShared Hook\n[verse 2]\nLine\n[chorus]\nShared Hook\nLine\nShared Hook\n[end]' }),
        songJson({ trackNo: 2, title: 'Second Song', hookPhrase: 'Shared Hook', lyrics: '[verse 1]\nLine\n[chorus]\nShared Hook\nLine\nShared Hook\n[verse 2]\nLine\n[chorus]\nShared Hook\nLine\nShared Hook\n[end]' })
      ]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.warnings.some(w => w.includes('duplicated within this import'))).toBe(true);
    expect(report.blueprint!.songs.map(song => song.hookPhrase)).toEqual(['Shared Hook', 'Shared Hook']);
  });

  it('warns but does not auto-rewrite bridge hooks that collide with channel hook history', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify({ songs: [songJson({ hookPhrase: 'Old Hook Phrase', lyrics: '[verse 1]\nLine\n[chorus]\nOld Hook Phrase\nLine\nOld Hook Phrase\n[verse 2]\nLine\n[chorus]\nOld Hook Phrase\nLine\nOld Hook Phrase\n[end]' })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, [], [], ['Old Hook Phrase']);

    expect(report.warnings.some(w => w.includes('already used by this channel'))).toBe(true);
    expect(report.blueprint!.songs[0].hookPhrase).toBe('Old Hook Phrase');
  });

  it('TASK v3.27: two imported songs landing on the same AI-creative title get auto-uniquified, not silently duplicated', () => {
    const opts = makeOptions({ songCount: 2 });
    const raw = JSON.stringify({
      songs: [
        songJson({ trackNo: 1, title: 'Same Title', hookPhrase: 'Hook One' }),
        songJson({ trackNo: 2, title: 'Same Title', hookPhrase: 'Hook Two' })
      ]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    const titles = report.blueprint!.songs.map(s => s.title.trim().toLowerCase());
    expect(new Set(titles).size).toBe(2);
  });

  it('TASK v3.27 (B1): a missing season/channel context returns a clear report instead of crashing on season.label', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify({ songs: [songJson()] });

    expect(() => importSongsJson(raw, opts, testGenres, testMoods, undefined as unknown as typeof testSeason)).not.toThrow();
    const report = importSongsJson(raw, opts, testGenres, testMoods, undefined as unknown as typeof testSeason);
    expect(report.blueprint).toBeNull();
    expect(report.skippedReasons[0]).toContain('채널·시즌');
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

  // TASK v3.29 — a real 20-song Codex-bridge pack wrote "I-V-vi-IV money
  // chords" (real progression disclosure, no literal word "progression"),
  // and every one of those 20 songs got a false "Missing prompt term:
  // progression" warning on import. Re-importing that same real wording
  // must no longer produce the warning.
  it('re-importing a pack whose stylePrompt says "I-V-vi-IV money chords" (no literal "progression") does not warn "Missing prompt term: progression"', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify({
      songs: [songJson({ stylePrompt: 'warm acoustic pop, I-V-vi-IV money chords, repeats chorus 4x, soft vocal, mid tempo' })]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.blueprint!.songs[0].warnings.some(w => w === 'Missing prompt term: progression')).toBe(false);
  });
});
