import type { ChannelProfile, GenerationOptions, PlaylistBlueprint, SeasonPack, ThumbnailSpec } from '../types';
import { paletteForSeason, type ThumbnailPalette } from '../data/thumbnailPalettes';
import { seasonWordFor } from './lyricEngine';
import { getRecurringMotifPhrases } from './localGenerator';

export type { ThumbnailSpec };

type DisplayLanguage = 'english' | 'korean' | 'japanese';

function displayLanguageFor(lyricLanguage: GenerationOptions['lyricLanguage']): DisplayLanguage {
  if (lyricLanguage === 'korean') return 'korean';
  if (lyricLanguage === 'japanese') return 'japanese';
  return 'english';
}

const headlineSecondLine: Record<DisplayLanguage, string[]> = {
  english: ['Morning', 'Memories', 'Warmth', 'Quietly', 'Gently', 'Evening'],
  korean: ['그 노래', '그 하루', '그 시간', '작은 행복', '오늘의 위로', '우리 계절'],
  japanese: ['その歌', 'あの日々', '静かな朝', 'やさしい時間', '小さな幸せ', 'いつもの朝']
};

// seasonWordFor()'s Korean/Japanese entries are already short (<=5 chars),
// but its English branch falls back to season.keywords[0], which can be a
// multi-word phrase well over the 8-char headline budget ("late winter",
// "cherry blossom"). Headline line 1 needs a guaranteed-short word instead.
const shortSeasonWordEnglish: Record<string, string> = {
  'new-year': 'New Year',
  'late-winter': 'Winter',
  'spring-open': 'Spring',
  'cherry-blossom': 'Blossom',
  'may-cafe': 'May Cafe',
  'rainy-season': 'Rainy',
  'summer-night': 'Summer',
  'late-summer-open': 'Summer',
  'early-autumn': 'Autumn',
  'autumn-rain': 'Autumn',
  'maple-autumn': 'Maple',
  'late-autumn': 'Autumn',
  'early-winter': 'Winter',
  'first-snow': 'Snow Day',
  christmas: 'Holiday',
  'year-end': 'Year End'
};

function shortSeasonWord(season: SeasonPack, language: DisplayLanguage): string {
  if (language === 'english') return shortSeasonWordEnglish[season.id] ?? 'Season';
  return seasonWordFor(season, language);
}

function pickHeadline(season: SeasonPack, language: DisplayLanguage, seedIndex: number): string {
  const seasonWord = shortSeasonWord(season, language);
  const pool = headlineSecondLine[language];
  const second = pool[seedIndex % pool.length];
  return `${seasonWord}\n${second}`;
}

const SUBLINE_MAX_CHARS = 12;

function buildSubline(songCount: number, language: DisplayLanguage): string {
  const raw = language === 'korean'
    ? `${songCount}곡 플레이리스트`
    : language === 'japanese'
      ? `${songCount}曲プレイリスト`
      : `${songCount} Songs`;
  return raw.length > SUBLINE_MAX_CHARS ? raw.slice(0, SUBLINE_MAX_CHARS) : raw;
}

/** Objects that actually appear in this pack's generated lyrics (falls back to the first 3 motifs if none matched, e.g. for remotely-generated packs whose lyrics don't reuse the local motif bank). */
function pickObjects(blueprint: PlaylistBlueprint, language: DisplayLanguage): { display: string[]; english: string[] } {
  const motifs = getRecurringMotifPhrases();
  const matched = motifs.filter(motif => blueprint.songs.some(song => song.lyrics.includes(motif[language])));
  const chosen = (matched.length ? matched : motifs).slice(0, 3);
  return {
    display: chosen.map(motif => motif[language]),
    english: chosen.map(motif => motif.english)
  };
}

// TASK B2 (v3.4): a blanket "no people" was too strict — distant, faceless
// silhouettes (a back turned to camera at a cafe window, two people walking
// a snowy street) genuinely raise emotional pull for this kind of playlist
// thumbnail. What must stay banned is anything that identifies a real
// person: closeups, recognizable faces, real public figures.
const FORBIDDEN_ELEMENTS = [
  '실존 인물 사진 (저작권·초상권)',
  '유명 캐릭터 (디즈니, 산타 캐릭터 IP 등) — 일반적인 산타 모자·트리는 OK',
  '얼굴 클로즈업 (시니어 채널은 오브제 중심이 CTR이 높다)',
  '식별 가능한 인물 (뒷모습·원경 실루엣은 OK)',
  '저작권 있는 사진·일러스트',
  '작은 글씨 (최소 폰트 크기 대비 확보)'
];

function buildImagePrompt(season: SeasonPack, palette: ThumbnailPalette, objectsEnglish: string[]): string {
  const objectPhrase = objectsEnglish.length ? objectsEnglish.join(', ') : 'a warm seasonal still life';
  return [
    `warm seasonal scene, ${objectPhrase}`,
    season.visualDirection,
    `color palette: background ${palette.background}, accent ${palette.accent}`,
    'warm soft light, film grain, cozy nostalgic mood',
    'no text, no logos, no close-up faces, no identifiable person, no real celebrity or public figure',
    'distant elegant silhouettes are welcome (backs turned, soft focus, small in frame)',
    '16:9 composition with empty space on one side for text overlay'
  ].join(', ');
}

/**
 * TASK B1 (v3.3): this app deliberately does NOT call an image-generation
 * API — a weekly-upload senior channel needs maybe 18 thumbnails across a
 * whole season, and reused backgrounds with swapped text (the real
 * workflow: a Canva template) keep the channel grid visually consistent in
 * a way regenerated-per-song AI images can't. This produces a spec a human
 * (or Canva) can act on, not a finished image.
 */
export function buildThumbnailSpec(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  season: SeasonPack,
  channel: ChannelProfile,
  variant = 0
): ThumbnailSpec {
  const language = displayLanguageFor(opts.lyricLanguage);
  const palette = paletteForSeason(season.id);
  // variant lets "다른 문구 제안" cycle to a different headline second-line
  // without touching colors/objects/composition — regenerating the whole
  // spec on a text-only request would defeat the point of a stable,
  // channel-consistent visual template.
  const seedIndex = blueprint.songs.length + channel.name.length + variant;
  const { display: objects, english: objectsEnglish } = pickObjects(blueprint, language);

  return {
    headline: pickHeadline(season, language, seedIndex),
    subline: buildSubline(blueprint.songs.length, language),
    colorScheme: {
      background: palette.background,
      accent: palette.accent,
      text: palette.text
    },
    objects,
    composition: '좌측 또는 우측에 오브제를 배치하고, 반대편에 문구를 위한 여백을 넉넉히 남기세요.',
    forbidden: [...FORBIDDEN_ELEMENTS],
    imagePrompt: buildImagePrompt(season, palette, objectsEnglish)
  };
}
