import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ImagePlus, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { seasonPacks } from '../data/presets';
import { thumbnailArchetypeById, thumbnailArchetypes, type ThumbnailArchetypeId } from '../data/thumbnailArchetypes';
import type { ProviderSettings, ThumbnailBrandTemplate, ThumbnailSpec, ThumbnailTextLayer } from '../types';
import { composeImage, downloadCanvas, loadImage, loadUserBackgroundDataUrl } from '../core/thumbnailCanvas';
import { buildThumbnailTextLayersFromSpec, templateStyle } from '../core/thumbnailTextLayers';
import { defaultBrandTemplate, getBrandTemplate } from '../core/thumbnailBrandStore';
import { getSetting, setSetting } from '../core/settingsStore';
import { generateQwenImage, generateThumbnailImage, getGeminiApiKey, getQwenApiKey, getQwenImageSettings } from '../core/thumbnailImageGen';

interface StandaloneThumbnailStudioProps {
  spec: ThumbnailSpec;
  channelName: string;
  seasonId: string;
  onSeasonChange: (seasonId: string) => void;
  defaultArchetypeId: ThumbnailArchetypeId;
  textModelSettings?: ProviderSettings;
  onClose: () => void;
  onOpenSettings?: () => void;
}

type CanvasMode = 'thumbnail' | 'cover';
type RecentThumbnail = { id: string; dataUrl: string; title: string; subtitle: string; mode: CanvasMode; createdAt: string };

const RECENT_KEY = 'thumbnail:standalone:recent';
const SIZES: Record<CanvasMode, { width: number; height: number; label: string }> = {
  thumbnail: { width: 1280, height: 720, label: '16:9' },
  cover: { width: 1000, height: 1000, label: '1:1' }
};

function textLayers(spec: ThumbnailSpec, archetypeId: ThumbnailArchetypeId, template: ThumbnailBrandTemplate, title: string, subtitle: string): ThumbnailTextLayer[] {
  const style = templateStyle(template);
  return buildThumbnailTextLayersFromSpec(spec, archetypeId).map(layer => ({
    ...layer,
    ...style,
    text: layer.role === 'title' ? title : layer.role === 'subtitle' ? subtitle : layer.text,
    enabled: layer.role === 'subtitle' ? Boolean(subtitle.trim()) : layer.enabled
  }));
}

export default function StandaloneThumbnailStudio({ spec, channelName, seasonId, onSeasonChange, defaultArchetypeId, onClose, onOpenSettings }: StandaloneThumbnailStudioProps) {
  const [archetypeId, setArchetypeId] = useState<ThumbnailArchetypeId>(defaultArchetypeId);
  const [template, setTemplate] = useState<ThumbnailBrandTemplate>(() => defaultBrandTemplate(channelName));
  const [mode, setMode] = useState<CanvasMode>('thumbnail');
  const [backgroundMode, setBackgroundMode] = useState<'photo' | 'ai'>('photo');
  const [title, setTitle] = useState(() => spec.variants.find(v => v.id === spec.selected)?.headline || '');
  const [subtitle, setSubtitle] = useState(() => spec.variants.find(v => v.id === spec.selected)?.subline || '');
  const [backgroundDataUrl, setBackgroundDataUrl] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentThumbnail[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [qwenReady, setQwenReady] = useState(false);

  const candidates = useMemo(() => spec.variants.map(variant => ({ id: variant.id, title: variant.headline, subtitle: variant.subline })), [spec]);

  useEffect(() => {
    void getBrandTemplate(channelName).then(saved => {
      if (saved) setTemplate(saved);
    });
    void getSetting<RecentThumbnail[]>(RECENT_KEY).then(saved => {
      if (Array.isArray(saved)) setRecent(saved.slice(0, 6));
    });
  }, [channelName]);

  useEffect(() => {
    void getQwenApiKey().then(key => setQwenReady(Boolean(key)));
  }, []);

  useEffect(() => {
    setTitle(spec.variants.find(v => v.id === spec.selected)?.headline || '');
    setSubtitle(spec.variants.find(v => v.id === spec.selected)?.subline || '');
  }, [spec]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const size = SIZES[mode];
      const layers = textLayers(spec, archetypeId, template, title, subtitle);
      const image = backgroundDataUrl ? await loadImage(backgroundDataUrl) : null;
      const canvas = await composeImage({ width: size.width, height: size.height, backgroundImage: image, layers, badge: template.badge, showBadge: Boolean(template.badge.tag || template.badge.icon) });
      if (!cancelled) setPreviewDataUrl(canvas.toDataURL('image/png'));
    })().catch(() => {
      if (!cancelled) setError('미리보기를 만들지 못했습니다.');
    });
    return () => { cancelled = true; };
  }, [archetypeId, backgroundDataUrl, mode, spec, subtitle, template, title]);

  async function loadPhoto(file?: File) {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      setBackgroundDataUrl(await loadUserBackgroundDataUrl(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지를 읽지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function buildAiPrompt() {
    const season = seasonPacks.find(item => item.id === seasonId)?.label || seasonId;
    const archetype = thumbnailArchetypeById[archetypeId]?.labelKo || archetypeId;
    return `16:9 editorial cafe background for ${archetype}, ${season}, warm morning light, refined Japanese kissaten atmosphere, coffee steam, record player detail, clear safe space for title text, natural photographic texture, no words, no letters, no logos, no typography`;
  }

  async function generateBackground() {
    const prompt = buildAiPrompt();
    setAiPrompt(prompt);
    setError('');
    setAiLoading(true);
    try {
      const [qwenKey, geminiKey] = await Promise.all([getQwenApiKey(), getGeminiApiKey()]);
      setQwenReady(Boolean(qwenKey));
      if (!qwenKey && !geminiKey) {
        setError('설정에서 이미지 API 키를 입력하거나 프롬프트를 복사해 외부 이미지 도구에서 생성하세요.');
        return;
      }
      if (qwenKey) {
        const result = await generateQwenImage({ prompt, settings: await getQwenImageSettings(), count: 1 });
        const dataUrl = result.dataUrls[0] || result.imageUrls[0];
        if (!dataUrl) throw new Error('Qwen returned no usable image.');
        setBackgroundDataUrl(dataUrl);
      } else {
        const result = await generateThumbnailImage({ prompt, aspectRatio: mode === 'cover' ? '1:1' : '16:9' });
        setBackgroundDataUrl(result.dataUrl);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI background generation failed.');
    } finally {
      setAiLoading(false);
    }
  }

  async function copyAiPrompt() {
    const prompt = aiPrompt || buildAiPrompt();
    setAiPrompt(prompt);
    await navigator.clipboard?.writeText(prompt);
  }

  async function download() {
    if (!previewDataUrl) return;
    const canvas = await (async () => {
      const image = await loadImage(previewDataUrl);
      const size = SIZES[mode];
      return composeImage({ width: size.width, height: size.height, backgroundImage: image, copyText: '', textStyle: templateStyle(template) });
    })();
    const filename = `${channelName || 'thumbnail'}-${mode}-${Date.now()}.png`;
    await downloadCanvas(canvas, filename);
    const entry: RecentThumbnail = { id: `${Date.now()}`, dataUrl: previewDataUrl, title, subtitle, mode, createdAt: new Date().toISOString() };
    const next = [entry, ...recent.filter(item => item.dataUrl !== entry.dataUrl)].slice(0, 6);
    setRecent(next);
    await setSetting(RECENT_KEY, next);
  }

  function chooseCandidate(candidate: typeof candidates[number]) {
    setTitle(candidate.title);
    setSubtitle(candidate.subtitle);
  }

  return (
    <section className="standalone-thumbnail-studio">
      <div className="standalone-thumbnail-head">
        {qwenReady && <span className="qwen-ready-badge" data-testid="qwen-ready-badge">이미지 생성 준비됨(Qwen)</span>}
        <div>
          <p className="eyebrow">독립 도구</p>
          <h2>썸네일 만들기</h2>
          <p className="supporting">곡을 만들지 않아도 사진과 문구만으로 바로 제작합니다.</p>
        </div>
        <button type="button" onClick={onClose}><RotateCcw size={16} /> 곡 작업으로 돌아가기</button>
      </div>

      <div className="standalone-thumbnail-layout">
        <div className="standalone-thumbnail-controls">
          <div className="standalone-thumbnail-step">
            <span className="standalone-step-number">1</span>
            <div>
              <h3>사진 올리기</h3>
              <div className="thumbnail-source-tabs" role="tablist" aria-label="Background source">
                <button type="button" className={backgroundMode === 'photo' ? 'active' : ''} onClick={() => setBackgroundMode('photo')}><Upload size={15} /> Upload photo</button>
                <button type="button" className={backgroundMode === 'ai' ? 'active' : ''} onClick={() => setBackgroundMode('ai')}><Sparkles size={15} /> Generate with AI</button>
              </div>
              {backgroundMode === 'photo' ? <label
                className="thumbnail-dropzone"
                onDragOver={event => event.preventDefault()}
                onDrop={event => { event.preventDefault(); void loadPhoto(event.dataTransfer.files[0]); }}
              >
                <ImagePlus size={34} />
                <strong>여기에 사진을 끌어다 놓으세요</strong>
                <span>또는 파일 선택</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void loadPhoto(event.target.files?.[0]); event.target.value = ''; }} />
              </label> : <div className="thumbnail-ai-source">
                <p className="supporting">Season and archetype create the background prompt. Text is composited locally after generation.</p>
                <button type="button" className="primary" disabled={aiLoading} onClick={() => void generateBackground()}><Sparkles size={17} /> {aiLoading ? 'Generating...' : 'Generate AI background'}</button>
                {aiPrompt && <label>Generated prompt<textarea value={aiPrompt} readOnly rows={4} /></label>}
                <button type="button" className="secondary" onClick={() => void copyAiPrompt()}><Copy size={15} /> Copy prompt</button>
              </div>}
              {loading && <p className="supporting">사진을 불러오는 중...</p>}
              {error && <div className="error thumbnail-settings-warning"><span>{error}</span>{onOpenSettings && <button type="button" className="secondary" onClick={onOpenSettings}>Qwen 설정 열기</button>}</div>}
            </div>
          </div>

          <div className="standalone-thumbnail-step">
            <span className="standalone-step-number">2</span>
            <div className="standalone-thumbnail-copy">
              <h3>문구 입력</h3>
              <div className="thumbnail-copy-candidates">
                {candidates.map(candidate => <button key={candidate.id} type="button" onClick={() => chooseCandidate(candidate)}>후보 {candidate.id}</button>)}
              </div>
              <label>메인 제목<input value={title} onChange={event => setTitle(event.target.value)} placeholder="메인 제목" /></label>
              <label>부제<input value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="부제" /></label>
              <div className="thumbnail-format-toggle" role="group" aria-label="미리보기 비율">
                {(Object.keys(SIZES) as CanvasMode[]).map(nextMode => <button key={nextMode} type="button" className={mode === nextMode ? 'active' : ''} onClick={() => setMode(nextMode)}>{SIZES[nextMode].label}</button>)}
              </div>
            </div>
          </div>

          <details open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)} className="standalone-advanced">
            <summary>세부 조정</summary>
            <div className="thumbnail-control-grid">
              <label>계절<select value={seasonId} onChange={event => onSeasonChange(event.target.value)}>{seasonPacks.map(season => <option key={season.id} value={season.id}>{season.label}</option>)}</select></label>
              <label>배경 스타일<select value={archetypeId} onChange={event => setArchetypeId(event.target.value as ThumbnailArchetypeId)}>{thumbnailArchetypes.map(archetype => <option key={archetype.id} value={archetype.id}>{archetype.labelKo}</option>)}</select></label>
              <label>폰트<select value={template.fontId} onChange={event => setTemplate(prev => ({ ...prev, fontId: event.target.value as ThumbnailBrandTemplate['fontId'] }))}><option value="blackHanSans">Black Han Sans</option><option value="doHyeon">Do Hyeon</option><option value="jua">Jua</option><option value="gowunDodum">Gowun Dodum</option></select></label>
              <label>문구 위치<select value={template.position} onChange={event => setTemplate(prev => ({ ...prev, position: event.target.value as ThumbnailBrandTemplate['position'] }))}><option value="bottom-center">아래 중앙</option><option value="center">중앙</option><option value="top-center">위 중앙</option></select></label>
              <label>문구 색<input type="color" value={template.textColor} onChange={event => setTemplate(prev => ({ ...prev, textColor: event.target.value }))} /></label>
              <label>그림자 색<input type="color" value={template.shadowColor} onChange={event => setTemplate(prev => ({ ...prev, shadowColor: event.target.value }))} /></label>
            </div>
          </details>

          <div className="standalone-thumbnail-step standalone-download-step">
            <span className="standalone-step-number">3</span>
            <div><h3>다운로드</h3><button type="button" className="primary standalone-download-button" disabled={!previewDataUrl} onClick={() => void download()}><Download size={18} /> {SIZES[mode].label} PNG 다운로드</button></div>
          </div>
        </div>

        <div className="standalone-thumbnail-preview-column">
          <div className="standalone-preview-label"><strong>실시간 미리보기</strong><span>{SIZES[mode].label}</span></div>
          <div className={`standalone-thumbnail-preview ${mode === 'cover' ? 'square' : ''}`}>{previewDataUrl ? <img src={previewDataUrl} alt="썸네일 실시간 미리보기" /> : <span>사진을 올리면 결과가 여기에 표시됩니다.</span>}</div>
          {recent.length > 0 && <div className="standalone-recent"><h3>최근 만든 썸네일</h3><div className="standalone-recent-grid">{recent.map(item => <button key={item.id} type="button" title="최근 썸네일 다시 불러오기" onClick={() => { setTitle(item.title); setSubtitle(item.subtitle); setMode(item.mode); setPreviewDataUrl(item.dataUrl); }}><img src={item.dataUrl} alt={item.title || '최근 썸네일'} /></button>)}</div></div>}
        </div>
      </div>
    </section>
  );
}
