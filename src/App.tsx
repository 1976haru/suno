import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Wand2 } from 'lucide-react';
import { genrePacks, moodPacks, seasonPacks } from './data/presets';
import { getDefaultGenreIdsForArchetype } from './data/genreLibrary';
import { BUILD_INFO } from './core/buildInfo';
import { checkConceptCompatibility } from './core/conceptCompatibility';
import type { ThumbnailArchetypeId } from './data/thumbnailArchetypes';
import { moneyChordPresets } from './data/moneyChords';
import { AUTOSAVE_ID, listChannelPersonas, recordChannelPersonaUse, saveAutosave, saveChannelPersona, type ChannelPersonaRecord } from './core/library';
import { isEvaluationAvailable } from './agents/evaluator';
import { computeCacheKey, getCached, setCached } from './core/apiCache';
import { validateProviderTrackSet } from './core/importValidation';
import { bumpGenerationHistoryRevision } from './core/generationHistoryRevision';
import { recordUsage } from './core/usageLedger';
import { buildThumbnailSpec } from './core/thumbnailSpec';
import { channelExhaustionStats, clearChannelHistory, hookPoolGraduatedWarning, recordPackHooks, usedTitles as fetchHistoricalTitles, type ExhaustionStats } from './core/hookLedger';
import { recordPackSituations, recentSituations } from './core/situationLedger';
import { recordPackLyricLines, recentLyricLines } from './core/lyricLineLedger';
import { copyText } from './utils/exporters';
import { genreSanitizationWarningKo, normalizeGenreSelection, sanitizeGenreIdsForArchetype, toggleGenreSelection } from './core/genreSelection';
import { clampOversizedFields, INPUT_LIMITS } from './core/inputLimits';
import { updateBatchJob } from './core/batchJobs';
import { getSetting, setSetting } from './core/settingsStore';
import { mergeRestoredProviderSettings, sanitizeProviderSettingsForPersistence } from './core/providerSettingsPersistence';
import { buildSignatureBlueprint, rebuildStylePromptsForPersonaMode, resolveBilingualPair } from './core/localGenerator';
import { applyLyricWorkspaceEdit, applyPronunciationHints, regenerateSingleLyricLine } from './core/lyricAuthorship';
import type { LyricTranslationResult } from './core/lyricsTranslation';
import { buildSoundSignature, PERSONA_STYLE_LIMIT } from './core/soundSignature';
import { promoteTrackToOpeningRole } from './core/openingOverride';
import { regenerateTrack } from './providers';
import { useChannelManager } from './hooks/useChannelManager';
import { usePackLibrary } from './hooks/usePackLibrary';
import { useGenerationFlow, safeAvoidSet } from './hooks/useGenerationFlow';
import { preallocateSongSlots } from './core/batchPreallocation';
import { evaluateGenerationRequest } from './core/generationPreflight';
import { evaluateDesignGateResponsive } from './core/localGenerationClient';
import { genresForOptions, moodsForOptions, resolveGenerationContext, withGenerationSnapshot } from './core/generationSnapshot';
import { applyConceptFitScore } from './core/promiseAudit';
import { importSongsJson, importSongsForSrtOnly, extractBridgeImportMeta, extractRawImportedSongs, reconcileImportOptsWithMeta, type ImportSongsReport } from './core/claudeCodeBridge';
import { BRIDGE_IMPORT_PRECONDITION_REASON, makeBridgeImportFailureReport } from './core/bridgeImportUi';
import { inspectImportReport, buildMissingTracksRegenerateInstruction, buildArtistLeakRegenerateInstruction, type ImportInspection } from './core/importInspection';
import { planMultiSetImport, type MultiSetImportSetInput, type MultiSetImportSetResult } from './core/multiSetImportInspection';
import ImportInspectionModal from './components/ImportInspectionModal';
import { parseSetName, sanitizeLabel } from './utils/setNaming';
import { useEvaluationFlow } from './hooks/useEvaluationFlow';
import { useBatchGenerationFlow } from './hooks/useBatchGenerationFlow';
import { useMultiSetGenerationFlow } from './hooks/useMultiSetGenerationFlow';
import { buildSetOptions, combineMultiSetPreflight, evaluateMultiSetGenerationRequest, type SetResult } from './core/multiSetGeneration';
import { applySetTitlePrefixesToBlueprint, clampMultiSetTotal, createInitialOptions, stripSetTitlePrefix } from './utils/generation';
import { defaultPackagingLanguageForChannel, resolvePackagingLanguage } from './core/packagingLanguage';
import { detectProvenanceDowngrades, languageOverrideConfirmMessageKo, shouldConfirmLanguageOverride } from './core/userChoices';
import { applyListeningIntentIfPending } from './core/listeningIntent';
import { LISTENING_INTENT_POLICY } from './data/listeningIntentPolicy';
import { PERCEIVED_ENERGY_POLICY } from './data/perceivedEnergyPolicy';
import { workspaceForArchetype } from './data/workspaces';
import type { ChannelProfile, GenerationOptions, PlaylistBlueprint, PreassignedSongSlot, ProviderSettings, SoundSignature, ThumbnailVariantId, WorkspaceId } from './types';
import { getWorkspace } from './data/workspaces';
import { isMigrationPending, runWorkspaceMigrationOnce, runSnapshotSecretMigrationOnce } from './core/workspaceMigration';
import { currentWorkspaceId, setCurrentWorkspace } from './core/workspaceScope';
import { downloadBlob, exportAllWorkspacesBlob, nextTransferFileName, recordBackupNow } from './core/workspaceTransfer';
import { workspaceDefinitions } from './data/workspaces';
import WorkspaceSelectScreen, { skipWorkspacePickerPreference } from './components/WorkspaceSelectScreen';
import MigrationBackupPrompt from './components/MigrationBackupPrompt';
import SettingsModal from './components/SettingsModal';
import HookExhaustionWarningModal from './components/HookExhaustionWarningModal';
import CachePromptModal from './components/CachePromptModal';
import Sidebar from './components/Sidebar';
import StepIndicator, { type StepDef } from './components/StepIndicator';
import Step1Channel from './components/steps/Step1Channel';
import Step2Concept from './components/steps/Step2Concept';
import Step2Plan from './components/steps/Step2Plan';
import Step3Generate from './components/steps/Step3Generate';
import Step4Result, { type ResultTab } from './components/steps/Step4Result';
import WizardNav from './components/WizardNav';
import StepErrorBoundary from './components/StepErrorBoundary';
import VideoDashboard from './components/VideoDashboard';
import RatingInsightsPanel from './components/RatingInsightsPanel';
import ThumbnailImageStudioPanel from './components/ThumbnailImageStudioPanel';
import ExperimentalFeatureBoundary from './components/ExperimentalFeatureBoundary';

const STEPS: StepDef[] = [
  { id: 1, label: '채널' },
  { id: 2, label: '컨셉' },
  { id: 3, label: '설계안' },
  { id: 4, label: '생성' },
  { id: 5, label: '결과' }
];

/**
 * TASK v3.17 — provider was useState-only with no persistence, so every
 * page refresh or dev-server restart silently reset it to 'local' even
 * after the user picked Anthropic in settings. apiKey/accessToken are
 * excluded from what gets stored: the key already lives at byok:{provider}
 * (see SettingsModal) and re-storing it here would duplicate a secret;
 * accessToken is likewise sensitive and not worth persisting.
 */
const PROVIDER_SETTINGS_KEY = 'providerSettings';
const UI_MODE_KEY = 'ui:mode';

interface WizardAppProps {
  workspaceId: WorkspaceId;
  /** v4.0 (TASK D) — hands control back to the outer App component, which unmounts this whole component (see App()'s key={workspaceId}) and shows the picker again. Checking for an in-flight batch job before calling this is this component's own job (it's the only place that state lives) — see handleRequestSwitchWorkspace below. */
  onSwitchWorkspace: () => void;
  /** TASK (gap 2 — workspace recovery) — jumps DIRECTLY to a specific workspace (unlike onSwitchWorkspace, which only resets to the picker screen). Threaded down to Step3Generate's "채널의 워크스페이스로 이동" recovery button — core/userChoices.ts's buildResolvedGenerationContract now surfaces the channel's real correct workspaceId via ResolvedGenerationContract.workspaceRecovery.correctWorkspaceId when it disagrees with the currently active one. */
  onNavigateToWorkspace: (id: WorkspaceId) => void;
}

/**
 * v4.0 (TASK A1/D) — this used to be the default-exported App(). It is now
 * mounted with key={workspaceId} by the real default export below, so
 * switching workspaces fully unmounts and remounts every hook in this
 * component (opts, blueprint, selected channel, step, bridge instruction
 * text, batch flow, everything) — this task's own explicit "전환 시 상태
 *초기화" requirement, satisfied structurally rather than by manually
 * resetting each of the ~15 state variables below one at a time (and risking
 * missing one).
 */
function WizardApp({ workspaceId, onSwitchWorkspace, onNavigateToWorkspace }: WizardAppProps) {
  const workspace = getWorkspace(workspaceId);
  const [provider, setProvider] = useState<ProviderSettings>({ provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<'qwen' | undefined>();
  const [expertMode, setExpertMode] = useState(true);
  const [topBridgeInstruction, setTopBridgeInstruction] = useState('');
  const [workspaceFocus, setWorkspaceFocus] = useState<ResultTab | undefined>();
  const [thumbnailStandaloneOpen, setThumbnailStandaloneOpen] = useState(false);
  const [thumbnailStandaloneSeasonId, setThumbnailStandaloneSeasonId] = useState('christmas');
  const [currentStep, setCurrentStep] = useState(1);
  const [cachePrompt, setCachePrompt] = useState<{ key: string; cachedAt: string } | null>(null);
  const [hybridMode, setHybridMode] = useState(false);
  const [thumbnailVariant, setThumbnailVariant] = useState(0);
  const [selectedThumbnailVariant, setSelectedThumbnailVariant] = useState<ThumbnailVariantId>('A');
  const [thumbnailArchetypeId, setThumbnailArchetypeId] = useState<ThumbnailArchetypeId>('autumn-window-golden');
  /** TASK H6 (v3.10) — set only when the user asks the concept agent for thumbnail copy; coexists with (never replaces) v3.6's season/emotion/audience A/B/C strategy. */
  const [thumbnailFreeTextHeadlines, setThumbnailFreeTextHeadlines] = useState<{ headline: string; angle: string }[] | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [loadWarning, setLoadWarning] = useState('');
  const [savedPersonas, setSavedPersonas] = useState<ChannelPersonaRecord[]>([]);
  const [hookExhaustionWarning, setHookExhaustionWarning] = useState<ExhaustionStats | null>(null);
  /** TASK v3.33 — which pack size triggered hookExhaustionWarning: opts.songCount for the single-pack path, the multi-set total for the multi-set path. Tracked separately since the modal's "will this pack fit in what's left" message needs the real requested count, not always opts.songCount. */
  const [hookExhaustionPackSongCount, setHookExhaustionPackSongCount] = useState(0);
  const [multiSetMode, setMultiSetMode] = useState(false);
  const [multiSetCount, setMultiSetCount] = useState(5);
  const [multiSetSongsPerSet, setMultiSetSongsPerSet] = useState(18);
  const [multiSetWarnings, setMultiSetWarnings] = useState<string[]>([]);
  /** TASK v3.35 (bridge split) — grows as each bridge-imported set actually lands, so Step3Generate's not-yet-copied instruction previews (buildMultiSetClaudeCodeInstructions) reflect real titles/hooks instead of only the deterministic preallocated fallback. Reset whenever the user starts a fresh multi-set bridge batch (see onImportMultiSetSongsJson). */
  const [bridgeImportedSetAvoid, setBridgeImportedSetAvoid] = useState<{ usedTitles: string[]; usedHooks: string[] }>({ usedTitles: [], usedHooks: [] });
  /**
   * TASK (import transaction / pre-persistence inspection) — holds a
   * single-pack bridge import (onImportSongsJson) that inspectImportReport
   * classified as 'repairable' or 'blocked', BEFORE any autosave/hook
   * registration. null means no inspection screen is showing (either
   * nothing has been imported yet, or the last import was 'valid' and
   * proceeded immediately with zero extra clicks — see onImportSongsJson).
   * A 'repairable' entry's onConfirm is the ONLY path that ever runs the
   * real persistence sequence for a partial pack; dismissing the modal
   * instead leaves hookLedger/library completely untouched.
   */
  const [pendingImportInspection, setPendingImportInspection] = useState<{
    inspection: ImportInspection;
    onConfirm?: () => void;
    /**
     * TASK (post-generation operation snapshot) — the real, resolved
     * GenerationOptions this import attempt actually ran under (the file's
     * matched channel, not necessarily whatever channel is live on screen
     * by the time the user clicks "[재생성 지시문 복사]" on the inspection
     * modal). See onCopyMissingTracksInstruction's own doc comment.
     */
    importOpts?: GenerationOptions;
    /**
     * TASK v5.19 (TASK C) — the exact report/rawSongs this inspection was
     * computed from, kept so "오탐입니다 — 이대로 진행" can re-run
     * inspectImportReport with the updated session-exemption set without
     * re-reading/re-parsing the file (see onReportArtistLeakFalsePositive).
     */
    report?: ImportSongsReport;
    rawSongs?: unknown[];
    /** TASK v5.19 (TASK C) — preserved so onReportArtistLeakFalsePositive's rebuilt onConfirm matches the original import's own focusTab/slots exactly, instead of defaulting. */
    focusTab?: ResultTab;
    preassignedSongs?: PreassignedSongSlot[];
    /** v5.22 (AXIS 1) — same "preserve so a re-run doesn't need to re-fetch" reason as report/rawSongs above; onReportArtistLeakFalsePositive's re-run needs this to keep Gate 1/Gate 2 in the recomputed inspection. */
    duplicationHistory?: { recentSituations: string[]; recentLyricLines: string[]; historicalTitles: Set<string> };
  } | null>(null);
  /**
   * TASK v5.19 (TASK C) — lowercased leak surface text ("bread", "the
   * carpenters", ...) the user has explicitly marked "오탐입니다" during THIS
   * session (see onReportArtistLeakFalsePositive). Deliberately never
   * persisted — a real leak should still be reviewable fresh next session,
   * and this is a stopgap for reviewing THIS import, not a permanent
   * allowlist edit (that stays a data-file change to
   * artistReferenceSeeds.ts, done deliberately, not via a click).
   */
  const [artistLeakExemptions, setArtistLeakExemptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getSetting<ProviderSettings>(PROVIDER_SETTINGS_KEY).then(saved => {
      setProvider(prev => mergeRestoredProviderSettings(prev, saved));
    });
  }, []);

  useEffect(() => {
    void getSetting<'basic' | 'expert'>(UI_MODE_KEY).then(saved => setExpertMode(saved !== 'basic'));
  }, []);

  function toggleExpertMode() {
    setExpertMode(previous => {
      const next = !previous;
      if (!next) setOpts(previousOptions => ({ ...previousOptions, diversityAllocations: [] }));
      void setSetting(UI_MODE_KEY, next ? 'expert' : 'basic');
      return next;
    });
  }

  const persistProvider = useCallback((next: ProviderSettings) => {
    setProvider(next);
    void setSetting(PROVIDER_SETTINGS_KEY, sanitizeProviderSettingsForPersistence(next));
  }, []);

  function applyChannelToOptions(channel: ChannelProfile) {
    // TASK (genre-archetype sanitization) — a custom channel's own
    // preferredGenres can carry ids left over from before a fix, a
    // cross-workspace import, or a hand-edited profile (see
    // core/genreSelection.ts's sanitizeGenreIdsForArchetype doc comment for
    // the full list of real paths); this is the entry point every channel
    // selection/apply (preset pick, quick-create, editor save) funnels
    // through, so it's the one place that needs to catch all of them.
    const archetype = channel.archetype || 'senior-morning';
    const { valid, removed } = sanitizeGenreIdsForArchetype(channel.preferredGenres, archetype);
    const nextPackagingLanguage = defaultPackagingLanguageForChannel(channel);

    // TASK (지시문 30 TASK A) — real repro: this function used to reset
    // lyricLanguage to channel.primaryLanguage unconditionally, even when
    // choiceProvenance.lyricLanguage was 'user' (하루 had explicitly picked a
    // different language in Step2Concept). Computed off the OUTER `opts`
    // snapshot (not inside the setOpts updater below) because
    // window.confirm is a side effect — calling it from inside a state
    // updater risks a duplicate dialog under React's dev-mode double-invoke.
    // This function is only ever reached from a direct user click (channel
    // select/save/create), so `opts` here is never stale relative to what
    // the updater's own `prev` will be.
    const languageConfirmNeeded = shouldConfirmLanguageOverride(opts.lyricLanguage, opts.choiceProvenance?.lyricLanguage, channel.primaryLanguage);
    const keepUserLanguage = languageConfirmNeeded && !window.confirm(languageOverrideConfirmMessageKo(opts.lyricLanguage, channel.primaryLanguage));

    // TASK (지시문 30 TASK D-2) — same silent-overwrite pattern as
    // lyricLanguage, for every OTHER field this function resets to the
    // channel's own default. genreIds is deliberately excluded (§하지 말 것
    // "지시문 24의 사용자 장르 선택 로직을 건드리지 말 것") — only informational,
    // non-blocking here (surfaced via the existing loadWarning banner, not a
    // new confirm gate).
    const arraysDiffer = (a: readonly string[], b: readonly string[]) => a.length !== b.length || [...a].sort().join('') !== [...b].sort().join('');
    const otherDowngrades = detectProvenanceDowngrades(opts.choiceProvenance, [
      { field: 'vocalTone', labelKo: '보컬 톤', valueChanged: opts.vocalTone !== channel.defaultVocal },
      { field: 'kidsAgeTierId', labelKo: '연령대', valueChanged: opts.kidsAgeTierId !== channel.kidsAgeTierId },
      { field: 'packagingLanguage', labelKo: '제목/썸네일 언어', valueChanged: opts.packagingLanguage !== nextPackagingLanguage },
      { field: 'moodIds', labelKo: '무드', valueChanged: arraysDiffer(opts.moodIds, channel.preferredMoods) }
    ]);

    setOpts(prev => ({
      ...prev,
      channel,
      market: channel.market,
      audience: channel.audience,
      lyricLanguage: keepUserLanguage ? prev.lyricLanguage : channel.primaryLanguage,
      genreIds: normalizeGenreSelection(valid),
      moodIds: channel.preferredMoods,
      vocalTone: channel.defaultVocal,
      // v5.13 (TASK: kidsAgeTierId wiring) — mirrors vocalTone just above:
      // switching to a channel with its own kidsAgeTierId resets the
      // per-generation override to that channel's default, same as every
      // other channel-default field this function already re-seeds.
      kidsAgeTierId: channel.kidsAgeTierId,
      packagingLanguage: nextPackagingLanguage,
      // TASK (provenance) — every field this function resets to the new
      // channel's own default gets its provenance reset to 'channel' too,
      // overwriting whatever the PREVIOUS channel's 'user'/'concept' picks
      // left behind on `prev.choiceProvenance` — those no longer describe
      // the values `opts` now actually holds. This is also the one real,
      // findable recording point for kidsAgeTierId: Step1Channel.tsx's own
      // age-tier picker only ever writes to the channel editor's draft state
      // (ChannelProfile.kidsAgeTierId via useChannelManager's
      // updateEditorField), never straight to GenerationOptions — it only
      // reaches `opts.kidsAgeTierId` via this exact channel-apply path
      // (select/save/create — see useChannelManager.ts's selectChannel/
      // saveEditorProfile/addQuickChannel, all of which call this function),
      // so 'channel' is the only real provenance kidsAgeTierId is ever
      // observed to carry.
      choiceProvenance: {
        ...prev.choiceProvenance,
        // TASK (지시문 30 TASK A) — 'user' survives verbatim when the confirm
        // dialog above was declined; every other case (no explicit user
        // pick, or user confirmed the revert) resets to 'channel' as before.
        lyricLanguage: keepUserLanguage ? 'user' : 'channel',
        genreIds: 'channel',
        vocalTone: 'channel',
        kidsAgeTierId: 'channel',
        packagingLanguage: 'channel',
        // TASK (provenance extension) — moodIds is reset to
        // channel.preferredMoods two lines above, same as genreIds/vocalTone
        // just above it; its provenance needs the same 'channel' reset so a
        // previous channel's 'user' mood pick doesn't linger describing a
        // value this channel switch just overwrote.
        moodIds: 'channel'
      }
    }));

    const warnings = [
      ...(removed.length ? [genreSanitizationWarningKo(removed, archetype)] : []),
      ...(otherDowngrades.length
        ? [`채널 변경으로 직접 선택하신 ${otherDowngrades.map(d => d.labelKo).join(', ')} 설정이 채널 기본값으로 되돌아갔습니다.`]
        : [])
    ];
    if (warnings.length) setLoadWarning(warnings.join(' '));
  }

  const cm = useChannelManager(workspaceId, applyChannelToOptions);
  const gen = useGenerationFlow();
  const evalFlow = useEvaluationFlow();
  const batchFlow = useBatchGenerationFlow();
  const [batchMode, setBatchMode] = useState(false);
  const multiSetFlow = useMultiSetGenerationFlow(batchFlow);
  const library = usePackLibrary(pack => {
    gen.setBlueprint(pack.blueprint);
    const { clamped, truncatedFields } = clampOversizedFields(pack.options);
    // TASK (genre-archetype sanitization) — a pack saved before a channel-
    // archetype fix (or one whose channel's archetype was hand-edited since)
    // can carry genreIds that no longer belong to this channel's archetype;
    // this is the one place every saved-pack load funnels through.
    const loadArchetype = pack.options.channel.archetype || 'senior-morning';
    const { valid: sanitizedGenreIds, removed: removedGenreIds } = sanitizeGenreIdsForArchetype(
      pack.options.genreIds,
      loadArchetype
    );
    setOpts({ ...pack.options, ...clamped, genreIds: sanitizedGenreIds, personaMode: pack.personaMode ?? pack.options.personaMode ?? false });
    setLoadWarning(
      [
        truncatedFields.length
          ? `⚠️ 이 팩의 일부 입력이 글자 수 제한(${truncatedFields.map(f => `${f} ${INPUT_LIMITS[f]}자`).join(', ')})을 넘어 잘렸습니다.`
          : '',
        genreSanitizationWarningKo(removedGenreIds, loadArchetype)
      ].filter(Boolean).join(' ')
    );
    evalFlow.setEvaluation(pack.evaluation || null);
    const channel = cm.channels.find(item => item.id === pack.options.channel.id);
    if (channel) cm.setSelectedChannelId(channel.id);
    setCurrentStep(5);
  });

  const [opts, setOpts] = useState(() => createInitialOptions(cm.selectedChannel));

  /**
   * TASK (generation preflight) — shared with Step3Generate.tsx via props
   * (mirrors designGateStatus/setDesignGateStatus's own lift-to-App pattern
   * just below): a content-based signature of every mismatch/design-gate
   * issue the user has explicitly acknowledged this attempt (see
   * core/generationPreflight.ts's own PreflightResult.mismatchSignature doc
   * comment). Every real generation trigger — this component's own
   * onGenerate/onGenerateMultiSet/onHookWarningContinueAnyway/
   * onGenerateFreshFromPrompt AND Step3Generate.tsx's bridge-copy handlers —
   * reads the SAME state here, so acknowledging on one screen carries
   * through to every trigger point instead of each tracking its own
   * (potentially disagreeing) acknowledgment.
   */
  const [generationAcknowledgedSignature, setGenerationAcknowledgedSignature] = useState<string | undefined>(undefined);

  const selectedGenres = useMemo(() => genrePacks.filter(genre => opts.genreIds.includes(genre.id)), [opts.genreIds]);
  const selectedMoods = useMemo(() => moodPacks.filter(mood => opts.moodIds.includes(mood.id)), [opts.moodIds]);
  const hasSelectedChannel = Boolean(cm.selectedChannel?.id);
  const hasSelectedSeason = useMemo(() => seasonPacks.some(season => season.id === opts.seasonId), [opts.seasonId]);
  const selectedSeason = useMemo(() => seasonPacks.find(season => season.id === opts.seasonId) || seasonPacks[0], [opts.seasonId]);
  const selectedMoneyChord = useMemo(() => moneyChordPresets[opts.moneyChordMode] ?? moneyChordPresets.default, [opts.moneyChordMode]);
  const thumbnailSpec = useMemo(
    () => {
      if (!gen.blueprint) return null;
      const spec = buildThumbnailSpec(gen.blueprint, { ...opts, channel: cm.selectedChannel }, selectedSeason, cm.selectedChannel, thumbnailVariant, thumbnailArchetypeId);
      const variants = thumbnailFreeTextHeadlines
        ? spec.variants.map((variant, index) => (
          thumbnailFreeTextHeadlines[index]
            ? { ...variant, headline: thumbnailFreeTextHeadlines[index].headline, angle: thumbnailFreeTextHeadlines[index].angle }
            : variant
        ))
        : spec.variants;
      return { ...spec, variants, selected: selectedThumbnailVariant };
    },
    [gen.blueprint, opts, cm.selectedChannel, selectedSeason, thumbnailVariant, thumbnailArchetypeId, selectedThumbnailVariant, thumbnailFreeTextHeadlines]
  );
  const standaloneThumbnailSpec = useMemo(() => {
    const blueprint = {
      projectTitle: 'Standalone Thumbnail',
      channelName: cm.selectedChannel.name,
      oneLineConcept: '',
      sonicSignature: '',
      vocalSignature: '',
      lyricRules: [],
      harmonyRules: [],
      visualRules: [],
      songs: []
    } as PlaylistBlueprint;
    const season = seasonPacks.find(item => item.id === thumbnailStandaloneSeasonId) || selectedSeason;
    return buildThumbnailSpec(blueprint, { ...opts, channel: cm.selectedChannel }, season, cm.selectedChannel, 0, thumbnailArchetypeId);
  }, [cm.selectedChannel, opts, selectedSeason, thumbnailStandaloneSeasonId, thumbnailArchetypeId]);

  // TASK E2 (v3.5) — a Batch API job outlives a closed tab; resume polling
  // any job still in flight for this channel as soon as it's known.
  useEffect(() => {
    void batchFlow.resumeActiveJobs(cm.selectedChannel.id, provider, onBatchJobComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cm.selectedChannel.id]);

  // TASK v3.35 (bridge split) — a fresh multi-set bridge batch (new channel,
  // or the set count/size changed, meaning the whole instruction list is
  // being recomputed from scratch anyway) should not carry over avoid-list
  // entries from a previous, unrelated batch.
  useEffect(() => {
    setBridgeImportedSetAvoid({ usedTitles: [], usedHooks: [] });
  }, [cm.selectedChannel.id, multiSetCount, multiSetSongsPerSet]);

  useEffect(() => {
    void listChannelPersonas(cm.selectedChannel.id)
      .then(setSavedPersonas)
      .catch(() => setSavedPersonas([]));
  }, [cm.selectedChannel.id]);

  function toggleArray(key: 'genreIds' | 'moodIds', id: string) {
    setOpts(prev => {
      if (key === 'genreIds') return { ...prev, genreIds: toggleGenreSelection(prev.genreIds, id) };
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // TASK (provenance extension) — Step2Concept.tsx's mood chip grid is
      // the only real caller of this branch today (genreIds always goes
      // through Step2Concept.tsx's own selectPrimaryGenre/toggleSecondaryGenre
      // instead); records the real click-time moment for moodIds, same as
      // every other real UI handler in this app.
      return {
        ...prev,
        [key]: Array.from(next),
        ...(key === 'moodIds' ? { choiceProvenance: { ...prev.choiceProvenance, moodIds: 'user' as const } } : {})
      };
    });
  }

  function fallbackGenres() {
    if (selectedGenres.length) return selectedGenres;
    const fallbackIds = normalizeGenreSelection(cm.selectedChannel.preferredGenres.length
      ? cm.selectedChannel.preferredGenres
      : getDefaultGenreIdsForArchetype(cm.selectedChannel.archetype));
    const fallback = genrePacks.filter(genre => fallbackIds.includes(genre.id));
    return fallback.length ? fallback : [genrePacks[0]];
  }

  function fallbackMoods() {
    return selectedMoods.length ? selectedMoods : [moodPacks[0]];
  }

  const activeOptions = { ...opts, channel: cm.selectedChannel };
  // TASK v5.18 P1-6 — real gap this task's audit found: soundSignature (the
  // Suno persona-metadata label shown for the CURRENT gen.blueprint) used to
  // rebuild itself from live opts/cm.selectedChannel on every render, so
  // switching the screen's channel or vocal tone after generating a pack
  // (without regenerating) silently relabeled an already-generated blueprint
  // with settings it was never actually made under. Prefers the blueprint's
  // own attached generationSnapshot (what it was REALLY generated with,
  // same "snapshot wins when present" rule core/generationSnapshot.ts's own
  // resolveGenerationContext already applies for evaluate/retry/refine),
  // falling back to live state only for a pack with no snapshot yet
  // (pre-v3.6x saved packs / mid-generation preview).
  const soundSignatureOptions = gen.blueprint?.generationSnapshot?.options ?? activeOptions;
  const soundSignatureChannel = gen.blueprint?.generationSnapshot?.channel ?? cm.selectedChannel;
  const soundSignature: SoundSignature | null = gen.blueprint
    ? buildSoundSignature(gen.blueprint, soundSignatureOptions, soundSignatureChannel)
    : null;
  const personaPromptStats = useMemo(() => {
    if (!gen.blueprint) return null;
    const normal = rebuildStylePromptsForPersonaMode(
      gen.blueprint,
      { ...activeOptions, personaMode: false },
      fallbackGenres(),
      fallbackMoods(),
      selectedSeason,
      provider.promptCharLimit
    );
    const persona = rebuildStylePromptsForPersonaMode(
      gen.blueprint,
      { ...activeOptions, personaMode: true },
      fallbackGenres(),
      fallbackMoods(),
      selectedSeason,
      PERSONA_STYLE_LIMIT
    );
    const normalLengths = normal.songs.map(song => song.stylePrompt.length);
    const personaLengths = persona.songs.map(song => song.stylePrompt.length);
    const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    return {
      beforeAvg: avg(normalLengths),
      afterMin: personaLengths.length ? Math.min(...personaLengths) : 0,
      afterMax: personaLengths.length ? Math.max(...personaLengths) : 0,
      afterAvg: avg(personaLengths)
    };
  // 지시문 19 (TASK C) — activeOptions/fallbackGenres()/fallbackMoods() are
  // not independent state: activeOptions is `{...opts, channel:
  // cm.selectedChannel}` and fallbackGenres()/fallbackMoods() only read
  // selectedGenres/selectedMoods/cm.selectedChannel — every real input they
  // touch is already listed below. Adding them here would just be adding a
  // fresh object/function identity recreated every render, which would
  // make this useMemo recompute on every render regardless of whether any
  // of the real underlying values changed (defeating the memoization this
  // hook exists for).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.blueprint, opts, cm.selectedChannel, selectedSeason, selectedGenres, selectedMoods, provider.promptCharLimit]);

  const isHybridActive = hybridMode && provider.provider !== 'local';

  /**
   * TASK (post-generation operation snapshot) — the one real choke point
   * every single-pack finalization path (realtime/local generation, Batch
   * API completion, cached-result reuse, single-file bridge import, SRT-only
   * bridge import) already ran through for title-prefix application; now
   * also attaches this pack's GenerationSnapshot (see types.ts's own doc
   * comment) the first time it's called on a fresh blueprint, and is a no-op
   * on a blueprint that already has one (a later re-finalize from retry/
   * refine/undo) — so the pack's ORIGINAL generation settings survive every
   * later call here regardless of what's live on screen by then.
   *
   * codex 지시문 05 (TASK B) — real bug fixed here: `applyConceptFitScore`
   * used to run ONLY inside Step4Result.tsx's own on-screen `scoredSongs`
   * useMemo, so every autosaved pack (this function's own real caller,
   * handleGenerationSuccess below) shipped the neutral conceptFitScore:100
   * placeholder while only the live screen showed the real, concept-aware
   * number. Applied here, once, at the one real finalize choke point every
   * single-pack path (realtime/cache-hit/bridge import) shares.
   */
  function finalizeSinglePackBlueprint(
    next: PlaylistBlueprint,
    generationOpts: GenerationOptions = { ...opts, channel: cm.selectedChannel },
    /** Real preassigned slot plan this generation actually used, when the caller already computed one (e.g. bridge import) — avoids both a redundant recompute and drift from the plan the pack really used; withGenerationSnapshot/slotsForOptions recomputes one when omitted. */
    slots?: PreassignedSongSlot[]
  ) {
    const conceptLabel = generationOpts.customConcept || generationOpts.projectTitle;
    const scored = { ...next, songs: applyConceptFitScore(next.songs, conceptLabel) };
    const prefixed = applySetTitlePrefixesToBlueprint(scored, generationOpts.setNumberPrefix ?? true);
    return withGenerationSnapshot(prefixed, { options: generationOpts, provider, season: selectedSeason, slots });
  }

  /** Shared by both the synchronous generation path and the Batch API path (TASK E2, v3.5) — whichever produced the blueprint, the autosave/hook-ledger/library-refresh behavior afterward is identical. */
  async function handleGenerationSuccess(next: PlaylistBlueprint, songCount: number, cacheKeyToStore?: string, sourceOpts: GenerationOptions = { ...opts, channel: cm.selectedChannel }) {
    const finalBlueprint = finalizeSinglePackBlueprint(next, sourceOpts);
    setOpts(prev => ({ ...prev, songCount }));
    if (cacheKeyToStore) {
      void setCached(cacheKeyToStore, finalBlueprint, { provider: provider.provider, model: provider.model || provider.provider, songCount });
    }
    try {
      const nextOpts = { ...sourceOpts, songCount };
      const nextThumbnailSpec = buildThumbnailSpec(finalBlueprint, nextOpts, selectedSeason, sourceOpts.channel, 0, thumbnailArchetypeId);
      const nextSoundSignature = buildSoundSignature(finalBlueprint, nextOpts, sourceOpts.channel);
      await saveAutosave(finalBlueprint, nextOpts, nextThumbnailSpec, nextSoundSignature);
      await recordPackHooks(AUTOSAVE_ID, sourceOpts.channel.id, finalBlueprint, nextOpts.lyricLanguage);
      // v5.22 (AXIS 1) — same autosave-slot tracking recordPackHooks just did
      // for hooks, so a generation the user never explicitly saves still
      // contributes to the recent-scene/recent-line avoid-lists the next
      // bridge instruction reads (usePackLibrary.ts's saveCurrentPack/
      // saveImportedPack promote these off AUTOSAVE_ID the same way they
      // already promote hooks).
      await recordPackSituations(AUTOSAVE_ID, sourceOpts.channel.id, finalBlueprint, nextOpts.lyricLanguage);
      await recordPackLyricLines(AUTOSAVE_ID, sourceOpts.channel.id, finalBlueprint, nextOpts.lyricLanguage);
      // codex 지시문 01 (TASK H) — this is the real choke point EVERY single-
      // pack generation success (realtime, cache-hit, bridge import) runs
      // through — see generationHistoryRevision.ts's own doc comment for the
      // real staleness gap this closes (Step3Generate.tsx's own bridgeAvoid/
      // bridgeConceptSceneContext effects, the one confirmed gap).
      bumpGenerationHistoryRevision();
      await library.refresh();
    } catch {
      // Autosave is a convenience feature; failures should not block the result from showing.
    }
  }

  function runGeneration(cacheKeyToStore?: string) {
    evalFlow.setEvaluation(null);
    setThumbnailVariant(0);
    setSelectedThumbnailVariant('A');
    setCurrentStep(5);
    const generationProvider = isHybridActive ? { ...provider, provider: 'local' as const } : provider;
    void gen.generate(
      { ...opts, channel: cm.selectedChannel },
      fallbackGenres(),
      fallbackMoods(),
      selectedSeason,
      generationProvider,
      (next, songCount) => void handleGenerationSuccess(next, songCount, cacheKeyToStore, { ...opts, channel: cm.selectedChannel, songCount })
    );
  }

  function onBatchJobComplete(next: PlaylistBlueprint, batchOpts: GenerationOptions = { ...opts, channel: cm.selectedChannel }) {
    const finalBlueprint = finalizeSinglePackBlueprint(next, batchOpts);
    evalFlow.setEvaluation(null);
    gen.setBlueprint(finalBlueprint);
    setCurrentStep(5);
    void handleGenerationSuccess(finalBlueprint, finalBlueprint.songs.length, undefined, batchOpts);
  }

  /**
   * TASK v3.69 (TASK C) — bridge output files are named
   * "<date>_<channelLabel>_<concept>[.json]" (utils/setNaming.ts). Matching
   * that label back to a known channel lets an import target the channel it
   * was actually generated for, rather than whatever channel the wizard
   * happens to have selected at the moment of import.
   */
  function channelFromFilename(name: string): ChannelProfile | undefined {
    const parsed = parseSetName(name);
    if (!parsed) return undefined;
    return cm.channels.find(channel => sanitizeLabel(channel.name) === parsed.channelLabel);
  }

  /**
   * TASK v3.69 (TASK D) — a file's own "meta" block (channelId/channelLabel,
   * when the bridge agent included it) is a stronger signal than the
   * filename alone — it survives a user renaming the file and matches by
   * exact id first. Falls back to the filename-based match above when the
   * file has no meta block at all (older, pre-TASK-D files), so this never
   * regresses the TASK C behavior.
   */
  function channelFromBridgeFile(name: string, rawText: string): ChannelProfile | undefined {
    const meta = extractBridgeImportMeta(rawText);
    if (meta?.channelId) {
      const byId = cm.channels.find(channel => channel.id === meta.channelId);
      if (byId) return byId;
    }
    if (meta?.channelLabel) {
      const byLabel = cm.channels.find(channel => sanitizeLabel(channel.name) === sanitizeLabel(meta.channelLabel!));
      if (byLabel) return byLabel;
    }
    return channelFromFilename(name);
  }

  /**
   * TASK v3.24 — the Claude Code bridge's "곡 JSON 가져오기" path: an imported
   * blueprint goes through the exact same success handler (autosave,
   * hookLedger registration, library refresh) the realtime and Batch API
   * paths already share above, so a song's origin never changes what
   * happens to it once it's in the app.
   *
   * TASK (import transaction / pre-persistence inspection) — real, verified
   * bug this fixes: this function used to run the autosave/hookLedger block
   * below the instant importSongsJson produced ANY non-null blueprint, even
   * a genuinely partial response (e.g. 17 of 18 requested songs) — zero user
   * review, and those 17 hooks got permanently marked "already used" for
   * future avoid-lists. Every candidate blueprint now runs through
   * inspectImportReport (core/importInspection.ts) BEFORE any persistence:
   *  - 'blocked' (importSongsJson's own upstream trackNo/parse checks
   *    already null the blueprint before this point is ever reached, OR
   *    this module's own re-run of that same structural check fails) shows
   *    the inspection screen with no proceed-anyway option and never
   *    touches handleGenerationSuccess/library.saveImportedPack.
   *  - 'repairable' (some requested tracks missing, a per-song artist-name
   *    leak this module checks for — TASK v5.19 TASK C moved this OUT of
   *    'blocked' after a real clean 18-song pack got discarded over one
   *    track's false positive — or any other per-song review case, while
   *    every song that DID come through is individually well-formed) holds
   *    here via pendingImportInspection for an explicit "[N곡만 확정]" click
   *    (onConfirmPartialImport below, with artistLeakTrackNos excluded)
   *    instead of auto-saving.
   *  - 'valid' (nothing to review) falls straight through to the exact same
   *    autosave/hook-registration sequence this function always ran — the
   *    common case still takes zero extra clicks.
   */
  async function onImportSongsJson(file: File, focusTab: ResultTab = 'songs'): Promise<ImportSongsReport> {
    if (!hasSelectedChannel || !hasSelectedSeason) {
      return makeBridgeImportFailureReport(BRIDGE_IMPORT_PRECONDITION_REASON);
    }
    const text = await file.text();
    // TASK v3.69 (TASK C/D) — the file (its meta block, or failing that its
    // name) carries a channel label, so a matching import no longer depends
    // on whichever channel happens to be selected right now — it switches to
    // (and imports under) the channel the file was actually generated for.
    const matchedChannel = channelFromBridgeFile(file.name, text);
    if (matchedChannel && matchedChannel.id !== cm.selectedChannel.id) {
      cm.selectChannel(matchedChannel.id);
    }
    const importChannel = matchedChannel ?? cm.selectedChannel;
    // TASK v5.18 P1-7 — the file's own meta (when present) describes what
    // was actually generated more reliably than whatever the screen happens
    // to be set to right now; trust it over opts.lyricLanguage/opts.songCount
    // when the two disagree (see reconcileImportOptsWithMeta's own doc
    // comment for the real gap this closes).
    const metaReconciliation = reconcileImportOptsWithMeta(extractBridgeImportMeta(text), opts);
    const importOpts = {
      ...opts,
      channel: importChannel,
      ...(metaReconciliation.lyricLanguage ? { lyricLanguage: metaReconciliation.lyricLanguage } : {}),
      ...(metaReconciliation.songCount ? { songCount: metaReconciliation.songCount } : {})
    };
    const avoid = await safeAvoidSet({ workspaceId: currentWorkspaceId() }, importOpts.lyricLanguage);
    // TASK (bridge-import fallback state-timing fix) — real bug:
    // cm.selectChannel(matchedChannel.id) just above doesn't update React
    // state synchronously, so fallbackGenres()/fallbackMoods() (which read
    // cm.selectedChannel directly) could still see the PREVIOUS channel on
    // this same synchronous pass even though importOpts.channel is already
    // correctly importChannel. genresForOptions/moodsForOptions
    // (core/generationSnapshot.ts) are pure functions of importOpts itself —
    // no live component state read at all — so this race cannot happen.
    const preassignedSongs = preallocateSongSlots(importOpts, genresForOptions(importOpts), avoid);
    const report = importSongsJson(text, importOpts, genresForOptions(importOpts), moodsForOptions(importOpts), selectedSeason, preassignedSongs, avoid.usedTitles ?? [], avoid.usedHooks ?? []);
    report.warnings = [...report.warnings, ...metaReconciliation.warnings];
    if (!report.blueprint) {
      // Already refused upstream (parse failure / missing "songs" array /
      // duplicate or out-of-range trackNo — importSongsJson's own
      // validateProviderTrackSet call) — nothing to inspect or persist.
      setPendingImportInspection(null);
      return report;
    }

    const rawSongs = extractRawImportedSongs(text);
    // v5.22 (AXIS 1) — Gate 1/Gate 2 need real cross-pack history; fetched
    // here (not inside inspectImportReport, which stays a pure classifier —
    // same convention languageContext/sessionExemptions already follow).
    const duplicationHistory = {
      recentSituations: await recentSituations({ workspaceId: currentWorkspaceId() }, importOpts.lyricLanguage),
      recentLyricLines: await recentLyricLines({ workspaceId: currentWorkspaceId() }, importOpts.lyricLanguage),
      historicalTitles: await fetchHistoricalTitles({ workspaceId: currentWorkspaceId() }, importOpts.lyricLanguage)
    };
    const inspection = inspectImportReport(report, rawSongs, importOpts.lyricLanguage, {
      archetype: importOpts.channel.archetype,
      bilingualPair: resolveBilingualPair(importOpts)
    }, artistLeakExemptions, duplicationHistory);

    if (inspection.status === 'blocked') {
      // TASK v5.19 — this branch now only fires on a structurally malformed
      // response (bad JSON/trackNo set); an artist-name leak moved to the
      // 'repairable' branch below (see importInspection.ts's own file-header
      // doc comment) instead of discarding a whole clean pack.
      const blockedReport: ImportSongsReport = {
        ...report,
        blueprint: null,
        importedCount: 0,
        skippedCount: report.importedCount + report.skippedCount,
        skippedReasons: [...report.skippedReasons, ...inspection.blockedReasons]
      };
      setPendingImportInspection({ inspection, importOpts, report, rawSongs, focusTab, preassignedSongs, duplicationHistory });
      return blockedReport;
    }

    if (inspection.status === 'repairable') {
      // Deliberately does NOT finalize/navigate/save here — only the
      // explicit "[N곡만 확정]" click (onConfirmPartialImport) does that.
      // TASK v5.19 (TASK C) — tracks flagged by the artist-safety check are
      // excluded from what actually gets saved, same as trackNos the
      // response never claimed at all; the rest of the pack is unaffected.
      setPendingImportInspection({
        inspection,
        importOpts,
        report,
        rawSongs,
        focusTab,
        preassignedSongs,
        duplicationHistory,
        onConfirm: () => void onConfirmPartialImport(
          {
            ...report.blueprint!,
            // v5.22 (AXIS 1) — a duplicated scene/title track is excluded
            // the same way an artist-leak track already is; see
            // ImportInspection.duplicateContentTrackNos' own doc comment.
            songs: report.blueprint!.songs.filter(song => !inspection.artistLeakTrackNos.includes(song.trackNo) && !inspection.duplicateContentTrackNos.includes(song.trackNo) && !inspection.metaLeakTrackNos.includes(song.trackNo) && !inspection.objectStateTrackNos.includes(song.trackNo))
          },
          importOpts,
          focusTab,
          preassignedSongs
        )
      });
      return report;
    }

    // 'valid' — proceed exactly as this function always has, no extra click.
    setPendingImportInspection(null);
    const finalBlueprint = finalizeSinglePackBlueprint(report.blueprint, importOpts, preassignedSongs);
    report.blueprint = finalBlueprint;
    evalFlow.setEvaluation(null);
    gen.setBlueprint(finalBlueprint);
    // TASK v3.69 (TASK D) — "lyrics file -> SRT" entry point: picking a
    // lyrics/*.json file straight from the SRT-focused import (see
    // onImportSongsJsonForSrt below) lands directly on the SRT tab instead
    // of the default songs tab, without regenerating anything — this
    // import already IS the whole pack, nothing to regenerate. Only acts
    // when a non-default tab is requested, so the normal import path's
    // tab behavior is unchanged from before this task.
    if (focusTab !== 'songs') setWorkspaceFocus(focusTab);
    setCurrentStep(5);
    await handleGenerationSuccess(finalBlueprint, finalBlueprint.songs.length, undefined, importOpts);
    // TASK v3.62 (TASK 4) — handleGenerationSuccess only records this
    // pack's hooks under the ephemeral AUTOSAVE_ID slot, which the very
    // next generation (autosave or otherwise) overwrites. Without an
    // explicit "save to library" click, a bridge import's hooks never
    // survived to the next day's avoidHooks list — a real channel
    // measured 50% (8/16) hook duplication across sets from exactly this
    // gap. Auto-saves under a real, permanent id (no name prompt — a
    // daily-cadence bridge workflow can't stop for one), mirroring how
    // multi-set bridge imports (saveGeneratedSet) already did this
    // correctly.
    try {
      await library.saveImportedPack(finalBlueprint, importOpts);
    } catch {
      // Best-effort — the import itself already succeeded and is shown to the user regardless.
    }
    return report;
  }

  /**
   * TASK (import transaction) — the explicit "[N곡만 확정]" action for a
   * 'repairable' classification: the ONLY way a partial import's hooks ever
   * get registered/saved. Mirrors onImportSongsJson's own 'valid'-path
   * persistence sequence exactly (finalize -> setBlueprint -> navigate ->
   * handleGenerationSuccess -> library.saveImportedPack) — kept as its own
   * function rather than factored into a shared helper so
   * onImportSongsJson's own body stays a complete, literal record of what
   * the normal (valid) import path does end to end.
   */
  async function onConfirmPartialImport(blueprint: PlaylistBlueprint, importOpts: GenerationOptions, focusTab: ResultTab, slots?: PreassignedSongSlot[]) {
    const finalBlueprint = finalizeSinglePackBlueprint(blueprint, importOpts, slots);
    evalFlow.setEvaluation(null);
    gen.setBlueprint(finalBlueprint);
    if (focusTab !== 'songs') setWorkspaceFocus(focusTab);
    setCurrentStep(5);
    await handleGenerationSuccess(finalBlueprint, finalBlueprint.songs.length, undefined, importOpts);
    try {
      await library.saveImportedPack(finalBlueprint, importOpts);
    } catch {
      // Best-effort — same as onImportSongsJson's own 'valid'-path save.
    }
    setPendingImportInspection(null);
  }

  /**
   * "[재생성 지시문 복사]" on the inspection modal — core/importInspection.ts's
   * own intentionally-simple standalone instruction (see that function's doc
   * comment for why it doesn't reuse the full bridgeInstruction.ts builder).
   *
   * TASK (post-generation operation snapshot) — real bug: this used to build
   * the instruction from LIVE opts/cm.selectedChannel, so switching channel
   * after a partial bridge import (before ever clicking "재생성 지시문 복사")
   * produced an instruction naming the WRONG channel/language for tracks
   * that must actually match the rest of the already-imported (old-channel)
   * pack. Now reads the real importOpts this import attempt resolved
   * (stored on pendingImportInspection at import time), falling back to live
   * opts/channel only if that's somehow missing (defensive only).
   */
  async function onCopyMissingTracksInstruction() {
    const pending = pendingImportInspection;
    if (!pending || !pending.inspection.missingTrackNos.length) return;
    const instructionOpts = pending.importOpts ?? { ...opts, channel: cm.selectedChannel };
    const instruction = buildMissingTracksRegenerateInstruction(pending.inspection.missingTrackNos, instructionOpts);
    if (instruction) await copyText(instruction);
  }

  /** TASK v5.19 (TASK C) — "[해당 곡 재작곡 지시문 복사]" on the inspection modal, mirrors onCopyMissingTracksInstruction above but for artist-leak-excluded tracks. */
  async function onCopyArtistLeakInstruction() {
    const pending = pendingImportInspection;
    if (!pending || !pending.inspection.artistLeaks.length) return;
    const instructionOpts = pending.importOpts ?? { ...opts, channel: cm.selectedChannel };
    const instruction = buildArtistLeakRegenerateInstruction(pending.inspection.artistLeaks, instructionOpts);
    if (instruction) await copyText(instruction);
  }

  /**
   * TASK v5.19 (TASK C, "오탐 신고 경로") — the user's explicit "오탐입니다 —
   * 이대로 진행" click for one detected surface (e.g. "bread"). Never
   * auto-applied — this is the ONLY path that adds to artistLeakExemptions.
   * Logs the report (§4-3's "콘솔 또는 로그에 기록") rather than silently
   * discarding it, then re-runs inspectImportReport against the SAME
   * report/rawSongs this inspection came from so the modal reflects the
   * updated classification immediately (a track whose only leak(s) were all
   * just exempted moves out of artistLeakTrackNos and stops being excluded
   * from "[N곡만 확정]").
   */
  function onReportArtistLeakFalsePositive(surface: string) {
    const pending = pendingImportInspection;
    if (!pending?.report || !pending.rawSongs || !pending.importOpts) return;
    const normalized = surface.toLowerCase();
    console.warn(`[artist-safety] 오탐 신고: "${surface}" — 이 세션에서 예외 처리됩니다.`);
    const nextExemptions = new Set(artistLeakExemptions);
    nextExemptions.add(normalized);
    setArtistLeakExemptions(nextExemptions);
    const importOpts = pending.importOpts;
    const report = pending.report;
    const rawSongs = pending.rawSongs;
    const inspection = inspectImportReport(report, rawSongs, importOpts.lyricLanguage, {
      archetype: importOpts.channel.archetype,
      bilingualPair: resolveBilingualPair(importOpts)
    }, nextExemptions, pending.duplicationHistory);
    setPendingImportInspection(prev => (prev ? {
      ...prev,
      inspection,
      onConfirm: inspection.status === 'repairable'
        ? () => void onConfirmPartialImport(
            {
              ...report.blueprint!,
              songs: report.blueprint!.songs.filter(song => !inspection.artistLeakTrackNos.includes(song.trackNo) && !inspection.duplicateContentTrackNos.includes(song.trackNo) && !inspection.metaLeakTrackNos.includes(song.trackNo) && !inspection.objectStateTrackNos.includes(song.trackNo))
            },
            importOpts,
            prev?.focusTab ?? 'songs',
            prev?.preassignedSongs
          )
        : undefined
    } : prev));
  }

  /**
   * TASK v3.69 (TASK D) — "lyrics file -> SRT" entry point: picking an
   * already-generated lyrics/*.json file jumps straight to the SRT tab
   * instead of regenerating the whole pack — the file already has every
   * song's lyrics; SRT export only ever needed those plus per-song
   * durations, never a fresh generation.
   *
   * TASK (read-only SRT import fix) — this used to be
   * `return onImportSongsJson(file, 'srt')`, which ran the EXACT SAME
   * permanent-write pipeline as a real import (handleGenerationSuccess's
   * hookLedger registration, then library.saveImportedPack) even though this
   * entry point's own doc comment above says the opposite: "SRT export only
   * ever needed those [lyrics] plus per-song durations, never a fresh
   * generation." A user who only wanted subtitles from an already-finished
   * pack was silently getting a second permanent library entry and a second
   * hookLedger registration for the same songs every time they picked a file
   * here. Now calls bridgeImport.ts's importSongsForSrtOnly (real
   * parsing/normalization, no slot plan/quality gate/hook defense/dedup —
   * see that function's own doc comment) and wraps the result in a
   * display-only blueprint (localGenerator.ts's buildSignatureBlueprint,
   * already pure) purely so the SRT tab has something to render — gen.setBlueprint
   * is plain React state, not a persistence write. Deliberately never calls
   * handleGenerationSuccess (hookLedger) or library.saveImportedPack.
   */
  async function onImportSongsJsonForSrt(file: File): Promise<ImportSongsReport> {
    if (!hasSelectedChannel || !hasSelectedSeason) {
      return makeBridgeImportFailureReport(BRIDGE_IMPORT_PRECONDITION_REASON);
    }
    const text = await file.text();
    // codex 지시문 01 (TASK D) — this used to also select the file's matched
    // channel as the app's own live channel, exactly like the real
    // (persisting) import path does. That's wrong HERE specifically: this
    // whole function's own point is "read-only, changes nothing about the
    // app's live state but the current step/tab" (see importSongsForSrtOnly's
    // own doc comment in bridgeImport.ts) — switching the globally selected
    // channel (and the market/audience/lyricLanguage applyChannelToOptions
    // derives from it) is a real, persistent side effect on live session
    // state that silently changes what a normal generation would do right
    // after, which is exactly what "read-only" promises not to do. The
    // matched channel is still used — just scoped to this import's own
    // `importOpts`/`importChannel` locals, never touching the app's own
    // live channel-manager state.
    const matchedChannel = channelFromBridgeFile(file.name, text);
    const importChannel = matchedChannel ?? cm.selectedChannel;
    const importOpts = { ...opts, channel: importChannel };
    const { songs, warnings } = importSongsForSrtOnly(text, importOpts);
    if (!songs.length) {
      return {
        blueprint: null,
        importedCount: 0,
        skippedCount: 0,
        skippedReasons: warnings.length ? warnings : ['가져올 곡을 찾지 못했습니다.'],
        warnings: [],
        requestedCount: importOpts.songCount
      };
    }
    const meta = extractBridgeImportMeta(text);
    const concept = importOpts.customConcept || meta?.conceptLabel || `${importChannel.name} ${selectedSeason.label} imported lyrics`;
    // genresForOptions/moodsForOptions are pure over importOpts (already
    // correctly importChannel per the doc comment above this function's own
    // matchedChannel resolution) — no live-state race to worry about here,
    // unlike onImportSongsJson's own identically-named comment, since this
    // path never touches the app's live channel selection at all.
    const displayBlueprint: PlaylistBlueprint = {
      ...finalizeSinglePackBlueprint(
        meta?.generatedAt
          ? buildSignatureBlueprint(importOpts, genresForOptions(importOpts), moodsForOptions(importOpts), selectedSeason, concept, songs, meta.generatedAt)
          : buildSignatureBlueprint(importOpts, genresForOptions(importOpts), moodsForOptions(importOpts), selectedSeason, concept, songs),
        importOpts
      ),
      // codex 지시문 01 (TASK D) — see PlaylistBlueprint.isSrtOnlyImport's own
      // doc comment: the one, single-purpose flag SrtExportPanel.tsx reads
      // to show its own read-only notice once the user is actually on the
      // SRT tab, not just at the moment of clicking the import button.
      isSrtOnlyImport: true
    };
    evalFlow.setEvaluation(null);
    gen.setBlueprint(displayBlueprint);
    setWorkspaceFocus('srt');
    setCurrentStep(5);
    return {
      blueprint: displayBlueprint,
      importedCount: songs.length,
      skippedCount: 0,
      skippedReasons: [],
      warnings,
      requestedCount: importOpts.songCount
    };
  }

  /** TASK v3.35 (bridge split) — "songs-output-setNN.json" -> 0-based set index; falls back to upload order for a file that doesn't follow the convention (e.g. renamed by the user). */
  function parseSetIndexFromFilename(name: string, fallbackIndex: number): number {
    const match = /set(\d+)/i.exec(name);
    return match ? Math.max(0, Number(match[1]) - 1) : fallbackIndex;
  }

  /**
   * TASK v3.35 (bridge split) — imports one file per multi-set bridge
   * instruction (see Step3Generate's "세트별 지시문" list). Each file becomes
   * its own SavedPack (usePackLibrary.saveGeneratedSet, same as the
   * AI-generated multi-set path — see onMultiSetComplete), gets the same
   * v3.35 Part A set-number title prefix applied (bridge import itself
   * doesn't run finalizeSetBlueprint's hook-dedup pass — that needs a real
   * API call this bridge path doesn't have; bridge collision defense stays
   * flagHookCollisions' warn-only check), and folds its real titles/hooks
   * into bridgeImportedSetAvoid so any not-yet-copied instruction still
   * shown in the UI reflects what's actually been produced so far.
   */
  /**
   * v5.17 (TASK B) — real gap this task's audit found: unlike the single-set
   * bridge path (onImportSongsJson above), this used to save every set
   * (library.saveGeneratedSet, permanently registering hooks) the instant
   * importSongsJson returned a non-null blueprint — no inspectImportReport
   * classification at all, so a short/leaked/malformed set saved exactly
   * like a clean one. Now runs the SAME two-pass shape onImportSongsJson
   * already uses (build the report+inspection first, decide persistence
   * after) via core/multiSetImportInspection.ts's planMultiSetImport (see
   * that module's own header doc comment for the exact batch-level rules:
   * any set 'blocked' aborts the WHOLE batch; a 'repairable' set holds back
   * on its own via the SAME ImportInspectionModal onImportSongsJson already
   * uses, one at a time; a 'valid' set persists immediately, zero extra
   * clicks, same as before).
   */
  async function onImportMultiSetSongsJson(files: File[]): Promise<ImportSongsReport[]> {
    if (!hasSelectedChannel || !hasSelectedSeason) {
      return [makeBridgeImportFailureReport(BRIDGE_IMPORT_PRECONDITION_REASON)];
    }
    // TASK v3.69 (TASK C/D) — every file in one multi-set batch shares the
    // same channel, so the first file's meta/name is enough to resolve (and
    // switch to) the channel the whole run was generated for.
    const matchedChannel = files[0] ? channelFromBridgeFile(files[0].name, await files[0].text()) : undefined;
    if (matchedChannel && matchedChannel.id !== cm.selectedChannel.id) {
      cm.selectChannel(matchedChannel.id);
    }
    const importChannel = matchedChannel ?? cm.selectedChannel;
    const groupId = `bridge-multiset-${importChannel.id}-${Date.now()}`;
    const baseAvoid = await safeAvoidSet({ workspaceId: currentWorkspaceId() }, opts.lyricLanguage);
    let usedTitles = [...(baseAvoid.usedTitles ?? [])];
    let usedHooks = [...(baseAvoid.usedHooks ?? [])];

    const ordered = files
      .map((file, uploadOrder) => ({ file, setIndex: parseSetIndexFromFilename(file.name, uploadOrder) }))
      .sort((a, b) => a.setIndex - b.setIndex);

    // PASS 1 — build every set's report, WITHOUT saving/registering
    // anything yet. usedTitles/usedHooks still thread set-to-set here
    // exactly as before this task: that's a slot-preallocation avoid
    // heuristic for THIS run, unrelated to whether any given set ultimately
    // gets persisted below.
    const setInputs: MultiSetImportSetInput[] = [];
    for (const { file, setIndex } of ordered) {
      const baseSetOpts = buildSetOptions({ ...opts, channel: importChannel }, setIndex, multiSetCount, multiSetSongsPerSet);
      const text = await file.text();
      // TASK v5.18 P1-7 — same meta-over-screen-state priority as the
      // single-file import path (reconcileImportOptsWithMeta's own doc
      // comment); songCount is deliberately NOT overridden per set here
      // (unlike the single-file path) since it drives this set's slot COUNT,
      // and songsPerSet is a batch-wide setting shared across every set in
      // this run — silently resizing one set's slot plan mid-batch is a
      // bigger structural change than this file-level language check
      // warrants. lyricLanguage carries no such slot-count side effect, so
      // it's safe to reconcile per set.
      const setMetaReconciliation = reconcileImportOptsWithMeta(extractBridgeImportMeta(text), baseSetOpts);
      const setOpts = setMetaReconciliation.lyricLanguage ? { ...baseSetOpts, lyricLanguage: setMetaReconciliation.lyricLanguage } : baseSetOpts;
      const currentAvoid = { usedTitles, usedHooks };
      // TASK (bridge-import fallback state-timing fix) — fallbackGenres()/
      // fallbackMoods() read live cm.selectedChannel/opts, entirely
      // disconnected from this set's own resolved setOpts.channel
      // (importChannel) — genresForOptions/moodsForOptions derive from
      // setOpts itself instead, so every set in this run resolves genres
      // consistently with the channel it's actually being imported under.
      const preassignedSongs = preallocateSongSlots(setOpts, genresForOptions(setOpts), currentAvoid);
      const report = importSongsJson(text, setOpts, genresForOptions(setOpts), moodsForOptions(setOpts), selectedSeason, preassignedSongs, currentAvoid.usedTitles, currentAvoid.usedHooks);
      report.warnings = [...report.warnings, ...setMetaReconciliation.warnings];
      const rawSongs = extractRawImportedSongs(text);
      setInputs.push({
        setIndex,
        fileName: file.name,
        report,
        rawSongs,
        importOpts: setOpts,
        preassignedSongs,
        languageContext: { archetype: setOpts.channel.archetype, bilingualPair: resolveBilingualPair(setOpts) }
      });
      if (report.blueprint) {
        usedTitles = [...usedTitles, ...report.blueprint.songs.map(song => stripSetTitlePrefix(song.title))];
        usedHooks = [...usedHooks, ...report.blueprint.songs.map(song => song.hookPhrase)];
      }
    }

    // PASS 2 — the batch-level decision (core/multiSetImportInspection.ts).
    // v5.22 (AXIS 1) — same ONE-upfront-snapshot rule planMultiSetImport's
    // own doc comment describes; within-batch scene/title/hook repeats are
    // plan.crossSetDuplicates' job instead (already computed below).
    const duplicationHistory = {
      recentSituations: await recentSituations({ workspaceId: currentWorkspaceId() }, opts.lyricLanguage),
      recentLyricLines: await recentLyricLines({ workspaceId: currentWorkspaceId() }, opts.lyricLanguage),
      historicalTitles: await fetchHistoricalTitles({ workspaceId: currentWorkspaceId() }, opts.lyricLanguage)
    };
    const plan = planMultiSetImport(setInputs, artistLeakExemptions, duplicationHistory, multiSetCount);
    const crossSetWarningsFor = (setIndex: number) => plan.crossSetDuplicates.filter(dup => dup.setIndexes.includes(setIndex)).map(dup => dup.labelKo);

    if (plan.wholeBatchBlocked) {
      // Spec §2-3 "한 세트라도 blocked 면 전체 저장 금지" — nothing persists,
      // not even a set that individually resolved 'valid'/'repairable'.
      const blockedSetIndexes = plan.results.filter(result => result.inspection.status === 'blocked').map(result => result.setIndex);
      return plan.results.map(result => ({
        ...result.report,
        blueprint: null,
        importedCount: 0,
        skippedCount: result.report.importedCount + result.report.skippedCount,
        skippedReasons: blockedSetIndexes.includes(result.setIndex)
          ? [...result.report.skippedReasons, ...result.inspection.blockedReasons]
          : [...result.report.skippedReasons, `세트 ${blockedSetIndexes.join(', ')}이(가) 구조적으로 손상되어 이 배치 전체를 저장하지 않았습니다.`]
      }));
    }

    let lastBlueprint: PlaylistBlueprint | null = null;
    const finalReports: ImportSongsReport[] = [];

    for (const result of plan.readyToPersist) {
      const prefixedBlueprint = applySetTitlePrefixesToBlueprint(result.report.blueprint!, result.importOpts.setNumberPrefix ?? true);
      // TASK (post-generation operation snapshot) — bridge multi-set import
      // has no shared choke point with the local/realtime/batch multi-set
      // path (finalizeSetBlueprint) or the single-file bridge import path
      // (finalizeSinglePackBlueprint), so it attaches its own snapshot here
      // directly, reusing this set's already-resolved setOpts/preassignedSongs.
      const finalBlueprint = withGenerationSnapshot(prefixedBlueprint, { options: result.importOpts, provider, season: selectedSeason, slots: result.preassignedSongs ?? [] });
      await library.saveGeneratedSet(finalBlueprint, result.importOpts, result.importOpts.projectTitle, { setGroupId: groupId, setIndex: result.setIndex, setTotal: multiSetCount });
      setBridgeImportedSetAvoid(prev => ({
        usedTitles: [...prev.usedTitles, ...finalBlueprint.songs.map(song => stripSetTitlePrefix(song.title))],
        usedHooks: [...prev.usedHooks, ...finalBlueprint.songs.map(song => song.hookPhrase)]
      }));
      lastBlueprint = finalBlueprint;
      finalReports.push({ ...result.report, blueprint: finalBlueprint, warnings: [...result.report.warnings, ...crossSetWarningsFor(result.setIndex)] });
    }

    for (const result of plan.pendingConfirmation) {
      // Spec §2-3 "repairable 이 있으면 그 세트만 보류" — held back individually
      // (queued below via presentNextMultiSetConfirm), never auto-saved.
      finalReports.push({
        ...result.report,
        warnings: [...result.report.warnings, `세트 ${result.setIndex}: 검토가 필요해 아직 저장하지 않았습니다.`, ...crossSetWarningsFor(result.setIndex)]
      });
    }

    if (lastBlueprint) {
      evalFlow.setEvaluation(null);
      gen.setBlueprint(lastBlueprint);
      setCurrentStep(5);
    }
    if (plan.pendingConfirmation.length) {
      presentNextMultiSetConfirm({ groupId, setTotal: multiSetCount, items: plan.pendingConfirmation });
    }
    return finalReports;
  }

  /**
   * v5.17 (TASK B) — shows the multi-set queue's next held-back ('repairable')
   * set through the SAME ImportInspectionModal onImportSongsJson already
   * uses for the single-set path (pendingImportInspection), one set at a
   * time. Reused, not reinvented: this is what makes "훅 등록은 모든 세트가
   * valid 일 때만" (spec §2-3) hold per set — a held set's hooks are only
   * ever registered once its own explicit "[N곡만 확정]" click runs
   * (onConfirmMultiSetPartialImport below).
   */
  function presentNextMultiSetConfirm(queue: { groupId: string; setTotal: number; items: MultiSetImportSetResult[] } | null) {
    if (!queue || !queue.items.length) {
      setPendingImportInspection(null);
      return;
    }
    const [next, ...rest] = queue.items;
    setPendingImportInspection({
      inspection: next.inspection,
      importOpts: next.importOpts,
      report: next.report,
      rawSongs: next.rawSongs,
      focusTab: 'songs',
      preassignedSongs: next.preassignedSongs,
      onConfirm: () => void onConfirmMultiSetPartialImport(next, queue.groupId, queue.setTotal, { groupId: queue.groupId, setTotal: queue.setTotal, items: rest })
    });
  }

  /** v5.17 (TASK B) — the multi-set "[N곡만 확정]": mirrors onConfirmPartialImport's persistence shape, but saves via library.saveGeneratedSet (setGroupId/setIndex/setTotal) exactly like a 'valid' set in this same batch already did, instead of saveImportedPack. */
  async function onConfirmMultiSetPartialImport(
    result: MultiSetImportSetResult,
    groupId: string,
    setTotal: number,
    remainingQueue: { groupId: string; setTotal: number; items: MultiSetImportSetResult[] }
  ) {
    const trimmedBlueprint: PlaylistBlueprint = {
      ...result.report.blueprint!,
      songs: result.report.blueprint!.songs.filter(song => !result.inspection.artistLeakTrackNos.includes(song.trackNo) && !result.inspection.duplicateContentTrackNos.includes(song.trackNo) && !result.inspection.metaLeakTrackNos.includes(song.trackNo) && !result.inspection.objectStateTrackNos.includes(song.trackNo))
    };
    const prefixedBlueprint = applySetTitlePrefixesToBlueprint(trimmedBlueprint, result.importOpts.setNumberPrefix ?? true);
    const finalBlueprint = withGenerationSnapshot(prefixedBlueprint, { options: result.importOpts, provider, season: selectedSeason, slots: result.preassignedSongs ?? [] });
    await library.saveGeneratedSet(finalBlueprint, result.importOpts, result.importOpts.projectTitle, { setGroupId: groupId, setIndex: result.setIndex, setTotal });
    setBridgeImportedSetAvoid(prev => ({
      usedTitles: [...prev.usedTitles, ...finalBlueprint.songs.map(song => stripSetTitlePrefix(song.title))],
      usedHooks: [...prev.usedHooks, ...finalBlueprint.songs.map(song => song.hookPhrase)]
    }));
    evalFlow.setEvaluation(null);
    gen.setBlueprint(finalBlueprint);
    setCurrentStep(5);
    presentNextMultiSetConfirm(remainingQueue);
  }

  /**
   * TASK (generation preflight) — the one real check every generation
   * trigger point in this component calls from INSIDE its own handler
   * function (never only via a `disabled` prop on some button — that's
   * exactly the bug this exists to fix: the top-of-page global generate
   * button at the bottom of this file had no check at all beyond
   * `gen.isGenerating`, completely bypassing v5.10's own Step3Generate.tsx
   * contract screen). Builds the exact same slots/contract/design-gate
   * resolveGenerationPreflight needs (core/generationPreflight.ts's
   * evaluateGenerationRequest) off the CURRENT live opts/channel, and — when
   * blocked — navigates to currentStep 4 (Step3Generate.tsx, the screen that
   * actually renders the contract/design-gate panels and the acknowledgment
   * UI) instead of letting generation start. Returns whether the caller may
   * proceed.
   *
   * TASK (multi-set preflight) — real, verified gap this closes: when
   * multiSetMode is active, a single evaluateGenerationRequest call against
   * `opts` checks a single-set-shaped configuration (e.g. the screen's base
   * songCount) even though the real multi-set run uses per-set options
   * (songsPerSet, and set 2+'s palette-family/genre rotation — see
   * core/multiSetGeneration.ts's buildSetOptions) that can genuinely differ
   * enough to trip a contract mismatch or 관문 1 failure the base opts alone
   * never would. Now branches: multi-set mode runs
   * evaluateMultiSetGenerationRequest (N real per-set checks, mirroring
   * multiSetFlow.run's own buildSetOptions/recentGenreIds usage exactly) and
   * combines them via combineMultiSetPreflight — any set hard-blocked blocks
   * the whole run with no acknowledgment path, any set with only warn-level
   * mismatches requires ONE acknowledgment covering every set (Step3Generate
   * .tsx's per-set results screen, "[전체 진행]"). This handler's own perSet
   * result is used only for the click-time allow/block decision, exactly
   * like the single-set branch below discards its `preflight` result once
   * the boolean is decided — the screen that's actually RENDERED on block
   * (Step3Generate.tsx, currentStep 4) recomputes its own reactive multi-set
   * preflight off live `opts` the same way it already does for the single-
   * set contract/design-gate panels, so what the user sees never depends on
   * a stale click-time snapshot.
   */
  async function requestGeneration(): Promise<boolean> {
    // TASK (지시문 30 TASK B-2/B-4) — real gap: opts.listeningIntent was
    // write-once (Step2Concept.tsx's ChoiceGrid click) and never revisited —
    // a songCount change or a channel switch after that click left the
    // genre allocation describing a stale preset with nothing in the
    // generation path ever re-checking it. This is the "생성 시작 시" call
    // site (§B-4) alongside Step2Concept.tsx's own explicit-click call site;
    // applyListeningIntentIfPending is a no-op (returns the same reference)
    // whenever there's no pending drift to fix (listeningIntentApplicationStatus
    // !== 'modified' — see that function's own doc comment), so this never
    // touches opts when nothing needs it.
    const workspaceIdForIntent = workspaceForArchetype(cm.selectedChannel.archetype)?.id ?? workspaceId;
    const mergedOpts = { ...opts, channel: cm.selectedChannel };
    const optsWithListeningIntentApplied = applyListeningIntentIfPending(
      mergedOpts,
      opts.listeningIntent ? LISTENING_INTENT_POLICY[opts.listeningIntent] : LISTENING_INTENT_POLICY['long-listen-comfort'],
      PERCEIVED_ENERGY_POLICY[workspaceIdForIntent]
    );
    if (optsWithListeningIntentApplied !== mergedOpts) {
      const applied = optsWithListeningIntentApplied;
      setOpts(() => applied);
    }
    const effectiveOpts = optsWithListeningIntentApplied;

    if (multiSetMode) {
      const { setCount, songsPerSet } = clampMultiSetTotal(multiSetCount, multiSetSongsPerSet);
      const perSet = await evaluateMultiSetGenerationRequest({
        workspaceId,
        baseOptions: effectiveOpts,
        setCount,
        songsPerSet,
        genres: fallbackGenres()
      }, evaluateDesignGateResponsive);
      const combined = combineMultiSetPreflight(perSet, generationAcknowledgedSignature);
      if (!combined.allowed) {
        setCurrentStep(4);
        return false;
      }
      return true;
    }

    const preflight = await evaluateGenerationRequest({
      workspaceId,
      options: effectiveOpts,
      genres: fallbackGenres(),
      acknowledgedSignature: generationAcknowledgedSignature
    }, evaluateDesignGateResponsive);
    if (!preflight.allowed) {
      setCurrentStep(4);
      return false;
    }
    return true;
  }

  async function onGenerate() {
    if (!(await requestGeneration())) return;
    // v3.12 PART C-3 — hook pool capacity is a local-engine concern shared by
    // every provider path (batch/local/hybrid all pre-allocate hooks
    // locally), so this gate runs before any of the branches below rather
    // than being duplicated in each one.
    //
    // v3.33 — this gate only makes sense under hookMode='pool': the
    // finite ~400-hook combinatorial pool it measures against
    // (hookLedger.ts's hookPoolSize) is never what hookMode='ai-creative'
    // (the new default) actually draws hooks from — those are free-text,
    // model-written, and only checked against the channel's ledger for
    // collisions (core/hookDedup.ts), not against this pool. Running the
    // check anyway would eventually fire a spurious "pool nearly exhausted"
    // warning purely because the ledger's real (ai-creative) hook count
    // crossed hookPoolSize's fixed ~400 threshold — well within a couple of
    // weeks at multi-set volume — even though there's no actual exhaustion
    // risk in that mode.
    if ((opts.hookMode ?? 'ai-creative') === 'pool') {
      const stats = await channelExhaustionStats(cm.selectedChannel.id, opts.lyricLanguage, cm.selectedChannel.archetype);
      // v3.32 — a large pack (up to 80 songs) can exceed remaining hooks well
      // before the pool's overall usage crosses hookPoolGraduatedWarning's 90%
      // threshold, so this pack-size-aware check gates generation too.
      if (hookPoolGraduatedWarning(stats) || stats.remaining < opts.songCount) {
        setHookExhaustionPackSongCount(opts.songCount);
        setHookExhaustionWarning(stats);
        return;
      }
    }
    await proceedWithGeneration();
  }

  async function onGenerateMultiSet() {
    if (!(await requestGeneration())) return;
    const { setCount, songsPerSet } = clampMultiSetTotal(multiSetCount, multiSetSongsPerSet);
    const totalSongs = setCount * songsPerSet;

    // Same reasoning as onGenerate above: only meaningful under hookMode='pool'.
    if ((opts.hookMode ?? 'ai-creative') === 'pool') {
      const stats = await channelExhaustionStats(cm.selectedChannel.id, opts.lyricLanguage, cm.selectedChannel.archetype);
      if (hookPoolGraduatedWarning(stats) || stats.remaining < totalSongs) {
        setHookExhaustionPackSongCount(totalSongs);
        setHookExhaustionWarning(stats);
        return;
      }
    }

    setMultiSetWarnings([]);
    evalFlow.setEvaluation(null);
    const generationOpts = { ...opts, channel: cm.selectedChannel };
    const avoid = await safeAvoidSet({ workspaceId: currentWorkspaceId() }, opts.lyricLanguage);
    const groupId = `multiset-${cm.selectedChannel.id}-${Date.now()}`;

    try {
      await multiSetFlow.run(
        generationOpts,
        setCount,
        songsPerSet,
        fallbackGenres(),
        fallbackMoods(),
        selectedSeason,
        provider,
        batchMode && provider.provider === 'anthropic',
        avoid,
        (result: SetResult) => void onMultiSetComplete(result, groupId, setCount)
      );
    } catch {
      // multiSetFlow.error already captures the message for the UI; nothing further to do here.
    }
  }

  /** Each completed set is its own SavedPack (never the shared autosave slot — see usePackLibrary.saveGeneratedSet's comment), shown as the live result the same way a single-pack generation would, so the user sees each set land as it finishes. */
  async function onMultiSetComplete(result: SetResult, groupId: string, setTotal: number) {
    const setName = `${result.opts.projectTitle}`;
    await library.saveGeneratedSet(result.blueprint, result.opts, setName, {
      setGroupId: groupId,
      setIndex: result.index,
      setTotal
    });
    if (result.warnings.length) {
      setMultiSetWarnings(prev => [...prev, ...result.warnings.map(warning => `Set ${result.index + 1}: ${warning}`)]);
    }
    gen.setBlueprint(result.blueprint);
    setCurrentStep(5);
  }

  async function proceedWithGeneration() {
    // Hybrid drafts are always free/local and always fresh — no point checking the API cache.
    if (provider.provider === 'local' || isHybridActive) {
      runGeneration();
      return;
    }
    // TASK E2 (v3.5) — Batch API mode skips the cache-prompt/synchronous path
    // entirely: it's a fresh submit-and-poll job, not a quick call worth
    // reusing a cached response for.
    if (batchMode && provider.provider === 'anthropic') {
      evalFlow.setEvaluation(null);
      const generationOpts = { ...opts, channel: cm.selectedChannel };
      const avoid = await safeAvoidSet({ workspaceId: currentWorkspaceId() }, opts.lyricLanguage);
      void batchFlow.submit(generationOpts, fallbackGenres(), fallbackMoods(), selectedSeason, provider, avoid, onBatchJobComplete);
      return;
    }
    const key = computeCacheKey({ ...opts, channel: cm.selectedChannel }, fallbackGenres(), fallbackMoods(), selectedSeason, provider);
    const cached = await getCached(key);
    if (cached) {
      setCachePrompt({ key, cachedAt: cached.cachedAt });
      return;
    }
    runGeneration(key);
  }

  async function onHookWarningCleanUpHistory() {
    if (window.confirm(`"${cm.selectedChannel.name}" 채널의 훅 사용 이력을 모두 지울까요? 지운 훅은 다시 사용 가능해집니다.`)) {
      await clearChannelHistory(cm.selectedChannel.id);
    }
    setHookExhaustionWarning(null);
  }

  async function onHookWarningCopyExpansionInfo() {
    if (!hookExhaustionWarning) return;
    const info = [
      `channel: ${cm.selectedChannel.name} (${cm.selectedChannel.id})`,
      `archetype: ${cm.selectedChannel.archetype ?? 'senior-morning'}`,
      `lyricLanguage: ${opts.lyricLanguage}`,
      `pool usage: ${hookExhaustionWarning.used} / ${hookExhaustionWarning.poolSize} (${hookExhaustionWarning.percentUsed}%)`,
      `remaining: ${hookExhaustionWarning.remaining}`
    ].join('\n');
    await copyText(info);
  }

  async function onHookWarningContinueAnyway() {
    setHookExhaustionWarning(null);
    // This is its own real trigger point, reached from the hook-exhaustion
    // modal AFTER onGenerate's own requestGeneration() check already ran —
    // re-checking here (rather than trusting that earlier check) matters
    // because a stale closure or a modal left open across an options edit
    // could otherwise reach proceedWithGeneration() with no check at all.
    if (!(await requestGeneration())) return;
    void proceedWithGeneration();
  }

  function onCancelBatchJob() {
    if (!batchFlow.activeJob) return;
    void batchFlow.cancel(batchFlow.activeJob.id);
  }

  function onRetryFailedBatchJob() {
    if (!batchFlow.activeJob) return;
    void batchFlow.retryFailed(batchFlow.activeJob.id, provider, onBatchJobComplete);
  }

  /**
   * TASK B3 (v3.6) — one-track-at-a-time regeneration for trackNos
   * validateStitched() found missing from a batch job's stitched result.
   *
   * TASK (post-generation operation snapshot) — real bug found while
   * auditing this operation: `batchOpts` already correctly came from
   * `job.snapshot.options` (this batch job's own real settings, not live
   * opts), but the genres/moods/season passed alongside it did not —
   * fallbackGenres()/fallbackMoods()/selectedSeason all read LIVE
   * cm.selectedChannel/opts, so a missing-track regen after switching
   * channel could resolve batchOpts.channel = A's genres against channel
   * B's live genre selection. Now derives genres/moods from batchOpts
   * itself (genresForOptions/moodsForOptions) and season from batchOpts'
   * own seasonId. `provider` (settings) stays live/intentional —
   * BatchJobSnapshot deliberately never persists API credentials (see its
   * own doc comment), the same reason resumeActiveJobs already re-reads
   * settings live rather than from the snapshot.
   */
  async function onRegenerateMissingBatchTracks() {
    const job = batchFlow.activeJob;
    const missing = job?.missingTrackNos;
    if (!job || !missing?.length || !gen.blueprint) return;
    const batchOpts = job.snapshot.options;
    const batchSeason = seasonPacks.find(season => season.id === batchOpts.seasonId) ?? selectedSeason;
    let current = gen.blueprint;
    const stillMissing: number[] = [];
    for (const trackNo of missing) {
      try {
        const { blueprint: next } = await regenerateTrack(current, trackNo, batchOpts, genresForOptions(batchOpts), moodsForOptions(batchOpts), batchSeason, provider, [], await safeAvoidSet({ workspaceId: currentWorkspaceId() }, batchOpts.lyricLanguage));
        current = next;
      } catch {
        stillMissing.push(trackNo);
      }
    }
    const finalBlueprint = finalizeSinglePackBlueprint(current, batchOpts);
    gen.setBlueprint(finalBlueprint);
    const updated = await updateBatchJob(job.id, { resultBlueprint: finalBlueprint, missingTrackNos: stillMissing.length ? stillMissing : undefined });
    if (updated) void handleGenerationSuccess(finalBlueprint, finalBlueprint.songs.length, undefined, batchOpts);
  }

  /**
   * TASK (post-generation operation snapshot) — the one real decision every
   * post-generation operation below (refine/evaluate/retry) makes: use this
   * pack's own GenerationSnapshot (what it was ACTUALLY generated under) by
   * default, falling back to live opts/channel only when there's no
   * snapshot at all (an old pack from before this task, or a display-only
   * synthetic blueprint) or the user explicitly clicked
   * "[현재 설정으로 다시 스타일링]" for THAT one action (useCurrentSettings) — see
   * Step4Result.tsx's own per-action checkboxes; this is never a single
   * global toggle that changes every operation's behavior at once.
   */
  function resolvedGenerationContext(useCurrentSettings?: boolean) {
    const liveOptions = { ...opts, channel: cm.selectedChannel };
    const live = { options: liveOptions, provider, season: selectedSeason, genres: fallbackGenres(), moods: fallbackMoods() };
    return resolveGenerationContext(gen.blueprint, live, useCurrentSettings);
  }

  function onRefineSelected(trackNos: number[], useCurrentSettings?: boolean) {
    if (!gen.blueprint || !trackNos.length) return;
    const ctx = resolvedGenerationContext(useCurrentSettings);
    void gen.refineSelected(trackNos, ctx.options, ctx.genres, ctx.moods, ctx.season, ctx.provider);
  }

  function onUseCachedResult() {
    if (!cachePrompt) return;
    void (async () => {
      const cached = await getCached(cachePrompt.key);
      setCachePrompt(null);
      if (!cached) {
        // Expired or cleared between the prompt showing and the click — fall back to a fresh call.
        runGeneration(cachePrompt.key);
        return;
      }
      // codex 지시문 01 (TASK A) — real gap this closes: a cached blueprint
      // was restored verbatim with zero structural re-validation, unlike
      // every other real entry point (realtime/batch/OpenAI/bridge import/
      // multi-set — see core/importValidation.ts's own validateProviderTrackSet
      // and its doc comment). It was already validated once, at the moment
      // it was originally cached (setCached only ever runs after a real
      // generateChunkWithSplitRetry call already passed this same check) —
      // so this is defense-in-depth against an edited/corrupted IndexedDB
      // record or a schema drift between app versions, not a live bug today.
      // Same "reject, don't silently repair" principle: an invalid cache
      // entry falls back to a fresh generation, exactly like a missing one.
      const cacheValidation = validateProviderTrackSet(cached.blueprint.songs, cached.blueprint.songs.length);
      if (!cacheValidation.valid) {
        runGeneration(cachePrompt.key);
        return;
      }
      evalFlow.setEvaluation(null);
      const finalBlueprint = finalizeSinglePackBlueprint(cached.blueprint);
      gen.setBlueprint(finalBlueprint);
      setCurrentStep(5);
      try {
        await recordUsage({ provider: provider.provider, model: provider.model || provider.provider, purpose: 'generate', inputTokens: 0, outputTokens: 0, cacheHit: true });
      } catch {
        // Usage tracking is a convenience dashboard; never block showing the cached result.
      }
    })();
  }

  async function onGenerateFreshFromPrompt() {
    // "캐시 무시하고 새로 생성" — its own real trigger point, reachable from
    // CachePromptModal without ever going through onGenerate/proceedWithGeneration.
    if (!(await requestGeneration())) return;
    const key = cachePrompt?.key;
    setCachePrompt(null);
    runGeneration(key);
  }

  function onRegenerateHeadline() {
    setThumbnailFreeTextHeadlines(null);
    setThumbnailVariant(v => v + 1);
  }

  function onApplyThumbnailFreeText(suggestions: { headline: string; angle: string }[]) {
    setThumbnailFreeTextHeadlines(suggestions);
  }

  function onSelectThumbnailVariant(id: ThumbnailVariantId) {
    setSelectedThumbnailVariant(id);
  }

  /**
   * TASK I3 (v3.11, PART D-4) — swaps songRole (+ style prompt opening
   * directive) between trackNo and whoever currently holds that role; never
   * touches trackNo order, lyrics, or hookPhrase.
   * codex 지시문 01 (TASK F) — was `{ ...opts, channel: cm.selectedChannel }`
   * (live UI state, unconditionally) — the one operation in this file's own
   * snapshot-vs-live audit with zero snapshot involvement at all. Switching
   * channel/duration-target on screen after generating a pack, then
   * promoting a track, would rebuild that track's opening-style text under
   * the WRONG channel's archetype/durationTarget. Now mirrors every other
   * post-generation operation's own snapshot-first fallback (see
   * resolvedGenerationContext/onSaveCurrentPack's identical pattern).
   */
  function onPromoteTrack(trackNo: number, role: 'cold-open' | 'flagship') {
    if (!gen.blueprint) return;
    const promoteOptions = gen.blueprint.generationSnapshot?.options ?? { ...opts, channel: cm.selectedChannel };
    const result = promoteTrackToOpeningRole(gen.blueprint, promoteOptions, trackNo, role);
    gen.setBlueprint(result.blueprint);
    if (result.warning) {
       
      console.warn(result.warning);
    }
  }

  /** TASK v3.39.1 Part B3 — free-text curation record per song; never touches any other field. */
  function onUpdateHumanEdits(trackNo: number, text: string) {
    if (!gen.blueprint) return;
    gen.setBlueprint({
      ...gen.blueprint,
      songs: gen.blueprint.songs.map(song => song.trackNo === trackNo ? { ...song, humanEdits: text } : song)
    });
  }

  function onUpdateLyrics(trackNo: number, lyrics: string) {
    if (!gen.blueprint) return;
    gen.setBlueprint({
      ...gen.blueprint,
      songs: gen.blueprint.songs.map(song => song.trackNo === trackNo ? applyLyricWorkspaceEdit(song, lyrics) : song)
    });
  }

  function onRegenerateLyricLine(trackNo: number, zeroBasedLineIndex: number) {
    if (!gen.blueprint) return;
    gen.setBlueprint({
      ...gen.blueprint,
      songs: gen.blueprint.songs.map(song => song.trackNo === trackNo ? regenerateSingleLyricLine(song, zeroBasedLineIndex) : song)
    });
  }

  function onUpdatePronunciationHints(trackNo: number, text: string) {
    if (!gen.blueprint) return;
    gen.setBlueprint({
      ...gen.blueprint,
      songs: gen.blueprint.songs.map(song => song.trackNo === trackNo ? applyPronunciationHints(song, text) : song)
    });
  }

  /** v3.57 — merges a batch of trackNo -> {ko?, ja?} lyric-line translations (core/lyricsTranslation.ts) into the current blueprint; only touches lyricTranslations, never the lyrics text itself. A song not present in the map is left unchanged. */
  function onUpdateLyricTranslations(translations: Map<number, LyricTranslationResult>) {
    if (!gen.blueprint) return;
    gen.setBlueprint({
      ...gen.blueprint,
      songs: gen.blueprint.songs.map(song => {
        const update = translations.get(song.trackNo);
        if (!update) return song;
        return {
          ...song,
          lyricTranslations: {
            ko: update.ko ?? song.lyricTranslations?.ko,
            ja: update.ja ?? song.lyricTranslations?.ja
          }
        };
      })
    });
  }

  function onEvaluate(scopeTrackNos?: number[], useCurrentSettings?: boolean) {
    if (!gen.blueprint) return;
    const ctx = resolvedGenerationContext(useCurrentSettings);
    void evalFlow.evaluate(gen.blueprint, ctx.options, ctx.provider, scopeTrackNos);
  }

  function onRetrySong(trackNo: number, issues: string[], useCurrentSettings?: boolean) {
    if (!gen.blueprint) return;
    const ctx = resolvedGenerationContext(useCurrentSettings);
    void evalFlow.retrySong(
      gen.blueprint,
      trackNo,
      ctx.options,
      ctx.genres,
      ctx.moods,
      ctx.season,
      ctx.provider,
      issues,
      next => gen.setBlueprint(finalizeSinglePackBlueprint(next, ctx.options)),
      message => gen.setError(message)
    );
  }

  function onUndoRetry() {
    if (!gen.blueprint) return;
    evalFlow.undoRetry(gen.blueprint, next => gen.setBlueprint(next));
  }

  /**
   * TASK (post-generation operation snapshot) — real bug: this used to
   * always rebuild style prompts under LIVE opts/cm.selectedChannel, so
   * switching channel after generating a pack and then merely toggling
   * persona mode would silently rewrite every song's style prompt under the
   * new channel's genre/vocal identity. Now rebuilds under this pack's own
   * GenerationSnapshot (falling back to live opts/channel only when the
   * blueprint has none — an old pack from before this task); no explicit
   * "use current settings" override for this one, since the persona toggle
   * itself has no dedicated per-click UI action to hang one off of the way
   * retry/refine/evaluate do.
   */
  function onPersonaModeChange(enabled: boolean) {
    setOpts(prev => ({ ...prev, personaMode: enabled }));
    if (!gen.blueprint) return;
    const snapshot = gen.blueprint.generationSnapshot;
    const baseOptions = snapshot?.options ?? { ...opts, channel: cm.selectedChannel };
    const nextOpts = { ...baseOptions, personaMode: enabled };
    const nextBlueprint = rebuildStylePromptsForPersonaMode(
      gen.blueprint,
      nextOpts,
      snapshot ? genresForOptions(snapshot.options) : fallbackGenres(),
      snapshot ? moodsForOptions(snapshot.options) : fallbackMoods(),
      snapshot?.season ?? selectedSeason,
      provider.promptCharLimit
    );
    gen.setBlueprint(nextBlueprint);
  }

  async function refreshSavedPersonas() {
    try {
      setSavedPersonas(await listChannelPersonas(cm.selectedChannel.id));
    } catch {
      setSavedPersonas([]);
    }
  }

  async function onSavePersonaName() {
    if (!soundSignature) return;
    await saveChannelPersona(cm.selectedChannel.id, soundSignature.personaName, soundSignature);
    await refreshSavedPersonas();
  }

  /**
   * TASK (post-generation operation snapshot) — real bug: a save used to
   * always persist LIVE opts/cm.selectedChannel as the pack's own
   * `options`, so switching channel after generating a pack and then
   * clicking "저장" saved the pack under the NEW channel's id/genre/vocal
   * settings even though every song in it was actually written for the old
   * one — a real, permanent library record that no longer matched what it
   * claimed to be generated under. Now saves under this pack's own
   * GenerationSnapshot.options when present, falling back to live opts/
   * channel only for a pack with no snapshot (an old pack from before this
   * task, or a display-only synthetic blueprint).
   */
  async function onSaveCurrentPack() {
    const saveOptions = gen.blueprint?.generationSnapshot?.options ?? { ...opts, channel: cm.selectedChannel };
    await library.saveCurrentPack(gen.blueprint, saveOptions, thumbnailSpec, soundSignature ?? undefined);
    if (soundSignature) {
      await recordChannelPersonaUse(saveOptions.channel.id, soundSignature.personaName, soundSignature);
      await refreshSavedPersonas();
    }
  }

  // 정합성 점검 §0-5/결함5 fix — real bug: this only ever checked moodIds,
  // but the button's own blockerMessage below has always said "장르와 무드를
  // 각각 최소 1개 선택하세요" (genre AND mood) — an opts.genreIds:[] state
  // (e.g. a concept-agent recommendation whose genreAllocation resolved
  // empty) could pass this gate straight through with no defense here at
  // all. genreIds now checked the same way moodIds already is.
  const step2Blocked = opts.moodIds.length === 0 || opts.genreIds.length === 0;
  const resultStepBlocked = !gen.blueprint;
  /**
   * 지시문 32 (§1) — "컨셉 입력 시점, 설계안(Step2Plan) 단계 진입 전"에
   * 채널×컨셉 시대 호환성을 보여준다. unsupported는 경고만(이유 + 대안
   * 채널) — 차단하지 않는다(하루가 의도적으로 실험적 조합을 시도할 수
   * 있어야 한다는 게 이 앱의 기존 원칙, designGateBlocked의 "무시하고 진행"과
   * 같은 결). cross-style만 designGateBlocked와 동일한 패턴으로 명시적
   * 확인 전까지 다음 단계 진입을 막는다 — "이 조합은 재해석이니 확인하고
   * 진행하라"는 것이 cross-style의 취지이기 때문(§ "하지 말 것": unsupported로
   * 강등 금지, 그렇다고 supported처럼 조용히 통과시키지도 않는다).
   */
  const conceptCompat = useMemo(
    () => checkConceptCompatibility(opts.customConcept || opts.projectTitle, opts.channel),
    [opts.customConcept, opts.projectTitle, opts.channel]
  );
  const [conceptCompatAcknowledged, setConceptCompatAcknowledged] = useState(false);
  useEffect(() => {
    setConceptCompatAcknowledged(false);
  }, [conceptCompat.compatibility, opts.customConcept, opts.projectTitle, opts.channel.id]);
  const conceptCompatBlocked = conceptCompat.compatibility === 'cross-style' && !conceptCompatAcknowledged;
  const maxUnlocked = gen.blueprint ? 5 : step2Blocked ? 2 : 4;
  // v3.78 (TASK A, §2-1) — "Step2Plan → Step3 이동 시 경고": Step2Plan.tsx
  // lifts its own 관문 1 status here via onDesignGateStatusChange so the
  // global "다음" footer button (nextDisabled below) blocks navigation out of
  // currentStep 3 the same way step2Blocked already blocks step 2 — unless
  // the user explicitly acknowledged via the panel's "무시하고 진행" checkbox
  // (§8 "[무시하고 진행]을 없애지 말 것" — this must never be a hard, unbypassable block).
  const [designGateStatus, setDesignGateStatus] = useState<{ passed: boolean; acknowledged: boolean }>({ passed: true, acknowledged: false });
  const designGateBlocked = !designGateStatus.passed && !designGateStatus.acknowledged;

  /**
   * v4.0 (TASK D §5-3) — "진행 중인 배치 작업 (있으면 경고 후 중단 여부 확인)".
   * The batch job itself is not canceled by switching (it's an Anthropic
   * Batch API job running server-side, independent of this tab — see
   * hooks/useBatchGenerationFlow.ts's resumeActiveJobs, which is exactly how
   * switching back later would pick it back up); this only warns that this
   * tab stops watching it.
   */
  function handleRequestSwitchWorkspace() {
    const job = batchFlow.activeJob;
    const inFlight = job && (job.status === 'submitting' || job.status === 'in_progress' || job.status === 'canceling');
    if (inFlight && !window.confirm('진행 중인 배치 작업이 있습니다. 워크스페이스를 전환하면 이 화면에서는 더 이상 진행 상황을 볼 수 없습니다 (작업 자체는 서버에서 계속 진행되며, 나중에 이 워크스페이스로 돌아오면 다시 확인할 수 있습니다). 전환하시겠습니까?')) {
      return;
    }
    onSwitchWorkspace();
  }

  return (
    <main className="app-shell" style={{ ['--teal' as string]: workspace.theme.accent, ['--bg' as string]: workspace.theme.surface }}>
      <header className="topbar">
        <div>
          <p className="eyebrow">하루 스튜디오 {BUILD_INFO.appVersion}</p>
          <p className="eyebrow-build">commit {BUILD_INFO.commitSha} · schema {BUILD_INFO.schemaVersion}</p>
          <h1>Playlist prompt and lyrics workbench</h1>
          <button type="button" className="workspace-indicator" onClick={handleRequestSwitchWorkspace} title="다른 워크스페이스로 전환">
            {workspace.labelKo} · 전환
          </button>
        </div>
        <div className="button-row">
          {topBridgeInstruction && <button type="button" onClick={() => void copyText(topBridgeInstruction)}>전체 복사</button>}
          <button type="button" className="primary thumbnail-entry-button" onClick={() => setThumbnailStandaloneOpen(true)}>
            <ImagePlus size={17} /> 썸네일 만들기
          </button>
          <button type="button" className={expertMode ? 'chip active' : 'chip'} onClick={toggleExpertMode}>
            {expertMode ? '자세히 모드' : '간단히 모드'}
          </button>
        <button type="button" className="primary action-button" disabled={gen.isGenerating} onClick={() => void (multiSetMode ? onGenerateMultiSet() : onGenerate())}>
          <Wand2 size={18} />
          {gen.isGenerating ? `생성 중... (${gen.genProgress.done}/${gen.genProgress.total})` : `${opts.songCount}곡 생성하기`}
        </button>
        </div>
      </header>

      <div className="wizard-layout">
        <Sidebar
          channels={cm.channels}
          selectedChannelId={cm.selectedChannelId}
          onSelectChannel={cm.selectChannel}
          quickChannelName={cm.quickChannelName}
          onQuickChannelNameChange={cm.setQuickChannelName}
          onAddQuickChannel={cm.addQuickChannel}
          selectedChannel={cm.selectedChannel}
          savedPacks={library.savedPacks}
          onLoadPack={id => void library.loadPackById(id)}
          onRenamePack={(id, name) => void library.rename(id, name)}
          onDeletePack={id => void library.remove(id)}
          onExportAll={() => void library.exportAll()}
          onImportAll={file => void library.importAll(file)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenDashboard={() => setDashboardOpen(true)}
          onOpenInsights={() => setInsightsOpen(true)}
          onOpenThumbnail={() => setThumbnailStandaloneOpen(true)}
          onOpenPersona={() => { setWorkspaceFocus('persona'); setCurrentStep(5); }}
        />

        <div className="wizard-main">
          {dashboardOpen ? (
            <VideoDashboard channel={cm.selectedChannel} onClose={() => setDashboardOpen(false)} />
          ) : insightsOpen ? (
            // v4.0 (TASK D) — ratingLearning is 'experimental' (src/data/featureFlags.ts).
            <ExperimentalFeatureBoundary featureLabel="청취 평가 인사이트">
              <RatingInsightsPanel channel={cm.selectedChannel} channels={cm.channels} onClose={() => setInsightsOpen(false)} />
            </ExperimentalFeatureBoundary>
          ) : thumbnailStandaloneOpen ? (
            // v4.0 (TASK D) — imageGeneration is 'experimental'.
            <ExperimentalFeatureBoundary featureLabel="Thumbnail studio">
              <ThumbnailImageStudioPanel
                spec={standaloneThumbnailSpec}
                defaultSeasonId={thumbnailStandaloneSeasonId}
                defaultArchetypeId={thumbnailArchetypeId}
                channelArchetype={cm.selectedChannel.archetype}
                standalone
                standaloneChannelName={cm.selectedChannel.name}
                standaloneSeasonId={thumbnailStandaloneSeasonId}
                onStandaloneSeasonChange={setThumbnailStandaloneSeasonId}
                onStandaloneClose={() => setThumbnailStandaloneOpen(false)}
                onOpenSettings={() => { setSettingsFocus('qwen'); setSettingsOpen(true); }}
              />
            </ExperimentalFeatureBoundary>
          ) : (
            <>
          <StepIndicator steps={STEPS} current={currentStep} maxUnlocked={maxUnlocked} onSelect={setCurrentStep} />

          {loadWarning && (
            <p className="supporting load-warning" onClick={() => setLoadWarning('')}>
              {loadWarning} (닫으려면 클릭)
            </p>
          )}

          {cm.archetypeMismatchWarning && (
            <p className="supporting load-warning" onClick={cm.dismissArchetypeMismatchWarning}>
              {cm.archetypeMismatchWarning} (닫으려면 클릭)
            </p>
          )}

          {currentStep === 1 && (
            <Step1Channel
              editorChannel={cm.editorChannel}
              isSelectedCustom={cm.isSelectedCustom}
              onUpdateField={cm.updateEditorField}
              onNew={cm.startNewProfile}
              onSave={cm.saveEditorProfile}
              onDelete={cm.deleteSelectedCustomChannel}
              basicMode={!expertMode}
              workspaceId={workspaceId}
            />
          )}

          {currentStep === 2 && (
            <StepErrorBoundary stepLabel="컨셉 (Step 2)" onGoBack={() => setCurrentStep(1)}>
              <Step2Concept
                opts={opts}
                setOpts={setOpts}
                selectedGenres={selectedGenres}
                selectedMoods={selectedMoods}
                selectedSeason={selectedSeason}
                toggleArray={toggleArray}
                provider={provider}
                basicMode={!expertMode}
                expertMode={expertMode}
                onToggleExpertMode={toggleExpertMode}
                onGenreWarning={setLoadWarning}
                conceptCompat={conceptCompat}
                conceptCompatAcknowledged={conceptCompatAcknowledged}
                onConceptCompatAcknowledgedChange={setConceptCompatAcknowledged}
              />
            </StepErrorBoundary>
          )}

          {currentStep === 3 && (
            <StepErrorBoundary stepLabel="설계안 (Step 3)" onGoBack={() => setCurrentStep(2)}>
              <Step2Plan
                opts={opts}
                setOpts={setOpts}
                onDesignGateStatusChange={setDesignGateStatus}
              />
            </StepErrorBoundary>
          )}

          {currentStep === 4 && (
            <StepErrorBoundary stepLabel="생성 (Step 4)" onGoBack={() => setCurrentStep(3)}>
            <Step3Generate
              opts={opts}
              setOpts={setOpts}
              genres={fallbackGenres()}
              moods={fallbackMoods()}
              season={selectedSeason}
              provider={provider}
              onOpenSettings={() => setSettingsOpen(true)}
              isGenerating={gen.isGenerating}
              genProgress={gen.genProgress}
              error={gen.error}
              onGenerate={onGenerate}
              hybridMode={hybridMode}
              onHybridModeChange={setHybridMode}
              onOpenHookHistory={() => setSettingsOpen(true)}
              batchMode={batchMode}
              onBatchModeChange={setBatchMode}
              activeBatchJob={batchFlow.activeJob && batchFlow.activeJob.channelId === cm.selectedChannel.id ? batchFlow.activeJob : null}
              onCancelBatchJob={onCancelBatchJob}
              onRetryFailedBatchJob={onRetryFailedBatchJob}
              onRegenerateMissingBatchTracks={() => void onRegenerateMissingBatchTracks()}
              onImportSongsJson={onImportSongsJson}
              onImportSongsJsonForSrt={onImportSongsJsonForSrt}
              onImportMultiSetSongsJson={onImportMultiSetSongsJson}
              hasSelectedChannel={hasSelectedChannel}
              hasSelectedSeason={hasSelectedSeason}
              onGoToChannelStep={() => setCurrentStep(1)}
              onGoToSeasonStep={() => setCurrentStep(2)}
              basicMode={!expertMode}
              expertMode={expertMode}
              onToggleExpertMode={toggleExpertMode}
              onInstructionReady={setTopBridgeInstruction}
              bridgeImportedSetAvoid={bridgeImportedSetAvoid}
              workspaceId={workspaceId}
              onNavigateToWorkspace={onNavigateToWorkspace}
              acknowledgedSignature={generationAcknowledgedSignature}
              onAcknowledgedSignatureChange={setGenerationAcknowledgedSignature}
              multiSet={{
                mode: multiSetMode,
                onModeChange: setMultiSetMode,
                setCount: multiSetCount,
                onSetCountChange: setMultiSetCount,
                songsPerSet: multiSetSongsPerSet,
                onSongsPerSetChange: setMultiSetSongsPerSet,
                isRunning: multiSetFlow.isRunning,
                currentSet: multiSetFlow.currentSet,
                totalSets: multiSetFlow.totalSets,
                setProgress: multiSetFlow.setProgress,
                error: multiSetFlow.error,
                warnings: multiSetWarnings,
                onGenerate: () => void onGenerateMultiSet(),
                onCancel: multiSetFlow.cancel
              }}
            />
            </StepErrorBoundary>
          )}

          {currentStep === 5 && (
            <StepErrorBoundary stepLabel="결과 (Step 5)" onGoBack={() => setCurrentStep(4)}>
            <Step4Result
              blueprint={gen.blueprint}
              isGenerating={gen.isGenerating}
              genProgress={gen.genProgress}
              partialSongs={gen.partialSongs}
              generationError={gen.error}
              moneyChordLabel={selectedMoneyChord.labelKo}
              evaluation={evalFlow.evaluation}
              evalError={evalFlow.evalError}
              isEvaluating={evalFlow.isEvaluating}
              evalProgress={evalFlow.evalProgress}
              evaluationAvailable={isEvaluationAvailable(provider)}
              retryingTrack={evalFlow.retryingTrack}
              retryWarning={evalFlow.retryWarning}
              undoTrackNo={evalFlow.undoEntry?.trackNo ?? null}
              hybridRefineAvailable={isHybridActive}
              isRefining={gen.isRefining}
              refineProgress={gen.refineProgress}
              refineWarnings={gen.refineWarnings}
              thumbnailSpec={thumbnailSpec}
              thumbnailSeasonId={selectedSeason.id}
              thumbnailArchetypeId={thumbnailArchetypeId}
              thumbnailPackagingLanguage={resolvePackagingLanguage(opts)}
              thumbnailCustomConcept={opts.customConcept}
              soundSignature={soundSignature}
              opts={opts}
              textModelSettings={provider}
              personaMode={opts.personaMode ?? false}
              personaPromptStats={personaPromptStats}
              savedPersonas={savedPersonas}
              promptCharLimit={provider.promptCharLimit}
              onSelectThumbnailArchetype={setThumbnailArchetypeId}
              onPersonaModeChange={onPersonaModeChange}
              onSavePersonaName={() => void onSavePersonaName()}
              onSave={() => void onSaveCurrentPack()}
              onEvaluate={onEvaluate}
              onRetrySong={onRetrySong}
              onUndoRetry={onUndoRetry}
              onRefineSelected={onRefineSelected}
              onRegenerateHeadline={onRegenerateHeadline}
              onSelectThumbnailVariant={onSelectThumbnailVariant}
              onApplyThumbnailFreeText={onApplyThumbnailFreeText}
              onPromoteTrack={onPromoteTrack}
              onUpdateHumanEdits={onUpdateHumanEdits}
              onUpdateLyrics={onUpdateLyrics}
              onRegenerateLyricLine={onRegenerateLyricLine}
              onUpdatePronunciationHints={onUpdatePronunciationHints}
              onUpdateLyricTranslations={onUpdateLyricTranslations}
              focusTab={workspaceFocus}
            />
            </StepErrorBoundary>
          )}

          <WizardNav
            currentStep={currentStep}
            onPrev={() => setCurrentStep(step => Math.max(1, step - 1))}
            onNext={() => setCurrentStep(step => Math.min(5, step + 1))}
            nextDisabled={(currentStep === 2 && (step2Blocked || conceptCompatBlocked)) || (currentStep === 3 && designGateBlocked) || (currentStep === 4 && resultStepBlocked)}
            blockerMessage={currentStep === 2 && step2Blocked ? '장르와 무드를 각각 최소 1개 선택하세요.' : currentStep === 2 && conceptCompatBlocked ? '이 채널×컨셉 조합(재해석 필요)을 확인하고 진행하세요.' : currentStep === 3 && designGateBlocked ? '설계 검증을 통과하거나 "무시하고 진행"에 동의하세요.' : currentStep === 4 ? '먼저 곡을 생성하세요.' : ''}
            maxStep={5}
          />
            </>
          )}
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); setSettingsFocus(undefined); }}
        focusSection={settingsFocus}
        settings={provider}
        onChange={persistProvider}
        onExportAll={() => void library.exportAll()}
        onImportAll={file => void library.importAll(file)}
        onDeleteAll={() => void library.deleteAll()}
        channel={cm.selectedChannel}
        channels={cm.channels}
      />

      {hookExhaustionWarning && (
        <HookExhaustionWarningModal
          channelName={cm.selectedChannel.name}
          stats={hookExhaustionWarning}
          onCleanUpHistory={() => void onHookWarningCleanUpHistory()}
          onCopyExpansionInfo={() => void onHookWarningCopyExpansionInfo()}
          onContinueAnyway={() => void onHookWarningContinueAnyway()}
          onClose={() => setHookExhaustionWarning(null)}
          packSongCount={hookExhaustionPackSongCount}
        />
      )}

      <CachePromptModal
        open={!!cachePrompt}
        cachedAt={cachePrompt?.cachedAt || ''}
        onUseCache={onUseCachedResult}
        onGenerateFresh={() => void onGenerateFreshFromPrompt()}
        onCancel={() => setCachePrompt(null)}
      />

      {pendingImportInspection && (
        <ImportInspectionModal
          inspection={pendingImportInspection.inspection}
          onConfirmPartial={pendingImportInspection.onConfirm}
          onCopyRegenerateInstruction={() => void onCopyMissingTracksInstruction()}
          onCopyArtistLeakInstruction={() => void onCopyArtistLeakInstruction()}
          onReportFalsePositive={onReportArtistLeakFalsePositive}
          onClose={() => setPendingImportInspection(null)}
        />
      )}
    </main>
  );
}

/**
 * v4.0 (TASK A1/D) — the real entry point. Runs the one-time, non-destructive
 * workspace migration once on mount (core/workspaceMigration.ts — additive
 * only, never blocks rendering), then either shows the workspace picker or
 * mounts WizardApp for the chosen workspace. key={workspaceId} is what makes
 * switching workspaces a full, clean reset (see WizardAppProps' own doc
 * comment) — React unmounts the entire previous tree, including every hook's
 * state, before mounting the new workspace's tree.
 */
export default function App() {
  const [migrationPromptOpen, setMigrationPromptOpen] = useState(() => isMigrationPending());
  const [migrationBackupBusy, setMigrationBackupBusy] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(() => {
    const skip = skipWorkspacePickerPreference();
    if (!skip) return null;
    setCurrentWorkspace(skip);
    return skip;
  });

  useEffect(() => {
    if (migrationPromptOpen) return; // v4.1 (TASK A2 §4-3) -- wait for the user to back up (or explicitly skip) before an irreversible migration runs.
    void runWorkspaceMigrationOnce().catch(() => {
      // Migration failures are reported inside the resolved value, never
      // thrown (see workspaceMigration.ts) — this catch only guards against
      // an unexpected rejection so the app can never fail to render over it.
    });
  }, [migrationPromptOpen]);

  useEffect(() => {
    // v5.17 (TASK A §1-3) — unlike the migration above, this never waits on
    // migrationPromptOpen: stripping a leaked secret from already-saved
    // packs is a strict safety improvement, not the kind of irreversible
    // data change that needs a backup prompt first.
    void runSnapshotSecretMigrationOnce().catch(() => {
      // Same rule as runWorkspaceMigrationOnce's own catch just above.
    });
  }, []);

  async function handleMigrationBackupAndContinue() {
    setMigrationBackupBusy(true);
    try {
      // Pre-migration, every real record is implicitly 'senior-oldpop'
      // (scopeFilter's own default for untagged rows) — exportAllWorkspacesBlob()
      // needs no special-casing to capture everything correctly here.
      const blob = await exportAllWorkspacesBlob();
      await downloadBlob(blob, nextTransferFileName('ALL'));
      for (const ws of workspaceDefinitions) recordBackupNow(ws.id);
    } finally {
      setMigrationBackupBusy(false);
      setMigrationPromptOpen(false);
    }
  }

  function handleSelectWorkspace(id: WorkspaceId) {
    setCurrentWorkspace(id);
    setWorkspaceId(id);
  }

  function handleSwitchWorkspace() {
    setWorkspaceId(null);
  }

  if (migrationPromptOpen) {
    return (
      <MigrationBackupPrompt
        busy={migrationBackupBusy}
        onBackupAndContinue={() => void handleMigrationBackupAndContinue()}
        onSkip={() => setMigrationPromptOpen(false)}
      />
    );
  }

  if (!workspaceId) {
    return <WorkspaceSelectScreen onSelect={handleSelectWorkspace} />;
  }

  return <WizardApp key={workspaceId} workspaceId={workspaceId} onSwitchWorkspace={handleSwitchWorkspace} onNavigateToWorkspace={handleSelectWorkspace} />;
}
