import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, buildMultiSetClaudeCodeInstructions, buildMultiSetClaudeCodeMasterInstruction, extractBridgeImportMeta, importSongsJson } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { stripSetTitlePrefix } from '../src/utils/generation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import { vocalPresets } from '../src/data/vocalPresets';
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
    // v3.75 (TASK D-3) — was "Write your OWN original title" verbatim; that
    // wording was replaced with explicit hook-derived-title guidance (real
    // measurement: 18/18 real titles never matched their own hook, because
    // the old line flatly banned "a restatement of the hook" — see
    // bridgeInstruction.ts's titleInstructionLineFor).
    expect(instruction).toContain('genuine MIX of shapes');
    expect(instruction).toContain('the title should simply BE the hook line itself');
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

  it('tells the agent to write output to a lyrics/<setName>.json path, as raw JSON with no markdown fences inside the file', () => {
    // TASK v3.69 (TASK C) — replaces the old flat "songs-output.json" (every
    // run overwrote the last one, no history — see docs/v369-report.md §0)
    // with a dated, channel/concept-named path under lyrics/.
    const opts = makeOptions({ songCount: 2 });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, [], false);

    expect(instruction).toMatch(/lyrics\/\d{8}_.+\.json/);
    expect(instruction).toContain('{ "songs": [ ... ] }');
    expect(instruction).toContain('no markdown fences');
  });

  it('TASK v3.71 (TASK B): includes an always-present per-track vocal composition table, and duet section-tag rules when a track is a male-female duet', () => {
    // TASK v3.71 — real measurement found a generated instruction with ZERO
    // "duet"/"Male Vocal"/"vocalType" mentions, despite v3.70's fix existing
    // in code: v3.70's instruction line was gated behind
    // slot.vocalGender === 'duet' alone, which can silently miss a real duet
    // vocalText that doesn't exactly match vocalPresets.ts's canonical
    // string. The table below is unconditional so it never goes missing.
    const duetPreset = vocalPresets.find(p => p.id === 'male-female-duet')!;
    const opts = makeOptions({ songCount: 2, vocalTone: duetPreset.prompt });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    expect(slots.some(slot => slot.vocalGender === 'duet')).toBe(true);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);

    expect(instruction).toContain('[This set\'s vocal composition]');
    expect(instruction).toMatch(/Track 1: Male-Female Duet/);
    expect(instruction).toContain('[Duet track rule');
    expect(instruction).toContain('[Verse 1: Male Vocal]');
    expect(instruction).toContain('[Chorus: Male and Female Duet]');
  });

  it('TASK v3.71 (TASK B): always renders the vocal composition table, but omits duet-specific rules when no track in the pack is a duet', () => {
    const opts = makeOptions({ songCount: 2 });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    expect(slots.some(slot => slot.vocalGender === 'duet')).toBe(false);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);

    expect(instruction).toContain('[This set\'s vocal composition]');
    expect(instruction).not.toContain('[Duet track rule');
    expect(instruction).toContain('[Solo/group tracks]');
  });

  it('TASK v3.69 (TASK D): includes an optional top-level "meta" object in the request payload, and tells the agent to copy it verbatim', () => {
    const opts = makeOptions({ songCount: 2 });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, [], false);

    expect(instruction).toContain('Optional (recommended): also add a top-level "meta" field');
    expect(instruction).toContain('Do not invent or recompute any of its values yourself.');

    const payloadMatch = instruction.match(/```json\n([\s\S]*?)\n```/);
    expect(payloadMatch).not.toBeNull();
    const payload = JSON.parse(payloadMatch![1]);
    expect(payload.meta.channelId).toBe(opts.channel.id);
    expect(payload.meta.channelLabel).toBe(opts.channel.name);
    expect(payload.meta.songCount).toBe(2);
    expect(payload.meta.lyricLanguage).toBe(opts.lyricLanguage);
    expect(payload.meta.setName).toMatch(/^\d{8}_.+$/);
    expect(() => new Date(payload.meta.generatedAt).toISOString()).not.toThrow();
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

describe('[v3.40] buildMultiSetClaudeCodeMasterInstruction - one instruction can drive all sets', () => {
  it('packs all set specs and output filenames into one master instruction', () => {
    const result = buildMultiSetClaudeCodeMasterInstruction(makeOptions({ songCount: 6 }), 3, 6, testGenres, testMoods, testSeason, undefined, false);

    expect(result.setCount).toBe(3);
    expect(result.songsPerSet).toBe(6);
    // TASK v3.69 (TASK B) — "lyrics/<setName>_setNN.json", not the old flat
    // "songs-output-setNN.json" (see docs/v369-report.md §0).
    expect(result.outputFilenames.every((name: string) => /^lyrics\/\d{8}_.+_set0[123]\.json$/.test(name))).toBe(true);
    expect(result.instruction).toContain('MASTER MODE');
    expect(result.instruction).toContain('| Set | Concept | Season | Money chord | Vocal quota | Output file |');
    // TASK v3.72 (TASK A) — usesVocalQuota is now unconditional; see the
    // matching fix in the buildMultiSetClaudeCodeInstructions test above.
    expect(result.instruction).toContain('male 2, female 2, mixed 2');
    expect(result.instruction).toContain('Do not stop after the first file');
    for (const filename of result.outputFilenames) expect(result.instruction).toContain(filename);

    const payloadMatch = result.instruction.match(/```json\n([\s\S]*?)\n```/);
    expect(payloadMatch).not.toBeNull();
    const payload = JSON.parse(payloadMatch![1]);
    expect(payload.masterMode).toBe(true);
    expect(payload.sets).toHaveLength(3);
    expect(payload.sets[0].requestPayload.songCount).toBe(6);
    expect(payload.sets[0].requestPayload.preassignedSongs).toHaveLength(6);
  });

  it('TASK v3.71 (TASK B): includes the always-present per-track vocal composition table for a master-mode run too', () => {
    const duetPreset = vocalPresets.find(p => p.id === 'male-female-duet')!;
    const result = buildMultiSetClaudeCodeMasterInstruction(makeOptions({ songCount: 6, vocalTone: duetPreset.prompt }), 2, 6, testGenres, testMoods, testSeason, undefined, false);
    expect(result.instruction).toContain('[This set\'s vocal composition]');
    expect(result.instruction).toContain('[Duet track rule');
  });

  it('threads cumulative avoid lists through later set payloads, same as the per-set bridge builder', () => {
    const result = buildMultiSetClaudeCodeMasterInstruction(makeOptions({ songCount: 4 }), 2, 4, testGenres, testMoods, testSeason, undefined, false);
    const payloadMatch = result.instruction.match(/```json\n([\s\S]*?)\n```/);
    expect(payloadMatch).not.toBeNull();
    const payload = JSON.parse(payloadMatch![1]);
    const set1Titles = payload.sets[0].requestPayload.preassignedSongs.map((slot: PreassignedSongSlot) => slot.title);
    const set2AvoidTitles = payload.sets[1].requestPayload.alreadyUsedTitles;

    for (const title of set1Titles) expect(set2AvoidTitles).toContain(title);
  });

  it('supports a 5-set one-paste master run with sequential save files and duplicate-avoid instructions', () => {
    const result = buildMultiSetClaudeCodeMasterInstruction(makeOptions({ songCount: 6 }), 5, 6, testGenres, testMoods, testSeason, undefined, false);

    expect(result.outputFilenames.map((name: string) => name.match(/_set(\d{2})\.json$/)?.[1])).toEqual(['01', '02', '03', '04', '05']);
    expect(result.instruction).toContain('| Set | Concept | Season | Money chord | Vocal quota | Output file |');
    expect(result.instruction).toContain('Do not stop after the first file');
    expect(result.instruction).toContain('After writing a set, add the actual generated titles and hookPhrases');
    expect(result.instruction).toMatch(/lyrics\/\d{8}_.+_set05\.json/);
    expect(result.instruction.match(/Set 0[1-5]\/5/g)).toHaveLength(5);
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
      { trackNo: 1, title: 'Preassigned Title', hookPhrase: 'Preassigned Hook', songRole: 'cold-open', tempo: 100, emotionArc: 'steady calm', moneyChordText: 'I-V-vi-IV progression' }
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
      { trackNo: 1, title: 'Slot Title', hookPhrase: 'Slot Hook', songRole: 'flagship', tempo: 98, emotionArc: 'slot arc', moneyChordText: 'I-V-vi-IV progression' }
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
      { trackNo: 1, title: 'Preassigned Title', hookPhrase: 'Preassigned Hook', songRole: 'cold-open', tempo: 100, emotionArc: 'steady calm', moneyChordText: 'I-V-vi-IV progression' }
    ];
    const raw = JSON.stringify({ songs: [songJson({ trackNo: 1, title: 'Agent Written Title', hookPhrase: 'Something Else' })] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, slots);

    expect(report.blueprint!.songs[0].title).toBe('Agent Written Title');
  });

  it('TASK v3.27: titleMode="local" still forces the title back to the preassigned slot (old behavior, unchanged)', () => {
    const opts = makeOptions({ songCount: 1, titleMode: 'local' });
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'Preassigned Title', hookPhrase: 'Preassigned Hook', songRole: 'cold-open', tempo: 100, emotionArc: 'steady calm', moneyChordText: 'I-V-vi-IV progression' }
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

  // TASK v3.69 (TASK D) — meta is a purely additive, optional top-level
  // block; a file written before this task existed has no "meta" key, and
  // import must behave exactly as before for it (no crash, no behavior
  // change) — this is the backward-compatibility half of TASK D.
  it('TASK v3.69 (TASK D): imports a pre-v3.69 file with no "meta" block exactly as before (backward compatible)', () => {
    const opts = makeOptions({ songCount: 1 });
    const raw = JSON.stringify({ songs: [songJson()] });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.blueprint).not.toBeNull();
    expect(report.importedCount).toBe(1);
    expect(typeof report.blueprint!.generatedAt).toBe('string');
  });

  it('TASK v3.69 (TASK D): a "meta.generatedAt" present in the file stamps the blueprint with that real generation time, not import time', () => {
    const opts = makeOptions({ songCount: 1 });
    const generatedAt = '2026-01-15T09:00:00.000Z';
    const raw = JSON.stringify({
      meta: { setName: '20260115_channel_concept', generatedAt, channelId: opts.channel.id, channelLabel: opts.channel.name, songCount: 1, lyricLanguage: opts.lyricLanguage },
      songs: [songJson()]
    });

    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason);

    expect(report.blueprint).not.toBeNull();
    expect(report.blueprint!.generatedAt).toBe(generatedAt);
  });
});

describe('[v3.69] TASK D: extractBridgeImportMeta reads the optional top-level "meta" block', () => {
  it('returns null for a file with no "meta" key at all (pre-v3.69 file)', () => {
    expect(extractBridgeImportMeta(JSON.stringify({ songs: [] }))).toBeNull();
  });

  it('returns null for unparseable text instead of throwing', () => {
    expect(extractBridgeImportMeta('not json {{{')).toBeNull();
  });

  it('reads every documented field when present', () => {
    const meta = extractBridgeImportMeta(JSON.stringify({
      meta: {
        setName: '20260731_굿모닝추억라디오_비오는날의올드팝',
        generatedAt: '2026-07-31T09:00:00+09:00',
        channelId: 'morning-memory-radio',
        channelLabel: '굿모닝 추억라디오',
        conceptLabel: '비 오는 날의 올드팝',
        songCount: 18,
        lyricLanguage: 'english'
      },
      songs: []
    }));

    expect(meta).toEqual({
      setName: '20260731_굿모닝추억라디오_비오는날의올드팝',
      generatedAt: '2026-07-31T09:00:00+09:00',
      channelId: 'morning-memory-radio',
      channelLabel: '굿모닝 추억라디오',
      conceptLabel: '비 오는 날의 올드팝',
      songCount: 18,
      lyricLanguage: 'english'
    });
  });
});

describe('[v3.35] buildMultiSetClaudeCodeInstructions — one instruction per set instead of one for the whole run', () => {
  it('produces exactly setCount instructions, each requesting only its own songsPerSet', () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 12 });
    const results = buildMultiSetClaudeCodeInstructions(baseOpts, 5, 18, testGenres, testMoods, testSeason, undefined, false);

    expect(results).toHaveLength(5);
    results.forEach((item, i) => {
      expect(item.setIndex).toBe(i);
      expect(item.setOpts.songCount).toBe(18);
      expect(item.preassignedSongs).toHaveLength(18);
      expect(item.instruction).toContain('"songCount": 18');
    });
  });

  it('names each set\'s output file "lyrics/<setName>_setNN.json", zero-padded and sequential', () => {
    // TASK v3.69 (TASK B) — replaces the old flat "songs-output-setNN.json".
    const results = buildMultiSetClaudeCodeInstructions(makeOptions(), 10, 18, testGenres, testMoods, testSeason, undefined, false);
    expect(results[0].outputFilename).toMatch(/^lyrics\/\d{8}_.+_set01\.json$/);
    expect(results[8].outputFilename).toMatch(/^lyrics\/\d{8}_.+_set09\.json$/);
    expect(results[9].outputFilename).toMatch(/^lyrics\/\d{8}_.+_set10\.json$/);
    results.forEach(item => {
      expect(item.instruction).toContain(`Write a new file named "${item.outputFilename}"`);
    });
  });

  it('folds each prior set\'s preallocated titles/hooks into the next set\'s alreadyUsedTitles/alreadyUsedHooks (cumulative avoid)', () => {
    const results = buildMultiSetClaudeCodeInstructions(makeOptions({ songCount: 6 }), 3, 6, testGenres, testMoods, testSeason, undefined, false);

    const set1Titles = results[0].preassignedSongs.map(s => s.title);
    const set1Hooks = results[0].preassignedSongs.map(s => s.hookPhrase);
    for (const title of set1Titles) expect(results[1].instruction).toContain(title);
    for (const hook of set1Hooks) expect(results[1].instruction).toContain(hook);

    const set2Titles = results[1].preassignedSongs.map(s => s.title);
    for (const title of set2Titles) expect(results[2].instruction).toContain(title);

    // set 1 itself carries no prior-set history, only whatever initialAvoid supplied (none here).
    expect(results[0].instruction).not.toContain(set1Titles.join(''));
  });

  it('an initial cross-pack avoid list is threaded into every set\'s instruction, not just the first', () => {
    const initialAvoid = { usedTitles: ['Ledger Title'], usedHooks: ['Ledger Hook'] };
    const results = buildMultiSetClaudeCodeInstructions(makeOptions({ songCount: 4 }), 3, 4, testGenres, testMoods, testSeason, initialAvoid, false);
    for (const item of results) {
      expect(item.instruction).toContain('Ledger Title');
      expect(item.instruction).toContain('Ledger Hook');
    }
  });

  it('every set\'s preallocated titles/hooks are globally unique across the whole multi-set instruction batch', () => {
    const results = buildMultiSetClaudeCodeInstructions(makeOptions({ songCount: 18 }), 5, 18, testGenres, testMoods, testSeason, undefined, false);
    const allTitles = results.flatMap(item => item.preassignedSongs.map(s => s.title.toLowerCase()));
    const allHooks = results.flatMap(item => item.preassignedSongs.map(s => s.hookPhrase.toLowerCase()));
    expect(new Set(allTitles).size).toBe(90);
    expect(new Set(allHooks).size).toBe(90);
  });

  it('includes a per-set concept/flavor line that differs across sets', () => {
    const results = buildMultiSetClaudeCodeInstructions(makeOptions({ songCount: 6 }), 3, 6, testGenres, testMoods, testSeason, undefined, false);
    expect(results[0].instruction).toContain('flavor');
    expect(results[0].instruction).toContain('| Set | Concept | Season | Money chord | Vocal quota | Output file |');
    // TASK v3.72 (TASK A) — usesVocalQuota is now unconditional, so even an
    // unquota'd-looking pack gets a real male/female/duet split instead of
    // the old "single vocal identity" fallback.
    expect(results[0].instruction).toContain('male 2, female 2, mixed 2');
    expect(results[0].instruction).toContain('Set 1/3');
    expect(results[1].instruction).toContain('Set 2/3');
    expect(results[2].instruction).toContain('Set 3/3');
  });

  it('still tells the agent not to add its own numbering to titles (v3.35 Part A defensive instruction, unaffected by the split)', () => {
    const results = buildMultiSetClaudeCodeInstructions(makeOptions(), 2, 6, testGenres, testMoods, testSeason, undefined, false);
    for (const item of results) {
      expect(item.instruction).toContain('Do NOT prefix "title" with a track number');
    }
  });

  it('preassigned titles round-trip through stripSetTitlePrefix unchanged (the bridge never adds a prefix itself — only the app does, after import)', () => {
    const results = buildMultiSetClaudeCodeInstructions(makeOptions({ songCount: 4 }), 2, 4, testGenres, testMoods, testSeason, undefined, false);
    for (const item of results) {
      for (const slot of item.preassignedSongs) {
        expect(stripSetTitlePrefix(slot.title)).toBe(slot.title);
      }
    }
  });
});
