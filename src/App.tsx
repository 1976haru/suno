import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { genrePacks, moodPacks, seasonPacks } from './data/presets';
import { moneyChordPresets } from './data/moneyChords';
import { saveAutosave } from './core/library';
import { isEvaluationAvailable } from './agents/evaluator';
import { computeCacheKey, getCached, setCached } from './core/apiCache';
import { recordUsage } from './core/usageLedger';
import { useChannelManager } from './hooks/useChannelManager';
import { usePackLibrary } from './hooks/usePackLibrary';
import { useGenerationFlow } from './hooks/useGenerationFlow';
import { useEvaluationFlow } from './hooks/useEvaluationFlow';
import { createInitialOptions } from './utils/generation';
import type { ChannelProfile, ProviderSettings } from './types';
import SettingsModal from './components/SettingsModal';
import CachePromptModal from './components/CachePromptModal';
import Sidebar from './components/Sidebar';
import StepIndicator, { type StepDef } from './components/StepIndicator';
import Step1Channel from './components/steps/Step1Channel';
import Step2Concept from './components/steps/Step2Concept';
import Step3Generate from './components/steps/Step3Generate';
import Step4Result from './components/steps/Step4Result';
import WizardNav from './components/WizardNav';

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

  function applyChannelToOptions(channel: ChannelProfile) {
    setOpts(prev => ({
      ...prev,
      channel,
      market: channel.market,
      audience: channel.audience,
      lyricLanguage: channel.primaryLanguage,
      genreIds: channel.preferredGenres,
      moodIds: channel.preferredMoods,
      vocalTone: channel.defaultVocal
    }));
  }

  const cm = useChannelManager(applyChannelToOptions);
  const gen = useGenerationFlow();
  const evalFlow = useEvaluationFlow();
  const library = usePackLibrary(pack => {
    gen.setBlueprint(pack.blueprint);
    setOpts(pack.options);
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

  function toggleArray(key: 'genreIds' | 'moodIds', id: string) {
    setOpts(prev => {
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [key]: Array.from(next) };
    });
  }

  function fallbackGenres() {
    return selectedGenres.length ? selectedGenres : [genrePacks[0]];
  }

  function fallbackMoods() {
    return selectedMoods.length ? selectedMoods : [moodPacks[0]];
  }

  function runGeneration(cacheKeyToStore?: string) {
    evalFlow.setEvaluation(null);
    setCurrentStep(4);
    void gen.generate(
      { ...opts, channel: cm.selectedChannel },
      fallbackGenres(),
      fallbackMoods(),
      selectedSeason,
      provider,
      async (next, songCount) => {
        setOpts(prev => ({ ...prev, songCount }));
        if (cacheKeyToStore) {
          void setCached(cacheKeyToStore, next, { provider: provider.provider, model: provider.model || provider.provider, songCount });
        }
        try {
          await saveAutosave(next, { ...opts, channel: cm.selectedChannel, songCount });
          await library.refresh();
        } catch {
          // Autosave is a convenience feature; failures should not block the result from showing.
        }
      }
    );
  }

  async function onGenerate() {
    if (provider.provider === 'local') {
      runGeneration();
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

  const step2Blocked = opts.genreIds.length === 0 || opts.moodIds.length === 0;
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
        />

        <div className="wizard-main">
          <StepIndicator steps={STEPS} current={currentStep} maxUnlocked={maxUnlocked} onSelect={setCurrentStep} />

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
              provider={provider}
              onOpenSettings={() => setSettingsOpen(true)}
              isGenerating={gen.isGenerating}
              genProgress={gen.genProgress}
              error={gen.error}
              onGenerate={onGenerate}
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
              onSave={() => void library.saveCurrentPack(gen.blueprint, { ...opts, channel: cm.selectedChannel })}
              onEvaluate={onEvaluate}
              onRetrySong={onRetrySong}
              onUndoRetry={onUndoRetry}
            />
          )}

          <WizardNav
            currentStep={currentStep}
            onPrev={() => setCurrentStep(step => Math.max(1, step - 1))}
            onNext={() => setCurrentStep(step => Math.min(4, step + 1))}
            nextDisabled={(currentStep === 2 && step2Blocked) || (currentStep === 3 && step3Blocked)}
            blockerMessage={currentStep === 2 ? '장르와 무드를 각각 최소 1개 선택하세요.' : currentStep === 3 ? '먼저 곡을 생성하세요.' : ''}
          />
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
