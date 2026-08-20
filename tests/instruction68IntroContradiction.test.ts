import { describe, expect, it } from 'vitest';
import { scoreSong } from '../src/core/quality';
import type { SongIdea } from '../src/types';

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Song',
    seasonMoment: 'Christmas Cafe',
    listenerSituation: 'morning coffee before the day begins',
    emotionArc: 'lonely memory to warm acceptance',
    hookPhrase: 'Test Song, keep a little light for me',
    stylePrompt: 'warm adult contemporary pop, hook "test" repeats chorus 4x, I-V-vi-IV progression',
    lyrics: '[short intro]\nSoft Rhodes.\n\n[verse 1]\nline one\nline two\n\n[chorus]\nline three\nline four\n\n[verse 2]\nline five\n\n[short bridge]\nline six\n\n[final chorus]\nline seven\n\n[end]',
    thumbnailText: 'Christmas Cafe',
    youtube: { title: 'YT title', description: 'YT description', tags: ['tag'], thumbnailText: 'th' },
    qualityScore: 0,
    warnings: [],
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

const INTRO_CONTRADICTION_WARNING = '인트로 지시가 서로 모순됩니다';

/**
 * 지시문 68 TASK B §2.4 — 8/21 세트 T1/T9/T13에서 실측된 그대로("vocal
 * enters/starts immediately with no instrumental intro" + "short intro,
 * 3:10-3:35"가 같은 stylePrompt에 동시 존재)를 픽스처로 재현한다.
 */
describe('지시문 68 TASK B — 브릿지 stylePrompt 인트로 자기모순 검사', () => {
  it('§2.4-1: T1 실측 원문(vocal enters immediately + short intro)이 함께 있으면 경고와 감점이 발생한다', () => {
    const clausesWithoutIntro = [
      'kayokyoku ballad',
      'warm string ensemble',
      'I-vi-IV-V progression',
      'female warm alto lead',
      'breakdown section',
      'chorus repeats 4x',
      '82 BPM'
    ];
    const contradictionPrompt = [...clausesWithoutIntro, 'vocal enters immediately with no instrumental intro', 'short intro, 3:10-3:35'].join(', ');
    const cleanPrompt = [...clausesWithoutIntro, 'short intro, 3:10-3:35'].join(', ');

    const song = scoreSong(baseSong({ stylePrompt: contradictionPrompt }));
    const cleanSong = scoreSong(baseSong({ stylePrompt: cleanPrompt }));
    const warning = song.warnings.find(w => w.includes(INTRO_CONTRADICTION_WARNING));
    console.log(`[지시문68 TASK B] warnings: ${JSON.stringify(song.warnings)}`);
    console.log(`[지시문68 TASK B] qualityScore(모순 있음): ${song.qualityScore} / qualityScore(모순 없음): ${cleanSong.qualityScore}`);
    expect(warning).toBeTruthy();
    expect(cleanSong.warnings.some(w => w.includes(INTRO_CONTRADICTION_WARNING))).toBe(false);
    expect(cleanSong.qualityScore - song.qualityScore).toBe(15); // 인트로 모순 감점 폭
  });

  it('§2.4-1b: T9/T13 실측 원문("vocal starts immediately") 변형도 잡는다', () => {
    const stylePrompt = [
      '1970s kayokyoku ballad',
      'vocal starts immediately with no instrumental intro',
      'warm string ensemble',
      'I-vi-IV-V progression',
      'female warm alto lead',
      'short intro, 3:10-3:35',
      'breakdown section',
      'chorus repeats 4x',
      '82 BPM'
    ].join(', ');
    const song = scoreSong(baseSong({ stylePrompt }));
    expect(song.warnings.some(w => w.includes(INTRO_CONTRADICTION_WARNING))).toBe(true);
  });

  it('§2.4-2: "no instrumental intro"만 있고 "short intro"가 없으면 경고가 발생하지 않는다 (부분 문자열 오검출 방지)', () => {
    const stylePrompt = [
      '1970s kayokyoku ballad',
      'vocal enters immediately with no instrumental intro',
      'warm string ensemble',
      'I-vi-IV-V progression',
      'female warm alto lead',
      'breakdown section',
      'chorus repeats 4x',
      '82 BPM'
    ].join(', ');
    const song = scoreSong(baseSong({ stylePrompt }));
    expect(song.warnings.some(w => w.includes(INTRO_CONTRADICTION_WARNING))).toBe(false);
  });

  it('§2.4-3: "short intro"만 있는 정상 프롬프트는 경고가 발생하지 않는다', () => {
    const stylePrompt = [
      '1970s kayokyoku ballad',
      'warm string ensemble',
      'I-vi-IV-V progression',
      'female warm alto lead',
      'short intro, 3:10-3:35',
      'breakdown section',
      'chorus repeats 4x',
      '82 BPM'
    ].join(', ');
    const song = scoreSong(baseSong({ stylePrompt }));
    expect(song.warnings.some(w => w.includes(INTRO_CONTRADICTION_WARNING))).toBe(false);
  });
});
