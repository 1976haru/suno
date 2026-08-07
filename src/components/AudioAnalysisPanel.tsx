import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Music, Upload } from 'lucide-react';
import type { AudienceProfile, SongIdea } from '../types';
import type { FullAudioAnalysis } from '../core/audioAnalysis';
import { analyzeFullAudioFileResponsive } from '../core/audioAnalysisClient';
import { groupMatchesByTrackNo, labelTakesInGroup, matchAudioFileName, type AudioMatchResult } from '../core/audioTrackMatch';
import { buildAudioSetReport, buildVocalDiversityReport, type VocalDiversityEntry } from '../core/audioSetReport';
import { attributesFromSong, getRatingForSong, recordRating, type SongRating } from '../core/ratingLedger';
import { buildTakeDirectives, getTakes, recordTake, setAdopted, type AudioTake } from '../core/audioTakes';
import { buildDirectiveExecutionReport } from '../core/audioDirectiveAnalysis';
import { analyzeAdoption, isNeutralWinRate } from '../core/audioAdoption';
import { getFocusCursor, setFocusCursor } from '../core/library';
import { analyzeAudioMeasurementsFromFile } from '../core/audioMeasurements';
import { evaluateTakeSelectionSafety, canSelectTake, REJECTION_REASONS, isValidRejectionReasonId, type SelectionSafetyIssue } from '../core/audioTakeSelection';

interface AudioAnalysisPanelProps {
  songs: SongIdea[];
  packId: string;
  channelId: string;
  audienceProfile: AudienceProfile;
  /**
   * v3.79 (TASK C/E) — deliberately a callback, not a direct import of the
   * audio-edit panel: this component doesn't need to know an editor exists
   * at all, and stays independently testable/buildable while that panel is
   * developed separately. The parent (Step4Result.tsx) owns wiring this to
   * an actual editor (e.g. opening AudioEditPanel with this file). Omitted
   * entirely, the [편집] button in the "손봐야 할 곡" list just doesn't render.
   */
  onEditTrack?: (trackNo: number, fileName: string, file: File, durationSec: number) => void;
}

const RATING_LABELS_KO: Record<SongRating, string> = { good: '좋음', ok: '보통', bad: '별로' };

function formatMinSec(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.round(totalSec % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function takeIdFor(packId: string, fileName: string): string {
  return `${packId}::${fileName}`;
}

function RmsBarRow({ metrics }: { metrics: FullAudioAnalysis['metrics'] }) {
  const avg = metrics.rmsCurve.reduce((a, b) => a + b, 0) / metrics.rmsCurve.length;
  const minRms = Math.min(...metrics.rmsCurve);
  const maxRms = Math.max(...metrics.rmsCurve);
  const range = Math.max(1, maxRms - minRms);
  return (
    <div className="audio-rms-bar-row" title={`상대 RMS (LUFS 아님) · 진폭 ${metrics.dynamicRange.toFixed(1)}dB`}>
      {metrics.rmsCurve.map((value, idx) => (
        <span key={idx} className={value >= avg ? 'audio-rms-bar loud' : 'audio-rms-bar'} style={{ height: `${8 + ((value - minRms) / range) * 24}px` }} />
      ))}
    </div>
  );
}

/**
 * v4.2 (TASK A) — one track's take-comparison/detail card, factored out of
 * the plain scrollable list below so the new focus mode (one card at a
 * time, auto-advance on adopt) can reuse the exact same markup/logic
 * instead of duplicating it — the only difference between the two modes is
 * which `onAdopt` callback gets passed in (list mode never auto-advances;
 * focus mode's onAdopt also calls goNextFocus, see AudioAnalysisPanel's own
 * adoptTakeAndAdvance).
 */
/** 지시문 11 (TASK F) — renders core/audioTakeSelection.ts's own SelectionSafetyIssue[] as small badges, the same real check adoptTake() enforces server-side (AudioAnalysisPanel's own adoptTake). Shown per-take so a user sees WHY a take can't be adopted before clicking, not just after being refused. */
function ComplianceBadges({ issues }: { issues: SelectionSafetyIssue[] }) {
  if (!issues.length) return <span className="audio-compliance-badge ok">이상 없음</span>;
  return (
    <>
      {issues.map(issue => (
        <span key={issue.id} className={`audio-compliance-badge ${issue.severity}`}>{issue.labelKo}</span>
      ))}
    </>
  );
}

/** 지시문 11 (TASK F) — real gap this closes: this panel could already visualize measured metrics (RMS bars, spectral centroid) but never let a user actually LISTEN to what they uploaded — a take-comparison UI that shows numbers but never plays audio. object URL is created lazily and never revoked eagerly (browser reclaims on navigation) — same lightweight pattern AudioEditPanel's own file preview already uses elsewhere in this app. */
function TakeAudioPlayer({ file }: { file: File | undefined }) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!url) return null;
  return <audio className="audio-take-player" controls preload="none" src={url} />;
}

/** 지시문 11 (TASK F) — REJECTION_REASONS 피커: 실제로 AudioTake.rejectionReasons에 반영되는 실제 저장 동작(recordTake upsert), 장식용 체크박스가 아니다. */
function RejectionReasonPicker({ take, onReject }: { take: AudioTake | undefined; onReject: (id: string) => void }) {
  if (!take) return null;
  const selected = new Set(take.rejectionReasons ?? []);
  return (
    <details className="audio-rejection-picker">
      <summary className="supporting">탈락 사유{selected.size ? ` (${selected.size})` : ''}</summary>
      <div className="button-row">
        {REJECTION_REASONS.map(reason => (
          <button
            key={reason.id}
            type="button"
            className={selected.has(reason.id) ? 'chip active' : 'chip'}
            onClick={() => onReject(reason.id)}
          >
            {reason.labelKo}
          </button>
        ))}
      </div>
    </details>
  );
}

function TrackDetailCard({
  trackNo,
  title,
  metrics,
  takes,
  analysesByFileName,
  adoptedFileName,
  full,
  rating,
  channelTakes,
  filesByName,
  onAdopt,
  onRate,
  onToggleRejectionReason
}: {
  trackNo: number;
  title: string;
  metrics: FullAudioAnalysis['metrics'];
  takes: ReturnType<typeof labelTakesInGroup>;
  analysesByFileName: Map<string, FullAudioAnalysis>;
  adoptedFileName: string | undefined;
  full: FullAudioAnalysis | undefined;
  rating: SongRating | undefined;
  /** 지시문 11 (TASK F) — persisted AudioTake records for this song, so real measurements/compliance can be looked up per take (analysesByFileName only ever carries the ephemeral in-session analysis, never `measurements`). */
  channelTakes: AudioTake[];
  filesByName: Map<string, File>;
  onAdopt: (trackNo: number, fileName: string) => void;
  onRate?: (rating: SongRating) => void;
  onToggleRejectionReason?: (take: AudioTake, reasonId: string) => void;
}) {
  const findTake = (fileName: string) => channelTakes.find(t => t.fileName === fileName && t.trackNo === trackNo);
  return (
    <>
      <div className="section-head">
        <b>T{trackNo} {title}</b>
      </div>

      {takes.length > 1 ? (
        <div className="audio-take-compare">
          {takes.map(take => {
            const takeFull = analysesByFileName.get(take.fileName);
            if (!takeFull) return null;
            const isAdopted = adoptedFileName === take.fileName;
            const persistedTake = findTake(take.fileName);
            const issues = persistedTake ? evaluateTakeSelectionSafety(persistedTake) : [{ id: 'no-measurements', labelKo: '측정값 없이 선택되었습니다.', severity: 'blocking' as const }];
            const blocked = issues.some(i => i.severity === 'blocking');
            return (
              <div key={take.fileName} className={isAdopted ? 'audio-take-card adopted' : 'audio-take-card'}>
                <div className="section-head">
                  <b>{take.versionLabel}버전{isAdopted ? ' ●채택' : ''}</b>
                  <span className="supporting">{formatMinSec(takeFull.metrics.durationSec)}</span>
                </div>
                <RmsBarRow metrics={takeFull.metrics} />
                <p className="supporting">
                  진폭 {takeFull.metrics.dynamicRange.toFixed(1)}dB · 믹스중심(보컬대역) {Math.round(takeFull.vocalMetrics.vocalCentroid)}Hz ·
                  템포 {takeFull.tempoEstimate.confidence >= 0.4 ? `${Math.round(takeFull.tempoEstimate.bpm)} BPM` : '신뢰도 낮음'}
                </p>
                <TakeAudioPlayer file={filesByName.get(take.fileName)} />
                <div><ComplianceBadges issues={issues} /></div>
                <button type="button" className={isAdopted ? 'chip active' : 'chip'} disabled={blocked && !isAdopted} onClick={() => onAdopt(trackNo, take.fileName)}>
                  {take.versionLabel} 채택
                </button>
                {onToggleRejectionReason && persistedTake && (
                  <RejectionReasonPicker take={persistedTake} onReject={id => onToggleRejectionReason(persistedTake, id)} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        full && (
          <>
            <RmsBarRow metrics={full.metrics} />
            <p className="supporting">
              최대 구간 {Math.round(metrics.peakPosition * (metrics.rmsCurve.length - 1)) + 1}/{metrics.rmsCurve.length} · 진폭 {metrics.dynamicRange.toFixed(1)}dB ·
              중심 {Math.round(metrics.spectralCentroid)}Hz · 믹스중심(보컬대역) {Math.round(full.vocalMetrics.vocalCentroid)}Hz ·
              템포 {full.tempoEstimate.confidence >= 0.4 ? `${Math.round(full.tempoEstimate.bpm)} BPM` : '신뢰도 낮음'}
            </p>
            {adoptedFileName && <TakeAudioPlayer file={filesByName.get(adoptedFileName)} />}
            {adoptedFileName && (() => {
              const persistedTake = findTake(adoptedFileName);
              const issues = persistedTake ? evaluateTakeSelectionSafety(persistedTake) : [];
              return (
                <>
                  <div><ComplianceBadges issues={issues} /></div>
                  {onToggleRejectionReason && persistedTake && (
                    <RejectionReasonPicker take={persistedTake} onReject={id => onToggleRejectionReason(persistedTake, id)} />
                  )}
                </>
              );
            })()}
          </>
        )
      )}

      {onRate && (
        <div className="button-row">
          <button type="button" className={rating === 'good' ? 'chip active' : 'chip'} onClick={() => onRate('good')}>👍 좋음</button>
          <button type="button" className={rating === 'ok' ? 'chip active' : 'chip'} onClick={() => onRate('ok')}>🤷 보통</button>
          <button type="button" className={rating === 'bad' ? 'chip active' : 'chip'} onClick={() => onRate('bad')}>👎 별로</button>
          {rating && <span className="supporting">{RATING_LABELS_KO[rating]}</span>}
        </div>
      )}
    </>
  );
}

/**
 * TASK v3.73/v3.74 — the UI entry point for browser-in mp3 analysis. Still
 * processes one file at a time (sequential `for...of` + `await`, never
 * Promise.all — TASK A's own "한 곡씩 처리하고 즉시 해제하십시오").
 *
 * TASK v3.74 additions: records every analyzed+matched file as a persisted
 * AudioTake (core/audioTakes.ts, not just ephemeral component state), a
 * real A/B take-comparison view, a 200-3500Hz vocal-band diversity section,
 * and a channel-wide "무엇이 통하나" learning-results section
 * (core/audioAdoption.ts + core/audioDirectiveAnalysis.ts).
 */
export default function AudioAnalysisPanel({ songs, packId, channelId, audienceProfile, onEditTrack }: AudioAnalysisPanelProps) {
  const [analysesByFileName, setAnalysesByFileName] = useState<Map<string, FullAudioAnalysis>>(new Map());
  const [matches, setMatches] = useState<AudioMatchResult[]>([]);
  const [adoptedFileNameByTrack, setAdoptedFileNameByTrack] = useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  /** 지시문 11 (TASK F) — adoptTake's own blocking-refusal / warning-surface message. Separate from `error` (file-analysis failures) since this is about a SELECTION decision, not an upload failure. */
  const [takeWarning, setTakeWarning] = useState('');
  const [ratings, setRatings] = useState<Record<string, SongRating>>({});
  const [dragOver, setDragOver] = useState(false);
  const [channelTakes, setChannelTakes] = useState<AudioTake[]>([]);
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // v3.79 (TASK C) — raw File kept alongside the decoded analysis so a
  // [편집] click (onEditTrack) can hand the ORIGINAL bytes to an audio
  // editor without re-prompting the user to re-upload the file.
  const [filesByName, setFilesByName] = useState<Map<string, File>>(new Map());
  // v3.79 (TASK C) — per-file manually-picked trackNo for files
  // matchAudioFileName couldn't resolve (matchMethod 'none'), keyed by
  // fileName; applied via assignManualTrack below (spec's own "매칭 실패 파일...
  // 수동 지정 UI").
  const [manualTrackPick, setManualTrackPick] = useState<Record<string, number>>({});
  // v4.2 (TASK A) — "포커스 모드": one track at a time instead of the
  // scrollable list, with adopting auto-advancing (spec's own "채택하면
  // 자동으로 다음 곡"). focusIndex is a position into `adoptedMetrics`
  // (already sorted by trackNo); persisted as a trackNo via
  // core/library.ts's getFocusCursor/setFocusCursor so closing and
  // reopening this panel resumes at the same track instead of always
  // restarting at the first one.
  const [focusMode, setFocusMode] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [persistedCursorTrackNo, setPersistedCursorTrackNo] = useState<number | undefined>(undefined);
  const [cursorApplied, setCursorApplied] = useState(false);

  const candidates = useMemo(() => songs.map(s => ({ trackNo: s.trackNo, title: s.title })), [songs]);

  function loadChannelTakes() {
    void getTakes({ channelId }).then(setChannelTakes).catch(() => setChannelTakes([]));
  }
  useEffect(loadChannelTakes, [channelId]);

  async function analyzeFiles(files: File[]) {
    const audioFiles = files.filter(f => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f.name));
    if (!audioFiles.length) {
      setError('오디오 파일(mp3/wav/m4a/flac/ogg)이 없습니다.');
      return;
    }
    setError('');
    setAnalyzing(true);
    setProgress({ done: 0, total: audioFiles.length });

    const nextAnalyses = new Map(analysesByFileName);
    const nextMatches: AudioMatchResult[] = [...matches];
    const nextFiles = new Map(filesByName);

    // Sequential — never Promise.all across the whole batch. Each
    // analyzeFullAudioFileResponsive() call's decoded buffers go out of
    // scope as soon as this iteration ends, so only one file's PCM is ever
    // live at a time. v4.0 (TASK A) — the FFT/DSP pass itself now runs in a
    // Worker (see core/audioAnalysisClient.ts); an 18-take batch's worth of
    // hand-rolled FFT was a real main-thread freeze risk.
    for (const file of audioFiles) {
      try {
        const full = await analyzeFullAudioFileResponsive(file);
        const match = matchAudioFileName(file.name, candidates);
        full.metrics.matchedTrackNo = match.trackNo;
        const song = match.trackNo !== undefined ? songs.find(s => s.trackNo === match.trackNo) : undefined;
        full.metrics.matchedSongId = song?.songId;
        nextAnalyses.set(file.name, full);
        nextMatches.push(match);
        nextFiles.set(file.name, file);

        if (song?.songId) {
          // 지시문 11 (TASK F) — real gap this closes: core/audioMeasurements.ts's
          // analyzeAudioMeasurementsFromFile (clipping/silence/stereo-width/
          // real sample rate) already existed as a tested, pure-cored module
          // but nothing in this panel ever called it, so every recorded
          // AudioTake.measurements stayed undefined — the exact state
          // core/audioTakeSelection.ts's evaluateTakeSelectionSafety treats
          // as an unconditional blocking issue ("선택할 수 없음: 측정값
          // 없음"). Reuses full.tempoEstimate (already computed by the
          // spectral pass above) so BPM is never computed twice over the
          // same audio. Failure here (corrupt file, decode edge case)
          // degrades to undefined measurements rather than losing the take
          // entirely — the take is still recorded and visible, just
          // correctly blocked from selection until re-analyzed.
          const measurements = await analyzeAudioMeasurementsFromFile(file, full.tempoEstimate).catch(() => undefined);
          const take: AudioTake = {
            takeId: takeIdFor(packId, file.name),
            songId: song.songId,
            trackNo: song.trackNo,
            packId,
            channelId,
            fileName: file.name,
            versionLabel: 'A', // recomputed below once the whole group for this trackNo is known
            adopted: false,
            metrics: full.metrics,
            vocalMetrics: full.vocalMetrics,
            tempoEstimate: full.tempoEstimate,
            directives: buildTakeDirectives(song, audienceProfile),
            analyzedAt: new Date().toISOString(),
            source: 'upload',
            ...(measurements ? { measurements } : {})
          };
          await recordTake(take);
        }
      } catch {
        setError(prev => (prev ? `${prev}\n"${file.name}" 분석 실패 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.` : `"${file.name}" 분석 실패 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.`));
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setAnalysesByFileName(nextAnalyses);
    setMatches(nextMatches);
    setFilesByName(nextFiles);
    // Default-adopt the first file seen for each trackNo; a user can switch
    // takes below when Suno produced more than one version.
    setAdoptedFileNameByTrack(prev => {
      const next = { ...prev };
      for (const match of nextMatches) {
        if (match.trackNo !== undefined && !(match.trackNo in next)) next[match.trackNo] = match.fileName;
      }
      return next;
    });
    setAnalyzing(false);
    loadChannelTakes();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void analyzeFiles(Array.from(event.dataTransfer.files));
  }

  /**
   * v3.79 (TASK C) — the spec's own §3-3 "매칭 실패 파일은 상단에 크게 표시하고
   * 수동 지정 UI 제공". A file matchAudioFileName couldn't resolve (no leading
   * track number, no exact title match — e.g. "Keep Close My Friend.mp3")
   * gets assigned to a trackNo the user picks by hand, then flows through
   * the exact same match/adopt/take-recording pipeline as an automatic
   * match — no separate code path downstream needs to know it was manual.
   */
  async function assignManualTrack(fileName: string, trackNo: number) {
    setMatches(prev => prev.map(m => (m.fileName === fileName ? { ...m, trackNo, matchMethod: 'title' as const } : m)));
    const full = analysesByFileName.get(fileName);
    const song = songs.find(s => s.trackNo === trackNo);
    if (full) {
      const updated: FullAudioAnalysis = { ...full, metrics: { ...full.metrics, matchedTrackNo: trackNo, matchedSongId: song?.songId } };
      setAnalysesByFileName(prev => new Map(prev).set(fileName, updated));
      if (song?.songId) {
        const rawFile = filesByName.get(fileName);
        const measurements = rawFile ? await analyzeAudioMeasurementsFromFile(rawFile, updated.tempoEstimate).catch(() => undefined) : undefined;
        const take: AudioTake = {
          takeId: takeIdFor(packId, fileName),
          songId: song.songId,
          trackNo: song.trackNo,
          packId,
          channelId,
          fileName,
          versionLabel: 'A',
          adopted: false,
          metrics: updated.metrics,
          vocalMetrics: updated.vocalMetrics,
          tempoEstimate: updated.tempoEstimate,
          directives: buildTakeDirectives(song, audienceProfile),
          analyzedAt: new Date().toISOString(),
          source: 'upload',
          ...(measurements ? { measurements } : {})
        };
        await recordTake(take);
        loadChannelTakes();
      }
    }
    setAdoptedFileNameByTrack(prev => (trackNo in prev ? prev : { ...prev, [trackNo]: fileName }));
    setManualTrackPick(prev => { const next = { ...prev }; delete next[fileName]; return next; });
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    void analyzeFiles(files);
  }

  /**
   * 지시문 11 (TASK F) — the real gate core/audioTakeSelection.ts's own doc
   * comment describes ("selected take without measurements = 0", "clipped
   * selected take = 0") applied here, the one place this panel actually
   * persists an adoption. A blocking issue (no measurements yet, or real
   * clipping) refuses the adoption outright — the take stays visible and
   * comparable, just not selectable until it's re-analyzed or replaced. A
   * warning (plausible vocal-gender mismatch) never blocks — it's surfaced
   * via `takeWarning` and the adoption proceeds, matching
   * evaluateTakeSelectionSafety's own "warning is IN the return value, so a
   * caller can't forget to show it" design.
   */
  async function adoptTake(trackNo: number, fileName: string) {
    const takeId = takeIdFor(packId, fileName);
    const take = channelTakes.find(t => t.takeId === takeId);
    const issues = take ? evaluateTakeSelectionSafety(take) : [];
    const blocking = issues.find(i => i.severity === 'blocking');
    if (blocking) {
      setTakeWarning(`선택할 수 없습니다 — ${blocking.labelKo}`);
      return;
    }
    const warning = issues.find(i => i.severity === 'warning');
    setTakeWarning(warning ? warning.labelKo : '');
    setAdoptedFileNameByTrack(prev => ({ ...prev, [trackNo]: fileName }));
    try {
      await setAdopted(takeId);
    } catch {
      // best-effort — the local "which take is shown" state above still updates either way.
    }
    loadChannelTakes();
  }

  /** 지시문 11 (TASK F) — real persistence, not a decorative checkbox: toggles one rejection reason on this take (recordTake is an upsert keyed by takeId — see core/audioTakes.ts's own recordTake doc comment) and reloads so every card reflects the saved state. */
  async function toggleRejectionReason(take: AudioTake, reasonId: string) {
    if (!isValidRejectionReasonId(reasonId)) return;
    const current = new Set(take.rejectionReasons ?? []);
    if (current.has(reasonId)) current.delete(reasonId); else current.add(reasonId);
    await recordTake({ ...take, rejectionReasons: [...current] });
    loadChannelTakes();
  }

  /** v4.2 (TASK A) — focus mode's own adopt handler: same adoptTake, plus the spec's own "채택하면 자동으로 다음 곡" auto-advance. List mode keeps calling plain adoptTake (unchanged behavior). */
  async function adoptTakeAndAdvance(trackNo: number, fileName: string) {
    await adoptTake(trackNo, fileName);
    goNextFocus();
  }

  const matchGroups = useMemo(() => groupMatchesByTrackNo(matches), [matches]);
  const labeledGroups = useMemo(() => {
    const labeled = new Map<number, ReturnType<typeof labelTakesInGroup>>();
    for (const [trackNo, group] of matchGroups) labeled.set(trackNo, labelTakesInGroup(group));
    return labeled;
  }, [matchGroups]);

  const adoptedMetrics = useMemo(() => {
    const list: FullAudioAnalysis['metrics'][] = [];
    for (const [trackNo, fileName] of Object.entries(adoptedFileNameByTrack)) {
      const full = analysesByFileName.get(fileName);
      if (full) list.push({ ...full.metrics, matchedTrackNo: Number(trackNo) });
    }
    return list.sort((a, b) => (a.matchedTrackNo ?? 0) - (b.matchedTrackNo ?? 0));
  }, [adoptedFileNameByTrack, analysesByFileName]);

  useEffect(() => {
    void getFocusCursor(packId).then(setPersistedCursorTrackNo);
  }, [packId]);

  // Applies the persisted cursor exactly once, as soon as adoptedMetrics
  // has the track it points at — analysis happens client-side after mount,
  // so the list is typically still empty when the cursor itself finishes
  // loading.
  useEffect(() => {
    if (cursorApplied || persistedCursorTrackNo === undefined || !adoptedMetrics.length) return;
    const idx = adoptedMetrics.findIndex(m => m.matchedTrackNo === persistedCursorTrackNo);
    if (idx >= 0) setFocusIndex(idx);
    setCursorApplied(true);
  }, [cursorApplied, persistedCursorTrackNo, adoptedMetrics]);

  function goToFocusIndex(index: number) {
    const clamped = Math.max(0, Math.min(adoptedMetrics.length - 1, index));
    setFocusIndex(clamped);
    const trackNo = adoptedMetrics[clamped]?.matchedTrackNo;
    if (trackNo !== undefined) void setFocusCursor(packId, trackNo);
  }
  function goNextFocus() {
    goToFocusIndex(focusIndex + 1);
  }
  function goPrevFocus() {
    goToFocusIndex(focusIndex - 1);
  }

  // v3.75 (TASK B) — a track with no designed killing point has no
  // amplitude/late-peak expectation at all (this task's own spec: "킬링포인트가
  // 없는 곡: 진폭 제한 없음, 평평해도 됩니다") — see buildAudioSetReport's own doc
  // comment for why judging every track against the same bar both mis-flags
  // legitimately-flat non-peak tracks and dilutes the peak-share stat.
  const killingPointTrackNos = useMemo(
    () => new Set(songs.filter(song => song.killingPointId).map(song => song.trackNo)),
    [songs]
  );
  const report = useMemo(
    () => buildAudioSetReport(adoptedMetrics, songs.length, audienceProfile, killingPointTrackNos),
    [adoptedMetrics, songs.length, audienceProfile, killingPointTrackNos]
  );

  const vocalReport = useMemo(() => {
    const entries: VocalDiversityEntry[] = [];
    for (const [trackNo, fileName] of Object.entries(adoptedFileNameByTrack)) {
      const full = analysesByFileName.get(fileName);
      const song = songs.find(s => s.trackNo === Number(trackNo));
      if (full) entries.push({ trackNo: Number(trackNo), vocalType: song?.vocalType ?? 'unknown', vocalCentroid: full.vocalMetrics.vocalCentroid, vocalProfile: full.vocalMetrics.vocalProfile });
    }
    return buildVocalDiversityReport(entries.sort((a, b) => a.trackNo - b.trackNo));
  }, [adoptedFileNameByTrack, analysesByFileName, songs]);

  const adoptionInsights = useMemo(() => analyzeAdoption(channelTakes), [channelTakes]);
  const executionEntries = useMemo(() => buildDirectiveExecutionReport(channelTakes), [channelTakes]);

  const unmatchedFiles = matches.filter(m => m.trackNo === undefined);

  /**
   * v3.79 (TASK C) — "판정을 먼저, 숫자는 접어두기" (verdict first, numbers
   * tucked away). Real feedback on the pre-existing screen: "초보 입장에서
   * 뭐가 뭔지 잘 모르겠어" — it only ever printed raw numbers ("중심 주파수 폭
   * 1568Hz") with no judgment attached. This derives a plain-language
   * verdict from the exact same report/vocalReport data the old screen
   * already computed — no new measurement, just interpretation.
   */
  const verdict = useMemo(() => {
    type ProblemTrack = { trackNo: number; title: string; durationSec: number; kind: 'over' | 'under'; severe: boolean; suggestTrimSec?: number; fileName?: string };
    const problems: ProblemTrack[] = [];
    const [targetLow, targetHigh] = report.duration.targetRange;
    const SEVERE_DIFF_SEC = 30;
    for (const trackNo of report.duration.overTarget) {
      const durationSec = report.duration.values[trackNo];
      const diff = durationSec - targetHigh;
      problems.push({
        trackNo,
        title: songs.find(s => s.trackNo === trackNo)?.title ?? '',
        durationSec,
        kind: 'over',
        severe: diff > SEVERE_DIFF_SEC,
        suggestTrimSec: Math.max(10, Math.ceil(diff / 10) * 10),
        fileName: adoptedFileNameByTrack[trackNo]
      });
    }
    for (const trackNo of report.duration.underTarget) {
      const durationSec = report.duration.values[trackNo];
      const diff = targetLow - durationSec;
      problems.push({ trackNo, title: songs.find(s => s.trackNo === trackNo)?.title ?? '', durationSec, kind: 'under', severe: diff > SEVERE_DIFF_SEC });
    }
    problems.sort((a, b) => a.trackNo - b.trackNo);

    const positives: string[] = [];
    const reliableBpms: number[] = [];
    for (const fileName of Object.values(adoptedFileNameByTrack)) {
      const full = analysesByFileName.get(fileName);
      if (full && full.tempoEstimate.confidence >= 0.4) reliableBpms.push(full.tempoEstimate.bpm);
    }
    if (reliableBpms.length >= 2) {
      positives.push(`템포가 잘 퍼졌습니다 (${Math.round(Math.min(...reliableBpms))}~${Math.round(Math.max(...reliableBpms))} BPM)`);
    }
    if (report.analyzedCount > 1 && report.level.spread <= 3) {
      positives.push('음량이 균일합니다 (편집 시 볼륨 조정 불필요)');
    }

    const passCount = Math.max(0, report.analyzedCount - problems.length);
    const okShare = report.analyzedCount > 0 ? passCount / report.analyzedCount : 1;

    return { problems, positives, passCount, okShare, noLatePeak: report.killingPoint.noLatePeakTracks };
  }, [report, songs, adoptedFileNameByTrack, analysesByFileName]);

  async function rateTrack(metrics: FullAudioAnalysis['metrics'], rating: SongRating) {
    const song = songs.find(s => s.trackNo === metrics.matchedTrackNo);
    if (!song?.songId) return;
    await recordRating({
      songId: song.songId,
      packId,
      rating,
      ratedAt: new Date().toISOString(),
      attributes: attributesFromSong(song, channelId, {
        durationSec: metrics.durationSec,
        peakPosition: metrics.peakPosition,
        dynamicRange: metrics.dynamicRange,
        spectralCentroid: metrics.spectralCentroid,
        lowBandRatio: metrics.lowBandRatio,
        overallLevel: metrics.overallLevel
      })
    });
    setRatings(prev => ({ ...prev, [song.songId!]: rating }));
  }

  useEffect(() => {
    // Load any existing ratings once per pack, so re-opening this panel shows prior state.
    let cancelled = false;
    void Promise.all(songs.map(s => (s.songId ? getRatingForSong(s.songId) : Promise.resolve(null)))).then(records => {
      if (cancelled) return;
      const next: Record<string, SongRating> = {};
      records.forEach((record, i) => {
        const songId = songs[i]?.songId;
        if (record && songId) next[songId] = record.rating;
      });
      setRatings(next);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  return (
    <div className="option-block audio-analysis-panel">
      <div className="section-head">
        <h3><Music size={16} style={{ verticalAlign: '-2px', marginRight: 4 }} />음원 분석</h3>
        <span className="supporting">{report.analyzedCount}/{report.totalTracks}곡 분석됨</span>
      </div>

      <p className="callout">
        ⓘ 이 분석은 음색·다이내믹·길이를 측정합니다. 멜로디·화성·가사·곡의 좋고 나쁨은 측정하지 않습니다.
        귀로 듣는 판단을 대체하지 않고 보조합니다. 파일은 브라우저 밖으로 나가지 않습니다.
      </p>

      <div
        className={dragOver ? 'audio-drop-zone drag-over' : 'audio-drop-zone'}
        onDragOver={event => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload size={20} />
        <p>수노에서 받은 mp3 파일(A/B 2버전 포함)을 여기로 드래그하거나</p>
        <label className="chip">
          파일 선택
          <input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg" multiple onChange={handleFileInput} style={{ display: 'none' }} />
        </label>
      </div>

      {analyzing && <p className="supporting">분석 중... {progress.done}/{progress.total}곡</p>}
      {error && <p className="error" style={{ whiteSpace: 'pre-line' }}>{error}</p>}
      {takeWarning && <p className="audio-take-warning">{takeWarning}</p>}

      {unmatchedFiles.length > 0 && (
        <div className="error">
          <b><AlertTriangle size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />매칭 실패 {unmatchedFiles.length}곡 — 트랙 번호를 직접 지정하세요</b>
          {unmatchedFiles.map(m => (
            <div key={m.fileName} className="button-row" style={{ marginTop: 6, alignItems: 'center' }}>
              <span className="supporting">"{m.fileName}" — 파일명에서 트랙을 알아내지 못했습니다. 제목으로 매칭하십시오.</span>
              <select
                value={manualTrackPick[m.fileName] ?? ''}
                onChange={event => setManualTrackPick(prev => ({ ...prev, [m.fileName]: Number(event.target.value) }))}
              >
                <option value="" disabled>트랙 선택</option>
                {songs.map(s => (
                  <option key={s.trackNo} value={s.trackNo}>T{s.trackNo} {s.title}</option>
                ))}
              </select>
              <button
                type="button"
                className="chip"
                disabled={!manualTrackPick[m.fileName]}
                onClick={() => void assignManualTrack(m.fileName, manualTrackPick[m.fileName])}
              >
                적용
              </button>
            </div>
          ))}
        </div>
      )}

      {report.analyzedCount > 0 && (
        <>
          <div className={verdict.problems.length === 0 ? 'provider-summary design-gate-panel passed' : 'error design-gate-panel failed'}>
            <div className="section-head">
              {verdict.problems.length === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <b>{verdict.problems.length === 0 ? '이 세트는 쓸 만합니다 ✅' : `${report.analyzedCount}곡 중 ${verdict.passCount}곡 통과`}</b>
            </div>

            {verdict.problems.length > 0 && (
              <div className="design-gate-issue-list">
                <p className="supporting" style={{ marginTop: 0 }}>손봐야 할 곡 {verdict.problems.length}개</p>
                {verdict.problems.map(p => (
                  <div key={p.trackNo} className="design-gate-issue">
                    <div>
                      <b>T{p.trackNo} {p.title}</b>
                      <span className="supporting"> {formatMinSec(p.durationSec)}</span>
                    </div>
                    <p className="supporting">
                      {p.kind === 'over' ? (p.severe ? '너무 깁니다' : '조금 깁니다') : (p.severe ? '많이 짧습니다' : '조금 짧습니다')}
                      {p.kind === 'over' && p.suggestTrimSec ? ` → ${p.suggestTrimSec}초 줄이면 좋겠습니다` : ''}
                    </p>
                    {p.kind === 'over' && onEditTrack && p.fileName && filesByName.get(p.fileName) && (
                      <button type="button" className="chip" onClick={() => onEditTrack(p.trackNo, p.fileName!, filesByName.get(p.fileName!)!, p.durationSec)}>
                        편집
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {verdict.noLatePeak.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p className="supporting" style={{ marginBottom: 2 }}>아쉬운 점</p>
                <p className="supporting">
                  후반이 안 올라가는 곡 {verdict.noLatePeak.length}개 (T{verdict.noLatePeak.join(', T')})
                  <br />→ 마지막 후렴에서 고조되는 느낌이 약합니다.
                </p>
              </div>
            )}

            {verdict.positives.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p className="supporting" style={{ marginBottom: 2 }}>잘 나온 것</p>
                {verdict.positives.map(text => <p key={text} className="supporting">{text}</p>)}
              </div>
            )}
          </div>

          <details className="audio-detail-numbers" open={detailsOpen} onToggle={event => setDetailsOpen((event.target as HTMLDetailsElement).open)}>
            <summary>
              상세 수치 보기 <ChevronDown size={13} style={{ verticalAlign: '-2px' }} />
            </summary>

          <div className="option-block compact">
            <h4>길이</h4>
            <p className="supporting">
              목표 {formatMinSec(report.duration.targetRange[0])}~{formatMinSec(report.duration.targetRange[1])}
              {report.duration.overTarget.length > 0 && ` · 초과 ${report.duration.overTarget.length}곡`}
              {report.duration.underTarget.length > 0 && ` · 미달 ${report.duration.underTarget.length}곡`}
            </p>
            <div className="chips">
              {Object.entries(report.duration.values).map(([trackNo, sec]) => (
                <span key={trackNo} className={report.duration.overTarget.includes(Number(trackNo)) || report.duration.underTarget.includes(Number(trackNo)) ? 'chip error' : 'chip'}>
                  T{trackNo} {formatMinSec(sec)}
                </span>
              ))}
            </div>
          </div>

          <div className="option-block compact">
            <h4>킬링포인트</h4>
            <p className="supporting">
              후반 상승 있음 {report.killingPoint.latePeakTracks.length}곡 (T{report.killingPoint.latePeakTracks.join(', T')})
              {report.killingPoint.noLatePeakTracks.length > 0 && ` · 후반 상승 없음 ${report.killingPoint.noLatePeakTracks.length}곡 (T${report.killingPoint.noLatePeakTracks.join(', T')})`}
            </p>
            {report.killingPoint.weakDynamicTracks.length > 0 && (
              <p className="supporting">진폭 부족(&lt;6dB) {report.killingPoint.weakDynamicTracks.length}곡: T{report.killingPoint.weakDynamicTracks.join(', T')}</p>
            )}
            <p className="supporting">※ 킬링포인트가 직접 검증된 것은 아니며, "후반 상승" 여부를 대리 지표로 봅니다.</p>
          </div>

          <div className="option-block compact">
            <h4>전체 믹스 밝기 다양성</h4>
            <p className="supporting">중심 주파수 폭 {Math.round(report.timbre.centroidSpread)}Hz · 세트 평균 유사도 {report.timbre.meanSimilarity.toFixed(2)}</p>
            <p className="supporting">ⓘ 편곡·믹스 다양성 참고용 수치입니다. 목소리가 같다/다르다는 판단에는 쓰지 않습니다.</p>
          </div>

          <div className="option-block compact">
            <h4>믹스 중심 주파수 분포 (보컬 대역)</h4>
            <p className="supporting">ⓘ 반주가 일부 섞인 200-3500Hz 대역 분석입니다 — 목소리 자체가 아니라 이 대역의 믹스 밝기입니다. 곡 간 상대 비교·편곡 다양성 참고용입니다.</p>
            {vocalReport.sameTypeSpread.map(({ vocalType, spread, count }) => (
              <p key={vocalType} className="supporting">{vocalType} {count}곡 · 중심 폭 {Math.round(spread)}Hz</p>
            ))}
            {vocalReport.advisories.map(text => <p key={text} className="supporting">ⓘ {text}</p>)}
          </div>

          <div className="option-block compact">
            <h4>음량</h4>
            <p className="supporting">편차 {report.level.spread.toFixed(1)}dB {report.level.spread <= 3 ? '— 균일함 ✅' : '— 편차 있음 ⚠'}</p>
          </div>
          </details>

          <div className="option-block">
            <div className="section-head">
              <h4>테이크 비교 / 곡별 상세</h4>
              <button type="button" className={focusMode ? 'chip active' : 'chip'} onClick={() => setFocusMode(v => !v)}>
                {focusMode ? '목록 보기' : '포커스 모드'}
              </button>
            </div>

            {focusMode ? (
              (() => {
                const clampedIndex = Math.max(0, Math.min(focusIndex, adoptedMetrics.length - 1));
                const metrics = adoptedMetrics[clampedIndex];
                if (!metrics) return <p className="supporting">아직 분석된 곡이 없습니다.</p>;
                const trackNo = metrics.matchedTrackNo!;
                const song = songs.find(s => s.trackNo === trackNo);
                const takes = labeledGroups.get(trackNo) ?? [];
                const full = analysesByFileName.get(adoptedFileNameByTrack[trackNo]);
                return (
                  <div className="option-block compact audio-track-detail audio-focus-card">
                    <div className="focus-mode-nav">
                      <button type="button" className="focus-nav-button" disabled={clampedIndex === 0} onClick={goPrevFocus}>
                        <ChevronLeft size={22} />
                      </button>
                      <p className="supporting" style={{ margin: 0 }}>{clampedIndex + 1} / {adoptedMetrics.length}</p>
                      <button type="button" className="focus-nav-button" disabled={clampedIndex === adoptedMetrics.length - 1} onClick={goNextFocus}>
                        <ChevronRight size={22} />
                      </button>
                    </div>
                    <TrackDetailCard
                      trackNo={trackNo}
                      title={song?.title ?? metrics.fileName}
                      metrics={metrics}
                      takes={takes}
                      analysesByFileName={analysesByFileName}
                      adoptedFileName={adoptedFileNameByTrack[trackNo]}
                      full={full}
                      rating={song?.songId ? ratings[song.songId] : undefined}
                      channelTakes={channelTakes}
                      filesByName={filesByName}
                      onAdopt={(t, fileName) => void adoptTakeAndAdvance(t, fileName)}
                      onRate={song?.songId ? rating => void rateTrack(metrics, rating) : undefined}
                      onToggleRejectionReason={(take, id) => void toggleRejectionReason(take, id)}
                    />
                    <div className="button-row">
                      <button type="button" className="chip" onClick={goNextFocus} disabled={clampedIndex === adoptedMetrics.length - 1}>
                        건너뛰기 →
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              adoptedMetrics.map(metrics => {
                const trackNo = metrics.matchedTrackNo!;
                const song = songs.find(s => s.trackNo === trackNo);
                const takes = labeledGroups.get(trackNo) ?? [];
                const full = analysesByFileName.get(adoptedFileNameByTrack[trackNo]);
                return (
                  <div key={trackNo} className="option-block compact audio-track-detail">
                    <TrackDetailCard
                      trackNo={trackNo}
                      title={song?.title ?? metrics.fileName}
                      metrics={metrics}
                      takes={takes}
                      analysesByFileName={analysesByFileName}
                      adoptedFileName={adoptedFileNameByTrack[trackNo]}
                      full={full}
                      rating={song?.songId ? ratings[song.songId] : undefined}
                      channelTakes={channelTakes}
                      filesByName={filesByName}
                      onAdopt={(t, fileName) => void adoptTake(t, fileName)}
                      onRate={song?.songId ? rating => void rateTrack(metrics, rating) : undefined}
                      onToggleRejectionReason={(take, id) => void toggleRejectionReason(take, id)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <div className="option-block">
        <div className="section-head">
          <h4>무엇이 통하나 — 채택 경향 (누적 짝비교)</h4>
          <button type="button" className={learningEnabled ? 'chip active' : 'chip'} onClick={() => setLearningEnabled(v => !v)}>
            {learningEnabled ? '반영 끄기' : '반영 켜기'}
          </button>
        </div>
        {learningEnabled && (
          <>
            <p className="supporting">⓵ 채택/미채택 짝: 트랙마다 채택 1개 + 미채택 1개 이상 있을 때만 집계됩니다. 짝 10개 미만은 참고하지 않습니다.</p>
            {adoptionInsights.filter(i => i.totalPairs > 0).map(insight => (
              <p key={insight.metric} className="supporting">
                {insight.labelKo}: 채택 쪽이 큼 {insight.adoptedHigherCount}/{insight.totalPairs} · 승률 {Math.round(insight.winRate * 100)}%
                {isNeutralWinRate(insight.winRate) ? ' (중립)' : ''} · {insight.confidence}
              </p>
            ))}
            {adoptionInsights.every(i => i.totalPairs === 0) && <p className="supporting">아직 채택/미채택 짝이 없습니다 — 트랙마다 여러 테이크를 올리고 하나를 채택해보세요.</p>}

            <h4 style={{ marginTop: 12 }}>지시 실행률</h4>
            <p className="supporting">※ 정확한 반음 전조, 특정 악기 식별, 화성 진행, 가사 내용은 측정하지 않습니다 (대리 지표만 사용).</p>
            {executionEntries.map(entry => (
              <p key={entry.directiveKey} className="supporting">
                {entry.labelKo}: {entry.executedCount}/{entry.totalCount} ({Math.round(entry.executionRate * 100)}%) · {entry.confidence}
              </p>
            ))}
            {!executionEntries.length && <p className="supporting">아직 측정된 지시 실행률이 없습니다.</p>}
          </>
        )}
      </div>
    </div>
  );
}
