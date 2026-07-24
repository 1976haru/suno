export const FILM_PHOTO_SPEC =
  'Cinematic editorial photograph, shot on 35mm film, Kodak Portra 400, 50mm lens, f/1.8-2.0, shallow depth of field, natural bokeh, subtle film grain, gentle highlight rolloff, muted warm color grading';

export const COMMON_NEGATIVE_TERMS = [
  'no text',
  'no letters',
  'no logo',
  'no watermark',
  'no visible face',
  'no front-facing portrait',
  'no identifiable person',
  'no celebrity',
  'no branded IP',
  'no famous painting',
  'no glowing sparkles',
  'no excessive glow',
  'no HDR look',
  'no oversaturation',
  'no plastic CGI render',
  'no illustration',
  'no cartoon'
] as const;

export const COMMON_NEGATIVE_BLOCK = COMMON_NEGATIVE_TERMS.join(', ');

export const BACK_VIEW_PEOPLE_ONLY =
  'any human figure must be a small distant figure seen from behind or in silhouette only, face never shown, no recognizable features';

export const TEXTLESS_BACKGROUND_ONLY =
  'textless background only; leave clean blank areas for separate external layout work';

export function midjourneyNoTerms(): string {
  return COMMON_NEGATIVE_TERMS
    .map(term => term.replace(/^no\s+/i, ''))
    .join(', ');
}
