import { describe, expect, it } from 'vitest';
import { resolveRewriteScope, buildStructuredRewriteInstructions } from '../src/core/rewriteInstruction';
import { checkKidsRewritePreservesPolicy } from '../src/core/rewriteWorkspaceRules';
import { checkKpopRewritePreservesQuota } from '../src/core/rewriteWorkspaceRules';
import { check2030RewritePreservesLanguage } from '../src/core/rewriteWorkspaceRules';
import { checkSeniorRewritePreservesEraAndTempo } from '../src/core/rewriteWorkspaceRules';
import { qualityPolicyForWorkspace } from '../src/data/workspaceQualityPolicies';
import type { ScopedIssue, SongIdea } from '../src/types';

/**
 * codex 지시문 05 (TASK D+E, required test file) — real, per-workspace-
 * cluster coverage of the rewrite scope classification, the structured
 * instruction builder, and each workspace's own real "what must survive a
 * rewrite" constraint checks.
 */

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'T', seasonMoment: '', listenerSituation: 'a quiet evening',
    emotionArc: 'warm', hookPhrase: 'hold on', stylePrompt: 'warm pop, 92 BPM', lyrics: '[verse 1]\nline',
    youtube: { title: '', description: '', tags: [] }, warnings: [], qualityScore: 80, ...overrides
  } as SongIdea;
}

describe('[codex 지시문 05 TASK D] resolveRewriteScope — real 4-way vocabulary', () => {
  it('empty issues within round budget -> track-rewrite (nothing to escalate)', () => {
    expect(resolveRewriteScope([], 0)).toBe('track-rewrite');
  });

  it('a track-scoped issue -> track-rewrite', () => {
    const issues: ScopedIssue[] = [{ scope: 'track', id: 'x', labelKo: '', affectedTracks: [1], fixHintKo: '' }];
    expect(resolveRewriteScope(issues, 0)).toBe('track-rewrite');
  });

  it('a rebalance-scoped issue -> set-rebalance', () => {
    const issues: ScopedIssue[] = [{ scope: 'rebalance', id: 'x', labelKo: '', affectedTracks: [1], fixHintKo: '' }];
    expect(resolveRewriteScope(issues, 0)).toBe('set-rebalance');
  });

  it('a design-scoped issue -> design-regenerate, even alongside track-scoped ones (most severe wins)', () => {
    const issues: ScopedIssue[] = [
      { scope: 'track', id: 'a', labelKo: '', affectedTracks: [1], fixHintKo: '' },
      { scope: 'design', id: 'b', labelKo: '', affectedTracks: [1, 2], fixHintKo: '' }
    ];
    expect(resolveRewriteScope(issues, 0)).toBe('design-regenerate');
  });

  it('round budget exhausted (2 automatic rounds already run) -> blocked-manual regardless of issue scope', () => {
    const issues: ScopedIssue[] = [{ scope: 'track', id: 'x', labelKo: '', affectedTracks: [1], fixHintKo: '' }];
    expect(resolveRewriteScope(issues, 2)).toBe('blocked-manual');
  });
});

describe('[codex 지시문 05 TASK D] buildStructuredRewriteInstructions — real per-track shape', () => {
  it('includes trackNo/원문/문제유형/변경필드/유지필드/다른트랙/workspace policy', () => {
    const songs = [makeSong({ trackNo: 1 }), makeSong({ trackNo: 2 }), makeSong({ trackNo: 3 })];
    const issues: ScopedIssue[] = [{ scope: 'track', id: 'english-grammar-errors', labelKo: '영어 문법 오류', affectedTracks: [1], fixHintKo: '문법 수정 필요' }];
    const policy = qualityPolicyForWorkspace('kr-2030');
    const instructions = buildStructuredRewriteInstructions(issues, songs, policy);
    expect(instructions).toHaveLength(1);
    const [instruction] = instructions;
    expect(instruction.trackNo).toBe(1);
    expect(instruction.originalText.lyrics).toBe(songs[0].lyrics);
    expect(instruction.problemTypes).toContain('영어 문법 오류');
    expect(instruction.fieldsToChange).toContain('lyrics');
    expect(instruction.fieldsToPreserve).not.toContain('lyrics');
    expect(instruction.otherTracksMustNotChange).toEqual([2, 3]);
    expect(instruction.workspacePolicySummaryKo).toContain('kr-2030');
  });

  it('a design/rebalance-scoped issue expands to every affected track', () => {
    const songs = [makeSong({ trackNo: 1 }), makeSong({ trackNo: 2 })];
    const issues: ScopedIssue[] = [{ scope: 'design', id: 'bpm_in_range', labelKo: 'BPM 범위', affectedTracks: [1, 2], fixHintKo: '' }];
    const policy = qualityPolicyForWorkspace('senior-oldpop');
    const instructions = buildStructuredRewriteInstructions(issues, songs, policy);
    expect(instructions.map(i => i.trackNo)).toEqual([1, 2]);
  });
});

describe('[codex 지시문 05 TASK E] kids — 교육 목표/연령대 유지, 반복 구조 임의 제거 안 함', () => {
  it('a rewrite that only swaps a risky line keeps ageTier/phase/repetition intact', () => {
    const before = makeSong({ effectiveKidsAgeTierId: 'kids-t2', arcPhase: 'kids-learning', lyrics: '[chorus]\nwe count to five\nwe count to five\n[verse 1]\na risky line here' });
    const after = { ...before, lyrics: '[chorus]\nwe count to five\nwe count to five\n[verse 1]\na safe line here' };
    const check = checkKidsRewritePreservesPolicy(before, after);
    expect(check.ageTierPreserved).toBe(true);
    expect(check.phasePreserved).toBe(true);
    expect(check.repetitionStructurePreserved).toBe(true);
  });

  it('flags a rewrite that silently changed the age tier', () => {
    const before = makeSong({ effectiveKidsAgeTierId: 'kids-t1' });
    const after = { ...before, effectiveKidsAgeTierId: 'kids-t3' as const };
    expect(checkKidsRewritePreservesPolicy(before, after).ageTierPreserved).toBe(false);
  });

  it('flags a rewrite that collapsed the repeated chorus down to a one-off line', () => {
    const before = makeSong({ lyrics: '[chorus]\nclap your hands\nclap your hands\nclap your hands' });
    const after = { ...before, lyrics: '[chorus]\nclap once' };
    expect(checkKidsRewritePreservesPolicy(before, after).repetitionStructurePreserved).toBe(false);
  });
});

describe('[codex 지시문 05 TASK E] K-pop — fixed vocal quota/part assignment 유지', () => {
  it('a rewrite that keeps vocalType passes', () => {
    const before = makeSong({ vocalType: 'male' });
    const after = { ...before, lyrics: '[verse 1]\nnew line' };
    expect(checkKpopRewritePreservesQuota(before, after).vocalTypePreserved).toBe(true);
  });

  it('flags a rewrite that flipped vocalType (would silently break the fixed 15/0/3 quota)', () => {
    const before = makeSong({ vocalType: 'male' });
    const after = { ...before, vocalType: 'female' as const };
    expect(checkKpopRewritePreservesQuota(before, after).vocalTypePreserved).toBe(false);
  });
});

describe('[codex 지시문 05 TASK E] 2030 — 언어 유지, 현대 장면을 시니어 장면으로 바꾸지 않음', () => {
  it('a real Korean rewrite passes the language check', () => {
    const after = makeSong({ lyrics: '오늘 밤 우리는 함께 걸어가 이 거리를 지나서' });
    expect(check2030RewritePreservesLanguage(after, 'korean').languageMatchesExpected).toBe(true);
  });

  it('flags a rewrite that accidentally introduced senior-oldpop-coded imagery (letter/coffee/porch/diner)', () => {
    const after = makeSong({ lyrics: '오늘 아침 커피 한 잔과 함께 편지를 읽어 내려가', listenerSituation: '아침 식탁에서 커피와 편지' });
    expect(check2030RewritePreservesLanguage(after, 'korean').introducedSeniorScene).toBe(true);
  });
});

describe('[codex 지시문 05 TASK E] senior — 시대/템포 유지, 소재 중복 해결 시 새 장면으로 교체', () => {
  it('a rewrite within a small tempo drift and the same era genre passes', () => {
    const before = makeSong({ genreId: 'showa-city-pop', bpm: 96 });
    const after = { ...before, bpm: 98 };
    const check = checkSeniorRewritePreservesEraAndTempo(before, after);
    expect(check.eraBucketPreserved).toBe(true);
    expect(check.tempoWithinBand).toBe(true);
  });

  it('flags a rewrite that drifted tempo far outside the tolerance band', () => {
    const before = makeSong({ bpm: 90 });
    const after = { ...before, bpm: 130 };
    expect(checkSeniorRewritePreservesEraAndTempo(before, after).tempoWithinBand).toBe(false);
  });

  it('when resolving a motif-quota rewrite, the new scene must land in a genuinely different motif family', () => {
    const before = makeSong({ lyrics: 'an old letter arrives every morning', listenerSituation: 'reading a letter' });
    const stillSameFamily = { ...before, lyrics: 'another letter arrives, folded twice' };
    const genuinelyNew = { ...before, lyrics: 'the porch light flickers as evening falls', listenerSituation: 'sitting on the porch' };
    expect(checkSeniorRewritePreservesEraAndTempo(before, stillSameFamily).motifFamilyChanged).toBe(false);
    expect(checkSeniorRewritePreservesEraAndTempo(before, genuinelyNew).motifFamilyChanged).toBe(true);
  });
});
