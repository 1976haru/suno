/**
 * 지시문 29 (TASK B-3) — "eraTag 자유 문자열 문제를 반복하지 않는다. 정규식을
 * 코드에 흩뿌리지 말고 데이터로 둔다." checkSetArcAdherence(core/
 * setArcAdherence.ts)가 세트 1~3번/16~18번 트랙에서 "출발점 어휘가 있는가",
 * "도착점 어휘가 있는가"를 판정할 때 쓰는 순수 데이터. 전부 verified: false
 * 로 시작한다 — 하루의 실측 청취로 검증된 어휘 목록이 아니라, 이 지시문
 * 자체가 실측(§0-3 "Autumn to Christmas Playlist Pack" → 크리스마스 어휘
 * 0곡)에서 골라낸 상식적 어휘 후보다.
 */

export interface SetArcVocabEntry {
  id: string;
  labelKo: string;
  /** 소문자 매칭 — 영어/한국어 모두. song.seasonMoment + song.lyrics + song.stylePrompt 텍스트를 소문자화해 이 배열의 각 항목이 부분 문자열로 나타나는지만 본다(형태소 분석 없음 — 과도한 정밀도를 주장하지 않는다). */
  keywords: string[];
}

export const SEASON_ARC_VOCAB: Record<string, SetArcVocabEntry> = {
  spring: { id: 'spring', labelKo: '봄', keywords: ['봄', 'spring', '벚꽃', 'cherry blossom', '새싹', '꽃샘'] },
  summer: { id: 'summer', labelKo: '여름', keywords: ['여름', 'summer', '무더위', '장마', '바캉스', '매미'] },
  autumn: { id: 'autumn', labelKo: '가을', keywords: ['가을', 'autumn', 'fall', '은행잎', '코트', '낙엽', '서늘', '단풍', 'maple'] },
  winter: { id: 'winter', labelKo: '겨울', keywords: ['겨울', 'winter', '눈', 'snow', '패딩', '입김', '난방', '첫추위', '한파'] },
  christmas: { id: 'christmas', labelKo: '크리스마스', keywords: ['크리스마스', 'christmas', 'xmas', '연말', '트리', 'tree lights', '전구', '12월', '선물', 'gift', '캐럴', 'carol'] },
  newYear: { id: 'newYear', labelKo: '새해', keywords: ['새해', 'new year', '연초', '설날', '해돋이', 'countdown', '카운트다운'] }
};

export const TIME_OF_DAY_ARC_VOCAB: Record<string, SetArcVocabEntry> = {
  dawn: { id: 'dawn', labelKo: '새벽', keywords: ['새벽', 'dawn', '동틀', '먼동', 'daybreak'] },
  morning: { id: 'morning', labelKo: '아침', keywords: ['아침', 'morning', '햇살', '출근', '기상'] },
  afternoon: { id: 'afternoon', labelKo: '오후', keywords: ['오후', 'afternoon', '한낮', '점심'] },
  evening: { id: 'evening', labelKo: '저녁', keywords: ['저녁', 'evening', '노을', 'sunset', '퇴근'] },
  night: { id: 'night', labelKo: '밤', keywords: ['밤', 'night', '자정', 'midnight', '별빛', '달빛'] }
};

/** SEASON_ARC_VOCAB/TIME_OF_DAY_ARC_VOCAB 공통 조회 — id를 몰라도 텍스트 조각으로 어느 어휘군인지 찾을 때 쓴다. */
export function findArcVocabEntry(pools: Record<string, SetArcVocabEntry>[], text: string): SetArcVocabEntry | undefined {
  const normalized = text.trim().toLowerCase();
  for (const pool of pools) {
    for (const entry of Object.values(pool)) {
      if (entry.keywords.some(k => normalized.includes(k.toLowerCase()) || k.toLowerCase().includes(normalized))) return entry;
    }
  }
  return undefined;
}
