// Korean glosses for the genre/mood/season catalogs, used for display only.
// Kept separate from GenrePack/MoodPack/SeasonPack (data/presets.ts) so the
// English label data that feeds the Suno-facing style prompt is untouched.

// 지시문 25 (TASK A-3) — genreLabelsKo는 원래 이 파일에 18종만 하드코딩돼
// 있었다. data/genreLabelKo.ts가 그 18종을 포함해 362종 전체를 채웠으므로,
// 여기서 다시 하드코딩하면 두 표가 서로 다른 한국어를 보여주는 낡은 경로가
// 남는다("§5 낡은 경로를 남긴 채 새 경로를 추가하지 않는다") — 그대로
// 재노출해 이 파일의 기존 소비처(Step2Concept.tsx·ConceptAgentPanel.tsx)도
// 362종 전체에서 자동으로 한국어 라벨을 받는다.
export { LABEL_KO_BY_GENRE_ID as genreLabelsKo } from './genreLabelKo';

export const moodLabelsKo: Record<string, string> = {
  nostalgic: '그리운',
  warm: '따뜻한',
  bittersweet: '애틋한',
  hopeful: '희망찬',
  romantic: '로맨틱한',
  christmas: '크리스마스',
  'calm-focus': '차분한',
  'fresh-start': '산뜻한',
  'rainy-comfort': '비 오는 날의 위로',
  elegant: '우아한',
  'bright-playful': '밝고 활기찬'
};

export const seasonLabelsKo: Record<string, string> = {
  'new-year': '새해',
  'late-winter': '늦겨울',
  'spring-open': '봄의 시작',
  'cherry-blossom': '벚꽃길',
  'may-cafe': '5월의 카페',
  'rainy-season': '장마철',
  'summer-night': '여름밤',
  'late-summer-open': '늦여름 오프닝',
  'early-autumn': '초가을',
  'autumn-rain': '가을비',
  'maple-autumn': '단풍길',
  'late-autumn': '늦가을 편지',
  'early-winter': '초겨울 창가',
  'first-snow': '첫눈',
  christmas: '크리스마스',
  'year-end': '연말 편지'
};
