/**
 * 지시문 25 (TASK A) — genreLibrary의 instruments/rhythm/vocal/production
 * 필드값(영문 구)을 한국어로 옮긴 사전. moods(genreMoodKo.ts, 123종 전수)와
 * 달리 이 네 축은 362종 전체에서 300종 이상의 서로 다른 구가 쓰여 한 번에
 * 전수 작성이 불가능하다 — genreExplainer.ts는 이 사전에 없는 구를
 * "원문 그대로 나열"하지 않고 조용히 건너뛴다(§ 하지 말 것 "원문 필드를
 * 그대로 나열하지 말 것").
 *
 * 1차 배치: 지시문 25 §E-2/E-2-3/E-2-4가 예시로 요구하는 앵커 장르
 * 8종(oldpop-doowop-harmony · oldpop-sunshine-pop · oldpop-british-beat ·
 * oldpop-brill-building · adult-contemporary · healing-ballad ·
 * piano-ballad · retro-soul-pop)의 구만 채운다. 나머지 장르·배치는 하루의
 * 방향 확인 후 이어서 채운다.
 */
export const PHRASE_KO: Record<string, string> = {
  // instruments
  'upright bass': '업라이트 베이스',
  'brushed snare': '브러시 스네어',
  'close-harmony backing vocals': '클로즈 하모니 백킹 보컬',
  'muted electric guitar': '뮤트 일렉트릭 기타',
  harpsichord: '하프시코드',
  glockenspiel: '글로켄슈필',
  'woodwind obbligato': '목관 오블리가토',
  'light acoustic guitar': '가벼운 어쿠스틱 기타',
  '12-string electric guitar': '12현 일렉트릭 기타',
  'melodic walking bass': '멜로딕 워킹 베이스',
  'tambourine backbeat': '백비트 탬버린',
  'brushed drum kit': '브러시 드럼',
  'upright piano': '업라이트 피아노',
  castanets: '캐스터네츠',
  tambourine: '탬버린',
  'light upright bass': '가벼운 업라이트 베이스',
  'sustained piano pads': '길게 울리는 피아노 패드',
  'clean strummed acoustic guitar': '깨끗하게 스트럼하는 어쿠스틱 기타',
  'straight-pop drum kit': '스트레이트 팝 드럼',
  'rounded electric bass': '둥근 톤의 일렉트릭 베이스',
  piano: '피아노',
  'acoustic guitar': '어쿠스틱 기타',
  'soft strings': '부드러운 현악',
  brushes: '브러시(드럼)',
  'felt piano': '펠트 피아노(약음 피아노)',
  'subtle cymbal swells': '은은한 심벌 스웰',
  'warm bass': '따뜻한 베이스',
  Wurlitzer: '우얼리처',
  'muted guitar': '뮤트 기타',
  'smooth bass': '매끄러운 베이스',
  'light soul drums': '가벼운 소울 드럼',

  // rhythm
  '12/8 triplet shuffle groove': '12/8박 셋잇단 셔플 그루브',
  'walking upright bass on the downbeat': '다운비트 위의 워킹 업라이트 베이스',
  'bright bouncing 4/4 pop pulse': '밝고 통통 튀는 4/4박 팝 펄스',
  'jangly eighth-note beat pulse': '쟁글대는 8분음표 비트 펄스',
  'bouncy two-beat pop pulse': '통통 튀는 투비트 팝 펄스',
  'straight 4/4 pop feel': '스트레이트 4/4박 팝 필',
  'slow restrained pulse': '느리고 절제된 펄스',
  'slow piano-led pulse': '느린 피아노 중심 펄스',
  'warm soul-pop groove': '따뜻한 소울팝 그루브',

  // vocal
  'lead voice answered by four-part close harmony': '4성 클로즈 하모니가 받아주는 리드 보컬',
  'nonsense-syllable backing vocal figures': '의성음 백킹 보컬 프레이즈',
  'blended bright harmony vocals in parallel thirds and sixths': '3도·6도로 어우러지는 밝은 화음 보컬',
  'clear youthful group harmony': '맑고 젊은 그룹 하모니',
  'clear youthful lead vocal': '맑고 젊은 리드 보컬',
  'mature clear vocal': '성숙하고 또렷한 보컬',
  'gentle emotional vocal': '부드럽고 감정이 담긴 보컬',
  'intimate verse vocal': '친밀한 벌스 보컬',
  'soulful lead with tasteful backing vocals': '절제된 백킹 보컬을 곁들인 소울풀한 리드',

  // production
  'narrow warm mono-leaning mix': '좁고 따뜻한 모노에 가까운 믹스',
  'tube-amp coloration': '진공관 앰프 색채',
  'crisp bright chamber-pop mix': '선명하고 밝은 챔버팝 믹스',
  'bright British-beat studio mix': '밝은 브리티시 비트 스튜디오 믹스',
  'bright compact 1960s single mix': '밝고 컴팩트한 1960년대 싱글 믹스',
  'radio-friendly polish': '라디오 친화적인 다듬질',
  'soft comfort mix': '부드럽고 편안한 믹스',
  'gentle cinematic chorus space': '부드럽고 영화적인 코러스 공간감',
  'hand-played retro warmth': '손으로 연주한 듯한 레트로 온기'
};
