import type { ChannelProfile, DisplayLanguage, GenerationOptions, Market } from '../types';
import { isKidsArchetype } from '../utils/channelArchetype';
import { TITLE_LOCALIZED_REQUIRED_ARCHETYPES } from '../data/archetypeAudienceProfiles';

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
  if (isKidsArchetype(channel.archetype)) {
    return channel.primaryLanguage === 'bilingual' ? 'english' : channel.primaryLanguage;
  }
  return defaultPackagingLanguage(channel.market);
}

/**
 * 지시문 12 (TASK C-2) — titleLocalized 필드/안내문이 packagingLanguage
 * 오버라이드나 market:'global' 하나로 조용히 사라지지 않도록 하는 정책
 * 레이어. `TITLE_LOCALIZED_REQUIRED_ARCHETYPES`에 속한 아키타입은
 * resolvePackagingLanguage가 english를 반환하더라도 channel.market 자체가
 * 한국/일본을 가리키면 그 언어를 강제한다 — market도 'global' 등 진짜
 * 애매한 값이면 english로 남는다 (없는 정보를 지어내지 않는다).
 *
 * 실측 근거: 지시문 12가 지적한 oldpoplounge 채널(archetype: oldpop-lounge,
 * 이 정책의 필수 목록에 포함)이 packagingLanguage 오버라이드로 인해
 * titleLocalized 필드가 브릿지 스키마에서 통째로 제거된 사례.
 */
export function resolveTitleLocalizedLanguage(opts: Pick<GenerationOptions, 'market' | 'packagingLanguage' | 'channel'>): DisplayLanguage {
  const resolved = resolvePackagingLanguage(opts);
  if (resolved !== 'english') return resolved;
  if (!opts.channel.archetype || !TITLE_LOCALIZED_REQUIRED_ARCHETYPES.has(opts.channel.archetype)) return resolved;
  return defaultPackagingLanguage(opts.channel.market);
}
