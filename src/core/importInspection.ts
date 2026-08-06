import type { BilingualPair, GenerationOptions, LyricLanguage, SongIdea } from '../types';
import type { ImportSongsReport } from './bridgeImport';
import { describeTrackSetValidation, resolveEffectiveTrackNo, validateProviderTrackSet } from './importValidation';
import { lyricLanguageMismatchWarning } from './lyricMetrics';
import { findArtistReferenceLeaks, type ArtistReferenceLeak } from './artistReferenceDecomposer';
import { checkLyricLineOverlap, checkSceneOverlap, checkTitleHistoryCollision } from './duplicationGate';

/**
 * TASK (import transaction / pre-persistence inspection) — real, verified
 * bug this module exists to fix: App.tsx's onImportSongsJson used to
 * autosave/register hooks the instant importSongsJson produced ANY non-null
 * blueprint, even a genuinely partial response (17 of 18 requested songs) —
 * zero user review, and those 17 hooks got permanently marked "already
 * used" for future avoid-lists. This module is the classification step that
 * now runs BEFORE any persistence: it never re-implements a check that
 * already exists elsewhere (validateProviderTrackSet, lyricLanguageMismatchWarning,
 * findArtistReferenceLeaks, ensureVocalMetaTag's own auto-correction — all
 * reused, none of their internals touched), it only combines their outputs
 * into one status a caller (App.tsx) can gate a save on.
 *
 * - 'blocked': the response itself can never be trusted enough to save, no
 *   matter what the user says — a JSON parse failure, a missing "songs"
 *   array, or a duplicate/out-of-range trackNo (importSongsJson's own
 *   upstream validateProviderTrackSet call already refuses to produce a
 *   blueprint for any of these — report.blueprint is null, or this module's
 *   own re-run of that same check on the raw entries fails). A real
 *   artist-name leak (see below) is deliberately NOT one of these reasons
 *   as of TASK v5.19 (TASK C) — a real incident showed an entire clean
 *   18-song pack getting discarded over one track's false positive, with
 *   zero recourse but re-running the whole generation.
 * - 'repairable': every song that DID come through is individually
 *   well-formed, but the response is short of what was requested, OR one or
 *   more (not all) songs need review before they can be trusted — genuinely
 *   missing trackNo claims (validateProviderTrackSet.missing), a per-song
 *   required-field failure (bridgeImport.ts's normalizeImportedSong,
 *   surfaced via report.skippedReasons), a lyric-language-ratio mismatch
 *   warning, or a real artist/band-name leak in one or more tracks' final
 *   title/stylePrompt/lyrics (the same findArtistReferenceLeaks scan
 *   core/albumAudit.ts's auditAlbum already treats as a hard,
 *   block-the-copy-action "errors" condition, just run here at import time
 *   instead of display time — see artistLeakTrackNos). None of these mean
 *   the response is corrupt — they mean a human needs to look at it (or, for
 *   leaks specifically, exclude the flagged track(s)) before it becomes
 *   permanent. See App.tsx's onConfirmPartialImport for how artistLeakTrackNos
 *   gets excluded from what "[N곡만 확정]" actually saves.
 * - 'valid': every requested track present, individually valid, nothing to
 *   review. The only status that should never interrupt the user with a
 *   confirmation screen.
 */
export type ImportStatus = 'valid' | 'repairable' | 'blocked';

export interface ImportCheckLine {
  id: string;
  labelKo: string;
  /** 'blocked' only ever appears on a line that actually contributed to an overall 'blocked' status; 'info' never contributes to status at all (see vocalTag's own check — auto-correction is self-healing, not a defect to review). */
  status: 'pass' | 'info' | 'warn' | 'blocked';
  detail?: string;
}

/** TASK v5.19 (TASK C) — one flagged track's surviving (non-exempted) leaks; see ImportInspection.artistLeaks. */
export interface ArtistLeakDetail {
  trackNo: number;
  leaks: ArtistReferenceLeak[];
}

export interface ImportInspection {
  status: ImportStatus;
  checks: ImportCheckLine[];
  requestedCount: number;
  importedCount: number;
  /** trackNo values validateProviderTrackSet.missing reports the raw response never claimed at all — distinct from a per-song field-validation failure (see report.skippedReasons for those; a field failure DID claim a trackNo, it just failed normalization). */
  missingTrackNos: number[];
  /** Informational only (see this module's own header comment on the 'blocked' bucket never including vocal-tag corrections) — never affects `status`. */
  vocalTagCorrections: { trackNo: number; from: string; to: string }[];
  /** TASK v5.19 (TASK C) — trackNos with a real (non-exempted) artist/band-name leak; App.tsx excludes exactly these from what "[N곡만 확정]" saves, instead of discarding the whole pack. Empty when the artist-safety check passed or every hit was session-exempted as a false positive. */
  artistLeakTrackNos: number[];
  /** TASK v5.19 (TASK C) — per-track leak detail (surface text + commonWordRisk) for the "오탐입니다" false-positive report UI; parallel to artistLeakTrackNos. */
  artistLeaks: ArtistLeakDetail[];
  /**
   * v5.22 (AXIS 1 §1-7, Gate 1) — trackNos whose listenerSituation exactly
   * matches a scene already used in a recent set (core/situationLedger.ts),
   * or whose title exactly matches the channel's full title history
   * (core/hookLedger.ts's usedTitles) — same per-track exclusion treatment
   * as artistLeakTrackNos above (App.tsx's "[N곡만 확정]" excludes these too),
   * not a whole-pack block: a duplicate scene/title is this ONE track's
   * problem, not proof the whole response is untrustworthy (mirrors the
   * v5.19 reasoning that moved artist leaks out of the hard-block bucket).
   * Empty whenever no `duplicationHistory` was passed in (existing callers
   * that don't supply it keep compiling and keep pre-existing behavior).
   */
  duplicateContentTrackNos: number[];
  sceneOverlaps: { trackNo: number; situation: string; matchedHistoryEntry: string }[];
  titleHistoryCollisions: { trackNo: number; title: string }[];
  /**
   * v5.22 (AXIS 1 §1-7, Gate 2) — "가사 문장 25자 이상 완전일치 — 한 세트 3개
   * 이상이면 blocking". Unlike scene/title collisions above, 3+ separate
   * exact-line matches against recent history IS treated as a whole-import
   * block (contributes to `status === 'blocked'`) — a per-track exclusion
   * doesn't fit here (the same systemic-copying signal duplicate/invalid
   * trackNo already hard-blocks on), so this is intentionally NOT folded
   * into duplicateContentTrackNos.
   */
  lyricLineOverlapMatches: { trackNo: number; line: string }[];
  /** Non-empty only when `status === 'blocked'` AND report.blueprint was non-null (i.e. this module's own re-run of validateProviderTrackSet is what blocked it — that's the only remaining 'blocked' reason this module itself can add on top of importSongsJson's own upstream null-blueprint cases, which are already fully described by report.skippedReasons instead). */
  blockedReasons: string[];
}

function normalizeTagText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function leadingBracketTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^\s*\[([^\]]+)\]/);
  return match ? normalizeTagText(match[1]) : null;
}

/** v5.17 (TASK E) — delegates to core/importValidation.ts's resolveEffectiveTrackNo; see core/bridgeImport.ts's claimedTrackNoFor (same delegation) for why this is safe. */
function claimedTrackNoForRaw(raw: unknown, index: number): number {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return resolveEffectiveTrackNo(obj.trackNo, index);
}

/**
 * Real, sourced-from-the-raw-response detection of whether ensureVocalMetaTag
 * (core/vocalPlan.ts — already run once inside importSongsJson's own
 * reconciliation; this function never re-implements or second-guesses its
 * decision, only observes its before/after) actually had to change the
 * top-of-lyrics vocal tag for a track. Simplification, documented rather
 * than silently assumed: only attempted when the raw response and the final
 * pack have the exact same song count — the one case a raw entry (sorted by
 * its own claimed trackNo) can be safely zipped back to its corresponding
 * final, renumbered song without re-deriving importSongsJson's own internal
 * per-song skip bookkeeping (which ImportSongsReport doesn't expose
 * structurally, only as free-text skippedReasons). A response with any
 * missing/skipped track — this task's own driving repairable example —
 * simply reports no correction lines here rather than risk misattributing
 * one to the wrong track; see this file's own header comment for why that
 * trade-off is safe (this check is informational-only either way).
 */
function detectVocalTagCorrections(rawSongs: unknown[], finalSongs: SongIdea[]): { trackNo: number; from: string; to: string }[] {
  if (!rawSongs.length || rawSongs.length !== finalSongs.length) return [];
  const sortedRaw = rawSongs
    .map((raw, index) => ({ raw, trackNo: claimedTrackNoForRaw(raw, index) }))
    .sort((a, b) => a.trackNo - b.trackNo);
  const sortedFinal = [...finalSongs].sort((a, b) => a.trackNo - b.trackNo);
  const corrections: { trackNo: number; from: string; to: string }[] = [];
  sortedFinal.forEach((song, i) => {
    const rawObj = sortedRaw[i]?.raw;
    const rawLyrics = rawObj && typeof rawObj === 'object' ? (rawObj as Record<string, unknown>).lyrics : undefined;
    const rawTag = leadingBracketTag(rawLyrics);
    const finalTag = leadingBracketTag(song.lyrics);
    if (!finalTag || rawTag === finalTag) return;
    // A raw top bracket that isn't itself vocal-ish wording (e.g. "[Verse 1]"
    // on a response that never had a vocal tag at all) is an ADDITION, not a
    // correction of a wrong value — reported as "(없음)" rather than the
    // unrelated structural tag that happened to sit first.
    const rawLooksLikeVocalTag = rawTag ? /vocal|choir|duet/i.test(rawTag) : false;
    corrections.push({ trackNo: song.trackNo, from: rawLooksLikeVocalTag ? rawTag! : '(없음)', to: finalTag });
  });
  return corrections;
}

export function inspectImportReport(
  report: ImportSongsReport,
  rawSongs: unknown[],
  lyricLanguage: LyricLanguage,
  /**
   * TASK (per-workspace Korean floor / bilingual pair auto-detection gap) —
   * optional real context for the language-ratio check below (see
   * core/lyricMetrics.ts's LyricLanguageCheckContext). Both fields are
   * additive: existing callers that only pass the first 3 args keep
   * compiling and keep the pre-existing flat-threshold/auto-detect behavior.
   */
  languageContext?: { archetype?: string; bilingualPair?: BilingualPair },
  /**
   * TASK v5.19 (TASK C) — lowercased leak surface text the user already
   * marked "오탐입니다" earlier THIS SESSION (see App.tsx's
   * artistLeakExemptions/onReportArtistLeakFalsePositive). A leak whose
   * surface is in this set is dropped before it can contribute to
   * artistLeakTrackNos/status — never persisted, never silently
   * auto-applied from anywhere but that explicit per-report click (see this
   * function's own artist-safety block below for where it's consulted).
   */
  sessionExemptions?: Set<string>,
  /**
   * v5.22 (AXIS 1 §1-7) — pre-fetched ledger history (this module never
   * touches IndexedDB itself, same convention as languageContext/
   * sessionExemptions above being pre-resolved by the caller). `historicalTitles`
   * is the channel's full title history (core/hookLedger.ts's usedTitles);
   * `recentSituations`/`recentLyricLines` are core/situationLedger.ts's/
   * core/lyricLineLedger.ts's own recent-N-sets reads. Optional and
   * additive — omitting it (every pre-v5.22 test/call site) skips these 3
   * checks entirely rather than failing.
   */
  duplicationHistory?: { recentSituations: string[]; recentLyricLines: string[]; historicalTitles: Set<string> }
): ImportInspection {
  if (!report.blueprint) {
    return {
      status: 'blocked',
      checks: [
        {
          id: 'structure',
          labelKo: '파일 읽기 / JSON 구조 / trackNo 검사',
          status: 'blocked',
          detail: report.skippedReasons.join(' / ') || '가져오기에 실패했습니다.'
        }
      ],
      requestedCount: report.requestedCount,
      importedCount: 0,
      missingTrackNos: [],
      vocalTagCorrections: [],
      artistLeakTrackNos: [],
      artistLeaks: [],
      duplicateContentTrackNos: [],
      sceneOverlaps: [],
      titleHistoryCollisions: [],
      lyricLineOverlapMatches: [],
      blockedReasons: report.skippedReasons
    };
  }

  const checks: ImportCheckLine[] = [
    { id: 'read', labelKo: '파일 읽기', status: 'pass' },
    { id: 'structure', labelKo: 'JSON 구조 검사', status: 'pass' }
  ];

  // 3. trackNo 집합 검사 — reuses TASK A's validateProviderTrackSet
  // (core/importValidation.ts) directly on the raw pre-normalization
  // entries, exactly the same call importSongsJson already made upstream to
  // decide whether to produce a blueprint at all. Reaching this point with a
  // non-null report.blueprint means that upstream call necessarily already
  // passed — re-running it here isn't a second decision, it's the only way
  // this module can recover TrackSetValidation.missing, which
  // ImportSongsReport itself never exposes.
  const rawTrackNoEntries = rawSongs.map(raw => ({
    trackNo: raw && typeof raw === 'object' ? (raw as Record<string, unknown>).trackNo : undefined
  }));
  const trackSetValidation = validateProviderTrackSet(rawTrackNoEntries, report.requestedCount);
  const missingTrackNos = trackSetValidation.missing;
  checks.push(
    trackSetValidation.valid
      ? {
          id: 'trackNo',
          labelKo: '트랙 번호 정상',
          status: missingTrackNos.length ? 'warn' : 'pass',
          detail: missingTrackNos.length ? `누락: T${missingTrackNos.join(', T')}` : undefined
        }
      : { id: 'trackNo', labelKo: '트랙 번호 구조 오류', status: 'blocked', detail: describeTrackSetValidation(trackSetValidation) }
  );

  // 4. 필수 필드 검사 — already run by bridgeImport.ts's normalizeImportedSong;
  // its per-song failures are already summarized in report.skippedReasons
  // ("<title/#N>": 필수 필드 누락 (...)). Not re-validated here, only surfaced.
  const fieldFailures = report.skippedReasons.filter(reason => reason.includes('필수 필드 누락'));
  checks.push(
    fieldFailures.length
      ? { id: 'requiredFields', labelKo: '필수 필드 검사', status: 'warn', detail: fieldFailures.join(' / ') }
      : { id: 'requiredFields', labelKo: '필수 필드 검사 통과', status: 'pass' }
  );

  // 5. 언어 비율 검사 — reuses v5.13's lyricLanguageMismatchWarning
  // (core/lyricMetrics.ts) per final song; a real ratio-based heuristic, not
  // a re-implementation — this module never recomputes the ratio math itself.
  const languageMismatches = report.blueprint.songs
    .map(song => ({ trackNo: song.trackNo, warning: lyricLanguageMismatchWarning(song.lyrics, lyricLanguage, song.trackNo, languageContext) }))
    .filter((entry): entry is { trackNo: number; warning: string } => Boolean(entry.warning));
  checks.push(
    languageMismatches.length
      ? { id: 'language', labelKo: '언어 검사', status: 'warn', detail: `T${languageMismatches.map(m => m.trackNo).join(', T')} 언어 불일치 의심` }
      : { id: 'language', labelKo: '언어 검사 통과', status: 'pass' }
  );

  // 6. 보컬 태그 검사 — core/vocalPlan.ts's ensureVocalMetaTag/resolveVocalMetaTag
  // already AUTO-CORRECTED a wrong/missing tag inside importSongsJson's own
  // reconciliation, before this module ever runs. This is informational only
  // (see ImportCheckLine.status's own doc comment) — self-healing, never a
  // reason to block or even mark the pack "repairable".
  const vocalTagCorrections = detectVocalTagCorrections(rawSongs, report.blueprint.songs);
  checks.push(
    vocalTagCorrections.length
      ? {
          id: 'vocalTag',
          labelKo: '보컬 태그 불일치 → 자동 교정',
          status: 'info',
          detail: vocalTagCorrections.map(c => `T${c.trackNo}: "${c.from}" → "${c.to}"`).join(' / ')
        }
      : { id: 'vocalTag', labelKo: '보컬 태그 정상', status: 'pass' }
  );

  // 7. 아티스트명·안전 검사 — reuses artistReferenceDecomposer.ts's own
  // findArtistReferenceLeaks (the exact scanner core/albumAudit.ts's
  // auditAlbum already treats as a hard, block-the-copy-action "errors"
  // condition) against every final song's title/stylePrompt/lyrics
  // (title/lyrics scope now require real corroborating context for
  // commonWordRisk seeds — see that function's own doc comment; this is the
  // TASK v5.19 P0 fix for "bread" the food false-blocking a whole pack).
  //
  // TASK v5.19 (TASK C) — a real hit no longer blocks the WHOLE import; it
  // marks only the affected track(s) via artistLeakTrackNos/artistLeaks
  // (folded into hasShortfallOrRepairIssue below, same 'repairable' bucket
  // missing-track shortfalls already use), so App.tsx can offer "[N곡만
  // 확정]" with just those tracks excluded instead of discarding a clean
  // 17-of-18 pack over one track's real (or false-positive) hit.
  const artistLeaks: ArtistLeakDetail[] = [];
  const leakReasons: string[] = [];
  for (const song of report.blueprint.songs) {
    const rawLeaks = [
      ...findArtistReferenceLeaks(song.title, 'title'),
      ...findArtistReferenceLeaks(song.stylePrompt),
      ...findArtistReferenceLeaks(song.lyrics, 'lyrics')
    ];
    const effectiveLeaks = rawLeaks.filter(leak => !sessionExemptions?.has(leak.surface.toLowerCase()));
    if (effectiveLeaks.length) {
      artistLeaks.push({ trackNo: song.trackNo, leaks: effectiveLeaks });
      leakReasons.push(`Track ${song.trackNo}: 아티스트명 노출 감지 (${[...new Set(effectiveLeaks.map(leak => leak.surface))].join(', ')})`);
    }
  }
  const artistLeakTrackNos = artistLeaks.map(entry => entry.trackNo);
  checks.push(
    leakReasons.length
      ? { id: 'artistSafety', labelKo: '아티스트명·안전 검사', status: 'blocked', detail: leakReasons.join(' / ') }
      : { id: 'artistSafety', labelKo: '아티스트명·안전 검사 통과', status: 'pass' }
  );

  // 8. 중복 방지 검사 (v5.22 AXIS 1 §1-7) — reuses core/duplicationGate.ts's
  // pure checks directly, never a re-implementation. Gate 1 (scene/title):
  // same per-track-exclusion treatment as the artist-safety check just
  // above, not a whole-pack block — see duplicateContentTrackNos' own doc
  // comment on ImportInspection for why. Gate 2 (lyric line, 3+): DOES
  // contribute to hardBlocked below — see lyricLineOverlapMatches' own doc
  // comment for why that one case is different.
  const sceneOverlap = duplicationHistory
    ? checkSceneOverlap(report.blueprint.songs, duplicationHistory.recentSituations)
    : { blocking: false, collisions: [] };
  const titleCollision = duplicationHistory
    ? checkTitleHistoryCollision(report.blueprint.songs, duplicationHistory.historicalTitles)
    : { blocking: false, collisions: [] };
  const lyricLineOverlap = duplicationHistory
    ? checkLyricLineOverlap(report.blueprint.songs, duplicationHistory.recentLyricLines)
    : { blocking: false, matches: [] };
  const duplicationReasons: string[] = [
    ...sceneOverlap.collisions.map(c => `Track ${c.trackNo}: 장면이 최근 세트와 중복 ("${c.situation}")`),
    ...titleCollision.collisions.map(c => `Track ${c.trackNo}: 제목이 이전 이력과 완전히 동일 ("${c.title}")`)
  ];
  checks.push(
    duplicationReasons.length
      ? { id: 'duplication', labelKo: '중복 방지 검사 (장면·제목)', status: 'blocked', detail: duplicationReasons.join(' / ') }
      : { id: 'duplication', labelKo: '중복 방지 검사 통과 (장면·제목)', status: 'pass' }
  );
  checks.push(
    lyricLineOverlap.blocking
      ? {
          id: 'lyricLineOverlap',
          labelKo: '가사 문장 중복 검사',
          status: 'blocked',
          detail: `가사 문장 ${lyricLineOverlap.matches.length}개가 최근 세트와 완전일치 (3개 이상 — 전체 응답 신뢰 불가): ${lyricLineOverlap.matches.slice(0, 3).map(m => `T${m.trackNo} "${m.line}"`).join(' / ')}`
        }
      : { id: 'lyricLineOverlap', labelKo: '가사 문장 중복 검사 통과', status: 'pass' }
  );
  const duplicateContentTrackNos = [
    ...new Set([...sceneOverlap.collisions.map(c => c.trackNo), ...titleCollision.collisions.map(c => c.trackNo)])
  ];

  // Only a structurally malformed response (bad JSON / trackNo set) or 3+
  // exact lyric-line matches against recent history (evidence of systemic
  // copying, not a one-track fluke) is unsalvageable enough to discard the
  // whole thing — see this module's own header doc comment on why an
  // artist leak (and, per the same reasoning, a scene/title collision)
  // moved out of this bucket instead.
  const hardBlocked = !trackSetValidation.valid || lyricLineOverlap.blocking;
  const hasShortfallOrRepairIssue =
    missingTrackNos.length > 0 ||
    fieldFailures.length > 0 ||
    languageMismatches.length > 0 ||
    artistLeakTrackNos.length > 0 ||
    duplicateContentTrackNos.length > 0 ||
    report.importedCount !== report.requestedCount;

  const status: ImportStatus = hardBlocked ? 'blocked' : hasShortfallOrRepairIssue ? 'repairable' : 'valid';

  return {
    status,
    checks,
    requestedCount: report.requestedCount,
    importedCount: report.importedCount,
    missingTrackNos,
    vocalTagCorrections,
    artistLeakTrackNos,
    artistLeaks,
    duplicateContentTrackNos,
    sceneOverlaps: sceneOverlap.collisions,
    titleHistoryCollisions: titleCollision.collisions,
    lyricLineOverlapMatches: lyricLineOverlap.matches,
    blockedReasons: hardBlocked
      ? [
          ...(!trackSetValidation.valid ? [describeTrackSetValidation(trackSetValidation)] : []),
          ...(lyricLineOverlap.blocking ? [`가사 문장 ${lyricLineOverlap.matches.length}개가 최근 세트와 중복되어 전체 응답을 신뢰할 수 없습니다.`] : [])
        ]
      : []
  };
}

/**
 * TASK (import transaction) — "[T12 재생성 지시문 복사]": a real, working,
 * intentionally SIMPLE version rather than a full reuse of
 * bridgeInstruction.ts's buildClaudeCodeInstruction. That builder assumes it
 * is describing the WHOLE pack's slot plan (diversity allocations, era
 * palettes, etc. all computed for the full requested count) — slicing it
 * down to only the missing trackNos risks silently wrong section content
 * for a feature whose only job is "tell the agent which tracks to redo".
 * This instead builds a short, self-contained instruction naming exactly the
 * missing tracks and asking for a JSON response in the same
 * songs-output.json shape importSongsJson already parses, honestly scoped
 * rather than pretending to be the full bridge instruction. A genuinely
 * unified "regenerate only these tracks with full pack context" builder is
 * real follow-up work, not implemented here.
 */
export function buildMissingTracksRegenerateInstruction(
  missingTrackNos: number[],
  opts: Pick<GenerationOptions, 'channel' | 'lyricLanguage' | 'songCount'>
): string {
  if (!missingTrackNos.length) return '';
  const trackList = missingTrackNos.map(n => `T${n}`).join(', ');
  return [
    `다음 트랙만 재생성하세요: ${trackList} (채널: ${opts.channel.name}, 전체 ${opts.songCount}곡 중 ${missingTrackNos.length}곡 누락).`,
    `언어: ${opts.lyricLanguage}.`,
    '이전 응답의 나머지 트랙은 이미 정상적으로 반영되었으므로 다시 보내지 마세요.',
    `요청한 trackNo(${trackList})와 정확히 일치하는 값을 각 곡의 "trackNo" 필드에 넣어 반환하세요 — 다른 값이나 중복 값은 전체 응답이 거부됩니다.`,
    '응답은 기존 songs-output.json과 동일한 형식(JSON 객체, "songs" 배열, 각 항목에 title/hookPhrase/stylePrompt/lyrics 포함)으로만 보내세요.'
  ].join('\n');
}

/**
 * TASK v5.19 (TASK C, "[해당 곡 재작곡 지시문 복사]") — same intentionally
 * simple, self-contained shape as buildMissingTracksRegenerateInstruction
 * above (see that function's own doc comment for why this never reuses the
 * full bridgeInstruction.ts builder), but for tracks excluded over an
 * artist/band-name leak rather than a missing trackNo — names the exact
 * word(s) detected so the regenerating agent can avoid them specifically,
 * instead of guessing at what went wrong.
 */
export function buildArtistLeakRegenerateInstruction(
  artistLeaks: ArtistLeakDetail[],
  opts: Pick<GenerationOptions, 'channel' | 'lyricLanguage' | 'songCount'>
): string {
  if (!artistLeaks.length) return '';
  const trackList = artistLeaks.map(entry => `T${entry.trackNo}`).join(', ');
  const detectedWords = [...new Set(artistLeaks.flatMap(entry => entry.leaks.map(leak => leak.surface)))];
  return [
    `다음 트랙만 재작곡하세요: ${trackList} (채널: ${opts.channel.name}, 전체 ${opts.songCount}곡 중 ${artistLeaks.length}곡이 아티스트/밴드명 노출로 제외됨).`,
    `언어: ${opts.lyricLanguage}.`,
    `다음 단어/표현이 실제 아티스트·밴드를 가리키는 것으로 감지되었습니다: ${detectedWords.join(', ')}. 제목·스타일 프롬프트·가사 어디에도 실제 아티스트/밴드명이 들어가지 않도록 다시 작성하세요 (해당 단어의 일반적인 의미로 자연스럽게 쓰는 것은 무방하지만, 밴드/아티스트를 가리키는 표현으로는 쓰지 마세요).`,
    '이전 응답의 나머지 트랙은 이미 정상적으로 반영되었으므로 다시 보내지 마세요.',
    `요청한 trackNo(${trackList})와 정확히 일치하는 값을 각 곡의 "trackNo" 필드에 넣어 반환하세요 — 다른 값이나 중복 값은 전체 응답이 거부됩니다.`,
    '응답은 기존 songs-output.json과 동일한 형식(JSON 객체, "songs" 배열, 각 항목에 title/hookPhrase/stylePrompt/lyrics 포함)으로만 보내세요.'
  ].join('\n');
}
