import type { ChannelArchetype, GenrePack } from '../types';
import type { PromptTermId } from './promptBudget';

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
const CONCEPT_PRESETS: ConceptPreset[] = [
  { key: 'morning-cafe', aliases: ['아침 카페', 'morning cafe', 'coffee morning', '아침 커피'], styleText: 'morning light, coffee aroma, gentle wake, soft acoustic opening', lyricImages: ['coffee steam', 'pale morning light', 'a quiet cafe table'] },
  { key: 'rainy-night', aliases: ['비 오는 밤', 'rainy night', 'rain on window', '비 오는'], styleText: 'rain on window, late-night solitude, mellow reverb, minor-key hush', lyricImages: ['rain on the window', 'a late-night lamp', 'wet pavement reflections'] },
  { key: 'city-lights', aliases: ['도시의 불빛', 'city lights', 'neon city', '도시 불빛'], styleText: 'city neon, evening drive, smooth groove, clean electric textures', lyricImages: ['city neon', 'a windshield at dusk', 'lights crossing the avenue'] },
  { key: 'youth-dreams', aliases: ['청춘과 꿈', 'youth and dreams', 'young dreams', '청춘 꿈'], styleText: 'youthful energy, open road, uplifting build, bright forward rhythm', lyricImages: ['an open road', 'a pocket full of plans', 'sunrise beyond the hill'] },
  { key: 'old-radio', aliases: ['추억의 라디오', 'old radio', 'memory radio', '오래된 라디오'], styleText: 'old-radio warmth, tape softness, familiar melody turns, intimate room tone', lyricImages: ['a softly glowing radio', 'a faded photograph', 'a familiar voice through static'] },
  { key: 'season-change', aliases: ['계절의 변화', 'season change', 'changing seasons', '계절 변화'], styleText: 'shifting seasonal colors, changing light, gradual arrangement bloom', lyricImages: ['leaves changing color', 'a coat by the door', 'the first breath of cold air'] },
  { key: 'old-friendship', aliases: ['오래된 우정', 'old friendship', 'lifelong friends', '오랜 우정'], styleText: 'trusted warmth, conversational verses, hand-played ensemble, shared chorus', lyricImages: ['two cups on a table', 'a well-worn address book', 'laughter after many years'] },
  { key: 'seaside-memory', aliases: ['바다의 추억', 'seaside memory', 'ocean memory', '바다 추억'], styleText: 'open coastal air, rolling rhythm, salt-bright guitar, spacious horizon', lyricImages: ['salt air', 'a small harbor', 'blue light on the water'] },
  { key: 'garden-walk', aliases: ['정원 산책', 'garden walk', 'quiet garden', '정원'], styleText: 'dew-covered garden, unhurried walking pulse, natural acoustic detail', lyricImages: ['dew on leaves', 'a stone garden path', 'green shade after rain'] },
  { key: 'long-drive', aliases: ['긴 드라이브', 'long drive', 'road trip', '드라이브'], styleText: 'long-road momentum, steady cruising beat, wide stereo guitars, open-window lift', lyricImages: ['road lines at noon', 'an open car window', 'towns passing slowly'] },
  { key: 'christmas-cafe', aliases: ['크리스마스 카페', 'christmas cafe', 'holiday cafe', '성탄 카페'], styleText: 'warm holiday cafe, subtle bells, candlelit harmony, restrained seasonal glow', lyricImages: ['candlelight', 'a handwritten card', 'bells beyond the cafe door'] },
  { key: 'first-snow', aliases: ['첫눈', 'first snow', 'winter snow', '첫 눈'], styleText: 'first-snow stillness, soft piano air, clear high register, tender lift', lyricImages: ['the first snow', 'a scarf on a chair', 'footprints in quiet white'] }
];

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, ' ').trim();
}

function fallbackConcept(text: string): ConceptInfluence {
  const clean = text.replace(/[\n,;]+/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 120);
  const englishWords = clean.match(/[a-z][a-z'-]{2,}/giu)?.slice(0, 5) ?? [];
  const musicAtoms = englishWords.length ? englishWords.join(' ') : 'personal scene details';
  return {
    key: 'custom',
    styleText: `custom concept focus, ${musicAtoms}, scene-specific arrangement detail`,
    lyricImages: [clean || 'a private memory', englishWords.join(' ') || 'a small meaningful detail']
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
  if (!influence) return undefined;
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

export function promptPriorityForTrack(index: number): PromptTermId[] {
  const rotations: PromptTermId[][] = [
    ['vocal', 'genreSignature', 'concept', 'genreNarrative', 'moneyChord', 'duration', 'hook', 'hookDevice', 'genre', 'instruments'],
    ['genreSignature', 'concept', 'genreNarrative', 'genre', 'duration', 'hook', 'hookDevice', 'vocal', 'instruments'],
    ['instruments', 'genreSignature', 'concept', 'genre', 'duration', 'hook', 'hookDevice', 'genreNarrative', 'vocal'],
    ['vocal', 'genreSignature', 'concept', 'genre', 'genreNarrative', 'duration', 'hook', 'hookDevice', 'instruments'],
    ['moneyChord', 'genreSignature', 'concept', 'genre', 'duration', 'hook', 'hookDevice', 'instruments', 'vocal']
  ];
  return rotations[Math.abs(index) % rotations.length];
}
