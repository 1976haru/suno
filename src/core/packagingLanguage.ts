import type { ChannelProfile, DisplayLanguage, GenerationOptions, Market } from '../types';

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

/**
 * TASK v3.39.1 Part C3 — the kids channel's primaryLanguage now defaults to
 * english (v3.39 Part G), but its preset's `market` is still 'korea' (kids
 * targets Korean-speaking families first), so an English-lyric kids channel
 * still got Korean thumbnails/tags out of the box via
 * defaultPackagingLanguage(market). Kids packaging follows the channel's own
 * primaryLanguage instead of the market-derived convention every other
 * archetype intentionally keeps (senior-morning/showa-cafe channels commonly
 * run English lyrics under deliberate Korean/Japanese branding — see this
 * file's original TASK D5 note — a use case the kids channel doesn't share).
 */
export function defaultPackagingLanguageForChannel(channel: Pick<ChannelProfile, 'archetype' | 'market' | 'primaryLanguage'>): DisplayLanguage {
  if (channel.archetype === 'kids') {
    return channel.primaryLanguage === 'bilingual' ? 'english' : channel.primaryLanguage;
  }
  return defaultPackagingLanguage(channel.market);
}
