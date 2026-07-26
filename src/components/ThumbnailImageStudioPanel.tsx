import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Eye, EyeOff, Layers3, Plus, RefreshCw, Sparkles, Trash2, Undo2, Upload, Wand2 } from 'lucide-react';
import type { ThumbnailSpec } from '../core/thumbnailSpec';
import { composeThumbnailPromptSet, type ThumbnailPromptVariantId } from '../core/thumbnailPromptComposer';
import { thumbnailArchetypes } from '../data/thumbnailArchetypes';
import type { ThumbnailArchetypeId, ThumbnailPeopleMode, ThumbnailTextSafeZone, ThumbnailTimeOfDay } from '../data/thumbnailArchetypes';
import { seasonPacks } from '../data/presets';
import { generateQwenImage, generateThumbnailImage, getQwenApiKey, getQwenImageSettings } from '../core/thumbnailImageGen';
import {
  BASE_STYLE_PRESETS, FONT_OPTIONS, SHADOW_COLORS, TEXT_COLORS, TEXT_POSITIONS,
  composeImage, downloadCanvas, loadImage, loadUserBackgroundDataUrl, resizeDataUrlForEdit
} from '../core/thumbnailCanvas';
import type { ThumbnailDividerPreset, ThumbnailTextLayer } from '../core/thumbnailCanvas';
import {
  THUMBNAIL_LAYER_ROLE_LABELS,
  buildThumbnailTextLayersFromSpec,
  cloneThumbnailTextLayer,
  injectSpecTextIntoLayers,
  selectedThumbnailHeadline,
  stackThumbnailCoreLayers,
  templateStyle
} from '../core/thumbnailTextLayers';
import { defaultBrandTemplate, getBrandTemplate, listBrandChannelNames, saveBrandTemplate } from '../core/thumbnailBrandStore';
import type { ThumbnailBadgePosition, ThumbnailBrandTemplate } from '../types';
import { listSetGroups, loadPack } from '../core/library';
import type { SetGroupSummary } from '../core/library';
import { recordUsage } from '../core/usageLedger';

/**
 * TASK v3.37 — image-generation + canvas-compositing studio, ported from
 * creator-studio's tools/thumbnail app. Deliberately does NOT re-implement
 * copy/headline generation (spec item B: "중복 생성 로직 만들지 말 것") — it
 * only ever reads the already-selected A/B/C headline from `spec`, and for
 * the set-batch flow, each pack's own already-saved thumbnailSpec.
 */

interface ThumbnailImageStudioPanelProps {
  spec: ThumbnailSpec;
  defaultSeasonId: string;
  defaultArchetypeId: ThumbnailArchetypeId;
}

const THUMB_SIZE = { width: 1920, height: 1080 };
const COVER_SIZE = { width: 3000, height: 3000 };
const SAMPLE_COPY = '그시절 그노래\n올드팝송';

const TIME_LABELS: Record<ThumbnailTimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  'golden-hour': 'Golden hour',
  evening: 'Evening',
  night: 'Night'
};
const PEOPLE_LABELS: Record<ThumbnailPeopleMode, string> = {
  none: 'No people',
  'distant-silhouette': 'Distant silhouette'
};
const TEXT_ZONE_LABELS: Record<ThumbnailTextSafeZone, string> = { 'left-third': 'Left third (fixed)' };
const BADGE_POSITIONS: { id: ThumbnailBadgePosition; label: string }[] = [
  { id: 'top-left', label: '좌상단' },
  { id: 'top-right', label: '우상단' },
  { id: 'bottom-left', label: '좌하단' },
  { id: 'bottom-right', label: '우하단' }
];

type ImageTargetKey = 'thumb' | 'cover';

interface ImageTargetState {
  archetypeId: ThumbnailArchetypeId;
  seasonId: string;
  timeOfDay: ThumbnailTimeOfDay;
  peopleMode: ThumbnailPeopleMode;
  textSafeZone: ThumbnailTextSafeZone;
  seed: number;
  activeVariantId: ThumbnailPromptVariantId;
  copyText: string;
  layers: ThumbnailTextLayer[];
  selectedLayerId: string;
  backgroundDataUrl: string | null;
  /** TASK v3.44 Step A — which path filled backgroundDataUrl, so the UI can badge it ("AI 생성" vs "업로드") instead of leaving the source ambiguous. */
  backgroundSource: 'ai' | 'upload' | null;
  /**
   * TASK v3.45 (Part 2) — oldest-first stack of every backgroundDataUrl this
   * target has had: index 0 is always the original (upload or AI-generated),
   * every entry after it is one img2img edit. Capped (see capBackgroundHistory)
   * but always keeps the original reachable, since repeated edits compound
   * quality loss and the user should be able to restart from it, not just
   * step back one undo at a time.
   */
  backgroundHistory: string[];
  /** TASK v3.45 (Part 2) — the instruction prompt for "이 이미지 수정하기" (img2img editing), independent of copyText (the canvas-text headline). */
  editPrompt: string;
  editing: boolean;
  loading: boolean;
  error: string;
  composedCanvas: HTMLCanvasElement | null;
}

function selectedHeadline(spec: ThumbnailSpec): string {
  return selectedThumbnailHeadline(spec);
}

function createTargetState(key: ImageTargetKey, spec: ThumbnailSpec, defaultSeasonId: string, defaultArchetypeId: ThumbnailArchetypeId): ImageTargetState {
  const headline = selectedHeadline(spec);
  const layers = buildThumbnailTextLayersFromSpec(spec, defaultArchetypeId);
  return {
    archetypeId: defaultArchetypeId,
    seasonId: defaultSeasonId,
    timeOfDay: 'morning',
    peopleMode: 'none',
    textSafeZone: 'left-third',
    seed: 0,
    activeVariantId: 'A',
    copyText: key === 'cover' ? headline.split('\n')[0] : headline,
    layers,
    selectedLayerId: layers.find(layer => layer.role === 'title')?.id ?? layers[0]?.id ?? '',
    backgroundDataUrl: null,
    backgroundSource: null,
    backgroundHistory: [],
    editPrompt: '',
    editing: false,
    loading: false,
    error: '',
    composedCanvas: null
  };
}

/** TASK v3.45 (Part 2) — keeps history bounded while always keeping the very first (original, pre-edit) entry reachable, not just the most recent steps. */
const BACKGROUND_HISTORY_LIMIT = 3;
function capBackgroundHistory(history: string[]): string[] {
  if (history.length <= BACKGROUND_HISTORY_LIMIT) return history;
  return [history[0], ...history.slice(-(BACKGROUND_HISTORY_LIMIT - 1))];
}

export default function ThumbnailImageStudioPanel({ spec, defaultSeasonId, defaultArchetypeId }: ThumbnailImageStudioPanelProps) {
  const [channelName, setChannelName] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [template, setTemplate] = useState<ThumbnailBrandTemplate>(() => defaultBrandTemplate(''));
  const [overrideOnce, setOverrideOnce] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const [thumb, setThumb] = useState<ImageTargetState>(() => createTargetState('thumb', spec, defaultSeasonId, defaultArchetypeId));
  const [cover, setCover] = useState<ImageTargetState>(() => createTargetState('cover', spec, defaultSeasonId, defaultArchetypeId));
  const [coverShowBadge, setCoverShowBadge] = useState(false);

  const [setGroups, setSetGroups] = useState<SetGroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchLog, setBatchLog] = useState('');

  // TASK v3.45 (Part 2) — mirrors ThumbnailSpecPanel's own per-session Qwen
  // image counter (each panel instance tracks its own; not shared across
  // panels, same as that existing component).
  const [qwenSessionCount, setQwenSessionCount] = useState(0);

  const effectiveLocked = template.locked && !overrideOnce;

  useEffect(() => {
    void listBrandChannelNames().then(setChannels);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const style = templateStyle(template);
      const canvas = await composeImage({
        width: THUMB_SIZE.width,
        height: THUMB_SIZE.height,
        backgroundImage: null,
        layers: template.layers,
        copyText: SAMPLE_COPY,
        textStyle: style,
        badge: template.badge,
        showBadge: true
      });
      if (!cancelled) setPreviewDataUrl(canvas.toDataURL('image/png'));
    })();
    return () => {
      cancelled = true;
    };
  }, [template]);

  useEffect(() => {
    void refreshSetGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSetGroups() {
    const result = await listSetGroups();
    setSetGroups(result);
    setSelectedGroupId(prev => prev || result[0]?.groupId || '');
  }

  const thumbPromptSet = useMemo(
    () => composeThumbnailPromptSet({
      archetypeId: thumb.archetypeId,
      seasonId: thumb.seasonId,
      timeOfDay: thumb.timeOfDay,
      peopleMode: thumb.peopleMode,
      textSafeZone: thumb.textSafeZone,
      seed: thumb.seed,
      mode: 'thumbnail',
      resolution: '1920x1080'
    }),
    [thumb.archetypeId, thumb.seasonId, thumb.timeOfDay, thumb.peopleMode, thumb.textSafeZone, thumb.seed]
  );

  const coverPromptSet = useMemo(
    () => composeThumbnailPromptSet({
      archetypeId: cover.archetypeId,
      seasonId: cover.seasonId,
      timeOfDay: cover.timeOfDay,
      peopleMode: cover.peopleMode,
      textSafeZone: cover.textSafeZone,
      seed: cover.seed,
      mode: 'cover',
      resolution: '3000x3000'
    }),
    [cover.archetypeId, cover.seasonId, cover.timeOfDay, cover.peopleMode, cover.textSafeZone, cover.seed]
  );

  function targetState(key: ImageTargetKey) {
    return key === 'thumb' ? thumb : cover;
  }
  function setTargetState(key: ImageTargetKey, patch: Partial<ImageTargetState>) {
    (key === 'thumb' ? setThumb : setCover)(prev => ({ ...prev, ...patch }));
  }
  function promptSetFor(key: ImageTargetKey) {
    return key === 'thumb' ? thumbPromptSet : coverPromptSet;
  }

  function resetLayersFromSpec(key: ImageTargetKey, archetypeId = targetState(key).archetypeId) {
    const layers = buildThumbnailTextLayersFromSpec(spec, archetypeId);
    setTargetState(key, {
      layers,
      selectedLayerId: layers.find(layer => layer.role === 'title')?.id ?? layers[0]?.id ?? ''
    });
  }

  function changeTargetArchetype(key: ImageTargetKey, archetypeId: ThumbnailArchetypeId) {
    const layers = buildThumbnailTextLayersFromSpec(spec, archetypeId);
    setTargetState(key, {
      archetypeId,
      layers,
      selectedLayerId: layers.find(layer => layer.role === 'title')?.id ?? layers[0]?.id ?? ''
    });
  }

  function updateTargetLayers(key: ImageTargetKey, updater: (layers: ThumbnailTextLayer[]) => ThumbnailTextLayer[], selectedLayerId?: string) {
    const setState = key === 'thumb' ? setThumb : setCover;
    setState(prev => {
      const layers = updater(prev.layers);
      const fallbackSelected = layers.some(layer => layer.id === prev.selectedLayerId) ? prev.selectedLayerId : layers[0]?.id ?? '';
      return { ...prev, layers, selectedLayerId: selectedLayerId ?? fallbackSelected };
    });
  }

  function updateLayer(key: ImageTargetKey, layerId: string, patch: Partial<ThumbnailTextLayer>) {
    updateTargetLayers(key, layers => layers.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer));
  }

  function moveLayer(key: ImageTargetKey, layerId: string, direction: -1 | 1) {
    updateTargetLayers(key, layers => {
      const index = layers.findIndex(layer => layer.id === layerId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return layers;
      const next = [...layers];
      const [layer] = next.splice(index, 1);
      next.splice(nextIndex, 0, layer);
      return next;
    });
  }

  function addLayer(key: ImageTargetKey) {
    const state = targetState(key);
    const source = state.layers.find(layer => layer.id === state.selectedLayerId) ?? state.layers.find(layer => layer.role === 'title');
    if (!source) {
      resetLayersFromSpec(key);
      return;
    }
    const layer = cloneThumbnailTextLayer(source);
    updateTargetLayers(key, layers => [...layers, layer], layer.id);
  }

  function deleteLayer(key: ImageTargetKey, layerId: string) {
    updateTargetLayers(key, layers => layers.filter(layer => layer.id !== layerId));
  }

  function stackLayers(key: ImageTargetKey) {
    updateTargetLayers(key, layers => stackThumbnailCoreLayers(layers));
  }

  async function loadChannel() {
    if (!channelName.trim()) return;
    const saved = await getBrandTemplate(channelName.trim());
    const next = saved || defaultBrandTemplate(channelName.trim());
    setTemplate(next);
    if (saved?.layers?.length) {
      const restoredLayers = saved.layers.map(layer => ({ ...layer }));
      setThumb(prev => ({ ...prev, layers: restoredLayers.map(layer => ({ ...layer })), selectedLayerId: restoredLayers.find(layer => layer.role === 'title')?.id ?? restoredLayers[0]?.id ?? '' }));
      setCover(prev => ({ ...prev, layers: restoredLayers.map(layer => ({ ...layer })), selectedLayerId: restoredLayers.find(layer => layer.role === 'title')?.id ?? restoredLayers[0]?.id ?? '' }));
    } else if (saved) {
      setThumb(prev => ({ ...prev, layers: [], selectedLayerId: '' }));
      setCover(prev => ({ ...prev, layers: [], selectedLayerId: '' }));
    }
    setOverrideOnce(false);
  }

  function applyPreset(presetId: string) {
    const preset = BASE_STYLE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setTemplate(prev => ({ ...prev, fontId: preset.fontId, textColor: preset.textColor, shadowColor: preset.shadowColor, shadowWidth: preset.shadowWidth, strokeOn: preset.strokeOn }));
  }

  async function saveAndLock() {
    const name = channelName.trim();
    if (!name) return;
    const next = { ...template, channelName: name, layers: thumb.layers.length ? thumb.layers : undefined, locked: true, updatedAt: new Date().toISOString() };
    setTemplate(next);
    setOverrideOnce(false);
    await saveBrandTemplate(next);
    setChannels(await listBrandChannelNames());
  }

  function unlockTemplate() {
    if (!window.confirm('템플릿 잠금을 해제하면 이 채널의 모든 향후 제작물 스타일이 바뀔 수 있습니다. 계속할까요?')) return;
    setTemplate(prev => ({ ...prev, locked: false }));
    setOverrideOnce(false);
  }

  function applySpecCopyText(key: ImageTargetKey) {
    const headline = selectedHeadline(spec);
    setTargetState(key, { copyText: key === 'cover' ? headline.split('\n')[0] : headline });
    updateTargetLayers(key, layers => layers.map(layer => layer.role === 'title' ? { ...layer, text: headline } : layer));
  }

  async function generateBackground(key: ImageTargetKey) {
    const state = targetState(key);
    const promptSet = promptSetFor(key);
    const variant = promptSet.variants.find(v => v.id === state.activeVariantId) ?? promptSet.variants[0];
    setTargetState(key, { loading: true, error: '' });
    try {
      const image = await generateThumbnailImage({ prompt: variant.prompt, aspectRatio: key === 'thumb' ? '16:9' : '1:1' });
      // TASK v3.45 (Part 2) — a fresh background (AI or upload) restarts the
      // edit history rather than appending to whatever the previous
      // background's history was.
      setTargetState(key, { backgroundDataUrl: image.dataUrl, backgroundSource: 'ai', backgroundHistory: [image.dataUrl], loading: false });
    } catch (error) {
      setTargetState(key, { loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * TASK v3.44 Step A — the file-upload counterpart to generateBackground:
   * fills the exact same backgroundDataUrl, so every downstream step
   * (preview, text compositing, PNG export) works unchanged regardless of
   * where the background came from.
   */
  async function loadUserBackground(key: ImageTargetKey, file: File | null | undefined) {
    if (!file) return;
    setTargetState(key, { loading: true, error: '' });
    try {
      const dataUrl = await loadUserBackgroundDataUrl(file);
      setTargetState(key, { backgroundDataUrl: dataUrl, backgroundSource: 'upload', backgroundHistory: [dataUrl], loading: false });
    } catch (error) {
      setTargetState(key, { loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  function handleBackgroundDrop(key: ImageTargetKey, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    void loadUserBackground(key, event.dataTransfer.files?.[0]);
  }

  /**
   * TASK v3.45 (Part 2) — img2img editing: sends the current background as a
   * reference image alongside an instruction prompt to Qwen's sync
   * multimodal-generation endpoint (editing never supports async, so the
   * proxy forces/substitutes sync automatically — see api/image.js). Never
   * destructive: the previous backgroundDataUrl stays in backgroundHistory,
   * reachable via undoBackgroundEdit.
   */
  async function editBackground(key: ImageTargetKey) {
    const state = targetState(key);
    const prompt = state.editPrompt.trim();
    if (!state.backgroundDataUrl || !prompt) return;

    const apiKey = await getQwenApiKey();
    if (!apiKey) {
      setTargetState(key, { error: 'Settings에서 Qwen API 키를 먼저 등록하세요.' });
      return;
    }
    const settings = await getQwenImageSettings();
    if (qwenSessionCount + 1 > settings.sessionLimit && !window.confirm(`이번 세션의 Qwen 이미지 사용량이 ${qwenSessionCount + 1}장으로, 설정된 한도 ${settings.sessionLimit}장을 넘습니다. 계속할까요?`)) {
      return;
    }

    setTargetState(key, { editing: true, error: '' });
    try {
      const resized = await resizeDataUrlForEdit(state.backgroundDataUrl);
      const result = await generateQwenImage({ prompt, settings, count: 1, inputImages: [resized] });
      const edited = result.dataUrls[0] || result.imageUrls[0];
      if (!edited) throw new Error('편집 결과 이미지를 받지 못했습니다.');
      setQwenSessionCount(count => count + result.imageCount);
      await recordUsage({
        provider: 'qwen',
        model: result.model,
        purpose: 'image',
        inputTokens: 0,
        outputTokens: 0,
        cacheHit: false,
        imageCount: result.imageCount,
        imageCostCny: result.estimatedCostCny
      });
      setTargetState(key, {
        backgroundDataUrl: edited,
        backgroundHistory: capBackgroundHistory([...state.backgroundHistory, edited]),
        editing: false,
        error: result.modelSubstituted ? `참고: 선택된 모델은 편집(동기 전용)을 지원하지 않아 ${result.model}로 자동 대체되었습니다.` : ''
      });
    } catch (error) {
      setTargetState(key, { editing: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  function undoBackgroundEdit(key: ImageTargetKey) {
    const state = targetState(key);
    if (state.backgroundHistory.length <= 1) return;
    const nextHistory = state.backgroundHistory.slice(0, -1);
    setTargetState(key, {
      backgroundDataUrl: nextHistory[nextHistory.length - 1],
      backgroundHistory: nextHistory,
      error: ''
    });
  }

  async function renderComposite(key: ImageTargetKey): Promise<HTMLCanvasElement | null> {
    const state = targetState(key);
    const size = key === 'thumb' ? THUMB_SIZE : COVER_SIZE;
    let backgroundImage = null;
    if (state.backgroundDataUrl) {
      try {
        backgroundImage = await loadImage(state.backgroundDataUrl);
      } catch {
        // fall back to a solid background fill
      }
    }
    const style = templateStyle(template);
    const canvas = await composeImage({
      width: size.width,
      height: size.height,
      backgroundImage,
      layers: state.layers.length ? state.layers : undefined,
      copyText: state.copyText,
      textStyle: style,
      badge: template.badge,
      showBadge: key === 'thumb' ? true : coverShowBadge
    });
    setTargetState(key, { composedCanvas: canvas });
    return canvas;
  }

  async function downloadComposite(key: ImageTargetKey) {
    const canvas = await renderComposite(key);
    if (!canvas) return;
    const filename = `${channelName || 'thumbnail'}-${key}-${Date.now()}.png`;
    await downloadCanvas(canvas, filename);
  }

  async function runBatch() {
    const group = setGroups.find(g => g.groupId === selectedGroupId);
    if (!group) return;
    setBatchRunning(true);
    setBatchLog('');
    const style = templateStyle(template);
    let done = 0;
    for (const meta of group.packs) {
      const pack = await loadPack(meta.id);
      if (!pack) continue;
      const headline = (pack.thumbnailSpec?.variants.find(v => v.id === pack.thumbnailSpec?.selected)?.headline)
        ?? pack.thumbnailSpec?.variants[0]?.headline
        ?? pack.projectTitle;
      const seasonId = pack.options?.seasonId || defaultSeasonId;
      try {
        const promptSet = composeThumbnailPromptSet({
          archetypeId: thumb.archetypeId,
          seasonId,
          seed: pack.setIndex ?? 0,
          mode: 'thumbnail',
          resolution: '1920x1080'
        });
        const variant = promptSet.variants[0];
        const image = await generateThumbnailImage({ prompt: variant.prompt, aspectRatio: '16:9' });
        const backgroundImage = await loadImage(image.dataUrl);
        const canvas = await composeImage({
          width: THUMB_SIZE.width,
          height: THUMB_SIZE.height,
          backgroundImage,
          layers: thumb.layers.length && pack.thumbnailSpec ? injectSpecTextIntoLayers(thumb.layers, pack.thumbnailSpec, thumb.archetypeId) : undefined,
          copyText: headline,
          textStyle: style,
          badge: template.badge,
          showBadge: true
        });
        await downloadCanvas(canvas, `${pack.projectTitle || 'set'}-thumbnail.png`);
        done += 1;
        setBatchLog(prev => `${prev}${pack.projectTitle}: 완료\n`);
      } catch (error) {
        setBatchLog(prev => `${prev}${pack.projectTitle}: 실패 (${error instanceof Error ? error.message : String(error)})\n`);
      }
    }
    setBatchRunning(false);
    setBatchLog(prev => `${prev}총 ${done}/${group.packs.length}개 완료`);
  }

  function renderLayerEditor(key: ImageTargetKey) {
    const state = targetState(key);
    const selectedLayer = state.layers.find(layer => layer.id === state.selectedLayerId) ?? state.layers[0];

    if (!state.layers.length) {
      return (
        <div className="thumbnail-layer-panel">
          <div className="thumbnail-layer-head">
            <h4>Text layers</h4>
            <button type="button" onClick={() => resetLayersFromSpec(key)}>
              <Layers3 size={14} />
              Use spec layers
            </button>
          </div>
          <p className="supporting">Legacy single-text mode is active for this target.</p>
        </div>
      );
    }

    return (
      <div className="thumbnail-layer-panel">
        <div className="thumbnail-layer-head">
          <h4>Text layers</h4>
          <div className="button-row">
            <button type="button" disabled={effectiveLocked} onClick={() => stackLayers(key)}>
              <Layers3 size={14} />
              Stack
            </button>
            <button type="button" onClick={() => resetLayersFromSpec(key)}>Reset to spec</button>
            <button type="button" disabled={effectiveLocked} onClick={() => addLayer(key)}>
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>

        <div className="thumbnail-layer-list">
          {state.layers.map((layer, index) => (
            <div key={layer.id} className={layer.id === selectedLayer?.id ? 'thumbnail-layer-row active' : 'thumbnail-layer-row'}>
              <button
                type="button"
                className="icon-button"
                title={layer.enabled ? 'Hide layer' : 'Show layer'}
                disabled={effectiveLocked}
                onClick={() => updateLayer(key, layer.id, { enabled: !layer.enabled })}
              >
                {layer.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button type="button" className="chip" onClick={() => setTargetState(key, { selectedLayerId: layer.id })}>
                {THUMBNAIL_LAYER_ROLE_LABELS[layer.role]}
              </button>
              <input
                value={layer.text}
                placeholder={layer.role === 'divider' ? 'Divider text (text preset only)' : 'Layer text'}
                onFocus={() => setTargetState(key, { selectedLayerId: layer.id })}
                onChange={event => updateLayer(key, layer.id, { text: event.target.value })}
              />
              <button type="button" className="icon-button" title="Move up" disabled={effectiveLocked || index === 0} onClick={() => moveLayer(key, layer.id, -1)}>
                <ArrowUp size={14} />
              </button>
              <button type="button" className="icon-button" title="Move down" disabled={effectiveLocked || index === state.layers.length - 1} onClick={() => moveLayer(key, layer.id, 1)}>
                <ArrowDown size={14} />
              </button>
              <button type="button" className="icon-button" title="Duplicate" disabled={effectiveLocked} onClick={() => {
                const clone = cloneThumbnailTextLayer(layer);
                updateTargetLayers(key, layers => [...layers.slice(0, index + 1), clone, ...layers.slice(index + 1)], clone.id);
              }}>
                <Copy size={14} />
              </button>
              <button type="button" className="icon-button" title="Delete" disabled={effectiveLocked || state.layers.length <= 1} onClick={() => deleteLayer(key, layer.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {selectedLayer && (
          <div className="thumbnail-layer-detail">
            <div className="thumbnail-control-grid">
              <label>
                Font
                <select value={selectedLayer.fontId} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { fontId: event.target.value as ThumbnailTextLayer['fontId'] })}>
                  {FONT_OPTIONS.map(font => <option key={font.id} value={font.id}>{font.family}</option>)}
                </select>
              </label>
              <label>
                Anchor
                <select value={selectedLayer.position} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { position: event.target.value as ThumbnailTextLayer['position'] })}>
                  {TEXT_POSITIONS.map(position => <option key={position.id} value={position.id}>{position.label}</option>)}
                </select>
              </label>
              <label>
                Max lines
                <select value={selectedLayer.maxLines} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { maxLines: Number(event.target.value) })}>
                  {[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Shadow
                <select value={selectedLayer.shadowWidth} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { shadowWidth: Number(event.target.value) })}>
                  {[0, 1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value}px</option>)}
                </select>
              </label>
              <label>
                Stroke
                <select value={selectedLayer.strokeOn ? 'on' : 'off'} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { strokeOn: event.target.value === 'on' })}>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </label>
            </div>

            <div className="thumbnail-slider-grid">
              <label>
                Size {selectedLayer.sizeRatio.toFixed(3)}
                <input type="range" min="0.02" max="0.22" step="0.002" value={selectedLayer.sizeRatio} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { sizeRatio: Number(event.target.value) })} />
              </label>
              <label>
                X {selectedLayer.offsetXRatio.toFixed(3)}
                <input type="range" min="-0.5" max="0.5" step="0.005" value={selectedLayer.offsetXRatio} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { offsetXRatio: Number(event.target.value) })} />
              </label>
              <label>
                Y {selectedLayer.offsetYRatio.toFixed(3)}
                <input type="range" min="-0.5" max="0.5" step="0.005" value={selectedLayer.offsetYRatio} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { offsetYRatio: Number(event.target.value) })} />
              </label>
              <label>
                Line height {selectedLayer.lineHeightRatio.toFixed(2)}
                <input type="range" min="0.75" max="2.4" step="0.01" value={selectedLayer.lineHeightRatio} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { lineHeightRatio: Number(event.target.value) })} />
              </label>
              <label>
                Letter spacing {selectedLayer.letterSpacingRatio.toFixed(3)}
                <input type="range" min="-0.02" max="0.08" step="0.001" value={selectedLayer.letterSpacingRatio} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { letterSpacingRatio: Number(event.target.value) })} />
              </label>
              <label>
                Opacity {selectedLayer.opacity.toFixed(2)}
                <input type="range" min="0" max="1" step="0.01" value={selectedLayer.opacity} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { opacity: Number(event.target.value) })} />
              </label>
            </div>

            <label>Text color</label>
            <div className="thumbnail-swatches">
              {TEXT_COLORS.map(color => (
                <span
                  key={color}
                  className="thumbnail-swatch"
                  style={{
                    background: color,
                    boxShadow: selectedLayer.textColor === color ? '0 0 0 2px var(--blue)' : 'none',
                    cursor: effectiveLocked ? 'not-allowed' : 'pointer',
                    opacity: effectiveLocked ? 0.5 : 1
                  }}
                  onClick={() => !effectiveLocked && updateLayer(key, selectedLayer.id, { textColor: color })}
                />
              ))}
            </div>
            <label>Shadow color</label>
            <div className="thumbnail-swatches">
              {SHADOW_COLORS.map(color => (
                <span
                  key={color}
                  className="thumbnail-swatch"
                  style={{
                    background: color,
                    boxShadow: selectedLayer.shadowColor === color ? '0 0 0 2px var(--blue)' : 'none',
                    cursor: effectiveLocked ? 'not-allowed' : 'pointer',
                    opacity: effectiveLocked ? 0.5 : 1
                  }}
                  onClick={() => !effectiveLocked && updateLayer(key, selectedLayer.id, { shadowColor: color })}
                />
              ))}
            </div>

            {selectedLayer.role === 'divider' && (
              <div className="thumbnail-control-grid">
                <label>
                  Divider preset
                  <select value={selectedLayer.dividerPreset ?? 'line-ornament'} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { dividerPreset: event.target.value as ThumbnailDividerPreset })}>
                    <option value="line">Line</option>
                    <option value="line-ornament">Line + ornament</option>
                    <option value="text">Text</option>
                  </select>
                </label>
                <label>
                  Width {(selectedLayer.dividerWidthRatio ?? 0.24).toFixed(2)}
                  <input type="range" min="0.02" max="0.95" step="0.01" value={selectedLayer.dividerWidthRatio ?? 0.24} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { dividerWidthRatio: Number(event.target.value) })} />
                </label>
                <label>
                  Thickness {(selectedLayer.dividerThicknessRatio ?? 0.0025).toFixed(4)}
                  <input type="range" min="0.0005" max="0.03" step="0.0005" value={selectedLayer.dividerThicknessRatio ?? 0.0025} disabled={effectiveLocked} onChange={event => updateLayer(key, selectedLayer.id, { dividerThicknessRatio: Number(event.target.value) })} />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderTargetControls(key: ImageTargetKey) {
    const state = targetState(key);
    const promptSet = promptSetFor(key);
    const activeVariant = promptSet.variants.find(v => v.id === state.activeVariantId) ?? promptSet.variants[0];
    const size = key === 'thumb' ? THUMB_SIZE : COVER_SIZE;

    return (
      <div className="thumbnail-image-target">
        <h4>{key === 'thumb' ? `썸네일 (16:9 · ${size.width}×${size.height})` : `커버 (1:1 · ${size.width}×${size.height})`}</h4>

        <div className="thumbnail-control-grid">
          <label>
            Archetype
            <select value={state.archetypeId} onChange={event => changeTargetArchetype(key, event.target.value as ThumbnailArchetypeId)}>
              {thumbnailArchetypes.map(a => <option key={a.id} value={a.id}>{a.labelKo}</option>)}
            </select>
          </label>
          <label>
            Season
            <select value={state.seasonId} onChange={event => setTargetState(key, { seasonId: event.target.value })}>
              {seasonPacks.map(season => <option key={season.id} value={season.id}>{season.label}</option>)}
            </select>
          </label>
          <label>
            Time
            <select value={state.timeOfDay} onChange={event => setTargetState(key, { timeOfDay: event.target.value as ThumbnailTimeOfDay })}>
              {(Object.keys(TIME_LABELS) as ThumbnailTimeOfDay[]).map(opt => <option key={opt} value={opt}>{TIME_LABELS[opt]}</option>)}
            </select>
          </label>
          <label>
            People
            <select value={state.peopleMode} onChange={event => setTargetState(key, { peopleMode: event.target.value as ThumbnailPeopleMode })}>
              {(Object.keys(PEOPLE_LABELS) as ThumbnailPeopleMode[]).map(opt => <option key={opt} value={opt}>{PEOPLE_LABELS[opt]}</option>)}
            </select>
          </label>
          <label>
            Text zone
            <select value={state.textSafeZone} onChange={event => setTargetState(key, { textSafeZone: event.target.value as ThumbnailTextSafeZone })}>
              {(Object.keys(TEXT_ZONE_LABELS) as ThumbnailTextSafeZone[]).map(opt => <option key={opt} value={opt}>{TEXT_ZONE_LABELS[opt]}</option>)}
            </select>
          </label>
        </div>

        <div className="button-row">
          {promptSet.variants.map(v => (
            <button key={v.id} type="button" className={v.id === state.activeVariantId ? 'chip active' : 'chip'} onClick={() => setTargetState(key, { activeVariantId: v.id })}>
              {v.id}
            </button>
          ))}
          <button type="button" onClick={() => setTargetState(key, { seed: state.seed + 1 })}>
            <RefreshCw size={14} />
            New A/B/C
          </button>
        </div>
        <pre className="thumbnail-prompt-preview">{activeVariant.prompt}</pre>
        {activeVariant.safetyIssues.length > 0 && (
          <p className="error">⚠️ {activeVariant.safetyIssues.join(' / ')}</p>
        )}

        <div className="button-row">
          <button type="button" className="primary" disabled={state.loading} onClick={() => void generateBackground(key)}>
            <Sparkles size={14} />
            {state.loading ? '생성 중...' : 'Gemini로 배경 생성'}
          </button>
          <label className="chip" style={{ cursor: 'pointer' }}>
            <Upload size={14} />
            내 이미지 올리기
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={event => {
                void loadUserBackground(key, event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="supporting">글자가 없는 배경 이미지를 올리면 제목을 몇 번이든 다시 바꿀 수 있어요. 글자가 이미 있는 이미지는 새 텍스트가 그 위에 겹쳐 보입니다.</p>
        {state.error && <p className="error">❌ {state.error}</p>}

        <div
          className="thumbnail-preview-row"
          onDragOver={event => event.preventDefault()}
          onDrop={event => handleBackgroundDrop(key, event)}
        >
          {state.backgroundDataUrl && (
            <div>
              <span className="chip">{state.backgroundSource === 'upload' ? '📤 업로드한 배경' : '✨ AI 생성 배경'}</span>
              <img className="thumbnail-bg-preview" src={state.backgroundDataUrl} alt="배경 미리보기" />
            </div>
          )}
          {state.composedCanvas && <img className="thumbnail-bg-preview" src={state.composedCanvas.toDataURL('image/png')} alt="합성 결과" />}
        </div>

        {state.backgroundDataUrl && (
          <div className="option-block">
            <label>🪄 이 이미지 수정하기 (Qwen, img2img)</label>
            <p className="supporting">
              업로드하거나 생성한 배경을 프롬프트로 고쳐보세요 (예: "하늘을 더 보랏빛으로"). 편집은 항상 동기 방식으로만 동작하며, 비동기 전용 모델이 선택돼 있어도 자동으로 대체됩니다.
              글자가 이미 구워진 이미지라면 먼저 <b>"제목 글자를 지우고 자연스럽게 채워주세요"</b>처럼 지시해 글자 없는 배경을 만든 뒤, 아래 "문구" 캔버스 텍스트로 제목을 얹으세요 — 그래야 제목을 몇 번이든 다시 바꿀 수 있고 한글 서체도 정확합니다.
            </p>
            <div className="inline">
              <input
                value={state.editPrompt}
                placeholder="예: 하늘을 더 보랏빛으로, 글자는 그대로 두세요"
                onChange={event => setTargetState(key, { editPrompt: event.target.value })}
              />
              <button type="button" className="primary" disabled={state.editing || !state.editPrompt.trim()} onClick={() => void editBackground(key)}>
                <Wand2 size={14} />
                {state.editing ? '수정 중...' : '이 이미지 수정하기'}
              </button>
              <button type="button" disabled={state.backgroundHistory.length <= 1} onClick={() => undoBackgroundEdit(key)}>
                <Undo2 size={14} />
                되돌리기
              </button>
            </div>
            {state.backgroundHistory.length > 1 && (
              <p className="supporting">편집 {state.backgroundHistory.length - 1}단계 적용됨 (원본까지 되돌리기 가능)</p>
            )}
          </div>
        )}

        {renderLayerEditor(key)}

        <label>Legacy copy text</label>
        <div className="inline">
          <input value={state.copyText} onChange={event => setTargetState(key, { copyText: event.target.value })} />
          <button type="button" onClick={() => applySpecCopyText(key)}>선택한 A/B/C 문구 적용</button>
        </div>
        {key === 'cover' && (
          <label className="persona-toggle">
            <input type="checkbox" checked={coverShowBadge} onChange={event => setCoverShowBadge(event.target.checked)} />
            <span>브랜드 배지 표시 (기본 꺼짐)</span>
          </label>
        )}

        <div className="button-row">
          <button type="button" onClick={() => void renderComposite(key)}>미리보기 갱신</button>
          <button type="button" className="primary" onClick={() => void downloadComposite(key)}>
            <Download size={14} />
            PNG 다운로드
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="thumbnail-image-studio">
      <p className="step-hint">
        위 아키타입 프롬프트를 Gemini로 실제 이미지로 만들고, 채널 브랜드 템플릿(폰트·색·배지)을 입혀 썸네일(16:9)과 커버(1:1)를 PNG로 내려받습니다.
      </p>

      <div className="option-block">
        <h3>🎨 채널 브랜드 템플릿</h3>
        <div className="thumbnail-control-grid">
          <label>
            채널 이름
            <input list="thumbnail-brand-channels" value={channelName} onChange={event => setChannelName(event.target.value)} placeholder="예: 올드팝 라디오" />
            <datalist id="thumbnail-brand-channels">
              {channels.map(name => <option key={name} value={name} />)}
            </datalist>
          </label>
          <button type="button" onClick={() => void loadChannel()}>불러오기</button>
          <span className="chip">{template.locked ? '🔒 잠김' : '🔓 설정 중'}</span>
        </div>

        <div className="button-row">
          {BASE_STYLE_PRESETS.map(preset => (
            <button key={preset.id} type="button" className="chip" disabled={effectiveLocked} onClick={() => applyPreset(preset.id)}>
              {preset.label}
            </button>
          ))}
        </div>

        <div className="thumbnail-control-grid">
          <label>
            폰트
            <select value={template.fontId} disabled={effectiveLocked} onChange={event => setTemplate(prev => ({ ...prev, fontId: event.target.value as ThumbnailBrandTemplate['fontId'] }))}>
              {FONT_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.family}</option>)}
            </select>
          </label>
          <label>
            그림자 두께
            <select value={template.shadowWidth} disabled={effectiveLocked} onChange={event => setTemplate(prev => ({ ...prev, shadowWidth: Number(event.target.value) }))}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}px</option>)}
            </select>
          </label>
          <label>
            테두리
            <select value={template.strokeOn ? 'on' : 'off'} disabled={effectiveLocked} onChange={event => setTemplate(prev => ({ ...prev, strokeOn: event.target.value === 'on' }))}>
              <option value="on">ON</option>
              <option value="off">OFF</option>
            </select>
          </label>
          <label>
            텍스트 위치
            <select value={template.position} disabled={effectiveLocked} onChange={event => setTemplate(prev => ({ ...prev, position: event.target.value as ThumbnailBrandTemplate['position'] }))}>
              {TEXT_POSITIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        </div>

        <label>텍스트 색</label>
        <div className="thumbnail-swatches">
          {TEXT_COLORS.map(c => (
            <span
              key={c}
              className="thumbnail-swatch"
              style={{
                background: c,
                boxShadow: template.textColor === c ? '0 0 0 2px var(--blue)' : 'none',
                cursor: effectiveLocked ? 'not-allowed' : 'pointer',
                opacity: effectiveLocked ? 0.5 : 1
              }}
              onClick={() => !effectiveLocked && setTemplate(prev => ({ ...prev, textColor: c }))}
            />
          ))}
        </div>
        <label>그림자 색</label>
        <div className="thumbnail-swatches">
          {SHADOW_COLORS.map(c => (
            <span
              key={c}
              className="thumbnail-swatch"
              style={{
                background: c,
                boxShadow: template.shadowColor === c ? '0 0 0 2px var(--blue)' : 'none',
                cursor: effectiveLocked ? 'not-allowed' : 'pointer',
                opacity: effectiveLocked ? 0.5 : 1
              }}
              onClick={() => !effectiveLocked && setTemplate(prev => ({ ...prev, shadowColor: c }))}
            />
          ))}
        </div>

        <div className="thumbnail-control-grid">
          <label>
            배지 아이콘
            <input value={template.badge.icon} disabled={effectiveLocked} maxLength={4} onChange={event => setTemplate(prev => ({ ...prev, badge: { ...prev.badge, icon: event.target.value } }))} />
          </label>
          <label>
            배지 태그
            <input value={template.badge.tag} disabled={effectiveLocked} maxLength={16} onChange={event => setTemplate(prev => ({ ...prev, badge: { ...prev.badge, tag: event.target.value } }))} />
          </label>
          <label>
            배지 위치
            <select value={template.badge.position} disabled={effectiveLocked} onChange={event => setTemplate(prev => ({ ...prev, badge: { ...prev.badge, position: event.target.value as ThumbnailBadgePosition } }))}>
              {BADGE_POSITIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        </div>

        {previewDataUrl && <img className="thumbnail-bg-preview" src={previewDataUrl} alt="브랜드 템플릿 미리보기" />}

        <div className="button-row">
          {template.locked ? (
            <>
              <button type="button" onClick={() => setOverrideOnce(v => !v)}>{overrideOnce ? '이번만 다르게: 켜짐' : '이번만 다르게'}</button>
              <button type="button" onClick={unlockTemplate}>설정 잠금 해제</button>
            </>
          ) : (
            <button type="button" className="primary" onClick={() => void saveAndLock()}>저장 및 잠금</button>
          )}
        </div>
      </div>

      <div className="option-block">{renderTargetControls('thumb')}</div>
      <div className="option-block">{renderTargetControls('cover')}</div>

      <div className="option-block">
        <h3>📦 세트 일괄 썸네일 생성</h3>
        <p className="supporting">멀티세트로 생성한 팩 그룹을 골라, 각 세트의 시즌·선택 문구로 같은 브랜드 템플릿의 썸네일을 순차 생성·다운로드합니다.</p>
        <div className="button-row">
          <select value={selectedGroupId} onChange={event => setSelectedGroupId(event.target.value)}>
            {setGroups.length === 0 && <option value="">세트 그룹 없음</option>}
            {setGroups.map(g => <option key={g.groupId} value={g.groupId}>{g.label}</option>)}
          </select>
          <button type="button" onClick={() => void refreshSetGroups()}>목록 새로고침</button>
          <button type="button" className="primary" disabled={!selectedGroupId || batchRunning} onClick={() => void runBatch()}>
            {batchRunning ? '생성 중...' : '세트 전체 썸네일 생성'}
          </button>
        </div>
        {batchLog && <pre className="thumbnail-prompt-preview">{batchLog}</pre>}
      </div>
    </section>
  );
}
