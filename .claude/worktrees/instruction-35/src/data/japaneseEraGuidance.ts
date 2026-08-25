import type { ChannelArchetype } from '../types';

export interface JapaneseEraLyricGuard {
  archetype: ChannelArchetype;
  label: string;
  lyricGuidance: string;
  forbiddenTerms: string[];
}

export const JAPANESE_ERA_LYRIC_GUARDS: JapaneseEraLyricGuard[] = [
  {
    archetype: 'showa-70s',
    label: 'Showa 1970s Japanese lyric guard',
    lyricGuidance: 'For 1970s Japanese lyrics, keep scenes in night trains, ports, umbrellas, kissaten, handwritten letters, station farewells, alley street lamps, and seasonal windows. Use slightly literary Japanese with a balanced kanji/hiragana texture. Do not mention modern phones, apps, SNS, streaming, selfies, QR codes, or internet slang.',
    forbiddenTerms: [
      'スマホ',
      'スマートフォン',
      'SNS',
      'インスタ',
      'Instagram',
      'LINE',
      'TikTok',
      'YouTube',
      'サブスク',
      'ストリーミング',
      '自撮り',
      'QRコード',
      'アプリ',
      'DM',
      'メール',
      '携帯'
    ]
  },
  {
    archetype: 'j2000s',
    label: 'Early-2000s Japanese lyric guard',
    lyricGuidance: 'For early-2000s Japanese lyrics, use flip phones, keitai mail, station gates, bicycle school routes, graduation rooms, summer festivals, first trains, and late-night calls. Keep the diction conversational and clean. Avoid smartphone-era details such as SNS feeds, read receipts, streaming apps, short-form video, and modern bedroom-pop internet slang.',
    forbiddenTerms: [
      'スマホ',
      'スマートフォン',
      'SNS',
      'インスタ',
      'Instagram',
      'TikTok',
      'YouTube',
      'サブスク',
      'ストリーミング',
      '既読',
      'ストーリー',
      '配信アプリ',
      'ショート動画'
    ]
  }
];

export function eraLyricGuardForArchetype(archetype: ChannelArchetype | undefined): JapaneseEraLyricGuard | undefined {
  return JAPANESE_ERA_LYRIC_GUARDS.find(guard => guard.archetype === archetype);
}

export function eraLyricGuidanceForArchetype(archetype: ChannelArchetype | undefined): string {
  return eraLyricGuardForArchetype(archetype)?.lyricGuidance || '';
}

export function eraLyricForbiddenTermsForArchetype(archetype: ChannelArchetype | undefined): string[] {
  return eraLyricGuardForArchetype(archetype)?.forbiddenTerms || [];
}

export function eraLyricSafetyIssues(lyrics: string, archetype: ChannelArchetype | undefined): string[] {
  const lower = lyrics.toLowerCase();
  return eraLyricForbiddenTermsForArchetype(archetype)
    .filter(term => lower.includes(term.toLowerCase()))
    .map(term => `Era lyric guard: remove anachronistic term "${term}".`);
}

export function containsEraAnachronism(lyrics: string, archetype: ChannelArchetype | undefined): boolean {
  return eraLyricSafetyIssues(lyrics, archetype).length > 0;
}
