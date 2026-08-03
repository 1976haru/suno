import type { Threshold, ThresholdBasis } from '../types';

/**
 * v4.2 (TASK E) — a catalog of the numeric thresholds this app's gates
 * (core/compositionScorer.ts, core/generationGate.ts, core/designGate.ts,
 * core/audioGate.ts, core/lyricVocabularyRepetition.ts,
 * data/audienceProfiles.ts) actually check against, each tagged with a
 * `basis` (see types.ts's own doc comment) — so "is this number real or a
 * guess" is answerable at a glance instead of buried in a doc comment only
 * a code reader would ever see.
 *
 * This is deliberately a DATA MIRROR, not a new source of truth: every
 * `value` below is copied from the real constant it describes, and the
 * actual gate files still read their own local consts unchanged (see this
 * task's own explicit scoping: threading a `thresholdId` through every
 * check function so a live gate message can show "unvalidated" inline is
 * a separate, deferred pass — this file only powers a summary count for
 * now). If a source constant changes, update the matching entry here too;
 * there is no automated link between them yet.
 *
 * `basis: 'measured'` below means a doc comment on the source constant
 * cites a specific real pack/waveform/listening measurement. `'estimated'`
 * means no such citation exists — a judgment call, not measured. Per this
 * task's own research (v4.2 TASK C/D, not yet run), NOTHING here starts as
 * `'listener-verified'` — that tier requires a real A/B/rating dataset
 * this app hasn't collected yet; every `'measured'` entry below rests on
 * one developer's own single real-pack measurement, not a listener panel.
 */
export const QUALITY_THRESHOLDS: Threshold[] = [
  // --- core/compositionScorer.ts ---
  { id: 'descriptor-count-block-min', labelKo: '스타일 프롬프트 서술어 하한 (차단)', value: 20, basis: 'measured' },
  { id: 'descriptor-count-block-max', labelKo: '스타일 프롬프트 서술어 상한 (차단)', value: 40, basis: 'measured' },
  { id: 'descriptor-count-advisory-min', labelKo: '스타일 프롬프트 서술어 하한 (권장)', value: 25, basis: 'measured' },
  { id: 'descriptor-count-advisory-max', labelKo: '스타일 프롬프트 서술어 상한 (권장)', value: 35, basis: 'measured' },
  { id: 'lyric-blocking-floor-ratio', labelKo: '가사 길이 차단 하한 (목표 대비 비율)', value: 130 / 215, basis: 'measured' },
  { id: 'lyric-advisory-floor-ratio', labelKo: '가사 길이 권장 하한 (목표 대비 비율)', value: 190 / 215, basis: 'measured' },
  { id: 'section-count-advisory-floor', labelKo: '섹션 수 권장 하한', value: 5, basis: 'estimated' },
  { id: 'vocal-zone-same-type-advisory-floor', labelKo: '구간별 보컬 타입 쏠림 권장 상한', value: 4, basis: 'measured' },
  { id: 'style-similarity-block-threshold', labelKo: '트랙간 스타일 프롬프트 유사도 차단 상한', value: 0.28, basis: 'estimated' },
  { id: 'vocal-descriptor-variety-blocking-floor', labelKo: '보컬 서술 종류 붕괴 차단 하한', value: 5, basis: 'estimated' },
  { id: 'vocal-descriptor-same-max-songs', labelKo: '보컬 서술 1종 최대 반복 곡수', value: 3, basis: 'estimated' },
  { id: 'bpm-stddev-blocking-floor', labelKo: 'BPM 표준편차 붕괴 차단 하한', value: 6, basis: 'estimated' },
  { id: 'bpm-range-width-blocking-floor', labelKo: 'BPM 범위 폭 붕괴 차단 하한', value: 25, basis: 'estimated' },

  // --- core/generationGate.ts ---
  { id: 'lyric-word-count-min-ratio', labelKo: '가사 길이 관문2 하한 (목표 대비 비율)', value: 200 / 215, basis: 'estimated' },
  { id: 'lyric-word-count-max-ratio', labelKo: '가사 길이 관문2 상한 (목표 대비 비율)', value: 240 / 230, basis: 'estimated' },
  { id: 'section-count-min', labelKo: '섹션 수 하한 (관문2)', value: 6, basis: 'estimated' },
  { id: 'section-count-max', labelKo: '섹션 수 상한 (관문2)', value: 8, basis: 'estimated' },
  { id: 'title-pattern-variety-min', labelKo: '제목 패턴 종류 최소', value: 4, basis: 'estimated' },
  { id: 'title-pattern-max-same', labelKo: '같은 제목 패턴 최대 곡수', value: 5, basis: 'estimated' },
  { id: 'vocal-descriptor-variety-min', labelKo: '보컬 서술 종류 최소 (관문2)', value: 12, basis: 'estimated' },
  { id: 'emotion-arc-variety-min', labelKo: '감정 아크 종류 최소', value: 8, basis: 'estimated' },
  { id: 'prompt-length-min', labelKo: '스타일 프롬프트 길이 하한(자)', value: 350, basis: 'estimated' },
  { id: 'prompt-length-max', labelKo: '스타일 프롬프트 길이 상한(자)', value: 650, basis: 'estimated' },
  { id: 'prompt-atoms-min', labelKo: '스타일 프롬프트 서술어 개수 하한 (관문2)', value: 15, basis: 'estimated' },
  { id: 'prompt-atoms-max', labelKo: '스타일 프롬프트 서술어 개수 상한 (관문2)', value: 25, basis: 'estimated' },
  { id: 'shared-atoms-max', labelKo: '팩 공유 서술어 원자 최대 개수', value: 5, basis: 'estimated' },
  { id: 'promise-fulfillment-min', labelKo: '컨셉 약속 이행도 권장 하한', value: 0.7, basis: 'estimated' },
  { id: 'promise-fulfillment-full-regen-floor', labelKo: '컨셉 약속 이행도 전체재생성 하한', value: 0.4, basis: 'estimated' },
  { id: 'full-regeneration-track-threshold', labelKo: '전체 재생성 전환 실패 트랙 수', value: 12, basis: 'estimated' },

  // --- core/designGate.ts: BREADTH_THRESHOLDS ---
  { id: 'breadth-focused-genre-min', labelKo: '집중형 장르 종류 최소', value: 1, basis: 'estimated' },
  { id: 'breadth-focused-genre-max', labelKo: '집중형 장르 종류 최대', value: 3, basis: 'estimated' },
  { id: 'breadth-focused-genre-max-per-genre', labelKo: '집중형 같은 장르 최대 곡수', value: 12, basis: 'estimated' },
  { id: 'breadth-focused-bpm-stddev-floor', labelKo: '집중형 BPM 표준편차 하한', value: 4, basis: 'estimated' },
  { id: 'breadth-focused-bpm-range-floor', labelKo: '집중형 BPM 범위 폭 하한', value: 10, basis: 'estimated' },
  { id: 'breadth-focused-vocal-min-distinct', labelKo: '집중형 보컬 종류 최소', value: 1, basis: 'estimated' },
  { id: 'breadth-balanced-genre-min', labelKo: '균형형 장르 종류 최소', value: 4, basis: 'estimated' },
  { id: 'breadth-balanced-genre-max', labelKo: '균형형 장르 종류 최대', value: 9, basis: 'estimated' },
  { id: 'breadth-balanced-genre-max-per-genre', labelKo: '균형형 같은 장르 최대 곡수', value: 5, basis: 'estimated' },
  { id: 'breadth-balanced-bpm-stddev-floor', labelKo: '균형형 BPM 표준편차 하한', value: 8, basis: 'estimated' },
  { id: 'breadth-balanced-bpm-range-floor', labelKo: '균형형 BPM 범위 폭 하한', value: 25, basis: 'estimated' },
  { id: 'breadth-balanced-vocal-min-distinct', labelKo: '균형형 보컬 종류 최소', value: 3, basis: 'estimated' },
  { id: 'breadth-balanced-vocal-min-per-type-ratio', labelKo: '균형형 보컬 타입별 최소 비율', value: 3 / 18, basis: 'estimated' },
  { id: 'breadth-variety-genre-min', labelKo: '폭넓게 장르 종류 최소', value: 6, basis: 'estimated' },
  { id: 'breadth-variety-genre-max', labelKo: '폭넓게 장르 종류 최대', value: 9, basis: 'estimated' },
  { id: 'breadth-variety-genre-max-per-genre', labelKo: '폭넓게 같은 장르 최대 곡수', value: 4, basis: 'estimated' },
  { id: 'breadth-variety-bpm-stddev-floor', labelKo: '폭넓게 BPM 표준편차 하한', value: 10, basis: 'estimated' },
  { id: 'breadth-variety-bpm-range-floor', labelKo: '폭넓게 BPM 범위 폭 하한', value: 30, basis: 'estimated' },
  { id: 'breadth-variety-vocal-min-distinct', labelKo: '폭넓게 보컬 종류 최소', value: 3, basis: 'estimated' },
  { id: 'breadth-variety-vocal-min-per-type-ratio', labelKo: '폭넓게 보컬 타입별 최소 비율', value: 4 / 18, basis: 'estimated' },

  // --- core/designGate.ts: killing point ---
  { id: 'killing-point-assigned-ratio', labelKo: '킬링포인트 배정 비율', value: 12 / 18, basis: 'estimated' },
  { id: 'killing-point-variety-ratio', labelKo: '킬링포인트 종류 다양성 비율', value: 6 / 18, basis: 'estimated' },

  // --- core/audioGate.ts / core/audioSetReport.ts ---
  { id: 'audio-duration-absolute-min-seconds', labelKo: '오디오 길이 절대 하한(초)', value: 170, basis: 'measured' },
  // v4.6 (TASK D) — lowered 6dB -> 5dB; a real 36-song measurement averaged
  // 4.4dB with only 1/36 (2.8%) tracks reaching 6dB, making the old target
  // unreachable in practice (see core/audioSetReport.ts's own
  // WEAK_DYNAMIC_RANGE_DB doc comment). Registered here for the first time
  // (previously untracked by this file) with basis:'measured', now that a
  // real pack-wide measurement backs the value.
  { id: 'audio-dynamic-range-weak-db', labelKo: '킬링포인트 곡 진폭 권장 하한(dB)', value: 5, basis: 'measured' },
  { id: 'audio-duration-severe-over-seconds', labelKo: '수노 실측 길이 심각 초과 기준(초)', value: 270, basis: 'measured' },

  // --- core/lyricVocabularyRepetition.ts ---
  { id: 'generic-word-cap', labelKo: '일반 단어 반복 상한 (권장)', value: 12, basis: 'measured' },
  { id: 'channel-identity-word-cap', labelKo: '채널 정체성 단어 반복 상한 (권장)', value: 20, basis: 'measured' },
  { id: 'word-blocking-threshold', labelKo: '단어 반복 차단 상한', value: 30, basis: 'estimated' },

  // --- data/audienceProfiles.ts: SENIOR_AUDIENCE_PROFILE ---
  { id: 'senior-tempo-floor', labelKo: '시니어 프로필 BPM 하한', value: 62, basis: 'estimated' },
  { id: 'senior-tempo-ceiling', labelKo: '시니어 프로필 BPM 상한', value: 112, basis: 'estimated' },
  { id: 'senior-lyric-word-range-min', labelKo: '시니어 프로필 가사 단어수 하한 (레거시)', value: 200, basis: 'estimated' },
  { id: 'senior-lyric-word-range-max', labelKo: '시니어 프로필 가사 단어수 상한 (레거시)', value: 250, basis: 'estimated' },
  { id: 'senior-song-length-min-seconds', labelKo: '시니어 프로필 곡 길이 하한(초)', value: 190, basis: 'measured' },
  { id: 'senior-song-length-max-seconds', labelKo: '시니어 프로필 곡 길이 상한(초)', value: 215, basis: 'measured' },
  { id: 'senior-tempo-band-1-low', labelKo: '시니어 템포밴드1 하한', value: 62, basis: 'measured' },
  { id: 'senior-tempo-band-1-high', labelKo: '시니어 템포밴드1 상한', value: 78, basis: 'measured' },
  { id: 'senior-tempo-band-2-low', labelKo: '시니어 템포밴드2 하한', value: 80, basis: 'measured' },
  { id: 'senior-tempo-band-2-high', labelKo: '시니어 템포밴드2 상한', value: 92, basis: 'measured' },
  { id: 'senior-tempo-band-3-low', labelKo: '시니어 템포밴드3 하한', value: 94, basis: 'measured' },
  { id: 'senior-tempo-band-3-high', labelKo: '시니어 템포밴드3 상한', value: 104, basis: 'measured' },
  { id: 'senior-tempo-band-4-low', labelKo: '시니어 템포밴드4 하한', value: 106, basis: 'measured' },
  { id: 'senior-tempo-band-4-high', labelKo: '시니어 템포밴드4 상한', value: 112, basis: 'measured' },

  // --- v4.1 (TASK B): lyricMetricsByLanguage — already documented as estimates in their own source doc comment ---
  { id: 'senior-lyric-metrics-english-min', labelKo: '시니어 영어 가사 목표 하한(단어)', value: 215, basis: 'estimated' },
  { id: 'senior-lyric-metrics-english-max', labelKo: '시니어 영어 가사 목표 상한(단어)', value: 230, basis: 'estimated' },
  { id: 'senior-lyric-metrics-korean-min', labelKo: '시니어 한국어 가사 목표 하한(어절)', value: 150, basis: 'estimated' },
  { id: 'senior-lyric-metrics-korean-max', labelKo: '시니어 한국어 가사 목표 상한(어절)', value: 180, basis: 'estimated' },
  { id: 'senior-lyric-metrics-japanese-min', labelKo: '시니어 일본어 가사 목표 하한(문자)', value: 400, basis: 'estimated' },
  { id: 'senior-lyric-metrics-japanese-max', labelKo: '시니어 일본어 가사 목표 상한(문자)', value: 520, basis: 'estimated' }
];

/** v4.2 (TASK E) — groups the catalog by basis for a summary display (e.g. "62개 중 estimated 47"), without every consumer re-implementing the same reduce. */
export function thresholdsByBasis(): Record<ThresholdBasis, Threshold[]> {
  const grouped: Record<ThresholdBasis, Threshold[]> = { measured: [], 'listener-verified': [], estimated: [] };
  for (const threshold of QUALITY_THRESHOLDS) grouped[threshold.basis].push(threshold);
  return grouped;
}
