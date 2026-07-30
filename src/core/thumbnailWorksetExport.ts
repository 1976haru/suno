import type { SavedPack, ThumbnailCompositionGuide, ThumbnailMotionGuide, ThumbnailSpec } from '../types';
import type { ThumbnailArchetypeId } from '../data/thumbnailArchetypes';
import { seasonPacks } from '../data/presets';
import { buildCoverImagePromptVariants, buildPortraitImagePromptVariants, buildThumbnailSpec } from './thumbnailSpec';
import { safeConceptSummaryForDisplay } from './conceptDiversity';

const IMAGE_TOOLS = [
  ['generic', 'Generic (ChatGPT/DALL-E)'],
  ['midjourney', 'Midjourney'],
  ['qwenImage', 'Qwen Image'],
  ['stableDiffusion', 'Stable Diffusion']
] as const;

type ImageToolId = (typeof IMAGE_TOOLS)[number][0];

export interface ThumbnailWorksetMarkdownInput {
  groupLabel: string;
  packs: SavedPack[];
  archetypeId: ThumbnailArchetypeId;
}

function compositionGuideFallback(spec: ThumbnailSpec): ThumbnailCompositionGuide {
  const selected = spec.variants.find(variant => variant.id === spec.selected) ?? spec.variants[0];
  return {
    topSubcaption: 'Playlist mood',
    mainPhrase: selected?.headline.replace('\n', ' ') || 'Playlist',
    subtitle: 'Emotional Playlist',
    bottomBrandLine: 'PLAYLIST',
    textColor: spec.colorScheme.text,
    shadowColor: 'rgba(0,0,0,0.45)',
    playerOverlay: false
  };
}

export function thumbnailCompositionGuideText(spec: ThumbnailSpec): string {
  const guide = spec.compositionGuide ?? compositionGuideFallback(spec);
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

function motionGuideFallback(): ThumbnailMotionGuide {
  return {
    kenBurns: {
      direction: 'slow push-in',
      speed: '5-10 second loop source, or 105% zoom over 3 hours for a full playlist background',
      startFrame: 'wide frame with clean text-safe space',
      endFrame: 'slightly closer frame with text-safe space unchanged'
    },
    aiVideoPrompt: 'slow camera push-in, everything else static, seamless loop',
    loopAdvice: '5~10초 루프 클립을 만들어 반복하면 용량 부담 없이 자연스럽습니다. 가장 간단한 방법은 캡컷의 느린 줌(켄 번스)입니다.'
  };
}

export function thumbnailMotionGuideText(spec: ThumbnailSpec): string {
  const guide = spec.motionGuide ?? motionGuideFallback();
  return [
    `Ken Burns direction: ${guide.kenBurns.direction}`,
    `Ken Burns speed: ${guide.kenBurns.speed}`,
    `Start frame: ${guide.kenBurns.startFrame}`,
    `End frame: ${guide.kenBurns.endFrame}`,
    `AI video prompt: ${guide.aiVideoPrompt}`,
    `Loop advice: ${guide.loopAdvice}`
  ].join('\n');
}

function promptBlocks(title: string, prompts: ThumbnailSpec['imagePromptVariants']): string[] {
  return IMAGE_TOOLS.flatMap(([tool, label]) => [
    `**${title} - ${label}**`,
    '```text',
    prompts[tool as ImageToolId] ?? prompts.generic,
    '```',
    ''
  ]);
}

function setNumber(pack: SavedPack, fallbackIndex: number): number {
  return typeof pack.setIndex === 'number' ? pack.setIndex + 1 : fallbackIndex + 1;
}

export function buildThumbnailWorksetMarkdown(input: ThumbnailWorksetMarkdownInput): string {
  const ordered = input.packs
    .map((pack, originalIndex) => ({ pack, originalIndex }))
    .sort((a, b) => (a.pack.setIndex ?? a.originalIndex) - (b.pack.setIndex ?? b.originalIndex));
  const total = ordered.length;
  const sections = ordered.map(({ pack, originalIndex }) => {
    const season = seasonPacks.find(item => item.id === pack.options.seasonId) ?? seasonPacks[0];
    const setNo = setNumber(pack, originalIndex);
    const seed = typeof pack.setIndex === 'number' ? pack.setIndex : originalIndex;
    const spec = buildThumbnailSpec(pack.blueprint, pack.options, season, pack.options.channel, 0, input.archetypeId);
    const portrait = buildPortraitImagePromptVariants(season.id, input.archetypeId, seed, pack.options.customConcept);
    const cover = buildCoverImagePromptVariants(season.id, input.archetypeId, seed, pack.options.customConcept);
    const selected = spec.variants.find(variant => variant.id === spec.selected) ?? spec.variants[0];

    return [
      `## Set ${String(setNo).padStart(2, '0')} of ${total}: ${pack.projectTitle}`,
      '',
      `Season: ${season.label} (${season.id})`,
      `Concept: ${safeConceptSummaryForDisplay(pack.options.customConcept, pack.blueprint.oneLineConcept)}`,
      `Channel: ${pack.channelName}`,
      `Selected copy: ${selected.id} - ${selected.headline.replace('\n', ' / ')} / ${selected.subline}`,
      '',
      '**Composition guide**',
      '```text',
      thumbnailCompositionGuideText(spec),
      '```',
      '',
      '**Motion guide**',
      '```text',
      thumbnailMotionGuideText(spec),
      '```',
      '',
      ...promptBlocks('Thumbnail 16:9 prompt', spec.imagePromptVariants),
      ...promptBlocks('Portrait 4:5 prompt', portrait),
      ...promptBlocks('Cover 1:1 prompt', cover)
    ].join('\n');
  });

  return [
    `# ${input.groupLabel}`,
    '',
    'One complete image workset is included for each saved set, in set order. Image prompts are textless backgrounds only; add Korean captions and layout in the separate composition step.',
    '',
    sections.join('\n\n---\n\n'),
    ''
  ].join('\n');
}
