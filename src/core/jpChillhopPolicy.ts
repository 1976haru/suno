import { checkJp2030Translationese, findKatakanaOveruse, JP_2030_KATAKANA_OVERUSE_THRESHOLD, katakanaShareOfKana } from './jp2030Policy';

/**
 * 지시문 79 — 일본어 품질 자산은 jp-2030의 검증된 스크립트/직역체 레이어를
 * 재사용하되, 적용 범위와 경고 문구는 jp-chillhop 전용으로 분리한다.
 */
export const JP_CHILLHOP_KATAKANA_OVERUSE_THRESHOLD = JP_2030_KATAKANA_OVERUSE_THRESHOLD;

export function jpChillhopKatakanaShareOfKana(lyrics: string): number {
  return katakanaShareOfKana(lyrics);
}

export function findJpChillhopKatakanaOveruse(songs: { trackNo: number; lyrics: string }[]): number[] {
  return findKatakanaOveruse(songs);
}

export function checkJpChillhopTranslationese(songs: { trackNo: number; lyrics: string }[]): string[] {
  return checkJp2030Translationese(songs).map(warning => warning.replace(/^Track /, 'JP CHILI Track '));
}
