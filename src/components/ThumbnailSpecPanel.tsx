import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, RefreshCw, Sparkles } from 'lucide-react';
import { copyText, downloadText } from '../utils/exporters';
import { RECOMMENDATION_BADGE, STAGE_ADVICE } from '../core/apiAdvisor';
import { recommendThumbnailCopyLocal } from '../core/conceptAgent';
import { COMMON_NEGATIVE_BLOCK } from '../core/thumbnailPromptBlocks';
import { generateQwenImage, getQwenApiKey, getQwenImageSettings, type GeneratedQwenImage } from '../core/thumbnailImageGen';
import { buildCoverImagePromptVariants, buildPortraitImagePromptVariants, buildThumbnailSpec, type ThumbnailSpec } from '../core/thumbnailSpec';
import { buildThumbnailWorksetMarkdown, thumbnailMotionGuideText } from '../core/thumbnailWorksetExport';
import { composeThumbnailPromptSet, type ThumbnailPromptMode } from '../core/thumbnailPromptComposer';
import { listSetGroups, loadPack, type SetGroupSummary } from '../core/library';
import { buildSetName } from '../utils/setNaming';
import { recordUsage } from '../core/usageLedger';
import { DEFAULT_QWEN_IMAGE_SETTINGS, estimateQwenImageCostCny, type QwenImageSettings } from '../core/qwenImageSettings';
import { thumbnailArchetypesForArchetype } from '../data/thumbnailArchetypes';
import type {
  ThumbnailArchetypeId,
  ThumbnailPeopleMode,
  ThumbnailTextSafeZone,
  ThumbnailTimeOfDay
} from '../data/thumbnailArchetypes';
import { seasonPacks } from '../data/presets';
import type { ChannelArchetype, DisplayLanguage, SavedPack, ThumbnailVariantId } from '../types';

interface ThumbnailSpecPanelProps {
  spec: ThumbnailSpec;
  defaultSeasonId: string;
  selectedArchetypeId: ThumbnailArchetypeId;
  packagingLanguage: DisplayLanguage;
  /** TASK v3.37-b (work item 1) — GenerationOptions.customConcept for the pack currently in the editor; threaded through to both prompt builders. Empty string is a full no-op. */
  customConcept: string;
  /** TASK B2 (§6-3) — see ThumbnailImageStudioPanelProps's own doc comment. */
  channelArchetype?: ChannelArchetype;
  onSelectArchetype: (id: ThumbnailArchetypeId) => void;
  onRegenerateHeadline: () => void;
  onSelectVariant: (id: ThumbnailVariantId) => void;
  onApplyFreeTextHeadlines: (suggestions: { headline: string; angle: string }[]) => void;
}

type ImageTool = 'generic' | 'midjourney' | 'qwenImage' | 'stableDiffusion';

const IMAGE_TOOL_LABELS: Record<ImageTool, string> = {
  generic: 'Generic (ChatGPT/DALL-E)',
  midjourney: 'Midjourney',
  qwenImage: 'Qwen Image',
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

// TASK v3.38 Part A1 — the left-third-for-text layout is now fixed for
// every seasonal archetype, so this is a single-entry display label rather
// than a user choice.
const TEXT_ZONE_LABELS: Record<ThumbnailTextSafeZone, string> = {
  'left-third': 'Left third (fixed)'
};

const TIME_OPTIONS = Object.keys(TIME_LABELS) as ThumbnailTimeOfDay[];
const PEOPLE_OPTIONS = Object.keys(PEOPLE_LABELS) as ThumbnailPeopleMode[];
const TEXT_ZONE_OPTIONS = Object.keys(TEXT_ZONE_LABELS) as ThumbnailTextSafeZone[];
const IMAGE_TOOLS = Object.keys(IMAGE_TOOL_LABELS) as ImageTool[];

function compositionGuideText(spec: ThumbnailSpec): string {
  const selected = spec.variants.find(variant => variant.id === spec.selected) ?? spec.variants[0];
  const guide = spec.compositionGuide ?? {
    topSubcaption: '감성으로 듣는',
    mainPhrase: selected?.headline.replace('\n', ' ') || 'Playlist',
    subtitle: '감성 플레이리스트',
    bottomBrandLine: 'PLAYLIST',
    textColor: spec.colorScheme.text,
    shadowColor: 'rgba(0,0,0,0.45)',
    playerOverlay: false
  };
  return [
    `Top subcaption: ${guide.topSubcaption}`,
    `Main phrase: ${guide.mainPhrase}`,
    `Subtitle: ${guide.subtitle}`,
    `Bottom brand line: ${guide.bottomBrandLine}`,
    `Text color: ${guide.textColor}`,
    `Shadow color: ${guide.shadowColor}`,
    `Player UI overlay: ${guide.playerOverlay ? 'yes' : 'no'}`
  ].join('\n');
}

function promptBlocks(title: string, prompts: ThumbnailSpec['imagePromptVariants']): string[] {
  return IMAGE_TOOLS.flatMap(tool => [
    `**${title} - ${IMAGE_TOOL_LABELS[tool]}**`,
    '```',
    prompts[tool],
    '```',
    ''
  ]);
}

function primaryGeneratedImage(result: GeneratedQwenImage | null): string {
  return result?.dataUrls[0] || result?.imageUrls[0] || '';
}

export default function ThumbnailSpecPanel({
  spec,
  defaultSeasonId,
  selectedArchetypeId,
  packagingLanguage,
  customConcept,
  channelArchetype,
  onSelectArchetype,
  onRegenerateHeadline,
  onSelectVariant,
  onApplyFreeTextHeadlines
}: ThumbnailSpecPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [imageTool, setImageTool] = useState<ImageTool>('generic');
  const [promptSeasonId, setPromptSeasonId] = useState(defaultSeasonId);
  const [timeOfDay, setTimeOfDay] = useState<ThumbnailTimeOfDay>('morning');
  const [peopleMode, setPeopleMode] = useState<ThumbnailPeopleMode>('none');
  const [textSafeZone, setTextSafeZone] = useState<ThumbnailTextSafeZone>('left-third');
  const [promptSeed, setPromptSeed] = useState(0);
  const [promptMode, setPromptMode] = useState<ThumbnailPromptMode>('thumbnail');
  const [coverSeed, setCoverSeed] = useState(0);
  const [copyFreeText, setCopyFreeText] = useState('');
  const [setGroups, setSetGroups] = useState<SetGroupSummary[]>([]);
  const [selectedExportGroupId, setSelectedExportGroupId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [qwenApiKey, setQwenApiKey] = useState('');
  const [qwenSettings, setQwenSettings] = useState<QwenImageSettings>(DEFAULT_QWEN_IMAGE_SETTINGS);
  const [qwenSessionCount, setQwenSessionCount] = useState(0);
  const [qwenGenerating, setQwenGenerating] = useState(false);
  const [qwenBatchGenerating, setQwenBatchGenerating] = useState(false);
  const [qwenError, setQwenError] = useState('');
  const [qwenResult, setQwenResult] = useState<GeneratedQwenImage | null>(null);
  const [qwenBatchResults, setQwenBatchResults] = useState<{ label: string; href: string }[]>([]);

  useEffect(() => {
    setPromptSeasonId(defaultSeasonId);
  }, [defaultSeasonId]);

  useEffect(() => {
    void listSetGroups().then(groups => {
      setSetGroups(groups);
      setSelectedExportGroupId(prev => prev || groups[0]?.groupId || '');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getQwenApiKey(), getQwenImageSettings()]).then(([key, settings]) => {
      if (cancelled) return;
      setQwenApiKey(key || '');
      setQwenSettings(settings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const promptSet = useMemo(
    () => composeThumbnailPromptSet({
      archetypeId: selectedArchetypeId,
      seasonId: promptSeasonId,
      timeOfDay,
      peopleMode,
      textSafeZone,
      seed: promptSeed,
      mode: promptMode,
      resolution: promptMode === 'cover' ? '3000x3000' : promptMode === 'portrait' ? '2400x3000' : '1280x720',
      concept: customConcept
    }),
    [selectedArchetypeId, peopleMode, promptSeasonId, promptSeed, promptMode, textSafeZone, timeOfDay, customConcept]
  );

  // TASK v3.37-b (work item 2) — the legacy 16:9 Generic/Midjourney/Stable
  // Diffusion prompts stay pack-bound (spec.imagePromptVariants, unchanged),
  // but cover mode is independently regenerable via its own seed so cycling
  // it never reshuffles the 16:9 prompts above.
  const coverImagePromptVariants = useMemo(
    () => buildCoverImagePromptVariants(promptSeasonId, selectedArchetypeId, coverSeed, customConcept),
    [promptSeasonId, selectedArchetypeId, coverSeed, customConcept]
  );

  const selectedVariant = spec.variants.find(v => v.id === spec.selected) ?? spec.variants[0];
  const activeImagePrompt = spec.imagePromptVariants[imageTool] ?? spec.imagePromptVariants.generic;
  const activeCoverPrompt = coverImagePromptVariants[imageTool] ?? coverImagePromptVariants.generic;

  async function handleCopy(field: string, text: string) {
    await copyText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 1500);
  }

  // TASK H6 (v3.10) — free-text seed for headline copy; coexists with (never
  // replaces) the season/emotion/audience A/B/C strategy above. Applying a
  // suggestion just overwrites variants[].headline/angle, same shape as the
  // default strategy, so everything else (colors/objects/composition) is untouched.
  function handleApplyCopyFreeText() {
    if (!copyFreeText.trim()) return;
    const suggestions = recommendThumbnailCopyLocal(copyFreeText, packagingLanguage);
    onApplyFreeTextHeadlines(suggestions);
  }

  async function refreshQwenConfig() {
    const [key, settings] = await Promise.all([getQwenApiKey(), getQwenImageSettings()]);
    setQwenApiKey(key || '');
    setQwenSettings(settings);
    return { key: key || '', settings };
  }

  function confirmQwenSessionLimit(count: number, settings: QwenImageSettings) {
    if (qwenSessionCount + count <= settings.sessionLimit) return true;
    return window.confirm(`This will bring the current session to ${qwenSessionCount + count} Qwen images, above the configured limit of ${settings.sessionLimit}. Continue?`);
  }

  async function recordQwenImageUsage(result: GeneratedQwenImage) {
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
  }

  async function handleGenerateQwenBackground() {
    const { key, settings } = await refreshQwenConfig();
    setQwenError('');
    if (!key) {
      setQwenError('Set a Qwen API key in Settings, or keep using prompt copy with an external image tool.');
      return;
    }
    if (!confirmQwenSessionLimit(1, settings)) return;

    setQwenGenerating(true);
    try {
      const result = await generateQwenImage({
        prompt: spec.imagePromptVariants.qwenImage ?? spec.imagePromptVariants.generic,
        negativePrompt: COMMON_NEGATIVE_BLOCK,
        settings,
        count: 1
      });
      setQwenResult(result);
      setQwenSessionCount(count => count + result.imageCount);
      await recordQwenImageUsage(result);
    } catch (error) {
      setQwenError(error instanceof Error ? error.message : String(error));
    } finally {
      setQwenGenerating(false);
    }
  }

  async function generateSetGroupBackgrounds(groupId: string) {
    const group = setGroups.find(g => g.groupId === groupId);
    if (!group || !group.packs.length) return;
    const { key, settings } = await refreshQwenConfig();
    setQwenError('');
    if (!key) {
      setQwenError('Set a Qwen API key in Settings before generating set backgrounds.');
      return;
    }
    if (!confirmQwenSessionLimit(group.packs.length, settings)) return;

    setQwenBatchGenerating(true);
    setQwenBatchResults([]);
    try {
      const nextResults: { label: string; href: string }[] = [];
      for (const meta of group.packs) {
        const pack = await loadPack(meta.id);
        if (!pack) continue;
        const season = seasonPacks.find(s => s.id === pack.options.seasonId) ?? seasonPacks[0];
        const packSpec = buildThumbnailSpec(pack.blueprint, pack.options, season, pack.options.channel, 0, selectedArchetypeId);
        const result = await generateQwenImage({
          prompt: packSpec.imagePromptVariants.qwenImage ?? packSpec.imagePromptVariants.generic,
          negativePrompt: COMMON_NEGATIVE_BLOCK,
          settings,
          count: 1
        });
        await recordQwenImageUsage(result);
        setQwenSessionCount(count => count + result.imageCount);
        const href = primaryGeneratedImage(result);
        nextResults.push({
          label: `${meta.setIndex != null ? `Set ${meta.setIndex}` : pack.projectTitle} - ${pack.projectTitle}`,
          href
        });
        setQwenBatchResults([...nextResults]);
      }
    } catch (error) {
      setQwenError(error instanceof Error ? error.message : String(error));
    } finally {
      setQwenBatchGenerating(false);
    }
  }

  /**
   * TASK v3.37-b (work item 5) — one .md per set group: each set's own
   * saved GenerationOptions (season/customConcept/channel) rebuilds its own
   * thumbnailSpec on the fly, since multi-set runs don't pre-build one (see
   * usePackLibrary.saveGeneratedSet) — so this is also what actually proves
   * work item 1's "differing concepts -> differing prompts" per set.
   */
  async function exportSetGroupPrompts(groupId: string) {
    const group = setGroups.find(g => g.groupId === groupId);
    if (!group || !group.packs.length) return;
    setExporting(true);
    try {
      const sections: string[] = [];
      const packs: SavedPack[] = [];
      for (const meta of group.packs) {
        const pack = await loadPack(meta.id);
        if (!pack) continue;
        packs.push(pack);
        const season = seasonPacks.find(s => s.id === pack.options.seasonId) ?? seasonPacks[0];
        const packSpec = buildThumbnailSpec(pack.blueprint, pack.options, season, pack.options.channel, 0, selectedArchetypeId);
        const portrait = buildPortraitImagePromptVariants(season.id, selectedArchetypeId, meta.setIndex ?? 0, pack.options.customConcept);
        const cover = buildCoverImagePromptVariants(season.id, selectedArchetypeId, meta.setIndex ?? 0, pack.options.customConcept);
        const selected = packSpec.variants.find(v => v.id === packSpec.selected) ?? packSpec.variants[0];
        sections.push([
          `## ${pack.projectTitle}`,
          '',
          `**선택 문구 (${selected.id} · ${selected.angle})**`,
          `${selected.headline.replace('\n', ' / ')} / ${selected.subline}`,
          '',
          '**Composition guide**',
          '```',
          compositionGuideText(packSpec),
          '```',
          '',
          ...promptBlocks('Thumbnail 16:9 prompt', packSpec.imagePromptVariants),
          ...promptBlocks('Portrait 4:5 prompt', portrait),
          ...promptBlocks('Cover 1:1 prompt', cover),
          '**썸네일(16:9) 프롬프트 — Generic**',
          '```',
          packSpec.imagePromptVariants.generic,
          '```',
          '',
          '**썸네일(16:9) 프롬프트 — Midjourney**',
          '```',
          packSpec.imagePromptVariants.midjourney,
          '```',
          '',
          '**커버(1:1) 프롬프트 — Generic**',
          '```',
          cover.generic,
          '```',
          '',
          '**커버(1:1) 프롬프트 — Midjourney**',
          '```',
          cover.midjourney,
          '```'
        ].join('\n'));
      }
      const content = buildThumbnailWorksetMarkdown({
        groupLabel: group.label,
        packs,
        archetypeId: selectedArchetypeId
      });
      // TASK v3.69 (TASK B) — same shared filename scheme (utils/setNaming.ts)
      // as every other set-level export, instead of this panel's own raw
      // groupId, so a thumbnail workset can be traced back to the same set
      // as its lyrics file/standalone export/SRT zip.
      const firstPack = group.packs[0];
      const setName = firstPack
        ? buildSetName({
            date: new Date(firstPack.savedAt),
            channelLabel: firstPack.channelName,
            conceptLabel: firstPack.projectTitle.replace(/ Set \d+$/, '')
          })
        : group.groupId;
      downloadText(`${setName}_썸네일.md`, content, 'text/markdown;charset=utf-8');
    } finally {
      setExporting(false);
    }
  }

  const fullSpecText = [
    ...spec.variants.map(v => `${v.id} (${v.angle})${v.id === spec.selected ? ' [selected]' : ''}: ${v.headline.replace('\n', ' / ')} / ${v.subline}`),
    `Colors: background ${spec.colorScheme.background}, accent ${spec.colorScheme.accent}, text ${spec.colorScheme.text}`,
    `Objects: ${spec.objects.join(', ')}`,
    `Composition: ${spec.composition}`,
    `Composition guide:\n${compositionGuideText(spec)}`,
    `Motion guide:\n${thumbnailMotionGuideText(spec)}`,
    `Forbidden: ${spec.forbidden.join(' / ')}`,
    `Image prompt: ${spec.imagePrompt}`,
    `Qwen image prompt: ${spec.imagePromptVariants.qwenImage ?? spec.imagePromptVariants.generic}`,
    `Stable Diffusion prompt: ${spec.imagePromptVariants.stableDiffusion}`
  ].join('\n');

  const archetypePromptBundle = promptSet.variants.map(variant => `[${variant.id}] ${variant.prompt}`).join('\n\n');

  return (
    <section className="thumbnail-spec">
      <p className="step-hint">
        썸네일 문구 A/B/C와 별도로, 저작권 불확실한 참고 이미지는 표시하지 않고 추상화된 아키타입 프롬프트만 생성합니다.
      </p>
      <p className="step-hint">
        이미지는 문구 없이 생성됩니다. 받은 이미지에 문구를 얹어 완성하세요(한글은 AI 이미지 생성기가 정확히 그리지 못합니다).
      </p>

      <div className="option-block concept-agent-panel">
        <h3>💬 썸네일에 어떤 말을 담고 싶으세요?</h3>
        <p className="supporting">&ldquo;어디선가 들어본 적 있는 노래&rdquo;처럼 적어보세요. (선택 사항 — 비워두면 아래 기본 A/B/C를 그대로 씁니다)</p>
        <div className="concept-agent-input-row">
          <input
            value={copyFreeText}
            onChange={event => setCopyFreeText(event.target.value)}
            placeholder="예: 그 노래 어디선가 들어본 적 있다"
            onKeyDown={event => {
              if (event.key === 'Enter') handleApplyCopyFreeText();
            }}
          />
          <button type="button" className="primary" disabled={!copyFreeText.trim()} onClick={handleApplyCopyFreeText}>
            <Sparkles size={16} />
            문구 추천받기
          </button>
        </div>
      </div>

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
            <div className="thumbnail-preview thumbnail-preview-small thumbnail-preview-left-third" style={{ background: spec.colorScheme.background, color: spec.colorScheme.text }}>
              <div className="thumbnail-preview-text thumbnail-preview-serif">
                {variant.headline.split('\n').map((line, i) => (
                  <div key={i} className="thumbnail-preview-headline">{line}</div>
                ))}
                {spec.typography.divider && <div className="thumbnail-preview-divider" style={{ background: spec.colorScheme.text }} />}
                {spec.typography.subtitle && <div className="thumbnail-preview-subline">{variant.subline}</div>}
              </div>
            </div>
          </label>
        ))}
      </div>
      <p className="step-hint">
        왼쪽 1/3은 문구·구분선·부제 자리, 오른쪽 2/3은 장면입니다. 텍스트는 얇은 세리프, 아웃라인 없이, 밝은 배경엔 다크브라운·어두운 배경엔 흰색을 사용하세요. 커버(1:1)에는 부제·구분선을 생략하고 메인 문구 한 줄만 정중앙에 두는 것을 기본으로 합니다.
      </p>

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
        <div>
          <b>Typography</b>
          <span>{spec.typography.font} · {spec.typography.color} · outline: {spec.typography.outline} · shadow: {spec.typography.shadow}</span>
        </div>
        <div style={{ gridColumn: '1 / -1' }}><b>Composition guide</b><span>{compositionGuideText(spec).replace(/\n/g, ' 쨌 ')}</span></div>
        <div style={{ gridColumn: '1 / -1' }}><b>Motion guide</b><span>{thumbnailMotionGuideText(spec).replace(/\n/g, ' | ')}</span></div>
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
          {IMAGE_TOOLS.map(tool => (
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
        <div className="thumbnail-image-studio">
          <div className="button-row">
            <button
              type="button"
              className="primary"
              disabled={qwenGenerating || !qwenApiKey}
              onClick={() => void handleGenerateQwenBackground()}
            >
              <Sparkles size={15} />
              {qwenGenerating ? 'Generating...' : 'Generate with Qwen'}
            </button>
            <button type="button" onClick={() => void refreshQwenConfig()}>
              <RefreshCw size={15} />
              Refresh Qwen settings
            </button>
            <span className="supporting">
              {qwenSettings.model} / {qwenSettings.resolution} / est. {estimateQwenImageCostCny(qwenSettings.model, 1, qwenSettings.region).toFixed(6)} CNY
            </span>
          </div>
          {!qwenApiKey && (
            <p className="supporting">Qwen key is not set. Copy the prompt above for external tools, or add byok:qwen in Settings to enable in-app generation.</p>
          )}
          {qwenError && <p className="error">{qwenError}</p>}
          {primaryGeneratedImage(qwenResult) && (
            <div className="thumbnail-image-target">
              <img className="thumbnail-bg-preview" src={primaryGeneratedImage(qwenResult)} alt="Generated Qwen background preview" />
              <div className="button-row">
                <a className="button-like" href={primaryGeneratedImage(qwenResult)} download={`qwen-background-${Date.now()}.png`}>
                  <Download size={15} />
                  Download
                </a>
                {qwenResult?.imageUrls[0] && (
                  <button type="button" onClick={() => void handleCopy('qwenImageUrl', qwenResult.imageUrls[0])}>
                    <Copy size={15} />
                    {copiedField === 'qwenImageUrl' ? 'Copied' : 'Copy URL'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="copy-block">
        <div className="copy-head">
          <h4>Cover image prompt (1:1)</h4>
          <div className="button-row">
            <button type="button" onClick={() => setCoverSeed(seed => seed + 1)}>
              <RefreshCw size={15} />
              New cover
            </button>
            <button type="button" onClick={() => void handleCopy('coverPrompt', activeCoverPrompt)}>
              <Copy size={15} />
              {copiedField === 'coverPrompt' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <p className="supporting">썸네일(16:9)과 독립적으로 생성·복사됩니다. 같은 아키타입/시즌을 쓰지만 여백은 중앙·하단 기준입니다.</p>
        <div className="tab-row">
          {IMAGE_TOOLS.map(tool => (
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
        <pre>{activeCoverPrompt}</pre>
      </div>

      <div className="thumbnail-archetype-panel">
        <div className="copy-head">
          <h4>Thumbnail archetype prompt library</h4>
          <div className="button-row">
            <button type="button" className={promptMode === 'thumbnail' ? 'tab active' : 'tab'} onClick={() => setPromptMode('thumbnail')}>16:9</button>
            <button type="button" className={promptMode === 'portrait' ? 'tab active' : 'tab'} onClick={() => setPromptMode('portrait')}>4:5</button>
            <button type="button" className={promptMode === 'cover' ? 'tab active' : 'tab'} onClick={() => setPromptMode('cover')}>1:1</button>
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
            <select value={selectedArchetypeId} onChange={event => onSelectArchetype(event.target.value as ThumbnailArchetypeId)}>
              {thumbnailArchetypesForArchetype(channelArchetype).map(archetype => (
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

      <div className="option-block">
        <h3>📦 세트 일괄 내보내기</h3>
        <p className="supporting">
          멀티세트로 생성한 팩 그룹을 골라, 세트별 [썸네일 프롬프트 / 커버 프롬프트 / 선택 문구]를 순서대로 정리한 .md 파일 하나로 내보냅니다.
          ChatGPT에 세트 순서대로 붙여넣기 좋습니다.
        </p>
        <div className="button-row">
          <select value={selectedExportGroupId} onChange={event => setSelectedExportGroupId(event.target.value)}>
            {setGroups.length === 0 && <option value="">세트 그룹 없음</option>}
            {setGroups.map(group => <option key={group.groupId} value={group.groupId}>{group.label}</option>)}
          </select>
          <button
            type="button"
            disabled={!selectedExportGroupId || qwenBatchGenerating || !qwenApiKey}
            onClick={() => void generateSetGroupBackgrounds(selectedExportGroupId)}
          >
            <Sparkles size={15} />
            {qwenBatchGenerating ? 'Generating set...' : `Generate Qwen backgrounds (${setGroups.find(group => group.groupId === selectedExportGroupId)?.packs.length || 0})`}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!selectedExportGroupId || exporting}
            onClick={() => void exportSetGroupPrompts(selectedExportGroupId)}
          >
            <Download size={15} />
            {exporting ? '내보내는 중...' : '세트 전체 프롬프트 내보내기 (.md)'}
          </button>
        </div>
      </div>

      {!qwenApiKey && <p className="supporting">Qwen set generation is disabled until byok:qwen is saved in Settings; prompt export remains available.</p>}
      {qwenBatchResults.length > 0 && (
        <div className="thumbnail-preview-row">
          {qwenBatchResults.map(result => (
            <a key={result.label} href={result.href} download={`${result.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qwen.png`}>
              {result.label}
            </a>
          ))}
        </div>
      )}

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
