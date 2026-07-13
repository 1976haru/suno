import type { DisplayLanguage, GenerationOptions, Market } from '../types';

/**
 * TASK D5 (v3.6) — real senior-channel operation runs English lyrics under
 * Korean or Japanese packaging (Suno itself sings fine in English; the
 * audience-facing title/thumbnail is what needs to read as native). Prior
 * behavior derived the thumbnail's language from lyricLanguage, so an
 * English-lyric Korean channel and an English-lyric Japanese channel got
 * identical (English) thumbnails — this derives it from `market` instead,
 * with an explicit override for channels that don't want the default.
 */
export function defaultPackagingLanguage(market: Market): DisplayLanguage {
  if (market === 'korea') return 'korean';
  if (market === 'japan') return 'japanese';
  return 'english';
}

export function resolvePackagingLanguage(opts: Pick<GenerationOptions, 'market' | 'packagingLanguage'>): DisplayLanguage {
  return opts.packagingLanguage ?? defaultPackagingLanguage(opts.market);
}
