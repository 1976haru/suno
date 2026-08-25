import { hookDevices } from '../data/hookDevices';
import { buildStridePlan, repairAdjacentRepeats } from './stridePlan';

const DEFAULT_HOOK_DEVICE_IDS = hookDevices.map(device => device.id);

const HOOK_DEVICE_OVERLAP_KEYWORDS: Record<string, string[]> = {
  'prechorus-dropout': ['dropout', 'drop out', 'backing drops', 'backing cuts', 'whole band hits'],
  'stop-time': ['stop-time', 'stop time', 'one-beat pause', 'one beat', 'band silent', 'first word'],
  'octave-lift': ['octave', 'jumps up', 'higher echo', 'higher children', 'one octave higher'],
  'key-lift': ['modulates', 'modulate', 'semitone', 'key change', 'lift'],
  'answer-riff': ['answer riff', 'riff answers', 'call and response', 'answer phrase', 'answer back'],
  'double-hook': ['double-tracked', 'double tracked', 'third above', 'harmony a third', 'wider harmony'],
  'half-time-chorus': ['half-time', 'half time', 'normal time', 'weight under the chorus'],
  'build-fill': ['drum fill', 'rising swell', 'swell', 'leading into the hook'],
  'bridge-breakdown': ['bridge strips', 'strips down', 'breakdown', 'full arrangement returns'],
  'acappella-tag': ['a cappella', 'outro tag', 'final repeat']
};

function normalizeNarrative(value: string | undefined): string {
  return (value || '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

export function hookDeviceOverlapsNarrative(deviceId: string | undefined, narrativeText: string | undefined): boolean {
  if (!deviceId) return false;
  const narrative = normalizeNarrative(narrativeText);
  if (!narrative) return false;
  const keywords = HOOK_DEVICE_OVERLAP_KEYWORDS[deviceId] || [];
  return keywords.some(keyword => narrative.includes(normalizeNarrative(keyword)));
}

export function hookDeviceIdsForNarrative(narrativeText: string | undefined): string[] {
  const narrative = normalizeNarrative(narrativeText);
  if (!narrative) return DEFAULT_HOOK_DEVICE_IDS;

  const filtered = DEFAULT_HOOK_DEVICE_IDS.filter(id => !hookDeviceOverlapsNarrative(id, narrative));
  return filtered.length >= 2 ? filtered : DEFAULT_HOOK_DEVICE_IDS;
}

/**
 * Deterministic per-track hook-device plan. v3.47 uses the shared stride
 * helper so adjacent songs walk through the pool structurally instead of
 * relying on shuffled laps and repair.
 */
export function buildHookDevicePlan(songCount: number, seed: number, candidateIds: string[] = DEFAULT_HOOK_DEVICE_IDS): string[] {
  const validIds = new Set(DEFAULT_HOOK_DEVICE_IDS);
  const ids = candidateIds.filter(id => validIds.has(id));
  if (!ids.length || songCount <= 0) return [];

  return repairAdjacentRepeats(buildStridePlan(ids, songCount, Math.abs(seed) % ids.length));
}
