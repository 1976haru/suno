import { describe, expect, it } from 'vitest';
import { findRedundantClauses, splitAtoms } from '../src/core/promptBudget';
import { classifyClause, introSubcategory } from '../src/data/promptAxisLexicon';
import { scoreSong } from '../src/core/quality';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { channelPresets, genrePacks, makeOptions, moodPacks, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

/**
 * 지시문 74 (TASK C §3.3) — 프롬프트 낭비 두 유형의 회귀 테스트.
 *
 * 이 지시문 이전에도 조립 경로(promptBudget의 dedupeTerms)는 중복 절을
 * 지우고 있었지만, 브릿지 에이전트가 직접 쓴 stylePrompt는 그 파이프라인을
 * 타지 않아 그대로 저장됐다 — 실측 1,110곡 중 177곡(241건).
 *
 * 인트로 모순 쪽은 지시문 68이 부정 접두어 일반형을 넣었으나 부정어와
 * 어휘가 맞붙은 경우만 잡혀서, 관사 하나가 낀 "without an intro"가 그대로
 * 샜다(§3.2-⑤가 지목한 "표현이 바뀌면 다시 새는 구조").
 */
describe('[지시문74 TASK C] findRedundantClauses — 완전 동일 절과 포함 관계 절', () => {
  it('완전히 같은 절이 두 번 나오면 뒤엣것을 잡는다 — 실측 taskH set1 #3의 "soft kick drum"', () => {
    const found = findRedundantClauses(splitAtoms(
      '1970s AM-gold soft rock, clean electric guitar arpeggios, soft kick drum, 82 BPM, soft kick drum'
    ));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'exact', clause: 'soft kick drum' });
  });

  it('한쪽이 다른 쪽을 포함하면 짧은 쪽을 잡는다 — 실측 "deep rounded bass" ⊂ "deep rounded bass with kick ducking"', () => {
    const found = findRedundantClauses(splitAtoms(
      'deep house, deep rounded bass, off-beat open hats, deep rounded bass with kick ducking'
    ));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      kind: 'contained',
      clause: 'deep rounded bass',
      coveredBy: 'deep rounded bass with kick ducking'
    });
  });

  it('지시문 74 §3.2-①이 지목한 "full arrangement" 이중 등장을 잡는다', () => {
    const found = findRedundantClauses(splitAtoms(
      'chill rap, full arrangement and full playback level from the first bar, 70 BPM, full arrangement'
    ));
    expect(found.map(f => f.clause)).toContain('full arrangement');
  });

  it('섹션 한정 머니코드 절은 오검출하지 않는다 — "maj7 color"는 "maj7 add9 color"의 부분 문자열이 아니다', () => {
    const found = findRedundantClauses(splitAtoms(
      'Verse: ii-V-I turnaround, maj7 add9 color, Chorus: vi-IV-I-V movement, maj7 color'
    ));
    expect(found).toHaveLength(0);
  });

  it('한 단어짜리 절은 잡지 않는다 — "bright" ⊂ "bright synth pluck"은 감점 대상이 아니다', () => {
    const found = findRedundantClauses(splitAtoms('alt R&B, bright, bright synth pluck, 82 BPM'));
    expect(found).toHaveLength(0);
  });

  it('겹치는 절이 없으면 아무것도 돌려주지 않는다', () => {
    const found = findRedundantClauses(splitAtoms(
      'melodic deep house, four-on-the-floor kick, warm rolling sub bass, 118 BPM, short intro'
    ));
    expect(found).toHaveLength(0);
  });
});

describe('[지시문74 TASK C] scoreSong — 중복 절 경고와 감점', () => {
  function songWith(stylePrompt: string): SongIdea {
    return {
      trackNo: 1,
      title: 'Probe',
      hookPhrase: 'Probe Hook',
      stylePrompt,
      lyrics: '[verse 1]\nline one here\nline two here\n\n[chorus]\nProbe Hook\nline two here\n\n[final chorus]\nProbe Hook\nline two here\nProbe Hook',
      seasonMoment: '',
      listenerSituation: '',
      emotionArc: '',
      youtube: { title: '', description: '', tags: [] }
    } as unknown as SongIdea;
  }

  const CLEAN = 'mellow boom-bap, dusty drum break, filtered bass, 84 BPM, I-V-vi-IV progression, warm alto lead, short intro';

  it('중복 절이 있으면 경고가 붙고 점수가 깎인다', () => {
    const dirty = scoreSong(songWith(`${CLEAN}, filtered bass`));
    expect(dirty.warnings.some(w => w.includes('중복된 절'))).toBe(true);
    expect(dirty.qualityScore).toBeLessThan(scoreSong(songWith(CLEAN)).qualityScore);
  });

  it('중복이 없으면 이 경고가 붙지 않는다', () => {
    expect(scoreSong(songWith(CLEAN)).warnings.some(w => w.includes('중복된 절'))).toBe(false);
  });

  it('감점 폭은 8점을 넘지 않는다 — 재생성 경로로 곡을 무더기로 밀어 넣지 않기 위한 상한', () => {
    const many = `${CLEAN}, filtered bass, dusty drum break, warm alto lead, short intro`;
    const gap = scoreSong(songWith(CLEAN)).qualityScore - scoreSong(songWith(many)).qualityScore;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThanOrEqual(8);
  });
});

describe('[지시문74 TASK C] 인트로 모순 — 부정 접두어 일반형', () => {
  // §8-6이 이름으로 지목한 세 표현. 지시문 74 이전에도 세 개는 모두 잡혔고,
  // 이 테스트는 그 상태를 고정한다.
  it.each(['no intro tag', 'no instrumental intro', 'vocal enters immediately'])(
    '%s → intro 축 / immediate',
    clause => {
      expect(classifyClause(clause, false)).toBe('intro');
      expect(introSubcategory(clause)).toBe('immediate');
    }
  );

  // 지시문 74가 실제로 고친 것: 부정어와 어휘 사이에 단어가 끼는 경우.
  it.each(['without an intro', 'no long instrumental intro', 'without a chord intro'])(
    '%s → intro 축 / immediate (부정어와 어휘가 떨어져 있어도)',
    clause => {
      expect(classifyClause(clause, false)).toBe('intro');
      expect(introSubcategory(clause)).toBe('immediate');
    }
  );

  it('인트로가 있다는 절은 여전히 has-intro다', () => {
    expect(introSubcategory('short intro')).toBe('has-intro');
    expect(introSubcategory('warm Rhodes intro texture')).toBe('has-intro');
  });

  it('인트로를 부정하지 않는 절까지 뒤집지는 않는다 — 부정어 뒤 두 단어까지만 본다', () => {
    expect(introSubcategory('no strings until the intro ends')).toBeUndefined();
  });

  it('"without an intro"와 "short intro"가 한 프롬프트에 있으면 모순으로 잡힌다', () => {
    const scored = scoreSong({
      trackNo: 1,
      title: 'Probe',
      hookPhrase: 'Probe Hook',
      stylePrompt: 'chill rap, without an intro, warm bass, 78 BPM, short intro',
      lyrics: '[verse 1]\nline one here\nline two here\n\n[chorus]\nProbe Hook\nline two here\n\n[final chorus]\nProbe Hook\nline two here\nProbe Hook',
      seasonMoment: '',
      listenerSituation: '',
      emotionArc: '',
      youtube: { title: '', description: '', tags: [] }
    } as unknown as SongIdea);
    expect(scored.warnings.some(w => w.includes('인트로 지시가 서로 모순'))).toBe(true);
  });
});

describe('[지시문74 TASK C] 브릿지 지시문 — 낭비 세 유형 금지 항목', () => {
  const channel = channelPresets.find(c => c.id === 'after-hours-deep-house')!;
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const opts = makeOptions({ channel, songCount: 12, genreIds: channel.preferredGenres });
  const text = buildClaudeCodeInstruction(
    opts, genres, moodPacks.slice(0, 2), testSeason, undefined, preallocateSongSlots(opts, genres)
  );

  it('가사 섹션 구조를 stylePrompt에 재기술하지 말라고 적혀 있다', () => {
    expect(text).toContain('Do NOT restate the lyrics\' own section structure in stylePrompt');
  });

  it('LOCK: 류 라벨을 쓰지 말라고 적혀 있다', () => {
    expect(text).toContain('Do NOT use "LOCK:"-style labels');
  });

  it('머니코드 절 외의 화성 기호를 쓰지 말라고 적혀 있다 — 앱이 준 절 자체는 예외로 남긴다', () => {
    expect(text).toContain('do NOT spell out further chord notation');
    // 같은 지시문이 머니코드를 verbatim으로 요구하므로, 그 요구가 사라지면 안 된다.
    expect(text).toMatch(/moneyChordText/);
  });
});
