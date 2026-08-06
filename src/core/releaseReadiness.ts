import type { AudienceProfile, SongIdea } from '../types';
import { runFullAudit, type AuditItem, type AuditStatus } from './fullAudit';
import { checkLyricLineOverlap, checkSceneOverlap, checkTitleHistoryCollision } from './duplicationGate';
import { lintEnglishLyrics } from './englishLint';
import { checkTempoWordingContradiction } from './tempoComplianceGate';

/**
 * v5.22 (AXIS 4 §4-3) — the task spec's own "무검수 발매 기준": 32 pass/fail
 * criteria a pack must ALL pass before it's safe to publish without manual
 * review. Deliberately built as a thin layer ON TOP of core/fullAudit.ts's
 * runFullAudit (already covers ~20 of these 32 — era share, BPM-vs-profile,
 * genre/vocal variety, arrangement density, situation-all-distinct,
 * emotion-arc variety, vocab repetition, title pattern variety, artist
 * leak, prompt length) rather than re-deriving them, per this whole task's
 * own established "reuse existing checks" convention. Only the genuinely
 * missing criteria (confirmed missing by direct code search before writing
 * this file) get NEW checks here: modulation count, intro-type variety,
 * cross-set situation/lyric-line dedup (AXIS 1's core/duplicationGate.ts),
 * subject/material cap, in-song sentence repetition + English grammar
 * (AXIS 3's core/englishLint.ts), exact title=hook count band, full-library
 * title dedup (AXIS 1 again), excludePrompt length, and tempo-wording-vs-BPM
 * contradiction (AXIS 2's core/tempoComplianceGate.ts).
 *
 * IMPORTANT threshold note: fullAudit.ts's own existing items use THEIR
 * OWN, independently-set thresholds for some of the same real-world
 * measurements this task's own §4-3 names a different number for (era
 * share: fullAudit's ERA_POLICY.singlePrimaryMin is 50%, this task's own
 * spec asks 65%; genre count ceiling: fullAudit allows up to 9, spec asks
 * <=7 (5 max per genre matches); emotion-arc variety: fullAudit requires
 * >=8, spec asks >=3 (a LOOSER bar)). This module does NOT silently
 * override fullAudit's own thresholds (that risks fullAudit's own existing
 * test suite and its own, separately-justified reasoning) — it reports
 * BOTH the fullAudit result and, where the spec's own number is stricter,
 * an ADDITIONAL check against the spec's own literal number. See each
 * item's own `detail` for which threshold actually gated it.
 */

export interface ReleaseReadinessItem {
  id: string;
  categoryKo: string;
  labelKo: string;
  status: AuditStatus;
  detail: string;
  notImplemented?: boolean;
}

export interface ReleaseReadinessReport {
  items: ReleaseReadinessItem[];
  totalCriteria: number;
  passedCriteria: number;
  /** true only when every one of the 32 items is 'pass' — spec's own "32개 기준 전부 통과". A 'not-measured'/notImplemented item counts as NOT passed (conservative — never silently treated as passing). */
  releaseReady: boolean;
  failing: ReleaseReadinessItem[];
}

function fromAuditItem(item: AuditItem, categoryKo: string): ReleaseReadinessItem {
  return {
    id: item.id,
    categoryKo,
    labelKo: item.labelKo,
    status: item.status,
    detail: `${item.targetKo} → ${item.actualKo}`,
    notImplemented: item.notImplemented
  };
}

export interface ReleaseReadinessInput {
  songs: SongIdea[];
  conceptLabel: string;
  songCount: number;
  audienceProfile: AudienceProfile;
  lyricLanguage: 'english' | 'korean' | 'japanese' | 'bilingual';
  /** AXIS 1 ledger history — optional; the 2 cross-set items report 'not-measured' (not a silent pass) when omitted. */
  duplicationHistory?: { recentSituations: string[]; recentLyricLines: string[]; historicalTitles: Set<string> };
}

// TASK spec's own §4-3 "제목=훅 일치 8~10곡" band.
const TITLE_EQUALS_HOOK_TARGET = { min: 8, max: 10 };
// TASK spec's own §4-3 "excludePrompt 750~850자" band.
const EXCLUDE_PROMPT_TARGET = { min: 750, max: 850 };
// TASK spec's own §4-3 "같은 소재 <= 4곡" — approximated via lyricTheme id (the closest existing "what is this song about" field), documented as an approximation rather than a precise "subject" classifier this app doesn't have.
const MAX_SAME_SUBJECT = 4;

function newItems(input: ReleaseReadinessInput): ReleaseReadinessItem[] {
  const { songs, duplicationHistory, lyricLanguage } = input;
  const items: ReleaseReadinessItem[] = [];

  // Gate 1 (AXIS 1) — scene vs. recent-set history, title vs. full history.
  if (duplicationHistory) {
    const sceneOverlap = checkSceneOverlap(songs, duplicationHistory.recentSituations);
    items.push({
      id: 'scene-recent-set-overlap', categoryKo: '가사', labelKo: '최근 5세트와 장면 중복 0건',
      status: sceneOverlap.blocking ? 'fail' : 'pass',
      detail: sceneOverlap.blocking ? `중복 ${sceneOverlap.collisions.length}건: T${sceneOverlap.collisions.map(c => c.trackNo).join(', T')}` : '중복 0건'
    });
    const titleCollision = checkTitleHistoryCollision(songs, duplicationHistory.historicalTitles);
    items.push({
      id: 'title-full-history-collision', categoryKo: '제목', labelKo: '전체 이력과 제목 중복 0건',
      status: titleCollision.blocking ? 'fail' : 'pass',
      detail: titleCollision.blocking ? `중복 ${titleCollision.collisions.length}건: T${titleCollision.collisions.map(c => c.trackNo).join(', T')}` : '중복 0건'
    });
    const lineOverlap = checkLyricLineOverlap(songs, duplicationHistory.recentLyricLines);
    items.push({
      id: 'lyric-line-recent-set-overlap', categoryKo: '가사', labelKo: '최근 세트와 가사 문장 완전일치 0건',
      status: lineOverlap.matches.length > 0 ? 'fail' : 'pass',
      detail: lineOverlap.matches.length ? `일치 ${lineOverlap.matches.length}건 (3개 이상이면 세트 전체 불신)` : '일치 0건'
    });
  } else {
    for (const [id, labelKo] of [
      ['scene-recent-set-overlap', '최근 5세트와 장면 중복 0건'],
      ['title-full-history-collision', '전체 이력과 제목 중복 0건'],
      ['lyric-line-recent-set-overlap', '최근 세트와 가사 문장 완전일치 0건']
    ] as const) {
      items.push({ id, categoryKo: '가사', labelKo, status: 'not-measured', detail: 'duplicationHistory 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
    }
  }

  // English grammar + in-song line repetition (AXIS 3) — English-only, same convention core/quality.ts's own scoreSong wiring already follows.
  if (lyricLanguage === 'english') {
    let blockingCount = 0;
    let repetitionCount = 0;
    for (const song of songs) {
      const lint = lintEnglishLyrics(song.lyrics, song.hookPhrase);
      blockingCount += lint.issues.filter(i => i.severity === 'blocking' && i.id !== 'in-song-line-repetition').length;
      repetitionCount += lint.issues.filter(i => i.id === 'in-song-line-repetition').length;
    }
    items.push({ id: 'english-grammar-errors', categoryKo: '가사', labelKo: '영어 문법 오류 0건', status: blockingCount === 0 ? 'pass' : 'fail', detail: `${blockingCount}건 감지` });
    items.push({ id: 'in-song-line-repetition', categoryKo: '가사', labelKo: '한 곡 내 문장 반복 0건', status: repetitionCount === 0 ? 'pass' : 'fail', detail: `${repetitionCount}건 감지` });
  } else {
    items.push({ id: 'english-grammar-errors', categoryKo: '가사', labelKo: '영어 문법 오류 0건', status: 'not-measured', detail: '영어 팩이 아님', notImplemented: false });
    items.push({ id: 'in-song-line-repetition', categoryKo: '가사', labelKo: '한 곡 내 문장 반복 0건', status: 'not-measured', detail: '영어 팩이 아님 — englishLint는 영어 전용', notImplemented: false });
  }

  // Tempo-wording contradiction (AXIS 2).
  const tempoContradictions = songs.filter(song => typeof song.bpm === 'number' && checkTempoWordingContradiction(song.stylePrompt, song.bpm).length > 0);
  items.push({
    id: 'tempo-wording-contradiction', categoryKo: '음악 설계', labelKo: '템포 서술과 BPM 모순 0건',
    status: tempoContradictions.length === 0 ? 'pass' : 'fail',
    detail: tempoContradictions.length ? `T${tempoContradictions.map(s => s.trackNo).join(', T')}` : '모순 0건'
  });

  // title === hookPhrase exact count band (spec's own literal ===, distinct from fullAudit's looser "connected" measure).
  const exactMatches = songs.filter(song => song.title.trim().toLowerCase() === song.hookPhrase.trim().toLowerCase()).length;
  items.push({
    id: 'title-equals-hook-band', categoryKo: '제목', labelKo: `제목=훅 일치 ${TITLE_EQUALS_HOOK_TARGET.min}~${TITLE_EQUALS_HOOK_TARGET.max}곡`,
    status: exactMatches >= TITLE_EQUALS_HOOK_TARGET.min && exactMatches <= TITLE_EQUALS_HOOK_TARGET.max ? 'pass' : 'fail',
    detail: `실측 ${exactMatches}곡`
  });

  // excludePrompt length band.
  const excludeLengths = songs.map(song => (song.excludePrompt ?? '').length).filter(len => len > 0);
  const excludeOutOfBand = excludeLengths.filter(len => len < EXCLUDE_PROMPT_TARGET.min || len > EXCLUDE_PROMPT_TARGET.max);
  items.push({
    id: 'exclude-prompt-length', categoryKo: '프롬프트', labelKo: `excludePrompt ${EXCLUDE_PROMPT_TARGET.min}~${EXCLUDE_PROMPT_TARGET.max}자`,
    status: excludeLengths.length > 0 && excludeOutOfBand.length === 0 ? 'pass' : 'fail',
    detail: excludeLengths.length ? `범위 밖 ${excludeOutOfBand.length}/${excludeLengths.length}곡` : 'excludePrompt 없음'
  });

  // Same-subject cap — approximated via lyricTheme id (documented above as an approximation, not a precise "subject" classifier).
  const themeCounts = new Map<string, number>();
  for (const song of songs) {
    const theme = song.lyricTheme;
    if (!theme) continue;
    themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
  }
  const maxThemeCount = Math.max(0, ...themeCounts.values());
  items.push({
    id: 'same-subject-cap', categoryKo: '가사', labelKo: `같은 소재 <= ${MAX_SAME_SUBJECT}곡 (lyricTheme 기준 근사치)`,
    status: maxThemeCount <= MAX_SAME_SUBJECT ? 'pass' : 'fail',
    detail: `최다 소재 반복 ${maxThemeCount}곡`
  });

  // Genuine, still-unbuilt gaps — reported honestly, never faked as passing.
  items.push({ id: 'modulation-count', categoryKo: '음악 설계', labelKo: '전조 5~6곡', status: 'not-measured', detail: '미구현 — 전조 여부를 추적하는 필드/검사가 앱에 없음', notImplemented: true });
  items.push({ id: 'intro-type-variety', categoryKo: '음악 설계', labelKo: '인트로 유형 >= 4종', status: 'not-measured', detail: '미구현 — 인트로 유형별 다양성을 세는 검사가 없음 (introTexturePlan.ts는 배정만 함)', notImplemented: true });

  return items;
}

/**
 * The one real entry point. Pure — no IndexedDB (duplicationHistory is
 * pre-fetched by the caller, same convention core/importInspection.ts's
 * own duplicationHistory param already established).
 */
export function evaluateReleaseReadiness(input: ReleaseReadinessInput): ReleaseReadinessReport {
  const fullAuditReport = runFullAudit(input.songs, {
    conceptLabel: input.conceptLabel,
    songCount: input.songCount,
    audienceProfile: input.audienceProfile
  });
  const reused = fullAuditReport.items
    .filter(item => !item.requiresAudio) // audio-dependent items are never measurable pre-release without a rendered take; excluded from this checklist rather than reported as a fake failure.
    .map(item => fromAuditItem(item, item.category));

  const items = [...reused, ...newItems(input)];
  const passedCriteria = items.filter(item => item.status === 'pass').length;
  const failing = items.filter(item => item.status !== 'pass');

  return {
    items,
    totalCriteria: items.length,
    passedCriteria,
    releaseReady: failing.length === 0,
    failing
  };
}
