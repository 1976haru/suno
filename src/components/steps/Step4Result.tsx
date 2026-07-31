import { useEffect, useMemo, useState } from 'react';
import { Captions, Copy, Download, FileText, Focus, Headphones, ListMusic, RotateCcw, Save, ShieldAlert, Sparkles, Image as ImageIcon, Mic2 } from 'lucide-react';
import SongCard, { SongCardSkeleton } from '../SongCard';
import HybridRefinePanel from '../HybridRefinePanel';
import ThumbnailSpecPanel from '../ThumbnailSpecPanel';
import ThumbnailImageStudioPanel from '../ThumbnailImageStudioPanel';
import PersonaPanel, { type PersonaPromptStats } from '../PersonaPanel';
import SrtExportPanel from '../SrtExportPanel';
import FocusMode from '../FocusMode';
import SunoProgressMode from '../SunoProgressMode';
import { buildStandaloneProgressHtml, standaloneProgressFileName } from '../../core/standaloneProgressExport';
import { buildSongTxt, copyText, downloadBlob, downloadText, exportCsv, exportJson, exportMarkdown } from '../../utils/exporters';
import { buildZip, safeFileName } from '../../utils/zipExporter';
import { exportDocxBlob } from '../../utils/docxExporter';
import { buildFfmpegPackVideoScript, buildPackVideoDescription } from '../../core/videoExport';
import { lintInPackStyleSimilarity } from '../../core/diversityLinter';
import { auditAlbum } from '../../core/albumAudit';
import { RECOMMENDATION_BADGE, STAGE_ADVICE } from '../../core/apiAdvisor';
import { scoreComposition } from '../../core/compositionScorer';
import { buildRecomposeInstruction } from '../../core/claudeCodeBridge';
import { recentUsedTitlesAndHooks } from '../../core/hookLedger';
import { getRatingForSong } from '../../core/ratingLedger';
import type { LyricTranslationResult } from '../../core/lyricsTranslation';
import type { AgentEvaluation, DisplayLanguage, GenerationOptions, PlaylistBlueprint, ProviderSettings, SongIdea, SoundSignature, ThumbnailVariantId } from '../../types';
import type { ChannelPersonaRecord } from '../../core/library';
import type { ThumbnailSpec } from '../../core/thumbnailSpec';
import type { ThumbnailArchetypeId } from '../../data/thumbnailArchetypes';

export type ResultTab = 'songs' | 'thumbnail' | 'persona' | 'srt';

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

  const blockingSongs = useMemo(() => {
    if (!blueprint) return [];
    const scores = scoreComposition(blueprint.songs, { historicalHooks });
    return scores
      .filter(score => !score.passed)
      .map(score => ({ song: blueprint.songs.find(song => song.trackNo === score.trackNo)!, blocking: score.blocking }))
      .filter(entry => entry.song);
  }, [blueprint, historicalHooks]);

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
        </div>
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

      {blueprint && resultTab === 'thumbnail' && thumbnailSpec && (
        <ThumbnailImageStudioPanel
          spec={thumbnailSpec}
          defaultSeasonId={thumbnailSeasonId}
          defaultArchetypeId={thumbnailArchetypeId}
          textModelSettings={textModelSettings}
        />
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
            {blockingSongs.length}곡이 작곡 품질 검사(compositionScorer)를 통과하지 못했습니다: {blockingSongs.map(entry => entry.song.trackNo).join(', ')}번.
            브릿지(코딩 에이전트 복사/붙여넣기)로 만든 곡이라면 재작곡 지시문을 복사해 해당 곡만 다시 만들게 하세요.
            <button type="button" className="icon-button" title="문제가 있는 곡만 다시 작곡시킬 지시문 복사" onClick={() => void handleCopyRecomposeInstruction()}>
              <Copy size={14} />
              {recomposeCopied ? '복사됨 ✅' : '재작곡 지시문 복사'}
            </button>
          </span>
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
