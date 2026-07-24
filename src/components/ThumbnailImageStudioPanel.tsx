import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import type { ThumbnailSpec } from '../core/thumbnailSpec';
import { composeThumbnailPromptSet, type ThumbnailPromptVariantId } from '../core/thumbnailPromptComposer';
import { thumbnailArchetypes } from '../data/thumbnailArchetypes';
import type { ThumbnailArchetypeId, ThumbnailPeopleMode, ThumbnailTextSafeZone, ThumbnailTimeOfDay } from '../data/thumbnailArchetypes';
import { seasonPacks } from '../data/presets';
import { generateThumbnailImage } from '../core/thumbnailImageGen';
import {
  BASE_STYLE_PRESETS, FONT_OPTIONS, SHADOW_COLORS, TEXT_COLORS, TEXT_POSITIONS,
  composeImage, downloadCanvas, loadImage
} from '../core/thumbnailCanvas';
import type { ThumbnailTextStyle } from '../core/thumbnailCanvas';
import { defaultBrandTemplate, getBrandTemplate, listBrandChannelNames, saveBrandTemplate } from '../core/thumbnailBrandStore';
import type { ThumbnailBadgePosition, ThumbnailBrandTemplate } from '../types';
import { listSetGroups, loadPack } from '../core/library';
import type { SetGroupSummary } from '../core/library';

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
  backgroundDataUrl: string | null;
  loading: boolean;
  error: string;
  composedCanvas: HTMLCanvasElement | null;
}

function selectedHeadline(spec: ThumbnailSpec): string {
  return spec.variants.find(v => v.id === spec.selected)?.headline ?? spec.variants[0]?.headline ?? '';
}

function createTargetState(key: ImageTargetKey, spec: ThumbnailSpec, defaultSeasonId: string, defaultArchetypeId: ThumbnailArchetypeId): ImageTargetState {
  const headline = selectedHeadline(spec);
  return {
    archetypeId: defaultArchetypeId,
    seasonId: defaultSeasonId,
    timeOfDay: 'morning',
    peopleMode: 'none',
    textSafeZone: 'left-third',
    seed: 0,
    activeVariantId: 'A',
    copyText: key === 'cover' ? headline.split('\n')[0] : headline,
    backgroundDataUrl: null,
    loading: false,
    error: '',
    composedCanvas: null
  };
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

  const effectiveLocked = template.locked && !overrideOnce;

  useEffect(() => {
    void listBrandChannelNames().then(setChannels);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const style: ThumbnailTextStyle = {
        fontId: template.fontId,
        textColor: template.textColor,
        shadowColor: template.shadowColor,
        shadowWidth: template.shadowWidth,
        strokeOn: template.strokeOn,
        position: template.position
      };
      const canvas = await composeImage({
        width: THUMB_SIZE.width,
        height: THUMB_SIZE.height,
        backgroundImage: null,
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

  async function loadChannel() {
    if (!channelName.trim()) return;
    const saved = await getBrandTemplate(channelName.trim());
    setTemplate(saved || defaultBrandTemplate(channelName.trim()));
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
    const next = { ...template, channelName: name, locked: true, updatedAt: new Date().toISOString() };
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
  }

  async function generateBackground(key: ImageTargetKey) {
    const state = targetState(key);
    const promptSet = promptSetFor(key);
    const variant = promptSet.variants.find(v => v.id === state.activeVariantId) ?? promptSet.variants[0];
    setTargetState(key, { loading: true, error: '' });
    try {
      const image = await generateThumbnailImage({ prompt: variant.prompt, aspectRatio: key === 'thumb' ? '16:9' : '1:1' });
      setTargetState(key, { backgroundDataUrl: image.dataUrl, loading: false });
    } catch (error) {
      setTargetState(key, { loading: false, error: error instanceof Error ? error.message : String(error) });
    }
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
    const style: ThumbnailTextStyle = {
      fontId: template.fontId,
      textColor: template.textColor,
      shadowColor: template.shadowColor,
      shadowWidth: template.shadowWidth,
      strokeOn: template.strokeOn,
      position: template.position
    };
    const canvas = await composeImage({
      width: size.width,
      height: size.height,
      backgroundImage,
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
    const style: ThumbnailTextStyle = {
      fontId: template.fontId,
      textColor: template.textColor,
      shadowColor: template.shadowColor,
      shadowWidth: template.shadowWidth,
      strokeOn: template.strokeOn,
      position: template.position
    };
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
            <select value={state.archetypeId} onChange={event => setTargetState(key, { archetypeId: event.target.value as ThumbnailArchetypeId })}>
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
        </div>
        {state.error && <p className="error">❌ {state.error}</p>}

        <div className="thumbnail-preview-row">
          {state.backgroundDataUrl && <img className="thumbnail-bg-preview" src={state.backgroundDataUrl} alt="생성된 배경" />}
          {state.composedCanvas && <img className="thumbnail-bg-preview" src={state.composedCanvas.toDataURL('image/png')} alt="합성 결과" />}
        </div>

        <label>문구</label>
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
