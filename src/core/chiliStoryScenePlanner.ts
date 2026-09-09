import type { ChiliStoryPov, GenerationOptions, PreassignedSongSlot } from '../types';
import {
  cafeChiliStoryActForTrack,
  chiliStoryActForTrack,
  CHILI_STORY_DEFAULT_SONG_COUNT
} from './chiliStoryPov';

type StorySceneInput = Pick<
  GenerationOptions,
  | 'songCount'
  | 'storyPov'
  | 'cafeStoryMode'
  | 'storySourceTitle'
  | 'storySourceSummary'
  | 'storyPovIntentSummary'
  | 'storyPlanLine'
  | 'storySourceLine'
  | 'cafeLocation'
  | 'cafeType'
  | 'cafeSeason'
  | 'cafeTimeOfDay'
  | 'cafeWeather'
> & {
  isCafe?: boolean;
};

export type ChiliStoryRelationshipStage = 'first-meeting' | 'early-connection' | 'conflict' | 'repair' | 'afterglow';

export interface ChiliStoryPlannedScene {
  trackNo: number;
  title: string;
  hookPhrase: string;
  lyricTheme: string;
  lyricThemeText: string;
  lyricThemeArc: string;
  lyricFrameId: string;
  lyricThemeMotionKo: string;
  lyricThemeCastKo: string;
  lyricThemeEraSettingKo: string;
  vocabularyBankId: string;
  storyAct: number;
  storyActLabel: string;
  storyArcRole: string;
  relationshipStage: ChiliStoryRelationshipStage;
  sourceLocal: true;
}

interface StoryTemplate {
  title: string;
  hook: string;
  scene: string;
  arc: string;
  frameId: string;
  motionKo: string;
  castKo: string;
  eraSettingKo: string;
  vocabularyBankId: string;
}

const FUTURE_STAGE_PATTERN = /공항|airport|이삿짐|moving boxes|동거|cohabitation|shared toothbrush|호텔 로비|hotel lobby|이별|breakup|재회|reunion|결혼|marriage|해외|overseas|장거리|long-distance|회사|office|엘리베이터|elevator/iu;

const TRAIN_SOURCE_PATTERN = /기차|열차|전철|車内|電車|列車|同じ(?:車両|窓)|칸|창가|눈이 마주|目が合/iu;
const FIRST_MEETING_PATTERN = /처음\s*만남|첫\s*만남|처음|첫|初めて|初対面|出会|first\s*meet|目が合/iu;

const TRAIN_FEMALE_TEMPLATES: StoryTemplate[] = [
  {
    title: '目が合っただけ',
    hook: '視線だけで',
    scene: '같은 기차 칸에서 창밖을 보다가 눈이 마주친 직후, 그녀는 먼저 고개를 돌렸지만 그 한순간을 계속 떠올린다.',
    arc: '우연한 시선이 단순한 착각인지 설렘인지 스스로 확인하려 한다.',
    frameId: 'jpstory-train-first-meeting-act1-gaze',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act1-glance'
  },
  {
    title: '同じ窓の横顔',
    hook: '窓に残る君',
    scene: '같은 창가에 비친 그의 옆모습과 자신의 표정이 겹쳐 보이고, 그녀는 들키지 않게 숨을 고른다.',
    arc: '창문 반사 속 작은 표정이 마음의 첫 단서가 된다.',
    frameId: 'jpstory-train-first-meeting-act1-window',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act1-glance'
  },
  {
    title: 'イヤホンの片耳',
    hook: '言えない期待',
    scene: '이어폰 한쪽을 빼려다 멈춘 채, 그녀는 다음 정거장 안내가 나오기 전 그가 말을 걸어주길 바란다.',
    arc: '말을 기다린 자신을 인정하며 기대가 생겼음을 깨닫는다.',
    frameId: 'jpstory-train-first-meeting-act1-earbud',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act1-glance'
  },
  {
    title: '近い吊革',
    hook: 'イヤホン越し',
    scene: '차가 흔들려 같은 손잡이 근처로 가까워진 순간을 그녀는 아무렇지 않은 척 넘기지만 손끝 감각이 남는다.',
    arc: '작은 거리 변화가 하루 종일 반복 재생되는 기억이 된다.',
    frameId: 'jpstory-train-first-meeting-act2-strap',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act2-replay'
  },
  {
    title: 'アナウンスの隙間',
    hook: '君の一歩待つ',
    scene: '안내 방송이 끊긴 짧은 정적 속에서 그녀는 그가 한 걸음 움직였는지 아닌지를 오래 되짚는다.',
    arc: '아무 일도 없던 틈을 자기만의 신호로 읽고 싶어진다.',
    frameId: 'jpstory-train-first-meeting-act2-announcement',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act2-replay'
  },
  {
    title: 'ドア際の期待',
    hook: '近い吊革',
    scene: '문이 열리기 전 같은 방향으로 몸을 돌린 기억 때문에, 그녀는 우연이 다음 행동으로 이어질 수 있었는지 생각한다.',
    arc: '놓친 대화의 가능성이 기대와 아쉬움 사이에서 흔들린다.',
    frameId: 'jpstory-train-first-meeting-act2-door',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act2-replay'
  },
  {
    title: '反射の中の本音',
    hook: '目をそらせない',
    scene: '창문 반사로 다시 눈이 닿은 것 같던 장면을 떠올리며, 그녀는 자신이 먼저 피한 이유를 묻는다.',
    arc: '설렘보다 부끄러움을 먼저 선택한 마음을 알아차린다.',
    frameId: 'jpstory-train-first-meeting-act3-reflection',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act3-realization'
  },
  {
    title: '切符の裏側',
    hook: 'アナウンスの後',
    scene: '표를 손에 쥔 채 목적지를 확인하던 순간, 그녀는 그와 같은 시간에 같은 칸에 있었다는 사실을 크게 느낀다.',
    arc: '우연이라고 부르기엔 마음이 이미 의미를 붙이고 있음을 인정한다.',
    frameId: 'jpstory-train-first-meeting-act3-ticket',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act3-realization'
  },
  {
    title: 'そらした理由',
    hook: '小さく揺れる',
    scene: '그녀는 눈을 피한 장면을 다시 떠올리고, 사실은 말을 걸어주길 기다렸다는 마음을 조용히 받아들인다.',
    arc: '자신이 원했던 다음 행동을 처음으로 이름 붙인다.',
    frameId: 'jpstory-train-first-meeting-act3-gaze',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act3-realization'
  },
  {
    title: '降りる前の息',
    hook: 'ドアが開く前',
    scene: '문이 열리기 전의 짧은 숨처럼, 그녀는 다음에 같은 시간의 기차를 타면 먼저 시선을 피하지 않겠다고 마음먹는다.',
    arc: '아직 행동은 작지만 마음의 방향이 정해진다.',
    frameId: 'jpstory-train-first-meeting-act4-door',
    motionKo: '이동 중(기차)',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act4-hesitation'
  },
  {
    title: '揺れる手すり',
    hook: '切符の裏で',
    scene: '흔들리는 손잡이를 붙잡던 그 순간을 떠올리며, 그녀는 아무 말 없던 자신에게 작은 용기를 건넨다.',
    arc: '말하지 못한 마음을 부끄러움이 아니라 다음을 위한 준비로 바꾼다.',
    frameId: 'jpstory-train-first-meeting-act4-strap',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act4-hesitation'
  },
  {
    title: '次の一駅',
    hook: '次を待てたら',
    scene: '다음 역 안내를 떠올리며, 그녀는 그때 한마디를 건넸다면 어땠을지 상상하되 현재의 첫 만남 안에 머문다.',
    arc: '상상은 미래 사건이 아니라 그 순간의 선택지를 다시 비추는 방식이 된다.',
    frameId: 'jpstory-train-first-meeting-act4-announcement',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act4-hesitation'
  },
  {
    title: '窓に残した返事',
    hook: '同じ窓の朝',
    scene: '같은 창가의 빛과 반사만 남은 기억 속에서, 그녀는 다시 마주치면 작은 미소로 답하겠다고 정리한다.',
    arc: '첫 만남의 의미가 미련이 아니라 조용한 다음 태도로 남는다.',
    frameId: 'jpstory-train-first-meeting-act5-window',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act5-next'
  },
  {
    title: '同じ時刻',
    hook: 'また目が合う',
    scene: '그녀는 같은 시간, 같은 칸, 같은 창가라는 세 가지 우연을 마음속에 접어 두고 작은 기대를 허락한다.',
    arc: '장면은 확장되지 않고 첫 시선의 여운 안에서 부드럽게 열린다.',
    frameId: 'jpstory-train-first-meeting-act5-time',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act5-next'
  },
  {
    title: '小さな一歩',
    hook: '言えたらいい',
    scene: '처음 눈이 마주친 기차 칸을 다시 떠올리며, 그녀는 말하지 못한 기대를 다음 시선에 담아보기로 한다.',
    arc: '첫 만남의 떨림을 끝내지 않고 다음에 건넬 아주 작은 행동으로 남긴다.',
    frameId: 'jpstory-train-first-meeting-act5-gaze',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act5-next'
  }
];

const TRAIN_MALE_TEMPLATES: StoryTemplate[] = [
  {
    title: '窓ぎわの君',
    hook: '窓ぎわの君',
    scene: '같은 기차 칸 창가에서 그녀와 눈이 마주친 뒤, 그는 아무 일 아닌 듯 시선을 돌리지만 계속 창문 쪽을 의식한다.',
    arc: '설렘을 인정하지 않으려는 태도가 첫 장면의 긴장이 된다.',
    frameId: 'jpstory-train-first-meeting-act1-gaze',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act1-glance'
  },
  {
    title: '目線を戻せない',
    hook: '目線を隠す',
    scene: '창문 반사에 비친 그녀의 표정을 보고도 그는 못 본 척하며 이어폰 선을 만지작거린다.',
    arc: '관심을 숨기려는 행동이 오히려 마음을 드러낸다.',
    frameId: 'jpstory-train-first-meeting-act1-window',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act1-glance'
  },
  {
    title: 'イヤホン越しの距離',
    hook: '認めたくない',
    scene: '그는 이어폰을 끼고 있어도 안내 방송보다 그녀가 움직이는 작은 소리에 더 신경 쓰였던 것을 떠올린다.',
    arc: '감각이 이미 그녀 쪽으로 기울었다는 사실을 부정한다.',
    frameId: 'jpstory-train-first-meeting-act1-earbud',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act1-glance'
  },
  {
    title: '吊革のためらい',
    hook: 'イヤホン外せず',
    scene: '차가 흔들려 손잡이 가까이 섰던 순간, 그는 말을 걸 틈이 있었는데도 괜히 자세만 고친다.',
    arc: '가까워진 거리 앞에서 망설임이 먼저 나온다.',
    frameId: 'jpstory-train-first-meeting-act2-strap',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act2-replay'
  },
  {
    title: '放送のあとで',
    hook: '君が立つ駅',
    scene: '다음 역 안내 뒤 그녀가 내릴지 모른다고 생각하며, 그는 괜히 표와 전광판만 확인한다.',
    arc: '아직 아무 관계도 아니기에 더 쉽게 말을 잃는다.',
    frameId: 'jpstory-train-first-meeting-act2-announcement',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act2-replay'
  },
  {
    title: 'ドアの前の沈黙',
    hook: '吊革を譲れず',
    scene: '문 앞에 함께 서는 짧은 시간 동안 그는 비켜설지 말을 걸지 정하지 못한 채 침묵만 길어진다.',
    arc: '친절한 행동 하나도 마음을 들킬까 봐 늦어진다.',
    frameId: 'jpstory-train-first-meeting-act2-door',
    motionKo: '이동 중(기차)',
    castKo: '둘',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act2-replay'
  },
  {
    title: '反射だけの会話',
    hook: '声にできない',
    scene: '창문 반사 속 눈길이 다시 겹친 것 같던 순간을 그는 우연이라 말하지만 사실은 기다리고 있었다.',
    arc: '부정하던 관심이 자기 안에서 분명해진다.',
    frameId: 'jpstory-train-first-meeting-act3-reflection',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act3-realization'
  },
  {
    title: '切符を握る手',
    hook: '放送が遠い',
    scene: '표를 쥔 손에 힘이 들어간 것을 떠올리며, 그는 왜 그 순간만 유난히 긴장했는지 인정하기 시작한다.',
    arc: '숨겼던 설렘의 몸짓을 뒤늦게 읽는다.',
    frameId: 'jpstory-train-first-meeting-act3-ticket',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act3-realization'
  },
  {
    title: '認めないふり',
    hook: '反射だけ見る',
    scene: '그는 그녀에게 관심 없다는 표정을 지었던 이유가 사실은 먼저 기대하고 싶지 않아서였음을 깨닫는다.',
    arc: '무심한 척한 태도 뒤의 두려움이 드러난다.',
    frameId: 'jpstory-train-first-meeting-act3-gaze',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act3-realization'
  },
  {
    title: '降りる駅まで',
    hook: 'ドア前の迷い',
    scene: '문이 열리기 전 그는 한마디를 준비했다가 삼킨 기억을 되짚고, 다음에는 피하지 않겠다고 마음속으로 정한다.',
    arc: '행동하지 못한 이유를 알면서도 다음 작은 용기를 준비한다.',
    frameId: 'jpstory-train-first-meeting-act4-door',
    motionKo: '이동 중(기차)',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act4-hesitation'
  },
  {
    title: '手すりの近さ',
    hook: '切符を握る',
    scene: '흔들리는 손잡이 옆에서 그녀와 나란히 섰던 거리를 떠올리며, 그는 말 대신 자세를 고친 자신을 웃는다.',
    arc: '서투른 숨김을 탓하기보다 마음을 인정하는 쪽으로 기운다.',
    frameId: 'jpstory-train-first-meeting-act4-strap',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act4-hesitation'
  },
  {
    title: '次の停車まで',
    hook: '次で言えたら',
    scene: '다음 정거장까지 남은 시간을 떠올리며, 그는 그 짧은 틈에 자신이 정말 하고 싶던 말을 찾아본다.',
    arc: '상상은 관계 진전이 아니라 첫 만남 속 말하지 못한 선택을 정리한다.',
    frameId: 'jpstory-train-first-meeting-act4-announcement',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act4-hesitation'
  },
  {
    title: '同じ時刻の君',
    hook: '同じ窓を追う',
    scene: '같은 시간의 기차 칸과 같은 창가를 생각하며, 그는 다시 마주치면 이번에는 시선을 피하지 않겠다고 다짐한다.',
    arc: '첫 시선의 여운이 다음 태도를 바꾸는 조용한 기준이 된다.',
    frameId: 'jpstory-train-first-meeting-act5-window',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act5-next'
  },
  {
    title: '言葉の一歩手前',
    hook: 'まだ降りない',
    scene: '그는 아직 내리지 않은 듯 마음속에 남은 짧은 침묵을 되짚고, 다음 시선에 담을 한마디를 고른다.',
    arc: '완결된 사건이 아니라 첫 만남의 여운 속에서 작은 결심으로 마무리한다.',
    frameId: 'jpstory-train-first-meeting-act5-time',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act5-next'
  },
  {
    title: '窓に映る勇気',
    hook: '君へ向かう',
    scene: '창문에 비친 자신의 얼굴을 떠올리며, 그는 숨겼던 설렘을 인정하고 다음에는 먼저 웃어 보이겠다고 정리한다.',
    arc: '말하지 못한 마음을 첫 만남 안에서 길어 올려 다음 행동의 씨앗으로 남긴다.',
    frameId: 'jpstory-train-first-meeting-act5-gaze',
    motionKo: '정적',
    castKo: '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: 'jpchili-train-act5-next'
  }
];

const TRAIN_COUPLE_TEMPLATES: StoryTemplate[] = TRAIN_FEMALE_TEMPLATES.map((template, index) => ({
  ...template,
  title: [
    '同じ窓で',
    '目が合う車内',
    '片耳の沈黙',
    '近い手すり',
    '放送のあと',
    'ドアの前で',
    '反射のふたり',
    '切符の時間',
    'そらした視線',
    '開く前の息',
    '揺れる距離',
    '次の一駅まで',
    '窓に残る答え',
    '同じ時刻へ',
    '小さな合図'
  ][index] ?? template.title,
  hook: [
    '同じ窓で',
    '目が合った',
    '片耳のまま',
    '近く揺れる',
    '放送のあと',
    'ドアの前で',
    '反射の中で',
    '切符の時間',
    'そらしたまま',
    '息を合わせる',
    '距離が揺れる',
    '次の駅まで',
    '窓に残した',
    '同じ時刻へ',
    '小さな合図'
  ][index] ?? template.hook,
  scene: template.scene.replace('그녀는', '두 사람은').replace('그가', '서로가'),
  arc: '두 시점의 작은 신호가 같은 첫 만남 안에서 다르게 해석된다.'
}));

const GENERIC_TITLE_POOLS: Record<ChiliStoryPov, string[]> = {
  female: ['彼女の一秒', 'ほどける合図', '言えない余白', '小さな期待', '近い沈黙', '揺れる返事', '胸の置き場', '見ないふり', '残った温度', '選べない声', '手前の勇気', '淡い約束', '同じ景色', 'そっと次へ', 'まだ消えない'],
  male: ['彼の一秒', '隠した合図', '言えない理由', '小さな強がり', '近づく沈黙', '遅れた返事', '胸の奥側', '平気なふり', '残した温度', '選べない横顔', '言葉の手前', '淡い強がり', '同じ雨音', 'そっと戻る', 'まだ認めない'],
  couple: ['ふたりの一秒', 'ほどける合図', '言えない余白', '小さな期待', '近い沈黙', '揺れる返事', '胸の置き場', '見ないふり', '残った温度', '選べない声', '手前の勇気', '淡い約束', '同じ景色', 'そっと次へ', 'まだ消えない']
};

const GENERIC_HOOK_POOLS: Record<ChiliStoryPov, string[]> = {
  female: ['まだ言えない', '少し近くへ', '気づいてほしい', '胸がほどける', '小さく待つ', '声になる前', '目をそらせず', '本音の手前', '同じ景色で', '一歩だけ先', 'そっと変わる', '今日を残して', '返事の代わり', '次は笑える', '消えないまま'],
  male: ['まだ隠してる', '近づけなくて', '気づかれたくて', '胸が揺れてる', '小さく迷う', '声にできず', '目を戻せない', '本音を隠す', '同じ雨音で', '一歩手前で', 'そっと見送る', '今日を抱えて', '返事を探す', '次は笑いたい', '消せないまま'],
  couple: ['まだ言えない', '少し近くへ', '同じ合図で', '胸がほどける', '小さく待つ', '声になる前', '目をそらせず', '本音の手前', '同じ景色で', '一歩だけ先', 'そっと変わる', '今日を残して', '返事の代わり', '次は笑える', '消えないまま']
};

function effectivePov(input: StorySceneInput): ChiliStoryPov {
  const value = input.isCafe ? input.cafeStoryMode ?? input.storyPov : input.storyPov;
  return value === 'male' || value === 'female' || value === 'couple' ? value : 'couple';
}

function sourceText(input: StorySceneInput): string {
  return [
    input.storySourceTitle,
    input.storySourceSummary,
    input.storyPovIntentSummary,
    input.storyPlanLine,
    input.storySourceLine,
    input.cafeLocation,
    input.cafeType
  ].filter(Boolean).join(' ');
}

export function inferChiliStoryRelationshipStage(input: Pick<StorySceneInput, 'storySourceTitle' | 'storySourceSummary' | 'storyPlanLine' | 'storySourceLine'>): ChiliStoryRelationshipStage {
  const text = [input.storySourceTitle, input.storySourceSummary, input.storyPlanLine, input.storySourceLine].filter(Boolean).join(' ');
  if (FIRST_MEETING_PATTERN.test(text)) return 'first-meeting';
  if (/誤解|오해|갈등|すれ違|conflict|silence|침묵/iu.test(text)) return 'conflict';
  if (/화해|고백|약속|告白|約束|repair|promise/iu.test(text)) return 'repair';
  if (/余韻|afterglow|여운|翌朝|아침/iu.test(text)) return 'afterglow';
  return 'early-connection';
}

function isTrainFirstMeeting(input: StorySceneInput): boolean {
  const text = sourceText(input);
  return TRAIN_SOURCE_PATTERN.test(text) && inferChiliStoryRelationshipStage(input) === 'first-meeting';
}

function templateIndexForTrack(trackNo: number, songCount: number): number {
  const total = Math.max(1, songCount);
  if (total === CHILI_STORY_DEFAULT_SONG_COUNT) return Math.max(0, Math.min(14, trackNo - 1));
  return Math.max(0, Math.min(14, Math.floor(((Math.max(1, trackNo) - 1) * CHILI_STORY_DEFAULT_SONG_COUNT) / total)));
}

function trainTemplatesFor(pov: ChiliStoryPov): StoryTemplate[] {
  if (pov === 'male') return TRAIN_MALE_TEMPLATES;
  if (pov === 'female') return TRAIN_FEMALE_TEMPLATES;
  return TRAIN_COUPLE_TEMPLATES;
}

function genericTemplate(input: StorySceneInput, trackNo: number, stage: ChiliStoryRelationshipStage): StoryTemplate {
  const pov = effectivePov(input);
  const index = templateIndexForTrack(trackNo, input.songCount);
  const title = GENERIC_TITLE_POOLS[pov][index] ?? `STORY ${trackNo}`;
  const hook = GENERIC_HOOK_POOLS[pov][index] ?? `まだここにいる`;
  const sourceTitle = input.storySourceTitle?.trim() || '원작 사건';
  const sourceSummary = input.storySourceSummary?.trim() || input.storySourceLine?.trim() || input.storyPlanLine?.trim() || sourceTitle;
  const cafeSetting = input.isCafe
    ? [input.cafeLocation, input.cafeType, input.cafeSeason, input.cafeTimeOfDay, input.cafeWeather].filter(Boolean).join(' / ')
    : '';
  const act = trackNo <= 3 ? 1 : trackNo <= 6 ? 2 : trackNo <= 9 ? 3 : trackNo <= 12 ? 4 : 5;
  const scenePrefix = input.isCafe && cafeSetting ? `${cafeSetting} 안에서 ` : '';
  const sceneByAct: Record<number, string> = {
    1: `${scenePrefix}${sourceTitle}의 사건을 벗어나지 않고, 원문 장면의 첫 표정과 거리감을 ${pov === 'male' ? '그의' : pov === 'female' ? '그녀의' : '두 사람의'} 1인칭 기억으로 좁혀 쓴다. 핵심 사건: ${sourceSummary}`,
    2: `${scenePrefix}${sourceTitle} 이후가 아니라 원문 순간 안에서, 작은 행동 하나를 반복해서 떠올리며 의미를 다르게 읽는다. 핵심 사건: ${sourceSummary}`,
    3: `${scenePrefix}${sourceTitle}의 같은 장면을 다시 보고, 말하지 못한 이유와 혼자 붙인 의미를 깨닫는다. 핵심 사건: ${sourceSummary}`,
    4: `${scenePrefix}${sourceTitle} 안에서 선택하지 못한 말이나 행동 하나를 정리한다. 사건을 새 단계로 건너뛰지 말고 그 순간의 가능성만 다룬다. 핵심 사건: ${sourceSummary}`,
    5: `${scenePrefix}${sourceTitle}의 여운을 다음 태도나 작은 결심으로 남긴다. 새 사건을 만들지 않고 원문 장면의 감정만 조용히 열린 채 둔다. 핵심 사건: ${sourceSummary}`
  };
  return {
    title,
    hook,
    scene: sceneByAct[act] ?? sceneByAct[5],
    arc: `${stage} stage kept source-local; reinterpret the same event from the selected POV without adding later relationship milestones.`,
    frameId: input.isCafe ? `jpcafe-source-local-act${act}` : `jpstory-source-local-act${act}`,
    motionKo: input.isCafe ? '정적(식탁)' : '정적',
    castKo: act <= 1 ? '둘' : '혼자',
    eraSettingKo: '현재',
    vocabularyBankId: input.isCafe ? `jpcafe-story-act${act}` : `jpchili-story-act${act}`
  };
}

function sourceLocalRoleForTrack(trackNo: number, songCount: number, pov: ChiliStoryPov, isCafe: boolean, isTrain: boolean): string {
  const act = isCafe ? cafeChiliStoryActForTrack(trackNo, songCount).storyAct : chiliStoryActForTrack(trackNo, songCount).storyAct;
  const inActPosition = songCount === CHILI_STORY_DEFAULT_SONG_COUNT ? ((trackNo - 1) % 3) : Math.floor(((trackNo - 1) * 3) / Math.max(1, songCount));
  const povTail = pov === 'male'
    ? 'his first-person interpretation'
    : pov === 'female'
      ? 'her first-person interpretation'
      : 'both interpretations without a pronoun swap';
  const trainRoles: Record<number, string[]> = {
    1: ['source-event first gaze', 'window reflection detail', 'earbud and announcement hesitation'],
    2: ['strap-handle memory replay', 'announcement-gap meaning', 'door-before-opening expectation'],
    3: ['reflection self-awareness', 'ticket-and-same-time realization', 'why the gaze was avoided'],
    4: ['door-breath decision inside the same ride', 'small courage around the handrail', 'next-stop thought without adding a new event'],
    5: ['same-window callback', 'same-time quiet expectation', 'small next glance as an open ending']
  };
  const genericRoles: Record<number, string[]> = {
    1: ['source-event anchor', 'first expression detail', 'small signal inside the original moment'],
    2: ['memory replay of the same event', 'small action reinterpreted', 'private meaning drawn from the source scene'],
    3: ['self-awareness inside the source event', 'hidden reason named', 'quiet truth found in the original scene'],
    4: ['unchosen word inside the same moment', 'small courage without changing stages', 'possible action considered within the source event'],
    5: ['source-scene callback', 'quiet after-feeling tied to the original moment', 'small open ending from the same event']
  };
  const cafeRoles: Record<number, string[]> = {
    1: ['source cafe arrival detail', 'table/window first expression', 'first small signal across the table'],
    2: ['conversation replay inside the cafe', 'cup and receipt detail', 'small shared action inside the source cafe'],
    3: ['cafe-detail self-awareness', 'short silence becomes clear', 'same table feels emotionally different'],
    4: ['unsaid words inside the cafe', 'hesitation before leaving the table', 'small choice without changing the source event'],
    5: ['last-sip callback', 'doorway after-feeling still tied to the cafe', 'small next promise carried by the source cafe mood']
  };
  const rolePool = isCafe ? cafeRoles[act] : isTrain ? trainRoles[act] : genericRoles[act];
  const role = rolePool[Math.max(0, Math.min(rolePool.length - 1, inActPosition))];
  return `${role} - ${povTail}`;
}

function plannedSceneFromTemplate(
  input: StorySceneInput,
  trackNo: number,
  template: StoryTemplate,
  stage: ChiliStoryRelationshipStage
): ChiliStoryPlannedScene {
  const isCafe = Boolean(input.isCafe);
  const pov = effectivePov(input);
  const act = isCafe ? cafeChiliStoryActForTrack(trackNo, input.songCount) : chiliStoryActForTrack(trackNo, input.songCount);
  return {
    trackNo,
    title: template.title,
    hookPhrase: template.hook,
    lyricTheme: template.frameId,
    lyricThemeText: template.scene,
    lyricThemeArc: template.arc,
    lyricFrameId: template.frameId,
    lyricThemeMotionKo: template.motionKo,
    lyricThemeCastKo: template.castKo,
    lyricThemeEraSettingKo: template.eraSettingKo,
    vocabularyBankId: template.vocabularyBankId,
    storyAct: act.storyAct,
    storyActLabel: act.storyActLabel,
    storyArcRole: `${template.arc} - ${sourceLocalRoleForTrack(trackNo, input.songCount, pov, isCafe, template.frameId.includes('train-first-meeting'))}`,
    relationshipStage: stage,
    sourceLocal: true
  };
}

export function planChiliStoryScenes(input: StorySceneInput): ChiliStoryPlannedScene[] {
  if (!sourceText(input).trim()) return [];
  const stage = inferChiliStoryRelationshipStage(input);
  const pov = effectivePov(input);
  const songCount = Math.max(0, input.songCount);
  return Array.from({ length: songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const template = isTrainFirstMeeting(input)
      ? trainTemplatesFor(pov)[templateIndexForTrack(trackNo, songCount)]
      : genericTemplate(input, trackNo, stage);
    return plannedSceneFromTemplate(input, trackNo, template, stage);
  });
}

export function planChiliStoryTitlesAndHooks(input: StorySceneInput & { storyScenes?: readonly ChiliStoryPlannedScene[] }): Array<Pick<PreassignedSongSlot, 'trackNo' | 'title' | 'hookPhrase'>> {
  const storyScenes = input.storyScenes ?? planChiliStoryScenes(input);
  return storyScenes.map(scene => ({
    trackNo: scene.trackNo,
    title: scene.title,
    hookPhrase: scene.hookPhrase
  }));
}

export function containsChiliStoryFutureStageViolation(text: string): boolean {
  return FUTURE_STAGE_PATTERN.test(text);
}

export function isSourceLocalChiliStoryScene(scene: Pick<ChiliStoryPlannedScene, 'sourceLocal' | 'lyricThemeText' | 'storyArcRole'>): boolean {
  return scene.sourceLocal === true
    && !containsChiliStoryFutureStageViolation(`${scene.lyricThemeText} ${scene.storyArcRole}`);
}
