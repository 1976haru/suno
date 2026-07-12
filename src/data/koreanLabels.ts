// Korean glosses for the genre/mood/season catalogs, used for display only.
// Kept separate from GenrePack/MoodPack/SeasonPack (data/presets.ts) so the
// English label data that feeds the Suno-facing style prompt is untouched.

export const genreLabelsKo: Record<string, string> = {
  'adult-contemporary': '어덜트 컨템포러리 팝',
  'acoustic-pop': '어쿠스틱 팝',
  'jazz-pop': '어쿠스틱 재즈 팝',
  'showa-modern': '쇼와 모던 카페',
  'city-pop-soft': '소프트 시티팝',
  'lofi-cafe': '로파이 카페',
  'christmas-soft-pop': '소프트 크리스마스 팝',
  'healing-ballad': '힐링 발라드',
  'folk-pop': '포크 팝',
  'bossa-cafe': '보사노바 카페',
  'soft-rock': '소프트 락',
  'piano-ballad': '피아노 발라드',
  'retro-soul-pop': '레트로 소울 팝',
  'synthwave-mellow': '멜로우 신스웨이브'
};

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
  elegant: '우아한'
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
