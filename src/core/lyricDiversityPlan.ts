import { frameIdForConceptText, getLyricThemeById, kidsLyricEngineThemeForLyricTheme, lyricThemesForOptions, type LyricTheme } from '../data/lyricThemes';
import type { GenerationOptions, LyricPerspective, LyricSectionStyleId } from '../types';
import { applyAxisAllocation, POV_IDS, spreadPlanByCounts } from './diversityAllocation';
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
  'channel' | 'songCount' | 'diversityAllocations' | 'perspective' | 'customLyricThemeScene' | 'lyricLanguage' | 'customConcept'
>;

function positiveModulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

const SOLITARY_OBJECT_FRAME_ID = 'solitary-object';
const NON_SOLITARY_FRAME_CAP = 4;
/**
 * v4.5 (TASK D, 4-2) — real measurement: a concept naming a specific
 * situation ("젊은 시절 춤추던 토요일 밤") still only landed its own
 * dance-saturday frame on 2/18 songs (11%) — allocateThemesByFrame spread
 * evenly across all 9 frames with no notion that the concept had already
 * named one of them specifically. This app's own promise-fulfillment bar
 * for a situation promise is >= 60% (core/promiseAudit.ts's own
 * measureSituation) — the preferred frame's cap is raised to match that
 * bar directly, while every other frame keeps its normal
 * NON_SOLITARY_FRAME_CAP so the pack still isn't 100% one scene (this
 * task's own "가사 상황이 18종 전부 다른 것도 유지하십시오").
 */
const PREFERRED_FRAME_SHARE = 0.6;

function themeFrameId(theme: LyricTheme): string {
  return theme.frameId ?? SOLITARY_OBJECT_FRAME_ID;
}

function frameCapFor(frameId: string, songCount: number, preferredFrameId?: string): number {
  if (preferredFrameId && frameId === preferredFrameId) {
    return Math.min(songCount, Math.max(NON_SOLITARY_FRAME_CAP, Math.ceil(songCount * PREFERRED_FRAME_SHARE)));
  }
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
function allocateThemesByFrame(pool: LyricTheme[], songCount: number, seed: number, preferredFrameId?: string): string[] {
  if (!pool.length || songCount <= 0) return [];
  const byFrame = new Map<string, LyricTheme[]>();
  for (const theme of pool) {
    const frameId = themeFrameId(theme);
    byFrame.set(frameId, [...(byFrame.get(frameId) ?? []), theme]);
  }
  const frameIds = [...byFrame.keys()];
  const offset = Math.abs(seed + 1301) % frameIds.length;
  const rotatedFrameIds = [...frameIds.slice(offset), ...frameIds.slice(0, offset)];
  const orderedFrameIds = preferredFrameId && byFrame.has(preferredFrameId)
    ? [preferredFrameId, ...rotatedFrameIds.filter(id => id !== preferredFrameId)]
    : rotatedFrameIds;

  const frameSequence: string[] = [];
  const usedPerFrame = new Map<string, number>();
  // v4.5 (TASK D, 4-2) — reserves the preferred frame's own (higher, see
  // frameCapFor) share FIRST, as a dedicated phase, rather than folding it
  // into the round-robin loop below. Real measurement: a straight
  // round-robin (1 slot per frame per pass) naturally finishes filling
  // songCount slots once every frame's SHARE of an even split is met —
  // for a typical 18-song/9-frame pool that's 2 passes, well before a
  // higher cap on one frame ever becomes the binding constraint, so the
  // bias silently never fired. Reserving it up front guarantees the share
  // regardless of how many other frames the pool happens to have.
  if (preferredFrameId && byFrame.has(preferredFrameId)) {
    const reserved = Math.min(songCount, frameCapFor(preferredFrameId, songCount, preferredFrameId));
    for (let i = 0; i < reserved; i++) frameSequence.push(preferredFrameId);
    usedPerFrame.set(preferredFrameId, reserved);
  }
  let guard = 0;
  while (frameSequence.length < songCount && guard < songCount * orderedFrameIds.length * 2) {
    const frameId = orderedFrameIds[guard % orderedFrameIds.length];
    const used = usedPerFrame.get(frameId) ?? 0;
    if (used < frameCapFor(frameId, songCount, preferredFrameId)) {
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
  // v4.5 (TASK D, 4-2) — the concept's own named situation (if any) gets a
  // larger share of the pack's frame allocation — see allocateThemesByFrame's
  // own preferredFrameId doc comment for why, and frameIdForConceptText's
  // (data/lyricThemes.ts) doc comment for why this never forces a frame a
  // concept didn't actually name.
  const preferredFrameId = frameIdForConceptText(opts.customConcept);
  const autoPlan = poolHasExplicitFrames(themes)
    ? allocateThemesByFrame(themes, opts.songCount, seed, preferredFrameId)
    : buildStridePlan(pool, opts.songCount, Math.abs(seed + 907) % pool.length);
  const allocated = applyAxisAllocation(autoPlan, opts.diversityAllocations, 'lyricTheme', pool, seed);
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
  const allocated = applyAxisAllocation(autoPlan, opts.diversityAllocations, 'pov', POV_IDS, seed);
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
