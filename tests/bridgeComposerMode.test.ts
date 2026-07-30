import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, buildMultiSetClaudeCodeMasterInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { genrePacks } from '../src/data/presets';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

const avoid = { usedTitles: [] as string[], usedHooks: [] as string[] };

/**
 * TASK v3.62 (TASK 1) — "역할 반전": the bridge instruction told an agent to
 * weave introTextureText/instrumentSet/arrangementDensity/hookDeviceText
 * verbatim into stylePrompt regardless of the song's actual era/genre — a
 * real 1960s-flavored British-beat track got "warm string pad swell" and
 * "layered backing" because the agent followed that instruction literally.
 * These fields are now reference information the agent interprets with its
 * own musical knowledge; tempo/structureTemplate/lyricThemeText/pov (app-
 * planned structural determinism, this task's own "유지할 결정론" list) are
 * unchanged and still verbatim-required.
 */
describe('[v3.62 TASK 1] bridge instruction: composer, not scribe', () => {
  const opts = makeOptions({ songCount: 3 });
  const slots = preallocateSongSlots(opts, testGenres, avoid);
  const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);

  it('opens with composer/producer framing, not a plain "generate content" instruction', () => {
    expect(instruction).toContain('experienced music composer/producer');
    expect(instruction).toContain('do not treat reference fields as scripts to transcribe verbatim');
  });

  it('no longer forces verbatim weaving of introTextureText/instrumentSet/arrangementDensity/hookDeviceText', () => {
    expect(instruction).not.toContain('weave that exact phrase into that song\'s stylePrompt, verbatim. It is an intro-only');
    expect(instruction).not.toContain('weave ALL of them into that song\'s stylePrompt as the instrument detail, verbatim');
    expect(instruction).not.toContain('Use the matching phrase (or a close paraphrase) verbatim; do not substitute a different density level.');
    expect(instruction).not.toContain('never reuse the same device text word-for-word across two songs in this pack');
  });

  it('reframes those same fields as reference information the agent interprets', () => {
    expect(instruction).toContain('REFERENCE');
    expect(instruction).toContain('your own musical judgment');
    expect(instruction).toContain('not required wording');
  });

  it('keeps the money-chord PROGRESSION required, but its reinforcement phrase is now reference-only', () => {
    expect(instruction).toContain('that harmonic choice is fixed by the app');
    expect(instruction).toContain('reference flavor, not required wording');
  });

  it('still requires tempo, structureTemplate, lyricThemeText, and pov verbatim — app-planned determinism is untouched', () => {
    expect(instruction).toContain('use exactly that BPM number in that song\'s stylePrompt');
expect(instruction.toLowerCase()).toContain('do not invent a different tempo');
    expect(instruction).toContain('do not default back to T1\'s shape for a track assigned a different template');
    expect(instruction).toContain('use that exact scene verbatim as the song\'s primary lyric situation');
    expect(instruction).toContain('do not substitute a different narrator perspective');
  });

  it('adds the 25-35 descriptor-count requirement', () => {
    expect(instruction).toContain('25-35 short descriptors');
    expect(instruction).toContain('not padded to hit a fixed checklist');
  });

  it('adds a per-track plan table listing every song\'s genre/BPM/vocal/role', () => {
    expect(instruction).toContain('| Track | Genre | BPM | Vocal | Role |');
    for (const slot of slots) {
      expect(instruction).toContain(`${slot.tempo} BPM`);
    }
  });
});

describe('[v3.62 TASK 1-2] era-authenticity guardrail', () => {
  it('lists forbidden anachronistic descriptors for an oldpop-british-beat (1950s-60s) track', () => {
    const genre = genrePacks.find(g => g.id === 'oldpop-british-beat')!;
    const opts = makeOptions({ songCount: 1, genreIds: ['oldpop-british-beat'] });
    const slots = preallocateSongSlots(opts, [genre], avoid);
    const instruction = buildClaudeCodeInstruction(opts, [genre], testMoods, testSeason, avoid, slots, false);
    expect(instruction).toContain('era authenticity');
    expect(instruction).toContain('1950s-60s');
    expect(instruction).toContain('"string pad"');
    expect(instruction).toContain('"gated reverb"');
  });

  it('does not add an era guardrail line for a genre with no era restriction', () => {
    const genre = genrePacks.find(g => g.id === 'adult-contemporary')!;
    const opts = makeOptions({ songCount: 1, genreIds: ['adult-contemporary'] });
    const slots = preallocateSongSlots(opts, [genre], avoid);
    const instruction = buildClaudeCodeInstruction(opts, [genre], testMoods, testSeason, avoid, slots, false);
    expect(instruction).not.toContain('era authenticity');
  });
});

describe('[v3.62 TASK 1] artist-reference interpretation, never the artist name itself', () => {
  it('decomposes "비틀즈 스타일로" into generic descriptors and explicitly forbids naming the artist', () => {
    const opts = makeOptions({ songCount: 1, customConcept: '비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝' });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);
    expect(instruction).toContain('Reference interpretation');
    expect(instruction).toContain('mid-1960s British beat pop');
    expect(instruction.toLowerCase()).toContain('do not name the artist');
    // The raw customConcept field in the JSON payload legitimately echoes
    // the user's own request text verbatim (context the agent needs for
    // lyric writing) — that's not a leak. The actual safety boundary is the
    // [Reference interpretation] block itself: it must describe the sound
    // generically, never repeating the artist's name.
    const referenceBlockStart = instruction.indexOf('[Reference interpretation]');
    const referenceBlockEnd = instruction.indexOf('\n\n', referenceBlockStart);
    const referenceBlock = instruction.slice(referenceBlockStart, referenceBlockEnd === -1 ? undefined : referenceBlockEnd);
    expect(referenceBlock.toLowerCase()).not.toContain('beatles');
    expect(referenceBlock).not.toContain('비틀즈');
  });

  it('adds no reference-interpretation block when customConcept names no known artist', () => {
    const opts = makeOptions({ songCount: 1, customConcept: '아침에 커피와 함께 듣고 싶은 올드팝' });
    const slots = preallocateSongSlots(opts, testGenres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, avoid, slots, false);
    expect(instruction).not.toContain('Reference interpretation');
  });
});

describe('[v3.62 TASK 1] master (multi-set) instruction gets the same composer-mode treatment', () => {
  it('includes composer framing, descriptor-count line, and a full-run plan table', () => {
    const result = buildMultiSetClaudeCodeMasterInstruction(makeOptions({ songCount: 6 }), 2, 6, testGenres, testMoods, testSeason, undefined, false);
    expect(result.instruction).toContain('experienced music composer/producer');
    expect(result.instruction).toContain('25-35 short descriptors');
    expect(result.instruction).toContain('| Track | Genre | BPM | Vocal | Role |');
  });
});
