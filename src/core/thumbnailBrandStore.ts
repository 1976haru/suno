import { getSetting, setSetting } from './settingsStore';
import type { ThumbnailBrandTemplate, ThumbnailTextLayer } from '../types';
import { normalizeThumbnailTextLayer } from './thumbnailTextLayers';
import { scopedKey } from './workspaceScope';

const CHANNEL_INDEX_KEY = 'thumbnailBrandChannels';

function templateKey(channelName: string) {
  return scopedKey(`thumbnailBrand:${channelName}`);
}

export async function listBrandChannelNames(): Promise<string[]> {
  const index = await getSetting<string[]>(scopedKey(CHANNEL_INDEX_KEY));
  return Array.isArray(index) ? index : [];
}

async function addToChannelIndex(channelName: string): Promise<void> {
  const current = await listBrandChannelNames();
  if (current.includes(channelName)) return;
  await setSetting(scopedKey(CHANNEL_INDEX_KEY), [...current, channelName]);
}

function isLayerLike(value: unknown): value is Partial<ThumbnailTextLayer> & Pick<ThumbnailTextLayer, 'id' | 'role'> {
  if (!value || typeof value !== 'object') return false;
  const layer = value as Partial<ThumbnailTextLayer>;
  return typeof layer.id === 'string' && typeof layer.role === 'string';
}

export function normalizeBrandTemplate(saved: ThumbnailBrandTemplate | undefined, fallbackChannelName = ''): ThumbnailBrandTemplate | undefined {
  if (!saved) return undefined;
  const fallback = defaultBrandTemplate(saved.channelName || fallbackChannelName);
  const layers = Array.isArray(saved.layers)
    ? saved.layers.filter(isLayerLike).map(layer => normalizeThumbnailTextLayer(layer))
    : undefined;

  return {
    ...fallback,
    ...saved,
    channelName: saved.channelName || fallbackChannelName,
    badge: { ...fallback.badge, ...(saved.badge || {}) },
    layers
  };
}

export async function getBrandTemplate(channelName: string): Promise<ThumbnailBrandTemplate | undefined> {
  if (!channelName) return undefined;
  const saved = await getSetting<ThumbnailBrandTemplate>(templateKey(channelName));
  return normalizeBrandTemplate(saved, channelName);
}

export async function saveBrandTemplate(template: ThumbnailBrandTemplate): Promise<void> {
  if (!template.channelName.trim()) throw new Error('Channel name is required.');
  await setSetting(templateKey(template.channelName), normalizeBrandTemplate(template, template.channelName) ?? template);
  await addToChannelIndex(template.channelName);
}

export function defaultBrandTemplate(channelName: string): ThumbnailBrandTemplate {
  return {
    channelName,
    fontId: 'blackHanSans',
    textColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowWidth: 2,
    strokeOn: true,
    position: 'bottom-center',
    badge: { icon: 'SW', tag: '', position: 'bottom-right' },
    locked: false,
    updatedAt: new Date().toISOString()
  };
}
