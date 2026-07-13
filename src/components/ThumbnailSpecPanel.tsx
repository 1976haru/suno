import { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { copyText } from '../utils/exporters';
import { RECOMMENDATION_BADGE, STAGE_ADVICE } from '../core/apiAdvisor';
import type { ThumbnailSpec } from '../core/thumbnailSpec';
import { composeThumbnailPromptSet } from '../core/thumbnailPromptComposer';
import { thumbnailArchetypes } from '../data/thumbnailArchetypes';
import type {
  ThumbnailArchetypeId,
  ThumbnailPeopleMode,
  ThumbnailTextSafeZone,
  ThumbnailTimeOfDay
} from '../data/thumbnailArchetypes';
import { seasonPacks } from '../data/presets';
import type { ThumbnailVariantId } from '../types';

interface ThumbnailSpecPanelProps {
  spec: ThumbnailSpec;
  defaultSeasonId: string;
  onRegenerateHeadline: () => void;
  onSelectVariant: (id: ThumbnailVariantId) => void;
}

type ImageTool = 'generic' | 'midjourney' | 'stableDiffusion';

const IMAGE_TOOL_LABELS: Record<ImageTool, string> = {
  generic: 'Generic',
  midjourney: 'Midjourney',
  stableDiffusion: 'Stable Diffusion'
};

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

const TEXT_ZONE_LABELS: Record<ThumbnailTextSafeZone, string> = {
  left: 'Left',
  right: 'Right',
  top: 'Top'
};

const TIME_OPTIONS = Object.keys(TIME_LABELS) as ThumbnailTimeOfDay[];
const PEOPLE_OPTIONS = Object.keys(PEOPLE_LABELS) as ThumbnailPeopleMode[];
const TEXT_ZONE_OPTIONS = Object.keys(TEXT_ZONE_LABELS) as ThumbnailTextSafeZone[];

export default function ThumbnailSpecPanel({
  spec,
  defaultSeasonId,
  onRegenerateHeadline,
  onSelectVariant
}: ThumbnailSpecPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [imageTool, setImageTool] = useState<ImageTool>('generic');
  const [archetypeId, setArchetypeId] = useState<ThumbnailArchetypeId>('refined-cafe');
  const [promptSeasonId, setPromptSeasonId] = useState(defaultSeasonId);
  const [timeOfDay, setTimeOfDay] = useState<ThumbnailTimeOfDay>('morning');
  const [peopleMode, setPeopleMode] = useState<ThumbnailPeopleMode>('none');
  const [textSafeZone, setTextSafeZone] = useState<ThumbnailTextSafeZone>('left');
  const [promptSeed, setPromptSeed] = useState(0);

  useEffect(() => {
    setPromptSeasonId(defaultSeasonId);
  }, [defaultSeasonId]);

  const promptSet = useMemo(
    () => composeThumbnailPromptSet({
      archetypeId,
      seasonId: promptSeasonId,
      timeOfDay,
      peopleMode,
      textSafeZone,
      seed: promptSeed,
      resolution: '1280x720'
    }),
    [archetypeId, peopleMode, promptSeasonId, promptSeed, textSafeZone, timeOfDay]
  );

  const selectedVariant = spec.variants.find(v => v.id === spec.selected) ?? spec.variants[0];
  const activeImagePrompt = spec.imagePromptVariants[imageTool];

  async function handleCopy(field: string, text: string) {
    await copyText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 1500);
  }

  const fullSpecText = [
    ...spec.variants.map(v => `${v.id} (${v.angle})${v.id === spec.selected ? ' [selected]' : ''}: ${v.headline.replace('\n', ' / ')} / ${v.subline}`),
    `Colors: background ${spec.colorScheme.background}, accent ${spec.colorScheme.accent}, text ${spec.colorScheme.text}`,
    `Objects: ${spec.objects.join(', ')}`,
    `Composition: ${spec.composition}`,
    `Forbidden: ${spec.forbidden.join(' / ')}`,
    `Image prompt: ${spec.imagePrompt}`
  ].join('\n');

  const archetypePromptBundle = promptSet.variants.map(variant => `[${variant.id}] ${variant.prompt}`).join('\n\n');

  return (
    <section className="thumbnail-spec">
      <p className="step-hint">
        썸네일 문구 A/B/C와 별도로, 저작권 불확실한 참고 이미지는 표시하지 않고 추상화된 아키타입 프롬프트만 생성합니다.
      </p>

      <div className="thumbnail-variant-grid">
        {spec.variants.map(variant => (
          <label key={variant.id} className={variant.id === spec.selected ? 'thumbnail-variant-card active' : 'thumbnail-variant-card'}>
            <div className="thumbnail-variant-head">
              <input
                type="radio"
                name="thumbnail-variant"
                checked={variant.id === spec.selected}
                onChange={() => onSelectVariant(variant.id)}
              />
              <span>{variant.id} · {variant.angle}</span>
            </div>
            <div className="thumbnail-preview thumbnail-preview-small" style={{ background: spec.colorScheme.background, color: spec.colorScheme.text }}>
              <div className="thumbnail-preview-text">
                {variant.headline.split('\n').map((line, i) => (
                  <div key={i} className="thumbnail-preview-headline">{line}</div>
                ))}
                <div className="thumbnail-preview-subline" style={{ color: spec.colorScheme.accent }}>{variant.subline}</div>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="signature-grid">
        <div>
          <b>Colors</b>
          <span className="thumbnail-swatches">
            <span className="thumbnail-swatch" style={{ background: spec.colorScheme.background }} title={spec.colorScheme.background} />
            <span className="thumbnail-swatch" style={{ background: spec.colorScheme.accent }} title={spec.colorScheme.accent} />
            <span className="thumbnail-swatch" style={{ background: spec.colorScheme.text }} title={spec.colorScheme.text} />
            {spec.colorScheme.background} · {spec.colorScheme.accent} · {spec.colorScheme.text}
          </span>
        </div>
        <div><b>Objects</b><span>{spec.objects.join(' · ')}</span></div>
        <div style={{ gridColumn: '1 / -1' }}><b>Composition</b><span>{spec.composition}</span></div>
        <div style={{ gridColumn: '1 / -1' }}><b>Forbidden</b><span>{spec.forbidden.join(' · ')}</span></div>
      </div>

      <div className="copy-block">
        <div className="copy-head">
          <h4>Legacy image prompt</h4>
          <button type="button" onClick={() => void handleCopy('imagePrompt', activeImagePrompt)}>
            <Copy size={15} />
            {copiedField === 'imagePrompt' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="tab-row">
          {(Object.keys(IMAGE_TOOL_LABELS) as ImageTool[]).map(tool => (
            <button
              key={tool}
              type="button"
              className={imageTool === tool ? 'tab active' : 'tab'}
              onClick={() => setImageTool(tool)}
            >
              {IMAGE_TOOL_LABELS[tool]}
            </button>
          ))}
        </div>
        <pre>{activeImagePrompt}</pre>
      </div>

      <div className="thumbnail-archetype-panel">
        <div className="copy-head">
          <h4>Thumbnail archetype prompt library</h4>
          <div className="button-row">
            <button type="button" onClick={() => setPromptSeed(seed => seed + 1)}>
              <RefreshCw size={15} />
              New A/B/C
            </button>
            <button type="button" onClick={() => void handleCopy('archetypeAll', archetypePromptBundle)}>
              <Copy size={15} />
              {copiedField === 'archetypeAll' ? 'Copied' : 'Copy all'}
            </button>
          </div>
        </div>

        <div className="thumbnail-control-grid">
          <label>
            Archetype
            <select value={archetypeId} onChange={event => setArchetypeId(event.target.value as ThumbnailArchetypeId)}>
              {thumbnailArchetypes.map(archetype => (
                <option key={archetype.id} value={archetype.id}>{archetype.labelKo}</option>
              ))}
            </select>
          </label>
          <label>
            Season
            <select value={promptSeasonId} onChange={event => setPromptSeasonId(event.target.value)}>
              {seasonPacks.map(season => (
                <option key={season.id} value={season.id}>{season.label}</option>
              ))}
            </select>
          </label>
          <label>
            Time
            <select value={timeOfDay} onChange={event => setTimeOfDay(event.target.value as ThumbnailTimeOfDay)}>
              {TIME_OPTIONS.map(option => <option key={option} value={option}>{TIME_LABELS[option]}</option>)}
            </select>
          </label>
          <label>
            People
            <select value={peopleMode} onChange={event => setPeopleMode(event.target.value as ThumbnailPeopleMode)}>
              {PEOPLE_OPTIONS.map(option => <option key={option} value={option}>{PEOPLE_LABELS[option]}</option>)}
            </select>
          </label>
          <label>
            Text safe zone
            <select value={textSafeZone} onChange={event => setTextSafeZone(event.target.value as ThumbnailTextSafeZone)}>
              {TEXT_ZONE_OPTIONS.map(option => <option key={option} value={option}>{TEXT_ZONE_LABELS[option]}</option>)}
            </select>
          </label>
        </div>

        <div className="thumbnail-prompt-grid">
          {promptSet.variants.map(variant => (
            <article key={variant.id} className="thumbnail-prompt-card">
              <div className="copy-head">
                <h4>{variant.id} composition</h4>
                <button type="button" onClick={() => void handleCopy(`archetype-${variant.id}`, variant.prompt)}>
                  <Copy size={15} />
                  {copiedField === `archetype-${variant.id}` ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="thumbnail-axis-list">
                <span><b>Subject</b>{variant.subject}</span>
                <span><b>Setting</b>{variant.setting}</span>
                <span><b>Light</b>{variant.lighting}</span>
                <span><b>Color</b>{variant.palette}</span>
                <span><b>Camera</b>{variant.camera}</span>
                <span><b>Zone</b>{variant.textSafeZone}</span>
              </div>
              <pre>{variant.prompt}</pre>
            </article>
          ))}
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => void handleCopy('headline', `${selectedVariant.headline.replace('\n', ' ')} / ${selectedVariant.subline}`)}>
          <Copy size={16} />
          {copiedField === 'headline' ? 'Copied' : `Copy selected ${spec.selected} text`}
        </button>
        <button type="button" onClick={() => void handleCopy('full', fullSpecText)}>
          <Copy size={16} />
          {copiedField === 'full' ? 'Copied' : 'Copy full spec'}
        </button>
        <button type="button" onClick={onRegenerateHeadline}>
          <RefreshCw size={16} />
          Regenerate title copy
        </button>
      </div>
      <p className="supporting api-advice-line">
        {RECOMMENDATION_BADGE[STAGE_ADVICE.thumbnailCopy.recommendation].emoji} {RECOMMENDATION_BADGE[STAGE_ADVICE.thumbnailCopy.recommendation].labelKo} ({STAGE_ADVICE.thumbnailCopy.suggestedModelKo}): {STAGE_ADVICE.thumbnailCopy.reasonKo}
      </p>
    </section>
  );
}
