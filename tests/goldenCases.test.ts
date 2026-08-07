import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GOLDEN_CASES } from '../src/data/goldenCases';
import { loadPackBlueprint, computeCross } from '../scripts/audit';
import { deriveEraIntent, checkEraPromptAgainstIntent } from '../src/core/eraIntent';
import { duetPartDistributionIssue } from '../src/core/lyricsAst';
import { checkJpKidsKanaRatio } from '../src/core/jpKidsPolicy';
import { computeSlotPlanOverlap } from '../src/core/slotPlanOverlap';

/**
 * 지시문 11 (TASK E) — golden case 회귀 잠금. src/data/goldenCases.ts의
 * 각 `status: 'verified'` 케이스를 실제 체커로 재현한다. "원문 전체가 아니라
 * 문제 문장과 예상 severity만 저장한다"는 원칙에 따라, 재현 가능한 케이스는
 * 이미 저장소에 있는 실제 fixture(tests/fixtures/realPack60s.json 등)를
 * 그대로 참조하거나, 최소한의 합성 재현 입력만 인라인으로 쓴다.
 */
const FIXTURE_60S = path.resolve(__dirname, 'fixtures/realPack60s.json');
const FIXTURE_70S = path.resolve(__dirname, 'fixtures/realPack70s.json');

describe('지시문 11 TASK E — golden case 등록', () => {
  it('6개 이상 등록됐다', () => {
    expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(6);
  });

  it('모든 케이스는 severity·checkerRef·symptomKo를 실제로 채워 뒀다 (빈 값 없음)', () => {
    for (const c of GOLDEN_CASES) {
      expect(c.symptomKo.trim().length).toBeGreaterThan(0);
      expect(c.checkerRef.trim().length).toBeGreaterThan(0);
      expect(['blocking', 'advisory']).toContain(c.severity);
    }
  });
});

describe('지시문 11 TASK E-1 — senior-cross-set-same-song (blocking으로 재현)', () => {
  it('실제 팩 fixture로 재현: trackNo 위치 기반 중복이 blocking 수준이다', () => {
    const a = loadPackBlueprint(FIXTURE_60S, undefined);
    const b = loadPackBlueprint(FIXTURE_70S, undefined);
    if (a.blocked || b.blocked) throw new Error('fixture blocked');

    const cross = computeCross(a.blueprint.songs, b.blueprint.songs);
    expect(cross.themeDupSameTrackCount).toBeGreaterThanOrEqual(14);
    expect(cross.situationDupSameTrackCount).toBeGreaterThanOrEqual(10);
    expect(cross.titleDupTrackNos.length).toBeGreaterThan(0);
    expect(cross.hookDupTrackNos.length).toBeGreaterThan(0);

    const overlap = computeSlotPlanOverlap(
      a.blueprint.songs.map(s => ({ trackNo: s.trackNo, lyricTheme: s.lyricTheme, situation: s.listenerSituation })),
      b.blueprint.songs.map(s => ({ situation: s.listenerSituation, packId: 'B', trackNo: s.trackNo, lyricTheme: s.lyricTheme }))
    );
    expect(overlap.verdict).toBe('block');
  });
});

describe('지시문 11 TASK E-2 — senior-era-drift (blocking으로 재현)', () => {
  it('실제 60년대 팩 fixture로 재현: primary share가 목표(78%) 아래이거나 다른 시대 단독 트랙이 있다', () => {
    const a = loadPackBlueprint(FIXTURE_60S, undefined);
    if (a.blocked) throw new Error('fixture blocked');
    const intent = deriveEraIntent('60년대 올드팝 명곡')!;
    const result = checkEraPromptAgainstIntent(a.blueprint.songs, intent);
    expect(result.primaryBelowTarget || result.blockingOtherEraPureTrackNos.length > 0).toBe(true);
  });
});

describe('지시문 11 TASK E-2 — senior-exclude-uniform (blocking으로 재현)', () => {
  it('실제 팩 원문의 excludePrompt가 사실상 단일 값이다 (고유값 <= 2/18)', () => {
    const rawText = fs.readFileSync(FIXTURE_60S, 'utf-8');
    const parsed = JSON.parse(rawText) as { songs: { excludePrompt?: string }[] };
    const uniqueCount = new Set(parsed.songs.map(s => s.excludePrompt)).size;
    expect(uniqueCount).toBeLessThanOrEqual(2);
  });
});

describe('지시문 11 TASK E-2 — kpop-gender-part (blocking으로 재현)', () => {
  it('duet인데 모든 섹션이 같은 vocalist(또는 없음)이면 blocking 메시지를 낸다', () => {
    const sections = [
      { rawTag: 'Verse 1', type: 'verse' as const, vocalist: 'male vocal', lines: ['line'] },
      { rawTag: 'Chorus', type: 'chorus' as const, vocalist: 'male vocal', lines: ['line'] }
    ];
    const issue = duetPartDistributionIssue(sections, 'duet');
    expect(issue).toBeDefined();
  });

  it('실제로 분배된 duet(서로 다른 vocalist 2개 이상)은 통과한다', () => {
    const sections = [
      { rawTag: 'Verse 1', type: 'verse' as const, vocalist: 'male vocal', lines: ['line'] },
      { rawTag: 'Chorus', type: 'chorus' as const, vocalist: 'female vocal', lines: ['line'] }
    ];
    expect(duetPartDistributionIssue(sections, 'duet')).toBeUndefined();
  });
});

describe('지시문 11 TASK E-2 — jp-language (blocking으로 재현)', () => {
  it('한자 위주 텍스트는 kids-t1 가나 하한선 아래로 판정된다', () => {
    // 최소 합성 재현 — 원문 저장 대신 증상만 재현하는 짧은 예시 (한자 비중이 매우 높은 문장).
    const kanjiHeavyLyrics = '本日晴天散歩公園友達運動元気笑顔太陽空気水分補給重要安全確認';
    const result = checkJpKidsKanaRatio(kanjiHeavyLyrics, 'kids-t1');
    expect(result.belowFloor).toBe(true);
  });
});
