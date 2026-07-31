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

/**
 * TASK v3.58 (TASK 5-4) — buildSectionStylePlan's chorusPool can select
 * 'narrative' or 'image' (not just 'hookRepeat'), but chorusStyleText was
 * built from the same LYRIC_SECTION_STYLE_TEXT_BY_ID table above, whose
 * 'narrative'/'image' wording is hardcoded to say "verse lines..." — so any
 * song whose chorus style resolved to 'narrative' or 'image' got a
 * mixNotes atom reading "chorus style: verse lines unfold as..." (measured
 * 11/18 in a real pack). This is the chorus-context wording for the same
 * 4 style ids, used only for chorusStyleText.
 */
export const CHORUS_SECTION_STYLE_TEXT_BY_ID: Record<LyricSectionStyleId, string> = {
  narrative: 'chorus lines unfold as plain scene narration with concrete actions and time movement',
  image: 'chorus lines focus on sensory images, objects, light, weather, and small gestures',
  dialogue: 'chorus lines use direct address or short conversational fragments without becoming spoken-word',
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

const SOLITARY_OBJECT_FRAME_ID = 'solitary-object';
const NON_SOLITARY_FRAME_CAP = 4;

function themeFrameId(theme: LyricTheme): string {
  return theme.frameId ?? SOLITARY_OBJECT_FRAME_ID;
}

function frameCapFor(frameId: string, songCount: number): number {
  const cap = frameId === SOLITARY_OBJECT_FRAME_ID ? 5 : NON_SOLITARY_FRAME_CAP;
  return Math.min(cap, songCount);
}

/** Only true once at least one theme in the pool opted into frame tagging (see LyricTheme.frameId's own doc comment) — every other archetype's plan is untouched. */
function poolHasExplicitFrames(pool: LyricTheme[]): boolean {
  return pool.some(theme => Boolean(theme.frameId));
}

/**
 * TASK v3.64 (TASK A) — real measurement: 18/18 songs in a real pack used
 * the identical "solitary senior with an object" frame; only the object
 * varied. Groups the theme pool by frameId and round-robins across frames
 * (capping solitary-object at 5, everything else at 4) so a pack actually
 * spans multiple kinds of scenes — first love, a Saturday dance, a train
 * reunion, city lights, ... — instead of relabeling one scene repeatedly.
 * Falls back to repeating the frame cycle uncapped only if every frame hits
 * its cap before songCount is reached (a large songCount against a small
 * pool) rather than ever returning fewer entries than requested.
 */
function allocateThemesByFrame(pool: LyricTheme[], songCount: number, seed: number): string[] {
  if (!pool.length || songCount <= 0) return [];
  const byFrame = new Map<string, LyricTheme[]>();
  for (const theme of pool) {
    const frameId = themeFrameId(theme);
    byFrame.set(frameId, [...(byFrame.get(frameId) ?? []), theme]);
  }
  const frameIds = [...byFrame.keys()];
  const offset = Math.abs(seed + 1301) % frameIds.length;
  const orderedFrameIds = [...frameIds.slice(offset), ...frameIds.slice(0, offset)];

  const frameSequence: string[] = [];
  const usedPerFrame = new Map<string, number>();
  let guard = 0;
  while (frameSequence.length < songCount && guard < songCount * orderedFrameIds.length * 2) {
    const frameId = orderedFrameIds[guard % orderedFrameIds.length];
    const used = usedPerFrame.get(frameId) ?? 0;
    if (used < frameCapFor(frameId, songCount)) {
      frameSequence.push(frameId);
      usedPerFrame.set(frameId, used + 1);
    }
    guard += 1;
  }
  // Every frame capped out before songCount was reached (small pool, large songCount) — fill the remainder uncapped rather than come up short.
  let fallbackCursor = 0;
  while (frameSequence.length < songCount) {
    frameSequence.push(orderedFrameIds[fallbackCursor % orderedFrameIds.length]);
    fallbackCursor += 1;
  }

  const spreadFrames = spreadPlanByCounts(frameSequence, orderedFrameIds, 1);

  const frameCursor = new Map<string, number>();
  const usedThemeIds = new Set<string>();
  return spreadFrames.map(frameId => {
    const themesInFrame = byFrame.get(frameId) ?? [];
    if (!themesInFrame.length) return '';
    const startIndex = frameCursor.get(frameId) ?? 0;
    for (let i = 0; i < themesInFrame.length; i++) {
      const candidate = themesInFrame[(startIndex + i) % themesInFrame.length];
      if (!usedThemeIds.has(candidate.id)) {
        frameCursor.set(frameId, startIndex + i + 1);
        usedThemeIds.add(candidate.id);
        return candidate.id;
      }
    }
    // This frame's own pool is smaller than its allocated count — reuse deterministically rather than come up short.
    return themesInFrame[startIndex % themesInFrame.length].id;
  }).filter(Boolean);
}

export function buildLyricThemePlan(opts: LyricPlanOptions, seed: number): string[] {
  const themes = lyricThemesForOptions(opts);
  const pool = themes.map(theme => theme.id);
  if (!pool.length || opts.songCount <= 0) return [];
  const autoPlan = poolHasExplicitFrames(themes)
    ? allocateThemesByFrame(themes, opts.songCount, seed)
    : buildStridePlan(pool, opts.songCount, Math.abs(seed + 907) % pool.length);
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
      chorusStyleText: CHORUS_SECTION_STYLE_TEXT_BY_ID[chorusStyle]
    };
  });
}

export function lyricThemeForSlot(id: string | undefined, opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage'>): LyricTheme | undefined {
  return getLyricThemeById(id, opts);
}

export function kidsEngineThemeForLyricSlot(id: string | undefined): KidsLyricTheme | undefined {
  return kidsLyricEngineThemeForLyricTheme(id) as KidsLyricTheme | undefined;
}
