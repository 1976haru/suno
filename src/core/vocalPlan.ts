import type { GenerationOptions, LyricLanguage } from '../types';
import { isManualAllocation } from './diversityAllocation';
import { shuffle } from './lyricEngine';
import {
  DUET_TRAIT_AXES,
  FEMALE_PEAK_ONLY_REGISTERS,
  FEMALE_REGISTER_TIMBRE_CONTRADICTIONS,
  FEMALE_VOCAL_TRAIT_AXES,
  MALE_PEAK_ONLY_REGISTERS,
  MALE_REGISTER_TIMBRE_CONTRADICTIONS,
  MALE_VOCAL_TRAIT_AXES
} from '../data/vocalTraits';

/**
 * TASK v3.41 Part A1 — the explicit gender axis a VocalPreset now carries
 * (data/vocalPresets.ts). Kept as its own type here (not re-exported from
 * vocalPresets.ts) since core/* modules that need it (batchPreallocation.ts,
 * quality.ts) shouldn't have to import the data layer just for a type.
 * 'duet' is new: prose detection (detectVocalGender below) can never
 * recognize it reliably, since a duet's own text legitimately contains both
 * a male and a female word — the explicit field is what makes duet
 * enforcement possible at all.
 */
export type VocalGender = 'male' | 'female' | 'mixed' | 'duet';

/**
 * TASK v3.38 Part B2 — per-song vocal-type quota, originally only engaged
 * for the 'kids' channel archetype or an explicit manual vocalType
 * allocation.
 *
 * TASK v3.72 (TASK A) — real regression: a senior channel with no manual
 * 8-axis allocation fell all the way through to a single fixed
 * `channel.defaultVocal` string for all 18 songs (a real pack measured
 * male 18 / female 0 / duet 0, every song byte-identical — vocalTone was
 * never set away from the channel default), because this returned false and
 * batchPreallocation.ts's/localGenerator.ts's `vocalPlan = null`
 * short-circuit skipped per-song vocal assignment entirely. The vocal quota
 * (6/6/6 male/female/duet by default — see DEFAULT_ADULT_VOCAL_QUOTA below)
 * now engages by default for every archetype, not just kids.
 *
 * Two things still opt out, both deliberate user choices rather than an
 * untouched default: a manual vocalType allocation (8-axis panel) always
 * wins outright, same as before — applyAxisAllocation (called on this
 * function's output) overrides whatever buildVocalPlan produced regardless.
 * And Step2Concept's "어떤 목소리로 부를까요?" grid lets a user pick one
 * specific vocal preset (or type free text) for the WHOLE pack — e.g.
 * explicitly choosing the duet preset because they want every song to be a
 * duet. If `vocalTone` is set to something other than the channel's own
 * `defaultVocal`, that is exactly this deliberate choice, and diluting it
 * into an auto 6/6/6 split would silently break that picker. Only an
 * *untouched* vocalTone (equal to defaultVocal, or unset) — the real
 * regression's actual scenario — engages the auto quota.
 */
export function usesVocalQuota(opts: Pick<GenerationOptions, 'channel' | 'diversityAllocations' | 'vocalTone'>): boolean {
  if (opts.channel.archetype === 'kids' || isManualAllocation(opts.diversityAllocations, 'vocalType')) return true;
  const explicitVocalTone = opts.vocalTone?.trim();
  if (explicitVocalTone && explicitVocalTone !== opts.channel.defaultVocal) return false;
  return true;
}

export type VocalType = 'male' | 'female' | 'mixed';

export interface VocalQuota {
  male: number;
  female: number;
  mixed: number;
}

/** TASK v3.38 Part B2 — the 6/6/6-of-18 default; scaleVocalQuota below applies this as a ratio at any songCount, not a literal must-equal-18 requirement. */
export const DEFAULT_KIDS_VOCAL_QUOTA: VocalQuota = { male: 6, female: 6, mixed: 6 };

/**
 * TASK v3.72 (TASK A) — same 6/6/6-of-18 ratio as the kids quota, but for
 * every non-kids archetype ('mixed' means a male-female duet here, not a
 * children's choir — see vocalDescriptionFor's archetype branch). A
 * separate constant (not a reuse of DEFAULT_KIDS_VOCAL_QUOTA) so the two
 * meanings of 'mixed' never get confused at a call site, even though the
 * numbers are identical today.
 */
export const DEFAULT_ADULT_VOCAL_QUOTA: VocalQuota = { male: 6, female: 6, mixed: 6 };

/** TASK v3.38 Part B (language follow-up) — the 3 lyricLanguages the kids channel supports. Any other LyricLanguage value (e.g. 'bilingual', which the kids channel UI doesn't offer) falls back to 'korean' via vocalDictionLanguage below. */
export type KidsVocalLanguage = 'korean' | 'japanese' | 'english';

/**
 * TASK v3.39 — real listening feedback: the pre-v3.39 wording ("young male
 * voice", "adult lead") consistently rendered as adult-sounding vocals, not
 * a children's channel identity. Suno tends to avoid literal "child singer"
 * requests, so these lean on childlike/youthful/kindergarten-age descriptors
 * instead of naming an age directly. Phrased positively (no "not an adult"
 * style negation, and no literal "adult" wording at all) since a generative
 * model is more reliable steered by what a voice IS than by what it isn't.
 *
 * TASK v3.41 Part A2/D — each type is now 5 variants instead of one fixed
 * string. Real measurement: a 15-song 5/5/5 kids pack previously produced
 * only 3 distinct vocalText values total (one per type, reused verbatim by
 * every song of that type) — directly the "inauthentic/template content"
 * risk the v3.40 strategy review flagged. buildVocalVariantPlan below
 * rotates through these per song so the same pack instead reaches up to 15
 * distinct values.
 */
const VOCAL_DESCRIPTIONS: Record<VocalType, string[]> = {
  male: [
    'bright childlike boy voice, playful and youthful, kindergarten-age tone',
    'cheerful young boy voice, bouncy energetic phrasing, childlike tone',
    'sweet childlike boy voice, gentle and warm, kindergarten-age tone',
    'clear childlike boy voice, confident singalong delivery, young elementary-age tone',
    'lively young boy voice, skipping playful rhythm, bright childlike tone'
  ],
  female: [
    'bright childlike girl voice, sweet and clear, kindergarten-age tone',
    'cheerful young girl voice, light bouncy phrasing, childlike tone',
    'gentle childlike girl voice, soft and warm, kindergarten-age tone',
    'clear childlike girl voice, confident singalong delivery, young elementary-age tone',
    'sparkling young girl voice, bright airy tone, playful childlike delivery'
  ],
  mixed: [
    "children's choir singing together, cheerful call-and-response singalong",
    "children's choir in simple unison, bright easy group singalong",
    'childlike boy and girl voices trading lines, playful call-and-response',
    "children's choir with clapping-game rhythm, chant-like group singing",
    "children's choir in a simple round, overlapping cheerful entries"
  ]
};

const ADULT_VOCAL_DESCRIPTIONS: Record<VocalType, string[]> = {
  male: [
    'mature warm male lead vocal, clear close-mic delivery, gentle and sincere',
    'soft husky male tenor lead, relaxed phrasing, warm adult tone',
    'rounded male baritone-tenor vocal, intimate diction, calm emotional lift',
    'clear mature male lead, steady center pitch, conversational warmth',
    'warm male solo vocal, understated soulfulness, smooth unforced dynamics'
  ],
  female: [
    'mature warm female lead vocal, clear close-mic delivery, gentle and sincere',
    'soft alto female lead, relaxed phrasing, warm adult tone',
    'clear female mezzo lead, intimate diction, calm emotional lift',
    'warm female solo vocal, steady center pitch, conversational tenderness',
    'mature female lead, smooth unforced dynamics, soft emotional glow'
  ],
  mixed: [
    'male and female duet, alternating verses, close harmony on the chorus, warm blended tone',
    'mature duet with male and female leads trading lines, gentle chorus harmony',
    'adult male-female duet, intimate call and answer, soft blended refrain',
    'warm mixed duet, conversational verse handoff, close harmony hook',
    'male and female harmony pair, restrained lead trading, sincere blended chorus'
  ]
};

/** TASK v3.38 Part B (language follow-up) — "언어별 보컬 묘사도 해당 언어 발음에 맞게 조정 (예: japanese -> clear Japanese diction, bright and friendly)"; appended to every vocal type's base description below. */
const VOCAL_DICTION_CLAUSE: Record<KidsVocalLanguage, string> = {
  korean: 'clear Korean diction, bright and friendly',
  japanese: 'clear Japanese diction, bright and friendly',
  english: 'clear English diction, bright and friendly'
};

export function vocalDictionLanguage(language: LyricLanguage): KidsVocalLanguage {
  if (language === 'japanese' || language === 'english') return language;
  return 'korean';
}

/**
 * TASK v3.41 Part A2/D — `variantIndex` selects which of this type's 5
 * wordings to use (see VOCAL_DESCRIPTIONS above); out-of-range/negative
 * values wrap via modulo so a caller can pass any deterministic integer
 * (typically buildVocalVariantPlan's output for that trackNo) without
 * bounds-checking first. Omitting it keeps the pre-v3.41 default (variant 0)
 * for any caller that doesn't need rotation.
 */
export function vocalDescriptionFor(type: VocalType, language: LyricLanguage = 'korean', variantIndex = 0, archetype?: GenerationOptions['channel']['archetype']): string {
  const useAdultDescription = Boolean(archetype && archetype !== 'kids');
  const variants = useAdultDescription ? ADULT_VOCAL_DESCRIPTIONS[type] : VOCAL_DESCRIPTIONS[type];
  const safeIndex = ((variantIndex % variants.length) + variants.length) % variants.length;
  if (useAdultDescription) return variants[safeIndex];
  return `${variants[safeIndex]}, ${VOCAL_DICTION_CLAUSE[vocalDictionLanguage(language)]}`;
}

/**
 * TASK v3.41 Part A2/D — for each vocal type, builds a shuffled cycle of
 * variant indices covering exactly as many songs as that type occurs in
 * `plan` (reshuffling with a different seed offset for another lap around
 * the pool if a type occurs more times than it has variants — e.g. a 7/7/6
 * split at songCount=20 needs 7 male indices out of a 5-variant pool).
 * Mirrors buildVocalPlan's own "no immediate repeat" spirit: consecutive
 * occurrences of the same type never land on the same variant index, since
 * each lap is an independent shuffle of the full 0..poolSize-1 range (a
 * repeat can only occur at a lap boundary, and only when poolSize is 1).
 */
export function buildVocalVariantPlan(plan: VocalType[], seed: number): number[] {
  const TYPE_SEED_OFFSET: Record<VocalType, number> = { male: 0, female: 4001, mixed: 8009 };
  const sequenceByType: Partial<Record<VocalType, number[]>> = {};
  const cursorByType: Partial<Record<VocalType, number>> = {};

  for (const type of VOCAL_TYPES) {
    const occurrences = plan.filter(entry => entry === type).length;
    if (!occurrences) continue;
    const poolSize = VOCAL_DESCRIPTIONS[type].length;
    const sequence: number[] = [];
    let lap = 0;
    while (sequence.length < occurrences) {
      const lapIndices = shuffle(Array.from({ length: poolSize }, (_, i) => i), seed + TYPE_SEED_OFFSET[type] + lap * 293);
      sequence.push(...lapIndices);
      lap += 1;
    }
    sequenceByType[type] = sequence;
    cursorByType[type] = 0;
  }

  return plan.map(type => {
    const cursor = cursorByType[type] ?? 0;
    cursorByType[type] = cursor + 1;
    return sequenceByType[type]?.[cursor] ?? 0;
  });
}

/**
 * TASK v3.39 Part H — a real showa-cafe channel selected a male vocal preset
 * but a Codex-bridge-generated song came back with a female vocal because
 * nothing in the pipeline actually enforced the choice (see
 * batchPreallocation.ts's reconcileWithPreassignedSlot for where this is
 * used).
 *
 * TASK v3.39.1 Part H1 — real attack testing found the original word list
 * (female/girl/woman/women, male/boy/man/men) missed the voice-range and
 * pronoun words a stylePrompt actually uses (alto, soprano, tenor, she/he,
 * ...): a "warm alto voice" survived untouched next to an injected "male
 * tenor" description, reintroducing the original bug through a gap in the
 * word list rather than a logic error. "alto" also names instruments (alto
 * sax, alto flute) — excluded via a negative lookahead — and "bass" is
 * deliberately never treated as a gender signal (bass guitar/bassline are
 * instruments, and a "bass" vocal range isn't reliably one gender).
 * Word-boundary-only so "female" never false-positives as containing "male".
 */
const FEMALE_VOICE_TERMS = 'female|girl|woman|women|she|her|soprano|mezzo(?:-soprano)?|contralto|chanteuse|diva|alto(?!\\s*(?:sax|flute))';
const MALE_VOICE_TERMS = 'male|boy|man|men|he|his|tenor|baritone';

function genderTermsPattern(terms: string, flags: string): RegExp {
  return new RegExp(`\\b(?:${terms})\\b`, flags);
}

function hasFemaleVoiceWord(text: string): boolean {
  return genderTermsPattern(FEMALE_VOICE_TERMS, 'i').test(text);
}

function hasMaleVoiceWord(text: string): boolean {
  return genderTermsPattern(MALE_VOICE_TERMS, 'i').test(text);
}

export function detectVocalGender(text: string): 'male' | 'female' | null {
  const hasFemale = hasFemaleVoiceWord(text);
  const hasMale = hasMaleVoiceWord(text);
  if (hasFemale && !hasMale) return 'female';
  if (hasMale && !hasFemale) return 'male';
  return null;
}

/** Exposes the two independent presence checks (unlike detectVocalGender, doesn't collapse to null when both are present) — needed to check a duet actually has both genders represented. */
export function detectVocalGenderPresence(text: string): { male: boolean; female: boolean } {
  return { male: hasMaleVoiceWord(text), female: hasFemaleVoiceWord(text) };
}

/** Strips every word of `gender` out of `text` and tidies up the punctuation/whitespace left behind. */
function stripGenderTerms(text: string, gender: 'male' | 'female'): string {
  const pattern = genderTermsPattern(gender === 'male' ? MALE_VOICE_TERMS : FEMALE_VOICE_TERMS, 'gi');
  return text
    .replace(pattern, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^[,\s]+/, '')
    .replace(/,\s*$/, '')
    .trim();
}

function prependVocalText(stylePrompt: string, vocalText: string, strippedGender: 'male' | 'female'): { text: string; changed: boolean } {
  const cleaned = stripGenderTerms(stylePrompt, strippedGender);
  const text = cleaned ? `${vocalText}, ${cleaned}` : vocalText;
  return { text, changed: true };
}

/**
 * TASK v3.39 Part H — the decisive fix: rather than trust a remote model/
 * coding agent to weave "vocalText" into its stylePrompt correctly (the
 * verbatim instruction in claudeCodeBridge.ts/promptComposer.ts still asks
 * for that, but agent compliance isn't guaranteed), this forcibly corrects
 * the gender of the final stylePrompt whenever it's detectably wrong or
 * missing.
 *
 * TASK v3.39.1 Part H2 — a mixed/choir vocalText (no single detectable
 * gender) previously made this a full no-op, even when the stylePrompt
 * itself still carried a single-gender word (real testing: Codex wrote "deep
 * male baritone lead" for a kids choir slot and it sailed straight through).
 * When vocalText reads as a group/choir voice, any single-gender word found
 * in the stylePrompt is itself the bug — strip it and inject the choir text.
 *
 * TASK v3.41 Part A1 — `gender`, when the caller has it (VocalPreset.gender
 * or a kids-quota VocalType), is now trusted over sniffing `vocalText`'s own
 * prose. This is what makes a duet enforceable at all: prose detection on
 * "male and female duet, ..." always returns null (both words legitimately
 * present), which previously meant duet selections got zero enforcement.
 * Falls back to prose detection only when no explicit gender is supplied
 * (free-text vocalTone that doesn't match a known preset).
 */
export function enforceVocalTextInStylePrompt(
  stylePrompt: string,
  vocalText: string | undefined,
  gender?: VocalGender
): { text: string; changed: boolean } {
  if (!vocalText) return { text: stylePrompt, changed: false };
  // TASK v3.41 — falls back to prose detection when no explicit gender is
  // supplied; detectVocalGender itself never returns 'mixed' (it only knows
  // male/female/null), so a choir-worded vocalText with no explicit gender
  // still needs the same `/\bchoir\b/` fallback the pre-v3.41 H2 fix used,
  // preserved here for any caller that hasn't been updated to pass gender.
  const resolved: VocalGender | null = gender ?? detectVocalGender(vocalText) ?? (/\bchoir\b/i.test(vocalText) ? 'mixed' : null);
  if (!resolved) return { text: stylePrompt, changed: false };

  if (resolved === 'male' || resolved === 'female') {
    if (detectVocalGender(stylePrompt) === resolved) return { text: stylePrompt, changed: false };
    return prependVocalText(stylePrompt, vocalText, resolved === 'male' ? 'female' : 'male');
  }

  if (resolved === 'duet') {
    // TASK v3.41 — a duet needs BOTH genders represented; a lone existing
    // gender word isn't wrong, just incomplete, so this injects rather than
    // strips (stripping would fight the very thing a duet is supposed to
    // have).
    if (hasMaleVoiceWord(stylePrompt) && hasFemaleVoiceWord(stylePrompt)) return { text: stylePrompt, changed: false };
    const text = `${vocalText}, ${stylePrompt}`.replace(/^,\s*/, '').replace(/,\s*$/, '');
    return { text, changed: true };
  }

  // resolved === 'mixed'
  const strayGender = detectVocalGender(stylePrompt);
  if (!strayGender) return { text: stylePrompt, changed: false };
  return prependVocalText(stylePrompt, vocalText, strayGender);
}

/**
 * TASK v3.39 Part H — the strongest lever Suno actually reads for vocal
 * gender is a lyric meta tag, not prose in the style field (see the H spec's
 * "가사 메타 태그 부재" finding: 0 uses of [male vocal]-style tags in real
 * output). Returns null when there's nothing enforceable to tag.
 *
 * TASK v3.41 Part A1 — accepts the explicit `gender` axis alongside the
 * kids-quota `vocalType`; a non-kids 'mixed' selection (mixed-harmony-group)
 * tags as "[group vocal]" rather than "[children's choir]" — distinguished
 * by whether vocalText itself mentions "choir" (kids' mixed presets all do),
 * not by archetype, so this stays a pure function.
 */
export function resolveVocalMetaTag(vocalType: VocalType | undefined, gender: VocalGender | undefined, vocalText: string | undefined): string | null {
  if (vocalType === 'mixed') return "[children's choir]";
  if (vocalType === 'male') return '[male vocal]';
  if (vocalType === 'female') return '[female vocal]';
  if (gender === 'duet') return '[duet vocal]';
  if (gender === 'mixed') return vocalText && /\bchoir\b/i.test(vocalText) ? "[children's choir]" : '[group vocal]';
  if (gender === 'male') return '[male vocal]';
  if (gender === 'female') return '[female vocal]';
  const detected = vocalText ? detectVocalGender(vocalText) : null;
  return detected === 'male' ? '[male vocal]' : detected === 'female' ? '[female vocal]' : null;
}

const VOCAL_META_TAG_PATTERN = /^\s*\[(male vocal|female vocal|children'?s choir|duet vocal|group vocal)\]/i;

/** Prepends `tag` to `lyrics` unless a vocal meta tag is already present at the top (never double-tags). */
export function ensureVocalMetaTag(lyrics: string, tag: string | null): string {
  if (!tag || VOCAL_META_TAG_PATTERN.test(lyrics)) return lyrics;
  return `${tag}\n${lyrics}`;
}

/**
 * TASK v3.58 (TASK 5-3) — a 'duet' selection (adult 'male-female-duet',
 * kids 'kid-duet') already promises "alternating verses, close harmony on
 * the chorus" / "trading lines back and forth" in its own vocalPresets.ts
 * prompt text, but the only enforcement was ONE blanket [duet vocal] tag at
 * the very top of the lyrics (resolveVocalMetaTag/ensureVocalMetaTag) —
 * nothing told Suno which section is which singer, so the alternation the
 * prompt describes had no lyric-side signal at all. This retags each
 * section on the local generator's own fixed, known-literal tag set
 * ('[verse 1]' etc. — see lyricEngine.ts/kidsLyricEngine.ts's `tags`)
 * verse 1 -> male lead, verse 2 -> female lead, every chorus-type section ->
 * the duet/harmony moment, matching the preset text's own verse/chorus
 * split. Only ever called when gender === 'duet'; every other gender keeps
 * the single top-level tag unchanged.
 *
 * TASK v3.70 (TASK A) — real listening feedback: a real duet-prompted track
 * (T1) rendered as a single voice because these per-section tags never
 * actually reached the song — this function existed but was only ever
 * called from localGenerator.ts's own local-preview path, never from
 * batchPreallocation.ts's reconcileWithPreassignedSlot (the realtime/Batch/
 * bridge path every actual production song goes through — see that
 * function's own wiring for where this is now also called). Extended here
 * to also cover pre-chorus/bridge/breakdown, and the non-default
 * structureTemplate final-chorus markers ('[key-lift final chorus]',
 * '[chorus tag]' — see lyricEngine.ts's STRUCTURE_TEMPLATE_MARKER_TAG),
 * since a duet song can land on any structureTemplate, not just the default
 * T1 shape this function originally assumed.
 */
export function applyDuetSectionVocalTags(lyrics: string, gender: VocalGender | undefined): string {
  if (gender !== 'duet') return lyrics;
  const FINAL_CHORUS_TAGS = /^\[(final chorus|key-lift final chorus|chorus tag)\]$/i;
  const BRIDGE_LIKE_TAGS = /^\[(short bridge|breakdown)\]$/i;
  return lyrics
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      const bracketBody = trimmed.slice(1, -1);
      if (/^\[verse 1\]$/i.test(trimmed)) return line.replace(trimmed, '[verse 1: male vocal]');
      if (/^\[verse 2\]$/i.test(trimmed)) return line.replace(trimmed, '[verse 2: female vocal]');
      if (/^\[pre-chorus\]$/i.test(trimmed)) return line.replace(trimmed, '[pre-chorus: female vocal]');
      if (/^\[chorus\]$/i.test(trimmed)) return line.replace(trimmed, '[chorus: male and female duet]');
      if (FINAL_CHORUS_TAGS.test(trimmed)) return line.replace(trimmed, `[${bracketBody}: male and female duet harmony]`);
      if (BRIDGE_LIKE_TAGS.test(trimmed)) return line.replace(trimmed, `[${bracketBody}: male and female call and response]`);
      return line;
    })
    .join('\n');
}

const VOCAL_TYPES: VocalType[] = ['male', 'female', 'mixed'];

/**
 * TASK v3.38 Part B2 — scales the quota's proportions to the actual
 * songCount (largest-remainder method, so the three counts always sum to
 * exactly songCount even when songCount isn't a multiple of the quota's
 * total). This is what makes "쿼터는 UI에서 조정 가능(18곡 외 다른 곡수에도
 * 비율 적용)" work: a 6/6/6 quota at songCount=9 becomes 3/3/3, not a
 * literal slice of the 18-song default.
 */
export function scaleVocalQuota(quota: VocalQuota, songCount: number): VocalQuota {
  const total = quota.male + quota.female + quota.mixed;
  if (total <= 0 || songCount <= 0) return { male: 0, female: 0, mixed: Math.max(0, songCount) };

  const raw: Record<VocalType, number> = {
    male: (quota.male / total) * songCount,
    female: (quota.female / total) * songCount,
    mixed: (quota.mixed / total) * songCount
  };
  const floors: Record<VocalType, number> = {
    male: Math.floor(raw.male),
    female: Math.floor(raw.female),
    mixed: Math.floor(raw.mixed)
  };
  let remainder = songCount - (floors.male + floors.female + floors.mixed);
  const byRemainderDesc = VOCAL_TYPES.slice().sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));

  const result = { ...floors };
  let i = 0;
  while (remainder > 0) {
    result[byRemainderDesc[i % byRemainderDesc.length]] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

/**
 * TASK v3.38 Part B2 — deterministic (seeded) per-trackNo vocal-type plan.
 * Builds a flat pool from the scaled quota, shuffles it, then repairs any
 * run of consecutive same-type entries longer than `maxConsecutive` by
 * swapping forward to the next differing type (or, failing that, backward
 * past the run).
 *
 * TASK v3.72 (TASK A) — tightened from "no run of 4" to "no run of 3"
 * (maxConsecutive defaults to 2, matching the completion table's "같은
 * 보컬 타입 최대 연속 ≤ 2" and diversityAllocation.ts's spreadPlanByCounts,
 * which already enforces the same 2-in-a-row cap for a manual vocalType
 * allocation — this brings the auto/default quota path in line with it. The
 * v3.38 "run of 4" test (`never repeats the same vocal type 4 times in a
 * row`) still holds unchanged: a run<3 guarantee is strictly stronger than
 * run<4, so nothing there needed touching.
 */
export function buildVocalPlan(quota: VocalQuota, songCount: number, seed: number, maxConsecutive = 2): VocalType[] {
  const counts = scaleVocalQuota(quota, songCount);
  const pool: VocalType[] = [
    ...Array<VocalType>(counts.male).fill('male'),
    ...Array<VocalType>(counts.female).fill('female'),
    ...Array<VocalType>(counts.mixed).fill('mixed')
  ];
  const plan = shuffle(pool, seed);
  const runLength = maxConsecutive + 1;

  for (let i = runLength - 1; i < plan.length; i++) {
    let runsTooLong = true;
    for (let k = 1; k < runLength && runsTooLong; k++) {
      if (plan[i - k] !== plan[i]) runsTooLong = false;
    }
    if (!runsTooLong) continue;
    let swapIndex = -1;
    for (let j = i + 1; j < plan.length; j++) {
      if (plan[j] !== plan[i]) { swapIndex = j; break; }
    }
    if (swapIndex === -1) {
      for (let j = 0; j < i - (runLength - 1); j++) {
        if (plan[j] !== plan[i]) { swapIndex = j; break; }
      }
    }
    if (swapIndex !== -1) {
      const tmp = plan[i];
      plan[i] = plan[swapIndex];
      plan[swapIndex] = tmp;
    }
  }
  return plan;
}

/** TASK v3.72 (TASK B) — per-axis repeat caps within one pack; see vocalTraits.ts's doc comment for why (5 fixed sentences repeated 36x/week was the whole complaint this task exists to fix). */
const AXIS_REPEAT_CAPS = { register: 2, delivery: 3, timbre: 2, proximity: 3 } as const;
const DUET_AXIS_REPEAT_CAPS = { pairing: 2, blend: 3 } as const;

/**
 * TASK v3.72 (TASK B) — picks one value per occurrence for a single axis
 * (e.g. "register" across this pack's 6 male tracks), honoring a max-repeat
 * cap and an optional per-occurrence filter (senior register gating,
 * register/timbre contradiction avoidance). Falls back to ignoring the cap
 * only when every pool value is already at cap (a pack far larger than any
 * one axis's pool — not a real 18-song case, but keeps this correct instead
 * of crashing at any songCount). Never repeats the immediately-previous pick
 * when a different candidate is available, on top of the cap.
 *
 * `sharedUsage`, when passed, is mutated in place instead of starting a
 * fresh Map — needed for delivery/proximity, whose wordings overlap heavily
 * between the male and female pools (proximity is the exact same 4-entry
 * pool for both). Without a shared counter, two independent per-gender calls
 * could each stay under cap individually while the SAME phrase (e.g. "soft
 * plate ambience") is picked by both a male and a female track, so a
 * listener still hears it repeat pack-wide more than the cap allows.
 * Register/timbre pools are 100% distinct strings between genders, so those
 * two axes are called with a fresh Map per gender (no cross-gender
 * collision is possible there).
 */
function pickTraitSequence(
  occurrences: number,
  pool: readonly string[],
  cap: number,
  seed: number,
  axisSeed: number,
  extraFilter?: (candidate: string, occurrenceIndex: number) => boolean,
  sharedUsage?: Map<string, number>,
  /**
   * TASK v3.72 (TASK C) — a soft weighting hint (not a filter): a candidate
   * with weight 2 is twice as likely to be the shuffle's first pick as
   * weight 1, but every other candidate stays reachable. Used to lean axis
   * selection toward a channel's own defaultVocal "character" without ever
   * forcing it — see channelFlavorWeight below.
   */
  preferenceWeight?: (candidate: string) => number
): string[] {
  const usage = sharedUsage ?? new Map<string, number>();
  const picks: string[] = [];
  for (let i = 0; i < occurrences; i++) {
    let candidates = pool.filter(value => (usage.get(value) ?? 0) < cap);
    if (!candidates.length) candidates = [...pool];
    if (extraFilter) {
      const filtered = candidates.filter(value => extraFilter(value, i));
      if (filtered.length) candidates = filtered;
    }
    const previous = picks[i - 1];
    const nonRepeating = candidates.length > 1 ? candidates.filter(value => value !== previous) : candidates;
    const finalCandidates = nonRepeating.length ? nonRepeating : candidates;
    const weighted = preferenceWeight
      ? finalCandidates.flatMap(value => Array<string>(Math.max(1, preferenceWeight(value))).fill(value))
      : finalCandidates;
    const pick = shuffle(weighted, seed + axisSeed + i * 97)[0];
    picks.push(pick);
    usage.set(pick, (usage.get(pick) ?? 0) + 1);
  }
  return picks;
}

/**
 * TASK v3.72 (TASK C) — defaultVocal is demoted from "every song's vocal
 * text" to "this channel's vocal CHARACTER": a soft weighting hint toward
 * axis values that share a describing word with it (e.g. a channel whose
 * defaultVocal says "husky" leans toward 'soft husky grain'/'worn weathered
 * edge' timbre), never a hard filter — every candidate stays reachable, this
 * only shifts the odds. Plain word-overlap counting, not semantic matching;
 * intentionally simple since this is a bias, not a rule (see this task's own
 * "축 선택의 가중치로 씁니다").
 */
function channelFlavorWeight(defaultVocal: string, candidate: string): number {
  const flavorWords = new Set(defaultVocal.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3));
  if (!flavorWords.size) return 1;
  const candidateWords = candidate.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const overlap = candidateWords.filter(w => flavorWords.has(w)).length;
  return 1 + overlap;
}

/**
 * TASK v3.72 (TASK E) — recentRegisterSignatures is core/vocalComboLedger.ts's
 * "M:<register>|F:<register>" strings from this channel's last few sets.
 * Every non-recent register gets a 2x pull relative to a recent one — a soft
 * lean, not an exclusion (a recent register can still be picked; it just
 * doesn't win ties as often), matching this task's own "강제하지는 마십시오.
 * 가중치 조정 수준으로".
 */
function recentComboAvoidanceWeight(recentRegisterSignatures: string[], candidate: string): number {
  const recentRegisters = new Set(
    recentRegisterSignatures.flatMap(signature => signature.split('|').map(part => part.slice(2)))
  );
  return recentRegisters.has(candidate) ? 1 : 2;
}

/**
 * TASK v3.72 (TASK B) — replaces the flat 5-variant ADULT_VOCAL_DESCRIPTIONS
 * lookup for every non-kids archetype. `plan` is the same VocalType[]
 * buildVocalPlan/applyAxisAllocation already produced ('mixed' = duet for
 * every non-kids archetype — see vocalGender resolution at both call sites);
 * this only decides the WORDING for each of those slots, never the type
 * counts/order themselves.
 *
 * `peakFlags[idx]` should be true exactly when trackNo idx+1's own killing
 * point relaxes SENIOR_AUDIENCE_PROFILE's 'comfortable mid vocal register'
 * (data/killingPoints.ts's `relaxes` list) — the ONE axis this task gates for
 * a senior audience; delivery/timbre/proximity stay fully open on every
 * track regardless of `isSenior`, per this task's own "음역만이 아니라
 * timbre·delivery·proximity 로도 충분히 구분됩니다" guidance.
 *
 * `channelDefaultVocal` (TASK v3.72 TASK C) softly biases register/timbre
 * selection toward this channel's own vocal character — see
 * channelFlavorWeight above.
 */
export function buildAdultVocalTraitPlan(
  plan: VocalType[],
  seed: number,
  options: { isSenior: boolean; peakFlags: boolean[]; channelDefaultVocal?: string; recentRegisterSignatures?: string[] }
): string[] {
  const result: string[] = new Array(plan.length).fill('');
  // Shared across BOTH genders — see pickTraitSequence's own doc comment.
  // Register/timbre pools are 100% distinct strings between genders so they
  // don't need this (fresh Map per gender, inline below).
  const deliveryUsage = new Map<string, number>();
  const proximityUsage = new Map<string, number>();

  (['male', 'female'] as const).forEach(gender => {
    const indices: number[] = [];
    plan.forEach((type, idx) => { if (type === gender) indices.push(idx); });
    if (!indices.length) return;

    const axes = gender === 'male' ? MALE_VOCAL_TRAIT_AXES : FEMALE_VOCAL_TRAIT_AXES;
    const peakOnly = gender === 'male' ? MALE_PEAK_ONLY_REGISTERS : FEMALE_PEAK_ONLY_REGISTERS;
    const contradictions = gender === 'male' ? MALE_REGISTER_TIMBRE_CONTRADICTIONS : FEMALE_REGISTER_TIMBRE_CONTRADICTIONS;
    const axisSeedBase = gender === 'male' ? 5101 : 6803;
    const flavorWeight = options.channelDefaultVocal
      ? (candidate: string) => channelFlavorWeight(options.channelDefaultVocal!, candidate)
      : undefined;
    const recentSignatures = options.recentRegisterSignatures;
    const registerWeight = (candidate: string) => {
      const flavor = flavorWeight ? flavorWeight(candidate) : 1;
      const avoidance = recentSignatures?.length ? recentComboAvoidanceWeight(recentSignatures, candidate) : 1;
      return flavor * avoidance;
    };

    const registers = pickTraitSequence(
      indices.length,
      axes.register,
      AXIS_REPEAT_CAPS.register,
      seed,
      axisSeedBase,
      (candidate, occurrenceIndex) => !peakOnly.has(candidate) || !options.isSenior || options.peakFlags[indices[occurrenceIndex]] === true,
      undefined,
      registerWeight
    );
    const deliveries = pickTraitSequence(indices.length, axes.delivery, AXIS_REPEAT_CAPS.delivery, seed, axisSeedBase + 401, undefined, deliveryUsage);
    const timbres = pickTraitSequence(
      indices.length,
      axes.timbre,
      AXIS_REPEAT_CAPS.timbre,
      seed,
      axisSeedBase + 809,
      (candidate, occurrenceIndex) => !contradictions.some(([reg, timb]) => reg === registers[occurrenceIndex] && timb === candidate),
      undefined,
      flavorWeight
    );
    const proximities = pickTraitSequence(indices.length, axes.proximity, AXIS_REPEAT_CAPS.proximity, seed, axisSeedBase + 1201, undefined, proximityUsage);

    indices.forEach((songIdx, i) => {
      result[songIdx] = `${registers[i]}, ${deliveries[i]}, ${timbres[i]}, ${proximities[i]}`;
    });
  });

  const duetIndices: number[] = [];
  plan.forEach((type, idx) => { if (type === 'mixed') duetIndices.push(idx); });
  if (duetIndices.length) {
    const pairings = pickTraitSequence(duetIndices.length, DUET_TRAIT_AXES.pairing, DUET_AXIS_REPEAT_CAPS.pairing, seed, 9001);
    const blends = pickTraitSequence(duetIndices.length, DUET_TRAIT_AXES.blend, DUET_AXIS_REPEAT_CAPS.blend, seed, 9401);
    duetIndices.forEach((songIdx, i) => {
      result[songIdx] = `${pairings[i]}, ${blends[i]}, male and female duet`;
    });
  }

  return result;
}

export interface VocalTraitDistribution {
  quota: VocalQuota;
  register: Record<string, number>;
  delivery: Record<string, number>;
  timbre: Record<string, number>;
}

/**
 * TASK v3.72 (TASK D) — Step2Plan.tsx's "보컬" confirmation card used to read
 * only the MANUAL diversityAllocations entry for 'vocalType', which is
 * undefined whenever the pack is using the (now-default, see TASK A) auto
 * quota — so the UI showed "-" even on a real 6/6/6 pack. This reads the
 * pack's actual resolved slots instead, so it reflects reality regardless of
 * auto/manual. Non-adult (kids) vocalText never matches these axis pools —
 * register/delivery/timbre stay empty for a kids pack, which the caller
 * should treat as "nothing to show" rather than an error.
 */
export function summarizeVocalTraitDistribution(slots: ReadonlyArray<{ vocalType?: VocalType; vocalText?: string }>): VocalTraitDistribution {
  const quota: VocalQuota = { male: 0, female: 0, mixed: 0 };
  const register: Record<string, number> = {};
  const delivery: Record<string, number> = {};
  const timbre: Record<string, number> = {};

  for (const slot of slots) {
    if (!slot.vocalType) continue;
    quota[slot.vocalType] += 1;
    if (slot.vocalType === 'mixed' || !slot.vocalText) continue;
    const axes = slot.vocalType === 'male' ? MALE_VOCAL_TRAIT_AXES : FEMALE_VOCAL_TRAIT_AXES;
    const foundRegister = axes.register.find(value => slot.vocalText!.startsWith(value));
    if (foundRegister) register[foundRegister] = (register[foundRegister] ?? 0) + 1;
    const foundDelivery = axes.delivery.find(value => slot.vocalText!.includes(value));
    if (foundDelivery) delivery[foundDelivery] = (delivery[foundDelivery] ?? 0) + 1;
    const foundTimbre = axes.timbre.find(value => slot.vocalText!.includes(value));
    if (foundTimbre) timbre[foundTimbre] = (timbre[foundTimbre] ?? 0) + 1;
  }

  return { quota, register, delivery, timbre };
}
