import { describe, expect, it } from 'vitest';
import { buildKpopPartPlan, findKpopPartPlanGenderViolations } from '../src/core/kpopPartPlan';
import { kpopWorkspacePolicyFor } from '../src/core/kpopWorkspacePolicy';
import type { StructureTemplateId } from '../src/core/lyricEngine';

const malePolicy = kpopWorkspacePolicyFor('kr-idol-male')!;
const femalePolicy = kpopWorkspacePolicyFor('kr-idol-female')!;
const TEMPLATES: StructureTemplateId[] = ['T1', 'T2', 'T3', 'T4', 'T5'];

describe('지시문 37 (TASK A) — buildKpopPartPlan', () => {
  it('memberCount always lands inside the workspace policy range (4-7)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = buildKpopPartPlan('female', 'T1', femalePolicy, seed);
      expect(plan.memberCount).toBeGreaterThanOrEqual(4);
      expect(plan.memberCount).toBeLessThanOrEqual(7);
      expect(plan.members).toHaveLength(plan.memberCount);
    }
  });

  it('TASK A-3 — every member stays within the channel gender for a non-duet track (no female tag in a male group)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = buildKpopPartPlan('male', 'T1', malePolicy, seed);
      expect(plan.members.every(m => m.gender === 'male')).toBe(true);
    }
  });

  it('TASK A-3 — a "duet"-quota track (vocalGender duet) may add exactly one opposite-gender guest member', () => {
    const plan = buildKpopPartPlan('duet', 'T1', femalePolicy, 7);
    const opposite = plan.members.filter(m => m.gender === 'male');
    expect(opposite.length).toBe(1);
  });

  it('TASK A-2 — at least 3 distinct members appear across sectionAssignments (min roster 4)', () => {
    for (const template of TEMPLATES) {
      for (let seed = 0; seed < 30; seed++) {
        const plan = buildKpopPartPlan('male', template, malePolicy, seed);
        const appeared = new Set(plan.sectionAssignments.flatMap(a => (a.role === 'all' ? [] : a.memberIds)));
        expect(appeared.size).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('TASK A-2 — no member appears in more than 2 consecutive non-"all" sections', () => {
    for (const template of TEMPLATES) {
      for (let seed = 0; seed < 30; seed++) {
        const plan = buildKpopPartPlan('female', template, femalePolicy, seed);
        let run = 0;
        let lastMember: string | undefined;
        for (const a of plan.sectionAssignments) {
          if (a.role === 'all') { run = 0; lastMember = undefined; continue; }
          const soloMember = a.memberIds.length === 1 ? a.memberIds[0] : undefined;
          if (soloMember && soloMember === lastMember) {
            run += 1;
          } else {
            run = 1;
            lastMember = soloMember;
          }
          expect(run).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('Chorus/Final Chorus sections are always role "all"', () => {
    const plan = buildKpopPartPlan('male', 'T1', malePolicy, 3);
    const chorusSections = plan.sectionAssignments.filter(a => a.section === 'Chorus' || a.section === 'Final Chorus');
    expect(chorusSections.length).toBeGreaterThan(0);
    expect(chorusSections.every(a => a.role === 'all' && a.memberIds[0] === 'all')).toBe(true);
  });

  it('TASK A-3 — findKpopPartPlanGenderViolations reports 0 violations across 100 non-duet plans and 100 duet plans', () => {
    for (let seed = 0; seed < 100; seed++) {
      const nonDuet = buildKpopPartPlan('male', 'T1', malePolicy, seed);
      expect(findKpopPartPlanGenderViolations(nonDuet, 'male', 'male')).toEqual([]);
      const duet = buildKpopPartPlan('duet', 'T5', femalePolicy, seed);
      expect(findKpopPartPlanGenderViolations(duet, 'female', 'duet')).toEqual([]);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = buildKpopPartPlan('female', 'T3', femalePolicy, 42);
    const b = buildKpopPartPlan('female', 'T3', femalePolicy, 42);
    expect(a).toEqual(b);
  });
});
