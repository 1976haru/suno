import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { genrePacks, moodPacks, seasonPacks } from './data/presets';
import { getDefaultGenreIdsForArchetype } from './data/genreLibrary';
import type { ThumbnailArchetypeId } from './data/thumbnailArchetypes';
import { moneyChordPresets } from './data/moneyChords';
import { AUTOSAVE_ID, listChannelPersonas, recordChannelPersonaUse, saveAutosave, saveChannelPersona, type ChannelPersonaRecord } from './core/library';
import { isEvaluationAvailable } from './agents/evaluator';
import { computeCacheKey, getCached, setCached } from './core/apiCache';
import { recordUsage } from './core/usageLedger';
import { buildThumbnailSpec } from './core/thumbnailSpec';
import { channelExhaustionStats, clearChannelHistory, hookPoolGraduatedWarning, recordPackHooks, type ExhaustionStats } from './core/hookLedger';
import { copyText } from './utils/exporters';
import { normalizeGenreSelection, toggleGenreSelection } from './core/genreSelection';
import { clampOversizedFields, INPUT_LIMITS } from './core/inputLimits';
import { updateBatchJob } from './core/batchJobs';
import { getSetting, setSetting } from './core/settingsStore';
import { mergeRestoredProviderSettings, sanitizeProviderSettingsForPersistence } from './core/providerSettingsPersistence';
import { rebuildStylePromptsForPersonaMode } from './core/localGenerator';
import { buildSoundSignature, PERSONA_STYLE_LIMIT } from './core/soundSignature';
import { promoteTrackToOpeningRole } from './core/openingOverride';
import { regenerateTrack } from './providers';
import { useChannelManager } from './hooks/useChannelManager';
import { usePackLibrary } from './hooks/usePackLibrary';
import { useGenerationFlow, safeAvoidSet } from './hooks/useGenerationFlow';
import { preallocateSongSlots } from './core/batchPreallocation';
import { importSongsJson, type ImportSongsReport } from './core/claudeCodeBridge';
import { useEvaluationFlow } from './hooks/useEvaluationFlow';
import { useBatchGenerationFlow } from './hooks/useBatchGenerationFlow';
import { useMultiSetGenerationFlow } from './hooks/useMultiSetGenerationFlow';
import { buildSetOptions, type SetResult } from './core/multiSetGeneration';
import { applySetTitlePrefix, clampMultiSetTotal, createInitialOptions, stripSetTitlePrefix } from './utils/generation';
import { defaultPackagingLanguage, resolvePackagingLanguage } from './core/packagingLanguage';
import type { ChannelProfile, ProviderSettings, SoundSignature, ThumbnailVariantId } from './types';
import SettingsModal from './components/SettingsModal';
import HookExhaustionWarningModal from './components/HookExhaustionWarningModal';
import CachePromptModal from './components/CachePromptModal';
import Sidebar from './components/Sidebar';
import StepIndicator, { type StepDef } from './components/StepIndicator';
import Step1Channel from './components/steps/Step1Channel';
import Step2Concept from './components/steps/Step2Concept';
import Step3Generate from './components/steps/Step3Generate';
import Step4Result from './components/steps/Step4Result';
import WizardNav from './components/WizardNav';
import VideoDashboard from './components/VideoDashboard';

const STEPS: StepDef[] = [
  { id: 1, label: '① 채널' },
  { id: 2, label: '② 컨셉' },
  { id: 3, label: '③ 생성' },
  { id: 4, label: '④ 결과' }
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

export default function App() {
  const [provider, setProvider] = useState<ProviderSettings>({ provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [cachePrompt, setCachePrompt] = useState<{ key: string; cachedAt: string } | null>(null);
  const [hybridMode, setHybridMode] = useState(false);
  const [thumbnailVariant, setThumbnailVariant] = useState(0);
  const [selectedThumbnailVariant, setSelectedThumbnailVariant] = useState<ThumbnailVariantId>('A');
  const [thumbnailArchetypeId, setThumbnailArchetypeId] = useState<ThumbnailArchetypeId>('refined-cafe');
  /** TASK H6 (v3.10) — set only when the user asks the concept agent for thumbnail copy; coexists with (never replaces) v3.6's season/emotion/audience A/B/C strategy. */
  const [thumbnailFreeTextHeadlines, setThumbnailFreeTextHeadlines] = useState<{ headline: string; angle: string }[] | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
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

  useEffect(() => {
    void getSetting<ProviderSettings>(PROVIDER_SETTINGS_KEY).then(saved => {
      setProvider(prev => mergeRestoredProviderSettings(prev, saved));
    });
  }, []);

  const persistProvider = useCallback((next: ProviderSettings) => {
    setProvider(next);
    void setSetting(PROVIDER_SETTINGS_KEY, sanitizeProviderSettingsForPersistence(next));
  }, []);

  function applyChannelToOptions(channel: ChannelProfile) {
    setOpts(prev => ({
      ...prev,
      channel,
      market: channel.market,
      audience: channel.audience,
      lyricLanguage: channel.primaryLanguage,
      genreIds: normalizeGenreSelection(channel.preferredGenres),
      moodIds: channel.preferredMoods,
      vocalTone: channel.defaultVocal,
      packagingLanguage: defaultPackagingLanguage(channel.market)
    }));
  }

  const cm = useChannelManager(applyChannelToOptions);
  const gen = useGenerationFlow();
  const evalFlow = useEvaluationFlow();
  const batchFlow = useBatchGenerationFlow();
  const [batchMode, setBatchMode] = useState(false);
  const multiSetFlow = useMultiSetGenerationFlow(batchFlow);
  const library = usePackLibrary(pack => {
    gen.setBlueprint(pack.blueprint);
    const { clamped, truncatedFields } = clampOversizedFields(pack.options);
    setOpts({ ...pack.options, ...clamped, personaMode: pack.personaMode ?? pack.options.personaMode ?? false });
    setLoadWarning(
      truncatedFields.length
        ? `⚠️ 이 팩의 일부 입력이 글자 수 제한(${truncatedFields.map(f => `${f} ${INPUT_LIMITS[f]}자`).join(', ')})을 넘어 잘렸습니다.`
        : ''
    );
    evalFlow.setEvaluation(pack.evaluation || null);
    const channel = cm.channels.find(item => item.id === pack.options.channel.id);
    if (channel) cm.setSelectedChannelId(channel.id);
    setCurrentStep(4);
  });

  const [opts, setOpts] = useState(() => createInitialOptions(cm.selectedChannel));

  const selectedGenres = useMemo(() => genrePacks.filter(genre => opts.genreIds.includes(genre.id)), [opts.genreIds]);
  const selectedMoods = useMemo(() => moodPacks.filter(mood => opts.moodIds.includes(mood.id)), [opts.moodIds]);
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
      return { ...prev, [key]: Array.from(next) };
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
  const soundSignature: SoundSignature | null = gen.blueprint
    ? buildSoundSignature(gen.blueprint, activeOptions, cm.selectedChannel)
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
  }, [gen.blueprint, opts, cm.selectedChannel, selectedSeason, selectedGenres, selectedMoods, provider.promptCharLimit]);

  const isHybridActive = hybridMode && provider.provider !== 'local';

  /** Shared by both the synchronous generation path and the Batch API path (TASK E2, v3.5) — whichever produced the blueprint, the autosave/hook-ledger/library-refresh behavior afterward is identical. */
  async function handleGenerationSuccess(next: import('./types').PlaylistBlueprint, songCount: number, cacheKeyToStore?: string) {
    setOpts(prev => ({ ...prev, songCount }));
    if (cacheKeyToStore) {
      void setCached(cacheKeyToStore, next, { provider: provider.provider, model: provider.model || provider.provider, songCount });
    }
    try {
      const nextOpts = { ...opts, channel: cm.selectedChannel, songCount };
      const nextThumbnailSpec = buildThumbnailSpec(next, nextOpts, selectedSeason, cm.selectedChannel, 0, thumbnailArchetypeId);
      const nextSoundSignature = buildSoundSignature(next, nextOpts, cm.selectedChannel);
      await saveAutosave(next, nextOpts, nextThumbnailSpec, nextSoundSignature);
      await recordPackHooks(AUTOSAVE_ID, cm.selectedChannel.id, next, opts.lyricLanguage);
      await library.refresh();
    } catch {
      // Autosave is a convenience feature; failures should not block the result from showing.
    }
  }

  function runGeneration(cacheKeyToStore?: string) {
    evalFlow.setEvaluation(null);
    setThumbnailVariant(0);
    setSelectedThumbnailVariant('A');
    setCurrentStep(4);
    const generationProvider = isHybridActive ? { ...provider, provider: 'local' as const } : provider;
    void gen.generate(
      { ...opts, channel: cm.selectedChannel },
      fallbackGenres(),
      fallbackMoods(),
      selectedSeason,
      generationProvider,
      (next, songCount) => void handleGenerationSuccess(next, songCount, cacheKeyToStore)
    );
  }

  function onBatchJobComplete(next: import('./types').PlaylistBlueprint) {
    evalFlow.setEvaluation(null);
    gen.setBlueprint(next);
    setCurrentStep(4);
    void handleGenerationSuccess(next, next.songs.length);
  }

  /**
   * TASK v3.24 — the Claude Code bridge's "곡 JSON 가져오기" path: an imported
   * blueprint goes through the exact same success handler (autosave,
   * hookLedger registration, library refresh) the realtime and Batch API
   * paths already share above, so a song's origin never changes what
   * happens to it once it's in the app.
   */
  async function onImportSongsJson(file: File): Promise<ImportSongsReport> {
    const text = await file.text();
    const importOpts = { ...opts, channel: cm.selectedChannel };
    const avoid = await safeAvoidSet(cm.selectedChannel.id, opts.lyricLanguage);
    const preassignedSongs = preallocateSongSlots(importOpts, fallbackGenres(), avoid);
    const report = importSongsJson(text, importOpts, fallbackGenres(), fallbackMoods(), selectedSeason, preassignedSongs, avoid.usedTitles ?? [], avoid.usedHooks ?? []);
    if (report.blueprint) {
      evalFlow.setEvaluation(null);
      gen.setBlueprint(report.blueprint);
      setCurrentStep(4);
      await handleGenerationSuccess(report.blueprint, report.blueprint.songs.length);
    }
    return report;
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
  async function onImportMultiSetSongsJson(files: File[]): Promise<ImportSongsReport[]> {
    const reports: ImportSongsReport[] = [];
    const groupId = `bridge-multiset-${cm.selectedChannel.id}-${Date.now()}`;
    const baseAvoid = await safeAvoidSet(cm.selectedChannel.id, opts.lyricLanguage);
    let usedTitles = [...(baseAvoid.usedTitles ?? [])];
    let usedHooks = [...(baseAvoid.usedHooks ?? [])];

    const ordered = files
      .map((file, uploadOrder) => ({ file, setIndex: parseSetIndexFromFilename(file.name, uploadOrder) }))
      .sort((a, b) => a.setIndex - b.setIndex);

    let lastBlueprint: import('./types').PlaylistBlueprint | null = null;

    for (const { file, setIndex } of ordered) {
      const setOpts = buildSetOptions({ ...opts, channel: cm.selectedChannel }, setIndex, multiSetCount, multiSetSongsPerSet);
      const text = await file.text();
      const currentAvoid = { usedTitles, usedHooks };
      const preassignedSongs = preallocateSongSlots(setOpts, fallbackGenres(), currentAvoid);
      const report = importSongsJson(text, setOpts, fallbackGenres(), fallbackMoods(), selectedSeason, preassignedSongs, currentAvoid.usedTitles, currentAvoid.usedHooks);

      if (report.blueprint) {
        const finalBlueprint = (setOpts.setNumberPrefix ?? true)
          ? { ...report.blueprint, songs: report.blueprint.songs.map(song => ({ ...song, title: applySetTitlePrefix(song.trackNo, song.title) })) }
          : report.blueprint;
        await library.saveGeneratedSet(finalBlueprint, setOpts, setOpts.projectTitle, { setGroupId: groupId, setIndex, setTotal: multiSetCount });
        usedTitles = [...usedTitles, ...finalBlueprint.songs.map(song => stripSetTitlePrefix(song.title))];
        usedHooks = [...usedHooks, ...finalBlueprint.songs.map(song => song.hookPhrase)];
        setBridgeImportedSetAvoid({ usedTitles, usedHooks });
        lastBlueprint = finalBlueprint;
        reports.push({ ...report, blueprint: finalBlueprint });
      } else {
        reports.push(report);
      }
    }

    if (lastBlueprint) {
      evalFlow.setEvaluation(null);
      gen.setBlueprint(lastBlueprint);
      setCurrentStep(4);
    }
    return reports;
  }

  async function onGenerate() {
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
    const avoid = await safeAvoidSet(cm.selectedChannel.id, opts.lyricLanguage);
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
    setCurrentStep(4);
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
      const avoid = await safeAvoidSet(cm.selectedChannel.id, opts.lyricLanguage);
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

  function onHookWarningContinueAnyway() {
    setHookExhaustionWarning(null);
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

  /** TASK B3 (v3.6) — one-track-at-a-time regeneration for trackNos validateStitched() found missing from a batch job's stitched result. */
  async function onRegenerateMissingBatchTracks() {
    const job = batchFlow.activeJob;
    const missing = job?.missingTrackNos;
    if (!job || !missing?.length || !gen.blueprint) return;
    const batchOpts = job.snapshot.options;
    let current = gen.blueprint;
    const stillMissing: number[] = [];
    for (const trackNo of missing) {
      try {
        const { blueprint: next } = await regenerateTrack(current, trackNo, batchOpts, fallbackGenres(), fallbackMoods(), selectedSeason, provider, [], await safeAvoidSet(batchOpts.channel.id, batchOpts.lyricLanguage));
        current = next;
      } catch {
        stillMissing.push(trackNo);
      }
    }
    gen.setBlueprint(current);
    const updated = await updateBatchJob(job.id, { resultBlueprint: current, missingTrackNos: stillMissing.length ? stillMissing : undefined });
    if (updated) void handleGenerationSuccess(current, current.songs.length);
  }

  function onRefineSelected(trackNos: number[]) {
    if (!gen.blueprint || !trackNos.length) return;
    void gen.refineSelected(trackNos, { ...opts, channel: cm.selectedChannel }, fallbackGenres(), fallbackMoods(), selectedSeason, provider);
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
      evalFlow.setEvaluation(null);
      gen.setBlueprint(cached.blueprint);
      setCurrentStep(4);
      try {
        await recordUsage({ provider: provider.provider, model: provider.model || provider.provider, purpose: 'generate', inputTokens: 0, outputTokens: 0, cacheHit: true });
      } catch {
        // Usage tracking is a convenience dashboard; never block showing the cached result.
      }
    })();
  }

  function onGenerateFreshFromPrompt() {
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

  /** TASK I3 (v3.11, PART D-4) — swaps songRole (+ style prompt opening directive) between trackNo and whoever currently holds that role; never touches trackNo order, lyrics, or hookPhrase. */
  function onPromoteTrack(trackNo: number, role: 'cold-open' | 'flagship') {
    if (!gen.blueprint) return;
    const result = promoteTrackToOpeningRole(gen.blueprint, { ...opts, channel: cm.selectedChannel }, trackNo, role);
    gen.setBlueprint(result.blueprint);
    if (result.warning) {
      // eslint-disable-next-line no-console
      console.warn(result.warning);
    }
  }

  function onEvaluate(scopeTrackNos?: number[]) {
    if (!gen.blueprint) return;
    void evalFlow.evaluate(gen.blueprint, { ...opts, channel: cm.selectedChannel }, provider, scopeTrackNos);
  }

  function onRetrySong(trackNo: number, issues: string[]) {
    if (!gen.blueprint) return;
    void evalFlow.retrySong(
      gen.blueprint,
      trackNo,
      { ...opts, channel: cm.selectedChannel },
      fallbackGenres(),
      fallbackMoods(),
      selectedSeason,
      provider,
      issues,
      next => gen.setBlueprint(next),
      message => gen.setError(message)
    );
  }

  function onUndoRetry() {
    if (!gen.blueprint) return;
    evalFlow.undoRetry(gen.blueprint, next => gen.setBlueprint(next));
  }

  function onPersonaModeChange(enabled: boolean) {
    const nextOpts = { ...opts, channel: cm.selectedChannel, personaMode: enabled };
    setOpts(prev => ({ ...prev, personaMode: enabled }));
    if (!gen.blueprint) return;
    const nextBlueprint = rebuildStylePromptsForPersonaMode(
      gen.blueprint,
      nextOpts,
      fallbackGenres(),
      fallbackMoods(),
      selectedSeason,
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

  async function onSaveCurrentPack() {
    await library.saveCurrentPack(gen.blueprint, { ...opts, channel: cm.selectedChannel }, thumbnailSpec, soundSignature ?? undefined);
    if (soundSignature) {
      await recordChannelPersonaUse(cm.selectedChannel.id, soundSignature.personaName, soundSignature);
      await refreshSavedPersonas();
    }
  }

  const step2Blocked = opts.moodIds.length === 0;
  const step3Blocked = !gen.blueprint;
  const maxUnlocked = gen.blueprint ? 4 : step2Blocked ? 2 : 3;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Suno Weaver Studio v3</p>
          <h1>Playlist prompt and lyrics workbench</h1>
        </div>
        <button type="button" className="primary action-button" disabled={gen.isGenerating} onClick={onGenerate}>
          <Wand2 size={18} />
          {gen.isGenerating ? `생성 중... (${gen.genProgress.done}/${gen.genProgress.total})` : `${opts.songCount}곡 생성하기`}
        </button>
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
        />

        <div className="wizard-main">
          {dashboardOpen ? (
            <VideoDashboard channel={cm.selectedChannel} onClose={() => setDashboardOpen(false)} />
          ) : (
            <>
          <StepIndicator steps={STEPS} current={currentStep} maxUnlocked={maxUnlocked} onSelect={setCurrentStep} />

          {loadWarning && (
            <p className="supporting load-warning" onClick={() => setLoadWarning('')}>
              {loadWarning} (닫으려면 클릭)
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
            />
          )}

          {currentStep === 2 && (
            <Step2Concept
              opts={opts}
              setOpts={setOpts}
              selectedGenres={selectedGenres}
              selectedMoods={selectedMoods}
              selectedSeason={selectedSeason}
              toggleArray={toggleArray}
              provider={provider}
            />
          )}

          {currentStep === 3 && (
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
              onImportMultiSetSongsJson={onImportMultiSetSongsJson}
              bridgeImportedSetAvoid={bridgeImportedSetAvoid}
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
          )}

          {currentStep === 4 && (
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
              soundSignature={soundSignature}
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
            />
          )}

          <WizardNav
            currentStep={currentStep}
            onPrev={() => setCurrentStep(step => Math.max(1, step - 1))}
            onNext={() => setCurrentStep(step => Math.min(4, step + 1))}
            nextDisabled={(currentStep === 2 && step2Blocked) || (currentStep === 3 && step3Blocked)}
            blockerMessage={currentStep === 2 ? '장르와 무드를 각각 최소 1개 선택하세요.' : currentStep === 3 ? '먼저 곡을 생성하세요.' : ''}
          />
            </>
          )}
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
          onContinueAnyway={onHookWarningContinueAnyway}
          onClose={() => setHookExhaustionWarning(null)}
          packSongCount={hookExhaustionPackSongCount}
        />
      )}

      <CachePromptModal
        open={!!cachePrompt}
        cachedAt={cachePrompt?.cachedAt || ''}
        onUseCache={onUseCachedResult}
        onGenerateFresh={onGenerateFreshFromPrompt}
        onCancel={() => setCachePrompt(null)}
      />
    </main>
  );
}
