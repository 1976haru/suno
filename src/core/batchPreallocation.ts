import type { GenerationOptions, GenrePack, PreassignedSongSlot, SongIdea } from '../types';
import { buildStructureTemplatePlan, createTitleGenerator, hashSeed, seedForBlueprint, STRUCTURE_TEMPLATE_MARKER_TAG, UniquePool } from './lyricEngine';
import { averageTempo, emotionArcs, nextContestedTitle, resolveSongRole } from './localGenerator';
import { buildTempoBandPlan } from './tempoPlan';
import { audienceProfileForAgeGroup, tempoBandsForProfile } from '../data/audienceProfiles';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, arrangementDensityLevel, arrangementNarrativeForGenres, buildExcludePrompt, rotatingGenreText, rotatingInstrumentSet } from './promptComposer';
import { compactMoneyChord } from './soundSignature';
import { buildProgressionPlan, usesMoneyChordQuota } from './moneyChordPlan';
import {
  buildVocalPlan,
  buildVocalVariantPlan,
  DEFAULT_KIDS_VOCAL_QUOTA,
  ensureVocalMetaTag,
  enforceVocalTextInStylePrompt,
  resolveVocalMetaTag,
  usesVocalQuota,
  vocalDescriptionFor,
  type VocalGender
} from './vocalPlan';
import { matchVocalPreset } from '../data/vocalPresets';
import { buildHookDevicePlan, hookDeviceIdsForNarrative } from './hookDevicePlan';
import { getHookDeviceById, hookDevices } from '../data/hookDevices';
import type { OpeningPackContext } from './openingContest';
import { mergeNegativeStyleText, stripNegativeStyleFromStylePrompt } from '../data/negativeStyles';
import { buildIntroTexturePlan, introTextureTagForId } from './introTexturePlan';
import { buildIntroModePlan } from './introModePlan';
import { enforceSingleBpmText } from './bpmDedupe';
import { introTexturesForArchetype } from '../data/introTextures';
import {
  ADULT_STRUCTURE_TEMPLATE_IDS,
  applyAxisAllocation,
  allocationForAxis,
  ARRANGEMENT_DENSITY_IDS,
  KIDS_STRUCTURE_TEMPLATE_IDS,
  VOCAL_TYPE_IDS
} from './diversityAllocation';
import { buildLyricThemePlan, buildPovPlan, buildSectionStylePlan, lyricThemeForSlot } from './lyricDiversityPlan';
import { buildGenreCountRotationPlan, buildGenreRotationPlan, genresForTrack } from './genreRotation';
import { conceptLyricImages, conceptStyleText, variedVocalText } from './conceptDiversity';

export type { PreassignedSongSlot };

function appendGenreAutoRemainder(manualPlan: string[], autoPlan: string[], songCount: number): string[] {
  const plan = [...manualPlan];
  const autoPoolSize = new Set(autoPlan).size;
  let cursor = 0;
  while (plan.length < songCount && cursor < autoPlan.length * 2) {
    const candidate = autoPlan[cursor % autoPlan.length];
    cursor += 1;
    if (autoPoolSize > 1 && candidate === plan[plan.length - 1]) continue;
    plan.push(candidate);
  }
  return plan.length < songCount
    ? [...plan, ...autoPlan.slice(0, songCount - plan.length)]
    : plan;
}

/**
 * TASK B2 (v3.6) — parallel Anthropic Message Batch requests run with no
 * visibility into each other (see providers/batchAnthropic.ts's known
 * limitation note), so two sub-batches submitted together can independently
 * invent the same title or hook. The fix is to never let a batch invent a
 * title/hook at all: every trackNo's title, hook, song role, tempo, and
 * emotion arc is decided locally, up front, with the exact same
 * (avoid-list-aware, hookLedger-informed) generator the local engine itself
 * uses — then handed to every sub-batch as a fixed assignment. Batches only
 * write lyrics/stylePrompt/situations for the trackNos they own; they can no
 * longer collide on identity because they never choose it.
 */
export function preallocateSongSlots(
  opts: Pick<GenerationOptions, 'channel' | 'projectTitle' | 'lyricLanguage' | 'songCount' | 'genreIds' | 'moodIds' | 'moneyChordMode' | 'customMoneyChord' | 'earwormMode' | 'vocalQuota' | 'vocalTone' | 'avoidWords' | 'negativeStyle' | 'introUniqueness' | 'diversityAllocations' | 'perspective' | 'customLyricThemeScene' | 'customConcept' | 'genreBlendWeights' | 'audience'>,
  genres: GenrePack[],
  avoid?: { usedTitles?: string[]; usedHooks?: string[] }
): PreassignedSongSlot[] {
  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  const emotionArcPool = new UniquePool(emotionArcs, seed + 22);
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype);
  // TASK v3.60 (TASK C) — this pre-pass feeds the realtime/Batch/bridge
  // paths (this whole function's own docstring), which measured BPM 96-104
  // (stddev ~2.2) on a real bridge pack because averageTempo() was still
  // called with only 2 args here, skipping the v3.58 TASK 4 tempo-band
  // system entirely (see averageTempo's own `if (!band) return
  // fallbackCenter` short-circuit in localGenerator.ts). Mirrors
  // localGenerator.ts's own generateLocalBlueprint pre-pass exactly (same
  // seed) so the bridge/Batch path's BPM spread matches the local path's.
  const audienceProfile = audienceProfileForAgeGroup(opts.audience);
  const tempoBands = tempoBandsForProfile(audienceProfile);
  const tempoBandPlan = tempoBands ? buildTempoBandPlan(tempoBands, opts.songCount, seed) : [];
  // TASK I2 (v3.11) — the Batch API path is local-then-submit (this whole
  // function's point per its own docstring), so tracks 1-3 get the same
  // local k=3 contest the synchronous path uses, not a plain single-hook pick.
  const packContext: OpeningPackContext = { dominantGenreIds: opts.genreIds ?? [], dominantMoodIds: opts.moodIds ?? [] };
  const genrePool = Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
  const autoGenrePlan = buildGenreRotationPlan(genrePool, opts.songCount, seed);
  const genreAllocation = allocationForAxis(opts.diversityAllocations, 'genre');
  const manualGenrePlan = genreAllocation?.mode === 'manual'
    ? buildGenreCountRotationPlan(genreAllocation.counts, genrePool, opts.songCount, seed)
    : [];
  const genrePlan = manualGenrePlan.length
    ? appendGenreAutoRemainder(manualGenrePlan, autoGenrePlan, opts.songCount)
    : autoGenrePlan;

  // TASK v3.33 Part C — mirrors localGenerator.ts's own pre-pass exactly
  // (same roles, same seed) so the realtime/Batch/bridge paths that call
  // this function agree with the local path on every trackNo's progression.
  const songRoles = Array.from({ length: opts.songCount }, (_, idx) => resolveSongRole(idx + 1, idx));
  const introModePlan = buildIntroModePlan(opts.songCount, seed);
  const progressionPlan = usesMoneyChordQuota(opts) ? buildProgressionPlan(opts.channel.archetype, seed, songRoles) : null;
  // TASK v3.39 — mirrors progressionPlan immediately above: same pre-pass
  // shape, same seed, so this path (realtime/Batch/bridge) agrees with
  // localGenerator.ts's own buildVocalPlan call on every trackNo's vocal
  // type for the same opts.
  const autoVocalPlan = usesVocalQuota(opts) ? buildVocalPlan(opts.vocalQuota ?? DEFAULT_KIDS_VOCAL_QUOTA, opts.songCount, seed) : null;
  const vocalPlan = autoVocalPlan
    ? applyAxisAllocation(autoVocalPlan, opts.diversityAllocations, 'vocalType', VOCAL_TYPE_IDS)
    : null;
  // TASK v3.41 Part A2/D — mirrors vocalPlan's pre-pass shape/seed one more
  // step: which of each type's 5 wordings a given trackNo gets, so a 15-song
  // 5/5/5 kids pack no longer reuses one fixed string per type across
  // realtime/Batch/bridge (see vocalPlan.ts's buildVocalVariantPlan).
  const vocalVariantPlan = vocalPlan ? buildVocalVariantPlan(vocalPlan, seed) : null;
  // TASK v3.39 Part H — every channel (not just kids) now carries a per-song
  // vocalText, so reconcileWithPreassignedSlot below can enforce the
  // selected vocal across realtime/Batch/bridge the same way moneyChordText
  // already enforces the progression. Falls back to the channel's own
  // defaultVocal if this particular request never set vocalTone.
  const fallbackVocalText = opts.vocalTone?.trim() || opts.channel.defaultVocal;
  // TASK v3.41 Part A1 — resolves the explicit gender axis for the non-kids-
  // quota case (a known preset's own `gender`, e.g. 'duet'), computed once
  // since fallbackVocalText is constant across the whole pack. Falls back to
  // undefined (prose detection) when vocalTone/defaultVocal doesn't match
  // any known preset (custom free-text).
  const fallbackVocalGender: VocalGender | undefined = matchVocalPreset(fallbackVocalText)?.gender;
  // TASK v3.42 Part B2 — same pre-pass shape/seed as progressionPlan/
  // vocalPlan above, applied unconditionally (every archetype): replaces the
  // old fixed MONEY_CHORD_FEEL_SUFFIX reinforcement boilerplate with a
  // per-song rotating arrangement-contrast device.
  const narrativeText = arrangementNarrativeForGenres(genres);
  const hookDevicePlan = applyAxisAllocation(
    buildHookDevicePlan(opts.songCount, seed, hookDeviceIdsForNarrative(narrativeText)),
    opts.diversityAllocations,
    'hookDevice',
    hookDevices.map(device => device.id)
  );
  const introTexturePlan = applyAxisAllocation(
    buildIntroTexturePlan(opts.channel.archetype, opts.songCount, seed, opts.introUniqueness),
    opts.diversityAllocations,
    'introTexture',
    introTexturesForArchetype(opts.channel.archetype).map(texture => texture.id)
  );
  // TASK v3.43 Step 2 (Part A3) — mirrors localGenerator.ts's own
  // structureTemplatePlan pre-pass (same seed), applied unconditionally like
  // hookDevicePlan above, so realtime/Batch/bridge songs get a per-song
  // structure-template id instead of only the local path varying its lyric
  // shape.
  const structureTemplatePlan = applyAxisAllocation(
    buildStructureTemplatePlan(opts.songCount, seed, opts.channel.archetype),
    opts.diversityAllocations,
    'structureTemplate',
    opts.channel.archetype === 'kids' ? KIDS_STRUCTURE_TEMPLATE_IDS : ADULT_STRUCTURE_TEMPLATE_IDS
  );
  if (structureTemplatePlan.length) structureTemplatePlan[0] = 'T1';
  const arrangementDensityPlan = applyAxisAllocation(
    Array.from({ length: opts.songCount }, (_, idx) => arrangementDensityLevel(seed, idx)),
    opts.diversityAllocations,
    'arrangementDensity',
    ARRANGEMENT_DENSITY_IDS
  );
  const lyricThemePlan = buildLyricThemePlan(opts, seed);
  const povPlan = buildPovPlan(opts, seed);
  const sectionStylePlan = buildSectionStylePlan(opts.songCount, seed, structureTemplatePlan);

  return Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const songRole = songRoles[idx];
    const { title, hook } = trackNo <= 3
      ? nextContestedTitle(nextTitle, opts.lyricLanguage, opts.channel.archetype, songRole, songRole === 'cold-open' ? 'cold-open' : 'flagship', packContext)
      : nextTitle(songRole);
    const vocalType = vocalPlan ? vocalPlan[idx] : undefined;
    const vocalText = vocalType
      ? vocalDescriptionFor(vocalType, opts.lyricLanguage, vocalVariantPlan ? vocalVariantPlan[idx] : 0, opts.channel.archetype)
      : fallbackVocalText;
    const vocalVariantText = vocalType ? vocalText : undefined;
    const vocalGender: VocalGender | undefined = vocalType
      ? (opts.channel.archetype === 'kids' ? vocalType : (vocalType === 'mixed' ? 'duet' : vocalType))
      : fallbackVocalGender;
    const hookDeviceId = hookDevicePlan[idx];
    const introTextureId = introTexturePlan[idx];
    const moneyChordId = progressionPlan ? progressionPlan[idx] : undefined;
    const hookDeviceText = getHookDeviceById(hookDeviceId)?.prompt;
    const introTextureText = introTextureTagForId(introTextureId);
    const lyricThemeId = lyricThemePlan[idx];
    const lyricTheme = lyricThemeForSlot(lyricThemeId, opts);
    const sectionStyle = sectionStylePlan[idx];
    const genreId = genrePlan[idx];
    const trackGenres = genresForTrack(genres, genreId, opts.genreBlendWeights);
    const resolvedVocalVariantText = vocalVariantText || variedVocalText(fallbackVocalText, idx, trackGenres[0], opts.channel.archetype);
    const genreText = rotatingGenreText(trackGenres, seed, idx);
    const negativeStyleText = buildExcludePrompt(opts, trackGenres);
    return {
      trackNo,
      title,
      hookPhrase: hook,
      songRole,
      tempo: averageTempo(trackGenres, trackNo, tempoBandPlan[idx], audienceProfile.tempoFloor, audienceProfile.tempoCeiling),
      emotionArc: emotionArcPool.take(),
      moneyChordText: compactMoneyChord(opts, { moneyChordIdOverride: moneyChordId, includeFeelReinforcement: true }),
        ...(genreId ? { genreId } : {}),
        ...(genreText ? { genreText } : {}),
        ...(trackGenres[0]?.signatureSound ? { signatureSound: trackGenres[0].signatureSound } : {}),
      negativeStyleText,
      ...(introTextureText ? { introTextureText } : {}),
      ...(introTextureId ? { introTextureId } : {}),
      ...(hookDeviceText ? { hookDeviceText } : {}),
      ...(hookDeviceId ? { hookDeviceId } : {}),
      ...(moneyChordId ? { moneyChordId } : {}),
      // TASK v3.43 Step 2 (Part A3) — mirrors localGenerator.ts's own
      // per-song rotatingInstrumentText/arrangementDensityText calls (same
      // genres/seed/idx), promoted to slot fields for realtime/Batch/bridge
      // parity. Structured (array/enum/id) rather than pre-composed text so
      // the agent instruction/import repair can check and weave each part
      // individually — see types.ts's field comments.
      instrumentSet: rotatingInstrumentSet(trackGenres, seed, idx),
      arrangementDensity: arrangementDensityPlan[idx],
      structureTemplate: structureTemplatePlan[idx],
      introMode: introModePlan[idx],
      lyricTheme: lyricThemeId,
      ...(lyricTheme?.scene ? { lyricThemeText: lyricTheme.scene } : {}),
      ...(lyricTheme?.emotionalArc ? { lyricThemeArc: lyricTheme.emotionalArc } : {}),
      pov: povPlan[idx],
      ...(sectionStyle ? sectionStyle : {}),
      vocalText,
      vocalVariantText: resolvedVocalVariantText,
      ...(conceptStyleText(opts.customConcept, idx) ? { conceptText: conceptStyleText(opts.customConcept, idx) } : {}),
      ...(conceptLyricImages(opts.customConcept).length ? { conceptLyricImages: conceptLyricImages(opts.customConcept) } : {}),
      ...(vocalGender ? { vocalGender } : {}),
      ...(vocalType ? { vocalType } : {})
    };
  });
}

/** Splits a full slot list into the same trackNo ranges buildBatchRequestSpecs chunks the songs into, so each sub-batch's request only carries its own slots. */
export function slotsForRange(slots: PreassignedSongSlot[], trackNumbers: number[]): PreassignedSongSlot[] {
  const range = new Set(trackNumbers);
  return slots.filter(slot => range.has(slot.trackNo));
}

/**
 * TASK v3.27 — the single place every generation path (realtime, Batch API,
 * Claude Code bridge import) reconciles a model/agent's raw song output
 * against the locally pre-decided slot for its trackNo, so the three paths
 * can't drift out of sync on what "verbatim" means (same drift risk v3.21's
 * batchPlanningBullets/songOutputShape extraction already guards against
 * elsewhere in this codebase).
 *
 * emotionArc/songRole are ALWAYS forced to the slot's value when a slot
 * exists. "title" and "hookPhrase" are the two fields governed by their own
 * mode: titleMode 'local' forces title to the slot's mechanically-derived
 * value (old behavior, unchanged); 'ai-creative' (default) trusts the
 * model/agent's own title, falling back to the slot's only if blank.
 * hookMode (TASK v3.33) works the same way one field over: 'pool' forces
 * hookPhrase to the slot's composeHook()-drawn value (old behavior,
 * hook-collision-zero via the pool — unconditional before this task);
 * 'ai-creative' (default) trusts the model's own hook, falling back to the
 * slot's only if blank. See GenerationOptions.titleMode/hookMode's comments.
 */
export interface ReconcilePreassignedOptions {
  /**
   * Bridge imports must preserve the imported hook/lyrics pair. Realtime and
   * Batch paths leave this off so hookMode governs hookPhrase normally.
   */
  keepHook?: boolean;
  /**
   * Metadata-only field. Bridge imports may keep the agent's arc because it
   * can describe the imported lyric tone more accurately than the planning
   * slot. Song role stays slot-owned because it drives opener/flagship
   * structure.
   */
  keepEmotionArc?: boolean;
}

/**
 * TASK v3.43 Part A1 — appends `verbatim` to `stylePrompt` if it isn't
 * already present (case-insensitive), the same "trust but verify" pattern
 * enforceVocalTextInStylePrompt already uses for vocalText: the bridge/Batch
 * instructions ask the model to weave moneyChordText/hookDeviceText verbatim,
 * but real output can still drop or paraphrase it away. No-op when
 * `verbatim` is falsy (e.g. a slot with no hookDeviceText) or already
 * present anywhere in the prompt.
 */
function appendVerbatimIfMissing(stylePrompt: string, verbatim: string | undefined): string {
  if (!verbatim) return stylePrompt;
  if (stylePrompt.toLowerCase().includes(verbatim.trim().toLowerCase())) return stylePrompt;
  const trimmed = stylePrompt.trim().replace(/,\s*$/, '');
  return trimmed ? `${trimmed}, ${verbatim}` : verbatim;
}

/**
 * TASK v3.43 Step 2 (Part A3) — instrumentSet is an array (unlike
 * moneyChordText/hookDeviceText's single ready-to-weave string), so this
 * checks/appends each instrument name individually: an agent that wove 2 of
 * 3 assigned instruments into the stylePrompt only needs the missing one
 * injected, not the whole set duplicated.
 */
function enforceInstrumentSetInStylePrompt(stylePrompt: string, instrumentSet: string[] | undefined): string {
  if (!instrumentSet?.length) return stylePrompt;
  const promptLower = stylePrompt.toLowerCase();
  const missing = instrumentSet.filter(instrument => !promptLower.includes(instrument.trim().toLowerCase()));
  if (!missing.length) return stylePrompt;
  const trimmed = stylePrompt.trim().replace(/,\s*$/, '');
  return trimmed ? `${trimmed}, ${missing.join(', ')}` : missing.join(', ');
}

/**
 * TASK v3.43 Step 2 (Part A3) — arrangementDensity is a bare level tag, not
 * text to weave; looks up its canonical descriptive phrase (the same one
 * the batch/bridge legend hands the agent) before falling back to the same
 * append-if-missing check every other verbatim atom uses.
 */
function enforceArrangementDensityInStylePrompt(stylePrompt: string, density: PreassignedSongSlot['arrangementDensity']): string {
  if (!density) return stylePrompt;
  return appendVerbatimIfMissing(stylePrompt, ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[density]);
}

/**
 * TASK v3.43 Part A2 — tempo/BPM never had any post-hoc enforcement: the
 * model was only ever handed the slot's tempo as one of several "fallback
 * suggestion" fields (same tier as title/hookPhrase, both of which DO get
 * reconciled below), so a Batch/bridge stylePrompt could carry a BPM figure
 * that silently didn't match the tempo actually planned for that trackNo (or
 * carry none at all). Mirrors enforceVocalTextInStylePrompt's shape: replace
 * a wrong BPM figure in place if one is present, otherwise append the
 * correct one.
 */
function enforceTempoInStylePrompt(stylePrompt: string, tempo: number): string {
  return enforceSingleBpmText(stylePrompt, tempo);
}

function diversifyVocalLedOpening(stylePrompt: string, slot: PreassignedSongSlot): string {
  const trimmed = stylePrompt.trim();
  const lower = trimmed.toLowerCase();
  const vocalStarts = [slot.vocalText, slot.vocalVariantText].filter(Boolean).map(value => value!.trim().toLowerCase());
  if (!vocalStarts.some(start => start && lower.startsWith(start))) return stylePrompt;

  const instrument = slot.instrumentSet?.[0] || 'the small ensemble';
  const openings = [
      slot.genreText,
      slot.signatureSound,
    `${instrument} leads the opening`,
    slot.conceptText,
    slot.introTextureText,
    'a restrained cafe groove opens before the vocal',
    'brushed rhythm establishes the room before the vocal',
    `${instrument} and close room tone frame the first phrase`,
    'the bass pocket arrives before the lead voice',
    'a soft answering phrase opens the arrangement',
    'the harmony color arrives before the vocal enters',
    'a quiet instrumental breath starts the track',
    'the intimate room sound leads into the first line'
  ];
  const opening = openings[(Math.max(1, slot.trackNo) - 1) % openings.length];
  if (!opening || lower.startsWith(opening.toLowerCase())) return stylePrompt;
  return `${opening}, ${trimmed}`;
}

function removeRepeatedInstrumentMentions(stylePrompt: string, instrumentSet: string[] | undefined): string {
  if (!instrumentSet?.length) return stylePrompt;
  const seen = new Set<string>();
  return stylePrompt.split(',').map(clause => {
    let next = clause.trim();
    for (const instrument of instrumentSet) {
      const value = instrument.trim();
      const key = value.toLowerCase();
      const expression = new RegExp(`\\b${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'ig');
      if (!expression.test(next)) continue;
      if (seen.has(key)) next = next.replace(expression, '').replace(/\\s{2,}/g, ' ').trim();
      else seen.add(key);
    }
    return next;
  }).filter(Boolean).join(', ');
}

export function reconcileWithPreassignedSlot(
  song: SongIdea,
  slot: PreassignedSongSlot | undefined,
  titleMode: 'local' | 'ai-creative' = 'ai-creative',
  options: ReconcilePreassignedOptions = {},
  /** TASK v3.33 — see GenerationOptions.hookMode. Kept as its own trailing param (not folded into ReconcilePreassignedOptions) since every non-bridge caller passes it explicitly, the same way titleMode is its own positional param rather than an option. */
  hookMode: 'pool' | 'ai-creative' = 'ai-creative'
): SongIdea {
  if (!slot) return song;
  const title = titleMode === 'local' ? slot.title : song.title?.trim() ? song.title : slot.title;
  const hookPhrase = options.keepHook && song.hookPhrase?.trim()
    ? song.hookPhrase
    : hookMode === 'ai-creative' && song.hookPhrase?.trim()
      ? song.hookPhrase
      : slot.hookPhrase;
  const completeFields = [
    slot.vocalText,
    slot.moneyChordText,
    slot.genreText,
    slot.signatureSound,
    slot.hookDeviceText,
    slot.introTextureText,
    ...(slot.instrumentSet || [])
  ].filter(Boolean).every(value => song.stylePrompt.toLowerCase().includes(value!.trim().toLowerCase()));
  const startsWithVocal = [slot.vocalText, slot.vocalVariantText].filter(Boolean).some(value => song.stylePrompt.trim().toLowerCase().startsWith(value!.trim().toLowerCase()));
  if (completeFields && !startsWithVocal && song.stylePrompt.includes(`${slot.tempo} BPM`)) {
    return { ...song, title, hookPhrase };
  }
  // TASK v3.39 Part H — a real showa-cafe channel selected a male vocal
  // preset but a Codex-bridge-generated stylePrompt came back female,
  // because nothing forced the agent's free-form text to actually match the
  // selection. Rather than trust the verbatim-weave instruction alone (see
  // claudeCodeBridge.ts/promptComposer.ts), this deterministically corrects
  // the gender here — the one place realtime/Batch/bridge output all funnel
  // through — regardless of whether the agent complied. No-op when
  // vocalText has no detectable gender (e.g. a children's choir) or when the
  // stylePrompt already matches.
  const vocalFix = enforceVocalTextInStylePrompt(song.stylePrompt, slot.vocalVariantText || slot.vocalText, slot.vocalGender);
  // TASK v3.43 Part A1/A2, Step 2 Part A3 — same "don't just trust the
  // instruction" principle applied to every other verbatim-weave slot field:
  // moneyChordText and hookDeviceText previously had no post-hoc check at
  // all (unlike vocalText above), and tempo/instrumentSet/arrangementDensity
  // are new fields this task adds to the same pattern.
  let stylePrompt = vocalFix.text;
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.vocalText);
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.conceptText);
    stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.moneyChordText);
    stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.signatureSound);
  const existingPromptLower = stylePrompt.toLowerCase();
  const genreTextToAppend = slot.genreText
    && !existingPromptLower.includes(slot.genreText.trim().toLowerCase())
    && slot.instrumentSet?.some(instrument =>
    existingPromptLower.includes(instrument.trim().toLowerCase())
  )
    ? slot.genreText.split(',').map(atom => atom.trim()).filter(atom =>
      !slot.instrumentSet!.some(instrument => atom.toLowerCase() === instrument.trim().toLowerCase())
    ).join(', ')
    : slot.genreText;
  stylePrompt = appendVerbatimIfMissing(stylePrompt, genreTextToAppend);
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.hookDeviceText);
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.introTextureText);
  stylePrompt = enforceInstrumentSetInStylePrompt(stylePrompt, slot.instrumentSet);
  stylePrompt = enforceArrangementDensityInStylePrompt(stylePrompt, slot.arrangementDensity);
  stylePrompt = stripNegativeStyleFromStylePrompt(stylePrompt, slot.negativeStyleText);
  stylePrompt = enforceTempoInStylePrompt(stylePrompt, slot.tempo);
  stylePrompt = diversifyVocalLedOpening(stylePrompt, slot);
  stylePrompt = removeRepeatedInstrumentMentions(stylePrompt, slot.instrumentSet);
  const excludePrompt = slot.negativeStyleText
    ? mergeNegativeStyleText(song.excludePrompt, slot.negativeStyleText)
    : song.excludePrompt;
  const vocalTag = resolveVocalMetaTag(slot.vocalType, slot.vocalGender, slot.vocalText);
  // TASK v3.43 Step 2 (Part A3) — structureTemplate shapes the lyric's own
  // section tags, not stylePrompt, so unlike every field above there's
  // nothing to inject post-hoc; this only warns (never silently rewrites
  // someone else's lyrics) when the assigned template's distinctive marker
  // tag never shows up, meaning the agent likely ignored the structure
  // guideline and wrote the default shape instead. T1 has no marker (it's
  // the unmarked default), so this never fires for a track assigned T1.
  const structureMarker = slot.structureTemplate ? STRUCTURE_TEMPLATE_MARKER_TAG[slot.structureTemplate] : undefined;
  const structureWarning = structureMarker && !song.lyrics.includes(structureMarker)
    ? `Track ${slot.trackNo}: assigned structureTemplate ${slot.structureTemplate} but its section marker (${structureMarker}) doesn't appear in the lyrics — the structure guideline may not have been followed.`
    : undefined;
  const warnings = structureWarning && !song.warnings.includes(structureWarning)
    ? [...song.warnings, structureWarning]
    : song.warnings;
  const listenerSituation = slot.lyricThemeText || song.listenerSituation;
  return {
    ...song,
    title,
    hookPhrase,
    stylePrompt,
    excludePrompt,
    lyrics: ensureVocalMetaTag(song.lyrics, vocalTag),
    listenerSituation,
    emotionArc: options.keepEmotionArc && song.emotionArc?.trim() ? song.emotionArc : slot.emotionArc,
    songRole: slot.songRole,
    warnings,
    ...(slot.lyricTheme ? { lyricTheme: slot.lyricTheme } : {}),
    ...(slot.genreId ? { genreId: slot.genreId } : {}),
      ...(slot.genreText ? { genreText: slot.genreText } : {}),
      ...(slot.signatureSound ? { signatureSound: slot.signatureSound } : {}),
    ...(slot.lyricThemeText ? { lyricThemeText: slot.lyricThemeText } : {}),
    ...(slot.lyricThemeArc ? { lyricThemeArc: slot.lyricThemeArc } : {}),
    ...(slot.pov ? { pov: slot.pov } : {}),
    ...(slot.verseStyle ? { verseStyle: slot.verseStyle } : {}),
    ...(slot.verseStyleText ? { verseStyleText: slot.verseStyleText } : {}),
    ...(slot.chorusStyle ? { chorusStyle: slot.chorusStyle } : {}),
    ...(slot.chorusStyleText ? { chorusStyleText: slot.chorusStyleText } : {}),
    // TASK v3.39 — vocalType is slot-owned like songRole/emotionArc: it
    // drives the per-song male/female/mixed quota, so a realtime/Batch/
    // bridge response can never silently drift from the locally-decided
    // plan. Non-kids slots never set this field, so this is a no-op there.
    ...(slot.vocalType ? { vocalType: slot.vocalType } : {})
  };
}
