import { describe, expect, it } from 'vitest';
import { reconcileWithPreassignedSlot, preallocateSongSlots } from '../src/core/batchPreallocation';
import { importSongsJson } from '../src/core/claudeCodeBridge';
import { recommendVocalPlan } from '../src/core/vocalRecommender';
import { buildGenreRotationPlan } from '../src/core/genreRotation';
import { makeOptions, testGenres, testMoods, testSeason, channelPresets } from './fixtures';
import type { GenerationOptions, PreassignedSongSlot, SongIdea } from '../src/types';

/**
 * 지시문 26 TASK C — "슬롯이 만들었는데 팩에 안 남는" 결함 클래스의 재발
 * 방지 테스트. TASK A에서 실측으로 확인한 것: reconcileWithPreassignedSlot에
 * *두 개*의 서로 다른 return 경로가 있고(§completeFields fast path / 메인
 * path), 필드 하나가 한쪽에만 복사돼도 그 경로를 타는 실제 응답에서는
 * 여전히 유실된다 — "완전히 순응한 LLM 응답"이 바로 fast path를 타는
 * 조건이라 드문 경우가 아니다. 이 테스트는 PreassignedSongSlot이 소유한
 * 필드마다 *두 경로 모두*에서 SongIdea로 넘어가는지 확인한다.
 *
 * 지시문 24 TASK C의 13축 계약 감사와 같은 발상 — 그건 "사용자가 명시
 * 선택한 값", 이건 "앱이 슬롯에 배정한 값". 둘 다 "입력은 있는데 소비가
 * 안 된다"는 같은 결함 모양이다.
 */

function buildFullSlot(): PreassignedSongSlot {
  return {
    trackNo: 5,
    title: 'Slot Title',
    hookPhrase: 'Hold On Tonight',
    songRole: 'flagship',
    tempo: 92,
    emotionArc: 'warm-rise',
    moneyChordText: 'I-V-vi-IV progression - warm downbeat cadence lift',
    genreId: 'oldpop-doowop-harmony',
    genreText: 'classic doo-wop pop',
    signatureSound: 'close four-part backing harmony',
    hookDeviceText: 'call-and-answer hook shape',
    introTextureText: 'warm string ensemble swell intro',
    vocalType: 'female',
    vocalText: 'female soft head-voice lead',
    vocalVariantText: 'female soft head-voice lead, close-mic intimate',
    vocalGender: 'female',
    instrumentSet: ['upright bass', 'brushed snare'],
    arrangementDensity: 'medium',
    structureTemplate: 'T2',
    lyricTheme: 'seaside-reunion',
    lyricThemeText: 'reuniting on a quiet boardwalk at dusk',
    lyricThemeArc: 'longing-to-relief',
    lyricFrameId: 'boardwalk-reunion',
    lyricThemeMotionKo: '해질녘 방파제를 걷는다',
    lyricThemeCastKo: '오랜 연인',
    lyricThemeEraSettingKo: '1960년대 여름 해변',
    vocabularyBankId: 'oldpop-seaside',
    pov: 'firstPerson',
    verseStyle: 'narrative',
    verseStyleText: 'plainspoken storytelling verses',
    chorusStyle: 'hookRepeat',
    chorusStyleText: 'repeated hook-forward chorus',
    moneyChordId: 'progression-1',
    hookDeviceId: 'call-response',
    introTextureId: 'warm-strings',
    effectiveMoneyChordId: 'progression-1',
    effectiveVocalPresetId: 'female-soft-head-voice',
    // 지시문 50 (TASK D-3) — effectiveVocalPresetId 바로 옆 슬롯-소유
    // 스냅샷 필드. 지시문49가 만들고 지시문50이 실측한 것: 이 필드
    // 자체가 SLOT_OWNED_FIELDS 표에 없어 왕복 끊김을 검사하지 못하고
    // 있었다 — 20260813 팩이 vocal 필드 0개였던 실제 결함과 같은 유형.
    vocalPresetSource: 'plan',
    effectiveGenreIds: ['oldpop-doowop-harmony'],
    killingPointText: 'half-step key lift in final chorus',
    killingPointPlacement: 'final-chorus',
    killingPointId: 'KP-08',
    eraTag: '1950s-60s',
    arcPhase: 'climax',
    intensity: 5,
    peakStrength: 'strong',
    perceivedEnergy: 4,
    perceivedEnergyReasonKo: '92 BPM, medium density — 활기 있는 편',
    earwormText: 'na-na-na hook motif',
    // 지시문 37 (TASK A-5) — killingPointText와 같은 유형: 앱이 배정한
    // 값이며, 26에서 반복됐던 "슬롯에는 있는데 팩에 안 남는" 결함을 여기서
    // 재발 방지 표에 추가한다.
    partPlan: {
      memberCount: 4,
      members: [
        { memberId: 'A', role: 'main-vocal', gender: 'female' },
        { memberId: 'B', role: 'lead-vocal', gender: 'female' },
        { memberId: 'C', role: 'main-rapper', gender: 'female' },
        { memberId: 'D', role: 'sub-vocal', gender: 'female' }
      ],
      sectionAssignments: [
        { section: 'Verse 1', memberIds: ['A', 'B'], role: 'sub-vocal' },
        { section: 'Chorus', memberIds: ['all'], role: 'all' },
        { section: 'Verse 2', memberIds: ['C', 'D'], role: 'main-rapper' },
        { section: 'Chorus', memberIds: ['all'], role: 'all' },
        { section: 'Final Chorus', memberIds: ['all'], role: 'all' }
      ]
    },
    // 지시문 37 (TASK B) — moneyChordText와 같은 슬롯-소유 스냅샷 필드.
    sectionStyleShifts: [
      { section: 'Verse', styleAtoms: ['laid-back R&B groove', 'sparse arrangement'] },
      { section: 'Chorus', styleAtoms: ['EDM-influenced drop', 'dense synth stack'] }
    ]
  };
}

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 5,
    title: 'Provider Title',
    seasonMoment: 'summer dusk',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On Tonight',
    stylePrompt: 'placeholder',
    lyrics: '[verse 1]\nline one\nline two\n[chorus]\nHold On Tonight\nHold On Tonight\n[end]',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
    qualityScore: 0,
    warnings: [],
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    ...overrides
  };
}

const slot = buildFullSlot();

// completeFields fast path (batchPreallocation.ts): every locked verbatim
// value already present in stylePrompt (case-insensitive substring) AND
// stylePrompt contains "{tempo} BPM" AND stylePrompt doesn't START WITH the
// vocal text. This is exactly what a fully-compliant provider response
// looks like — not a rare/synthetic edge case.
const completeStylePrompt = [
  slot.genreText, '1950s-60s', `${slot.tempo} BPM`, slot.vocalText,
  slot.moneyChordText, slot.signatureSound, slot.hookDeviceText, slot.introTextureText,
  ...(slot.instrumentSet ?? [])
].join(', ');
const fastPathSong = baseSong({ stylePrompt: `Doo-Wop Close Harmony, ${completeStylePrompt}` });

// Deliberately sparse — missing several locked verbatim values, so
// completeFields is false and the main return path runs instead.
const mainPathSong = baseSong({ stylePrompt: `Doo-Wop Close Harmony, 1950s-60s, ${slot.tempo} BPM, some other description` });

/**
 * 슬롯이 소유하고("...song" 스프레드만으로는 안 옮겨지는) SongIdea에도
 * 존재하는 필드들 — 두 경로 모두에서 반드시 살아남아야 한다. lyrics
 * 내용 재작성(applyDuetSectionVocalTags 등)이나 listenerSituation/
 * emotionArc의 fallback 로직처럼 "필드 복사"가 아니라 "내용 변형"인
 * 것들은 이 표에서 제외한다(§지시문 26 TASK C의 "필드 왕복" 범위 밖).
 */
const SLOT_OWNED_FIELDS: { field: keyof SongIdea; expected: unknown }[] = [
  { field: 'songRole', expected: slot.songRole },
  { field: 'lyricTheme', expected: slot.lyricTheme },
  { field: 'genreId', expected: slot.genreId },
  { field: 'genreText', expected: slot.genreText },
  { field: 'signatureSound', expected: slot.signatureSound },
  { field: 'lyricThemeText', expected: slot.lyricThemeText },
  { field: 'lyricThemeArc', expected: slot.lyricThemeArc },
  { field: 'pov', expected: slot.pov },
  { field: 'verseStyle', expected: slot.verseStyle },
  { field: 'verseStyleText', expected: slot.verseStyleText },
  { field: 'chorusStyle', expected: slot.chorusStyle },
  { field: 'chorusStyleText', expected: slot.chorusStyleText },
  { field: 'vocalType', expected: slot.vocalType },
  // 지시문 56 (TASK A-4/B-3) — 실측: vocalText/vocalVariantText/vocalGender가
  // 이 표에 없어서(=검사 배선이 없어서) 두 return 경로 모두에서 유실되고
  // 있었다 — 발라드 세트 15/15 vocalText='' 회귀와 같은 결함.
  { field: 'vocalText', expected: slot.vocalText },
  { field: 'vocalVariantText', expected: slot.vocalVariantText },
  { field: 'vocalGender', expected: slot.vocalGender },
  { field: 'eraTag', expected: slot.eraTag },
  { field: 'killingPointText', expected: slot.killingPointText },
  { field: 'killingPointPlacement', expected: slot.killingPointPlacement },
  { field: 'killingPointId', expected: slot.killingPointId },
  // 지시문 29 (TASK D-3) — 실측: 저장된 팩에 이 필드 자체가 없었다.
  // killingPointText/arcPhase와 똑같은 결함 모양(slot에는 항상 있는
  // 필드가 song 객체로는 복사된 적이 없음) — 같은 표에 추가해 재발을 막는다.
  { field: 'moneyChordText', expected: slot.moneyChordText },
  { field: 'partPlan', expected: slot.partPlan },
  { field: 'sectionStyleShifts', expected: slot.sectionStyleShifts },
  { field: 'arcPhase', expected: slot.arcPhase },
  { field: 'intensity', expected: slot.intensity },
  { field: 'peakStrength', expected: slot.peakStrength },
  { field: 'perceivedEnergy', expected: slot.perceivedEnergy },
  { field: 'perceivedEnergyReasonKo', expected: slot.perceivedEnergyReasonKo },
  { field: 'bpm', expected: slot.tempo },
  { field: 'structureTemplate', expected: slot.structureTemplate },
  { field: 'moneyChordId', expected: slot.moneyChordId },
  { field: 'earwormText', expected: slot.earwormText },
  { field: 'lyricFrameId', expected: slot.lyricFrameId },
  { field: 'lyricThemeMotionKo', expected: slot.lyricThemeMotionKo },
  { field: 'lyricThemeCastKo', expected: slot.lyricThemeCastKo },
  { field: 'lyricThemeEraSettingKo', expected: slot.lyricThemeEraSettingKo },
  { field: 'effectiveMoneyChordId', expected: slot.effectiveMoneyChordId },
  { field: 'effectiveGenreIds', expected: slot.effectiveGenreIds },
  { field: 'effectiveVocalPresetId', expected: slot.effectiveVocalPresetId },
  // 지시문 50 (TASK D-3) — effectiveVocalPresetId 옆의 새 슬롯 필드
  // (지시문49). 이 표에 추가되지 않았던 것 자체가 "만들었는데 검증
  // 배선이 없다" 유형이었다.
  { field: 'vocalPresetSource', expected: slot.vocalPresetSource }
];

describe('지시문 26 TASK C — 슬롯 소유 필드 왕복: reconcileWithPreassignedSlot의 두 return 경로 모두에서 유실 없음', () => {
  it('실제로 completeFields fast path를 탄다 (전제 검증 — 이 테스트 자체가 fast path를 실측하고 있는지 확인)', () => {
    const fast = reconcileWithPreassignedSlot(fastPathSong, slot);
    const main = reconcileWithPreassignedSlot(mainPathSong, slot);
    // fast path는 stylePrompt를 손대지 않고 그대로 통과시킨다(normalizeProviderStylePrompt를
    // 거치지 않음) — main path는 mergeAtom을 거쳐 최소 tempo/genre 등이
    // 정규화된다. 두 stylePrompt가 서로 다른 처리(정규화 여부)를 거쳤는지로
    // 어느 경로를 탔는지 간접 확인한다.
    expect(fast.stylePrompt).toBe(fastPathSong.stylePrompt);
    expect(main.stylePrompt).not.toBe(mainPathSong.stylePrompt);
  });

  for (const { field, expected } of SLOT_OWNED_FIELDS) {
    it(`${field}: fast path에서도 살아남는다`, () => {
      const result = reconcileWithPreassignedSlot(fastPathSong, slot);
      expect(result[field], `fast path lost slot-owned field "${field}"`).toEqual(expected);
    });

    it(`${field}: main path에서도 살아남는다`, () => {
      const result = reconcileWithPreassignedSlot(mainPathSong, slot);
      expect(result[field], `main path lost slot-owned field "${field}"`).toEqual(expected);
    });
  }

  it('전수 점검표 — 필드별 fast/main 경로 생존 여부 (원문 출력, TASK C-2)', () => {
    const fast = reconcileWithPreassignedSlot(fastPathSong, slot);
    const main = reconcileWithPreassignedSlot(mainPathSong, slot);
    const rows = SLOT_OWNED_FIELDS.map(({ field, expected }) => {
      const fastOk = JSON.stringify(fast[field]) === JSON.stringify(expected);
      const mainOk = JSON.stringify(main[field]) === JSON.stringify(expected);
      return { field, fastOk, mainOk };
    });
    console.log('\n필드                          fast  main');
    console.log('─'.repeat(40));
    for (const row of rows) {
      console.log(`${row.field.padEnd(28)} ${row.fastOk ? ' O  ' : ' X  '} ${row.mainOk ? ' O ' : ' X '}`);
    }
    const broken = rows.filter(r => !r.fastOk || !r.mainOk);
    console.log(`\n왕복 끊긴 필드: ${broken.length}개 (${broken.map(r => r.field).join(', ') || '없음'})`);
    expect(broken.length).toBe(0);
  });
});

/**
 * 지시문 50 (TASK D-3) — 위 describe는 reconcileWithPreassignedSlot을
 * 직접 호출해 "슬롯이 있을 때" 필드 왕복을 검사한다. 이 블록은 한 단계
 * 더 넓은 경로 — 실제 가져오기 진입점(importSongsJson, bridgeImport.ts)
 * 까지 포함한 생성·전달·복원·감사 4단계와, 위 블록이 다루지 않는 "슬롯이
 * 없는 독립 가져오기" 시나리오(지시문49/50 세션처럼 앱의 live
 * preassignedSongs 상태를 공유하지 않는 별도 세션에서 만든 파일을 나중에
 * 가져오는 경우)를 검사한다. 20260813 팩이 vocal 필드 0개였던 실제 결함이
 * 바로 이 경로(슬롯 없음)에서 나왔다 — noSlotEffectiveFields는
 * effectiveVocalPresetId/vocalPresetSource를 건드리지 않으므로(그 함수
 * 자기 주석 참고), 에이전트가 자기 응답에 그 값을 되돌려줬을 때만
 * 살아남는다 — songOutputShape(promptComposer.ts)/normalizeImportedSong
 * (bridgeImport.ts) 배선이 바로 지시문50 TASK D-2가 고친 부분이다.
 */
function buildOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  return makeOptions({ channel, songCount: 15, genreIds: channel.preferredGenres, moodIds: channel.preferredMoods, ...overrides });
}

function realSlots(opts: GenerationOptions): PreassignedSongSlot[] {
  const preview = recommendVocalPlan({
    channelArchetype: opts.channel.archetype,
    songCount: opts.songCount,
    vocalQuota: { male: 5, female: 5, mixed: 5 },
    seed: 1,
    genrePlan: buildGenreRotationPlan(opts.genreIds, opts.songCount, 1)
  });
  const optsWithPlan = { ...opts, vocalPresetPlan: preview.map(rec => rec.presetId) };
  return preallocateSongSlots(optsWithPlan, testGenres);
}

/** Minimal agent response containing only the 4 fields importSongsJson actually requires — deliberately omits every pass-through/optional field so the test proves slot-side restoration, not agent cooperation. */
function bareResponseJson(slots: PreassignedSongSlot[]): string {
  return JSON.stringify({
    songs: slots.map(slotItem => ({
      trackNo: slotItem.trackNo,
      title: `Bare Title ${slotItem.trackNo}`,
      hookPhrase: slotItem.hookPhrase || `Bare Hook ${slotItem.trackNo}`,
      stylePrompt: `placeholder style text ${slotItem.trackNo}`,
      lyrics: `[chorus]\n${slotItem.hookPhrase || 'placeholder hook'}\n${slotItem.hookPhrase || 'placeholder hook'}`
    }))
  });
}

/** Agent response that DOES echo back the pass-through fields (as songOutputShape now asks for), for the no-slot standalone-import scenario. */
function echoingResponseJson(slots: PreassignedSongSlot[]): string {
  return JSON.stringify({
    songs: slots.map(slotItem => ({
      trackNo: slotItem.trackNo,
      title: `Echo Title ${slotItem.trackNo}`,
      hookPhrase: slotItem.hookPhrase || `Echo Hook ${slotItem.trackNo}`,
      stylePrompt: `placeholder style text ${slotItem.trackNo}`,
      lyrics: `[chorus]\n${slotItem.hookPhrase || 'placeholder hook'}\n${slotItem.hookPhrase || 'placeholder hook'}`,
      ...(slotItem.genreId ? { genreId: slotItem.genreId } : {}),
      ...(slotItem.lyricTheme ? { lyricTheme: slotItem.lyricTheme } : {}),
      ...(slotItem.pov ? { pov: slotItem.pov } : {}),
      ...(slotItem.effectiveVocalPresetId ? { effectiveVocalPresetId: slotItem.effectiveVocalPresetId } : {}),
      ...(slotItem.vocalPresetSource ? { vocalPresetSource: slotItem.vocalPresetSource } : {})
    }))
  });
}

describe('[지시문 50 TASK D-3] slotFieldRoundTrip — importSongsJson까지 포함한 4단계 왕복', () => {
  it('슬롯이 있으면, 에이전트가 최소 필드만 돌려줘도 슬롯의 주요 필드가 최종 팩에 남는다', () => {
    const opts = buildOpts();
    const slots = realSlots(opts);
    expect(slots.some(s => s.effectiveVocalPresetId)).toBe(true);
    expect(slots.some(s => s.vocalPresetSource === 'plan')).toBe(true);

    const report = importSongsJson(bareResponseJson(slots), opts, testGenres, testMoods, testSeason, slots, [], []);
    expect(report.blueprint).not.toBeNull();
    const songs = report.blueprint!.songs;
    expect(songs).toHaveLength(slots.length);

    const brokenFields: string[] = [];
    for (const s of slots) {
      const song = songs.find(x => x.trackNo === s.trackNo)!;
      const check = (label: string, slotVal: unknown, songVal: unknown) => {
        if (slotVal !== undefined && slotVal !== '' && songVal !== slotVal) brokenFields.push(`T${s.trackNo}.${label}: slot=${JSON.stringify(slotVal)} song=${JSON.stringify(songVal)}`);
      };
      check('genreId', s.genreId, song.genreId);
      check('effectiveVocalPresetId', s.effectiveVocalPresetId, song.effectiveVocalPresetId);
      check('vocalPresetSource', s.vocalPresetSource, song.vocalPresetSource);
      check('structureTemplate', s.structureTemplate, song.structureTemplate);
      check('bpm', s.tempo, song.bpm);
    }
    expect(brokenFields).toEqual([]);
  });

  it('슬롯이 없는 독립 가져오기에서도, 에이전트가 되돌려준 vocal 필드는 살아남는다 (지시문 50 TASK D-2 배선)', () => {
    const opts = buildOpts();
    const slots = realSlots(opts);
    expect(slots.some(s => s.effectiveVocalPresetId)).toBe(true);

    const report = importSongsJson(echoingResponseJson(slots), opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    const songs = report.blueprint!.songs;

    const brokenFields: string[] = [];
    for (const s of slots) {
      if (!s.effectiveVocalPresetId) continue;
      const song = songs.find(x => x.trackNo === s.trackNo)!;
      if (song.effectiveVocalPresetId !== s.effectiveVocalPresetId) brokenFields.push(`T${s.trackNo}.effectiveVocalPresetId: slot=${s.effectiveVocalPresetId} song=${song.effectiveVocalPresetId}`);
      if (s.vocalPresetSource && song.vocalPresetSource !== s.vocalPresetSource) brokenFields.push(`T${s.trackNo}.vocalPresetSource: slot=${s.vocalPresetSource} song=${song.vocalPresetSource}`);
    }
    expect(brokenFields).toEqual([]);
  });

  it('20260813 팩 유형 회귀: vocalPresetPlan이 적용된 세트를 슬롯 없이 가져와도 vocal 필드가 0개가 되지 않는다', () => {
    const opts = buildOpts();
    const slots = realSlots(opts);
    const report = importSongsJson(echoingResponseJson(slots), opts, testGenres, testMoods, testSeason, [], [], []);
    const songsWithVocalField = (report.blueprint?.songs ?? []).filter(s => s.effectiveVocalPresetId);
    expect(songsWithVocalField.length).toBeGreaterThan(0);
  });
});
