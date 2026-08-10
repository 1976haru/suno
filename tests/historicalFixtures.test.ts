import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPackBlueprint } from '../scripts/audit';
import { runFullAudit } from '../src/core/fullAudit';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import type { LyricLanguage } from '../src/types';

/**
 * 지시문 33 (§4) — "과거 fixture 의 테스트 의미를 바꾼다: known-bad historical
 * fixture → 해당 오류를 정확히 발견하면 PASS." 지시문 32 §2가 tests/fixtures/
 * providerResponses/blocking/에 적용한 것과 정확히 같은 구조(EXPECTED_VIOLATIONS
 * 테이블 + "검출되면 통과" 단언) — 두 곳에 다른 구조를 만들지 않는다.
 *
 * 이 3개 파일(tests/fixtures/historical/)은 하루의 실제 20260807 발매 팩
 * (60s/70s)과 브릿지 임포트 실측 샘플이다 — 편집하지 않는다. 여기서 검출
 * 되는 위반은 "현재 생성기가 이 결함을 만든다"는 뜻이 아니라 "검사기가
 * 이 알려진 결함을 여전히 잡아낸다"는 뜻이다(§4-3). 현재 생성기 검증은
 * 하루가 새로 뽑는 세트로만 한다 — 이 파일과 절대 같은 표에 섞지 않는다.
 *
 * 값의 출처(실측): npx tsx scripts/_tmp_dump_warnings.ts (이 지시문 작업
 * 중 1회성 실행, 결과는 §5 보고에 원문으로 남긴다) — song.warnings를 3개
 * 파일 전부에 대해 직접 덤프해 아래 표를 만들었다. 지어낸 값이 아니다.
 */
const HISTORICAL_DIR = path.resolve(__dirname, 'fixtures', 'historical');

function loadHistorical(fileName: string, lyricLanguage: LyricLanguage = 'english') {
  const packPath = path.join(HISTORICAL_DIR, fileName);
  const loaded = loadPackBlueprint(packPath, undefined);
  if (loaded.blocked) throw new Error(`historical fixture blocked: ${loaded.reasons.join(', ')}`);
  const { blueprint, channel, conceptLabel } = loaded;
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
  const report = runFullAudit(blueprint.songs, {
    conceptLabel,
    songCount: blueprint.songs.length,
    audienceProfile,
    archetype: channel.archetype,
    lyricLanguage
  });
  return { blueprint, report };
}

describe('[지시문 33 §4] historical/20260807-60s.json — known-bad 검출', () => {
  const { blueprint, report } = loadHistorical('20260807-60s.json');

  it('dual-gender lead-vocal 선언(Prompt spec violation)이 실제로 검출된다', () => {
    const flagged = blueprint.songs.filter(s => s.warnings.some(w => w.includes('Prompt spec violation (vocal)') && w.includes('both male and female lead-vocal')));
    expect(flagged.length, 'dual-gender 선언이 최소 1곡에서 검출돼야 한다').toBeGreaterThan(0);
  });

  it('작곡 지시 유출(composition instruction leaked as sung content)이 T11에서 검출된다', () => {
    const t11 = blueprint.songs.find(s => s.trackNo === 11)!;
    expect(t11.warnings.some(w => w.includes('composition/performance instruction leaked as sung content'))).toBe(true);
  });

  it('era_prompt_other_pure(다른 시대 단독) 감사 항목이 실제로 미달로 검출된다', () => {
    const item = report.items.find(i => i.id === 'era_prompt_other_pure')!;
    expect(item, 'era_prompt_other_pure 항목이 감사 결과에 있어야 한다').toBeDefined();
    expect(item.status, `실측: ${item.actualKo}`).toBe('fail');
  });
});

describe('[지시문 33 §4] historical/20260807-70s.json — known-bad 검출', () => {
  const { blueprint, report } = loadHistorical('20260807-70s.json');

  it('dual-gender lead-vocal 선언이 실제로 검출된다', () => {
    const flagged = blueprint.songs.filter(s => s.warnings.some(w => w.includes('Prompt spec violation (vocal)') && w.includes('both male and female lead-vocal')));
    expect(flagged.length).toBeGreaterThan(0);
  });

  it('작곡 지시 유출이 T11에서 검출된다', () => {
    const t11 = blueprint.songs.find(s => s.trackNo === 11)!;
    expect(t11.warnings.some(w => w.includes('composition/performance instruction leaked as sung content'))).toBe(true);
  });

  it('era_prompt_other_pure 감사 항목이 실제로 미달로 검출된다', () => {
    const item = report.items.find(i => i.id === 'era_prompt_other_pure')!;
    expect(item.status, `실측: ${item.actualKo}`).toBe('fail');
  });
});

describe('[지시문 33 §4] historical/bridge-import-sample.json — known-bad 검출', () => {
  const { blueprint } = loadHistorical('bridge-import-sample.json');

  it('템포 서술과 BPM 모순(tempo-mood-contradiction)이 실제로 검출된다 — 지시문 32 §2가 다룬 것과 같은 유형', () => {
    const flagged = blueprint.songs.filter(s => s.warnings.some(w => w.includes('Tempo compliance') && w.includes('템포 서술과 BPM 모순')));
    expect(flagged.length, '"gentle" 텍스트와 BPM>100 모순이 최소 1곡에서 검출돼야 한다').toBeGreaterThan(0);
  });

  it('dual-gender lead-vocal 선언이 실제로 검출된다', () => {
    const flagged = blueprint.songs.filter(s => s.warnings.some(w => w.includes('Prompt spec violation (vocal)') && w.includes('both male and female lead-vocal')));
    expect(flagged.length).toBeGreaterThan(0);
  });
});
