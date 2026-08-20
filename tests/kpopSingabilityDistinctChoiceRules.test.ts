import { describe, expect, it } from 'vitest';
import { evaluateDistinctChoiceGate } from '../src/core/distinctChoiceGate';
import { distinctChoicePolicyForWorkspace } from '../src/data/distinctChoicePolicy';
import type { SongIdea } from '../src/types';

const policy = distinctChoicePolicyForWorkspace('kr-idol-female');

function song(overrides: Partial<SongIdea> = {}): Pick<SongIdea, 'trackNo' | 'lyrics' | 'stylePrompt' | 'distinctChoice' | 'distinctChoiceRuleId' | 'distinctChoiceParams' | 'hookPhrase'> {
  return {
    trackNo: 1,
    lyrics: '[Verse 1]\n어떤 절 가사\n[Chorus]\nOwn Way\nOwn Way\nOwn Way\nOwn Way',
    stylePrompt: 'x',
    distinctChoice: 'K-pop hook repeat',
    distinctChoiceRuleId: 'HOOK_REPEAT_4X',
    hookPhrase: 'Own Way',
    ...overrides
  };
}

describe('지시문 37 (TASK C-2) — CHANT_HOOK / HOOK_REPEAT_4X wired into distinctChoiceGate', () => {
  it('CHANT_HOOK and HOOK_REPEAT_4X are in kr-idol-female allowedRuleIds', () => {
    expect(policy.allowedRuleIds).toContain('CHANT_HOOK');
    expect(policy.allowedRuleIds).toContain('HOOK_REPEAT_4X');
  });

  it('HOOK_REPEAT_4X compliant when hook repeats 4+ times', () => {
    const result = evaluateDistinctChoiceGate([song()], policy);
    expect(result.trackResults[0].status).toBe('compliant');
  });

  it('HOOK_REPEAT_4X violated when hook repeats fewer than 4 times', () => {
    const result = evaluateDistinctChoiceGate(
      [song({ lyrics: '[Verse 1]\nx\n[Chorus]\nOwn Way\nOwn Way' })],
      policy
    );
    expect(result.trackResults[0].status).toBe('violated');
  });

  it('CHANT_HOOK compliant when a chant/ad-lib section tag exists', () => {
    const result = evaluateDistinctChoiceGate(
      [song({ distinctChoiceRuleId: 'CHANT_HOOK', lyrics: '[Verse 1]\nx\n[Chant]\nhey hey' })],
      policy
    );
    expect(result.trackResults[0].status).toBe('compliant');
  });

  it('CHANT_HOOK violated when no chant/ad-lib section tag exists', () => {
    const result = evaluateDistinctChoiceGate(
      [song({ distinctChoiceRuleId: 'CHANT_HOOK', lyrics: '[Verse 1]\nx\n[Chorus]\nOwn Way' })],
      policy
    );
    expect(result.trackResults[0].status).toBe('violated');
  });

  it('kr-idol-female policy stays verified:false so neither rule can ever be thresholdBlocking', () => {
    const result = evaluateDistinctChoiceGate(
      [song({ lyrics: '[Verse 1]\nx\n[Chorus]\nOwn Way' })], // violated
      policy
    );
    expect(result.verified).toBe(false);
    expect(result.thresholdBlocking).toBe(false);
  });
});
