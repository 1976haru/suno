import { describe, expect, it } from 'vitest';
import { findLyricMetaLeaks, lyricMetaLeakWarning } from '../src/core/lyricMetaLeak';
import { COMPOSITION_META_SUBJECT_WORDS_EN } from '../src/data/compositionMetaVocabulary';
import pack from './fixtures/distinctChoice20260808Pack.json';

/**
 * 지시문 17 (TASK A, 필수 검증) — "허용 예문 7종과 정상 golden case 5종이
 * 오탐 나지 않는지"가 "T8 실제로 잡히는지"보다 중요하다는 지시문 자신의
 * 우선순위(§D-2)를 그대로 반영한다. 실제 20260808 팩(tests/fixtures/
 * distinctChoice20260808Pack.json)으로 T8 검출과 T4·T5·T7·T13·T17 무오탐을
 * 둘 다 같은 fixture에서 확인한다.
 */

interface RawPackSong {
  trackNo: number;
  lyrics: string;
}

const REAL_SONGS = (pack as { songs: RawPackSong[] }).songs;

describe('[지시문 17 TASK A-1] COMPOSITION_META_SUBJECT_WORDS_EN — 17종 이상', () => {
  it('어휘가 17종 이상으로 확장됐다(기존 5종 + 신규 13종)', () => {
    expect(COMPOSITION_META_SUBJECT_WORDS_EN.length).toBeGreaterThanOrEqual(17);
  });
});

describe('[지시문 17 TASK A-4 인수 기준] 실제 20260808 팩 — T8 검출', () => {
  it('T8 "One borrowed chord colours the whole refrain"이 blocking으로 검출된다', () => {
    const findings = findLyricMetaLeaks(REAL_SONGS, 'english');
    const t8 = findings.filter(f => f.trackNo === 8);
    expect(t8.length).toBeGreaterThan(0);
    expect(t8[0].line).toContain('colours the whole refrain');
    expect(t8[0].severity).toBe('blocking');
  });

  it('실제 팩 18곡 전체에서 이 검사기가 낸 finding은 T8 하나뿐이다(과탐 없음)', () => {
    const findings = findLyricMetaLeaks(REAL_SONGS, 'english');
    expect(findings.map(f => f.trackNo)).toEqual([8]);
  });
});

describe('[지시문 17 TASK A-4 인수 기준, §D-2 3번] 하루가 좋다고 판정한 5곡은 절대 걸리지 않는다', () => {
  it.each([4, 5, 7, 13, 17])('T%i은 findLyricMetaLeaks에 걸리지 않는다', trackNo => {
    const song = REAL_SONGS.find(s => s.trackNo === trackNo)!;
    const findings = findLyricMetaLeaks([song], 'english');
    expect(findings, `T${trackNo} 오탐: ${JSON.stringify(findings)}`).toEqual([]);
  });
});

describe('[지시문 17 TASK A-2, §D-2 2번] 허용 예문 7종 — 오탐 0건', () => {
  const ENGLISH_ALLOW_EXAMPLES = [
    'our song on the radio',
    'a note in your letter',
    'we danced to that old refrain',
    'a chord of memory',
    'the beat of your heart',
    'harmony between us'
  ];

  it.each(ENGLISH_ALLOW_EXAMPLES)('영어 허용 예문 "%s"는 오탐이 없다', line => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: `[verse 1]\n${line}` }], 'english');
    expect(findings, `오탐: ${JSON.stringify(findings)}`).toEqual([]);
  });

  it('한국어 허용 예문 "그대 목소리의 멜로디를 기억해"는 오탐이 없다', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\n그대 목소리의 멜로디를 기억해' }], 'korean');
    expect(findings, `오탐: ${JSON.stringify(findings)}`).toEqual([]);
  });
});

describe('[지시문 17 TASK A-3] severity — 영어는 항상 blocking, 한국어·일본어는 advisory', () => {
  it('영어 유출(주어-동사 인접 매치)은 severity: blocking이다', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\nThe hook comes home again tonight' }], 'english');
    expect(findings[0].severity).toBe('blocking');
  });

  it('영어 지시어구 매치(key change 등)도 severity: blocking이다', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: 'Key change on the final chorus tonight' }], 'english');
    expect(findings[0].severity).toBe('blocking');
  });

  it('한국어 유출은 severity: advisory다(실측 없어 아직 blocking으로 시작하지 않는다)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\n후렴이 올라가면서 마음도 벅차올라' }], 'korean');
    expect(findings[0].severity).toBe('advisory');
  });

  it('일본어 유출은 severity: advisory다', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\nさあサビを上げていこう' }], 'japanese');
    expect(findings[0].severity).toBe('advisory');
  });

  it('bilingual 곡에서 영어 줄은 blocking, 한국어 줄은 advisory로 각각 판정된다(줄 단위 판정)', () => {
    const findings = findLyricMetaLeaks(
      [{ trackNo: 1, lyrics: '[verse 1]\nThe hook comes home again\n[chorus]\n후렴이 올라가면서 마음도 벅차올라' }],
      'bilingual'
    );
    expect(findings).toHaveLength(2);
    const enFinding = findings.find(f => f.line.includes('hook comes home'))!;
    const koFinding = findings.find(f => f.line.includes('후렴'))!;
    expect(enFinding.severity).toBe('blocking');
    expect(koFinding.severity).toBe('advisory');
  });

  it('lyricMetaLeakWarning 문자열에 severity 태그가 표시된다', () => {
    const blockingWarning = lyricMetaLeakWarning('[chorus]\nThe hook comes home again', 3, 'english');
    expect(blockingWarning).toContain('[blocking]');
    const advisoryWarning = lyricMetaLeakWarning('[chorus]\n후렴이 올라가면서 마음도 벅차올라', 3, 'korean');
    expect(advisoryWarning).toContain('[advisory]');
  });
});
