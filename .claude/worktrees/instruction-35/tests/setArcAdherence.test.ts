import { describe, expect, it } from 'vitest';
import { parseSetArcSpec, checkSetArcAdherence, setArcAdherenceIsBlocking, SET_ARC_ADHERENCE_BLOCKING_THRESHOLD } from '../src/core/setArcAdherence';
import type { SongIdea } from '../src/types';

/**
 * 지시문 29 (TASK B) — 실측: 컨셉 "Autumn to Christmas Playlist Pack"이
 * 크리스마스 어휘 0곡·늦여름 4곡으로 나왔다("약속 이행도 0%"는 advisory라
 * 생성이 그대로 진행됐다). 이 모듈이 그 결함을 실제로 잡는지 확인한다.
 */
function song(overrides: Partial<SongIdea> & { trackNo: number }): SongIdea {
  return {
    title: 'Song', seasonMoment: '', listenerSituation: 'x', emotionArc: 'x',
    hookPhrase: 'Hook', stylePrompt: 'warm pop', lyrics: '[verse 1]\nline\n[end]',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
    qualityScore: 0, warnings: [], effectiveMoneyChordId: 'default', effectiveGenreIds: [],
    ...overrides
  };
}

describe('지시문 29 TASK B — parseSetArcSpec', () => {
  it('"Autumn to Christmas Playlist Pack" -> season 진행 autumn→christmas', () => {
    const spec = parseSetArcSpec('Autumn to Christmas Playlist Pack');
    expect(spec).toEqual({ kind: 'season', from: 'autumn', to: 'christmas', sourceKo: expect.stringContaining('Autumn') });
  });

  it('한글 "아침에서 밤으로" -> time-of-day 진행', () => {
    const spec = parseSetArcSpec('아침에서 밤으로 흘러가는 하루');
    expect(spec?.kind).toBe('time-of-day');
    expect(spec?.from).toBe('morning');
    expect(spec?.to).toBe('night');
  });

  it('진행이 명시되지 않은 평범한 컨셉은 undefined — 억지로 아크를 지어내지 않는다', () => {
    expect(parseSetArcSpec('편안한 아침 올드팝')).toBeUndefined();
    expect(parseSetArcSpec('퇴근 후 감성 인디팝')).toBeUndefined();
  });

  it('빈 문자열은 undefined', () => {
    expect(parseSetArcSpec('')).toBeUndefined();
  });
});

describe('지시문 29 TASK B — checkSetArcAdherence', () => {
  const spec = { kind: 'season' as const, from: 'autumn', to: 'christmas', sourceKo: 'test' };

  it('실측 재현: 시작에 from 어휘, 끝에 to 어휘가 전혀 없으면 두 finding 모두 발생', () => {
    const songs = Array.from({ length: 18 }, (_, i) => song({ trackNo: i + 1, seasonMoment: 'a quiet evening at home' }));
    const result = checkSetArcAdherence(songs, spec);
    const kinds = result.findings.map(f => f.kind);
    expect(kinds).toContain('missing-from');
    expect(kinds).toContain('missing-to');
    expect(result.adherence).toBeLessThan(SET_ARC_ADHERENCE_BLOCKING_THRESHOLD);
  });

  it('1~3번에 autumn, 마지막 3곡에 christmas 어휘가 있으면 두 finding 모두 사라진다', () => {
    const songs = Array.from({ length: 18 }, (_, i) => song({ trackNo: i + 1, seasonMoment: 'a quiet evening' }));
    songs[0].seasonMoment = 'early autumn leaves falling';
    songs[15].seasonMoment = 'christmas tree lights glowing';
    songs[16].seasonMoment = 'christmas eve at home';
    songs[17].seasonMoment = 'christmas morning';
    const result = checkSetArcAdherence(songs, spec);
    expect(result.findings.find(f => f.kind === 'missing-from')).toBeUndefined();
    expect(result.findings.find(f => f.kind === 'missing-to')).toBeUndefined();
    expect(result.adherence).toBeGreaterThanOrEqual(SET_ARC_ADHERENCE_BLOCKING_THRESHOLD);
  });

  it('빈 세트는 adherence 0, finding 없음(차단 판단은 호출자 몫)', () => {
    expect(checkSetArcAdherence([], spec)).toEqual({ adherence: 0, findings: [] });
  });
});

describe('지시문 29 TASK B-2 — setArcAdherenceIsBlocking (senior-oldpop만 verified)', () => {
  it('senior-oldpop만 blocking', () => {
    expect(setArcAdherenceIsBlocking('senior-oldpop')).toBe(true);
  });

  it('나머지 워크스페이스는 전부 advisory — verified:false인 값으로 차단하지 않는다', () => {
    const others: Array<Parameters<typeof setArcAdherenceIsBlocking>[0]> = ['kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female', undefined];
    for (const ws of others) expect(setArcAdherenceIsBlocking(ws)).toBe(false);
  });
});
