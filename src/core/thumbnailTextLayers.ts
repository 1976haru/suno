import { thumbnailArchetypeById, type ThumbnailArchetypeId } from '../data/thumbnailArchetypes';
import type { ThumbnailBrandTemplate, ThumbnailDividerPreset, ThumbnailLayerRole, ThumbnailSpec, ThumbnailTextLayer, ThumbnailTextStyle } from '../types';
import {
  DEFAULT_DIVIDER_PRESET,
  DEFAULT_DIVIDER_THICKNESS_RATIO,
  DEFAULT_DIVIDER_WIDTH_RATIO,
  DEFAULT_TEXT_LINE_HEIGHT_RATIO,
  DEFAULT_TEXT_MAX_LINES
} from './thumbnailCanvas';

export const THUMBNAIL_LAYER_ROLES: ThumbnailLayerRole[] = ['topSubcaption', 'title', 'divider', 'subtitle', 'brandLine'];

export const THUMBNAIL_LAYER_ROLE_LABELS: Record<ThumbnailLayerRole, string> = {
  topSubcaption: 'Top',
  title: 'Title',
  divider: 'Divider',
  subtitle: 'Subtitle',
  brandLine: 'Brand'
};

const ROLE_SIZE_RATIO: Record<ThumbnailLayerRole, number> = {
  topSubcaption: 0.045,
  title: 0.13,
  divider: 0.035,
  subtitle: 0.048,
  brandLine: 0.035
};

const ROLE_MAX_LINES: Record<ThumbnailLayerRole, number> = {
  topSubcaption: 1,
  title: 2,
  divider: 1,
  subtitle: 1,
  brandLine: 1
};

function selectedHeadline(spec: ThumbnailSpec): string {
  return spec.variants.find(v => v.id === spec.selected)?.headline ?? spec.variants[0]?.headline ?? '';
}

export function selectedThumbnailHeadline(spec: ThumbnailSpec): string {
  return selectedHeadline(spec);
}

function lineCount(text: string, maxLines: number): number {
  const lines = String(text || '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, maxLines);
  return Math.max(1, lines.length);
}

function baseFontForArchetype(archetypeId: ThumbnailArchetypeId) {
  const archetype = thumbnailArchetypeById[archetypeId] ?? thumbnailArchetypeById['autumn-window-golden'];
  return archetype.recommendedTypography.divider ? 'gowunDodum' : 'jua';
}

function layerBase(role: ThumbnailLayerRole, text: string, style: ThumbnailTextStyle, enabled: boolean): ThumbnailTextLayer {
  return {
    id: role,
    role,
    text,
    enabled,
    ...style,
    sizeRatio: ROLE_SIZE_RATIO[role],
    offsetXRatio: 0,
    offsetYRatio: 0,
    lineHeightRatio: DEFAULT_TEXT_LINE_HEIGHT_RATIO,
    letterSpacingRatio: 0,
    opacity: 1,
    maxLines: ROLE_MAX_LINES[role],
    dividerPreset: DEFAULT_DIVIDER_PRESET,
    dividerThicknessRatio: DEFAULT_DIVIDER_THICKNESS_RATIO,
    dividerWidthRatio: DEFAULT_DIVIDER_WIDTH_RATIO
  };
}

function defaultCompositionColor(spec: ThumbnailSpec, field: 'textColor' | 'shadowColor', fallback: string): string {
  return spec.compositionGuide?.[field] || fallback;
}

export function buildThumbnailTextLayersFromSpec(spec: ThumbnailSpec, archetypeId: ThumbnailArchetypeId): ThumbnailTextLayer[] {
  const archetype = thumbnailArchetypeById[archetypeId] ?? thumbnailArchetypeById['autumn-window-golden'];
  const composition = spec.compositionGuide;
  const headline = selectedHeadline(spec);
  const textColor = defaultCompositionColor(spec, 'textColor', spec.colorScheme.text || '#FFFFFF');
  const shadowColor = defaultCompositionColor(spec, 'shadowColor', 'rgba(0,0,0,0.45)');
  const baseStyle: ThumbnailTextStyle = {
    fontId: baseFontForArchetype(archetypeId),
    textColor,
    shadowColor,
    shadowWidth: 2,
    strokeOn: false,
    position: 'center'
  };
  const dividerEnabled = Boolean(archetype.recommendedTypography.divider);
  const subtitleEnabled = dividerEnabled && Boolean(archetype.recommendedTypography.subtitle);
  const topSubcaption = layerBase('topSubcaption', composition?.topSubcaption || '', { ...baseStyle, position: 'top-center' }, Boolean(composition?.topSubcaption));
  const title = layerBase('title', headline, { ...baseStyle, position: 'center' }, Boolean(headline));
  title.sizeRatio = lineCount(headline, title.maxLines) > 1 ? 0.11 : 0.13;
  const divider = layerBase('divider', '', { ...baseStyle, position: 'center' }, dividerEnabled);
  const subtitle = layerBase('subtitle', composition?.subtitle || '', { ...baseStyle, position: 'center' }, subtitleEnabled && Boolean(composition?.subtitle));
  const brandLine = layerBase('brandLine', composition?.bottomBrandLine || '', { ...baseStyle, position: 'bottom-center' }, Boolean(composition?.bottomBrandLine));

  topSubcaption.offsetYRatio = 0.02;
  brandLine.offsetYRatio = -0.02;
  return stackThumbnailCoreLayers([topSubcaption, title, divider, subtitle, brandLine]);
}

export function normalizeThumbnailTextLayer(layer: Partial<ThumbnailTextLayer> & Pick<ThumbnailTextLayer, 'id' | 'role'>): ThumbnailTextLayer {
  const fallback = layerBase(layer.role, layer.text || '', {
    fontId: layer.fontId || 'blackHanSans',
    textColor: layer.textColor || '#FFFFFF',
    shadowColor: layer.shadowColor || '#000000',
    shadowWidth: typeof layer.shadowWidth === 'number' ? layer.shadowWidth : 2,
    strokeOn: Boolean(layer.strokeOn),
    position: layer.position || 'center'
  }, layer.enabled !== false);

  return {
    ...fallback,
    ...layer,
    enabled: layer.enabled !== false,
    sizeRatio: typeof layer.sizeRatio === 'number' ? layer.sizeRatio : fallback.sizeRatio,
    offsetXRatio: typeof layer.offsetXRatio === 'number' ? layer.offsetXRatio : 0,
    offsetYRatio: typeof layer.offsetYRatio === 'number' ? layer.offsetYRatio : 0,
    lineHeightRatio: typeof layer.lineHeightRatio === 'number' ? layer.lineHeightRatio : DEFAULT_TEXT_LINE_HEIGHT_RATIO,
    letterSpacingRatio: typeof layer.letterSpacingRatio === 'number' ? layer.letterSpacingRatio : 0,
    opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
    maxLines: typeof layer.maxLines === 'number' ? layer.maxLines : DEFAULT_TEXT_MAX_LINES,
    dividerPreset: (layer.dividerPreset || fallback.dividerPreset) as ThumbnailDividerPreset,
    dividerThicknessRatio: typeof layer.dividerThicknessRatio === 'number' ? layer.dividerThicknessRatio : DEFAULT_DIVIDER_THICKNESS_RATIO,
    dividerWidthRatio: typeof layer.dividerWidthRatio === 'number' ? layer.dividerWidthRatio : DEFAULT_DIVIDER_WIDTH_RATIO
  };
}

export function cloneThumbnailTextLayer(layer: ThumbnailTextLayer): ThumbnailTextLayer {
  return {
    ...layer,
    id: `${layer.role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'title',
    text: layer.text
  };
}

function layerHeightRatio(layer: ThumbnailTextLayer): number {
  if (layer.role === 'divider') {
    if ((layer.dividerPreset ?? DEFAULT_DIVIDER_PRESET) === 'text') {
      return layer.sizeRatio * layer.lineHeightRatio;
    }
    return Math.max(0.018, layer.sizeRatio * 0.45);
  }
  return layer.sizeRatio * layer.lineHeightRatio * lineCount(layer.text, layer.maxLines);
}

export function stackThumbnailCoreLayers(layers: ThumbnailTextLayer[]): ThumbnailTextLayer[] {
  const coreRoles = new Set<ThumbnailLayerRole>(['title', 'divider', 'subtitle']);
  const coreLayers = layers.filter(layer => coreRoles.has(layer.role));
  if (!coreLayers.length) return layers;

  const anchorPosition = coreLayers.find(layer => layer.role === 'title')?.position ?? coreLayers[0].position;
  const gapRatio = 0.022;
  const heights = coreLayers.map(layerHeightRatio);
  const totalHeight = heights.reduce((sum, height) => sum + height, 0) + gapRatio * Math.max(0, coreLayers.length - 1);
  let cursor = -totalHeight / 2;
  const offsets = new Map<string, number>();
  coreLayers.forEach((layer, index) => {
    const height = heights[index];
    offsets.set(layer.id, cursor + height / 2);
    cursor += height + gapRatio;
  });

  return layers.map(layer => {
    if (!coreRoles.has(layer.role)) return layer;
    return { ...layer, position: anchorPosition, offsetYRatio: offsets.get(layer.id) ?? layer.offsetYRatio };
  });
}

export function injectSpecTextIntoLayers(layers: ThumbnailTextLayer[], spec: ThumbnailSpec, archetypeId: ThumbnailArchetypeId): ThumbnailTextLayer[] {
  const specLayers = buildThumbnailTextLayersFromSpec(spec, archetypeId);
  const byRole = new Map(specLayers.map(layer => [layer.role, layer]));
  return layers.map(layer => {
    const specLayer = byRole.get(layer.role);
    if (!specLayer) return layer;
    return {
      ...layer,
      text: specLayer.text,
      enabled: specLayer.enabled
    };
  });
}

export function templateStyle(template: ThumbnailBrandTemplate): ThumbnailTextStyle {
  return {
    fontId: template.fontId,
    textColor: template.textColor,
    shadowColor: template.shadowColor,
    shadowWidth: template.shadowWidth,
    strokeOn: template.strokeOn,
    position: template.position
  };
}
