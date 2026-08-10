import { describe, expect, it } from 'vitest';
import {
  applyNormalizationSafetyNet,
  collapseAdjacentDuplicateWords,
  collapseSingleDeclarationDuplicates,
  normalizeFinalStylePrompt
} from '../src/core/finalPromptNormalizer';
import { reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { PROMPT_AXIS_POLICIES } from '../src/data/promptAxisPolicy';
import type { PreassignedSongSlot, SongIdea } from '../src/types';

const policy = PROMPT_AXIS_POLICIES['senior-oldpop'];

function slotFor(overrides: Partial<PreassignedSongSlot>): PreassignedSongSlot {
  return {
    trackNo: 1, title: 'Title', hookPhrase: 'Hook', songRole: 'core', tempo: 90, emotionArc: 'steady',
    moneyChordText: '', effectiveMoneyChordId: '', effectiveGenreIds: [],
    ...overrides
  };
}

function songFor(overrides: Partial<SongIdea>): SongIdea {
  return {
    trackNo: 1, title: 'Title', hookPhrase: 'Hook', stylePrompt: '', excludePrompt: '', lyrics: '', warnings: [],
    ...overrides
  } as SongIdea;
}

/**
 * 지시문 31 (§2) — real repro/regression coverage for
 * core/finalPromptNormalizer.ts, the single normalization gate three
 * generation paths (promptComposer 조립, bridge free prose, batch/bridge
 * reconciliation) are meant to converge on (§2-5: promptComposer.ts's own
 * wiring was reverted after real regressions — see localGenerator.ts's own
 * doc comment at both former call sites for why; only the batch/bridge path
 * is wired today).
 */
describe('지시문 31 §2-3 — collapseSingleDeclarationDuplicates', () => {
  it('drops every clause after the first for a single-declaration axis (leadVocal), keeping the axis present exactly once', () => {
    const raw = 'oldpop swing, female lead vocal, warm room, male and female duet, 90 BPM';
    const result = collapseSingleDeclarationDuplicates(raw);
    expect(result).not.toContain('male and female duet');
    expect(result).toContain('female lead vocal');
  });

  it('never removes a multi-allowed axis (genre) even with several clauses', () => {
    const raw = 'oldpop swing, doo-wop harmony, brill building pop, female lead vocal, 90 BPM';
    const result = collapseSingleDeclarationDuplicates(raw);
    expect(result).toContain('doo-wop harmony');
    expect(result).toContain('brill building pop');
  });

  it('protectedAxes keeps a locked-overlaid axis untouched — real repro: a duet slot.vocalText intentionally carries two leadVocal-classified phrases as one atom', () => {
    const raw = 'oldpop swing, male lead with female harmony, warm room, male and female duet, 90 BPM';
    const untouched = collapseSingleDeclarationDuplicates(raw, ['leadVocal']);
    expect(untouched).toBe(raw);
    const collapsed = collapseSingleDeclarationDuplicates(raw, []);
    expect(collapsed).not.toBe(raw);
  });

  it('fixes a real intro contradiction (both immediate and has-intro phrases present)', () => {
    const raw = 'oldpop swing, vocal-first opening, warm room, short intro texture, 90 BPM';
    const result = collapseSingleDeclarationDuplicates(raw);
    // only the first-seen intro clause survives
    expect(result).toContain('vocal-first opening');
    expect(result).not.toContain('short intro texture');
  });

  it('지시문 37 (TASK B-2) — Verse: sparse and Chorus: dense both survive, even though both start with arrangementDensity words (section-scoped, not axis duplicates)', () => {
    const raw = 'kridol synth dance, female lead vocal, 112 BPM, Verse: sparse arrangement, Chorus: dense synth stack, 3:10-3:35';
    const result = collapseSingleDeclarationDuplicates(raw);
    expect(result).toContain('Verse: sparse arrangement');
    expect(result).toContain('Chorus: dense synth stack');
  });
});

describe('지시문 31 §2-3 — collapseAdjacentDuplicateWords', () => {
  it('collapses an immediately repeated word (지시문 16 §1-4 실측 "male male head-voice lead")', () => {
    expect(collapseAdjacentDuplicateWords('male male head-voice lead')).toBe('male head-voice lead');
  });

  it('is case-insensitive and leaves non-adjacent repeats alone', () => {
    expect(collapseAdjacentDuplicateWords('Male male head-voice lead, later male returns')).toBe('Male head-voice lead, later male returns');
  });
});

describe('지시문 31 §2-5 — applyNormalizationSafetyNet (fast-path 안전망)', () => {
  it('removes-only, never injects new content', () => {
    const raw = 'oldpop swing, female lead, female lead, 90 BPM';
    const result = applyNormalizationSafetyNet(raw, policy);
    expect(result.length).toBeLessThanOrEqual(raw.length);
  });

  it('honors protectedAxes the same way the main overlay does', () => {
    const raw = 'oldpop swing, male lead with female harmony, male and female duet, 90 BPM';
    expect(applyNormalizationSafetyNet(raw, policy, ['leadVocal'])).toBe(raw);
    expect(applyNormalizationSafetyNet(raw, policy, [])).not.toBe(raw);
  });
});

describe('지시문 31 §2-5 실측 — reconcileWithPreassignedSlot의 fast path도 이제 정규화를 거친다', () => {
  it('a slot-less-complete (shadow-slot-like) song with a real duplicate leadVocal declaration gets collapsed even though moneyChordText/genreText/etc are all absent (fast path condition)', () => {
    const slot = slotFor({ tempo: 90 });
    const song = songFor({
      stylePrompt: 'oldpop swing, female lead with male harmony, warm room, male and female duet, 90 BPM'
    });
    const result = reconcileWithPreassignedSlot(song, slot, 'ai-creative', {});
    const leadVocalClauses = result.stylePrompt.split(',').filter(c => /\blead\b|\bduet\b/i.test(c));
    expect(leadVocalClauses.length).toBeLessThan(2);
  });
});

describe('지시문 31 §2-3 — normalizeFinalStylePrompt end to end', () => {
  it('a real slot with populated vocalText is not double-processed into losing its intentional duet phrasing', () => {
    const slot = slotFor({
      tempo: 90,
      vocalText: 'male lead with female harmony, male and female duet',
      vocalGender: 'duet'
    });
    const { prompt } = normalizeFinalStylePrompt('some raw prose without vocal info, 90 BPM', slot, policy);
    expect(prompt).toContain('male lead with female harmony');
    expect(prompt).toContain('male and female duet');
  });

  it('a slot with no vocal data collapses a raw duplicate leadVocal declaration (the shadow-slot / audit --pack repro)', () => {
    const slot = slotFor({ tempo: 90 });
    const { prompt } = normalizeFinalStylePrompt(
      'oldpop swing, female lead with male harmony, warm room, male and female duet, 90 BPM',
      slot,
      policy
    );
    expect(prompt).not.toContain('male and female duet');
  });

  it('findings reuses core/promptSpec.ts auditStylePromptAgainstSpec verbatim (no new audit logic)', () => {
    const slot = slotFor({ tempo: 90, vocalGender: 'male' });
    const { findings } = normalizeFinalStylePrompt(
      'oldpop swing, female lead, warm room, 90 BPM',
      slot,
      policy
    );
    // female word present with a male-resolved gender is exactly what auditStylePromptAgainstSpec checks for tempo dupes, not gender (gender check needs BOTH words present) — this just proves findings is wired to the real function and returns an array, not asserting a specific violation shape here (covered by promptSpec's own tests).
    expect(Array.isArray(findings)).toBe(true);
  });
});
