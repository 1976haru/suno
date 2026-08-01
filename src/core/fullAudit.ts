import type { AudienceProfile, SongIdea } from '../types';
import { descriptorCount, lyricWordAndSectionCounts, vocalZoneDistributionWarnings } from './compositionScorer';
import { findArrangementVocabularyInLyrics } from './lyricVocabularyGuard';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { findExcessiveVocabularyRepetition, findHookWordOveruse, topWordFrequencies } from './lyricVocabularyRepetition';
import { lintInPackStyleSimilarity } from './diversityLinter';
import { eraBucketForGenreId, ERA_FORBIDDEN_DESCRIPTORS } from '../data/eraExclusions';
import { classifyTitleShape } from './titleShapeVariety';
import { detectVocalGender } from './vocalPlan';
import { MALE_VOCAL_TRAIT_AXES, FEMALE_VOCAL_TRAIT_AXES } from '../data/vocalTraits';
import { auditPromises, auditTitleConceptConsistency, type PromiseAuditReport, type TitleConsistencyReport } from './promiseAudit';
import type { AudioSetReport } from './audioSetReport';

/**
 * v3.76 (TASK B) — "정합성 전수 검사": every check this app's own task
 * documents (v3.58 through v3.76) have separately asked for, run together
 * in one pass instead of scattered across one-off scripts/tests. This
 * module is pure measurement — it imports checks that already exist
 * elsewhere (compositionScorer.ts, lyricVocabularyGuard.ts, diversityLinter.ts,
 * ...) rather than reimplementing them, per this task's own "검사 항목을
 * 임의로 줄이지 말 것" and "lyricEngine.ts / 프롬프트 조립 / 채점 층을 수정하지
 * 말 것" — nothing here changes what a song generates, only what gets
 * measured about it afterward.
 */

export type AuditStatus = 'pass' | 'fail' | 'not-measured';

export interface AuditItem {
  id: string;
  category: '생성 구조' | '보컬' | '프롬프트' | '가사' | '킬링포인트·아크' | '제목' | '약속 이행도' | '워크스페이스';
  labelKo: string;
  targetKo: string;
  actualKo: string;
  status: AuditStatus;
  /** True when this item can only be measured from a rendered mp3 (v3.73/v3.74's audio pipeline) — absent audio data, it's always 'not-measured', never 'fail'. */
  requiresAudio: boolean;
  /** True when this app has no existing check for this yet — reported honestly rather than faked (this task's own §9 "미구현 항목은 명시적으로 미구현이라고 적을 것"). */
  notImplemented?: boolean;
  /** Which past task first asked for this check, and any later task that re-asked for it — TASK D's own "지시문끼리 모순되거나 근본 원인을 못 잡은 것" signal. */
  specifiedBy: string[];
}

export interface FullAuditReport {
  conceptLabel: string;
  songCount: number;
  items: AuditItem[];
  promiseAudit: PromiseAuditReport;
  titleConsistency: TitleConsistencyReport;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function longestRun<T>(items: readonly T[]): number {
  let longest = 1;
  let current = 1;
  for (let i = 1; i < items.length; i++) {
    current = items[i] === items[i - 1] ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return items.length ? longest : 0;
}

function item(
  partial: Omit<AuditItem, 'status'> & { pass: boolean | null }
): AuditItem {
  const { pass, ...rest } = partial;
  return { ...rest, status: pass === null ? 'not-measured' : pass ? 'pass' : 'fail' };
}

// ---------------------------------------------------------------------------
// [생성 구조]
// ---------------------------------------------------------------------------
function structureItems(songs: SongIdea[], expectedSongCount: number, audienceProfile: AudienceProfile): AuditItem[] {
  const genreCounts = new Map<string, number>();
  for (const song of songs) {
    if (!song.genreId) continue;
    genreCounts.set(song.genreId, (genreCounts.get(song.genreId) ?? 0) + 1);
  }
  const genreIds = songs.map(song => song.genreId ?? '(none)');
  const bpms = songs.map(song => song.bpm).filter((bpm): bpm is number => typeof bpm === 'number');

  return [
    item({
      id: 'song_count', category: '생성 구조', labelKo: '곡 수',
      targetKo: `${expectedSongCount}곡`, actualKo: `${songs.length}곡`,
      pass: songs.length === expectedSongCount, requiresAudio: false, specifiedBy: ['v3.63']
    }),
    item({
      id: 'genre_variety', category: '생성 구조', labelKo: '장르 종류',
      targetKo: '4~9종', actualKo: `${genreCounts.size}종`,
      pass: genreCounts.size >= 4 && genreCounts.size <= 9, requiresAudio: false, specifiedBy: ['v3.49A']
    }),
    item({
      id: 'genre_max5', category: '생성 구조', labelKo: '같은 장르 최대 곡수',
      targetKo: '≤ 5곡', actualKo: `${Math.max(0, ...genreCounts.values())}곡`,
      pass: [...genreCounts.values()].every(count => count <= 5), requiresAudio: false, specifiedBy: ['v3.63']
    }),
    item({
      id: 'genre_no_singleton', category: '생성 구조', labelKo: '1곡짜리 장르',
      targetKo: '0개', actualKo: `${[...genreCounts.values()].filter(count => count === 1).length}개`,
      pass: [...genreCounts.values()].every(count => count !== 1), requiresAudio: false, specifiedBy: ['v3.63']
    }),
    item({
      id: 'genre_no_triple_run', category: '생성 구조', labelKo: '같은 장르 연속',
      targetKo: '≤ 2곡', actualKo: `${longestRun(genreIds)}곡`,
      pass: longestRun(genreIds) <= 2, requiresAudio: false, specifiedBy: ['genreRotation']
    }),
    item({
      id: 'bpm_stddev', category: '생성 구조', labelKo: 'BPM 표준편차',
      targetKo: '≥ 8', actualKo: stddev(bpms).toFixed(1),
      pass: bpms.length ? stddev(bpms) >= 8 : null, requiresAudio: false, specifiedBy: ['v3.58 TASK 4', 'v3.64 TASK C']
    }),
    item({
      id: 'bpm_in_range', category: '생성 구조', labelKo: 'BPM 범위',
      targetKo: `${audienceProfile.tempoFloor}~${audienceProfile.tempoCeiling}`, actualKo: bpms.length ? `${Math.min(...bpms)}~${Math.max(...bpms)}` : '(없음)',
      pass: bpms.length ? bpms.every(bpm => bpm >= audienceProfile.tempoFloor && bpm <= audienceProfile.tempoCeiling) : null,
      requiresAudio: false, specifiedBy: ['audienceProfiles']
    })
  ];
}

// ---------------------------------------------------------------------------
// [보컬]
// ---------------------------------------------------------------------------
function vocalItems(songs: SongIdea[]): AuditItem[] {
  const vocalTypes = songs.map(song => song.vocalType).filter((type): type is 'male' | 'female' | 'mixed' => Boolean(type));
  const counts: Record<string, number> = {};
  for (const type of vocalTypes) counts[type] = (counts[type] ?? 0) + 1;
  const lowShare = songs.length ? Math.floor(songs.length * 0.25) : 0;
  const highShare = songs.length ? Math.ceil(songs.length * 0.42) : 0;
  const distributionOk = vocalTypes.length
    ? Object.values(counts).every(count => count >= lowShare && count <= highShare)
    : null;

  const zoneWarnings = vocalZoneDistributionWarnings(songs);
  const registerPool = [...MALE_VOCAL_TRAIT_AXES.register, ...FEMALE_VOCAL_TRAIT_AXES.register];
  const distinctVocalDescriptors = new Set(
    songs.flatMap(song => registerPool.filter(register => song.stylePrompt.toLowerCase().includes(register.toLowerCase())))
  );

  const femaleSongs = songs.filter(song => song.vocalType === 'female');
  const femaleMissingGenderWord = femaleSongs.filter(song => detectVocalGender(song.stylePrompt) !== 'female');

  return [
    item({
      id: 'vocal_distribution', category: '보컬', labelKo: '보컬 타입 배분',
      targetKo: `각 ${lowShare}~${highShare}곡`, actualKo: JSON.stringify(counts),
      pass: distributionOk, requiresAudio: false, specifiedBy: ['v3.72 TASK A']
    }),
    item({
      id: 'vocal_zone_max3', category: '보컬', labelKo: '구간별 같은 보컬 타입',
      targetKo: '≤ 3곡', actualKo: zoneWarnings.length ? `${zoneWarnings.length}건 초과 구간` : '0건',
      pass: songs.length >= 6 ? zoneWarnings.length === 0 : null, requiresAudio: false, specifiedBy: ['v3.75 TASK C']
    }),
    item({
      id: 'vocal_no_triple_run', category: '보컬', labelKo: '같은 보컬 타입 연속',
      targetKo: '≤ 2곡', actualKo: `${longestRun(vocalTypes)}곡`,
      pass: vocalTypes.length ? longestRun(vocalTypes) <= 2 : null, requiresAudio: false, specifiedBy: ['v3.64-B', 'v3.72 TASK A']
    }),
    item({
      id: 'vocal_desc_present', category: '보컬', labelKo: '보컬 서술 누락',
      targetKo: '0곡', actualKo: `${songs.filter(song => !song.vocalType).length}곡`,
      pass: songs.every(song => Boolean(song.vocalType)), requiresAudio: false, specifiedBy: ['v3.72 TASK A']
    }),
    item({
      id: 'female_gender_explicit', category: '보컬', labelKo: '여성 곡의 female 명시',
      targetKo: '100%', actualKo: femaleSongs.length ? `${Math.round((1 - femaleMissingGenderWord.length / femaleSongs.length) * 100)}%` : '(여성 곡 없음)',
      pass: femaleSongs.length ? femaleMissingGenderWord.length === 0 : null, requiresAudio: false, specifiedBy: ['v3.75 TASK C']
    }),
    item({
      id: 'vocal_desc_variety', category: '보컬', labelKo: '보컬 서술 종류',
      targetKo: '≥ 12', actualKo: `${distinctVocalDescriptors.size}`,
      pass: distinctVocalDescriptors.size >= 12, requiresAudio: false, specifiedBy: ['v3.72 TASK B']
    })
  ];
}

// ---------------------------------------------------------------------------
// [프롬프트]
// ---------------------------------------------------------------------------
const LABEL_LEAK_PATTERN = /^\s*(Money chords?|Killing point|Hook device|Arrangement density|Intro texture)\s*:/im;

function promptItems(songs: SongIdea[]): AuditItem[] {
  const lengths = songs.map(song => song.stylePrompt.length);
  const descriptorCounts = songs.map(song => descriptorCount(song.stylePrompt));
  const similarity = lintInPackStyleSimilarity(songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  const eraViolations = songs.filter(song => {
    const bucket = eraBucketForGenreId(song.genreId);
    if (!bucket) return false;
    const forbidden = ERA_FORBIDDEN_DESCRIPTORS[bucket];
    const lower = song.stylePrompt.toLowerCase();
    return forbidden.some(term => lower.includes(term));
  });
  const labelLeaks = songs.filter(song => LABEL_LEAK_PATTERN.test(song.stylePrompt) || LABEL_LEAK_PATTERN.test(song.lyrics));
  const artistLeaks = songs.filter(song =>
    findArtistReferenceLeaks(song.stylePrompt).length > 0
    || findArtistReferenceLeaks(song.lyrics).length > 0
    || findArtistReferenceLeaks(`${song.youtube?.title ?? ''} ${song.youtube?.description ?? ''}`).length > 0
  );
  const durationDuplicates = songs.filter(song => {
    const match = song.stylePrompt.match(/\d:\d{2}-\d:\d{2}/g);
    return match && match.length > 1;
  });

  return [
    item({
      id: 'prompt_length', category: '프롬프트', labelKo: '프롬프트 길이',
      targetKo: '350~650자', actualKo: lengths.length ? `${Math.min(...lengths)}~${Math.max(...lengths)}자` : '(없음)',
      pass: lengths.length ? lengths.every(length => length >= 350 && length <= 650) : null, requiresAudio: false, specifiedBy: ['v3.56']
    }),
    item({
      id: 'descriptor_count', category: '프롬프트', labelKo: '서술어 개수',
      targetKo: '15~25', actualKo: descriptorCounts.length ? `${Math.min(...descriptorCounts)}~${Math.max(...descriptorCounts)}` : '(없음)',
      pass: descriptorCounts.length ? descriptorCounts.every(count => count >= 15 && count <= 25) : null, requiresAudio: false, specifiedBy: ['v3.62 TASK 2-2']
    }),
    item({
      id: 'shared_atoms', category: '프롬프트', labelKo: '공유 원자',
      targetKo: '≤ 5개', actualKo: `${similarity.sharedAtomCount}개`,
      pass: similarity.sharedAtomCount <= 5, requiresAudio: false, specifiedBy: ['v3.58 TASK 1']
    }),
    item({
      id: 'era_contradiction', category: '프롬프트', labelKo: '시대 모순 서술어',
      targetKo: '0건', actualKo: `${eraViolations.length}건`,
      pass: eraViolations.length === 0, requiresAudio: false, specifiedBy: ['v3.62 TASK 2-2']
    }),
    item({
      id: 'label_leak', category: '프롬프트', labelKo: '라벨 잔존',
      targetKo: '0건', actualKo: `${labelLeaks.length}건`,
      pass: labelLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.62 TASK 1']
    }),
    item({
      id: 'artist_leak', category: '프롬프트', labelKo: '아티스트명 누출',
      targetKo: '0건', actualKo: `${artistLeaks.length}건`,
      pass: artistLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.58 TASK 3']
    }),
    item({
      id: 'duration_dup', category: '프롬프트', labelKo: 'duration 중복',
      targetKo: '0건', actualKo: `${durationDuplicates.length}건`,
      pass: durationDuplicates.length === 0, requiresAudio: false, specifiedBy: ['v3.59 TASK D-2']
    })
  ];
}

// ---------------------------------------------------------------------------
// [가사]
// ---------------------------------------------------------------------------
const PLACEHOLDER_PATTERN = /\[PLACEHOLDER\]|\bTODO\b|lorem ipsum|\{\{.*?\}\}/i;
const END_TAG_PATTERN = /\[\s*(end|outro)\s*\]/i;

function lyricsItems(songs: SongIdea[]): AuditItem[] {
  const counts = songs.map(song => lyricWordAndSectionCounts(song.lyrics));
  const words = counts.map(c => c.words);
  const sections = counts.map(c => c.sections);
  const situations = new Set(songs.map(song => song.listenerSituation));
  const emotionArcs = new Set(songs.map(song => song.emotionArc));
  const arrangementLeaks = findArrangementVocabularyInLyrics(songs);
  const titleLineLeaks = songs.filter(song => /^\s*Title\s*:/im.test(song.lyrics));
  const placeholderLeaks = songs.filter(song => PLACEHOLDER_PATTERN.test(song.lyrics));
  const endTagLeaks = songs.filter(song => END_TAG_PATTERN.test(song.lyrics));
  const vocabRepetition = findExcessiveVocabularyRepetition(songs);
  const maxWordRepeat = topWordFrequencies(songs, 1)[0]?.count ?? 0;
  const hookOveruse = findHookWordOveruse(songs);

  return [
    item({
      id: 'lyric_word_count', category: '가사', labelKo: '가사 단어수',
      targetKo: '215~230', actualKo: words.length ? `${Math.min(...words)}~${Math.max(...words)}` : '(없음)',
      pass: words.length ? words.every(count => count >= 215 && count <= 230) : null, requiresAudio: false, specifiedBy: ['v3.29', 'v3.70 TASK B', 'v3.75 TASK A']
    }),
    item({
      id: 'section_count', category: '가사', labelKo: '섹션 수',
      targetKo: '7~8', actualKo: sections.length ? `${Math.min(...sections)}~${Math.max(...sections)}` : '(없음)',
      pass: sections.length ? sections.every(count => count >= 7 && count <= 8) : null, requiresAudio: false, specifiedBy: ['v3.70 TASK B']
    }),
    item({
      id: 'situation_all_distinct', category: '가사', labelKo: '상황 종류',
      targetKo: `= ${songs.length}곡 (전부 다름)`, actualKo: `${situations.size}종`,
      pass: situations.size === songs.length, requiresAudio: false, specifiedBy: ['v3.64 TASK A']
    }),
    item({
      id: 'emotion_arc_variety', category: '가사', labelKo: '감정 아크 종류',
      targetKo: '≥ 8', actualKo: `${emotionArcs.size}종`,
      pass: emotionArcs.size >= 8, requiresAudio: false, specifiedBy: ['v3.67 TASK D']
    }),
    item({
      id: 'arrangement_vocab_leak', category: '가사', labelKo: '편곡 어휘 가사 누출',
      targetKo: '0곡', actualKo: `${new Set(arrangementLeaks.map(f => f.trackNo)).size}곡`,
      pass: arrangementLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.60 TASK A']
    }),
    item({
      id: 'title_line_leak', category: '가사', labelKo: 'Title: 첫줄 잔존',
      targetKo: '0곡', actualKo: `${titleLineLeaks.length}곡`,
      pass: titleLineLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.5x Title 제거']
    }),
    item({
      id: 'placeholder_leak', category: '가사', labelKo: '자리표시자',
      targetKo: '0곡', actualKo: `${placeholderLeaks.length}곡`,
      pass: placeholderLeaks.length === 0, requiresAudio: false, specifiedBy: ['lyricPlaceholderLeak.test.ts']
    }),
    item({
      id: 'grammar_article_errors', category: '가사', labelKo: '관사·복수 오류',
      targetKo: '0건', actualKo: '(검사 없음)',
      pass: null, requiresAudio: false, notImplemented: true, specifiedBy: []
    }),
    item({
      id: 'intro_leak', category: '가사', labelKo: '[intro] 아래 문장 (introMode 대조)',
      targetKo: '위반 0곡', actualKo: '(SongIdea에 introMode가 없어 재검사 불가)',
      pass: null, requiresAudio: false, notImplemented: true, specifiedBy: ['v3.64 TASK B']
    }),
    item({
      id: 'end_tag_leak', category: '가사', labelKo: '[end] 태그 잔존',
      targetKo: '0곡', actualKo: `${endTagLeaks.length}곡`,
      pass: endTagLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.70/v3.71']
    }),
    item({
      id: 'vocab_repeat_max20', category: '가사', labelKo: '어휘 최대 반복',
      targetKo: '≤ 20회', actualKo: `${maxWordRepeat}회`,
      pass: maxWordRepeat <= 20, requiresAudio: false, specifiedBy: ['v3.64 TASK A-4', 'v3.75 TASK D']
    }),
    item({
      id: 'hook_word_overuse', category: '가사', labelKo: '훅 반복 단어',
      targetKo: '≤ 2개 훅', actualKo: hookOveruse.length ? hookOveruse.map(f => `${f.word}(${f.hookCount})`).join(', ') : '없음',
      pass: hookOveruse.length === 0, requiresAudio: false, specifiedBy: ['v4.2 TASK D-2'],
      notImplemented: false
    }),
    ...(vocabRepetition.length ? [item({
      id: 'vocab_repeat_advisory', category: '가사', labelKo: '어휘 반복 (advisory, 12회 기준)',
      targetKo: '≤ 12회', actualKo: vocabRepetition.slice(0, 5).map(f => `${f.word}(${f.count})`).join(', '),
      pass: null, requiresAudio: false, specifiedBy: ['v3.64 TASK A-4']
    })] : [])
  ];
}

// ---------------------------------------------------------------------------
// [킬링포인트·아크]
// ---------------------------------------------------------------------------
function killingPointItems(songs: SongIdea[]): AuditItem[] {
  const withKillingPoint = songs.filter(song => song.killingPointId);
  const distinctKillingPoints = new Set(withKillingPoint.map(song => song.killingPointId));
  const arcPhases = new Set(songs.map(song => song.arcPhase).filter(Boolean));
  const targetAssignedShare = songs.length ? Math.round(songs.length * (14 / 18)) : 0;
  const targetVarietyShare = songs.length ? Math.max(1, Math.round(songs.length * (9 / 18))) : 0;
  const targetNoneShare = songs.length ? Math.round(songs.length * (4 / 18)) : 0;

  return [
    item({
      id: 'killing_point_assigned', category: '킬링포인트·아크', labelKo: '킬링포인트 배정',
      targetKo: `약 ${targetAssignedShare}/${songs.length}`, actualKo: `${withKillingPoint.length}/${songs.length}`,
      pass: songs.length ? Math.abs(withKillingPoint.length - targetAssignedShare) <= 2 : null, requiresAudio: false, specifiedBy: ['v3.67 TASK A']
    }),
    item({
      id: 'killing_point_variety', category: '킬링포인트·아크', labelKo: '킬링포인트 종류',
      targetKo: `≥ ${targetVarietyShare}`, actualKo: `${distinctKillingPoints.size}`,
      pass: distinctKillingPoints.size >= targetVarietyShare, requiresAudio: false, specifiedBy: ['v3.67 TASK A']
    }),
    item({
      id: 'arc_phase_all_used', category: '킬링포인트·아크', labelKo: '아크 5구간 사용',
      targetKo: '5종 전부', actualKo: `${arcPhases.size}종`,
      pass: songs.length >= 5 ? arcPhases.size === 5 : null, requiresAudio: false, specifiedBy: ['v3.67 TASK C']
    }),
    item({
      id: 'peak_none_count', category: '킬링포인트·아크', labelKo: 'peakStrength none 곡',
      targetKo: `약 ${targetNoneShare}곡`, actualKo: `${songs.length - withKillingPoint.length}곡`,
      pass: songs.length ? Math.abs((songs.length - withKillingPoint.length) - targetNoneShare) <= 2 : null, requiresAudio: false, specifiedBy: ['v3.67 arcPlan']
    })
  ];
}

// ---------------------------------------------------------------------------
// [제목]
// ---------------------------------------------------------------------------
function titleItems(songs: SongIdea[], titleConsistency: TitleConsistencyReport): AuditItem[] {
  const shapeCounts = new Map<string, number>();
  for (const song of songs) {
    const shape = classifyTitleShape(song.title);
    if (!shape) continue;
    shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
  }
  return [
    item({
      id: 'title_pattern_variety', category: '제목', labelKo: '제목 패턴 종류',
      targetKo: '≥ 4', actualKo: `${shapeCounts.size}`,
      pass: shapeCounts.size >= 4, requiresAudio: false, specifiedBy: ['v4.2 TASK C']
    }),
    item({
      id: 'title_pattern_max4', category: '제목', labelKo: '같은 패턴 최대 곡수',
      targetKo: '≤ 4곡', actualKo: `${Math.max(0, ...shapeCounts.values())}곡`,
      pass: [...shapeCounts.values()].every(count => count <= 4), requiresAudio: false, specifiedBy: ['v4.2 TASK C']
    }),
    item({
      id: 'hook_connected_title', category: '제목', labelKo: '훅 연결 제목',
      targetKo: '≥ 6곡', actualKo: `${titleConsistency.hookConnectedCount}곡`,
      pass: titleConsistency.hookConnectedCount >= 6, requiresAudio: false, specifiedBy: ['v3.75 TASK D-3', 'v3.76 TASK A']
    })
  ];
}

// ---------------------------------------------------------------------------
// [약속 이행도] / [워크스페이스]
// ---------------------------------------------------------------------------
function promiseItems(promiseAudit: PromiseAuditReport): AuditItem[] {
  return [
    item({
      id: 'promise_fulfillment', category: '약속 이행도', labelKo: '약속 이행도 종합',
      targetKo: '≥ 70%', actualKo: `${Math.round(promiseAudit.overallFulfillment * 100)}%`,
      pass: promiseAudit.promises.length ? promiseAudit.overallFulfillment >= 0.7 : null,
      requiresAudio: false, specifiedBy: ['v3.76 TASK A']
    }),
    ...promiseAudit.promises.map(result => item({
      id: `promise_${result.promise.id}`, category: '약속 이행도', labelKo: `[${result.promise.kind}] ${result.promise.labelKo}`,
      targetKo: '개별 기준(§2-3)', actualKo: `${Math.round(result.fulfillment * 100)}%`,
      pass: null, requiresAudio: false, specifiedBy: ['v3.76 TASK A']
    }))
  ];
}

// ---------------------------------------------------------------------------
// [음원] — only ever measurable with a real rendered mp3 (v3.73/v3.74's
// browser-side audio analysis, core/audioSetReport.ts). Always
// 'not-measured' when no AudioSetReport is supplied — never 'fail', per
// this task's own "음원이 없으면... 실패로 처리하지 마십시오".
// ---------------------------------------------------------------------------
function audioItems(audioReport: AudioSetReport | undefined): AuditItem[] {
  if (!audioReport || !audioReport.analyzedCount) {
    return [
      item({
        id: 'real_duration_range', category: '가사', labelKo: '수노 실측 길이',
        targetKo: '3:15~3:35 (오디언스 프로파일)', actualKo: '(음원 미제공)',
        pass: null, requiresAudio: true, specifiedBy: ['v3.75 TASK A']
      }),
      item({
        id: 'killing_point_amplitude', category: '킬링포인트·아크', labelKo: '킬링포인트 곡 진폭',
        targetKo: '≥ 6dB', actualKo: '(음원 미제공)',
        pass: null, requiresAudio: true, specifiedBy: ['v3.75 TASK B']
      })
    ];
  }
  const underOrOver = audioReport.duration.overTarget.length + audioReport.duration.underTarget.length;
  return [
    item({
      id: 'real_duration_range', category: '가사', labelKo: '수노 실측 길이',
      targetKo: `${audioReport.duration.targetRange[0]}~${audioReport.duration.targetRange[1]}초`,
      actualKo: `${Object.keys(audioReport.duration.values).length}곡 분석, 목표 이탈 ${underOrOver}곡`,
      pass: underOrOver === 0, requiresAudio: true, specifiedBy: ['v3.75 TASK A']
    }),
    item({
      id: 'killing_point_amplitude', category: '킬링포인트·아크', labelKo: '킬링포인트 곡 진폭',
      targetKo: '≥ 6dB', actualKo: `진폭 부족 ${audioReport.killingPoint.weakDynamicTracks.length}곡`,
      pass: audioReport.killingPoint.weakDynamicTracks.length === 0, requiresAudio: true, specifiedBy: ['v3.75 TASK B']
    })
  ];
}

function workspaceItems(): AuditItem[] {
  return [
    item({
      id: 'workspace_isolation', category: '워크스페이스', labelKo: '워크스페이스 격리',
      targetKo: '다른 워크스페이스 데이터 0건', actualKo: '(메모리 상의 팩에는 해당 없음 — 저장된 라이브러리 전체를 대상으로만 검사 가능)',
      pass: null, requiresAudio: false, notImplemented: true, specifiedBy: ['A1', 'A2']
    })
  ];
}

/**
 * v3.76 (TASK B) — the one entry point: given an already-generated pack,
 * runs every check this app's task history has asked for, in one pass.
 * Pure — no IndexedDB, no fetch, no file I/O (scripts/audit.ts's CLI wraps
 * this with generation + baseline I/O).
 */
export function runFullAudit(
  songs: SongIdea[],
  opts: { conceptLabel: string; songCount: number; audienceProfile: AudienceProfile; audioReport?: AudioSetReport }
): FullAuditReport {
  const promiseAuditReport = auditPromises(songs, opts.conceptLabel);
  const titleConsistency = auditTitleConceptConsistency(songs);
  const items = [
    ...structureItems(songs, opts.songCount, opts.audienceProfile),
    ...vocalItems(songs),
    ...promptItems(songs),
    ...lyricsItems(songs),
    ...killingPointItems(songs),
    ...audioItems(opts.audioReport),
    ...titleItems(songs, titleConsistency),
    ...promiseItems(promiseAuditReport),
    ...workspaceItems()
  ];
  return { conceptLabel: opts.conceptLabel, songCount: songs.length, items, promiseAudit: promiseAuditReport, titleConsistency };
}
