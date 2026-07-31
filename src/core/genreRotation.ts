import type { GenrePack } from '../types';
import { buildStridePlan, repairAdjacentRepeats } from './stridePlan';

function normalizedWeight(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function buildGenreRotationPlan(genreIds: readonly string[], songCount: number, seed: number): string[] {
  const pool = Array.from(new Set(genreIds.filter(Boolean)));
  if (!pool.length || songCount <= 0) return [];
  if (pool.length === 1) return Array.from({ length: songCount }, () => pool[0]);
  const offset = Math.abs(seed + 1601) % pool.length;
  return repairAdjacentRepeats(buildStridePlan(pool, songCount, offset));
}

export function buildGenreCountRotationPlan(
  counts: Record<string, number>,
  allowedOrder: readonly string[],
  songCount: number,
  seed: number
): string[] {
  if (songCount <= 0) return [];
  const uniqueOrder = Array.from(new Set(allowedOrder.filter(id => (counts[id] || 0) > 0)));
  if (!uniqueOrder.length) return [];
  const offset = Math.abs(seed + 1601) % uniqueOrder.length;
  const order = [...uniqueOrder.slice(offset), ...uniqueOrder.slice(0, offset)];
  const orderIndex = new Map(order.map((id, index) => [id, index]));
  const remaining = new Map(order.map(id => [id, Math.max(0, Math.round(counts[id] || 0))]));
  const plan: string[] = [];
  let last = '';

  while (plan.length < songCount) {
    const available = order.filter(id => (remaining.get(id) || 0) > 0);
    if (!available.length) break;
    const candidates = available.filter(id => id !== last);
    const pool = candidates.length ? candidates : available;
    const next = pool.slice().sort((a, b) =>
      (remaining.get(b) || 0) - (remaining.get(a) || 0)
      || (orderIndex.get(a) || 0) - (orderIndex.get(b) || 0)
    )[0];
    plan.push(next);
    remaining.set(next, (remaining.get(next) || 0) - 1);
    last = next;
  }

  return plan;
}

export function genresForTrack(
  genres: readonly GenrePack[],
  leadGenreId: string | undefined,
  weights?: Record<string, number>
): GenrePack[] {
  if (!genres.length) return [];
  const primary = genres[0];
  const lead = genres.find(genre => genre.id === leadGenreId) || genres[0];
  const weightedRest = genres
    .filter(genre => genre.id !== lead.id && genre.id !== primary.id)
    .map(genre => ({ genre, weight: normalizedWeight(weights?.[genre.id]) }))
    .sort((a, b) => b.weight - a.weight);
  const explicitWeighted = weightedRest.filter(item => item.weight > 0).map(item => item.genre);
  const fallbackRest = weightedRest.map(item => item.genre);
  const rest = explicitWeighted.length ? explicitWeighted : fallbackRest;
  const ordered = lead.id === primary.id
    ? [primary, ...rest]
    : [lead, primary, ...rest];
  return ordered.slice(0, 3);
}
