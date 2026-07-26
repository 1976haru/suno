import { getLyricThemeById, kidsLyricEngineThemeForLyricTheme, lyricThemesForOptions, type LyricTheme } from '../data/lyricThemes';
import type { GenerationOptions, LyricPerspective, LyricSectionStyleId } from '../types';
import { applyAxisAllocation, POV_IDS } from './diversityAllocation';
import { buildStridePlan } from './stridePlan';
import type { KidsLyricTheme } from './kidsLyricEngine';
import type { StructureTemplateId } from './lyricEngine';

export const LYRIC_SECTION_STYLE_IDS: LyricSectionStyleId[] = ['narrative', 'image', 'dialogue', 'hookRepeat'];

export const LYRIC_SECTION_STYLE_LABELS: Record<LyricSectionStyleId, string> = {
  narrative: 'Narrative',
  image: 'Image-led',
  dialogue: 'Dialogue',
  hookRepeat: 'Repeat-hook'
};

export const LYRIC_SECTION_STYLE_TEXT_BY_ID: Record<LyricSectionStyleId, string> = {
  narrative: 'verse lines unfold as plain scene narration with concrete actions and time movement',
  image: 'verse lines focus on sensory images, objects, light, weather, and small gestures',
  dialogue: 'verse lines use direct address or short conversational fragments without becoming spoken-word',
  hookRepeat: 'chorus lines use compact repeated hook callbacks and simple answer phrases'
};

type LyricPlanOptions = Pick<GenerationOptions,
  'channel' | 'songCount' | 'diversityAllocations' | 'perspective' | 'customLyricThemeScene' | 'lyricLanguage'
>;

function positiveModulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function spreadPlanByCounts<T extends string>(plan: readonly T[], allowedOrder: readonly T[], maxConsecutive: number): T[] {
  if (plan.length <= 1) return [...plan];
  const counts = new Map<T, number>();
  for (const item of plan) counts.set(item, (counts.get(item) || 0) + 1);
  if (counts.size <= 1) return [...plan];

  const result: T[] = [];
  const orderIndex = new Map<T, number>();
  allowedOrder.forEach((item, index) => orderIndex.set(item, index));

  function wouldExceed(candidate: T): boolean {
    if (maxConsecutive <= 0) return false;
    if (result.length < maxConsecutive) return false;
    for (let i = 1; i <= maxConsecutive; i++) {
      if (result[result.length - i] !== candidate) return false;
    }
    return true;
  }

  while (result.length < plan.length) {
    const candidates = [...counts.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return (orderIndex.get(a[0]) ?? 999) - (orderIndex.get(b[0]) ?? 999);
      });
    const picked = candidates.find(([candidate]) => !wouldExceed(candidate)) ?? candidates[0];
    if (!picked) break;
    const [value, count] = picked;
    result.push(value);
    counts.set(value, count - 1);
  }

  return result;
}

export function buildLyricThemePlan(opts: LyricPlanOptions, seed: number): string[] {
  const themes = lyricThemesForOptions(opts);
  const pool = themes.map(theme => theme.id);
  if (!pool.length || opts.songCount <= 0) return [];
  const offset = Math.abs(seed + 907) % pool.length;
  const autoPlan = buildStridePlan(pool, opts.songCount, offset);
  const allocated = applyAxisAllocation(autoPlan, opts.diversityAllocations, 'lyricTheme', pool);
  return spreadPlanByCounts(allocated, pool, 1);
}

function defaultPovPattern(opts: Pick<GenerationOptions, 'channel' | 'perspective'>): LyricPerspective[] {
  if (opts.channel.archetype === 'kids') {
    return ['firstPerson', 'secondPerson', 'firstPerson', 'thirdPerson', 'secondPerson', 'firstPerson'];
  }
  const primary = opts.perspective || 'firstPerson';
  const fallback: LyricPerspective[] = ['firstPerson', 'secondPerson', 'thirdPerson'];
  const secondary = fallback.find(item => item !== primary) ?? 'secondPerson';
  const tertiary = fallback.find(item => item !== primary && item !== secondary) ?? 'thirdPerson';
  return [primary, secondary, primary, tertiary, primary, secondary, primary, primary, secondary, primary];
}

export function buildPovPlan(opts: LyricPlanOptions, seed: number): LyricPerspective[] {
  if (opts.songCount <= 0) return [];
  const pattern = defaultPovPattern(opts);
  const offset = positiveModulo(seed + 1103, pattern.length);
  const autoPlan = Array.from({ length: opts.songCount }, (_, index) => pattern[(index + offset) % pattern.length]);
  const allocated = applyAxisAllocation(autoPlan, opts.diversityAllocations, 'pov', POV_IDS);
  return spreadPlanByCounts(allocated, POV_IDS, 2);
}

export interface LyricSectionStylePlanEntry {
  verseStyle: LyricSectionStyleId;
  verseStyleText: string;
  chorusStyle: LyricSectionStyleId;
  chorusStyleText: string;
}

export function buildSectionStylePlan(songCount: number, seed: number, structureTemplatePlan: readonly StructureTemplateId[] = []): LyricSectionStylePlanEntry[] {
  const versePool: LyricSectionStyleId[] = ['narrative', 'image', 'dialogue'];
  const chorusPool: LyricSectionStyleId[] = ['hookRepeat', 'image', 'narrative'];
  const versePlan = buildStridePlan(versePool, songCount, Math.abs(seed + 1201) % versePool.length);
  const chorusPlan = buildStridePlan(chorusPool, songCount, Math.abs(seed + 1217) % chorusPool.length);

  return Array.from({ length: songCount }, (_, index) => {
    const structure = structureTemplatePlan[index];
    let verseStyle = versePlan[index] ?? 'narrative';
    let chorusStyle = chorusPlan[index] ?? 'hookRepeat';
    if (structure === 'T3') verseStyle = 'image';
    if (structure === 'T4') verseStyle = 'dialogue';
    if (structure === 'T5') chorusStyle = 'hookRepeat';
    return {
      verseStyle,
      verseStyleText: LYRIC_SECTION_STYLE_TEXT_BY_ID[verseStyle],
      chorusStyle,
      chorusStyleText: LYRIC_SECTION_STYLE_TEXT_BY_ID[chorusStyle]
    };
  });
}

export function lyricThemeForSlot(id: string | undefined, opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage'>): LyricTheme | undefined {
  return getLyricThemeById(id, opts);
}

export function kidsEngineThemeForLyricSlot(id: string | undefined): KidsLyricTheme | undefined {
  return kidsLyricEngineThemeForLyricTheme(id) as KidsLyricTheme | undefined;
}
