import { describe, expect, it } from 'vitest';
import {
  buildCsvText,
  buildSetSummaryRow,
  buildTakeLedgerCsv,
  csvField,
  csvRow,
  SET_SUMMARY_HEADER,
  TAKE_LEDGER_HEADER,
  takeLedgerFileName,
  withUtf8Bom,
  type SetContext
} from '../src/core/csvExport';
import type { AudioTake } from '../src/core/audioTakes';
import type { RatingRecord } from '../src/core/ratingLedger';
import type { PlaylistBlueprint, SongIdea } from '../src/types';

// v3.79 (TASK D) — CSV primitive correctness (RFC 4180-ish quoting, BOM),
// header shape, and the take-ledger/set-summary row builders on hand-built
// fixtures (no IndexedDB needed — these are all pure functions).

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Song',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'la la la',
    stylePrompt: 'warm acoustic pop',
    lyrics: '[verse 1]\nline one\nline two\n\n[chorus]\nchorus line one\nchorus line two',
    youtube: { title: '', description: '', tags: [] },
    qualityScore: 80,
    warnings: [],
    songId: 'song-1',
    songCode: undefined,
    genreId: 'oldpop-brill-building',
    vocalType: 'male',
    bpm: 92,
    // v5.11 (TASK L) — always-populated on a real generated song; see
    // types.ts's SongIdea.effectiveMoneyChordId & co doc comments.
    effectiveMoneyChordId: 'default',
    effectiveVocalPresetId: 'warm-mature-male',
    effectiveGenreIds: ['oldpop-brill-building'],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

function makeBlueprint(overrides: Partial<PlaylistBlueprint> = {}): PlaylistBlueprint {
  return {
    projectTitle: 'Test Pack',
    channelName: 'Test Channel',
    oneLineConcept: '따뜻한 겨울 라디오',
    sonicSignature: '',
    vocalSignature: '',
    lyricRules: [],
    harmonyRules: [],
    visualRules: [],
    songs: [makeSong()],
    generatedAt: '2026-08-02T09:00:00.000Z',
    meta: { setCode: 'S20260802-01' },
    ...overrides
  };
}

function makeTake(overrides: Partial<AudioTake> = {}): AudioTake {
  return {
    takeId: 'take-1',
    songId: 'song-1',
    trackNo: 1,
    packId: 'Test Channel::Test Pack::1',
    fileName: 'T01.mp3',
    versionLabel: 'A',
    adopted: true,
    metrics: {
      fileName: 'T01.mp3',
      durationSec: 187.4,
      rmsCurve: [],
      peakPosition: 0.8,
      dynamicRange: 12,
      overallLevel: -14.2,
      spectralCentroid: 1800,
      lowBandRatio: 0.32,
      highBandRatio: 0.1,
      spectrumProfile: [],
      warnings: []
    },
    vocalMetrics: {
      vocalCentroid: 950,
      vocalLowRatio: 0.3,
      vocalMidRatio: 0.5,
      vocalHighRatio: 0.2,
      vocalProfile: [],
      registerHint: 'mid'
    },
    tempoEstimate: { bpm: 94, confidence: 0.6 },
    directives: {
      genreId: 'oldpop-brill-building',
      killingPointId: 'KP-01',
      arcPhase: 'peak',
      vocalType: 'male',
      vocalDescriptor: 'warm male tenor',
      targetBpm: 92,
      targetDurationSec: [180, 210],
      instrumentAtoms: []
    },
    analyzedAt: '2026-08-02T10:00:00.000Z',
    ...overrides
  };
}

function makeRating(overrides: Partial<RatingRecord> = {}): RatingRecord {
  return {
    songId: 'song-1',
    packId: 'Test Channel::Test Pack::1',
    rating: 'good',
    ratedAt: '2026-08-02T11:00:00.000Z',
    attributes: { genreId: 'oldpop-brill-building', bpm: 92, vocalType: 'male', channelId: 'ch-1' },
    ...overrides
  };
}

describe('[v3.79 TASK D] CSV primitives', () => {
  it('leaves a plain field unquoted', () => {
    expect(csvField('hello')).toBe('hello');
    expect(csvField(42)).toBe('42');
  });

  it('quotes a field containing a comma', () => {
    expect(csvField('좋음, 채택됨')).toBe('"좋음, 채택됨"');
  });

  it('quotes a field containing a double quote, doubling the quote itself', () => {
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('joins a row with commas and a CSV text with CRLF row separators', () => {
    const text = buildCsvText(['A', 'B'], [['1', '2'], ['3, x', '4']]);
    expect(text).toBe('A,B\r\n1,2\r\n"3, x",4');
  });

  it('csvRow quotes only the fields that need it', () => {
    expect(csvRow(['plain', 'has,comma', 3])).toBe('plain,"has,comma",3');
  });

  it('withUtf8Bom prepends exactly the U+FEFF BOM character', () => {
    const withBom = withUtf8Bom('A,B\r\n1,2');
    expect(withBom.charCodeAt(0)).toBe(0xfeff);
    expect(withBom.slice(1)).toBe('A,B\r\n1,2');
  });
});

describe('[v3.79 TASK D] take ledger CSV (Sheet 1)', () => {
  const ctx: SetContext = {
    blueprint: makeBlueprint(),
    channelName: 'Test Channel',
    customConcept: '따뜻한 겨울 라디오',
    workspaceId: 'senior-oldpop',
    savedAt: '2026-08-02T09:30:00.000Z'
  };

  it('header matches the spec\'s exact 28-column list (A~AB), plus v5.11\'s 4 appended "effective" columns', () => {
    expect(TAKE_LEDGER_HEADER).toEqual([
      '테이크코드', '세트코드', '트랙번호', '버전', '채택여부', '평가',
      '세트명', '컨셉', '워크스페이스', '제목', '훅', '장르ID', '시대버킷',
      '보컬타입', '보컬서술', '킬링포인트ID', '아크구간', '지시BPM', '실측BPM',
      '지시길이', '실측길이(초)', '진폭(dB)', '최대구간(1~10)', '믹스중심(Hz)',
      '저역비중(%)', '가사단어수', '섹션수', '분석일시',
      '실제머니코드ID', '실제보컬프리셋ID', '실제장르ID목록', '실제채널아키타입'
    ]);
    expect(TAKE_LEDGER_HEADER.length).toBe(32);
  });

  it('appends the 4 v5.11 "effective" columns after 분석일시, reading them straight off the song', () => {
    const take = makeTake();
    const csv = buildTakeLedgerCsv(ctx, [take], []);
    const cells = csv.split('\r\n')[1].split(',');
    expect(cells).toHaveLength(32);
    expect(cells[28]).toBe('default'); // 실제머니코드ID
    expect(cells[29]).toBe('warm-mature-male'); // 실제보컬프리셋ID
    expect(cells[30]).toBe('oldpop-brill-building'); // 실제장르ID목록
    expect(cells[31]).toBe('senior-morning'); // 실제채널아키타입
  });

  it('blanks the 4 v5.11 columns with \'-\' rather than throwing when a song predates them', () => {
    const legacyCtx: SetContext = {
      ...ctx,
      blueprint: makeBlueprint({
        songs: [makeSong({
          effectiveMoneyChordId: undefined as unknown as string,
          effectiveVocalPresetId: undefined,
          effectiveGenreIds: undefined as unknown as string[],
          effectiveArchetype: undefined as unknown as SongIdea['effectiveArchetype']
        })]
      })
    };
    const csv = buildTakeLedgerCsv(legacyCtx, [makeTake()], []);
    const cells = csv.split('\r\n')[1].split(',');
    expect(cells.slice(28)).toEqual(['-', '-', '-', '-']);
  });

  it('one row per take, joined to its song, with the spec\'s exact code shapes', () => {
    const take = makeTake();
    const csv = buildTakeLedgerCsv(ctx, [take], []);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2); // header + 1 row
    const cells = lines[1].split(',');
    expect(cells[0]).toBe('S20260802-01-T01-A'); // 테이크코드
    expect(cells[1]).toBe('S20260802-01'); // 세트코드
    expect(cells[2]).toBe('1'); // 트랙번호
    expect(cells[3]).toBe('A'); // 버전
    expect(cells[4]).toBe('Y'); // 채택여부 — take.adopted === true
    expect(cells[5]).toBe('미평가'); // 평가 — no matching rating passed in
  });

  it('reflects a real rating and a real adoption decision', () => {
    const adopted = makeTake({ takeId: 'take-1', versionLabel: 'A', adopted: true });
    const rejected = makeTake({ takeId: 'take-2', versionLabel: 'B', adopted: false });
    const csv = buildTakeLedgerCsv(ctx, [adopted, rejected], [makeRating()]);
    const rows = csv.split('\r\n').slice(1).map(line => line.split(','));
    const [adoptedRow, rejectedRow] = rows;
    expect(adoptedRow[4]).toBe('Y');
    expect(adoptedRow[5]).toBe('좋음');
    expect(rejectedRow[4]).toBe('N'); // a different take of the same song was adopted
  });

  it('maps male/female/mixed vocalType to 남/여/듀엣', () => {
    const male = buildTakeLedgerCsv(ctx, [makeTake({ directives: { ...makeTake().directives, vocalType: 'male' } })], []);
    const female = buildTakeLedgerCsv(ctx, [makeTake({ directives: { ...makeTake().directives, vocalType: 'female' } })], []);
    const mixed = buildTakeLedgerCsv(ctx, [makeTake({ directives: { ...makeTake().directives, vocalType: 'mixed' } })], []);
    expect(male.split('\r\n')[1].split(',')[13]).toBe('남');
    expect(female.split('\r\n')[1].split(',')[13]).toBe('여');
    expect(mixed.split('\r\n')[1].split(',')[13]).toBe('듀엣');
  });

  it('blanks 실측BPM when tempo confidence is below the 0.4 threshold, shows it when reliable', () => {
    const unreliable = makeTake({ tempoEstimate: { bpm: 94, confidence: 0.2 } });
    const reliable = makeTake({ tempoEstimate: { bpm: 94, confidence: 0.6 } });
    const csvUnreliable = buildTakeLedgerCsv(ctx, [unreliable], []);
    const csvReliable = buildTakeLedgerCsv(ctx, [reliable], []);
    expect(csvUnreliable.split('\r\n')[1].split(',')[18]).toBe('-');
    expect(csvReliable.split('\r\n')[1].split(',')[18]).toBe('94');
  });

  it('skips a take with no matching song rather than throwing', () => {
    const orphan = makeTake({ songId: 'no-such-song', trackNo: 99 });
    const csv = buildTakeLedgerCsv(ctx, [orphan], []);
    expect(csv.split('\r\n')).toHaveLength(1); // header only
  });

  it('returns a header-only CSV when the set has no assigned setCode yet', () => {
    const unsavedCtx: SetContext = { ...ctx, blueprint: makeBlueprint({ meta: undefined }) };
    const csv = buildTakeLedgerCsv(unsavedCtx, [makeTake()], []);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('take-ledger filename incorporates the set code', () => {
    expect(takeLedgerFileName('S20260802-01')).toBe('S20260802-01_테이크.csv');
  });
});

describe('[v3.79 TASK D] set summary row (Sheet 2)', () => {
  const ctx: SetContext = {
    blueprint: makeBlueprint(),
    channelName: 'Test Channel',
    customConcept: '따뜻한 겨울 라디오',
    workspaceId: 'senior-oldpop',
    savedAt: '2026-08-02T09:30:00.000Z'
  };

  it('header has the spec\'s exact 25 columns', () => {
    expect(SET_SUMMARY_HEADER.length).toBe(25);
    expect(SET_SUMMARY_HEADER[0]).toBe('세트코드');
    expect(SET_SUMMARY_HEADER[9]).toBe('관문1통과');
    expect(SET_SUMMARY_HEADER[24]).toBe('채택률');
  });

  it('gate1 (관문1) is always \'-\' — PreassignedSongSlot data is never persisted, so it is never guessed', () => {
    const row = buildSetSummaryRow(ctx, [makeTake()], [makeRating()]);
    expect(row).not.toBeNull();
    const gate1Index = SET_SUMMARY_HEADER.indexOf('관문1통과');
    expect(row!.cells[gate1Index]).toBe('-');
  });

  it('returns null for a set with no assigned setCode', () => {
    const unsavedCtx: SetContext = { ...ctx, blueprint: makeBlueprint({ meta: undefined }) };
    expect(buildSetSummaryRow(unsavedCtx, [], [])).toBeNull();
  });

  it('cells array length matches the header length', () => {
    const row = buildSetSummaryRow(ctx, [makeTake()], [makeRating()])!;
    expect(row.cells.length).toBe(SET_SUMMARY_HEADER.length);
  });

  it('computes 채택률/좋음비율 as percentages, and \'-\' when there is no data to divide by', () => {
    const rowWithData = buildSetSummaryRow(ctx, [makeTake({ adopted: true })], [makeRating({ rating: 'good' })])!;
    const goodRatioIndex = SET_SUMMARY_HEADER.indexOf('좋음비율');
    const adoptionRateIndex = SET_SUMMARY_HEADER.indexOf('채택률');
    expect(rowWithData.cells[goodRatioIndex]).toBe('100%');
    expect(rowWithData.cells[adoptionRateIndex]).toBe('100%');

    const rowNoData = buildSetSummaryRow(ctx, [], [])!;
    expect(rowNoData.cells[goodRatioIndex]).toBe('-');
    expect(rowNoData.cells[adoptionRateIndex]).toBe('-');
  });
});
