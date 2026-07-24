import { getSetting, setSetting } from './settingsStore';
import type { ThumbnailBrandTemplate } from '../types';

/**
 * TASK v3.37 (spec item C) — channel brand templates, stored the same way as
 * BYOK provider keys (see SettingsModal's byokKeyName / settingsStore.ts):
 * flat opaque keys in the shared IndexedDB 'kv' store, not a new versioned
 * object store. A small index array tracks which channel names exist, since
 * the flat KV store has no "list keys by prefix" primitive of its own.
 */

const CHANNEL_INDEX_KEY = 'thumbnailBrandChannels';

function templateKey(channelName: string) {
  return `thumbnailBrand:${channelName}`;
}

export async function listBrandChannelNames(): Promise<string[]> {
  const index = await getSetting<string[]>(CHANNEL_INDEX_KEY);
  return Array.isArray(index) ? index : [];
}

async function addToChannelIndex(channelName: string): Promise<void> {
  const current = await listBrandChannelNames();
  if (current.includes(channelName)) return;
  await setSetting(CHANNEL_INDEX_KEY, [...current, channelName]);
}

export async function getBrandTemplate(channelName: string): Promise<ThumbnailBrandTemplate | undefined> {
  if (!channelName) return undefined;
  return getSetting<ThumbnailBrandTemplate>(templateKey(channelName));
}

export async function saveBrandTemplate(template: ThumbnailBrandTemplate): Promise<void> {
  if (!template.channelName.trim()) throw new Error('채널 이름이 필요합니다.');
  await setSetting(templateKey(template.channelName), template);
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
    badge: { icon: '🎵', tag: '', position: 'bottom-right' },
    locked: false,
    updatedAt: new Date().toISOString()
  };
}
