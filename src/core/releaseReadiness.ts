import type { AudienceProfile, SongIdea } from '../types';
import { runFullAudit, type AuditItem, type AuditStatus } from './fullAudit';
import { checkLyricLineOverlap, checkSceneOverlap, checkSceneSimilarity, checkTitleHistoryCollision } from './duplicationGate';
import { SCENE_SIMILARITY_ADVISORY_THRESHOLD, SCENE_SIMILARITY_BLOCKING_THRESHOLD } from './sceneSimilarity';
import { checkMotifFamilyCooldown, checkMotifFamilyQuota } from './motifFamilyCooldown';
import type { SceneSignature } from './situationLedger';
import { lintEnglishLyrics } from './englishLint';
import { checkTempoWordingContradiction } from './tempoComplianceGate';
import { isDuplicateArrangementRecipe, isDuplicateFingerprint } from './promptFingerprintLedger';

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
  /**
   * v5.23 (TASK C §3-6) — true when this specific item was computed with
   * `explorationTrackNos` excluded from the pack (see STYLE_ALLOCATION_ITEM_IDS
   * below and this file's own evaluateReleaseReadiness doc comment).
   */
  exempted?: boolean;
}

export interface ReleaseReadinessReport {
  items: ReleaseReadinessItem[];
  totalCriteria: number;
  passedCriteria: number;
  /** true only when every one of the 32 items is 'pass' — spec's own "32개 기준 전부 통과". A 'not-measured'/notImplemented item counts as NOT passed (conservative — never silently treated as passing). */
  releaseReady: boolean;
  failing: ReleaseReadinessItem[];
  /** v5.23 (TASK C §3-6) — how many tracks were excluded from the style-allocation items above (0 for every non-senior-oldpop pack, or a senior-oldpop pack with no exploration slots). Drives the UI's own "발매 가능 (탐색 N곡 포함)" badge. */
  explorationExemptCount: number;
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
  /**
   * AXIS 1 ledger history — optional; the cross-set items report
   * 'not-measured' (not a silent pass) when omitted.
   * codex 지시문 02 (TASK K) — recentFingerprints/recentArrangementRecipes
   * are core/promptFingerprintLedger.ts's own recentFingerprints(channelId)/
   * recentArrangementRecipes(channelId) output, same "pre-fetched by the
   * caller" convention as recentSituations/recentLyricLines just above.
   * Optional independently of those two (a caller might have scene/line
   * history but not yet be passing fingerprint history, or vice versa).
   */
  duplicationHistory?: {
    recentSituations: string[];
    recentLyricLines: string[];
    historicalTitles: Set<string>;
    recentFingerprints?: string[];
    recentArrangementRecipes?: string[];
    /**
     * codex 지시문 02 (TASK B) — core/situationLedger.ts's own
     * recentSceneSignatures(channelId, language) output, richer than the
     * bare recentSituations strings above (see SceneSignature's own doc
     * comment). Drives the new advisory-tier near-miss check
     * (checkSceneSimilarity) alongside checkSceneOverlap's existing
     * exact-match one — independently optional, same reasoning as
     * recentFingerprints above.
     */
    recentSceneSignatures?: SceneSignature[];
  };
  /**
   * v5.23 (TASK C §3-6) — core/explorationSlots.ts's own resolved
   * ExplorationSlotPlan.trackNos for THIS pack (senior-oldpop only —
   * every other workspace never has any, so this parameter is simply
   * omitted there). Exploration slots deliberately waive style-allocation
   * rules (BPM position, genre/vocal distribution — TASK C's own doc
   * comment) while keeping every safety/quality constraint, so a pack that
   * would otherwise fail a style item ONLY because of its own exploration
   * tracks should not be blocked from release over exactly the
   * intentional deviation those tracks were told to attempt.
   */
  explorationTrackNos?: number[];
}

/**
 * v5.23 (TASK C §3-6) — the real, checkable subset of fullAudit.ts's own
 * item ids that measure STYLE ALLOCATION (BPM position/spread, genre
 * distribution, vocal distribution) — never safety/quality items
 * (duplication, English grammar, artist leaks, prompt hygiene all stay
 * fully enforced on exploration tracks too, per TASK C's own "안전 제약은
 * 그대로 유지"). Deliberately NOT copied from core/rewriteLoop.ts's own
 * DESIGN_SCOPED_ITEM_IDS — that set's ids ('era-primary-share',
 * 'bpm-in-range', hyphenated) don't actually match fullAudit.ts's real,
 * underscored ids ('bpm_in_range'), so reusing it here would silently
 * exempt nothing. This list was built by reading fullAudit.ts's own
 * item ids directly instead.
 */
const STYLE_ALLOCATION_ITEM_IDS = new Set([
  'bpm_stddev', 'bpm_in_range',
  'genre_variety', 'genre_max5', 'genre_no_singleton', 'genre_no_triple_run',
  'vocal_distribution', 'vocal_zone_max3', 'vocal_no_triple_run'
]);

// TASK spec's own §4-3 "제목=훅 일치 8~10곡" band.
const TITLE_EQUALS_HOOK_TARGET = { min: 8, max: 10 };
// TASK spec's own §4-3 "excludePrompt 750~850자" band.
const EXCLUDE_PROMPT_TARGET = { min: 750, max: 850 };
// codex 지시문 02 (TASK C) — TASK spec's own §4-3 "같은 소재 <= 4곡" is now
// checked by core/motifFamilyCooldown.ts's checkMotifFamilyQuota, grouped
// by data/motifFamilies.ts's own real family-per-frameId registry, rather
// than the exact-lyricTheme-id approximation formerly hardcoded here.

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
    // codex 지시문 02 (TASK B) — NEW near-miss advisory signal, alongside
    // (never replacing) the exact-match check just above. Only runs when
    // the caller passed the richer recentSceneSignatures; independently
    // optional of recentSituations, so this can be 'not-measured' even when
    // the exact-match item above is genuinely measured.
    if (duplicationHistory.recentSceneSignatures) {
      const similarity = checkSceneSimilarity(songs, duplicationHistory.recentSceneSignatures);
      const status = similarity.blocking ? 'fail' : 'pass';
      const detailParts: string[] = [];
      if (similarity.blockingMatches.length) {
        detailParts.push(`근접 일치(임계값 ${Math.round(SCENE_SIMILARITY_BLOCKING_THRESHOLD * 100)}% 이상) ${similarity.blockingMatches.length}건: T${similarity.blockingMatches.map(m => `${m.trackNo}(${Math.round(m.score * 100)}%)`).join(', T')}`);
      }
      if (similarity.advisoryMatches.length) {
        detailParts.push(`참고용 유사 ${similarity.advisoryMatches.length}건(${Math.round(SCENE_SIMILARITY_ADVISORY_THRESHOLD * 100)}~${Math.round(SCENE_SIMILARITY_BLOCKING_THRESHOLD * 100)}%, 발매를 막지 않음): T${similarity.advisoryMatches.map(m => `${m.trackNo}(${Math.round(m.score * 100)}%)`).join(', T')}`);
      }
      items.push({
        id: 'scene-recent-set-similarity', categoryKo: '가사', labelKo: '최근 세트와 장면 유사도(근접 재사용) 없음',
        status,
        detail: detailParts.length ? detailParts.join(' / ') : '유사 장면 없음'
      });
    } else {
      items.push({ id: 'scene-recent-set-similarity', categoryKo: '가사', labelKo: '최근 세트와 장면 유사도(근접 재사용) 없음', status: 'not-measured', detail: 'duplicationHistory.recentSceneSignatures 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
    }
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

  // codex 지시문 02 (TASK K) — prompt-fingerprint / arrangement-recipe
  // cross-set duplication, independent of the scene/title/line gate above
  // (a caller may have one history without the other yet — see
  // ReleaseReadinessInput.duplicationHistory's own doc comment).
  if (duplicationHistory?.recentFingerprints) {
    const recent = duplicationHistory.recentFingerprints;
    const dupTracks = songs.filter(song => isDuplicateFingerprint(song.promptFingerprint, recent)).map(song => song.trackNo);
    items.push({
      id: 'prompt-fingerprint-recent-set-overlap', categoryKo: '구성', labelKo: '최근 10세트와 프롬프트 지문(장르·템포·보컬·인트로·진행·훅장치·전조·밀도) 중복 0건',
      status: dupTracks.length ? 'fail' : 'pass',
      detail: dupTracks.length ? `중복 ${dupTracks.length}건: T${dupTracks.join(', T')}` : '중복 0건'
    });
  } else {
    items.push({ id: 'prompt-fingerprint-recent-set-overlap', categoryKo: '구성', labelKo: '최근 10세트와 프롬프트 지문 중복 0건', status: 'not-measured', detail: 'duplicationHistory.recentFingerprints 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
  }
  if (duplicationHistory?.recentArrangementRecipes) {
    const recent = duplicationHistory.recentArrangementRecipes;
    const dupTracks = songs.filter(song => isDuplicateArrangementRecipe(song.arrangementRecipe, recent)).map(song => song.trackNo);
    items.push({
      id: 'arrangement-recipe-recent-set-overlap', categoryKo: '구성', labelKo: '최근 5세트와 편곡 레시피(인트로·밀도·악기 구성) 중복 0건',
      status: dupTracks.length ? 'fail' : 'pass',
      detail: dupTracks.length ? `중복 ${dupTracks.length}건: T${dupTracks.join(', T')}` : '중복 0건'
    });
  } else {
    items.push({ id: 'arrangement-recipe-recent-set-overlap', categoryKo: '구성', labelKo: '최근 5세트와 편곡 레시피 중복 0건', status: 'not-measured', detail: 'duplicationHistory.recentArrangementRecipes 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
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

  // codex 지시문 02 (TASK C) — same-subject cap, now grouped by MotifFamily
  // (data/motifFamilies.ts) instead of the old exact-lyricTheme-id
  // approximation — see that registry's own doc comment for why the old
  // check almost never actually fired (dozens of individual themes share
  // only ~44 real frameId values, and an 18-song pack essentially never
  // repeats one exact theme id 5+ times even when 5+ songs share a real
  // subject family).
  const quotaFindings = checkMotifFamilyQuota(songs.map(song => ({ trackNo: song.trackNo, frameId: song.lyricFrameId })));
  items.push({
    id: 'same-subject-cap', categoryKo: '가사', labelKo: `같은 소재(모티프 계열) <= 계열별 한도`,
    status: quotaFindings.length === 0 ? 'pass' : 'fail',
    detail: quotaFindings.length
      ? quotaFindings.map(f => `${f.labelKo} ${f.count}곡(한도 ${f.maxPerPack}): T${f.trackNos.join(', T')}`).join(' / ')
      : '계열별 한도 내'
  });

  // codex 지시문 02 (TASK C) — NEW cross-pack cooldown signal, independent
  // of the within-pack quota just above. Only measured when the caller
  // passed recentSceneSignatures (same optional axis TASK B's scene-
  // similarity item already uses) — reports not-measured otherwise, same
  // "never a silent pass" convention as every other ledger-based item.
  if (duplicationHistory?.recentSceneSignatures) {
    const cooldownFindings = checkMotifFamilyCooldown(
      songs.map(song => ({ trackNo: song.trackNo, frameId: song.lyricFrameId })),
      duplicationHistory.recentSceneSignatures
    );
    items.push({
      id: 'motif-family-recent-pack-cooldown', categoryKo: '가사', labelKo: '최근 세트와 소재(모티프 계열) 쿨다운 준수',
      status: cooldownFindings.length === 0 ? 'pass' : 'fail',
      detail: cooldownFindings.length
        ? cooldownFindings.map(f => `${f.labelKo}: 최근 ${f.recentPackCount}개 세트에서도 사용됨 (T${f.trackNos.join(', T')})`).join(' / ')
        : '쿨다운 위반 없음'
    });
  } else {
    items.push({ id: 'motif-family-recent-pack-cooldown', categoryKo: '가사', labelKo: '최근 세트와 소재(모티프 계열) 쿨다운 준수', status: 'not-measured', detail: 'duplicationHistory.recentSceneSignatures 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
  }

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
  let reused = fullAuditReport.items
    .filter(item => !item.requiresAudio) // audio-dependent items are never measurable pre-release without a rendered take; excluded from this checklist rather than reported as a fake failure.
    .map(item => fromAuditItem(item, item.category));

  // v5.23 (TASK C §3-6) — re-measures ONLY the style-allocation items
  // (STYLE_ALLOCATION_ITEM_IDS) on the pack with its exploration tracks
  // removed, and splices just those results back in as `exempted: true`.
  // Every other item (safety, quality, duplication, prompt hygiene, ...)
  // still comes from the full pack above — exploration tracks are never
  // exempt from those.
  const explorationTrackNos = input.explorationTrackNos ?? [];
  if (explorationTrackNos.length) {
    const nonExplorationSongs = input.songs.filter(song => !explorationTrackNos.includes(song.trackNo));
    const exemptAuditReport = runFullAudit(nonExplorationSongs, {
      conceptLabel: input.conceptLabel,
      songCount: nonExplorationSongs.length,
      audienceProfile: input.audienceProfile
    });
    const exemptItemsById = new Map(exemptAuditReport.items.map(auditItem => [auditItem.id, auditItem]));
    reused = reused.map(item => {
      if (!STYLE_ALLOCATION_ITEM_IDS.has(item.id)) return item;
      const recomputed = exemptItemsById.get(item.id);
      if (!recomputed) return item;
      return { ...fromAuditItem(recomputed, item.categoryKo), exempted: true };
    });
  }

  const items = [...reused, ...newItems(input)];
  const passedCriteria = items.filter(item => item.status === 'pass').length;
  const failing = items.filter(item => item.status !== 'pass');

  return {
    items,
    totalCriteria: items.length,
    passedCriteria,
    releaseReady: failing.length === 0,
    failing,
    explorationExemptCount: explorationTrackNos.length
  };
}
