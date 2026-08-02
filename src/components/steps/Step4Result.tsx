import { useEffect, useMemo, useState } from 'react';
import { Captions, Copy, Download, FileText, Focus, Headphones, ListMusic, Music2, RotateCcw, Save, ShieldAlert, Sparkles, Image as ImageIcon, Mic2 } from 'lucide-react';
import SongCard, { SongCardSkeleton } from '../SongCard';
import HybridRefinePanel from '../HybridRefinePanel';
import ThumbnailSpecPanel from '../ThumbnailSpecPanel';
import ThumbnailImageStudioPanel from '../ThumbnailImageStudioPanel';
import PersonaPanel, { type PersonaPromptStats } from '../PersonaPanel';
import SrtExportPanel from '../SrtExportPanel';
import FocusMode from '../FocusMode';
import SunoProgressMode from '../SunoProgressMode';
import AudioAnalysisPanel from '../AudioAnalysisPanel';
import AudioEditPanel from '../AudioEditPanel';
import PromiseAuditPanel from '../PromiseAuditPanel';
import ExperimentalFeatureBoundary from '../ExperimentalFeatureBoundary';
import { audienceProfileForAgeGroup } from '../../data/audienceProfiles';
import { FEATURE_STATUS_LABEL_KO, featureStatus } from '../../data/featureFlags';
import { buildStandaloneProgressHtml, standaloneProgressFileName } from '../../core/standaloneProgressExport';
import { buildSongTxt, copyText, downloadBlob, downloadText, exportCsv, exportJson, exportMarkdown } from '../../utils/exporters';
import { buildZip, safeFileName } from '../../utils/zipExporter';
import { exportDocxBlob } from '../../utils/docxExporter';
import { buildFfmpegPackVideoScript, buildPackVideoDescription } from '../../core/videoExport';
import { lintInPackStyleSimilarity } from '../../core/diversityLinter';
import { auditAlbum } from '../../core/albumAudit';
import { RECOMMENDATION_BADGE, STAGE_ADVICE } from '../../core/apiAdvisor';
import { evaluateGenerationGate } from '../../core/generationGate';
import { resolveConstraintsFromOptions } from '../../core/constraints';
import { buildRecomposeInstruction } from '../../core/claudeCodeBridge';
import { recentUsedTitlesAndHooks } from '../../core/hookLedger';
import { getRatingForSong, getRatings } from '../../core/ratingLedger';
import { getTakes } from '../../core/audioTakes';
import { buildTakeLedgerCsv, downloadCsv, gatherAllSetSummaryRows, buildSetSummaryCsv, SET_SUMMARY_FILENAME, takeLedgerFileName, type SetContext } from '../../core/csvExport';
import { currentWorkspaceId } from '../../core/workspaceScope';
import type { LyricTranslationResult } from '../../core/lyricsTranslation';
import type { AgentEvaluation, DisplayLanguage, GenerationOptions, PlaylistBlueprint, ProviderSettings, SongIdea, SoundSignature, ThumbnailVariantId } from '../../types';
import type { ChannelPersonaRecord } from '../../core/library';
import type { ThumbnailSpec } from '../../core/thumbnailSpec';
import type { ThumbnailArchetypeId } from '../../data/thumbnailArchetypes';

export type ResultTab = 'songs' | 'thumbnail' | 'persona' | 'srt' | 'audio' | 'promiseAudit';

interface Step4ResultProps {
  blueprint: PlaylistBlueprint | null;
  isGenerating: boolean;
  genProgress: { done: number; total: number };
  partialSongs: SongIdea[];
  generationError: string;
  moneyChordLabel: string;
  evaluation: AgentEvaluation | null;
  evalError: string;
  isEvaluating: boolean;
  evalProgress: { done: number; total: number };
  evaluationAvailable: boolean;
  retryingTrack: number | null;
  retryWarning: string;
  undoTrackNo: number | null;
  hybridRefineAvailable: boolean;
  isRefining: boolean;
  refineProgress: { done: number; total: number };
  refineWarnings: string[];
  thumbnailSpec: ThumbnailSpec | null;
  thumbnailSeasonId: string;
  thumbnailArchetypeId: ThumbnailArchetypeId;
  thumbnailPackagingLanguage: DisplayLanguage;
  /** TASK v3.37-b — GenerationOptions.customConcept for the pack currently in the editor. */
  thumbnailCustomConcept: string;
  soundSignature: SoundSignature | null;
  /** TASK v3.39.1 Part B1/C2 — needed to build the compiled-video tracklist description and ffmpeg script exports below. */
  opts: GenerationOptions;
  textModelSettings?: ProviderSettings;
  personaMode: boolean;
  personaPromptStats: PersonaPromptStats | null;
  savedPersonas: ChannelPersonaRecord[];
  promptCharLimit?: number;
  onSelectThumbnailArchetype: (id: ThumbnailArchetypeId) => void;
  onPersonaModeChange: (enabled: boolean) => void;
  onSavePersonaName: () => void;
  onSave: () => void;
  onEvaluate: (scopeTrackNos?: number[]) => void;
  onRetrySong: (trackNo: number, issues: string[]) => void;
  onUndoRetry: () => void;
  onRefineSelected: (trackNos: number[]) => void;
  onRegenerateHeadline: () => void;
  onSelectThumbnailVariant: (id: ThumbnailVariantId) => void;
  onApplyThumbnailFreeText: (suggestions: { headline: string; angle: string }[]) => void;
  /** TASK I3 (v3.11, PART D-4) — manual override for the automatic cold-open/flagship pick. */
  onPromoteTrack: (trackNo: number, role: 'cold-open' | 'flagship') => void;
  /** TASK v3.39.1 Part B3 — records what a human actually chose/changed for a song (originality evidence for an "inauthentic content" appeal). */
  onUpdateHumanEdits: (trackNo: number, text: string) => void;
  onUpdateLyrics: (trackNo: number, lyrics: string) => void;
  onRegenerateLyricLine: (trackNo: number, zeroBasedLineIndex: number) => void;
  onUpdatePronunciationHints: (trackNo: number, text: string) => void;
  /** v3.57 — applies a batch of trackNo -> {ko?, ja?} lyric-line translations onto the current blueprint (see core/lyricsTranslation.ts), for the SRT export panel's CapCut subtitle workflow. */
  onUpdateLyricTranslations: (translations: Map<number, LyricTranslationResult>) => void;
  focusTab?: ResultTab;
}

export default function Step4Result({
  blueprint,
  isGenerating,
  genProgress,
  partialSongs,
  generationError,
  moneyChordLabel,
  evaluation,
  evalError,
  isEvaluating,
  evalProgress,
  evaluationAvailable,
  retryingTrack,
  retryWarning,
  undoTrackNo,
  hybridRefineAvailable,
  isRefining,
  refineProgress,
  refineWarnings,
  thumbnailSpec,
  thumbnailSeasonId,
  thumbnailArchetypeId,
  thumbnailPackagingLanguage,
  thumbnailCustomConcept,
  soundSignature,
  opts,
  textModelSettings,
  personaMode,
  personaPromptStats,
  savedPersonas,
  promptCharLimit,
  onSelectThumbnailArchetype,
  onPersonaModeChange,
  onSavePersonaName,
  onSave,
  onEvaluate,
  onRetrySong,
  onUndoRetry,
  onRefineSelected,
  onRegenerateHeadline,
  onSelectThumbnailVariant,
  onApplyThumbnailFreeText,
  onPromoteTrack,
  onUpdateHumanEdits,
  onUpdateLyrics,
  onRegenerateLyricLine,
  onUpdatePronunciationHints,
  onUpdateLyricTranslations,
  focusTab
}: Step4ResultProps) {
  const [evalScope, setEvalScope] = useState<'all' | 'selected'>('all');
  const [selectedTrackNos, setSelectedTrackNos] = useState<number[]>([]);
  const [refineSelection, setRefineSelection] = useState<number[]>([]);
  const [resultTab, setResultTab] = useState<ResultTab>('songs');
  // v3.79 (TASK C/E) — AudioAnalysisPanel's [편집] button hands back the
  // original File + duration via onEditTrack; this modal is the only place
  // that actually imports AudioEditPanel, so the analysis panel itself
  // never needs to know the editor exists (see its own onEditTrack doc
  // comment).
  const [editingTrack, setEditingTrack] = useState<{ trackNo: number; fileName: string; file: File; durationSec: number } | null>(null);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [progressModeOpen, setProgressModeOpen] = useState(false);
  const [recomposeCopied, setRecomposeCopied] = useState(false);

  useEffect(() => {
    if (focusTab) setResultTab(focusTab);
  }, [focusTab]);

  // TASK I6 (v3.11, PART D-3) — tracks 1-3 decide the video's first
  // impression, so they're pre-checked for hybrid refinement by default;
  // the user can still uncheck them (this only sets a default, it never
  // calls the API on its own — see v3.2's "묻고 실행" principle).
  useEffect(() => {
    if (!blueprint) return;
    setRefineSelection([1, 2, 3].filter(trackNo => trackNo <= blueprint.songs.length));
  }, [blueprint]);

  function toggleTrackSelected(trackNo: number) {
    setSelectedTrackNos(prev => (prev.includes(trackNo) ? prev.filter(no => no !== trackNo) : [...prev, trackNo]));
  }

  function toggleRefineSelected(trackNo: number) {
    setRefineSelection(prev => (prev.includes(trackNo) ? prev.filter(no => no !== trackNo) : [...prev, trackNo]));
  }

  function handleEvaluateClick() {
    onEvaluate(evalScope === 'selected' ? selectedTrackNos : undefined);
  }

  function handleRefineClick() {
    onRefineSelected(refineSelection);
    setRefineSelection([]);
  }

  /**
   * TASK v3.69 (TASK A) — "독립 실행 수노모드": a standalone, offline HTML
   * file with the same 1/2/3/4 copy workflow as SunoProgressMode below, so
   * the user can work through a pack's 18 songs without keeping this app
   * open (and can freely restart/rebuild it mid-pack — see this task's own
   * §0 problem statement).
   */
  function handleExportStandaloneProgress() {
    if (!blueprint) return;
    const meta = {
      packId,
      channelId: opts.channel.id,
      channelLabel: blueprint.channelName,
      conceptLabel: blueprint.oneLineConcept || blueprint.projectTitle,
      generatedAt: blueprint.generatedAt || new Date().toISOString(),
      personaMode,
      promptCharLimit
    };
    const html = buildStandaloneProgressHtml(blueprint.songs, meta);
    downloadBlob(standaloneProgressFileName(meta), new Blob([html], { type: 'text/html;charset=utf-8' }));
  }

  async function handleWordExport() {
    if (!blueprint) return;
    const blob = await exportDocxBlob({ blueprint, thumbnailSpec: thumbnailSpec ?? undefined, soundSignature: soundSignature ?? undefined, personaMode });
    downloadBlob('suno-pack.docx', blob);
  }

  function handleTxtZipExport() {
    if (!blueprint) return;
    const zip = buildZip(blueprint.songs.map(song => ({
      name: `${song.trackNo.toString().padStart(2, '0')}_${safeFileName(song.title)}.txt`,
      content: buildSongTxt(song)
    })));
    downloadBlob('suno-pack-txt.zip', zip);
  }

  const packId = blueprint ? `${blueprint.channelName}::${blueprint.projectTitle}::${blueprint.songs.length}` : '';

  /**
   * v3.79 (TASK D) — 하루님's own request: "음원분석도 데이터잖아... 연번 코드
   * 같은 거 붙여서... 엑셀 등으로 출력". `blueprint.meta.setCode` is only
   * assigned by core/library.ts's savePack on this pack's first real save
   * (see that task's own comment) — so "개별 세트" export is only available
   * once the pack has been saved at least once (disabled with a tooltip
   * below otherwise), while "전체 누적" never depends on the in-editor
   * blueprint at all.
   */
  async function handleExportTakeLedgerCsv() {
    if (!blueprint?.meta?.setCode) return;
    const [takes, allRatings] = await Promise.all([getTakes({ packId }), getRatings()]);
    const ctx: SetContext = {
      blueprint,
      channelName: blueprint.channelName,
      customConcept: opts.customConcept,
      workspaceId: currentWorkspaceId(),
      savedAt: new Date().toISOString()
    };
    const csv = buildTakeLedgerCsv(ctx, takes, allRatings.filter(r => r.packId === packId));
    downloadCsv(takeLedgerFileName(blueprint.meta.setCode), csv);
  }

  async function handleExportSetSummaryCsv() {
    const rows = await gatherAllSetSummaryRows();
    downloadCsv(SET_SUMMARY_FILENAME, buildSetSummaryCsv(rows));
  }

  // TASK v3.68 (TASK C) — set-wide "N/전체 평가됨" progress, so a user who
  // skips SunoProgressMode and rates from the plain song list here still
  // sees how much of the pack is covered.
  const [ratedCount, setRatedCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!blueprint) { setRatedCount(0); return; }
    Promise.all(blueprint.songs.map(song => (song.songId ? getRatingForSong(song.songId) : Promise.resolve(null))))
      .then(records => { if (!cancelled) setRatedCount(records.filter(Boolean).length); })
      .catch(() => { if (!cancelled) setRatedCount(0); });
    return () => { cancelled = true; };
  }, [blueprint]);

  // TASK v3.42 Part D — in-pack pairwise style-prompt similarity, the
  // regression guard for the real 90.3%-average/100%-max measured bug (see
  // core/diversityLinter.ts's lintInPackStyleSimilarity).
  const similarityReport = useMemo(
    () => (blueprint ? lintInPackStyleSimilarity(blueprint.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt }))) : null),
    [blueprint]
  );

  // TASK v3.58 (TASK 6) — whole-pack audit (core/albumAudit.ts) on top of
  // every song's own scoreSong() warnings: duplicate titles/hooks, artist-
  // name leaks, over-limit style prompts, and re-checks of TASK 1-5's own
  // fixes. `errors` block the per-song Suno-bound copy actions below
  // (mirrors this file's own isOverPromptLimit precedent in SongCard);
  // `warnings` are informational only and never block anything.
  const albumAuditReport = useMemo(() => (blueprint ? auditAlbum(blueprint.songs, opts) : null), [blueprint, opts]);
  const albumAuditBlocked = Boolean(albumAuditReport && !albumAuditReport.passed);

  // TASK v3.62 (TASK 3) — the bridge (manual copy-paste) import path has no
  // API call to auto-retry through (unlike providers/index.ts's automatic
  // recomposeBlockingTracks for the real-API path), so this surfaces
  // core/compositionScorer.ts's blocking findings on whatever is currently
  // loaded and offers a scoped-down recomposition instruction for just
  // those tracks.
  // TASK v3.64 (TASK D) — the channel's real cross-pack hook history, so the
  // previously warning-only "duplicates a hook already used" check actually
  // blocks here too (feeding both the recompose loop's own gate and this
  // screen's "재작곡 지시문 복사" button), not just claudeCodeBridge.ts's
  // unchanged import-time warning.
  const [historicalHooks, setHistoricalHooks] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    recentUsedTitlesAndHooks(opts.channel.id, opts.lyricLanguage)
      .then(result => { if (!cancelled) setHistoricalHooks(result.hooks); })
      .catch(() => { if (!cancelled) setHistoricalHooks([]); });
    return () => { cancelled = true; };
  }, [opts.channel.id, opts.lyricLanguage]);

  // v3.78 (TASK B, §3-1) — "관문 2": this is the ONE place a bridge-imported
  // pack (or any generated pack) is actually visible to the user after
  // import, since App.tsx's onImportSongsJson navigates straight to this
  // screen (setCurrentStep(5)) the instant an import succeeds — a
  // GenerationGatePanel wired into Step3Generate.tsx alone would never be
  // seen in the real single-pack import flow (confirmed live: a real bridge
  // import never re-renders Step3Generate before this screen replaces it).
  // Reuses this file's own pre-existing TASK v3.62 blockingSongs/recompose
  // mechanism (scoreComposition-based) — evaluateGenerationGate is a
  // superset of scoreComposition's own checks (same historicalHooks input,
  // same CompositionScore shape per track) plus this task's new §3-2 checks
  // (title-pattern variety, situation/emotion variety, tighter blocking
  // word-count/section-count bounds, placeholder/label/article leaks), so
  // this is an extension of the existing gate, not a second parallel one.
  const generationGateConstraints = useMemo(
    () => (blueprint ? resolveConstraintsFromOptions(opts, audienceProfileForAgeGroup(opts.audience)) : null),
    [blueprint, opts]
  );
  const generationGateResult = useMemo(
    () => (blueprint
      ? evaluateGenerationGate(blueprint.songs, { historicalHooks, conceptLabel: opts.customConcept || opts.projectTitle, eraConstraint: generationGateConstraints?.era })
      : null),
    [blueprint, historicalHooks, opts.customConcept, opts.projectTitle, generationGateConstraints]
  );
  const blockingSongs = useMemo(() => {
    if (!blueprint || !generationGateResult) return [];
    return generationGateResult.tracks
      .filter(track => !track.passed)
      .map(track => ({ song: blueprint.songs.find(song => song.trackNo === track.trackNo)!, blocking: track.blocking }))
      .filter(entry => entry.song);
  }, [blueprint, generationGateResult]);

  async function handleCopyRecomposeInstruction() {
    await copyText(buildRecomposeInstruction(blockingSongs));
    setRecomposeCopied(true);
    setTimeout(() => setRecomposeCopied(false), 2000);
  }

  if (!blueprint && !isGenerating && !partialSongs.length) {
    return (
      <section className="panel">
        <p className="step-hint">아직 생성된 결과가 없어요. 이전 단계에서 곡을 생성해 보세요.</p>
        {generationError && <p className="error">{generationError}</p>}
      </section>
    );
  }

  const songs = blueprint?.songs ?? partialSongs;
  const skeletonCount = isGenerating ? Math.max(0, genProgress.total - songs.length) : 0;

  return (
    <section className="panel results">
      <p className="step-hint">완성된 곡부터 순서대로 나타납니다. 카드를 클릭하면 스타일 프롬프트 / 가사 / YouTube 탭을 볼 수 있어요.</p>

      {!isGenerating && generationError && (
        <p className="error">
          {generationError}
          {partialSongs.length > 0 && !blueprint && ` (완료된 ${partialSongs.length}곡은 아래에 남아 있습니다. 다시 생성하면 처음부터 다시 만들어집니다.)`}
        </p>
      )}

      {blueprint?.isLocalPreview && (
        <p className="warning" role="note">
          이것은 미리보기입니다. 실제 산출물은 브릿지(Claude Code) 생성 결과와 다를 수 있습니다.
        </p>
      )}

      {blueprint && (
        <div className="panel-header">
          <div>
            <p className="eyebrow">Generated Pack</p>
            <h2>{blueprint.projectTitle}</h2>
            <p className="supporting">{blueprint.oneLineConcept}</p>
          </div>
          <div className="button-row">
            <button type="button" className="primary" onClick={onSave}>
              <Save size={16} />
              💾 이 팩 저장하기
            </button>
            <button type="button" onClick={() => void handleWordExport()}>
              <FileText size={16} />
              📄 WORD
            </button>
            <button type="button" title="곡별로 나눈 .txt 30개를 zip으로 내보내기 — 모바일에서 한 곡씩 열어 복사하기 좋습니다" onClick={handleTxtZipExport}>
              <Download size={16} />
              📝 TXT (곡별)
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.md', exportMarkdown(blueprint, thumbnailSpec ?? undefined, soundSignature ?? undefined, personaMode, opts.channel), 'text/markdown;charset=utf-8')}>
              <Download size={16} />
              MD
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.json', exportJson(blueprint, thumbnailSpec ?? undefined, soundSignature ?? undefined, personaMode, opts.channel), 'application/json;charset=utf-8')}>
              <Download size={16} />
              JSON
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.csv', exportCsv(blueprint, soundSignature ?? undefined, personaMode), 'text/csv;charset=utf-8')}>
              <Download size={16} />
              CSV
            </button>
            <button
              type="button"
              disabled={!blueprint.meta?.setCode}
              title={blueprint.meta?.setCode ? '이 세트의 테이크(음원 분석) 데이터를 엑셀용 CSV로 내보내기' : '먼저 "이 팩 저장하기"를 눌러야 세트코드가 부여됩니다'}
              onClick={() => void handleExportTakeLedgerCsv()}
            >
              <Download size={16} />
              📊 테이크 CSV (개별 세트)
            </button>
            <button
              type="button"
              title="지금까지 저장된 모든 세트의 통계 요약을 엑셀용 CSV로 내보내기 (누적)"
              onClick={() => void handleExportSetSummaryCsv()}
            >
              <Download size={16} />
              📊 세트요약 CSV (전체 누적)
            </button>
            <button
              type="button"
              title="전 곡을 한 영상으로 합칠 때 쓸 설명(타임스탬프 트랙리스트 포함)"
              onClick={() => downloadText('suno-pack-video-description.txt', buildPackVideoDescription(blueprint, opts))}
            >
              <Download size={16} />
              🎬 영상 설명(타임스탬프)
            </button>
            <button
              type="button"
              title="audio/NN.mp3 + images/NN.png 준비 후 실행하는 ffmpeg 합본 영상 스크립트 (정적 이미지 1장 금지 대응)"
              onClick={() => downloadText('render-pack-video.sh', buildFfmpegPackVideoScript(blueprint, opts))}
            >
              <Download size={16} />
              🎞️ ffmpeg 스크립트
            </button>
            <button
              type="button"
              disabled={isEvaluating || isRefining || !evaluationAvailable || (evalScope === 'selected' && selectedTrackNos.length === 0)}
              onClick={handleEvaluateClick}
              title={!evaluationAvailable ? '평가 기능은 Claude 또는 ChatGPT API 설정이 필요합니다.' : undefined}
            >
              <Sparkles size={16} />
              {isEvaluating
                ? `AI 평가 중... (${evalProgress.done}/${evalProgress.total})`
                : evalScope === 'selected'
                  ? `🧪 선택한 ${selectedTrackNos.length}곡만 평가하기`
                  : '🧪 전체 AI 평가하기'}
            </button>
            <button type="button" className="primary" onClick={() => setFocusModeOpen(true)}>
              <Focus size={16} />
              📱 집중 모드
            </button>
            <button type="button" className="primary" onClick={() => setProgressModeOpen(true)}>
              <Headphones size={16} />
              🎧 수노 진행 모드
            </button>
            <button type="button" onClick={handleExportStandaloneProgress}>
              <Download size={16} />
              [독립 파일로 내보내기]
            </button>
          </div>
        </div>
      )}

      {blueprint && focusModeOpen && (
        <FocusMode songs={blueprint.songs} packId={packId} onClose={() => setFocusModeOpen(false)} />
      )}

      {blueprint && progressModeOpen && (
        <SunoProgressMode
          songs={blueprint.songs}
          packId={packId}
          channelId={opts.channel.id}
          personaMode={personaMode}
          promptCharLimit={promptCharLimit}
          onClose={() => setProgressModeOpen(false)}
        />
      )}

      {blueprint && (
        <div className="tab-row">
          <button type="button" className={resultTab === 'songs' ? 'tab active' : 'tab'} onClick={() => setResultTab('songs')}>
            <ListMusic size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            곡 목록
          </button>
          <button type="button" className={resultTab === 'thumbnail' ? 'tab active' : 'tab'} onClick={() => setResultTab('thumbnail')}>
            <ImageIcon size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            🖼 썸네일 사양
          </button>
          <button type="button" className={resultTab === 'persona' ? 'tab active' : 'tab'} onClick={() => setResultTab('persona')}>
            <Mic2 size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Persona / Sound
          </button>
          <button type="button" className={resultTab === 'srt' ? 'tab active' : 'tab'} onClick={() => setResultTab('srt')}>
            <Captions size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            🎬 자막(SRT)
          </button>
          <button type="button" className={resultTab === 'audio' ? 'tab active' : 'tab'} onClick={() => setResultTab('audio')}>
            <Music2 size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            🎧 음원 분석
            {/* v4.0 (TASK D) — audioAnalysis/audioEdit are both 'experimental' (src/data/featureFlags.ts); this one tab covers both. */}
            <span className="feature-badge">{FEATURE_STATUS_LABEL_KO[featureStatus('audioAnalysis')]}</span>
          </button>
          <button type="button" className={resultTab === 'promiseAudit' ? 'tab active' : 'tab'} onClick={() => setResultTab('promiseAudit')}>
            <ShieldAlert size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            🔍 정합성 검사
          </button>
        </div>
      )}

      {/* v4.0 (TASK D) — audioAnalysis/audioEdit are both 'experimental' (src/data/featureFlags.ts). */}
      {blueprint && resultTab === 'audio' && (
        <ExperimentalFeatureBoundary featureLabel="음원 분석">
          <AudioAnalysisPanel
            songs={blueprint.songs}
            packId={packId}
            channelId={opts.channel.id}
            audienceProfile={audienceProfileForAgeGroup(opts.audience)}
            onEditTrack={(trackNo, fileName, file, durationSec) => setEditingTrack({ trackNo, fileName, file, durationSec })}
          />
        </ExperimentalFeatureBoundary>
      )}

      {editingTrack && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <ExperimentalFeatureBoundary featureLabel="음원 편집">
              <AudioEditPanel
                file={editingTrack.file}
                durationSec={editingTrack.durationSec}
                title={`T${editingTrack.trackNo} ${blueprint?.songs.find(s => s.trackNo === editingTrack.trackNo)?.title ?? editingTrack.fileName}`}
                onClose={() => setEditingTrack(null)}
              />
            </ExperimentalFeatureBoundary>
          </div>
        </div>
      )}

      {blueprint && resultTab === 'promiseAudit' && (
        <PromiseAuditPanel
          songs={blueprint.songs}
          conceptLabel={opts.customConcept?.trim() || opts.projectTitle}
          audienceProfile={audienceProfileForAgeGroup(opts.audience)}
          channelId={opts.channel.id}
        />
      )}

      {blueprint && resultTab === 'thumbnail' && thumbnailSpec && (
        <ThumbnailSpecPanel
          spec={thumbnailSpec}
          defaultSeasonId={thumbnailSeasonId}
          selectedArchetypeId={thumbnailArchetypeId}
          packagingLanguage={thumbnailPackagingLanguage}
          customConcept={thumbnailCustomConcept}
          onSelectArchetype={onSelectThumbnailArchetype}
          onRegenerateHeadline={onRegenerateHeadline}
          onSelectVariant={onSelectThumbnailVariant}
          onApplyFreeTextHeadlines={onApplyThumbnailFreeText}
        />
      )}

      {/* v4.0 (TASK D) — imageGeneration is 'experimental'. */}
      {blueprint && resultTab === 'thumbnail' && thumbnailSpec && (
        <ExperimentalFeatureBoundary featureLabel="썸네일 이미지 생성">
          <ThumbnailImageStudioPanel
            spec={thumbnailSpec}
            defaultSeasonId={thumbnailSeasonId}
            defaultArchetypeId={thumbnailArchetypeId}
            textModelSettings={textModelSettings}
          />
        </ExperimentalFeatureBoundary>
      )}

      {blueprint && resultTab === 'srt' && (
        <SrtExportPanel
          blueprint={blueprint}
          textModelSettings={textModelSettings}
          onUpdateLyricTranslations={onUpdateLyricTranslations}
        />
      )}

      {blueprint && resultTab === 'persona' && soundSignature && personaPromptStats && (
        <PersonaPanel
          blueprint={blueprint}
          soundSignature={soundSignature}
          personaMode={personaMode}
          promptStats={personaPromptStats}
          savedPersonas={savedPersonas}
          onPersonaModeChange={onPersonaModeChange}
          onSavePersona={onSavePersonaName}
        />
      )}

      {resultTab === 'songs' && blueprint && hybridRefineAvailable && (
        <>
          <p className="supporting">
            💡 1~3번 곡은 영상의 첫인상을 좌우합니다. API로 다듬는 걸 권장해서 기본으로 선택해뒀어요. (원치 않으면 체크 해제하세요)
          </p>
          <HybridRefinePanel
            songs={blueprint.songs}
            selected={refineSelection}
            onToggle={toggleRefineSelected}
            onRefine={handleRefineClick}
            isRefining={isRefining}
            refineProgress={refineProgress}
            refineWarnings={refineWarnings}
          />
        </>
      )}

      {resultTab === 'songs' && blueprint && (
        <p className="supporting">🎧 청취 평가 {ratedCount}/{blueprint.songs.length}곡 평가됨 — 각 곡 카드에서 👍/🤷/👎로 평가할 수 있어요 (선택 사항).</p>
      )}

      {resultTab === 'songs' && blueprint && !evaluationAvailable && (
        <p className="supporting">평가 기능은 Claude 또는 ChatGPT API 설정이 필요합니다. (설정에서 제공자를 변경하세요)</p>
      )}

      {resultTab === 'songs' && blueprint && evaluationAvailable && (
        <div className="provider-summary">
          <p className="supporting api-advice-line">
            {RECOMMENDATION_BADGE[STAGE_ADVICE.evaluation.recommendation].emoji} {RECOMMENDATION_BADGE[STAGE_ADVICE.evaluation.recommendation].labelKo} ({STAGE_ADVICE.evaluation.suggestedModelKo}): {STAGE_ADVICE.evaluation.reasonKo}
          </p>
          <p className="supporting">
            평가 범위를 좁히면 API 호출 수가 줄어 비용이 절약됩니다. 곡이 많을수록 효과가 커요.
          </p>
          <div className="chips">
            <button type="button" className={evalScope === 'all' ? 'chip active' : 'chip'} onClick={() => setEvalScope('all')}>
              전체 {blueprint.songs.length}곡 평가
            </button>
            <button type="button" className={evalScope === 'selected' ? 'chip active' : 'chip'} onClick={() => setEvalScope('selected')}>
              선택한 곡만 평가 ({selectedTrackNos.length}곡 선택됨)
            </button>
          </div>
          {evalScope === 'selected' && (
            <p className="supporting">아래 곡 목록에서 평가하고 싶은 곡의 체크박스를 선택하세요.</p>
          )}
        </div>
      )}
      {resultTab === 'songs' && similarityReport && (similarityReport.warnings.length > 0 || similarityReport.errors.length > 0) && (
        <div className={similarityReport.errors.length > 0 ? 'warning error' : 'warning'}>
          <ShieldAlert size={16} />
          <span>
            {[...similarityReport.errors, ...similarityReport.warnings].join(' / ')}
            {similarityReport.commonClauses.length > 0 && ` 전 곡 공통 절: ${similarityReport.commonClauses.slice(0, 8).join(', ')}`}
          </span>
        </div>
      )}
      {resultTab === 'songs' && albumAuditReport && (albumAuditReport.errors.length > 0 || albumAuditReport.warnings.length > 0) && (
        <div className={albumAuditReport.errors.length > 0 ? 'warning error' : 'warning'}>
          <ShieldAlert size={16} />
          <span>
            {albumAuditReport.errors.length > 0 && `문제가 있어 Suno로 복사하는 것을 막았습니다: ${albumAuditReport.errors.join(' / ')}`}
            {albumAuditReport.errors.length > 0 && albumAuditReport.warnings.length > 0 && ' — '}
            {albumAuditReport.warnings.length > 0 && albumAuditReport.warnings.join(' / ')}
          </span>
        </div>
      )}
      {resultTab === 'songs' && blockingSongs.length > 0 && (
        <div className="warning error">
          <ShieldAlert size={16} />
          <span>
            {blockingSongs.length}곡이 생성 검증(관문 2)을 통과하지 못했습니다: {blockingSongs.map(entry => entry.song.trackNo).join(', ')}번.
            {generationGateResult?.needsFullRegeneration
              ? ' 12곡 이상 실패했습니다 — 설계 자체가 컨셉에 맞지 않을 가능성이 큽니다. 전체 재설계를 검토하세요.'
              : ' 브릿지(코딩 에이전트 복사/붙여넣기)로 만든 곡이라면 이 곡들만 재작곡 지시문을 복사해 다시 만들게 하세요 — 세트 전체를 폐기할 필요는 없습니다.'}
            <button type="button" className="icon-button" title="문제가 있는 곡만 다시 작곡시킬 지시문 복사" onClick={() => void handleCopyRecomposeInstruction()}>
              <Copy size={14} />
              {recomposeCopied ? '복사됨 ✅' : '재작곡 지시문 복사'}
            </button>
          </span>
        </div>
      )}
      {resultTab === 'songs' && blockingSongs.length === 0 && generationGateResult && blueprint && (
        <div className="provider-summary design-gate-panel passed">
          <span>생성 검증 통과 ✅ — {blueprint.songs.length}곡 중 {blueprint.songs.length}곡 통과</span>
        </div>
      )}
      {resultTab === 'songs' && evalError && <p className="error">{evalError}</p>}
      {resultTab === 'songs' && retryWarning && <p className="error">{retryWarning}</p>}
      {resultTab === 'songs' && undoTrackNo !== null && (
        <div className="warning">
          <RotateCcw size={16} />
          <span>
            {undoTrackNo}번 곡을 다시 만들었어요.
            <button type="button" className="icon-button" title="이전 곡으로 되돌리기" onClick={onUndoRetry}>
              <RotateCcw size={14} />
              되돌리기
            </button>
          </span>
        </div>
      )}

      {resultTab === 'songs' && evaluation && (
        <div className="signature-grid">
          <div><b>다양성</b><span>{evaluation.packLevel.diversityScore}/100</span></div>
          <div><b>톤 일관성</b><span>{evaluation.packLevel.coherenceScore}/100</span></div>
          <div><b>구성 순서</b><span>{evaluation.packLevel.sequencingScore}/100</span></div>
          <div style={{ gridColumn: '1 / -1' }}><b>총평</b><span>{evaluation.packLevel.summary}</span></div>
          {evaluation.packLevel.duplicateWarnings.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}><b>중복 경고</b><span>{evaluation.packLevel.duplicateWarnings.join(' / ')}</span></div>
          )}
        </div>
      )}

      {resultTab === 'songs' && blueprint && (
        <div className="signature-grid">
          <div><b>Sonic</b><span>{blueprint.sonicSignature}</span></div>
          <div><b>Vocal</b><span>{blueprint.vocalSignature}</span></div>
          <div><b>Visual</b><span>{blueprint.visualRules.join(' / ')}</span></div>
        </div>
      )}

      {resultTab === 'songs' && songs.map(song => (
        retryingTrack === song.trackNo ? (
          <SongCardSkeleton key={song.trackNo} trackNo={song.trackNo} />
        ) : (
          <SongCard
            key={song.trackNo}
            song={song}
            moneyChordLabel={moneyChordLabel}
            evaluation={evaluation?.songs.find(item => item.trackNo === song.trackNo)}
            isRetrying={false}
            onRetry={onRetrySong}
            selectable={evalScope === 'selected' && evaluationAvailable}
            selected={selectedTrackNos.includes(song.trackNo)}
            onToggleSelect={toggleTrackSelected}
            personaMode={personaMode}
            personaName={soundSignature?.personaName}
            promptCharLimit={promptCharLimit}
            onPromote={onPromoteTrack}
            onUpdateHumanEdits={onUpdateHumanEdits}
            onUpdateLyrics={onUpdateLyrics}
            onRegenerateLyricLine={onRegenerateLyricLine}
            onUpdatePronunciationHints={onUpdatePronunciationHints}
            albumAuditBlocked={albumAuditBlocked}
            channelId={opts.channel.id}
            packId={packId}
          />
        )
      ))}
      {resultTab === 'songs' && Array.from({ length: skeletonCount }, (_, i) => (
        <SongCardSkeleton key={`skeleton-${songs.length + i + 1}`} trackNo={songs.length + i + 1} />
      ))}
    </section>
  );
}
