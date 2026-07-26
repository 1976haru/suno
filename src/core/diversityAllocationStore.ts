import { getSetting, setSetting } from './settingsStore';
import type { AxisAllocation } from '../types';
import { hasAllocationOverflow, normalizeDiversityAllocations } from './diversityAllocation';

const CHANNEL_INDEX_KEY = 'diversityAllocationChannels';

function templateKey(channelId: string) {
  return `diversityAllocation:${channelId}`;
}

export interface DiversityAllocationTemplate {
  channelId: string;
  allocations: AxisAllocation[];
  updatedAt: string;
}

export async function listDiversityAllocationChannelIds(): Promise<string[]> {
  const index = await getSetting<string[]>(CHANNEL_INDEX_KEY);
  return Array.isArray(index) ? index : [];
}

async function addToChannelIndex(channelId: string): Promise<void> {
  const current = await listDiversityAllocationChannelIds();
  if (current.includes(channelId)) return;
  await setSetting(CHANNEL_INDEX_KEY, [...current, channelId]);
}

export function normalizeDiversityAllocationTemplate(saved: DiversityAllocationTemplate | undefined): DiversityAllocationTemplate | undefined {
  if (!saved || !saved.channelId) return undefined;
  return {
    channelId: saved.channelId,
    allocations: normalizeDiversityAllocations(saved.allocations),
    updatedAt: saved.updatedAt || new Date().toISOString()
  };
}

export async function getDiversityAllocationTemplate(channelId: string): Promise<DiversityAllocationTemplate | undefined> {
  if (!channelId) return undefined;
  const saved = await getSetting<DiversityAllocationTemplate>(templateKey(channelId));
  return normalizeDiversityAllocationTemplate(saved);
}

export async function saveDiversityAllocationTemplate(channelId: string, allocations: AxisAllocation[], songCount: number): Promise<void> {
  if (!channelId.trim()) throw new Error('Channel id is required.');
  const normalized = normalizeDiversityAllocations(allocations);
  if (hasAllocationOverflow(normalized, songCount)) throw new Error('Manual allocation counts exceed song count.');
  await setSetting(templateKey(channelId), {
    channelId,
    allocations: normalized,
    updatedAt: new Date().toISOString()
  });
  await addToChannelIndex(channelId);
}
