export interface ThumbnailPalette {
  key: string;
  labelKo: string;
  background: string;
  accent: string;
  text: string;
}

/**
 * Fixed palette table (TASK B1, v3.3) — colors are never generated on the
 * fly. A channel's thumbnails only read as "one channel" when they share a
 * small, consistent set of colors across weeks of uploads; picking from a
 * fixed table (instead of deriving a color per season) is what guarantees
 * that grid consistency.
 */
export const THUMBNAIL_PALETTES: Record<string, ThumbnailPalette> = {
  earlyAutumn: { key: 'earlyAutumn', labelKo: '초가을', background: '#F5EFE6', accent: '#B8860B', text: '#3B2F2F' },
  mapleAutumn: { key: 'mapleAutumn', labelKo: '단풍', background: '#F3E3D3', accent: '#A8631B', text: '#2E1F1A' },
  earlyWinter: { key: 'earlyWinter', labelKo: '초겨울', background: '#E8EDF2', accent: '#22303F', text: '#1A2530' },
  christmas: { key: 'christmas', labelKo: '크리스마스', background: '#F5EFE6', accent: '#8C2F2F', text: '#2E1F1A' },
  yearEnd: { key: 'yearEnd', labelKo: '연말', background: '#EDE8E0', accent: '#6B5B3E', text: '#2A2520' }
};

/** Every season ID maps to one of the five fixed palettes above — never a bespoke color. */
export const SEASON_PALETTE_KEY: Record<string, keyof typeof THUMBNAIL_PALETTES> = {
  'new-year': 'yearEnd',
  'late-winter': 'earlyWinter',
  'spring-open': 'earlyAutumn',
  'cherry-blossom': 'mapleAutumn',
  'may-cafe': 'earlyAutumn',
  'rainy-season': 'mapleAutumn',
  'summer-night': 'earlyWinter',
  'late-summer-open': 'earlyAutumn',
  'early-autumn': 'earlyAutumn',
  'autumn-rain': 'mapleAutumn',
  'maple-autumn': 'mapleAutumn',
  'late-autumn': 'yearEnd',
  'early-winter': 'earlyWinter',
  'first-snow': 'earlyWinter',
  christmas: 'christmas',
  'year-end': 'yearEnd'
};

export function paletteForSeason(seasonId: string): ThumbnailPalette {
  const key = SEASON_PALETTE_KEY[seasonId] ?? 'earlyAutumn';
  return THUMBNAIL_PALETTES[key];
}
