import { useEffect, useMemo, useState } from 'react';
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
import { recordPackHooks } from './core/hookLedger';
import { normalizeGenreSelection, toggleGenreSelection } from './core/genreSelection';
import { clampOversizedFields, INPUT_LIMITS } from './core/inputLimits';
import { updateBatchJob } from './core/batchJobs';
import { rebuildStylePromptsForPersonaMode } from './core/localGenerator';
import { buildSoundSignature, PERSONA_STYLE_LIMIT } from './core/soundSignature';
import { regenerateTrack } from './providers';
import { useChannelManager } from './hooks/useChannelManager';
import { usePackLibrary } from './hooks/usePackLibrary';
import { useGenerationFlow, safeAvoidSet } from './hooks/useGenerationFlow';
import { useEvaluationFlow } from './hooks/useEvaluationFlow';
import { useBatchGenerationFlow } from './hooks/useBatchGenerationFlow';
import { createInitialOptions } from './utils/generation';
import { defaultPackagingLanguage } from './core/packagingLanguage';
import type { ChannelProfile, ProviderSettings, SoundSignature, ThumbnailVariantId } from './types';
import SettingsModal from './components/SettingsModal';
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

export default function App() {
  const [provider, setProvider] = useState<ProviderSettings>({ provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [cachePrompt, setCachePrompt] = useState<{ key: string; cachedAt: string } | null>(null);
  const [hybridMode, setHybridMode] = useState(false);
  const [thumbnailVariant, setThumbnailVariant] = useState(0);
  const [selectedThumbnailVariant, setSelectedThumbnailVariant] = useState<ThumbnailVariantId>('A');
  const [thumbnailArchetypeId, setThumbnailArchetypeId] = useState<ThumbnailArchetypeId>('refined-cafe');
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [loadWarning, setLoadWarning] = useState('');
  const [savedPersonas, setSavedPersonas] = useState<ChannelPersonaRecord[]>([]);

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
      return { ...spec, selected: selectedThumbnailVariant };
    },
    [gen.blueprint, opts, cm.selectedChannel, selectedSeason, thumbnailVariant, thumbnailArchetypeId, selectedThumbnailVariant]
  );

  // TASK E2 (v3.5) — a Batch API job outlives a closed tab; resume polling
  // any job still in flight for this channel as soon as it's known.
  useEffect(() => {
    void batchFlow.resumeActiveJobs(cm.selectedChannel.id, provider, onBatchJobComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cm.selectedChannel.id]);

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

  async function onGenerate() {
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
    setThumbnailVariant(v => v + 1);
  }

  function onSelectThumbnailVariant(id: ThumbnailVariantId) {
    setSelectedThumbnailVariant(id);
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
        onChange={setProvider}
        onExportAll={() => void library.exportAll()}
        onImportAll={file => void library.importAll(file)}
        onDeleteAll={() => void library.deleteAll()}
        channel={cm.selectedChannel}
      />

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
