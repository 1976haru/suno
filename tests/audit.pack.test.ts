import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadPackBlueprint, computeCross } from '../scripts/audit';

/**
 * 지시문 09 (TASK B-5) — "하루가 실제로 뽑은 두 팩" 인수 fixture. 하루가
 * 2026-08-06T22:26:56Z에 실제로 생성한 두 팩(bridgeImport.ts의 실제 발매
 * 경로를 통과한 진짜 출력)을 tests/fixtures/에 고정해 두고, --cross의
 * 대조 로직이 지시문 자신이 명시한 정확한 수치를 재현하는지 검증한다.
 * "재현되지 않으면 대조 로직이 틀린 것이다" — 이 테스트가 그 재현을
 * 회귀 잠금한다.
 */
const FIXTURE_60S = path.resolve(__dirname, 'fixtures/realPack60s.json');
const FIXTURE_70S = path.resolve(__dirname, 'fixtures/realPack70s.json');

describe('지시문 09 TASK B-5 — 실제 팩 인수 fixture', () => {
  it('두 실제 팩 모두 --pack 경로(importSongsJson)를 통과해 정상 로드된다', () => {
    const a = loadPackBlueprint(FIXTURE_60S, undefined);
    const b = loadPackBlueprint(FIXTURE_70S, undefined);
    expect(a.blocked).toBe(false);
    expect(b.blocked).toBe(false);
    if (a.blocked || b.blocked) return;
    expect(a.blueprint.songs).toHaveLength(18);
    expect(b.blueprint.songs).toHaveLength(18);
    expect(a.conceptLabel).toBe('60년대 올드팝 명곡');
    expect(b.conceptLabel).toBe('70년대 올드팝 명곡');
  });

  it('채점 후 qualityScore가 스키마 플레이스홀더(0)가 아니라 실측값이다', () => {
    const a = loadPackBlueprint(FIXTURE_60S, undefined);
    if (a.blocked) throw new Error('fixture blocked');
    for (const song of a.blueprint.songs) {
      expect(song.qualityScore).toBeGreaterThan(0);
    }
  });

  it('--cross가 지시문 09 §B-5에 명시된 정확한 수치를 재현한다', () => {
    const a = loadPackBlueprint(FIXTURE_60S, undefined);
    const b = loadPackBlueprint(FIXTURE_70S, undefined);
    if (a.blocked || b.blocked) throw new Error('fixture blocked');

    const result = computeCross(a.blueprint.songs, b.blueprint.songs);

    expect(result.titleDupTrackNos).toEqual([1, 14, 15]);
    expect(result.hookDupTrackNos).toEqual([1, 4, 9, 14, 15]);
    expect(result.situationDupAnyCount).toBe(14);
    expect(result.situationDupSameTrackCount).toBe(14);
    expect(result.themeDupAnyCount).toBe(18);
    expect(result.themeDupSameTrackCount).toBe(18);
    expect(result.exactSentenceMatchCount).toBe(8);
    expect(result.openingSixWordDupCount).toBe(2);
  });

  it('60년대 팩 단독 실측: stylePrompt 길이가 지시문 명시 범위(538~690자)와 일치한다', () => {
    const a = loadPackBlueprint(FIXTURE_60S, undefined);
    if (a.blocked) throw new Error('fixture blocked');
    const lens = a.blueprint.songs.map(s => s.stylePrompt.length);
    expect(Math.min(...lens)).toBe(538);
    expect(Math.max(...lens)).toBe(690);
  });

  it('세트 내 도입부(첫 6단어)는 각 팩 내에서 18/18 고유하다 (회귀 방지 목록)', () => {
    for (const fixture of [FIXTURE_60S, FIXTURE_70S]) {
      const loaded = loadPackBlueprint(fixture, undefined);
      if (loaded.blocked) throw new Error('fixture blocked');
      const openings = loaded.blueprint.songs.map(s => {
        const firstLine = s.lyrics.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('['));
        return (firstLine ?? '').split(/\s+/).slice(0, 6).join(' ').toLowerCase();
      });
      expect(new Set(openings).size).toBe(openings.length);
    }
  });

  /**
   * 지시문 10 (TASK F) — real bug found while measuring TASK C against a
   * fresh pack: loadPackBlueprint used to call importSongsJson with
   * preassignedSongs defaulted to `[]` (and a first fix attempt passed a
   * value into the wrong positional argument — `moods`, not
   * `preassignedSongs` — since importSongsJson's real signature is
   * (rawText, opts, genres, moods, season, preassignedSongs, ...), not
   * (..., genres, preassignedSongs, season) as first assumed). Either bug
   * meant core/batchPreallocation.ts's reconcileWithPreassignedSlot could
   * never find a matching slot for ANY track loaded via --pack, so TASK C's
   * excludePrompt genre-differentiation append (and TASK D's
   * normalizeProviderStylePrompt) never actually ran — the audit tool could
   * never verify its own fixes. buildShadowSlotsFromRawSongs (built from the
   * file's own real genreId/tempo, reusing extractRawImportedSongs — not a
   * second parser) closes this. This is measured against the REAL fixture,
   * not a synthetic case — 1/18 unique before this fix, 4/18 after (still
   * not 18/18, since the fixture only spans 4 distinct genres and this
   * append is deliberately additive-only, never a claim of full uniqueness
   * — see batchPreallocation.ts's own excludePrompt computation doc comment).
   */
  it('--pack 로딩이 실제 슬롯과 재조정되어 excludePrompt 장르별 차별화가 작동한다 (1/18 -> 4/18)', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const uniqueCount = new Set(loaded.blueprint.songs.map(s => s.excludePrompt)).size;
    expect(uniqueCount).toBeGreaterThan(1);
    expect(uniqueCount).toBe(4);
  });
});
