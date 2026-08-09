import { frameIdForConceptText, getLyricThemeById, kidsLyricEngineThemeForLyricTheme, lyricThemesForOptions, resolveLocalScenePlanningMode, type LyricTheme } from '../data/lyricThemes';
import type { GenerationOptions, LyricPerspective, LyricSectionStyleId, PerspectiveMode } from '../types';
import { applyAxisAllocation, POV_IDS, spreadPlanByCounts } from './diversityAllocation';
import { buildStridePlan } from './stridePlan';
import type { KidsLyricTheme } from './kidsLyricEngine';
import type { StructureTemplateId } from './lyricEngine';
import { isKidsArchetype } from '../utils/channelArchetype';
import { hashSeed } from '../utils/prng';

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
  'channel' | 'songCount' | 'diversityAllocations' | 'perspective' | 'perspectiveMode' | 'customLyricThemeScene' | 'lyricLanguage' | 'customConcept'
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

/**
 * v4.16 (TASK D, §4-2/§4-3) — real listening: "상승·밝음" read as 5/18 songs,
 * which turned out to be the senior pool's own 3 genuinely high-energy
 * frames (summer-night, dance-saturday, and city-lights' "electric
 * excitement" theme) landing their normal ~2-songs-each round-robin share —
 * song.emotionArc is populated almost entirely from the assigned LyricTheme's
 * own emotionalArc text (`lyricThemeArc || emotionArc` in localGenerator.ts),
 * so the phase-based emotionArcPoolForPhase pools (see that function's own
 * v4.16 doc comment) rarely actually reach the final song once a theme is
 * assigned — this list, not that one, is the real lever. Scoped to these 5
 * specific senior-theme ids (harmless no-op for every other workspace's pool,
 * none of which contain these ids) rather than a generic "brightness" field
 * on LyricTheme, since only the senior set's own real-listening feedback
 * named this as a problem.
 *
 * Enforced INSIDE allocateThemesByFrame's own round-robin (a combined cap
 * across every frame these ids' themes belong to), not as a post-hoc swap
 * on its output — a post-hoc swap was tried first and technically worked
 * (verified: reduces the bright count correctly), but perturbing the
 * frame-sequence AFTER spreadPlanByCounts had already run against the
 * unswapped counts made spreadPlanByCounts's own reordering of the FULL
 * array sensitive to exactly which substitute got picked, which cascaded
 * into an unrelated title/body-line word collision at songCount=30 (a
 * scale beyond real 18-song production use, but still a real regression —
 * see tests/lyricEngine.test.ts's own [R1] guard). Building the correct
 * distribution natively, before spreadPlanByCounts ever runs, avoids that
 * whole class of cascade.
 */
const BRIGHT_LYRIC_THEME_IDS = new Set([
  'senior-convertible-radio-night',
  'senior-boardwalk-summer-lights',
  'senior-saturday-dance-hall',
  'senior-getting-ready-saturday',
  'senior-neon-downtown-friday'
]);
/** §4-3 — "상승 5곡을 3~4곡으로 줄이고" — upper bound only (a pack landing on fewer than 3 isn't the problem the doc raised: excess, not scarcity). */
const BRIGHT_LYRIC_THEME_MAX = 4;

/** Every frameId that owns at least one bright-tagged theme (city-lights owns one bright + one calm theme — the whole frame counts, capping its calm theme's own availability slightly too, which real measurement shows doesn't push the total below 3). */
function brightFrameIds(pool: readonly LyricTheme[]): Set<string> {
  const ids = new Set<string>();
  for (const theme of pool) {
    if (BRIGHT_LYRIC_THEME_IDS.has(theme.id)) ids.add(themeFrameId(theme));
  }
  return ids;
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
/**
 * v5.8 (audit follow-up, docs/v58-report.md) — real measurement found that
 * merely EXCLUDING moodTag:'energetic' themes for a calm-signaling kids
 * channel (data/lyricThemes.ts's own lyricThemesForOptions filter) still
 * left the pack dominated by mood-neutral routine/education content, since
 * within-frame round-robin gave every remaining theme (calm-tagged or not)
 * equal turns. `preferCalm` sorts each frame's own theme list calm-tagged-
 * first (stable — doesn't reorder anything else) so the round-robin's
 * "first, not-yet-used" picks favor calm themes before neutral ones cycle
 * in, same "compute it natively inside the loop, don't post-process the
 * output" shape as this function's own existing `brightUsed`/
 * `BRIGHT_LYRIC_THEME_MAX` capping above (a v4.16 lesson: a post-hoc swap on
 * this function's already-computed output perturbed spreadPlanByCounts'
 * downstream reordering enough to cause a real title/lyric collision
 * regression — sorting the INPUT before the loop runs avoids that class of
 * bug entirely). No-op for every pool with zero moodTag:'calm' entries
 * (every non-kids pool today).
 */
function allocateThemesByFrame(pool: LyricTheme[], songCount: number, seed: number, preferredFrameId?: string, preferCalm?: boolean): string[] {
  if (!pool.length || songCount <= 0) return [];
  const byFrame = new Map<string, LyricTheme[]>();
  for (const theme of pool) {
    const frameId = themeFrameId(theme);
    byFrame.set(frameId, [...(byFrame.get(frameId) ?? []), theme]);
  }
  if (preferCalm) {
    for (const [frameId, themesInFrame] of byFrame) {
      byFrame.set(frameId, [...themesInFrame].sort((a, b) => (a.moodTag === 'calm' ? 0 : 1) - (b.moodTag === 'calm' ? 0 : 1)));
    }
  }
  const frameIds = [...byFrame.keys()];
  const offset = Math.abs(seed + 1301) % frameIds.length;
  const rotatedFrameIds = [...frameIds.slice(offset), ...frameIds.slice(0, offset)];
  const orderedFrameIds = preferredFrameId && byFrame.has(preferredFrameId)
    ? [preferredFrameId, ...rotatedFrameIds.filter(id => id !== preferredFrameId)]
    : rotatedFrameIds;

  const frameSequence: string[] = [];
  const usedPerFrame = new Map<string, number>();
  // v4.16 (TASK D) — combined cap across every frame brightFrameIds names
  // (see that function's own doc comment) — checked alongside each frame's
  // own individual frameCapFor, never in place of it. A frame equal to
  // preferredFrameId is never treated as "bright" for this purpose, even if
  // it technically owns a bright-tagged theme — see capBrightLyricThemes's
  // (removed) own doc comment for why a concept that explicitly asked for
  // that scene must not have it suppressed.
  const brightIds = brightFrameIds(pool);
  let brightUsed = 0;
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
    const isBrightFrame = brightIds.has(frameId) && frameId !== preferredFrameId;
    if (used < frameCapFor(frameId, songCount, preferredFrameId) && !(isBrightFrame && brightUsed >= BRIGHT_LYRIC_THEME_MAX)) {
      frameSequence.push(frameId);
      usedPerFrame.set(frameId, used + 1);
      if (isBrightFrame) brightUsed += 1;
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
    // 지시문 08 (TASK D) — real root cause of measured scene/theme
    // duplication across 2 differently-seeded concepts on the same
    // channel: this used to always start at index 0 within a frame's own
    // theme list, regardless of `seed` — only WHICH FRAME came first
    // (`orderedFrameIds`, above) was seed-sensitive, so as long as two
    // packs land on the same per-frame counts (guaranteed by
    // frameCapFor(songCount), seed-independent), they picked the exact
    // same theme ids from each frame every time. Seeding the starting
    // index too (hashed with frameId so different frames don't all land on
    // the identical offset when their lengths coincide) makes the actual
    // SET of themes chosen genuinely vary with the seed — and therefore,
    // since seedForBlueprint now includes customConcept, with the concept.
    // Seeding is skipped (kept at index 0, the original behavior) in two
    // real cases where index 0 already carries deliberate meaning, not an
    // arbitrary "first in array order" default:
    //  - SOLITARY_OBJECT_FRAME_ID: a caller-supplied custom theme
    //    (data/lyricThemes.ts's customThemeFromScene) is always PREPENDED
    //    to that frame's own list, so index 0 there means "the user's own
    //    explicit theme choice" — real regression measured
    //    (tests/userChoicePreservation.test.ts) when seeding applied there.
    //  - preferCalm: every frame's own list was just sorted calm-tagged-
    //    first (above), specifically so index 0 lands on a calm theme —
    //    real regression measured (tests/kidsCalmThemeWeighting.test.ts)
    //    when seeding undid that ordering by starting past the calm prefix.
    //  - preferredFrameId: the one frame frameIdForConceptText actually
    //    matched to the concept's own named content — real regression
    //    measured (tests/promiseAudit.test.ts's C8 case, "젊은 시절 춤추던
    //    토요일 밤" / dancing Saturday night): fulfillment dropped from a
    //    passing baseline once seeding could start past that frame's own
    //    author-ordered best-fit theme. Concept-driven variety already
    //    comes from WHICH frame gets reserved (frameIdForConceptText
    //    itself, real per-concept text matching) — this frame doesn't also
    //    need within-frame seeding to serve TASK D's own goal.
    const skipSeeding = frameId === SOLITARY_OBJECT_FRAME_ID || preferCalm || frameId === preferredFrameId;
    const startIndex = frameCursor.get(frameId)
      ?? (skipSeeding ? 0 : Math.abs(hashSeed(`${seed}:${frameId}`)) % themesInFrame.length);
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

/** v5.8 — the frameId that owns the most moodTag:'calm' themes in this pool, or undefined if none exist. Ties broken by the pool's own declared order (stable — Map preserves insertion order). */
function frameWithMostCalmThemes(pool: LyricTheme[]): string | undefined {
  const calmCountByFrame = new Map<string, number>();
  for (const theme of pool) {
    if (theme.moodTag !== 'calm') continue;
    const frameId = themeFrameId(theme);
    calmCountByFrame.set(frameId, (calmCountByFrame.get(frameId) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [frameId, count] of calmCountByFrame) {
    if (count > bestCount) { best = frameId; bestCount = count; }
  }
  return best;
}

/**
 * 지시문 14 (Phase 2 TASK A-1/A-2) — `avoid` is optional and additive: the
 * caller (core/batchPreallocation.ts's preallocateSongSlots) pre-fetches a
 * workspace-scoped cross-pack theme-id/scene avoid list (situationLedger's
 * recentSceneSignatures — this module itself stays sync/pure, no IndexedDB
 * access here, same "core stays pure, caller owns storage" split every
 * other avoid-list param in this codebase already follows) and threads it
 * straight into lyricThemesForOptions's own new `avoid` param — see that
 * function's own doc comment for why this filter is safe (never widens the
 * pool, only shrinks it) unlike the regression this whole file already
 * documents for `scenePlanningMode`.
 */
export function buildLyricThemePlan(opts: LyricPlanOptions, seed: number, avoid?: { recentThemeIds?: string[]; recentSituations?: string[] }): string[] {
  const themes = lyricThemesForOptions({ ...opts, scenePlanningMode: resolveLocalScenePlanningMode(opts) }, avoid);
  const pool = themes.map(theme => theme.id);
  if (!pool.length || opts.songCount <= 0) return [];
  // v4.5 (TASK D, 4-2) — the concept's own named situation (if any) gets a
  // larger share of the pack's frame allocation — see allocateThemesByFrame's
  // own preferredFrameId doc comment for why, and frameIdForConceptText's
  // (data/lyricThemes.ts) doc comment for why this never forces a frame a
  // concept didn't actually name.
  // v5.8 (audit follow-up) — a real concept-named frame still wins (checked
  // first); only when the concept named nothing do we fall back to the
  // channel's own `preferredMoods: ['calm-focus']` signal (real, structured
  // channel data, not text-matching) and bias toward whichever frame owns
  // the most calm-tagged themes — see allocateThemesByFrame's own
  // `preferCalm` doc comment for the within-frame half of this fix.
  const wantsCalm = isKidsArchetype(opts.channel.archetype) && Boolean(opts.channel.preferredMoods?.includes('calm-focus'));
  const preferredFrameId = frameIdForConceptText(opts.customConcept) ?? (wantsCalm ? frameWithMostCalmThemes(themes) : undefined);
  const autoPlan = poolHasExplicitFrames(themes)
    ? allocateThemesByFrame(themes, opts.songCount, seed, preferredFrameId, wantsCalm)
    : buildStridePlan(pool, opts.songCount, Math.abs(seed + 907) % pool.length);
  const allocated = applyAxisAllocation(autoPlan, opts.diversityAllocations, 'lyricTheme', pool, seed);
  return spreadPlanByCounts(allocated, pool, 1);
}

/**
 * TASK v6.0 (perspectiveMode) — kids channels have no UI-tracked "explicit
 * choice" flag of their own to consult here (that lives on
 * GenerationOptions.perspectiveModeIsExplicitChoice, set only by
 * Step2Concept's picker), so both this module and core/setDirector.ts's
 * makeAllocations resolve the SAME way: whatever the caller's own
 * opts.perspectiveMode already says (already resolved upstream — see
 * setDirector.ts's buildBaseOptions) if present, else 'varied' for a kids
 * channel (real children's songs naturally mix "나는 손을 씻어요"/"너는 할 수
 * 있어" rather than committing to one person — see this task's own report),
 * else 'dominant' (today's pre-existing real default for every other
 * channel, unchanged). Centralized here so setDirector.ts's manual pov axis
 * and this file's own auto/fallback pov plan never resolve a bare
 * `perspectiveMode: undefined` two different ways.
 */
export function resolvePerspectiveMode(opts: Pick<GenerationOptions, 'channel' | 'perspectiveMode'>): PerspectiveMode {
  return opts.perspectiveMode ?? (isKidsArchetype(opts.channel.archetype) ? 'varied' : 'dominant');
}

/**
 * TASK v6.0 (perspectiveMode) — the exact count split for `songCount` songs
 * given a primary `perspective` and a resolution `mode`. Single source of
 * truth for both core/setDirector.ts's povCounts (the manual 'pov' axis
 * baked into diversityAllocations once a real user reaches Step2Plan.tsx —
 * see that function's own doc comment for why the manual axis is what a real
 * generation actually uses) and this file's own defaultPovPattern/
 * buildPovPlan (the auto/fallback path a caller that never went through
 * Step2Plan — most direct generateLocalBlueprint calls, including this
 * app's own test suite — still exercises).
 *
 * 'dominant' branch is byte-identical to this app's pre-v6.0 povCounts body
 * (primary gets songCount minus a 2-3 song "variant" reserve, unchanged) —
 * this is the regression-safety contract the whole perspectiveMode feature
 * promises: any existing caller that never sets perspectiveMode keeps
 * exactly today's output.
 */
export function povDistribution(songCount: number, perspective: LyricPerspective | undefined, mode: PerspectiveMode): Record<string, number> {
  const primary = perspective ?? 'firstPerson';
  if (songCount <= 0) return {};
  const fallback: LyricPerspective[] = ['firstPerson', 'secondPerson', 'thirdPerson'];
  const secondary = fallback.find(item => item !== primary) ?? 'secondPerson';
  const tertiary = fallback.find(item => item !== primary && item !== secondary) ?? 'thirdPerson';

  if (mode === 'fixed') return { [primary]: songCount };

  if (mode === 'varied') {
    if (songCount <= 2) return { [primary]: songCount };
    // v6.0 — same round-robin-across-N-ids convention setDirector.ts's own
    // exactBalancedCounts (structureTemplate/vocalType axes) already uses
    // for "no dominant signal, split as evenly as possible" allocation, so
    // this doesn't invent a second even-split algorithm for the same job.
    const order: LyricPerspective[] = [primary, secondary, tertiary];
    const counts: Record<string, number> = {};
    for (let idx = 0; idx < songCount; idx += 1) {
      const id = order[idx % order.length];
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }

  // 'dominant' — unchanged pre-v6.0 povCounts body.
  if (songCount <= 2) return { [primary]: songCount };
  const variantCount = songCount >= 10 ? 3 : 2;
  return {
    [primary]: songCount - variantCount,
    [secondary]: Math.max(1, variantCount - 1),
    [tertiary]: 1
  };
}

function defaultPovPattern(opts: Pick<GenerationOptions, 'channel' | 'perspective' | 'perspectiveMode'>): LyricPerspective[] {
  const primary = opts.perspective || 'firstPerson';
  const mode = resolvePerspectiveMode(opts);
  if (mode === 'fixed') return [primary];
  if (mode === 'varied') {
    const fallback: LyricPerspective[] = ['firstPerson', 'secondPerson', 'thirdPerson'];
    const secondary = fallback.find(item => item !== primary) ?? 'secondPerson';
    const tertiary = fallback.find(item => item !== primary && item !== secondary) ?? 'thirdPerson';
    return [primary, secondary, tertiary];
  }
  // 'dominant' — unchanged pre-v6.0 body for both the kids and non-kids
  // branch (a kids channel only reaches this branch when perspectiveMode was
  // explicitly set to 'dominant' — its own unset default resolves to
  // 'varied' above, a real, intentional behavior change from pre-v6.0's
  // unconditional kids pattern; see this task's own report for why nothing
  // downstream of this pattern (composeKidsLyrics) actually reads pov, so
  // this change only affects the pov *label* attached to a kids song, never
  // its lyric text).
  if (isKidsArchetype(opts.channel.archetype)) {
    return ['firstPerson', 'secondPerson', 'firstPerson', 'thirdPerson', 'secondPerson', 'firstPerson'];
  }
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

export function lyricThemeForSlot(id: string | undefined, opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage' | 'customConcept'>): LyricTheme | undefined {
  return getLyricThemeById(id, { ...opts, scenePlanningMode: resolveLocalScenePlanningMode(opts) });
}

export function kidsEngineThemeForLyricSlot(id: string | undefined): KidsLyricTheme | undefined {
  return kidsLyricEngineThemeForLyricTheme(id) as KidsLyricTheme | undefined;
}
