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

function resolveGenre(id: string | undefined): GenrePack | undefined {
  if (!id) return undefined;
  return genrePacks.find(genre => genre.id === id);
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

export function compactVocalAtom(value: string) {
  const lower = value.toLowerCase();
  const gender = lower.includes('female') || lower.includes('woman')
    ? 'female'
    : lower.includes('male') || lower.includes('tenor') || lower.includes('baritone')
      ? 'male'
      : '';
  const range = lower.includes('tenor') ? 'tenor' : lower.includes('baritone') ? 'baritone' : '';
  const tone = lower.includes('husky') ? 'soft husky' : lower.includes('soulful') ? 'soulful' : lower.includes('breathy') ? 'breathy' : 'soft';
  const delivery = lower.includes('close') ? 'close-mic' : lower.includes('restrained') ? 'restrained' : '';
  return [gender, tone, range, delivery].filter(Boolean).join(' ') || 'soft close-mic vocal';
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
  const vocal = compactVocalAtom(opts.vocalTone || blueprint.vocalSignature || channel.defaultVocal);
  const production = productionAtoms(primaryGenre);

  const shortAtoms = dedupeAtoms([
    genreAtom,
    ...moods.slice(0, 1),
    ...instruments.slice(0, 2),
    vocal,
    ...production.slice(0, 1)
  ]).filter(isAllowedSignatureAtom);

  const fullAtoms = dedupeAtoms([
    genreAtom,
    ...moods,
    ...instruments,
    vocal,
    ...production,
    ...(primaryGenre?.harmony || []).slice(0, 2),
    ...(primaryGenre?.rhythm || []).slice(0, 2)
  ]).filter(isAllowedSignatureAtom);

  const short = joinWithin(shortAtoms, SHORT_SIGNATURE_TARGET);
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
export function compactMoneyChord(opts: GenerationOptions) {
  if (opts.moneyChordMode === 'custom' && opts.customMoneyChord.trim()) {
    return `custom progression ${clipClause(opts.customMoneyChord.trim(), 42)}`;
  }
  const effectiveMode = resolveEarwormMoneyChordMode(opts.moneyChordMode, opts.earwormMode);
  const preset = moneyChordPresets[effectiveMode] || moneyChordPresets.default;
  return preset.compactProgression;
}

export function compactDuration(target: GenerationOptions['durationTarget'], terse = false) {
  if (terse) {
    if (target === 'under4m') return 'under 4:00';
    if (target === 'playlistShort') return '2:50-3:20';
    return '3:10-3:35';
  }
  if (target === 'under4m') return 'short intro, under 4:00';
  if (target === 'playlistShort') return 'quick intro, 2:50-3:20';
  return 'short intro, 3:10-3:35';
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

function clipClause(value: string, limit: number) {
  const clean = compactWhitespace(value).replace(/[,;]+$/g, '');
  if (clean.length <= limit) return clean;
  return clean.slice(0, Math.max(0, limit - 1)).replace(/\s+\S*$/, '').trim();
}

export function compactHook(hookPhrase: string, lyricDepth: GenerationOptions['lyricDepth'], terse = false) {
  const returns = lyricDepth === 'poetic' ? '3x' : '4x';
  if (terse) return `hook "${clipClause(hookPhrase, 32)}" ${returns}`;
  return `hook "${clipClause(hookPhrase, 32)}" repeats chorus ${returns}`;
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
  const requiredSongClauses = [hook, money, tempo, duration];

  const identity = compactGenreKeyword(input.genres);

  const clauses = [identity, ...requiredSongClauses];
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
