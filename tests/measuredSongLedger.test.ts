import { describe, expect, it } from 'vitest';
import { promotionEligibility, recordMeasuredPack, type MeasuredSongLedger } from '../src/core/measuredSongLedger';

/**
 * 지시문 32 (§4) — promoteAfterMeasuredSongs(data/distinctChoicePolicy.ts)는
 * 값만 있고 실제로 채워지는 카운터가 없었다. 이 테스트는 그 카운터의 순수
 * 계산부(scripts/audit.ts --pack이 실제로 호출하는 함수)를 검증한다 — 실제
 * fs 누적은 scripts/audit.ts --pack을 실행해 measured-song-counts.json에
 * 반영되는지로 확인한다(유닛 테스트 범위 밖, 실측은 이 세션 자체에서 5개
 * 실제 팩으로 이미 확인함 — §5 보고 참고).
 */
describe('[지시문 32 §4] recordMeasuredPack', () => {
  it('첫 기록은 setCount 1, totalSongs = songCount', () => {
    const { ledger, alreadyRecorded } = recordMeasuredPack({}, 'kr-2030', '/a/pack1.json', 18, '2026-08-10T00:00:00Z');
    expect(alreadyRecorded).toBe(false);
    expect(ledger['kr-2030']).toEqual({
      totalSongs: 18, setCount: 1, measuredPackPaths: ['/a/pack1.json'], lastMeasuredAt: '2026-08-10T00:00:00Z'
    });
  });

  it('같은 workspace에 다른 pack 경로를 두 번 기록하면 누적된다', () => {
    const first = recordMeasuredPack({}, 'senior-oldpop', '/a/pack1.json', 18, '2026-08-09T00:00:00Z');
    const second = recordMeasuredPack(first.ledger, 'senior-oldpop', '/a/pack2.json', 18, '2026-08-10T00:00:00Z');
    expect(second.alreadyRecorded).toBe(false);
    expect(second.ledger['senior-oldpop']?.totalSongs).toBe(36);
    expect(second.ledger['senior-oldpop']?.setCount).toBe(2);
  });

  it('같은 pack 경로를 다시 기록하면 alreadyRecorded:true — 중복 집계하지 않는다 (같은 세트를 두 번 감사해도 두 번 세면 안 된다)', () => {
    const first = recordMeasuredPack({}, 'kr-kids', '/a/pack1.json', 18, '2026-08-10T00:00:00Z');
    const second = recordMeasuredPack(first.ledger, 'kr-kids', '/a/pack1.json', 18, '2026-08-11T00:00:00Z');
    expect(second.alreadyRecorded).toBe(true);
    expect(second.ledger['kr-kids']?.totalSongs).toBe(18);
    expect(second.ledger['kr-kids']?.setCount).toBe(1);
  });

  it('다른 workspace는 서로 독립적으로 누적된다', () => {
    const ledger: MeasuredSongLedger = {};
    const a = recordMeasuredPack(ledger, 'kr-2030', '/a.json', 18, '2026-08-10T00:00:00Z');
    const b = recordMeasuredPack(a.ledger, 'jp-2030', '/b.json', 18, '2026-08-10T00:00:00Z');
    expect(b.ledger['kr-2030']?.totalSongs).toBe(18);
    expect(b.ledger['jp-2030']?.totalSongs).toBe(18);
  });
});

describe('[지시문 32 §4] promotionEligibility — 표시만 한다, 절대 승격시키지 않는다', () => {
  it('measuredSongs가 임계값 미만이면 eligible:false', () => {
    const result = promotionEligibility({ totalSongs: 10, setCount: 1, measuredPackPaths: ['x'] }, 18);
    expect(result.eligible).toBe(false);
    expect(result.measuredSongs).toBe(10);
  });

  it('measuredSongs가 임계값 이상이면 eligible:true (승격 자체는 이 함수가 하지 않는다 — 리턴 타입에 verified 필드가 없음)', () => {
    const result = promotionEligibility({ totalSongs: 18, setCount: 1, measuredPackPaths: ['x'] }, 18);
    expect(result.eligible).toBe(true);
  });

  it('promoteAfterMeasuredSongs가 0(이미 verified인 워크스페이스)이면 절대 eligible:true가 되지 않는다 — 0을 "항상 충족"으로 오독하지 않는다', () => {
    const result = promotionEligibility({ totalSongs: 999, setCount: 50, measuredPackPaths: [] }, 0);
    expect(result.eligible).toBe(false);
  });

  it('entry가 undefined(아직 한 번도 측정 안 됨)면 measuredSongs 0, eligible:false', () => {
    const result = promotionEligibility(undefined, 18);
    expect(result.measuredSongs).toBe(0);
    expect(result.eligible).toBe(false);
  });
});
