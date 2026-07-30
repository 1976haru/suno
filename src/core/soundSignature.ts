import type {
  ChannelProfile,
  GenerationOptions,
  GenrePack,
  PlaylistBlueprint,
  SoundSignature as SharedSoundSignature
} from '../types';
import { genrePacks, moodPacks, seasonPacks } from '../data/presets';
import { moneyChordPresets, resolveEarwormMoneyChordMode } from '../data/moneyChords';
import { countWords, STYLE_WORD_TARGET_MAX, SUNO_COPY_LIMIT } from './promptBudget';

export interface SoundSignature extends SharedSoundSignature {}

export const PERSONA_STYLE_LIMIT = 200;
const SHORT_SIGNATURE_TARGET = 120;
const FULL_SIGNATURE_LIMIT = 1000;

const SIGNATURE_FORBIDDEN = [
  /\bhook\b/i,
  /\btrack\s*\d+\b/i,
  /\b\d{2,3}\s*bpm\b/i,
  /\btitle\b/i,
  /\bthumbnail\b/i,
  /\btypography\b/i,
  /\bserif\b/i,
  /\blogo\b/i,
  /\bwatermark\b/i,
  /\bchristmas\b/i,
  /\bnew year\b/i,
  /\bspring\b/i,
  /\bsummer\b/i,
  /\bautumn\b/i,
  /\bfall\b/i,
  /\bwinter\b/i
];

function splitAtoms(text: string | undefined | null): string[] {
  if (!text) return [];
  return text.split(/[;,/]/).map(part => part.trim()).filter(Boolean);
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeAtom(value: string): string {
  return compactWhitespace(value)
    .replace(/\bseasonal\b/gi, '')
    .replace(/\bchristmas\b/gi, '')
    .replace(/\bwinter\b/gi, '')
    .replace(/\bautumn\b/gi, '')
    .replace(/\bfall\b/gi, '')
    .replace(/\bsummer\b/gi, '')
    .replace(/\bspring\b/gi, '')
    .replace(/\bnew year\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.\-\s]+|[,.\-\s]+$/g, '')
    .trim();
}

/**
 * TASK H4 (v3.14) — genre atoms are deliberately NOT run through
 * sanitizeAtom's season-word stripping. That stripping exists so a reusable
 * Persona signature doesn't get accidentally locked to whichever mood/season
 * pack happened to be selected on the pack that first built it (mood and
 * season selections vary independently pack-to-pack even when the same
 * Persona/genre is reused). A genre itself is different: 'Soft Christmas
 * Pop' being Christmas-themed is its actual, stable identity, not an
 * incidental leak — and diversityLinter's genre check caught exactly the
 * failure mode this produced: stripping "Christmas" from
 * christmas-soft-pop's first styleCore atom left "nostalgic acoustic pop",
 * byte-identical to the real acoustic-pop genre's own atom.
 */
function sanitizeGenreAtom(value: string): string {
  return compactWhitespace(value)
    .replace(/^[,.\-\s]+|[,.\-\s]+$/g, '')
    .trim();
}

function isAllowedSignatureAtom(value: string): boolean {
  const atom = sanitizeAtom(value);
  return atom.length > 1 && !SIGNATURE_FORBIDDEN.some(pattern => pattern.test(atom));
}

function dedupeAtoms(atoms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of atoms) {
    const atom = sanitizeAtom(raw);
    if (!atom) continue;
    const key = atom.toLowerCase().replace(/^(soft|warm|light)\s+/, '').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(atom);
  }
  return out;
}

function joinWithin(atoms: string[], limit: number): string {
  const kept: string[] = [];
  for (const atom of atoms) {
    const candidate = [...kept, atom].join(', ');
    if (candidate.length <= limit) kept.push(atom);
  }
  if (kept.length) return kept.join(', ');
  const first = atoms[0] || '';
  return first.length <= limit ? first : first.slice(0, Math.max(0, limit - 1)).trim();
}

function joinShortSignature(input: {
  genreAtom: string;
  moods: string[];
  instruments: string[];
  vocal: string;
  production: string[];
}): string {
  const production = input.production.map(sanitizeAtom).find(Boolean);
  const prefix = dedupeAtoms([
    input.genreAtom,
    ...input.moods.slice(0, 1),
    ...input.instruments.slice(0, 2)
  ]).filter(isAllowedSignatureAtom);
  const vocal = sanitizeAtom(input.vocal);
  const requiredTail = [vocal, production].filter(Boolean);
  while (prefix.length && [...prefix, ...requiredTail].join(', ').length > SHORT_SIGNATURE_TARGET) {
    prefix.pop();
  }
  const kept = [...prefix, vocal].filter(Boolean);
  if (production) {
    const candidate = [...kept, production].join(', ');
    if (candidate.length <= SHORT_SIGNATURE_TARGET) kept.push(production);
  }
  return kept.join(', ');
}

function resolveGenre(id: string | undefined): GenrePack | undefined {
  if (!id) return undefined;
  return genrePacks.find(genre => genre.id === id);
}

function compactSignatureInstrument(value: string): string {
  return sanitizeAtom(value)
    .replace(/^clean strummed acoustic guitar$/i, 'acoustic guitar')
    .replace(/^fingerpicked acoustic guitar$/i, 'acoustic guitar')
    .replace(/^straight-pop drum kit$/i, 'soft drum kit');
}

function shortSignatureInstruments(instruments: string[]): string[] {
  const compacted = dedupeAtoms(instruments.map(compactSignatureInstrument));
  const guitar = compacted.find(instrument => /\bguitar\b/i.test(instrument));
  if (!guitar) return compacted;
  return [guitar, ...compacted.filter(instrument => instrument !== guitar)];
}

function primaryGenreAtom(genre: GenrePack | undefined) {
  if (!genre) return 'warm original pop';
  const first = splitAtoms(genre.shortPrompt || genre.styleCore)[0] || genre.label;
  return sanitizeGenreAtom(first) || 'warm original pop';
}

function moodAtoms(opts: GenerationOptions) {
  return opts.moodIds
    .map(id => moodPacks.find(mood => mood.id === id))
    .filter(Boolean)
    .flatMap(mood => mood!.emotionWords.slice(0, 2))
    .filter(isAllowedSignatureAtom);
}

/**
 * TASK v3.39 Part D/H — the kids channel's kid-boy/kid-girl/kid-choir
 * presets (data/vocalPresets.ts) contained none of the adult-only markers
 * below ("female"/"male"/"tenor"/"baritone"), so all three previously
 * compacted to the same "soft close-mic vocal" fallback — a real
 * diversity-linter regression (tests/diversityLinter.test.ts). "childlike"
 * and "choir"/"boy"/"girl" give each preset its own distinct compact text.
 *
 * TASK v3.41 — the preset pool grew 5->16 (adult) and 3->10 (kids), and the
 * same regression showed up again at the new scale (e.g. airy-falsetto-male
 * and bright-young-male both compacted to "male soft"). Added: a dedicated
 * branch for duet/chant/group presets (none of which have a single gender to
 * report), and more tone/range/delivery keywords pulled from the new
 * presets' own wording. The husky/soulful/breathy/default tone outputs and
 * the tenor/baritone range outputs are byte-identical to before this task —
 * several tests assert the literal string "male soft husky tenor close-mic"
 * for the default channel's vocal preset.
 */
export function compactVocalAtom(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('duet')) {
    return lower.includes('childlike') ? 'childlike duet' : 'duet';
  }
  if (lower.includes('choir')) {
    const age = lower.includes('childlike') || lower.includes('kindergarten')
      ? 'childlike '
      : lower.includes('children') ? 'kids ' : '';
    const style = lower.includes('unison') ? ' unison'
      : lower.includes('round') ? ' round'
      : lower.includes('solo') || lower.includes('lead') ? ' solo-lead'
      : lower.includes('call-and-response') || lower.includes('call and response') ? ' call-response'
      : '';
    return `${age}choir${style}`.trim();
  }
  if (lower.includes('chant')) return 'chant group';
  if (lower.includes('group')) return 'group harmony';

  const childlike = lower.includes('childlike') || lower.includes('kindergarten');
  const gender = lower.includes('female') || lower.includes('woman') || lower.includes('girl')
    ? 'female'
    : lower.includes('male') || lower.includes('tenor') || lower.includes('baritone') || lower.includes('boy')
      ? 'male'
      : '';
  const range = lower.includes('falsetto') ? 'falsetto'
    : lower.includes('soprano') ? 'soprano'
    : lower.includes('tenor') ? 'tenor'
    : lower.includes('baritone') ? 'baritone'
    : lower.includes('alto') ? 'alto'
    : lower.includes('mezzo') ? 'mezzo'
    : '';
  const tone = lower.includes('husky') ? 'soft husky'
    : lower.includes('soulful') ? 'soulful'
    : lower.includes('breathy') ? 'breathy'
    : lower.includes('smoky') ? 'smoky'
    : lower.includes('airy') ? 'airy'
    : lower.includes('whisper') ? 'whisper'
    : lower.includes('bright') ? 'bright'
    : lower.includes('confident') ? 'confident'
    : lower.includes('elegant') ? 'elegant'
    : 'soft';
  const delivery = lower.includes('close') ? 'close-mic'
    : lower.includes('restrained') ? 'restrained'
    : /\byoung\b/.test(lower) ? 'young'
    : '';
  return [childlike ? 'childlike' : '', gender, tone, range, delivery].filter(Boolean).join(' ') || 'soft close-mic vocal';
}

function productionAtoms(genre: GenrePack | undefined) {
  const raw = genre?.production?.length ? genre.production : ['warm analog mix', 'radio-friendly polish'];
  return dedupeAtoms(raw).slice(0, 2);
}

function seasonWordForPersona(opts: GenerationOptions, channel: ChannelProfile) {
  const id = opts.seasonId;
  const family =
    /spring|cherry|may/.test(id) ? 'spring' :
      /summer|rain/.test(id) ? 'summer' :
        /autumn|fall|thanksgiving|halloween/.test(id) ? 'autumn' :
          /winter|christmas|new-year|year|first-snow/.test(id) ? 'winter' :
            'season';
  if (channel.market === 'japan') {
    return { spring: '\u6625', summer: '\u590F', autumn: '\u79CB', winter: '\u51AC', season: '\u5B63\u7BC0' }[family];
  }
  if (channel.market === 'korea') {
    return { spring: '\uBD04', summer: '\uC5EC\uB984', autumn: '\uAC00\uC744', winter: '\uACA8\uC6B8', season: '\uACC4\uC808' }[family];
  }
  return { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter', season: 'Season' }[family];
}

function vocalWordForPersona(value: string, channel: ChannelProfile) {
  const lower = value.toLowerCase();
  const female = lower.includes('female') || lower.includes('woman');
  const tenor = lower.includes('tenor');
  if (channel.market === 'japan') {
    if (female) return '\u5973\u6027\u30BD\u30D5\u30C8';
    if (tenor) return '\u7537\u6027\u30C6\u30CA\u30FC';
    return '\u30BD\u30D5\u30C8\u30DC\u30FC\u30AB\u30EB';
  }
  if (channel.market === 'korea') {
    if (female) return '\uC5EC\uC131\uC18C\uD504\uD2B8';
    if (tenor) return '\uB0A8\uC131\uD14C\uB108';
    return '\uC18C\uD504\uD2B8\uBCF4\uCEEC';
  }
  if (female) return 'Soft Female';
  if (tenor) return 'Male Tenor';
  return 'Soft Vocal';
}

function personaNameFor(blueprint: PlaylistBlueprint, opts: GenerationOptions, channel: ChannelProfile) {
  const channelName = channel.name || blueprint.channelName;
  const season = seasonWordForPersona(opts, channel);
  const vocal = vocalWordForPersona(opts.vocalTone || blueprint.vocalSignature || channel.defaultVocal, channel);
  return `${channelName} · ${season} · ${vocal}`;
}

export function buildSoundSignature(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  channel: ChannelProfile
): SoundSignature {
  const primaryGenre = resolveGenre(opts.genreIds[0]);
  const genreAtom = primaryGenreAtom(primaryGenre);
  const moods = dedupeAtoms(moodAtoms(opts)).slice(0, 2);
  const instruments = dedupeAtoms((primaryGenre?.instruments || []).filter(isAllowedSignatureAtom)).slice(0, 3);
  const shortInstruments = shortSignatureInstruments(primaryGenre?.instruments || []).slice(0, 3);
  const vocal = compactVocalAtom(opts.vocalTone || blueprint.vocalSignature || channel.defaultVocal);
  const production = productionAtoms(primaryGenre);

  const fullAtoms = dedupeAtoms([
    genreAtom,
    ...moods,
    ...instruments,
    vocal,
    ...production,
    ...(primaryGenre?.harmony || []).slice(0, 2),
    ...(primaryGenre?.rhythm || []).slice(0, 2)
  ]).filter(isAllowedSignatureAtom);

  const short = joinShortSignature({ genreAtom, moods, instruments: shortInstruments, vocal, production });
  const full = joinWithin(fullAtoms, FULL_SIGNATURE_LIMIT);
  return {
    short,
    full,
    personaName: personaNameFor(blueprint, opts, channel),
    shortLength: short.length,
    fullLength: full.length
  };
}

export function compactGenreKeyword(genres: GenrePack[]) {
  return primaryGenreAtom(genres[0]);
}

/**
 * TASK H3 (v3.14) — reads MoneyChordPreset.compactProgression directly
 * instead of regex-extracting a Roman-numeral run out of `prompt`. That
 * regex made 'emotional' collapse to the exact same output as 'default'
 * (both happen to contain the literal substring "I-V-vi-IV" despite meaning
 * different things), and made 'showaModern' match nothing at all — its
 * "IVmaj7-iii7-vi7" notation has digits and "maj7" the roman-numeral-only
 * character class rejected — silently falling back to the content-free
 * 'money chord progression' string. See diversityLinter.ts for the
 * regression guard against this ever recurring silently.
 */
export interface CompactMoneyChordOptions {
  /** TASK v3.33 Part C — per-song progression quota override (see core/moneyChordPlan.ts's buildProgressionPlan): a specific preset id for this trackNo, bypassing opts.moneyChordMode/earworm resolution entirely. Only ever set when core/moneyChordPlan.ts's usesMoneyChordQuota(opts) is true. */
  moneyChordIdOverride?: string;
  /**
   * TASK v3.33 Part C — real listening feedback: the bare progression name
   * alone reads as vague to Suno.
   *
   * TASK v3.42 Part B3 — previously appended the fixed MONEY_CHORD_FEEL_SUFFIX
   * ("hook lands on the downbeat, clear on-beat chord changes, bass on the
   * root, strong chorus lift") — identical across every preset and every
   * song, measured as 1 of the 20 clauses common to all 15 songs in a real
   * pack. Now appends that preset's own `audibleEffect` instead, so the
   * reinforcement text itself varies with the chosen progression instead of
   * being boilerplate.
   */
  includeFeelReinforcement?: boolean;
}

/**
 * TASK v3.58 (TASK 5-1) — was appended to every money-chord atom
 * ("... Keep this progression as the harmonic spine from verse through
 * final chorus."). Measured 18/18 in a real pack: a 76-character
 * imperative sentence, not a comma-separated descriptor, in a Style field
 * Suno reads as a bag of tags rather than instructions to follow — pure
 * overhead that also diluted the descriptors around it. Kept as an export
 * (rather than deleted outright) only so nothing importing it breaks the
 * build; no code appends it anymore.
 */
export const MONEY_CHORD_ADHERENCE_TEXT = 'Keep this progression as the harmonic spine from verse through final chorus.';

export function compactMoneyChord(opts: Pick<GenerationOptions, 'moneyChordMode' | 'customMoneyChord' | 'earwormMode'>, options: CompactMoneyChordOptions = {}) {
  const { moneyChordIdOverride, includeFeelReinforcement = false } = options;
  if (!moneyChordIdOverride && opts.moneyChordMode === 'custom' && opts.customMoneyChord.trim()) {
    const base = `custom progression ${clipClause(opts.customMoneyChord.trim(), 42)}`;
    return includeFeelReinforcement ? `${base}, ${moneyChordPresets.custom.audibleEffect}` : base;
  }
  const effectiveMode = moneyChordIdOverride ?? resolveEarwormMoneyChordMode(opts.moneyChordMode, opts.earwormMode);
  const preset = moneyChordPresets[effectiveMode] || moneyChordPresets.default;
  return includeFeelReinforcement ? `${preset.compactProgression} - ${preset.audibleEffect}` : preset.compactProgression;
}

/**
 * TASK v3.29 — "under X:XX" / "around X:XX" alone reads as an upper bound
 * only, so a short lyric (see promptComposer.ts's MIN_LYRIC_WORDS) can still
 * produce a short song without technically violating this text — a real
 * 20-song sample rendered at ~2:00-2:20 despite a 2:50-3:20 target. The
 * optional `includeMinimumFloor` appends an explicit lower-bound phrase
 * ("full ~N minute arrangement, not a short cut") — opt-in (default off) so
 * it only costs budget where there's room for it (the main, non-persona
 * style prompt has ~900 chars of headroom); Persona mode's ~200-char budget
 * (buildPersonaStylePrompt) and any other terse/tight caller keep the
 * original short text by leaving this at its default. terse itself is
 * unaffected either way (character-budget-critical callers only need the
 * bare time range).
 */
export function compactDuration(target: GenerationOptions['durationTarget'], terse = false, includeMinimumFloor = false) {
  if (terse) {
    if (target === 'under4m') return 'under 4:00';
    if (target === 'playlistShort') return '2:50-3:20';
    return '3:10-3:35';
  }
  const base = target === 'under4m'
    ? 'short intro, under 4:00'
    : target === 'playlistShort'
      ? 'quick intro, 2:50-3:20'
      : 'short intro, 3:10-3:35';
  if (!includeMinimumFloor) return base;
  // TASK v3.59 (TASK D-2) — the default target's floor phrase used to
  // restate the exact same "3:10-3:35" range `base` already states,
  // producing "short intro, 3:10-3:35, full ~3:10-3:35 arrangement, not a
  // short cut" — the identical time range appearing twice in one atom. The
  // other two targets aren't exact repeats (under4m's base is only an upper
  // bound, "under 4:00"; playlistShort's floor uses different phrasing,
  // "~3 minute") so they're left as distinct, non-duplicated information.
  const floor = target === 'under4m'
    ? 'full ~3:30-4:00 arrangement, not a short cut'
    : target === 'playlistShort'
      ? 'full ~3 minute arrangement, not a short 2-minute cut'
      : 'full arrangement, not a short cut';
  return `${base}, ${floor}`;
}

/**
 * TASK I1 (v3.11) — shared by both the plain and Persona-mode style-prompt
 * builders (core/localGenerator.ts) so there's exactly one definition of what
 * a cold-open's duration atom says. Every non-cold-open role is untouched
 * (exactly compactDuration's normal output). 'hook-forward' drops the
 * "short/quick intro," prefix entirely — keeping it would read as
 * self-contradictory next to "no instrumental intro". 'hum-intro' keeps the
 * prefix (a 2-bar hum still is a short intro) and prepends the wordless-hum
 * direction.
 */
export function openingDurationText(
  role: string,
  openingStyle: 'hook-forward' | 'hum-intro' | undefined,
  durationTarget: GenerationOptions['durationTarget']
): string {
  const standard = compactDuration(durationTarget, false);
  if (role !== 'cold-open') return standard;
  if (openingStyle === 'hum-intro') {
    return `cold open, wordless hum motif before vocal enters, ${standard}`;
  }
  const timeOnly = standard.replace(/^(short|quick) intro,\s*/, '');
  return `no instrumental intro, hook heard immediately, ${timeOnly}`;
}

/**
 * TASK v3.59 (TASK D-1) — the exact same condition openingDurationText's
 * own 'hook-forward' cold-open branch above uses to say "no instrumental
 * intro, hook heard immediately". A real generated pack still added an
 * unrelated introTexture atom ("light pizzicato strings intro texture
 * (INTRO ONLY)") to that same track regardless — the two atoms directly
 * contradict each other in the same style prompt. 'hum-intro' cold-opens
 * are excluded here (return false): they keep the "short/quick intro"
 * duration wording (a hummed intro is still a short intro, just wordless),
 * so an intro-texture atom coexists fine there.
 */
export function coldOpenHasNoInstrumentalIntro(role: string, openingStyle: 'hook-forward' | 'hum-intro' | undefined): boolean {
  return role === 'cold-open' && openingStyle !== 'hum-intro';
}

function clipClause(value: string, limit: number) {
  const clean = compactWhitespace(value).replace(/[,;]+$/g, '');
  if (clean.length <= limit) return clean;
  return clean.slice(0, Math.max(0, limit - 1)).replace(/\s+\S*$/, '').trim();
}

/**
 * TASK v3.39 Part F — previously embedded the literal hook lyric text in
 * quotes (hook "<lyric>" repeats chorus 4x). That text lands verbatim in
 * Suno's style/description field, and real production output showed an
 * AI-creative hook fragment coincidentally matching a substring Suno's
 * artist-name filter blocks (e.g. a fragment reading as "wayo"), silently
 * getting the whole style prompt rejected. The hook line already repeats in
 * "lyrics" itself (see core/hookStyleDirectives's caller and quality.ts's own
 * verbatim-bookend checks) — the style prompt only ever needed to tell Suno
 * *that* the chorus hook repeats, never *which words* it is, so hookPhrase is
 * intentionally unused here now. Kept as a parameter (not removed) so this
 * signature doesn't ripple through every caller for a purely internal change.
 */
export function compactHook(_hookPhrase: string, lyricDepth: GenerationOptions['lyricDepth'], terse = false) {
  const returns = lyricDepth === 'poetic' ? '3x' : '4x';
  if (terse) return `repeated chorus hook, ${returns}`;
  return `strong repeated chorus hook, repeats chorus ${returns}`;
}

function fillWithinLimit(clauses: string[], limit: number) {
  return clauses
    .map(clause => clause.trim())
    .filter(Boolean)
    .reduce<string[]>((kept, clause) => {
      const candidate = [...kept, clause].join(', ');
      return candidate.length <= limit ? [...kept, clause] : kept;
    }, [])
    .join(', ');
}

function isVocalAtom(value: string) {
  return /\b(vocal|male|female|tenor|baritone|close-mic|husky|breathy|soulful)\b/i.test(value);
}

function isMixAtom(value: string) {
  return /\b(mix|polish|production|analog|master)\b/i.test(value);
}

interface SeedSignatureParts {
  genre: string;
  mood?: string;
  instruments: string[];
  vocal: string;
  mix?: string;
}

function seedSignatureParts(signature: SoundSignature, opts: GenerationOptions, genres: GenrePack[]): SeedSignatureParts {
  const atoms = splitAtoms(signature.short);
  const genre = atoms[0] || compactGenreKeyword(genres);
  const vocalIndex = atoms.findIndex((atom, index) => index > 0 && isVocalAtom(atom));
  const vocal = vocalIndex >= 0 ? atoms[vocalIndex] : compactVocalAtom(opts.vocalTone);
  const beforeVocal = vocalIndex >= 0 ? atoms.slice(1, vocalIndex) : atoms.slice(1);
  const afterVocal = vocalIndex >= 0 ? atoms.slice(vocalIndex + 1) : [];
  const mix = afterVocal.find(isMixAtom) || afterVocal[0];
  const mood = beforeVocal[0];
  const instruments = beforeVocal.slice(mood ? 1 : 0);

  return {
    genre,
    mood,
    instruments,
    vocal,
    mix
  };
}

function joinSeedClauses(parts: {
  genre: string;
  mood?: string;
  instruments: string[];
  vocal: string;
  mix?: string;
  hook: string;
  money: string;
  tempo: string;
  duration: string;
  role?: string;
}) {
  return [
    parts.genre,
    parts.mood,
    ...parts.instruments,
    parts.vocal,
    parts.mix,
    parts.hook,
    parts.money,
    parts.tempo,
    parts.duration,
    parts.role
  ].filter(Boolean).join(', ').replace(/,\s*$/g, '');
}

function buildSeedPersonaStylePrompt(input: PersonaStylePromptInput, limit: number): PersonaStylePromptResult {
  const signatureParts = seedSignatureParts(input.signature, input.opts, input.genres);
  const parts: SeedSignatureParts & {
    hook: string;
    money: string;
    tempo: string;
    duration: string;
    role?: string;
  } = {
    ...signatureParts,
    instruments: [...signatureParts.instruments],
    hook: compactHook(input.hookPhrase, input.opts.lyricDepth, false),
    money: compactMoneyChord(input.opts),
    tempo: `${input.tempo} BPM`,
    duration: openingDurationText(input.role, input.openingStyle, input.opts.durationTarget),
    role: `track ${input.trackNo}: ${clipClause(input.role, 22)}`
  };
  const droppedTerms: string[] = [];

  const dropIfNeeded = (label: string, drop: () => boolean) => {
    if (joinSeedClauses(parts).length <= limit) return;
    if (drop()) droppedTerms.push(label);
  };

  dropIfNeeded('track role', () => {
    if (!parts.role) return false;
    parts.role = undefined;
    return true;
  });
  dropIfNeeded('mood', () => {
    if (!parts.mood) return false;
    parts.mood = undefined;
    return true;
  });
  dropIfNeeded('mix note', () => {
    if (!parts.mix) return false;
    parts.mix = undefined;
    return true;
  });

  while (joinSeedClauses(parts).length > limit && parts.instruments.length > 0) {
    const removed = parts.instruments.pop();
    if (removed) droppedTerms.push(`instrument: ${removed}`);
  }

  const prompt = joinSeedClauses(parts);
  const wordCount = countWords(prompt);
  return {
    prompt,
    length: prompt.length,
    withinLimit: prompt.length <= limit,
    droppedTerms,
    wordCount,
    withinWordTarget: wordCount <= STYLE_WORD_TARGET_MAX
  };
}

export interface PersonaStylePromptInput {
  signature: SoundSignature;
  opts: GenerationOptions;
  genres: GenrePack[];
  hookPhrase: string;
  trackNo: number;
  role: string;
  tempo: number;
  isSeed: boolean;
  limit?: number;
  /** TASK I1 (v3.11) — only meaningful when role === 'cold-open' (always the seed track, trackNo 1). */
  openingStyle?: 'hook-forward' | 'hum-intro';
}

export interface PersonaStylePromptResult {
  prompt: string;
  length: number;
  withinLimit: boolean;
  droppedTerms: string[];
  wordCount: number;
  withinWordTarget: boolean;
}

export function buildPersonaStylePrompt(input: PersonaStylePromptInput): PersonaStylePromptResult {
  const limit = input.isSeed
    ? Math.min(input.limit || SUNO_COPY_LIMIT, SUNO_COPY_LIMIT)
    : Math.min(input.limit || PERSONA_STYLE_LIMIT, PERSONA_STYLE_LIMIT);
  if (input.isSeed) return buildSeedPersonaStylePrompt(input, limit);

  const hook = compactHook(input.hookPhrase, input.opts.lyricDepth, false);
  const money = compactMoneyChord(input.opts);
  const tempo = `${input.tempo} BPM`;
  const duration = compactDuration(input.opts.durationTarget, false);
  const role = `track ${input.trackNo}: ${clipClause(input.role, 22)}`;
  // TASK v3.39 Part H — real production output showed vocal gender vanishing
  // completely from every non-seed track in persona mode (track 1 carried it
  // via the seed signature; tracks 2+ built this clause list with no vocal
  // atom at all). Placed right after `identity` — the same "protected by
  // position" pattern the seed branch already relies on — so it's never the
  // first thing length-compression below drops.
  const vocal = compactVocalAtom(input.opts.vocalTone || input.opts.channel.defaultVocal);
  const requiredSongClauses = [hook, money, tempo, duration];

  const identity = compactGenreKeyword(input.genres);

  const clauses = [identity, vocal, ...requiredSongClauses];
  const droppedTerms: string[] = [];
  const withRole = [...clauses, role].join(', ');
  let prompt = withRole.length <= limit ? withRole : clauses.join(', ');
  if (withRole.length > limit) droppedTerms.push('track role');

  if (prompt.length > limit) {
    prompt = input.isSeed
      ? fillWithinLimit([identity, hook, money, tempo, duration, role], limit)
      : fillWithinLimit(prompt.split(','), limit);
    droppedTerms.push('length compression');
  }

  const finalPrompt = prompt.replace(/,\s*$/g, '');
  const wordCount = countWords(finalPrompt);
  return {
    prompt: finalPrompt,
    length: finalPrompt.length,
    withinLimit: finalPrompt.length <= limit,
    droppedTerms,
    wordCount,
    withinWordTarget: wordCount <= STYLE_WORD_TARGET_MAX
  };
}

export function soundSignatureFromSaved(value: SharedSoundSignature | undefined): SoundSignature | undefined {
  if (!value) return undefined;
  return {
    short: value.short,
    full: value.full,
    personaName: value.personaName,
    shortLength: value.shortLength ?? value.short.length,
    fullLength: value.fullLength ?? value.full.length
  };
}

export function seasonLabelForSignature(opts: GenerationOptions) {
  return seasonPacks.find(season => season.id === opts.seasonId)?.label || opts.seasonId;
}
