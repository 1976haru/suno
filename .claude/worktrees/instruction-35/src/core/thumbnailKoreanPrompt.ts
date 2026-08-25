import { BACK_VIEW_PEOPLE_ONLY, COMMON_NEGATIVE_TERMS, TEXTLESS_BACKGROUND_ONLY } from './thumbnailPromptBlocks';
import { thumbnailArtistReferenceIssues } from './thumbnailSafety';
import type { ProviderSettings } from '../types';
import { buildProxyHeaders, callGenerateProxy } from '../providers/proxyFetch';

const KOREAN_SCENE_MAP: Array<[RegExp, string]> = [
  [/비\s*오는|빗속/u, 'rainy atmosphere and wet reflective surfaces'],
  [/도쿄|도시|네온/u, 'Tokyo-like night street mood with restrained neon reflections'],
  [/밤|새벽|야간/u, 'quiet night scene with deep blue ambient light'],
  [/드라이브|차 안|자동차/u, 'a cinematic drive viewed from inside a car'],
  [/우산/u, 'a small distant figure seen from behind holding an umbrella'],
  [/카페|창가|커피/u, 'a quiet cafe window with warm practical light'],
  [/필름|레트로|쇼와/u, 'soft analog film grain and warm restrained color'],
  [/밝은|화사한|어린이/u, 'bright cheerful color and generous uncluttered space']
];

export function koreanThumbnailPromptIssues(input: string): string[] {
  return thumbnailArtistReferenceIssues(input);
}

export function translateKoreanThumbnailDescription(input: string): string {
  const source = input.trim().replace(/\s+/gu, ' ');
  if (!source || koreanThumbnailPromptIssues(source).length) return '';
  const matched = KOREAN_SCENE_MAP.filter(([pattern]) => pattern.test(source)).map(([, clause]) => clause);
  const fallback = 'an original editorial scene with clear subject, setting, lighting, and calm negative space';
  return [matched.length ? matched.join(', ') : fallback, TEXTLESS_BACKGROUND_ONLY, BACK_VIEW_PEOPLE_ONLY, `Negative: ${COMMON_NEGATIVE_TERMS.join(', ')}.`].join('. ');
}

export async function translateKoreanThumbnailDescriptionViaTextModel(input: string, settings: ProviderSettings): Promise<string> {
  const source = input.trim();
  if (!source || koreanThumbnailPromptIssues(source).length) return '';
  const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', buildProxyHeaders(settings), {
    provider: settings.provider === 'anthropic' ? 'anthropic' : 'openai',
    model: settings.model,
    temperature: 0.2,
    system: 'Translate a Korean thumbnail scene description into one original English scene prompt. Preserve concrete objects and lighting. Never add text, logos, artists, brands, or identifiable faces. Return only the prompt.',
    user: source
  });
  const raw = data.text ?? data.output ?? data.content ?? data.result;
  const translated = typeof raw === 'string' ? raw.trim() : '';
  if (!translated || thumbnailArtistReferenceIssues(translated).length) return '';
  return `${translated}. ${TEXTLESS_BACKGROUND_ONLY}. ${BACK_VIEW_PEOPLE_ONLY}. Negative: ${COMMON_NEGATIVE_TERMS.join(', ')}.`;
}
