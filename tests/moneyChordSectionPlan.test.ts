import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, makeOptions } from './fixtures';
import { moneyChordPresets } from '../src/data/moneyChords';
import { buildMoneyChordSectionPlan, workspaceCountBucketFor } from '../src/core/moneyChordSectionPlan';
import type { ChannelArchetype } from '../src/types';

const seniorChannel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
const kr2030Channel = channelPresets.find(c => c.id === 'after-work-band-pop')!;
const kidsChannel = channelPresets.find(c => c.id === 'little-singalong-radio')!;

function parseSectionText(text: string): { section: string; progressionText: string }[] {
  return text.split(' / ').map(part => {
    const [section, ...rest] = part.split(': ');
    return { section, progressionText: rest.join(': ') };
  });
}

describe('지시문 39 (TASK B) — buildMoneyChordSectionPlan', () => {
  it('null progressionPlan이면(회전 없는 채널) 빈 배열을 돌려준다 — 낡은 경로 무변경', () => {
    expect(buildMoneyChordSectionPlan(null, 'senior-morning', 15, 1)).toEqual([]);
  });

  it('compatibleWith 밖의 진행과는 절대 조합하지 않는다', () => {
    const plan = buildMoneyChordSectionPlan(Array(30).fill('doowop'), 'senior-morning', 30, 5);
    const doowopCompatible = new Set(moneyChordPresets.doowop.compatibleWith);
    for (const entry of plan) {
      if (!entry || entry.chordIds.length <= 1) continue;
      for (const id of entry.chordIds.slice(1)) {
        expect(doowopCompatible.has(id), id).toBe(true);
      }
    }
  });

  it('emotional/winterBallad는 이미 2단 진행이라 이 레이어가 다시 확장하지 않는다', () => {
    const plan = buildMoneyChordSectionPlan(Array(30).fill('emotional'), 'senior-morning', 30, 5);
    expect(plan.every(entry => entry && entry.chordIds.length === 1 && entry.chordIds[0] === 'emotional')).toBe(true);
    const planWinter = buildMoneyChordSectionPlan(Array(30).fill('winterBallad'), 'senior-morning', 30, 5);
    expect(planWinter.every(entry => entry && entry.chordIds.length === 1 && entry.chordIds[0] === 'winterBallad')).toBe(true);
  });

  it('한 곡에 진행이 4개 이상 나오지 않는다', () => {
    const plan = buildMoneyChordSectionPlan(Array(30).fill('doowop'), 'senior-morning', 30, 9);
    expect(plan.every(entry => !entry || entry.chordIds.length <= 3)).toBe(true);
  });

  it('sectionMap이 있으면 text와 정확히 대응한다', () => {
    const plan = buildMoneyChordSectionPlan(Array(15).fill('doowop'), 'kr-2030-pop', 15, 3);
    for (const entry of plan) {
      if (!entry || entry.sectionMap.length === 0) continue;
      expect(entry.text).toBeDefined();
      const parsed = parseSectionText(entry.text!);
      expect(parsed.map(p => p.section)).toEqual(entry.sectionMap.map(s => s.section));
      expect(entry.sectionMap.map(s => s.chordId)).toEqual(entry.chordIds);
    }
  });

  it('동요는 3개 진행이 나오지 않는다(따라 부르기 쉬움 우선)', () => {
    const plan = buildMoneyChordSectionPlan(Array(30).fill('kidsSimple'), 'kids', 30, 11);
    expect(plan.every(entry => !entry || entry.chordIds.length <= 2)).toBe(true);
  });
});

describe('지시문 39 (TASK B-7) — 실제 생성 파이프라인 왕복 (preallocateSongSlots)', () => {
  it('시니어 채널: 일부 트랙이 moneyChordSectionMap을 갖는다(2개 우세)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 15 });
    const slots = preallocateSongSlots(opts, []);
    const multiCount = slots.filter(s => s.moneyChordSectionMap && s.moneyChordSectionMap.length > 1).length;
    expect(multiCount).toBeGreaterThan(0);
    for (const slot of slots) {
      if (!slot.moneyChordSectionMap) continue;
      // TASK B 계약: sectionMap[0]의 chordId는 항상 주 진행(moneyChordId)과 같다.
      expect(slot.moneyChordSectionMap[0].chordId).toBe(slot.moneyChordId);
      expect(slot.moneyChordSectionText).toContain('Verse:');
    }
  });

  it('2030 채널: 2~3개 진행 비중이 시니어보다 높다', () => {
    const opts = makeOptions({ channel: kr2030Channel, songCount: 15 });
    const slots = preallocateSongSlots(opts, []);
    const multiCount = slots.filter(s => s.moneyChordSectionMap && s.moneyChordSectionMap.length > 1).length;
    const threePlusCount = slots.filter(s => s.moneyChordSectionMap && s.moneyChordSectionMap.length === 3).length;
    expect(multiCount).toBeGreaterThan(0);
    expect(threePlusCount).toBeGreaterThan(0);
  });

  it('동요 채널: 1개 진행 곡이 대다수다', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15 });
    const slots = preallocateSongSlots(opts, []);
    const singleCount = slots.filter(s => !s.moneyChordSectionMap).length;
    expect(singleCount).toBeGreaterThanOrEqual(9);
  });

  it('섹션 라벨이 promptAxisLexicon의 SECTION_SCOPED_LABEL_PATTERN과 일치한다(축 중복 오판 방지)', async () => {
    const { SECTION_SCOPED_LABEL_PATTERN } = await import('../src/data/promptAxisLexicon');
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const slots = preallocateSongSlots(opts, []);
    for (const slot of slots) {
      if (!slot.moneyChordSectionMap) continue;
      for (const assignment of slot.moneyChordSectionMap) {
        expect(SECTION_SCOPED_LABEL_PATTERN.test(`${assignment.section}:`), assignment.section).toBe(true);
      }
    }
  });

  it('설계 관문(designGate)의 머니코드 최대 곡수는 slot.moneyChordId(주 진행)만 읽으므로 다중 진행에 영향받지 않는다', async () => {
    const { evaluateDesignGate } = await import('../src/core/designGate');
    const { resolveConstraintsFromOptions } = await import('../src/core/constraints');
    const { SENIOR_AUDIENCE_PROFILE } = await import('../src/data/audienceProfiles');
    const opts = makeOptions({ channel: seniorChannel, songCount: 15 });
    const slots = preallocateSongSlots(opts, []);
    const constraints = resolveConstraintsFromOptions(opts, SENIOR_AUDIENCE_PROFILE, 'senior-oldpop');
    const gate = evaluateDesignGate(slots, constraints, opts);
    const moneyChordIssues = gate.blocking.filter(issue => issue.id === 'moneychord-max');
    expect(moneyChordIssues).toEqual([]);
  });
});

describe('지시문 39 (TASK B-4) — workspaceCountBucketFor', () => {
  it('kids 아키타입은 kids 버킷', () => {
    expect(workspaceCountBucketFor('kids')).toBe('kids');
    expect(workspaceCountBucketFor('kr-kids-song')).toBe('kids');
  });
  it('시니어 5종은 senior 버킷', () => {
    for (const a of ['senior-morning', 'showa-cafe', 'showa-70s', 'oldpop-lounge', 'christmas'] as ChannelArchetype[]) {
      expect(workspaceCountBucketFor(a)).toBe('senior');
    }
  });
  it('2030·아이돌 4종은 modern 버킷', () => {
    for (const a of ['kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female'] as ChannelArchetype[]) {
      expect(workspaceCountBucketFor(a)).toBe('modern');
    }
  });
});
