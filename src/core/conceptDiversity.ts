import type { ChannelArchetype, GenrePack } from '../types';
import type { PromptTermId } from './promptBudget';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';

export interface ConceptInfluence {
  key: string;
  styleText: string;
  lyricImages: string[];
}

interface ConceptPreset {
  key: string;
  aliases: string[];
  styleText: string;
  lyricImages: string[];
}

// Keep this table deliberately small and concrete: these atoms are music and
// lyric direction, not a raw translation of the user's UI text.
//
// TASK v3.58 — every lyricImages entry here is spliced into lyricEngine.ts's
// templates as a bare noun (either "The ${motif}" or via likeMotif(), which
// prepends its own "a"/"an"). Roughly half these entries used to carry their
// own leading article/"the" ('a quiet cafe table', 'an open road', 'the
// first snow', ...), producing a visible double-article bug in real output
// ("The a quiet cafe table...", "like an an open road..."). Every entry
// below is a bare noun phrase for the same reason fallbackConcept's own
// fallback phrases were fixed (see below).
const CONCEPT_PRESETS: ConceptPreset[] = [
  { key: 'morning-cafe', aliases: ['아침 카페', 'morning cafe', 'coffee morning', '아침 커피'], styleText: 'morning light, coffee aroma, gentle wake, soft acoustic opening', lyricImages: ['coffee steam', 'pale morning light', 'quiet cafe table'] },
  { key: 'rainy-night', aliases: ['비 오는 밤', 'rainy night', 'rain on window', '비 오는'], styleText: 'rain on window, late-night solitude, mellow reverb, minor-key hush', lyricImages: ['rain on the window', 'late-night lamp', 'wet pavement reflections'] },
  { key: 'city-lights', aliases: ['도시의 불빛', 'city lights', 'neon city', '도시 불빛'], styleText: 'city neon, evening drive, smooth groove, clean electric textures', lyricImages: ['city neon', 'windshield at dusk', 'lights crossing the avenue'] },
  { key: 'youth-dreams', aliases: ['청춘과 꿈', 'youth and dreams', 'young dreams', '청춘 꿈'], styleText: 'youthful energy, open road, uplifting build, bright forward rhythm', lyricImages: ['open road', 'pocket full of plans', 'sunrise beyond the hill'] },
  { key: 'old-radio', aliases: ['추억의 라디오', 'old radio', 'memory radio', '오래된 라디오'], styleText: 'old-radio warmth, tape softness, familiar melody turns, intimate room tone', lyricImages: ['softly glowing radio', 'faded photograph', 'familiar voice through static'] },
  { key: 'season-change', aliases: ['계절의 변화', 'season change', 'changing seasons', '계절 변화'], styleText: 'shifting seasonal colors, changing light, gradual arrangement bloom', lyricImages: ['leaves changing color', 'coat by the door', 'first breath of cold air'] },
  { key: 'old-friendship', aliases: ['오래된 우정', 'old friendship', 'lifelong friends', '오랜 우정'], styleText: 'trusted warmth, conversational verses, hand-played ensemble, shared chorus', lyricImages: ['two cups on a table', 'well-worn address book', 'laughter after many years'] },
  { key: 'seaside-memory', aliases: ['바다의 추억', 'seaside memory', 'ocean memory', '바다 추억'], styleText: 'open coastal air, rolling rhythm, salt-bright guitar, spacious horizon', lyricImages: ['salt air', 'small harbor', 'blue light on the water'] },
  { key: 'garden-walk', aliases: ['정원 산책', 'garden walk', 'quiet garden', '정원'], styleText: 'dew-covered garden, unhurried walking pulse, natural acoustic detail', lyricImages: ['dew on leaves', 'stone garden path', 'green shade after rain'] },
  { key: 'long-drive', aliases: ['긴 드라이브', 'long drive', 'road trip', '드라이브'], styleText: 'long-road momentum, steady cruising beat, wide stereo guitars, open-window lift', lyricImages: ['road lines at noon', 'open car window', 'towns passing slowly'] },
  { key: 'christmas-cafe', aliases: ['크리스마스 카페', 'christmas cafe', 'holiday cafe', '성탄 카페'], styleText: 'warm holiday cafe, subtle bells, candlelit harmony, restrained seasonal glow', lyricImages: ['candlelight', 'handwritten card', 'bells beyond the cafe door'] },
  { key: 'first-snow', aliases: ['첫눈', 'first snow', 'winter snow', '첫 눈'], styleText: 'first-snow stillness, soft piano air, clear high register, tender lift', lyricImages: ['first snow', 'scarf on a chair', 'footprints in quiet white'] }
];

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, ' ').trim();
}

// TASK v3.58 — a free-text customConcept like "비틀즈 스타일로, 아침에 커피와
// 함께..." (an artist-reference-carrying INSTRUCTION to this app) so far
// only had its style-prompt use guarded (see TASK 3's
// artistReferenceDecomposer.ts/artistReferenceStyleAtoms). This is the
// separate, older path: `clean` (the raw customConcept text) was used
// directly as a lyricImage, so a real generated pack literally sang the
// whole input sentence, artist name included, as a chorus/verse line (see
// core/lyricEngine.ts's pickFlavor()). Any text carrying a detected artist
// reference, or plain style-reference framing words that so often
// accompany one (Korean/Japanese/English), falls back to a generic,
// always-safe image instead of a partial in-place redaction — fixing up
// word boundaries/particles around a stripped span isn't reliable,
// especially for Korean.
const STYLE_REFERENCE_FRAMING_PATTERN = /스타일로|스타일의|처럼\s|같이\s|in the style of|sounds? like|っぽく|風に/iu;

/** A ConceptInfluence with no real content — same as "no concept" to every caller (conceptLyricImages's `?? []`, conceptStyleText's own empty-styleText check below). */
const EMPTY_CONCEPT_INFLUENCE: ConceptInfluence = { key: 'custom', styleText: '', lyricImages: [] };

/**
 * TASK v3.59 (TASK A-2) — this used to substitute meta-description
 * placeholder phrases ('private memory', 'small meaningful detail',
 * 'personal scene details', 'custom concept focus') whenever it couldn't
 * safely use the raw text, and those placeholders got woven straight into
 * sung lyrics via lyricEngine.ts's pickFlavor() — a real generated pack sang
 * "The small meaningful detail leans in closer" and "like a private
 * memory" as if they were genuine scene imagery. A wrong/absent concept
 * image is strictly better than a wrong one: when no safe image can be
 * extracted, this now returns no concept influence at all, and every
 * caller already has a clean fallback for that (the channel/genre/season
 * image banks lyricEngine.ts's pickFlavor() draws from when conceptImages
 * is empty).
 *
 * Also folds in TASK v3.58's own leak guard: any detected artist reference
 * OR style-reference framing word (Korean/Japanese/English) anywhere in
 * the text now skips englishWords extraction entirely, rather than only
 * gating the raw-text image — extracting the first 5 English words from
 * "give me something in the style of the Beatles" happened to miss
 * "Beatles" only because of where it fell in word order, not by any real
 * guarantee.
 */
function fallbackConcept(text: string): ConceptInfluence {
  const clean = text.replace(/[\n,;]+/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 120);
  if (!clean) return EMPTY_CONCEPT_INFLUENCE;
  if (findArtistReferenceLeaks(clean).length > 0 || STYLE_REFERENCE_FRAMING_PATTERN.test(clean)) return EMPTY_CONCEPT_INFLUENCE;

  // TASK v3.59 — no Korean/Japanese noun extraction (deliberately out of
  // scope); a customConcept written entirely in a non-Latin script has
  // nothing this regex can safely pull out, so it falls back to no concept
  // influence rather than a wrong or placeholder one.
  const englishWords = clean.match(/[a-z][a-z'-]{2,}/giu)?.slice(0, 5) ?? [];
  if (!englishWords.length) return EMPTY_CONCEPT_INFLUENCE;

  const musicAtoms = englishWords.join(' ');
  return {
    key: 'custom',
    styleText: `custom concept focus, ${musicAtoms}, scene-specific arrangement detail`,
    lyricImages: [clean, musicAtoms]
  };
}

export function resolveConceptInfluence(customConcept?: string): ConceptInfluence | null {
  const clean = normalized(customConcept || '');
  if (!clean) return null;
  const match = CONCEPT_PRESETS.find(preset => preset.aliases.some(alias => clean.includes(normalized(alias))));
  return match ? { key: match.key, styleText: match.styleText, lyricImages: match.lyricImages } : fallbackConcept(customConcept || '');
}

export function conceptStyleText(customConcept?: string, index = 0): string | undefined {
  const influence = resolveConceptInfluence(customConcept);
  // TASK v3.59 (TASK A-2) — fallbackConcept can now return an influence with
  // no real content (EMPTY_CONCEPT_INFLUENCE) when no safe image/style text
  // could be extracted; treated the same as no influence at all, rather
  // than building "concept emphasis: undefined" from empty atoms/images.
  if (!influence || (!influence.styleText.trim() && !influence.lyricImages.length)) return undefined;
  const atoms = influence.styleText.split(',').map(atom => atom.trim()).filter(Boolean);
  const image = influence.lyricImages[Math.abs(index) % influence.lyricImages.length];
  const selected = atoms.length > 2
    ? [atoms[index % atoms.length], atoms[(index + 1) % atoms.length]]
    : atoms;
  const arrangementVariants = [
    'piano-led opening', 'guitar-led opening', 'bass-first verse pocket', 'breathing space before the chorus',
    'answering instrumental phrase', 'layered harmony arrival', 'brushed pulse under the verse',
    'rhythmic lift after the second line', 'small harmony on the final hook', 'acoustic texture in the middle eight',
    'low-register opening before the lift', 'open cymbal color at the chorus', 'muted intro before the first image',
    'walking bass under the second verse', 'single-note answer after the hook', 'wider room tone at the ending',
    'pulsing eighth notes beneath the scene', 'brief suspended chord before resolution'
  ];
  const arrangement = arrangementVariants[Math.abs(index) % arrangementVariants.length];
  return [...new Set([...selected.map(atom => `concept cue: ${atom}`), `concept emphasis: ${image}`, `arrangement focus: ${arrangement}`])].join(', ');
}

export function conceptLyricImages(customConcept?: string): string[] {
  return resolveConceptInfluence(customConcept)?.lyricImages ?? [];
}

const VOCAL_VARIANTS = [
  'close-mic and intimate, restrained conversational delivery',
  'warmer chest voice with light rasp, patient phrasing',
  'airy upper register on the chorus, calm low-register verses',
  'clear forward diction, subtle breath texture, gentle sustained notes',
  'rounded low register, softly lifted chorus, natural unforced dynamics',
  'slightly husky edges, warm legato lines, quiet emotional restraint',
  'dry room presence, lightly spoken verse, open vowel chorus',
  'velvet middle register, clipped verse rhythm, longer chorus notes',
  'breathy entrances, steady center tone, understated harmony tail',
  'clear consonants, relaxed pocket, soft falloff after each phrase',
  'smoky lower color, lifted fifths in the refrain, measured dynamics',
  'near-whispered verse texture, warmer sustained vowels, gentle release',
  'forward lead tone, small turns at line endings, patient chorus bloom',
  'rounded breath attack, close storytelling, brighter upper harmony',
  'light grain at the edges, smooth legato verse, restrained hook lift',
  'calm spoken intimacy, firm pitch center, airy final syllables',
  'softly grainy onset, spacious phrasing, composed emotional rise',
  'low-key conversational tone, clean chorus projection, delicate vibrato'
];

export function variedVocalText(base: string, index: number, genre?: GenrePack, archetype?: ChannelArchetype): string {
  if (archetype === 'kids') return base;
  const descriptor = VOCAL_VARIANTS[Math.abs(index) % VOCAL_VARIANTS.length];
  const genreCue = genre?.vocal?.[Math.abs(index + 1) % (genre.vocal.length || 1)];
  // Put the track-level delivery cue first inside the vocal atom. The exact
  // channel identity remains present for compatibility and gender safety, but
  // it no longer dominates every prompt's opening clause.
  return [descriptor, genreCue, base].filter(Boolean).join(', ');
}

/**
 * TASK v3.56 Part 2 — real measurement: with 5 rotations split 2-vocal-first/
 * 3-non-vocal-first, an 18-song set opened on only 9-11 distinct clauses.
 * 'vocal' is the only category guaranteed unique per song (variedVocalText's
 * 18-entry VOCAL_VARIANTS pool, one per index) — genreSignature/instruments
 * openings repeat whenever the same primary genre/anchor instrument leads
 * (now mitigated by rotatingGenreSignatureText/rotatingInstrumentText's own
 * anchor+shuffle, but the anchor atom itself is still constant), and
 * moneyChord's opening is always byte-identical across a whole pack (the
 * chosen progression is a pack-level setting, not per-song) so it's dropped
 * as a leading category entirely rather than chasing a rotation that can
 * never vary. 6 rotations, 4 of which lead with 'vocal' (~67%), keep the
 * spec's "some songs open on instruments/rhythm instead of vocal" requirement
 * satisfied by the other 2 while pushing measured opening-clause variety back
 * over the 12/18 target.
 */
export function promptPriorityForTrack(index: number): PromptTermId[] {
  const rotations: PromptTermId[][] = [
    ['vocal', 'genreSignature', 'concept', 'genreNarrative', 'moneyChord', 'duration', 'hook', 'hookDevice', 'genre', 'instruments'],
    ['genreSignature', 'concept', 'genreNarrative', 'genre', 'duration', 'hook', 'hookDevice', 'vocal', 'instruments', 'moneyChord'],
    ['instruments', 'genreSignature', 'concept', 'genre', 'duration', 'hook', 'hookDevice', 'genreNarrative', 'vocal', 'moneyChord'],
    ['vocal', 'instruments', 'genreSignature', 'concept', 'genre', 'genreNarrative', 'duration', 'hook', 'hookDevice', 'moneyChord'],
    ['vocal', 'genreNarrative', 'genreSignature', 'concept', 'moneyChord', 'duration', 'hook', 'hookDevice', 'genre', 'instruments'],
    ['vocal', 'concept', 'genreSignature', 'genreNarrative', 'moneyChord', 'duration', 'hook', 'hookDevice', 'genre', 'instruments']
  ];
  return rotations[Math.abs(index) % rotations.length];
}
