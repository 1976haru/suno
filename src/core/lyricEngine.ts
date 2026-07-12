import type { GenerationOptions, LyricLanguage, SeasonPack, SongIdea } from '../types';
import { lyricImageBank } from '../data/lyrics';

export interface LyricLineCtx {
  season: string;
  situation: string;
  motif: string;
  title: string;
  /** A short (1-2 word) hook derived from the title's object word, safe to sing as a repeated chorus line. */
  hook: string;
}

type LineTemplate = (ctx: LyricLineCtx) => string[];

export function hashSeed(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class UniquePool<T> {
  private available: T[];
  private round = 0;

  constructor(private base: T[], private seed: number) {
    this.available = shuffle(base, seed);
  }

  take(): T {
    if (this.available.length === 0) {
      this.round += 1;
      this.available = shuffle(this.base, this.seed + this.round * 104729);
    }
    return this.available.shift() as T;
  }
}

// ---------------------------------------------------------------------------
// English pools
// ---------------------------------------------------------------------------

const enOpening: LineTemplate[] = [
  c => [`The ${c.season} light is resting`, 'on the table by the door', 'I hear a quiet radio', 'like I have heard before'],
  c => [`A ${c.season} wind is turning`, 'the pages of the day', `The ${c.motif} sits beside me`, 'with nothing left to say'],
  c => [`Somewhere past the ${c.season} street`, 'a small clock starts to chime', `I trace the ${c.motif} slowly`, 'like it could hold the time'],
  c => [`One more ${c.season} morning`, 'comes soft against the wall', `The ${c.motif} keeps its color`, 'through everything at all'],
  c => [`I open up the curtain`, `to a ${c.season} kind of gray`, `The ${c.motif} waits in silence`, 'for whatever I might say'],
  c => [`There is a ${c.season} quiet`, 'that only mornings know', `Beside the ${c.motif}, waiting`, 'I feel the hours grow slow'],
  c => [`The ${c.season} air is settling`, 'like dust on old good news', `I hold the ${c.motif} closer`, 'to keep away the blues'],
  c => [`A ${c.season} hush is falling`, 'on every empty chair', `The ${c.motif} still remembers`, 'a softer kind of air'],
  c => [`Under ${c.season} colors`, 'the whole street starts to wake', `I watch the ${c.motif} glowing`, 'for one more heart to take'],
  c => [`The ${c.season} calm arrives here`, 'before the noise gets loud', `The ${c.motif} sits unhurried`, 'above the passing crowd'],
  c => [`On this ${c.season} corner`, 'the world moves slow and kind', `The ${c.motif} keeps a rhythm`, 'that lingers in my mind'],
  c => [`A ${c.season} note is drifting`, 'from somewhere down the hall', `The ${c.motif} leans in closer`, 'to answer when I call'],
  c => [`I count the ${c.season} minutes`, 'the way an old friend would', `The ${c.motif} feels familiar`, 'in every neighborhood'],
  c => [`Beneath a ${c.season} ceiling`, 'of quiet gray and gold', `The ${c.motif} holds a story`, 'that never gets too old']
];

const enSituation: LineTemplate[] = [
  c => [`In this ${c.situation}`, 'I breathe and let it be', `The ${c.motif} keeps shining`, 'like a small old memory'],
  c => [`Inside this ${c.situation}`, 'I find a slower pace', `The ${c.motif} sits nearby me`, 'like a familiar face'],
  c => [`Right here in this ${c.situation}`, 'the noise begins to fade', `The ${c.motif} feels like proof of`, 'a promise gently made'],
  c => [`Caught up in this ${c.situation}`, 'I let my shoulders rest', `The ${c.motif} does not ask me`, 'to be my very best'],
  c => [`Somewhere in this ${c.situation}`, 'the hours lose their weight', `The ${c.motif} waits beside me`, 'and never makes me wait'],
  c => [`Held here by this ${c.situation}`, 'I feel a little brave', `The ${c.motif} keeps a secret`, 'that only quiet gave'],
  c => [`Still inside this ${c.situation}`, 'the world feels close and small', `The ${c.motif} learns my footsteps`, 'and answers when I call'],
  c => [`Through this ${c.situation}`, 'a softer voice comes home', `The ${c.motif} keeps the corners`, 'so I don’t feel alone'],
  c => [`Framed by this ${c.situation}`, 'my worries drift and thin', `The ${c.motif} holds the evening`, 'like it was always in'],
  c => [`Wrapped inside this ${c.situation}`, 'I hear my own name clear', `The ${c.motif} feels less distant`, 'the longer I stay here'],
  c => [`Set inside this ${c.situation}`, 'the day forgets to rush', `The ${c.motif} answers softly`, 'in nothing but a hush'],
  c => [`Steady in this ${c.situation}`, 'I let the moment stay', `The ${c.motif} keeps rewriting`, 'a gentler kind of day']
];

const enChorusFirst: LineTemplate[] = [
  c => [`${c.hook}, keep a little light for me`],
  c => [`Hold on, ${c.hook}`],
  c => [`Stay a while, ${c.hook}`],
  c => [`This is for you, ${c.hook}`],
  c => [`Carry me home, ${c.hook}`],
  c => [`One more time, ${c.hook}`],
  c => [`Right here, ${c.hook}`],
  c => [`Keep the light on, ${c.hook}`],
  c => [`Say it slow, ${c.hook}`],
  c => [`Close your eyes, ${c.hook}`]
];

const enChorusDev: LineTemplate[] = [
  c => ['softly through the day', 'every lonely shadow', `like ${c.motif}, slowly fades away`],
  c => ['gently one more time', 'every heavy morning', `like ${c.motif}, learns again to shine`],
  c => ['steady as it grows', 'every quiet worry', `like ${c.motif}, settles and lets go`],
  c => ['warm however far', 'every empty evening', `like ${c.motif}, finds a lower star`],
  c => ['close in every way', 'every tired heartbeat', `like ${c.motif}, finds a softer day`],
  c => ['brighter than before', 'every folded moment', `like ${c.motif}, opens like a door`],
  c => ['calm no matter what', 'every scattered feeling', `like ${c.motif}, settles where it stopped`],
  c => ['home no matter where', 'every quiet distance', `like ${c.motif}, turns to something near`],
  c => ['kind through every hour', 'every fading color', `like ${c.motif}, finds a little power`],
  c => ['soft and unafraid', 'every fragile silence', `like ${c.motif}, learns it is okay`]
];

const enBridge: LineTemplate[] = [
  c => ['Some dreams become silence', `Some tears turn to light, like ${c.motif}`],
  c => ['Some roads lead to nowhere', `Some lead straight back home, like ${c.motif}`],
  c => ['Some words never leave us', `Some just fade to hum, like ${c.motif}`],
  c => ['Some winters feel endless', `Some end overnight, like ${c.motif}`],
  c => ['Some faces stay distant', `Some stay in the room, like ${c.motif}`],
  c => ['Some songs keep their color', `Some quietly fade, like ${c.motif}`],
  c => ['Some mornings feel heavy', `Some feel free and light, like ${c.motif}`],
  c => ['Some letters stay folded', `Some finally get read, like ${c.motif}`]
];

const enVerse2: LineTemplate[] = [
  c => ['There were roads behind me', 'I could not understand', `Now they feel like ${c.motif}`, 'resting in my hand'],
  c => ['I remember distances', 'that used to feel too wide', `Now they feel like ${c.motif}`, 'quietly by my side'],
  c => ['I used to count the reasons', 'a slower day would fail', `Now they feel like ${c.motif}`, 'a soft familiar trail'],
  c => ['The years I spent unsettled', 'still linger now and then', `But they feel like ${c.motif}`, 'that finally makes sense'],
  c => ['I carried doubts for seasons', 'not knowing where they’d land', `Now they feel like ${c.motif}`, 'I finally understand'],
  c => ['The nights I spent unanswered', 'come back a little clearer', `Now they feel like ${c.motif}`, 'that only brought me nearer'],
  c => ['I kept a list of maybes', 'too tired to say them out', `Now they feel like ${c.motif}`, 'without a trace of doubt'],
  c => ['I used to rush the mornings', 'afraid to miss the light', `Now they feel like ${c.motif}`, 'that stays no matter the night'],
  c => ['I thought the quiet meant losing', 'a version of the plan', `Now it feels like ${c.motif}`, 'I finally understand'],
  c => ['Every simple morning', 'every cup of rain', `Turns the page so gently`, 'and calls me home again'],
  c => ['I kept the small regrets', 'folded soft and low', `Now they feel like ${c.motif}`, 'ready to let go'],
  c => ['The years moved like a river', 'too fast to hold at all', `Now they feel like ${c.motif}`, 'answering my call']
];

const enClosing: LineTemplate[] = [
  c => [`and here I finally rest, beside the ${c.motif}`],
  c => [`and everything feels right, like ${c.motif}`],
  c => [`and morning finds me home, near the ${c.motif}`],
  c => [`and quiet feels like grace, and the ${c.motif} stays`],
  c => [`and I am not alone, with the ${c.motif} near`],
  c => [`and the light stays a while, on the ${c.motif}`],
  c => [`and the season lets me breathe, beside the ${c.motif}`],
  c => [`and tomorrow feels kind, like the ${c.motif}`]
];

// ---------------------------------------------------------------------------
// Korean pools
// ---------------------------------------------------------------------------

const koOpening: LineTemplate[] = [
  c => [`${c.season} 빛이 문가에 내려`, '오래된 잔 위에 머물고', '작은 라디오 소리 하나', '아침을 천천히 깨워요'],
  c => [`${c.season} 바람이 지나가며`, '하루의 페이지를 넘기고', `${c.motif} 하나가 곁에서`, '아무 말 없이 머물러요'],
  c => [`${c.season} 거리 저편에서`, '작은 종소리가 울리고', `${c.motif}를 가만히 만지면`, '시간이 잠시 멈춰요'],
  c => [`또 하루의 ${c.season} 아침이`, '벽 위로 부드럽게 내려와', `${c.motif}는 그 색을 지키며`, '모든 걸 다 품어줘요'],
  c => [`커튼을 살짝 걷으면`, `${c.season}의 흐린 하늘이 보여요`, `${c.motif}는 조용히 기다리며`, '내 말을 듣고 있어요'],
  c => [`아침만 아는 ${c.season}의 고요가`, '가만히 내려앉고', `${c.motif} 곁에 서서 기다리면`, '시간이 천천히 자라요'],
  c => [`${c.season} 공기가 내려앉아`, '지난 소식처럼 쌓이고', `${c.motif}를 더 꼭 안으면`, '우울함이 멀어져요'],
  c => [`${c.season}의 침묵이 내려와`, '빈 의자마다 앉고', `${c.motif}는 여전히 기억해요`, '더 부드러운 공기를'],
  c => [`${c.season} 색깔 아래에서`, '거리 전체가 깨어나고', `빛나는 ${c.motif}를 바라보면`, '마음 하나가 더 다가와요'],
  c => [`${c.season}의 평온이 찾아와요`, '소음이 커지기 전에', `${c.motif}는 서두르지 않고`, '차분히 자리를 지켜요'],
  c => [`이 ${c.season} 모퉁이에서`, '세상은 천천히 다정하게 움직이고', `${c.motif}는 리듬을 지키며`, '마음속에 오래 남아요'],
  c => [`${c.season}의 음이 흘러와요`, '복도 저편 어디선가', `${c.motif}가 조금 더 가까이`, '내가 부를 때 대답해요']
];

const koSituation: LineTemplate[] = [
  c => [`${c.situation} 속에서`, '나는 숨을 고르고', `${c.motif} 같은 기억 하나`, '조용히 다시 빛나요'],
  c => [`${c.situation} 안에서`, '조금 더 천천히 걸어요', `${c.motif}는 곁에 있어요`, '익숙한 얼굴처럼요'],
  c => [`바로 이 ${c.situation}에서`, '소음이 서서히 사라지고', `${c.motif}는 증명처럼 느껴져요`, '다정하게 지켜진 약속처럼'],
  c => [`${c.situation}에 머물러`, '어깨의 힘을 풀어봐요', `${c.motif}는 나에게`, '최선을 요구하지 않아요'],
  c => [`${c.situation} 어딘가에서`, '시간의 무게가 가벼워지고', `${c.motif}는 내 곁에서`, '기다림도 잊게 해요'],
  c => [`${c.situation}이 나를 감싸고`, '조금은 용감해져요', `${c.motif}는 비밀 하나를 품고`, '고요함만이 아는 이야기를'],
  c => [`여전히 이 ${c.situation} 안에서`, '세상이 작고 가깝게 느껴져요', `${c.motif}는 내 발걸음을 배우고`, '부를 때마다 대답해요'],
  c => [`${c.situation}을 지나며`, '부드러운 목소리가 돌아와요', `${c.motif}는 구석마다 지켜줘요`, '혼자가 아니게'],
  c => [`${c.situation}에 둘러싸여`, '걱정이 옅어지고 작아져요', `${c.motif}는 저녁을 품고 있어요`, '늘 그래왔던 것처럼'],
  c => [`${c.situation} 속에 감싸여`, '내 이름을 또렷이 들어요', `${c.motif}는 조금 덜 멀게 느껴져요`, '여기 오래 머물수록'],
  c => [`${c.situation} 안에 자리 잡아`, '하루가 서두르지 않아요', `${c.motif}는 부드럽게 대답해요`, '고요함 하나로'],
  c => [`${c.situation} 안에서 차분히`, '이 순간을 붙잡아둬요', `${c.motif}는 다시 써 내려가요`, '조금 더 다정한 하루로']
];

const koChorusFirst: LineTemplate[] = [
  c => [`${c.hook}, 다시 마음이 따뜻해져요`],
  c => [`잠시 멈춰요, ${c.hook}`],
  c => [`여기 있어요, ${c.hook}`],
  c => [`이건 당신을 위한 노래, ${c.hook}`],
  c => [`나를 데려가요, ${c.hook}`],
  c => [`한 번 더, ${c.hook}`],
  c => [`바로 여기, ${c.hook}`],
  c => [`불을 켜둬요, ${c.hook}`],
  c => [`천천히 말해요, ${c.hook}`],
  c => [`눈을 감아요, ${c.hook}`]
];

const koChorusDev: LineTemplate[] = [
  c => ['오늘도 천천히 걸어요', '외로운 그림자도', `${c.motif}처럼, 조금씩 옅어져요`],
  c => ['다시 한번 부드럽게', '무거운 아침도', `${c.motif}처럼, 다시 빛을 배워요`],
  c => ['자라날수록 차분하게', '작은 걱정들도', `${c.motif}처럼, 조용히 흘러가요`],
  c => ['멀리 있어도 따뜻하게', '텅 빈 저녁도', `${c.motif}처럼, 낮은 별을 찾아요`],
  c => ['어느 쪽이든 가깝게', '지친 마음도', `${c.motif}처럼, 더 부드러운 하루를 찾아요`],
  c => ['전보다 더 밝게', '접혀 있던 순간도', `${c.motif}처럼, 문처럼 열려요`],
  c => ['어떤 상황이든 차분히', '흩어진 감정도', `${c.motif}처럼, 멈췄던 자리로 돌아와요`],
  c => ['어디에 있든 집처럼', '조용한 거리도', `${c.motif}처럼, 가까움으로 바뀌어요`],
  c => ['매 시간 다정하게', '바래가는 색도', `${c.motif}처럼, 작은 힘을 찾아요`],
  c => ['부드럽고 두렵지 않게', '연약한 고요도', `${c.motif}처럼, 괜찮다는 걸 배워요`]
];

const koBridge: LineTemplate[] = [
  c => ['어떤 꿈은 조용해지고', `어떤 눈물은 빛이 되죠, ${c.motif}처럼`],
  c => ['어떤 길은 끝이 없고', `어떤 길은 집으로 이어져요, ${c.motif}처럼`],
  c => ['어떤 말은 남지 않고', `어떤 말은 낮은 노래가 돼요, ${c.motif}처럼`],
  c => ['어떤 겨울은 끝나지 않을 것 같고', `어떤 겨울은 하루밤에 끝나요, ${c.motif}처럼`],
  c => ['어떤 얼굴은 멀어지고', `어떤 얼굴은 방 안에 머물러요, ${c.motif}처럼`],
  c => ['어떤 노래는 색을 지키고', `어떤 노래는 조용히 바래요, ${c.motif}처럼`],
  c => ['어떤 아침은 무겁고', `어떤 아침은 가볍고 자유로워요, ${c.motif}처럼`],
  c => ['어떤 편지는 접힌 채로 남고', `어떤 편지는 결국 읽혀요, ${c.motif}처럼`]
];

const koVerse2: LineTemplate[] = [
  c => ['지나온 길들은 모두', '이제는 음악이 되고', `말하지 못한 마음까지`, '창가에 내려앉아요'],
  c => ['너무 멀게 느껴졌던 거리도', '이제는 다르게 보여요', `그것들은 ${c.motif}처럼`, '조용히 내 곁에 있어요'],
  c => ['느린 하루를 탓하던 이유도', '이제는 세어보지 않아요', `그것들은 ${c.motif}처럼`, '익숙한 길이 되었어요'],
  c => ['정착하지 못했던 시간도', '가끔 다시 떠오르지만', `${c.motif}처럼 느껴져요`, '이제야 이해가 돼요'],
  c => ['계절마다 품었던 의심도', '어디로 향할지 몰랐지만', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  c => ['대답받지 못한 밤들도', '조금 더 선명하게 돌아와요', `그것들은 ${c.motif}처럼`, '나를 더 가까이 데려왔어요'],
  c => ['말하지 못한 것들의 목록도', '너무 지쳐 꺼내지 못했지만', `이제는 ${c.motif}처럼`, '의심 없이 남아요'],
  c => ['빛을 놓칠까 서두르던 아침도', '이제는 천천히 흘러가요', `${c.motif}처럼 느껴져요`, '어떤 밤에도 머무는'],
  c => ['고요함이 잃음이라 생각했던 계획도', '이제는 다르게 보여요', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  c => ['매일의 작은 커피와', '비에 젖은 거리도', '다시 돌아갈 곳처럼', '따뜻하게 불러요'],
  c => ['작은 후회들도', '조용히 접어두었지만', `이제는 ${c.motif}처럼`, '놓아줄 준비가 됐어요'],
  c => ['강물처럼 흘러간 시간도', '너무 빨라 붙잡지 못했지만', `이제는 ${c.motif}처럼`, '내 부름에 대답해요']
];

const koClosing: LineTemplate[] = [
  c => [`이제야 편히 쉬어요, ${c.motif}와 함께`],
  c => [`모든 게 다 괜찮게 느껴져요, ${c.motif}처럼`],
  c => [`아침이 나를 집으로 데려가요, ${c.motif} 곁에서`],
  c => [`고요함이 은혜처럼 느껴져요, ${c.motif}와 함께`],
  c => [`나는 더 이상 혼자가 아니에요, ${c.motif}가 있어서`],
  c => [`그 빛이 조금 더 머물러요, ${c.motif} 위에`],
  c => [`이 계절이 숨 쉴 틈을 줘요, ${c.motif} 곁에서`],
  c => [`내일이 다정하게 느껴져요, ${c.motif}처럼`]
];

// ---------------------------------------------------------------------------
// Japanese pools
// ---------------------------------------------------------------------------

const jaOpening: LineTemplate[] = [
  c => [`${c.season}の光がそっと`, '古いカップに落ちて', '小さなラジオの音が', '朝をゆっくり起こす'],
  c => [`${c.season}の風が過ぎて`, '一日のページをめくる', `${c.motif}がそばにいて`, '何も言わずにとどまる'],
  c => [`${c.season}の街の向こうで`, '小さな鐘が鳴り', `${c.motif}にそっと触れると`, '時間が少し止まる'],
  c => [`また巡る${c.season}の朝が`, '壁にやわらかく落ちて', `${c.motif}はその色を守り`, 'すべてを包み込む'],
  c => [`カーテンをそっと開けると`, `${c.season}の曇り空が見える`, `${c.motif}は静かに待ちながら`, '私の声を聞いている'],
  c => [`朝だけが知る${c.season}の静けさが`, 'そっと降りてきて', `${c.motif}のそばで待てば`, '時間がゆっくり育つ'],
  c => [`${c.season}の空気が降り積もり`, '古い便りのように重なる', `${c.motif}をもっと抱きしめれば`, '憂鬱が遠ざかる'],
  c => [`${c.season}の沈黙が降りて`, '空いた椅子に座る', `${c.motif}はまだ覚えている`, 'やわらかな空気を'],
  c => [`${c.season}色の下で`, '街全体が目を覚まし', `輝く${c.motif}を見つめれば`, '心がもう少し近づく'],
  c => [`${c.season}の静けさが訪れる`, '騒がしさが増える前に', `${c.motif}は急がず`, '静かにそこにいる'],
  c => [`この${c.season}の角で`, '世界はゆっくりやさしく動き', `${c.motif}はリズムを守り`, '心の中に長く残る'],
  c => [`${c.season}の音が流れてくる`, '廊下の向こうのどこかから', `${c.motif}がもう少し近くで`, '呼べば応えてくれる']
];

const jaSituation: LineTemplate[] = [
  c => [`${c.situation}の中で`, '息をひとつ整え', `${c.motif}みたいな記憶が`, '静かにまた灯る'],
  c => [`${c.situation}の中で`, 'もう少しゆっくり歩く', `${c.motif}はそばにいる`, 'なじみのある顔のように'],
  c => [`まさにこの${c.situation}で`, '騒がしさが少しずつ消えて', `${c.motif}は証のように感じる`, 'やさしく守られた約束のように'],
  c => [`${c.situation}にとどまり`, '肩の力をそっと抜く', `${c.motif}は私に`, '何も求めない'],
  c => [`${c.situation}のどこかで`, '時間の重さが軽くなり', `${c.motif}は私のそばで`, '待つことさえ忘れさせる'],
  c => [`${c.situation}に包まれて`, '少しだけ勇気が出る', `${c.motif}は秘密をひとつ抱え`, '静けさだけが知る物語を'],
  c => [`まだこの${c.situation}の中で`, '世界が小さく近く感じる', `${c.motif}は私の足音を覚え`, '呼べば応えてくれる'],
  c => [`${c.situation}を通り過ぎて`, 'やわらかな声が帰ってくる', `${c.motif}は隅々を守ってくれる`, 'ひとりじゃないように'],
  c => [`${c.situation}に囲まれて`, '心配が薄く小さくなる', `${c.motif}は夕暮れを抱えている`, 'いつもそうだったように'],
  c => [`${c.situation}の中に包まれて`, '自分の名前をはっきり聞く', `${c.motif}は少し遠くなくなる`, 'ここに長くいるほど'],
  c => [`${c.situation}の中に落ち着いて`, '一日が急がなくなる', `${c.motif}はやさしく応える`, '静けさひとつで'],
  c => [`${c.situation}の中で静かに`, 'この瞬間をつかまえておく', `${c.motif}はまた書き直す`, 'もう少しやさしい一日を']
];

const jaChorusFirst: LineTemplate[] = [
  c => [`${c.hook}、また心があたたまる`],
  c => [`少し止まって、${c.hook}`],
  c => [`ここにいて、${c.hook}`],
  c => [`これはあなたへの歌、${c.hook}`],
  c => [`連れて帰って、${c.hook}`],
  c => [`もう一度、${c.hook}`],
  c => [`ここで、${c.hook}`],
  c => [`灯りをつけたまま、${c.hook}`],
  c => [`ゆっくり話して、${c.hook}`],
  c => [`目を閉じて、${c.hook}`]
];

const jaChorusDev: LineTemplate[] = [
  c => ['今日もゆっくり歩こう', 'さみしい影さえ', `${c.motif}のように、少しずつほどけてく`],
  c => ['もう一度やわらかく', '重い朝さえ', `${c.motif}のように、また輝きを覚える`],
  c => ['育つほど落ち着いて', '小さな心配さえ', `${c.motif}のように、静かに流れてゆく`],
  c => ['遠くてもあたたかく', '空っぽの夜さえ', `${c.motif}のように、低い星を見つける`],
  c => ['どちらにいても近くに', '疲れた心さえ', `${c.motif}のように、やさしい一日を見つける`],
  c => ['前よりも明るく', '折りたたまれた瞬間さえ', `${c.motif}のように、扉のように開く`],
  c => ['どんな時も落ち着いて', '散らばった気持ちさえ', `${c.motif}のように、止まった場所へ戻る`],
  c => ['どこにいても家のように', '静かな通りさえ', `${c.motif}のように、近さに変わる`],
  c => ['毎時間やさしく', '色あせてゆくものさえ', `${c.motif}のように、小さな力を見つける`],
  c => ['やわらかく恐れずに', 'もろい静けささえ', `${c.motif}のように、大丈夫だと知る`]
];

const jaBridge: LineTemplate[] = [
  c => ['夢は静けさになり', `涙は光になる、${c.motif}のように`],
  c => ['ある道は終わりがなく', `ある道は家へと続く、${c.motif}のように`],
  c => ['ある言葉は残らず', `ある言葉は低い歌になる、${c.motif}のように`],
  c => ['ある冬は終わらないようで', `ある冬は一晩で終わる、${c.motif}のように`],
  c => ['ある顔は遠ざかり', `ある顔は部屋にとどまる、${c.motif}のように`],
  c => ['ある歌は色を守り', `ある歌は静かに色あせる、${c.motif}のように`],
  c => ['ある朝は重く', `ある朝は軽く自由になる、${c.motif}のように`],
  c => ['ある手紙は畳まれたままで', `ある手紙はいつか読まれる、${c.motif}のように`]
];

const jaVerse2: LineTemplate[] = [
  c => ['通り過ぎた道も', '今は音楽になり', '言えなかった気持ちまで', '窓辺にそっと座る'],
  c => ['遠すぎると思った距離も', '今は違って見える', `それは${c.motif}のように`, '静かにそばにある'],
  c => ['遅い一日を責めた理由も', '今は数えない', `それは${c.motif}のように`, '見慣れた道になった'],
  c => ['落ち着けなかった時間も', 'たまにまた浮かぶけれど', `${c.motif}のように感じる`, '今ようやくわかる'],
  c => ['季節ごとに抱いた迷いも', 'どこへ向かうか分からなかったが', `今は${c.motif}のように`, 'ようやくわかる'],
  c => ['答えのなかった夜も', '少し鮮明に戻ってくる', `それは${c.motif}のように`, '私をより近づけた'],
  c => ['言えなかったことの一覧も', '疲れて出せなかったが', `今は${c.motif}のように`, '迷いなく残る'],
  c => ['光を逃すまいと急いだ朝も', '今はゆっくり流れる', `${c.motif}のように感じる`, 'どんな夜にもとどまる'],
  c => ['静けさを失うことだと思った計画も', '今は違って見える', `今は${c.motif}のように`, 'ようやくわかる'],
  c => ['毎日の小さなコーヒーと', '雨に濡れた街が', '帰る場所のように', 'やさしく呼んでいる'],
  c => ['小さな後悔も', '静かに畳んでいたけれど', `今は${c.motif}のように`, '手放す準備ができた'],
  c => ['川のように流れた時間も', '速すぎてつかめなかったが', `今は${c.motif}のように`, '私の呼びかけに応える']
];

const jaClosing: LineTemplate[] = [
  c => [`ようやく心が休まる、${c.motif}と共に`],
  c => [`すべてが大丈夫に思える、${c.motif}のように`],
  c => [`朝が私を家へ連れてゆく、${c.motif}のそばで`],
  c => [`静けさが恵みのように感じる、${c.motif}と共に`],
  c => [`もうひとりじゃない、${c.motif}がいるから`],
  c => [`その光がもう少しとどまる、${c.motif}の上に`],
  c => [`この季節が息をつかせてくれる、${c.motif}のそばで`],
  c => [`明日がやさしく思える、${c.motif}のように`]
];

interface LanguagePools {
  opening: LineTemplate[];
  situation: LineTemplate[];
  chorusFirst: LineTemplate[];
  chorusDev: LineTemplate[];
  bridge: LineTemplate[];
  verse2: LineTemplate[];
  closing: LineTemplate[];
}

const enPools: LanguagePools = { opening: enOpening, situation: enSituation, chorusFirst: enChorusFirst, chorusDev: enChorusDev, bridge: enBridge, verse2: enVerse2, closing: enClosing };
const koPools: LanguagePools = { opening: koOpening, situation: koSituation, chorusFirst: koChorusFirst, chorusDev: koChorusDev, bridge: koBridge, verse2: koVerse2, closing: koClosing };
const jaPools: LanguagePools = { opening: jaOpening, situation: jaSituation, chorusFirst: jaChorusFirst, chorusDev: jaChorusDev, bridge: jaBridge, verse2: jaVerse2, closing: jaClosing };

function poolsFor(language: LyricLanguage): LanguagePools {
  if (language === 'korean') return koPools;
  if (language === 'japanese') return jaPools;
  return enPools;
}

const introLine: Record<LyricLanguage, string> = {
  english: 'Soft Rhodes, acoustic guitar, close warm vocal.',
  korean: '따뜻한 로즈 피아노, 어쿠스틱 기타, 가까운 목소리.',
  japanese: 'やわらかなローズピアノ、アコースティックギター、近い歌声。',
  bilingual: 'Soft Rhodes, acoustic guitar, close warm vocal.'
};

const tags: Record<LyricLanguage, { intro: string; verse1: string; chorus: string; verse2: string; bridge: string; finalChorus: string; end: string }> = {
  english: { intro: '[short intro]', verse1: '[verse 1]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' },
  korean: { intro: '[short intro]', verse1: '[verse 1]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' },
  japanese: { intro: '[short intro]', verse1: '[verse 1]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' },
  bilingual: { intro: '[short intro]', verse1: '[verse 1]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' }
};

/** Pools that must not repeat a picked line within a single blueprint. */
export interface LyricBatchPools {
  opening: UniquePool<LineTemplate>;
  situation: UniquePool<LineTemplate>;
  chorusFirst: UniquePool<LineTemplate>;
  chorusDev: UniquePool<LineTemplate>;
  bridge: UniquePool<LineTemplate>;
  verse2: UniquePool<LineTemplate>;
  closing: UniquePool<LineTemplate>;
  /**
   * chorusFirst lines are now built from a short hook (a single object word,
   * ~14 possible values) rather than the globally-unique title, so an
   * independent template draw can coincidentally reproduce an exact line
   * used by an earlier song in the same pack. Tracked here so composeLyrics
   * can retry until it finds an unused line.
   */
  usedChorusFirstLines: Set<string>;
}

export function createLyricBatchPools(language: LyricLanguage, seedBase: string): LyricBatchPools {
  const pools = poolsFor(language);
  const s = hashSeed(seedBase);
  return {
    opening: new UniquePool(pools.opening, s + 1),
    situation: new UniquePool(pools.situation, s + 2),
    chorusFirst: new UniquePool(pools.chorusFirst, s + 3),
    chorusDev: new UniquePool(pools.chorusDev, s + 4),
    bridge: new UniquePool(pools.bridge, s + 5),
    verse2: new UniquePool(pools.verse2, s + 6),
    closing: new UniquePool(pools.closing, s + 7),
    usedChorusFirstLines: new Set<string>()
  };
}

function extendedBridgeRoles(role: string) {
  return role === 'late-set emotional center' || role === 'romantic shade without melodrama';
}

function extendedFinalChorusRoles(role: string) {
  return role === 'comforting closer' || role === 'soft reset before the closing run';
}

export interface LyricComposeInput {
  language: LyricLanguage;
  season: SeasonPack;
  title: string;
  hook: string;
  situation: string;
  motif: string;
  role: string;
  pools: LyricBatchPools;
}

export interface ComposedLyrics {
  lyrics: string;
  hookPhrase: string;
}

export function composeLyrics(input: LyricComposeInput): ComposedLyrics {
  const { language, season, title, hook, situation, motif, role, pools } = input;
  const t = tags[language];
  const ctx: LyricLineCtx = { season: season.keywords[0] ?? season.label, situation, motif, title, hook };

  const opening = pools.opening.take()(ctx);
  const situationLines = pools.situation.take()(ctx);
  let chorusFirst = pools.chorusFirst.take()(ctx);
  for (let attempt = 0; pools.usedChorusFirstLines.has(chorusFirst[0]) && attempt < 12; attempt++) {
    chorusFirst = pools.chorusFirst.take()(ctx);
  }
  pools.usedChorusFirstLines.add(chorusFirst[0]);
  const chorusDev = pools.chorusDev.take()(ctx);
  const chorusLines = [...chorusFirst, ...chorusDev];
  const verse2 = pools.verse2.take()(ctx);

  const bridgeLines = extendedBridgeRoles(role)
    ? [...pools.bridge.take()(ctx), ...pools.bridge.take()(ctx)]
    : pools.bridge.take()(ctx);

  const finalChorusLines = extendedFinalChorusRoles(role)
    ? [...chorusLines, ...pools.closing.take()(ctx)]
    : chorusLines;

  const lyrics = [
    `Title: ${title}`,
    '',
    t.intro,
    introLine[language],
    '',
    t.verse1,
    ...opening,
    '',
    ...situationLines,
    '',
    t.chorus,
    ...chorusLines,
    '',
    t.verse2,
    ...verse2,
    '',
    t.bridge,
    ...bridgeLines,
    '',
    t.finalChorus,
    ...finalChorusLines,
    '',
    t.end
  ].join('\n');

  return { lyrics, hookPhrase: chorusFirst[0] };
}

// ---------------------------------------------------------------------------
// Title generation
// ---------------------------------------------------------------------------

const enTimeWords = ['November', 'Winter Morning', 'Christmas Eve', 'Quiet Snow', 'First Light', 'Old Morning Hush', 'Late Autumn', 'Slow Sunday', 'Midnight Hour', 'Golden Evening', 'Early Spring', 'Rainy Afternoon', 'New Year Dawn', 'Soft December'];
const enObjectWords = ['Window', 'Letter', 'Coffee Cup', 'Radio', 'Street', 'Sweater', 'Candle', 'Photograph', 'Train', 'Doorway', 'Record', 'Umbrella', 'Lamp', 'Calendar'];
const enEmotionWords = ['Memory', 'Warmth', 'Goodbye Song', 'Quiet Hour', 'Small Miracle', 'Gentle Return', 'Soft Promise', 'Old Friend', 'Second Chance', 'Home Again'];

const koTimeWords = ['11월', '겨울 아침', '크리스마스 이브', '고요한 눈', '첫 빛', '오래된 아침의 정적', '늦가을', '느린 일요일', '한밤중', '금빛 저녁', '이른 봄', '비 오는 오후', '새해 새벽', '부드러운 12월'];
const koObjectWords = ['창가', '편지', '커피잔', '라디오', '거리', '스웨터', '촛불', '사진', '기차', '문가', '레코드', '우산', '램프', '달력'];
const koEmotionWords = ['기억', '온기', '작별 노래', '조용한 시간', '작은 기적', '다정한 귀환', '부드러운 약속', '오랜 친구', '두 번째 기회', '다시 집으로'];

const jaTimeWords = ['十一月', '冬の朝', 'クリスマスイブ', '静かな雪', '最初の光', '古い朝の静寂', '晩秋', 'ゆっくりな日曜日', '真夜中', '金色の夕暮れ', '早春', '雨の午後', '新年の夜明け', 'やわらかな十二月'];
const jaObjectWords = ['窓辺', '手紙', 'コーヒーカップ', 'ラジオ', '通り', 'セーター', 'キャンドル', '写真', '列車', '戸口', 'レコード', '傘', 'ランプ', 'カレンダー'];
const jaEmotionWords = ['記憶', 'あたたかさ', '別れの歌', '静かな時間', '小さな奇跡', 'やさしい帰還', 'やわらかな約束', '古い友人', '二度目の機会', 'もう一度家へ'];

function dedupeObjectWords(base: string[], extra: string[]): string[] {
  const seen = new Set(base.map(word => word.toLowerCase()));
  const merged = [...base];
  for (const word of extra) {
    const key = word.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(word);
    }
  }
  return merged;
}

function bankFor(language: LyricLanguage) {
  if (language === 'korean') return { time: koTimeWords, object: koObjectWords, emotion: koEmotionWords };
  if (language === 'japanese') return { time: jaTimeWords, object: jaObjectWords, emotion: jaEmotionWords };
  const titleCasedUniversal = lyricImageBank.universal.map(word => word.replace(/\b\w/g, c => c.toUpperCase()));
  return { time: enTimeWords, object: dedupeObjectWords(enObjectWords, titleCasedUniversal), emotion: enEmotionWords };
}

function joinTitle(language: LyricLanguage, time: string, object: string, emotion: string | null) {
  if (language === 'korean') return emotion ? `${time}의 ${object}, ${emotion}` : `${time}의 ${object}`;
  if (language === 'japanese') return emotion ? `${time}の${object}、${emotion}` : `${time}の${object}`;
  return emotion ? `${time} ${object}, ${emotion}` : `${time} ${object}`;
}

function hookFromObject(language: LyricLanguage, object: string) {
  return language === 'english' ? object.toLowerCase() : object;
}

function hasWordOverlap(language: LyricLanguage, ...parts: (string | null)[]): boolean {
  const filtered = parts.filter((part): part is string => Boolean(part));
  if (language === 'japanese') {
    // Japanese has no whitespace word boundaries, so compare by substring containment instead.
    for (let i = 0; i < filtered.length; i++) {
      for (let j = 0; j < filtered.length; j++) {
        if (i !== j && filtered[i].length >= 2 && filtered[j].includes(filtered[i])) return true;
      }
    }
    return false;
  }
  const words = filtered.flatMap(part => part.toLowerCase().split(/\s+/).filter(Boolean));
  return new Set(words).size !== words.length;
}

export interface TitleResult {
  title: string;
  hook: string;
}

export function createTitleGenerator(language: LyricLanguage, seedBase: string) {
  const bank = bankFor(language);
  const s = hashSeed(seedBase);
  const timePool = new UniquePool(bank.time, s + 11);
  const objectPool = new UniquePool(bank.object, s + 12);
  const emotionPool = new UniquePool(bank.emotion, s + 13);
  const rng = mulberry32(s + 14);
  const used = new Set<string>();

  return function nextTitle(): TitleResult {
    for (let attempt = 0; attempt < 20; attempt++) {
      const time = timePool.take();
      const object = objectPool.take();
      const wantsEmotion = rng() < 0.35;
      const emotion = wantsEmotion ? emotionPool.take() : null;
      if (hasWordOverlap(language, time, object, emotion)) continue;
      const title = joinTitle(language, time, object, emotion);
      if (!used.has(title)) {
        used.add(title);
        return { title, hook: hookFromObject(language, object) };
      }
    }
    // Every retry produced either a word clash or an already-used title; drop the
    // emotion suffix (the most likely source of overlap) and force a unique title.
    const time = timePool.take();
    const object = objectPool.take();
    const title = `${joinTitle(language, time, object, null)} #${used.size + 1}`;
    used.add(title);
    return { title, hook: hookFromObject(language, object) };
  };
}

// ---------------------------------------------------------------------------
// Diversity check
// ---------------------------------------------------------------------------

function normalizedLines(text: string): Set<string> {
  return new Set(
    text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('[') && !line.startsWith('Title:'))
      .map(line => line.toLowerCase())
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const line of a) if (b.has(line)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DiversityWarning {
  trackA: number;
  trackB: number;
  similarity: number;
}

function pairwiseSimilarities(songs: Pick<SongIdea, 'trackNo' | 'lyrics'>[]) {
  const lineSets = songs.map(song => normalizedLines(song.lyrics));
  const pairs: { trackA: number; trackB: number; similarity: number }[] = [];
  for (let i = 0; i < songs.length; i++) {
    for (let j = i + 1; j < songs.length; j++) {
      pairs.push({ trackA: songs[i].trackNo, trackB: songs[j].trackNo, similarity: jaccard(lineSets[i], lineSets[j]) });
    }
  }
  return pairs;
}

export function assertLyricDiversity(songs: Pick<SongIdea, 'trackNo' | 'lyrics'>[], threshold = 0.4): DiversityWarning[] {
  return pairwiseSimilarities(songs).filter(pair => pair.similarity > threshold);
}

/** 0-100: 100 means every pair of songs shares no lyric lines at all. */
export function computeDiversityScore(songs: Pick<SongIdea, 'trackNo' | 'lyrics'>[]): number {
  const pairs = pairwiseSimilarities(songs);
  if (!pairs.length) return 100;
  const avgSimilarity = pairs.reduce((sum, pair) => sum + pair.similarity, 0) / pairs.length;
  return Math.round(Math.max(0, Math.min(1, 1 - avgSimilarity)) * 100);
}

export function seedForBlueprint(opts: Pick<GenerationOptions, 'channel' | 'projectTitle'>) {
  return `${opts.channel.id}:${opts.projectTitle}`;
}
