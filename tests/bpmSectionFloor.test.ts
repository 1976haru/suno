import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { minTotalSectionsForBpm, instrumentalExtensionForBpm } from '../src/core/bpmLengthControl';
import { scoreSong } from '../src/core/quality';
import { channelPresets, genrePacks, makeOptions, moodPacks, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

const FAST_BLOCK_MARKER = '[Fast-tempo tracks — section floor, read before writing these]';

/**
 * 지시문 74 (TASK A) — 실측 청취 피드백에서 나온 회귀 테스트.
 *
 * 원인(§1.1): 20260824_AfterHoursDeepHouse 12곡 중 114 BPM 딥하우스 트랙이
 * 가사 238단어(팩 전체 최다)를 싣고도 7섹션에 그쳐 1:58로 끝났다. 섹션 수가
 * BPM과 무관하게 6~8로 고정돼 있었기 때문이다.
 *
 * 이 파일이 지키는 것은 두 가지다.
 *  1. 96 BPM 이상 트랙은 슬롯·지시문 양쪽에서 새 섹션 하한을 받는다.
 *  2. 95 BPM 이하 트랙과 팩은 한 글자도 바뀌지 않는다(§8 회귀 금지).
 */
describe('[지시문74 TASK A] 슬롯 계획 — BPM 대비 섹션 하한', () => {
  const houseChannel = channelPresets.find(c => c.id === 'after-hours-deep-house')!;
  const houseGenres = genrePacks.filter(g => houseChannel.preferredGenres.includes(g.id));
  const seniorChannel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const seniorGenres = genrePacks.filter(g => seniorChannel.preferredGenres.includes(g.id));

  it('96 BPM 이상 트랙의 sectionCountRange 하한이 그 대역의 정책값과 일치한다', () => {
    const opts = makeOptions({ channel: houseChannel, songCount: 12, genreIds: houseChannel.preferredGenres });
    const slots = preallocateSongSlots(opts, houseGenres);
    const fast = slots.filter(slot => slot.tempo >= 96);
    expect(fast.length).toBeGreaterThan(0);
    for (const slot of fast) {
      expect(slot.sectionCountRange![0]).toBe(minTotalSectionsForBpm(slot.tempo));
    }
  });

  it('111~125 BPM 트랙은 최소 11섹션을 요구한다 — 실측에서 1:58로 끝난 그 대역', () => {
    const opts = makeOptions({ channel: houseChannel, songCount: 12, genreIds: houseChannel.preferredGenres });
    const slots = preallocateSongSlots(opts, houseGenres);
    const clubBand = slots.filter(slot => slot.tempo >= 111 && slot.tempo <= 125);
    expect(clubBand.length).toBeGreaterThan(0);
    for (const slot of clubBand) {
      expect(slot.sectionCountRange![0]).toBeGreaterThanOrEqual(11);
    }
  });

  it('간주 상한이 그 트랙의 실제 필요 확장분보다 작아지지 않는다 — 두 숫자가 모순되면 어느 쪽도 지킬 수 없다', () => {
    const opts = makeOptions({ channel: houseChannel, songCount: 12, genreIds: houseChannel.preferredGenres });
    const slots = preallocateSongSlots(opts, houseGenres);
    for (const slot of slots) {
      const needed = instrumentalExtensionForBpm(slot.tempo, slot.structureTemplate);
      expect(slot.maxInstrumentalSections!).toBeGreaterThanOrEqual(needed);
      // 보컬 뼈대 + 허용 간주 >= 하한 이어야 하한을 실제로 채울 수 있다.
      const floor = minTotalSectionsForBpm(slot.tempo);
      if (floor) expect(slot.maxInstrumentalSections! + (slot.sectionCountRange![0] - floor) + (floor - needed)).toBeGreaterThanOrEqual(floor);
    }
  });

  it('95 BPM 이하 트랙은 예전 그대로다 — 5-6/6-7 섹션, 간주 최대 2 (§8 회귀 금지)', () => {
    // 시니어 워크스페이스의 tempoCeiling은 100이라 팩 안에 96~100 트랙이
    // 섞일 수 있다(실측: 18곡 중 3곡이 100 BPM). 이 지시문의 정책은 순수
    // BPM 기준이므로 그 3곡은 의도적으로 새 하한을 받는다 — §8이 보호하는
    // 것은 "95 이하"이고, 여기서 고정하는 것도 그 범위다.
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: seniorChannel.preferredGenres });
    const slots = preallocateSongSlots(opts, seniorGenres);
    expect(slots.length).toBe(18);
    const slow = slots.filter(slot => slot.tempo <= 95);
    expect(slow.length).toBeGreaterThan(10);
    for (const slot of slow) {
      expect(minTotalSectionsForBpm(slot.tempo)).toBe(0);
      expect(slot.sectionCountRange![0]).toBeLessThanOrEqual(6);
      expect(slot.sectionCountRange![1]).toBeLessThanOrEqual(7);
      expect(slot.maxInstrumentalSections!).toBeLessThanOrEqual(2);
    }
  });
});

describe('[지시문74 TASK A] 브릿지 지시문 — 섹션 하한 콜아웃', () => {
  const houseChannel = channelPresets.find(c => c.id === 'after-hours-deep-house')!;
  const houseGenres = genrePacks.filter(g => houseChannel.preferredGenres.includes(g.id));
  const houseMoods = moodPacks.filter(m => houseChannel.preferredMoods.includes(m.id));
  const seniorChannel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const seniorGenres = genrePacks.filter(g => seniorChannel.preferredGenres.includes(g.id));
  const seniorMoods = moodPacks.filter(m => seniorChannel.preferredMoods.includes(m.id));

  function instructionFor(channel: typeof houseChannel, genres: typeof houseGenres, moods: typeof houseMoods, songCount: number) {
    const opts = makeOptions({ channel, songCount, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, genres);
    return { text: buildClaudeCodeInstruction(opts, genres, moods, testSeason, undefined, slots), slots };
  }

  it('딥하우스 팩의 지시문에는 96 BPM 이상 트랙마다 최소 섹션 수가 명시된다', () => {
    const { text, slots } = instructionFor(houseChannel, houseGenres, houseMoods, 12);
    expect(text).toContain(FAST_BLOCK_MARKER);
    for (const slot of slots.filter(s => s.tempo >= 96)) {
      expect(text).toContain(`- Track ${slot.trackNo} — ${slot.tempo} BPM: MUST have at least ${slot.sectionCountRange![0]} sections`);
    }
  });

  it('늘어난 섹션을 간주로 채우라는 지시가 함께 나간다 — 보컬 섹션만 늘리면 각 섹션이 빈약해진다', () => {
    const { text } = instructionFor(houseChannel, houseGenres, houseMoods, 12);
    expect(text).toContain('INSTRUMENTAL-only sections, never with more sung verses');
  });

  it('95 BPM 이하 트랙은 이 블록에 절대 이름이 오르지 않는다 (§8 회귀 금지)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: seniorChannel.preferredGenres, moodIds: seniorMoods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, seniorGenres);
    const text = buildClaudeCodeInstruction(opts, seniorGenres, seniorMoods, testSeason, undefined, slots);
    for (const slot of slots.filter(s => s.tempo <= 95)) {
      expect(text).not.toContain(`- Track ${slot.trackNo} — ${slot.tempo} BPM: MUST have at least`);
    }
  });

  it('96 BPM 이상 트랙이 하나도 없는 팩에는 블록 자체가 나가지 않는다', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: seniorChannel.preferredGenres, moodIds: seniorMoods.map(m => m.id) });
    const slots = preallocateSongSlots(opts, seniorGenres).map(slot => ({ ...slot, tempo: Math.min(slot.tempo, 95), sectionCountRange: [5, 6] as [number, number] }));
    const text = buildClaudeCodeInstruction(opts, seniorGenres, seniorMoods, testSeason, undefined, slots);
    expect(text).not.toContain(FAST_BLOCK_MARKER);
  });
});

describe('[지시문74 TASK A] scoreSong — 임포트 시 섹션 하한 검사', () => {
  function songWith(bpm: number, sectionCount: number): SongIdea {
    const sections = Array.from({ length: sectionCount }, (_, i) => `[verse ${i + 1}]\nline one here\nline two here`).join('\n\n');
    return {
      trackNo: 1,
      title: 'Probe',
      hookPhrase: 'Probe Hook',
      stylePrompt: `deep house, ${bpm} BPM, I-V-vi-IV progression, chorus lift, warm bass, hook repeated once per chorus`,
      lyrics: `[intro]\n\n${sections}\n\n[chorus]\nProbe Hook\nline two here\n\n[final chorus]\nProbe Hook\nline two here\nProbe Hook`,
      seasonMoment: '',
      listenerSituation: '',
      emotionArc: '',
      youtube: { title: '', description: '', tags: [] }
    } as unknown as SongIdea;
  }

  it('114 BPM · 7섹션이면 경고와 감점이 붙는다 — 실측 결함의 정확한 재현', () => {
    const scored = scoreSong(songWith(114, 4)); // intro + 4 verses + chorus + final chorus = 7
    expect(scored.warnings.some(w => w.includes('114 BPM') && w.includes('최소 11개'))).toBe(true);
  });

  it('같은 곡이 11섹션이면 이 경고가 없다', () => {
    const scored = scoreSong(songWith(114, 8)); // 11 sections
    expect(scored.warnings.some(w => w.includes('최소 11개'))).toBe(false);
  });

  it('77 BPM · 7섹션은 경고 대상이 아니다 — 95 이하는 이 검사를 아예 타지 않는다 (§8)', () => {
    const scored = scoreSong(songWith(77, 4));
    expect(scored.warnings.some(w => w.includes('BPM에서 섹션이'))).toBe(false);
  });
});
