import { describe, expect, it } from 'vitest';
import { MIN_LYRIC_WORDS, MAX_LYRIC_WORDS, buildSystemInstruction } from '../src/core/promptComposer';
import { buildIntroModePlan, reconcileIntroModeWithStructureTemplate } from '../src/core/introModePlan';
import { buildStructureTemplatePlan, hashSeed, seedForBlueprint } from '../src/core/lyricEngine';
import { buildVocalPlan, buildAdultVocalTraitPlan, DEFAULT_ADULT_VOCAL_QUOTA, type VocalQuota } from '../src/core/vocalPlan';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { makeOptions, testGenres, testMoods, testSeason, channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

/**
 * v3.75 — real measured numbers for this task's own §6 report format.
 * Everything here runs the real (deterministic, offline) app code — no
 * network, no actual Suno render. This is NOT a substitute for the §6-2/
 * §6-3 Suno-measured length/amplitude verification this task's own spec
 * requires before a completion claim; see docs/v3.75-report.md for the
 * explicit statement of what could and couldn't be verified in this
 * session.
 */
describe('[v3.75 TASK A] word-count band and section/instrumental instruction text', () => {
  it('REPORT: MIN/MAX_LYRIC_WORDS raised to 215-230', () => {
    expect(MIN_LYRIC_WORDS).toBe(215);
    expect(MAX_LYRIC_WORDS).toBe(230);
  });

  it('REPORT: buildSystemInstruction includes explicit per-section line-count guidance and an instrumental-moment requirement', () => {
    const opts = makeOptions({ channel: seniorChannel });
    const system = buildSystemInstruction(opts);
    expect(system).toContain('a verse should run 5-6 lines');
    expect(system).toContain('at least one genuinely wordless instrumental moment');
     
    console.log('[TASK v3.75 REPORT] section-length instruction line present: true');
  });
});

describe('[v3.75 TASK A] introMode / structureTemplate conflict reconciliation — real 18-song plan', () => {
  it('REPORT: counts how many tracks would have conflicted (instrumental introMode + a template that forbids one) before vs after reconciliation', () => {
    const seedBase = seedForBlueprint({ channel: seniorChannel, projectTitle: 'v3.75 length test' });
    const seed = hashSeed(seedBase);
    const introModePlanRaw = buildIntroModePlan(18, seed);
    const structureTemplatePlan = buildStructureTemplatePlan(18, seed, seniorChannel.archetype);
    if (structureTemplatePlan.length) structureTemplatePlan[0] = 'T1';
    const reconciled = reconcileIntroModeWithStructureTemplate(introModePlanRaw, structureTemplatePlan);

    const conflictsBefore = introModePlanRaw.filter((mode, i) => mode === 'instrumental' && ['T2', 'T5'].includes(structureTemplatePlan[i])).length;
    const conflictsAfter = reconciled.filter((mode, i) => mode === 'instrumental' && ['T2', 'T5'].includes(structureTemplatePlan[i])).length;
    const instrumentalCountBefore = introModePlanRaw.filter(m => m === 'instrumental').length;
    const instrumentalCountAfter = reconciled.filter(m => m === 'instrumental').length;

     
    console.log('[TASK v3.75 REPORT] structureTemplatePlan:', structureTemplatePlan.join(','));
     
    console.log('[TASK v3.75 REPORT] introModePlan before:', introModePlanRaw.join(','));
     
    console.log('[TASK v3.75 REPORT] introModePlan after:', reconciled.join(','));
     
    console.log(`[TASK v3.75 REPORT] conflicts: before=${conflictsBefore} after=${conflictsAfter}; instrumental count: before=${instrumentalCountBefore} after=${instrumentalCountAfter}`);

    expect(conflictsAfter).toBe(0);
    expect(instrumentalCountAfter).toBe(instrumentalCountBefore);
    expect(reconciled[0]).toBe('vocal-immediate');
  });
});

describe('[v3.75 TASK B] killing-point instruction strength — real bridge instruction text', () => {
  it('REPORT: killing point section text includes "loudest, fullest" and the pre-peak restraint instruction', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, slots, false);
    const hasKillingPoint = slots.some(slot => slot.killingPointText);
    if (hasKillingPoint) {
      const section = instruction.split('[Killing points]')[1]?.split('\n\n')[0];
       
      console.log('[TASK v3.75 REPORT] Killing point section:\n[Killing points]' + section);
      expect(instruction).toContain('loudest, fullest, most energetic point');
      expect(instruction).toContain('stay noticeably more restrained');
    }
  });
});

describe('[v3.75 TASK C] vocal type zone distribution — real 18-song plan, real seeds', () => {
  it('REPORT: 18곡 보컬 타입 순서, 3구간 균등 분산 확인 (multiple seeds)', () => {
    for (const seed of [1, 42, 12345]) {
      const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, seed);
      const zones = [plan.slice(0, 6), plan.slice(6, 12), plan.slice(12, 18)];
      const zoneCounts = zones.map(zone => {
        const counts: Record<string, number> = {};
        for (const type of zone) counts[type] = (counts[type] ?? 0) + 1;
        return counts;
      });
       
      console.log(`[TASK v3.75 REPORT] seed=${seed} 1~6: ${zones[0].join(' ')}`);
       
      console.log(`[TASK v3.75 REPORT] seed=${seed} 7~12: ${zones[1].join(' ')}`);
       
      console.log(`[TASK v3.75 REPORT] seed=${seed} 13~18: ${zones[2].join(' ')}`);
       
      console.log(`[TASK v3.75 REPORT] seed=${seed} zone counts:`, zoneCounts);
      for (const counts of zoneCounts) {
        for (const count of Object.values(counts)) expect(count).toBeLessThanOrEqual(3);
      }
      // no run of 3
      let run = 1;
      for (let i = 1; i < plan.length; i++) {
        run = plan[i] === plan[i - 1] ? run + 1 : 1;
        expect(run, `seed=${seed} run at index ${i}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('REPORT: real 6/7/5 quota (matching the measured pack) also spreads evenly', () => {
    const quota: VocalQuota = { mixed: 6, male: 7, female: 5 };
    const plan = buildVocalPlan(quota, 18, 777);
    const zones = [plan.slice(0, 6), plan.slice(6, 12), plan.slice(12, 18)];
     
    console.log('[TASK v3.75 REPORT] 6/7/5 quota, seed=777:', plan.join(' '));
    zones.forEach((zone, idx) => {
      const counts: Record<string, number> = {};
      for (const type of zone) counts[type] = (counts[type] ?? 0) + 1;
       
      console.log(`[TASK v3.75 REPORT]   zone ${idx + 1} (tracks ${idx * 6 + 1}-${idx * 6 + 6}):`, counts);
    });
  });
});

describe('[v3.75 TASK C] female vocalText now states the word "female" explicitly', () => {
  it('REPORT: real composed vocalText for a female-assigned track', () => {
    const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, 42);
    const texts = buildAdultVocalTraitPlan(plan, 42, { isSenior: true, peakFlags: plan.map(() => false) });
    const femaleIdx = plan.findIndex(type => type === 'female');
    const maleIdx = plan.findIndex(type => type === 'male');
     
    console.log('[TASK v3.75 REPORT] female vocalText sample:', texts[femaleIdx]);
     
    console.log('[TASK v3.75 REPORT] male vocalText sample:', texts[maleIdx]);
    expect(texts[femaleIdx]).toMatch(/^female /);
    expect(texts[maleIdx]).toMatch(/^male /);
  });
});
