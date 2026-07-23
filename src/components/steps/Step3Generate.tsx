import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Coins, Copy, Download, FileJson, Info, Layers, Search, Settings2, ShieldAlert, Wand2 } from 'lucide-react';
import { clampMultiSetTotal, clampSongCount, MULTI_SET_TOTAL_CAP } from '../../utils/generation';
import { estimateCost, type TokenRange } from '../../core/costEstimator';
import { getSetting } from '../../core/settingsStore';
import { buildSystemInstruction, buildUserInstruction } from '../../core/promptComposer';
import { channelExhaustionStats, packCapacityWarning, type ExhaustionStats } from '../../core/hookLedger';
import { RECOMMENDATION_BADGE, STAGE_ADVICE } from '../../core/apiAdvisor';
import { defaultModelFor } from '../../data/modelRegistry';
import { safeAvoidSet } from '../../hooks/useGenerationFlow';
import { preallocateSongSlots } from '../../core/batchPreallocation';
import { buildClaudeCodeInstruction, buildMultiSetClaudeCodeInstructions, type ImportSongsReport, type MultiSetBridgeInstruction } from '../../core/claudeCodeBridge';
import { copyText, downloadText } from '../../utils/exporters';
import DryRunPreviewModal from '../DryRunPreviewModal';
import BatchJobPanel from '../BatchJobPanel';
import type { BatchJobRecord } from '../../core/batchJobs';
import type { BatchContext, GenerationOptions, GenrePack, MoodPack, ProviderSettings, SeasonPack } from '../../types';

const HOOK_EXHAUSTION_WARNING_THRESHOLD = 80;
/** v3.32 — 40곡부터 Batch API 대량 생성 강조 문구를 띄우는 기준선. */
const BULK_BATCH_ADVICE_THRESHOLD = 40;

const SONG_COUNT_CHIPS = [1, 5, 10, 12, 20, 30, 40, 60, 80];

function formatRange(range: TokenRange) {
  return `${Math.round(range.low).toLocaleString()} ~ ${Math.round(range.high).toLocaleString()}`;
}

/** TASK v3.33 — multi-set generation controls/state, all owned by App.tsx (mirrors batchMode's ownership pattern) so a run survives a step navigation away and back. */
interface MultiSetControls {
  mode: boolean;
  onModeChange: (value: boolean) => void;
  setCount: number;
  onSetCountChange: (value: number) => void;
  songsPerSet: number;
  onSongsPerSetChange: (value: number) => void;
  isRunning: boolean;
  /** 1-based, 0 before the first set starts. */
  currentSet: number;
  totalSets: number;
  setProgress: { done: number; total: number };
  error: string;
  warnings: string[];
  onGenerate: () => void;
  onCancel: () => void;
}

interface Step3GenerateProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  genres: GenrePack[];
  moods: MoodPack[];
  season: SeasonPack;
  provider: ProviderSettings;
  onOpenSettings: () => void;
  isGenerating: boolean;
  genProgress: { done: number; total: number };
  error: string;
  onGenerate: () => void;
  hybridMode: boolean;
  onHybridModeChange: (value: boolean) => void;
  onOpenHookHistory: () => void;
  batchMode: boolean;
  onBatchModeChange: (value: boolean) => void;
  activeBatchJob: BatchJobRecord | null;
  onCancelBatchJob: () => void;
  onRetryFailedBatchJob: () => void;
  onRegenerateMissingBatchTracks: () => void;
  /** TASK v3.24 — Claude Code bridge: reads a coding agent's songs-output.json back in, runs it through the same quality/safety pipeline as any API-generated pack, and returns a report of what was imported vs. skipped. */
  onImportSongsJson: (file: File) => Promise<ImportSongsReport>;
  /** TASK v3.35 (bridge split) — multi-set bridge import: one file per set, selected together. */
  onImportMultiSetSongsJson: (files: File[]) => Promise<ImportSongsReport[]>;
  /** TASK v3.35 (bridge split) — grows as bridge-imported sets actually land, so not-yet-copied instructions in the list below reflect real titles/hooks instead of only the deterministic preallocated fallback. */
  bridgeImportedSetAvoid: { usedTitles: string[]; usedHooks: string[] };
  multiSet: MultiSetControls;
}

export default function Step3Generate({
  opts, setOpts, genres, moods, season, provider, onOpenSettings, isGenerating, genProgress, error, onGenerate,
  hybridMode, onHybridModeChange, onOpenHookHistory, batchMode, onBatchModeChange, activeBatchJob, onCancelBatchJob, onRetryFailedBatchJob, onRegenerateMissingBatchTracks,
  onImportSongsJson, onImportMultiSetSongsJson, bridgeImportedSetAvoid, multiSet
}: Step3GenerateProps) {
  const providerLabel = provider.provider === 'local'
    ? '로컬 템플릿 (무료)'
    : provider.provider === 'anthropic'
      ? `Claude (${provider.model || defaultModelFor('anthropic')})`
      : `ChatGPT (${provider.model || defaultModelFor('openai')})`;

  const [inputPrice, setInputPrice] = useState<number | null>(null);
  const [outputPrice, setOutputPrice] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hookStats, setHookStats] = useState<ExhaustionStats | null>(null);
  const [bridgeAvoid, setBridgeAvoid] = useState<{ usedTitles: string[]; usedHooks: string[] }>({ usedTitles: [], usedHooks: [] });
  const [bridgeCopied, setBridgeCopied] = useState(false);
  const [importReport, setImportReport] = useState<ImportSongsReport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  // TASK v3.35 (bridge split) — per-set copy/completion tracking for the multi-set instruction list; session-only (not persisted), reset implicitly whenever the instruction list itself is recomputed (channel/set-count/set-size change) since those are different sets entirely.
  const [copiedSetIndexes, setCopiedSetIndexes] = useState<Set<number>>(new Set());
  const [completedSetIndexes, setCompletedSetIndexes] = useState<Set<number>>(new Set());
  const [multiImportReports, setMultiImportReports] = useState<ImportSongsReport[] | null>(null);
  const [isMultiImporting, setIsMultiImporting] = useState(false);

  useEffect(() => {
    void getSetting<string>('pricing:inputPerM').then(value => setInputPrice(value ? Number(value) : null));
    void getSetting<string>('pricing:outputPerM').then(value => setOutputPrice(value ? Number(value) : null));
  }, []);

  // TASK v3.24 — the Claude Code bridge instruction needs the same
  // cross-pack usedTitles/usedHooks avoid-list as a real generation call
  // (see hooks/useGenerationFlow.ts's safeAvoidSet), so a coding agent's
  // output doesn't collide with a channel's prior packs either.
  useEffect(() => {
    let cancelled = false;
    void safeAvoidSet(opts.channel.id, opts.lyricLanguage).then(avoid => {
      if (!cancelled) setBridgeAvoid({ usedTitles: avoid.usedTitles ?? [], usedHooks: avoid.usedHooks ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, [opts.channel.id, opts.lyricLanguage]);

  useEffect(() => {
    let cancelled = false;
    void channelExhaustionStats(opts.channel.id, opts.lyricLanguage, opts.channel.archetype)
      .then(stats => {
        if (!cancelled) setHookStats(stats);
      })
      .catch(() => {
        // IndexedDB unavailable — the warning is a convenience, not required to generate.
      });
    return () => {
      cancelled = true;
    };
  }, [opts.channel.id, opts.lyricLanguage, opts.channel.archetype]);

  const costEstimate = estimateCost(opts.songCount, provider, inputPrice, outputPrice);
  // TASK v3.33 — multi-set mode's real cost/pool projection uses the whole
  // run's total songCount (setCount x songsPerSet), not opts.songCount.
  const multiSetClamped = clampMultiSetTotal(multiSet.setCount, multiSet.songsPerSet);
  const multiSetTotalSongs = multiSetClamped.setCount * multiSetClamped.songsPerSet;
  const multiSetCostEstimate = estimateCost(multiSetClamped.songsPerSet, provider, inputPrice, outputPrice);
  const effectiveSongCount = multiSet.mode ? multiSetTotalSongs : opts.songCount;
  const packWarning = hookStats && hookStats.poolSize > 0 ? packCapacityWarning(hookStats, effectiveSongCount) : null;

  // Representative preview of the first batch — later batches add accumulated
  // usedTitles/usedHooks, called out in the modal's own copy.
  const previewBatch: BatchContext = { trackNoOffset: 0, totalSongCount: opts.songCount, usedTitles: [], usedHooks: [], lockedIdentity: null };
  const previewSystemPrompt = buildSystemInstruction(opts, previewBatch, undefined, provider.generateThumbnailText ?? false);
  const previewUserPrompt = JSON.stringify(buildUserInstruction(opts, genres, moods, season, previewBatch, provider.generateThumbnailText ?? false), null, 2);

  // TASK v3.24 — same locally pre-decided title/hook assignment the Batch
  // API path already uses (preallocateSongSlots), so a coding agent's
  // free-form generation can't collide with itself across tracks, and the
  // import step below can reconcile against the same slots.
  const bridgePreassignedSongs = useMemo(
    () => preallocateSongSlots(opts, genres, bridgeAvoid),
    [opts, genres, bridgeAvoid]
  );
  const claudeCodeInstruction = useMemo(
    () => buildClaudeCodeInstruction(opts, genres, moods, season, bridgeAvoid, bridgePreassignedSongs, provider.generateThumbnailText ?? false),
    [opts, genres, moods, season, bridgeAvoid, bridgePreassignedSongs, provider.generateThumbnailText]
  );

  async function handleCopyClaudeCodeInstruction() {
    await copyText(claudeCodeInstruction);
    setBridgeCopied(true);
    setTimeout(() => setBridgeCopied(false), 2000);
  }

  function handleDownloadClaudeCodeInstruction() {
    downloadText('claude-code-instruction.txt', claudeCodeInstruction, 'text/plain;charset=utf-8');
  }

  async function handleImportSongsFile(file: File) {
    setIsImporting(true);
    try {
      const report = await onImportSongsJson(file);
      setImportReport(report);
    } finally {
      setIsImporting(false);
    }
  }

  // TASK v3.35 (bridge split) — real measurement: a single coding-agent
  // response can't safely produce more than ~18-20 songs' worth of output
  // (see claudeCodeBridge.ts's ClaudeCodeInstructionOptions doc comment for
  // the token math), so a multi-set bridge export is one instruction per
  // set instead of one instruction for the whole run. Folds in
  // bridgeImportedSetAvoid so a not-yet-copied set's instruction reflects
  // real titles/hooks from sets already imported in this session, on top of
  // the channel's own cross-pack ledger history.
  const combinedBridgeAvoid = useMemo(
    () => ({
      usedTitles: [...bridgeAvoid.usedTitles, ...bridgeImportedSetAvoid.usedTitles],
      usedHooks: [...bridgeAvoid.usedHooks, ...bridgeImportedSetAvoid.usedHooks]
    }),
    [bridgeAvoid, bridgeImportedSetAvoid]
  );
  const multiSetBridgeInstructions = useMemo<MultiSetBridgeInstruction[]>(
    () => multiSet.mode
      ? buildMultiSetClaudeCodeInstructions(
        opts,
        multiSetClamped.setCount,
        multiSetClamped.songsPerSet,
        genres,
        moods,
        season,
        combinedBridgeAvoid,
        provider.generateThumbnailText ?? false
      )
      : [],
    [multiSet.mode, opts, multiSetClamped.setCount, multiSetClamped.songsPerSet, genres, moods, season, combinedBridgeAvoid, provider.generateThumbnailText]
  );

  async function handleCopySetInstruction(item: MultiSetBridgeInstruction) {
    await copyText(item.instruction);
    setCopiedSetIndexes(prev => new Set(prev).add(item.setIndex));
    setCompletedSetIndexes(prev => new Set(prev).add(item.setIndex));
  }

  function handleToggleSetCompleted(setIndex: number) {
    setCompletedSetIndexes(prev => {
      const next = new Set(prev);
      if (next.has(setIndex)) next.delete(setIndex);
      else next.add(setIndex);
      return next;
    });
  }

  async function handleMultiImportFiles(fileList: FileList) {
    setIsMultiImporting(true);
    try {
      const reports = await onImportMultiSetSongsJson(Array.from(fileList));
      setMultiImportReports(reports);
    } finally {
      setIsMultiImporting(false);
    }
  }

  return (
    <section className="panel">
      <p className="step-hint">몇 곡을 만들지 정하고 생성 버튼을 누르세요. 생성 중에도 화면을 벗어나지 않아도 됩니다.</p>

      <div className="provider-summary">
        <div className="panel-title">
          <Layers size={18} />
          <h2>생성 모드</h2>
        </div>
        <div className="chips">
          <button type="button" className={!multiSet.mode ? 'chip active' : 'chip'} onClick={() => multiSet.onModeChange(false)}>
            단일 팩
          </button>
          <button type="button" className={multiSet.mode ? 'chip active' : 'chip'} onClick={() => multiSet.onModeChange(true)}>
            멀티 세트 (세트별 영상 여러 개를 한 번에)
          </button>
        </div>
        <p className="supporting">
          {multiSet.mode
            ? '세트 수 x 세트당 곡수만큼 생성해, 세트마다 독립된 콜드오픈/플래그십을 갖는 별도 팩으로 저장합니다 (예: 5세트 x 18곡 = 90곡, "{프로젝트명} Set 01" ~ "Set 05").'
            : '한 번에 팩 하나(최대 80곡)를 만듭니다. 주 여러 세트를 몰아서 만들려면 "멀티 세트"를 선택하세요.'}
        </p>
      </div>

      {!multiSet.mode && (
        <>
          <label>Songs (곡 수)</label>
          <div className="inline">
            <input
              type="range"
              min={1}
              max={80}
              value={opts.songCount}
              onChange={event => setOpts(prev => ({ ...prev, songCount: clampSongCount(Number(event.target.value)) }))}
            />
            <input
              type="number"
              min={1}
              max={80}
              value={opts.songCount}
              onChange={event => setOpts(prev => ({ ...prev, songCount: clampSongCount(Number(event.target.value)) }))}
            />
          </div>
          <div className="chips">
            {SONG_COUNT_CHIPS.map(count => (
              <button
                type="button"
                key={count}
                className={opts.songCount === count ? 'chip active' : 'chip'}
                onClick={() => setOpts(prev => ({ ...prev, songCount: clampSongCount(count) }))}
              >
                {count === 1 ? '1곡 (테스트)' : `${count}곡`}
              </button>
            ))}
          </div>
        </>
      )}

      {multiSet.mode && (
        <div className="provider-summary">
          <div className="panel-title">
            <Layers size={18} />
            <h2>세트 설정</h2>
          </div>
          <div className="form-grid two">
            <div>
              <label>세트 수 (1~10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={multiSet.setCount}
                onChange={event => multiSet.onSetCountChange(Number(event.target.value))}
              />
            </div>
            <div>
              <label>세트당 곡수 (6~20)</label>
              <input
                type="number"
                min={6}
                max={20}
                value={multiSet.songsPerSet}
                onChange={event => multiSet.onSongsPerSetChange(Number(event.target.value))}
              />
            </div>
          </div>
          <p className="supporting">
            총 {multiSetTotalSongs}곡 ({multiSetClamped.setCount}세트 x {multiSetClamped.songsPerSet}곡) — 합계 상한 {MULTI_SET_TOTAL_CAP}곡.
            {multiSetTotalSongs !== multiSet.setCount * multiSet.songsPerSet && ' 입력값이 상한을 넘어 자동으로 줄었습니다.'}
          </p>
          <label className="avoid-word-item">
            <input
              type="checkbox"
              checked={opts.setNumberPrefix ?? true}
              onChange={event => setOpts(prev => ({ ...prev, setNumberPrefix: event.target.checked }))}
            />
            제목에 세트 연번 포함 (예: "01. Winterglass", 세트마다 01부터 다시 시작)
          </label>
          {provider.provider !== 'local' && (
            <>
              <p className="supporting">
                예상 비용(세트당 약 {multiSetCostEstimate.costKrw ? `${Math.round(multiSetCostEstimate.costKrw.low).toLocaleString()}~${Math.round(multiSetCostEstimate.costKrw.high).toLocaleString()}원` : '단가 미입력'}) x {multiSetClamped.setCount}세트.
                실시간보다 최대 24시간 걸릴 수 있는 Batch API가 이 규모에서는 50% 저렴하고 안정적입니다 — 위 "처리 속도"에서 Batch를 선택하세요.
              </p>
              {!batchMode && (
                <div className="warning">
                  <AlertTriangle size={16} />
                  <span>💡 멀티 세트({multiSetTotalSongs}곡)는 Batch API를 강력히 권장합니다. 위에서 "여유 있게 — Batch API"를 선택하세요.</span>
                </div>
              )}
            </>
          )}
          {multiSet.isRunning && (
            <p className="supporting">
              진행 중: Set {multiSet.currentSet}/{multiSet.totalSets} — {multiSet.setProgress.done}/{multiSet.setProgress.total}곡
            </p>
          )}
          {multiSet.warnings.length > 0 && (
            <p className="warning">
              {multiSet.warnings.join(' / ')}
            </p>
          )}
          {multiSet.error && <p className="error">{multiSet.error}</p>}
          {multiSet.isRunning && (
            <div className="button-row">
              <button type="button" onClick={multiSet.onCancel}>남은 세트 취소 (진행 중인 세트는 완료)</button>
            </div>
          )}
        </div>
      )}

      {hookStats && hookStats.poolSize > 0 && (
        <div className={hookStats.percentUsed >= HOOK_EXHAUSTION_WARNING_THRESHOLD ? 'warning' : 'provider-summary'}>
          {hookStats.percentUsed >= HOOK_EXHAUSTION_WARNING_THRESHOLD ? (
            <>
              <AlertTriangle size={16} />
              <span>
                🔴 이 채널에서 사용 가능한 훅이 얼마 남지 않았습니다. 사용: {hookStats.used.toLocaleString()}개 / 전체 {hookStats.poolSize.toLocaleString()}개 ({hookStats.percentUsed}%)
                남은 훅이 부족합니다. 훅 뱅크를 확장하거나, 오래된 팩을 삭제해 이력을 비우세요.
                <button type="button" onClick={onOpenHookHistory}>훅 이력 관리</button>
              </span>
            </>
          ) : (
            <p className="supporting">
              🎵 이 채널의 훅 사용량: {hookStats.used.toLocaleString()}개 / 전체 {hookStats.poolSize.toLocaleString()}개 ({hookStats.percentUsed}%)
            </p>
          )}
        </div>
      )}

      {packWarning && (
        <div className={packWarning.level === 'none' ? 'provider-summary' : 'warning'}>
          {packWarning.level === 'none' ? (
            <p className="supporting">
              이 채널 훅 잔여 {packWarning.remainingBeforePack.toLocaleString()}개 — 이번 {multiSet.mode ? '전체 세트' : '팩'}({effectiveSongCount}곡) 후 잔여{' '}
              {packWarning.remainingAfterPack.toLocaleString()}개
              {packWarning.packsWorthAfter !== null && ` (약 ${packWarning.packsWorthAfter.toLocaleString()}팩 분량)`}
            </p>
          ) : (
            <>
              <AlertTriangle size={16} />
              <span>
                {packWarning.level === 'red' ? '🔴 ' : '🟡 '}
                이 채널 훅 잔여 {packWarning.remainingBeforePack.toLocaleString()}개 — 이번 {multiSet.mode ? '전체 세트' : '팩'}({effectiveSongCount}곡) 후 잔여{' '}
                {packWarning.remainingAfterPack.toLocaleString()}개
                {packWarning.packsWorthAfter !== null && ` (약 ${packWarning.packsWorthAfter.toLocaleString()}팩 분량)`}
                {packWarning.level === 'red'
                  ? ' — 훅 풀이 부족해 일부 곡이 생성 실패할 수 있습니다.'
                  : ' — 다음 팩부터는 부족해질 수 있으니 미리 훅 이력을 정리하세요.'}
              </span>
            </>
          )}
        </div>
      )}

      <div className="provider-summary">
        <div className="panel-title">
          <ShieldAlert size={18} />
          <h2>AI Provider (AI 제공자)</h2>
        </div>
        <p className="supporting">
          현재: {providerLabel}
          {provider.provider !== 'local' && (provider.keyStorageMode === 'local' ? ' · 브라우저에 저장된 키 사용' : ' · 서버 환경변수 사용')}
        </p>
        <button type="button" onClick={onOpenSettings}>
          <Settings2 size={16} />
          제공자 / API 키 설정 열기
        </button>
      </div>

      {provider.provider === 'local' && (
        <div className="warning">
          <Info size={16} />
          <span>
            ℹ️ 지금은 로컬 템플릿 모드입니다 (무료 · API 불필요). 곡 구조와 스타일 프롬프트는 바로 쓸 수 있지만, 가사는 조합형이라 다소 단조로울 수 있습니다.
            더 자연스러운 가사를 원하시면 ⚙️ 설정에서 Claude 또는 ChatGPT를 연결하세요.
          </span>
          <button type="button" onClick={onOpenSettings}>
            <Settings2 size={14} />
            설정 열기
          </button>
        </div>
      )}

      {provider.provider !== 'local' && (
        <div className="provider-summary">
          <div className="panel-title">
            <Wand2 size={18} />
            <h2>생성 방식</h2>
          </div>
          <div className="chips">
            <button type="button" className={!hybridMode ? 'chip active' : 'chip'} onClick={() => onHybridModeChange(false)}>
              AI로 전체 생성
            </button>
            <button type="button" className={hybridMode ? 'chip active' : 'chip'} onClick={() => onHybridModeChange(true)}>
              하이브리드: 로컬 초안 + 선택 보정 (비용 절약)
            </button>
          </div>
          <p className="supporting">
            {hybridMode
              ? '먼저 무료 로컬 템플릿으로 전체 초안을 만들고, 결과 화면에서 마음에 드는 곡만 골라 AI로 다듬을 수 있어요. 선택하지 않은 곡은 API로 전송되지 않습니다.'
              : `모든 곡을 ${providerLabel}로 바로 생성합니다.`}
          </p>
        </div>
      )}

      {provider.provider === 'anthropic' && !hybridMode && !isGenerating && !activeBatchJob && (
        <div className="provider-summary">
          <div className="panel-title">
            <Wand2 size={18} />
            <h2>처리 속도</h2>
          </div>
          <div className="chips">
            <button type="button" className={!batchMode ? 'chip active' : 'chip'} onClick={() => onBatchModeChange(false)}>
              지금 바로 (몇 초~1분 · 표준 요금)
            </button>
            <button type="button" className={batchMode ? 'chip active' : 'chip'} onClick={() => onBatchModeChange(true)}>
              여유 있게 — Batch API [추천 · 50% 저렴]
            </button>
          </div>
          <p className="supporting">
            {batchMode
              ? '보통 몇 분 내에 끝나지만 최대 24시간까지 걸릴 수 있습니다. 주 1회 발행하는 워크플로우라면 이 시간차는 대체로 문제되지 않아요. 이 탭을 닫아도 진행 상황은 저장됩니다.'
              : '80곡 기준 출력 약 65~70K 토큰입니다 (실시간 약 $2.6 · Batch 약 $1.3). 여유가 있다면 Batch API로 50% 저렴하게 생성할 수 있어요.'}
          </p>
          {!multiSet.mode && !batchMode && opts.songCount >= BULK_BATCH_ADVICE_THRESHOLD && (
            <div className="warning">
              <AlertTriangle size={16} />
              <span>💡 대량 생성({opts.songCount}곡)은 Batch API가 50% 저렴하고 안정적입니다. 위에서 "여유 있게 — Batch API"를 선택하세요.</span>
            </div>
          )}
        </div>
      )}

      {activeBatchJob && (
        <BatchJobPanel
          job={activeBatchJob}
          currentOpts={opts}
          onCancel={onCancelBatchJob}
          onRetryFailed={onRetryFailedBatchJob}
          onRegenerateMissing={onRegenerateMissingBatchTracks}
        />
      )}

      {provider.provider !== 'local' && !hybridMode && (
        <div className="provider-summary">
          <div className="panel-title">
            <Coins size={18} />
            <h2>예상 비용 (참고용 · 대략적인 범위)</h2>
          </div>
          <p className="supporting">
            API 호출 약 {costEstimate.apiCalls}회 · 예상 입력 토큰 {formatRange(costEstimate.inputTokens)} · 예상 출력 토큰 {formatRange(costEstimate.outputTokens)}
          </p>
          {costEstimate.costKrw ? (
            <p className="supporting">
              예상 비용: 약 {Math.round(costEstimate.costKrw.low).toLocaleString()}원 ~ {Math.round(costEstimate.costKrw.high).toLocaleString()}원
              (설정에 입력한 단가 기준의 대략적인 범위이며, 실제 청구 금액과 다를 수 있습니다. 정확한 사용량은 생성 후 설정의 "API 사용 기록"에서 확인하세요.)
            </p>
          ) : (
            <p className="supporting">⚙️ 설정에서 토큰 단가를 입력하면 예상 비용 범위도 함께 볼 수 있어요. 실제 사용량은 생성 후 정확히 기록됩니다.</p>
          )}
        </div>
      )}

      {provider.provider !== 'local' && hybridMode && (
        <p className="supporting">
          💡 하이브리드 모드에서는 초안 생성이 무료입니다. 실제 API 비용은 결과 화면에서 다듬을 곡을 선택한 만큼만 발생해요.
        </p>
      )}

      {provider.provider !== 'local' && (
        <div className="button-row">
          <button type="button" onClick={() => setPreviewOpen(true)}>
            <Search size={16} />
            API로 보낼 프롬프트 미리보기 (호출 없음)
          </button>
        </div>
      )}

      <div className="provider-summary">
        <div className="panel-title">
          <FileJson size={18} />
          <h2>Claude Code 브릿지 (API 비용 0)</h2>
        </div>
        <p className="supporting">
          정액제 코딩 에이전트(Claude Code, Codex 등)로 곡을 만들어 API 비용을 0으로 만드는 경로입니다.
          정액제 서비스의 대량 사용은 해당 서비스 약관을 직접 확인하세요.
        </p>
        <p className="supporting">
          브릿지는 한 번에 최대 18곡까지 안정적입니다. 180곡은 세트 10개로 나눠 순서대로 진행하세요.
          한 번에 대량이 필요하면 Batch API를 쓰세요 (서버가 자동 분할하므로 180곡도 한 번에 가능).
        </p>

        {!multiSet.mode ? (
          <>
            <p className="supporting">
              아래 지시문을 복사해 Claude Code에 붙여넣으면, 결과를 "songs-output.json" 파일로 저장하도록 안내되어 있어요.
              그 파일을 다시 이 화면에서 가져오면 API 경로와 동일한 품질·안전 검사를 거쳐 결과 화면에 반영됩니다.
            </p>
            <div className="button-row">
              <button type="button" onClick={() => void handleCopyClaudeCodeInstruction()}>
                <Copy size={16} />
                {bridgeCopied ? '복사됨 ✅' : 'Claude Code용 지시문 복사'}
              </button>
              <button type="button" onClick={handleDownloadClaudeCodeInstruction}>
                <Download size={16} />
                .txt로 다운로드
              </button>
              <label className="import-button" title="Claude Code가 만든 songs-output.json 가져오기">
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void handleImportSongsFile(file);
                    event.target.value = '';
                  }}
                />
                <FileJson size={16} />
                {isImporting ? '가져오는 중...' : '곡 JSON 가져오기'}
              </label>
            </div>
            {importReport && (
              <p className={importReport.blueprint ? 'supporting' : 'error'}>
                {importReport.blueprint
                  ? `✅ ${importReport.importedCount + importReport.skippedCount}곡 중 ${importReport.importedCount}곡 가져옴${importReport.skippedCount ? `, ${importReport.skippedCount}곡 실패` : ''}`
                  : `❌ 가져오지 못했습니다: ${importReport.skippedReasons.join(' / ') || '알 수 없는 오류'}`}
                {importReport.skippedReasons.length > 0 && importReport.blueprint && (
                  <> — 실패 사유: {importReport.skippedReasons.join(' / ')}</>
                )}
              </p>
            )}
            {importReport?.warnings.length ? (
              <p className="warning">
                Import warnings: {importReport.warnings.join(' / ')}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="supporting">
              세트별로 지시문이 분리되어 있어 각 지시문은 그 세트({multiSetClamped.songsPerSet}곡)만 요청합니다 — LLM 응답이 잘리지 않아요.
              Set 01부터 순서대로 복사해 코딩 에이전트에 붙여넣고 결과 파일을 받은 뒤, 완료 체크하고 다음 세트로 넘어가세요.
              세트2 이후 지시문에는 앞선 세트들의 제목/훅이 회피 목록으로 자동 반영됩니다(가져오기를 마칠 때마다 갱신).
            </p>
            <p className="supporting">
              진행 상황: 복사 {copiedSetIndexes.size}/{multiSetBridgeInstructions.length} · 완료 체크 {completedSetIndexes.size}/{multiSetBridgeInstructions.length}
            </p>
            <div className="bridge-set-list">
              {multiSetBridgeInstructions.map(item => (
                <div key={item.setIndex} className="bridge-set-row">
                  <label className="avoid-word-item">
                    <input
                      type="checkbox"
                      checked={completedSetIndexes.has(item.setIndex)}
                      onChange={() => handleToggleSetCompleted(item.setIndex)}
                    />
                    Set {String(item.setIndex + 1).padStart(2, '0')} ({multiSetClamped.songsPerSet}곡) — {item.outputFilename}
                  </label>
                  <button type="button" onClick={() => void handleCopySetInstruction(item)}>
                    {copiedSetIndexes.has(item.setIndex) ? <Check size={16} /> : <Copy size={16} />}
                    {copiedSetIndexes.has(item.setIndex) ? '복사됨' : '복사'}
                  </button>
                </div>
              ))}
            </div>
            <div className="button-row">
              <label className="import-button" title="songs-output-set01.json ~ setNN.json 파일을 한 번에 선택">
                <input
                  type="file"
                  accept="application/json"
                  multiple
                  style={{ display: 'none' }}
                  onChange={event => {
                    const files = event.target.files;
                    if (files && files.length) void handleMultiImportFiles(files);
                    event.target.value = '';
                  }}
                />
                <FileJson size={16} />
                {isMultiImporting ? '가져오는 중...' : '세트 파일 일괄 가져오기 (여러 개 선택)'}
              </label>
            </div>
            {multiImportReports && (
              <p className="supporting">
                {multiImportReports.filter(report => report.blueprint).length}/{multiImportReports.length}개 세트 파일을 가져왔습니다
                {multiImportReports.some(report => !report.blueprint) ? ` — 실패 ${multiImportReports.filter(report => !report.blueprint).length}개: ${multiImportReports.filter(report => !report.blueprint).flatMap(report => report.skippedReasons).join(' / ')}` : ''}
              </p>
            )}
            {multiImportReports?.some(report => report.warnings.length) ? (
              <p className="warning">
                {multiImportReports.flatMap(report => report.warnings).join(' / ')}
              </p>
            ) : null}
          </>
        )}
      </div>

      <DryRunPreviewModal
        open={previewOpen}
        systemPrompt={previewSystemPrompt}
        userPrompt={previewUserPrompt}
        onClose={() => setPreviewOpen(false)}
      />

      {provider.provider === 'local' && (
        <p className="supporting api-advice-line">
          {RECOMMENDATION_BADGE[STAGE_ADVICE.lyrics.recommendation].emoji} {RECOMMENDATION_BADGE[STAGE_ADVICE.lyrics.recommendation].labelKo} ({STAGE_ADVICE.lyrics.suggestedModelKo}): {STAGE_ADVICE.lyrics.reasonKo}
        </p>
      )}

      {multiSet.mode ? (
        <button
          type="button"
          className="primary full-width action-button"
          disabled={multiSet.isRunning}
          onClick={multiSet.onGenerate}
        >
          <Layers size={18} />
          {multiSet.isRunning
            ? `생성 중... Set ${multiSet.currentSet}/${multiSet.totalSets} (${multiSet.setProgress.done}/${multiSet.setProgress.total}곡)`
            : batchMode && provider.provider === 'anthropic'
              ? `${multiSetTotalSongs}곡 (${multiSetClamped.setCount}세트) Batch API로 제출하기`
              : `${multiSetTotalSongs}곡 (${multiSetClamped.setCount}세트) 생성하기`}
        </button>
      ) : (
        <button
          type="button"
          className="primary full-width action-button"
          disabled={isGenerating || activeBatchJob?.status === 'in_progress' || activeBatchJob?.status === 'submitting' || activeBatchJob?.status === 'canceling'}
          onClick={onGenerate}
        >
          <Wand2 size={18} />
          {isGenerating
            ? `생성 중... (${genProgress.done}/${genProgress.total})`
            : batchMode && provider.provider === 'anthropic' && !hybridMode
              ? `${opts.songCount}곡 Batch API로 제출하기`
              : hybridMode && provider.provider !== 'local'
                ? `${opts.songCount}곡 무료 초안 만들기`
                : `${opts.songCount}곡 생성하기`}
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
