/**
 * TASK v5.7 (TASK E) — regression guard for ConceptAxisCoverage (TASK C
 * §3-5): the 6 concepts this task's own §4-3 names, checked for whether
 * every axis the concept actually names reaches genre selection/prompt
 * rather than being silently dropped. This is the automated version of this
 * task's own §9 self-check question #3 ("컨셉에 쓴 표현 중 조용히 무시되는
 * 것이 있는가?") — if a future change reintroduces a silently-ignored axis,
 * this test fails instead of waiting for 하루 to notice.
 */
import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

interface CaseSpec {
  concept: string;
  /** Axes this concept's own text should trip detected:true for — a minimum expectation, not exhaustive (situation/reference/season detection is heuristic). */
  expectDetected: string[];
}

// This task's own §4-3 concept list, verbatim.
const CASES: CaseSpec[] = [
  { concept: '60년대 감미로운 올드팝', expectDetected: ['era', 'mood', 'genre'] },
  { concept: '비 오는 날 잔잔한 어쿠스틱', expectDetected: ['mood', 'situation', 'genre'] },
  { concept: '여름밤 신나는 드라이브 곡', expectDetected: ['mood'] },
  { concept: '카펜터스 느낌의 겨울 발라드', expectDetected: ['reference'] },
  { concept: '70년대 애잔한 이별 노래', expectDetected: ['era', 'mood'] },
  { concept: '밝고 경쾌한 60년대 걸그룹', expectDetected: ['era', 'mood'] }
];

describe('[v5.7 TASK E] ConceptAxisCoverage — 6-concept coverage table', () => {
  it.each(CASES)('"$concept" — every detected axis is actually applied (unapplied === 0)', ({ concept, expectDetected }) => {
    const plan = directSetLocal(concept, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const coverage = plan.interpretation.axisCoverage;

    for (const axis of expectDetected) {
      const entry = coverage.find(c => c.axis === axis);
      expect(entry, `expected axis "${axis}" to be present in coverage for "${concept}"`).toBeDefined();
      expect(entry!.detected, `expected axis "${axis}" to be detected for "${concept}"`).toBe(true);
    }

    const unapplied = coverage.filter(c => c.unapplied);
    expect(unapplied, `unapplied axes for "${concept}": ${JSON.stringify(unapplied)}`).toHaveLength(0);
  });

  it('"60년대 감미로운 올드팝" — mood is detected with the correct Korean source text and English descriptors', () => {
    const plan = directSetLocal('60년대 감미로운 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.interpretation.mood?.sourceText).toBe('감미로운');
    expect(plan.interpretation.mood?.descriptors).toEqual(expect.arrayContaining(['sweet', 'tender', 'mellow']));
  });

  it('a concept with no mood adjective from the dictionary reports mood as NOT detected (never force-matched)', () => {
    const plan = directSetLocal('60년대 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const moodEntry = plan.interpretation.axisCoverage.find(c => c.axis === 'mood');
    expect(moodEntry?.detected).toBe(false);
    expect(plan.interpretation.mood).toBeUndefined();
  });
});
