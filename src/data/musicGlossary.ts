/**
 * 지시문 25 (TASK D) — 장르 설명 카드에 나오는 음악 용어 한 줄 사전.
 * §D-3 범위: 화면에 실제로 등장하는 용어만(instruments/rhythm/production/
 * vocal 필드에서 추출) 우선. 전부 만들지 않는다 — 카드에 안 나오는 용어는
 * 밑줄을 긋지 않는다(§D-4, genreExplainer.ts의 glossaryTerms/PHRASE_KO에
 * 실제로 등장하는 어휘 중심으로 65종을 채움).
 */
export interface GlossaryTerm {
  term: string;
  termKo: string;
  explanationKo: string;
  relatedKo?: string;
}

export const MUSIC_GLOSSARY: GlossaryTerm[] = [
  // --- 악기 ---
  { term: 'upright bass', termKo: '업라이트 베이스', explanationKo: '세워서 활이나 손으로 연주하는 커다란 현악기. 부드럽고 둥근 저음이 특징입니다.', relatedKo: '재즈·두왑 등 어쿠스틱한 장르에서 많이 씁니다.' },
  { term: 'brushed snare', termKo: '브러시 스네어', explanationKo: '드럼스틱 대신 빗자루 모양 브러시로 쓸어 치는 주법. 소리가 부드럽고 번져서 잔잔한 곡에 씁니다.', relatedKo: '반대: 스틱으로 친 스네어 — 더 또렷하고 강합니다.' },
  { term: 'brushed drums', termKo: '브러시 드럼', explanationKo: '드럼 세트 전체를 브러시로 연주해 부드럽고 조용한 질감을 내는 방식입니다.' },
  { term: 'Rhodes', termKo: '로즈 피아노', explanationKo: '1970년대에 흔했던 전자 피아노. 종소리처럼 은은하게 퍼지는 음색이 특징입니다.' },
  { term: 'Wurlitzer', termKo: '우얼리처', explanationKo: '로즈 피아노와 비슷한 빈티지 전자 피아노. 살짝 더 거칠고 개성 있는 음색입니다.' },
  { term: 'harpsichord', termKo: '하프시코드', explanationKo: '피아노 이전에 쓰이던 건반악기. 현을 뜯어 소리 내 또랑또랑하고 반짝이는 음색입니다.' },
  { term: 'glockenspiel', termKo: '글로켄슈필', explanationKo: '작은 금속판을 채로 쳐서 내는 맑고 반짝이는 타악기 소리입니다.' },
  { term: 'celesta', termKo: '첼레스타', explanationKo: '건반으로 연주하는 종 계열 악기. 동화 같은 반짝이는 음색입니다.' },
  { term: 'vibraphone', termKo: '비브라폰', explanationKo: '금속 막대를 채로 쳐서 내는 음이 은은하게 떨리며 울리는 타악기입니다.' },
  { term: 'castanets', termKo: '캐스터네츠', explanationKo: '손에 쥐고 딱딱 부딪쳐 소리 내는 작은 타악기. 경쾌한 리듬 포인트로 씁니다.' },
  { term: 'tambourine', termKo: '탬버린', explanationKo: '작은 방울이 달린 타악기. 비트를 밝게 강조할 때 씁니다.' },
  { term: 'pedal steel guitar', termKo: '페달 스틸 기타', explanationKo: '슬라이드바로 현을 눌러 음을 부드럽게 미끄러뜨리는 기타. 컨트리·소프트록에서 애잔한 느낌을 냅니다.' },
  { term: '12-string guitar', termKo: '12현 기타', explanationKo: '일반 기타보다 현이 두 배 많아 소리가 더 풍성하고 쟁글거리는 기타입니다.', relatedKo: '브리티시 비트 장르의 대표 사운드.' },
  { term: 'saxophone', termKo: '색소폰', explanationKo: '금관처럼 보이지만 목관에 속하는 악기. 부드럽고 감성적인 솔로에 자주 씁니다.' },
  { term: 'muted trumpet', termKo: '뮤트 트럼펫', explanationKo: '트럼펫 관 끝에 약음기를 꽂아 소리를 좁고 아련하게 만든 연주법입니다.' },
  { term: 'flugelhorn', termKo: '플루겔혼', explanationKo: '트럼펫과 비슷하지만 더 둥글고 따뜻한 음색을 가진 금관악기입니다.' },
  { term: 'string section', termKo: '스트링 섹션', explanationKo: '바이올린·비올라·첼로 등 현악기 여러 대가 함께 연주하는 편성입니다.' },
  { term: 'double bass', termKo: '더블베이스', explanationKo: '업라이트 베이스와 같은 악기를 가리키는 다른 이름입니다.' },
  { term: 'felt piano', termKo: '펠트 피아노', explanationKo: '해머에 천을 덧대 소리를 낮추고 부드럽게 만든 피아노. 조용한 발라드에 씁니다.' },
  { term: 'nylon guitar', termKo: '나일론 기타', explanationKo: '나일론 줄을 쓰는 클래식·보사노바 기타. 쇠줄 기타보다 소리가 부드럽습니다.' },
  { term: 'accordion', termKo: '아코디언', explanationKo: '건반과 바람주머니로 소리 내는 악기. 샹송·유럽풍 곡에서 특유의 애수를 냅니다.' },
  { term: 'mandolin', termKo: '만돌린', explanationKo: '작은 몸통에 현이 여러 겹인 발현악기. 포크 장르에서 잔잔한 트레몰로 반주로 씁니다.' },
  { term: 'harmonica', termKo: '하모니카', explanationKo: '입으로 불어 연주하는 작은 리드 악기. 포크·블루스에서 향수를 자아냅니다.' },
  { term: 'timpani', termKo: '팀파니', explanationKo: '음정을 조절할 수 있는 커다란 오케스트라 북. 웅장한 순간에 씁니다.' },
  { term: 'muted guitar', termKo: '뮤트 기타', explanationKo: '줄을 손으로 살짝 눌러 막아 소리를 짧고 퍼커시브하게 낸 기타 연주법입니다.' },
  { term: 'tremolo electric guitar', termKo: '트레몰로 기타', explanationKo: '음량이 빠르게 떨리듯 오르내리게 만드는 이펙트를 건 기타 사운드입니다.' },
  { term: 'upright piano', termKo: '업라이트 피아노', explanationKo: '세로로 세워진 형태의 일반적인 피아노. 그랜드 피아노보다 작고 아담한 소리입니다.' },
  { term: '12-string electric guitar', termKo: '12현 일렉트릭 기타', explanationKo: '줄이 두 배로 많은 전기 기타. 더 풍성하고 쟁글대는 소리를 냅니다.', relatedKo: '브리티시 비트 장르의 대표 사운드.' },
  { term: 'piano', termKo: '피아노', explanationKo: '건반을 눌러 현을 때려 소리 내는 악기. 발라드에서 감정을 이끄는 중심 악기로 자주 씁니다.' },
  { term: 'acoustic guitar', termKo: '어쿠스틱 기타', explanationKo: '전기 증폭 없이 통 자체의 울림으로 소리 내는 기타입니다.' },
  { term: 'strings', termKo: '현악', explanationKo: '바이올린·비올라·첼로 등 활로 켜는 현악기 소리를 통틀어 가리키는 말입니다.' },
  { term: 'smooth bass', termKo: '매끄러운 베이스', explanationKo: '음이 끊기지 않고 부드럽게 이어지는 베이스 연주 톤입니다.' },
  { term: 'string quartet', termKo: '현악 4중주', explanationKo: '바이올린 둘, 비올라, 첼로로 이뤄진 실내악 편성. 아담하고 섬세한 현악 사운드를 냅니다.' },
  { term: 'concert harp', termKo: '콘서트 하프', explanationKo: '커다란 오케스트라용 하프. 흐르는 듯한 아르페지오로 우아한 색을 더합니다.' },
  { term: 'oboe obbligato', termKo: '오보에 오블리가토', explanationKo: '멜로디를 장식하듯 따라 연주하는 오보에 선율. 애틋하고 서정적인 느낌을 줍니다.' },
  { term: 'woodwind obbligato', termKo: '목관 오블리가토', explanationKo: '플루트·클라리넷 같은 목관악기가 멜로디를 장식하듯 곁들이는 연주입니다.' },
  { term: 'arpeggiated synth', termKo: '아르페지오 신스', explanationKo: '코드의 음을 한 음씩 빠르게 순서대로 반복 연주하는 신시사이저 패턴입니다.' },
  { term: 'analog synth pad', termKo: '아날로그 신스 패드', explanationKo: '길게 뻗어 은은하게 배경을 채우는 아날로그 신시사이저 음색입니다.' },
  { term: 'gospel-toned backing vocal', termKo: '가스펠톤 백킹 보컬', explanationKo: '교회 음악에서 온 힘 있고 두꺼운 화음 코러스 스타일입니다.' },
  { term: 'handclap percussion', termKo: '핸드클랩', explanationKo: '손뼉 치는 소리를 겹겹이 쌓아 만든 타악기 사운드. 경쾌한 비트 포인트로 씁니다.' },
  { term: 'horn section stabs', termKo: '혼 섹션 스탭', explanationKo: '금관 악기 여러 대가 짧고 강하게 동시에 찌르듯 연주하는 액센트입니다.' },

  // --- 리듬·박자 ---
  { term: '12/8 triplet shuffle', termKo: '셋잇단 셔플', explanationKo: '한 박을 셋으로 나누는 리듬(12/8박). 뛰는 듯한 느낌이 나면서도 같은 BPM의 4박자보다 여유롭게 들립니다.', relatedKo: '두왑 발라드의 대표 리듬.' },
  { term: 'groove', termKo: '그루브', explanationKo: '리듬이 몸을 움직이게 만드는 반복적인 흐름감입니다. 장르 설명의 "~그루브"는 그 장르 특유의 리듬 느낌을 뜻합니다.' },
  { term: 'pulse', termKo: '펄스', explanationKo: '곡 전체를 지탱하는 일정한 박동감입니다. "~펄스"는 그 장르가 걷는 듯한지 뛰는 듯한지 등 리듬이 주는 인상을 가리킵니다.' },
  { term: 'straight 4/4 feel', termKo: '스트레이트', explanationKo: '스윙이나 셔플처럼 리듬을 비틀지 않고 박자를 곧게 그대로 연주하는 방식입니다.' },
  { term: 'bouncy pop pulse', termKo: '통통 튀는', explanationKo: '리듬이 가볍게 튀어 오르듯 경쾌하게 들리는 느낌을 나타냅니다.' },
  { term: 'jangly guitar', termKo: '쟁글대는', explanationKo: '기타 줄이 짤랑거리듯 밝고 또렷하게 울리는 톤을 가리킵니다.', relatedKo: '브리티시 비트 장르의 대표 기타 톤.' },
  { term: 'strummed acoustic guitar', termKo: '스트럼', explanationKo: '기타 줄을 손이나 피크로 쓸어내리듯 연주하는 주법입니다.' },
  { term: 'cymbal swells', termKo: '심벌 스웰', explanationKo: '심벌즈를 서서히 크게 울려 긴장감이나 여운을 만드는 연주법입니다.' },
  { term: 'piano pads', termKo: '피아노 패드', explanationKo: '짧은 음이 아니라 코드를 길게 눌러 배경처럼 은은하게 깔아주는 피아노 연주입니다.' },
  { term: 'walking bass', termKo: '워킹 베이스', explanationKo: '한 음씩 계단처럼 걸어가듯 움직이는 베이스 라인. 재즈에서 흔합니다.' },
  { term: 'four-on-the-floor', termKo: '포온더플로어', explanationKo: '매 박마다 킥드럼을 규칙적으로 치는 댄스 리듬입니다.' },
  { term: 'rubato', termKo: '루바토', explanationKo: '정해진 박자 없이 감정에 따라 빠르기를 자유롭게 늘였다 줄였다 하는 연주법입니다.' },
  { term: 'backbeat', termKo: '백비트', explanationKo: '2박·4박처럼 약박에 강세를 주는 팝·록의 기본 리듬 감각입니다.' },
  { term: 'syncopation', termKo: '싱코페이션', explanationKo: '정박이 아닌 자리에 강세를 둬 리듬에 튕기는 느낌을 주는 기법입니다.' },
  { term: 'swing feel', termKo: '스윙 필', explanationKo: '8분음표를 정확히 반씩 나누지 않고 통통 튀듯 불균등하게 연주하는 재즈 특유의 리듬감입니다.' },
  { term: 'bossa syncopation', termKo: '보사노바 싱코페이션', explanationKo: '브라질 보사노바 특유의 엇박 기타 리듬입니다.' },

  // --- 프로덕션·믹스 ---
  { term: 'wall of sound', termKo: '월 오브 사운드', explanationKo: '악기와 보컬을 겹겹이 쌓아 두껍고 웅장하게 만드는 제작 기법. 1960년대 걸그룹 팝의 상징입니다.' },
  { term: 'mono-leaning mix', termKo: '모노에 가까운 믹스', explanationKo: '좌우로 넓게 퍼뜨리지 않고 가운데로 모아 소리를 낸 믹스. 빈티지한 느낌을 줍니다.' },
  { term: 'tube-amp coloration', termKo: '진공관 앰프 색채', explanationKo: '진공관 앰프를 거치며 생기는 따뜻하고 살짝 찌그러진 듯한 음색입니다.' },
  { term: 'spring reverb', termKo: '스프링 리버브', explanationKo: '스프링의 진동으로 잔향을 만드는 빈티지 리버브. 살짝 출렁이는 질감이 있습니다.' },
  { term: 'AM-radio compression', termKo: 'AM 라디오 압축', explanationKo: '옛날 AM 라디오처럼 소리 폭을 좁혀 아련하고 복고적으로 들리게 만드는 처리입니다.' },
  { term: 'analog room tone', termKo: '아날로그 룸 톤', explanationKo: '디지털로 다듬기 전, 실제 방 공간의 울림이 살아있는 듯한 아날로그 녹음 느낌입니다.' },

  // --- 보컬 ---
  { term: 'close harmony', termKo: '클로즈 하모니', explanationKo: '화음 간격을 좁게 붙여 부르는 방식. 목소리가 하나처럼 뭉쳐 들려서 두왑·바버샵에서 많이 씁니다.' },
  { term: 'call-and-response', termKo: '콜 앤 리스폰스', explanationKo: '한 목소리가 부르면 다른 목소리(나 악기)가 받아 대답하듯 이어가는 구성입니다.' },
  { term: 'unison', termKo: '유니즌', explanationKo: '여러 목소리가 화음 없이 같은 음을 함께 부르는 방식. 힘 있고 통일된 느낌을 줍니다.' },
  { term: 'nonsense-syllable backing vocal', termKo: '의성음 백킹 보컬', explanationKo: '"두왑"·"샤랄라"처럼 뜻 없는 음절로 화음을 채우는 코러스 창법입니다.' },
  { term: 'crooning', termKo: '크루닝', explanationKo: '마이크에 가까이 대고 나직하고 부드럽게 속삭이듯 부르는 창법입니다.' },
  { term: 'scat', termKo: '스캣', explanationKo: '가사 없이 즉흥적인 음절로 악기처럼 노래하는 재즈 보컬 기법입니다.' },
  { term: 'falsetto', termKo: '팔세토', explanationKo: '진성보다 높은 가성 음역으로 부르는 창법. 여리고 애틋한 느낌을 줍니다.' },

  // --- 화성·이론 ---
  { term: 'ii-V-I turnaround', termKo: '투파이브원 진행', explanationKo: '재즈에서 가장 흔한 코드 진행. 긴장(ii-V)했다가 안정(I)으로 돌아오는 흐름입니다.' },
  { term: 'money chord', termKo: '머니코드', explanationKo: '대중음악에서 반복적으로 쓰이는 검증된 코드 진행. 익숙해서 처음 들어도 기억에 남습니다.' },
  { term: 'doo-wop turnaround', termKo: '두왑 진행', explanationKo: 'I-vi-IV-V로 이어지는 두왑 특유의 코드 진행. 달콤하고 향수 어린 느낌의 근원입니다.' },
  { term: 'maj7 chord', termKo: '메이저7 코드', explanationKo: '기본 코드에 한 음을 더해 은은하고 재즈풍의 여운을 남기는 화음입니다.' },
  { term: 'minor-key melancholy', termKo: '단조의 애수', explanationKo: '단조(마이너 키)로 곡을 쓰면 자연스럽게 쓸쓸하고 애틋한 색이 생깁니다.' },

  // --- 이 앱의 핵심 개념 ---
  { term: 'perceived energy', termKo: '체감 에너지', explanationKo: 'BPM만으로는 설명되지 않는 "바쁜 느낌". 같은 95 BPM이라도 브러시 드럼에 긴 보컬이면 느긋하고, 탬버린에 짧은 기타면 바쁘게 들립니다.' },
  { term: 'era bucket', termKo: '시대색', explanationKo: '그 장르가 특정 연대(1950~80년대 등)의 사운드를 뚜렷이 담고 있는지를 나타내는 값입니다. 없으면(era-neutral) 특정 시대보다 무드 중심 장르라는 뜻입니다.' },
  { term: 'tempo range', termKo: '템포 대역', explanationKo: '그 장르가 자연스럽게 쓰이는 BPM(분당 박자 수) 범위입니다.' }
];
