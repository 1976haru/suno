import type { ChannelArchetype, GenerationOptions, LyricLanguage, SeasonPack, SongIdea } from '../types';
import { resolveHookParts, type HookPartBank } from '../data/hookParts';
import { overrideForArchetype } from '../data/hookBanks';
import { stripSetTitlePrefix } from '../utils/generation';
import { hashSeed, mulberry32, shuffle } from '../utils/prng';
import { resolveConstraints, type ResolvedConstraints } from './constraints';
import { TITLE_PATTERNS, uniqueTitle } from '../data/titlePatterns';
import { KIDS_AUDIENCE_PROFILE, SENIOR_AUDIENCE_PROFILE } from '../data/audienceProfiles';
import { isKidsArchetype } from '../utils/channelArchetype';

// v4.2 (TASK A3) — re-exported so every existing `from './lyricEngine'`
// import of these three stays valid; see utils/prng.ts's own doc comment for
// why the definitions moved there.
export { hashSeed, shuffle };

export interface LyricLineCtx {
  season: string;
  situation: string;
  motif: string;
  title: string;
  /** A short (1-2 word) hook derived from the title's object word, safe to sing as a repeated chorus line. */
  hook: string;
}

type LineTemplate = (ctx: LyricLineCtx) => string[];

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
// Motif grammar helpers — motifs are bare nouns ("evening train", "old radio
// light"), so templates must never splice ${motif} directly into a slot that
// needs an article. Comparison slots ("like X") route through likeMotif();
// templates that already hardcode "the"/"a" in the surrounding text (e.g.
// "I trace the ${motif} slowly") are left alone since they're already correct.
// ---------------------------------------------------------------------------

function startsWithVowelSound(word: string): boolean {
  return /^[aeiou]/i.test(word.trim());
}

/**
 * TASK v3.59 (TASK A-3) — aMotif() only ever checked the leading sound for
 * "a" vs "an", never whether the motif needs an indefinite article at all.
 * A plural motif ("worn guitar strings" — genreLibrary.ts's own lyric-image
 * data, bare-noun by convention) or an uncountable one ("rain", "silence")
 * produced real, visible grammar errors in generated lyrics ("like a worn
 * guitar strings", "like a rain"). Per this task's own "판정이 애매하면
 * 관사를 붙이지 않는다" — when the plural check itself is ambiguous, this
 * only ever suppresses the article (never guesses a wrong one); a bare
 * motif with no article reads awkward at worst, never ungrammatical.
 */
const UNCOUNTABLE_MOTIF_NOUNS = new Set([
  'rain', 'light', 'dust', 'air', 'steam', 'silence', 'music', 'warmth', 'weather',
  'snow', 'frost', 'static', 'distance', 'time', 'coffee', 'traffic', 'laughter',
  'sunshine', 'moonlight', 'daylight', 'twilight', 'thunder', 'lightning', 'fog',
  'smoke', 'ash', 'sand', 'wind', 'ice', 'gravity', 'space', 'darkness', 'stillness'
]);

function lastWord(phrase: string): string {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] || '';
}

/** Plural-shaped (ends in -s, excluding -ss/-us/-is words like "glass"/"focus"/"crisis" which are singular). */
function looksPlural(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return false;
  if (/(ss|us|is)$/.test(clean)) return false;
  return /s$/.test(clean);
}

function needsNoArticle(motif: string): boolean {
  const head = lastWord(motif).toLowerCase().replace(/[^a-z]/g, '');
  return UNCOUNTABLE_MOTIF_NOUNS.has(head) || looksPlural(lastWord(motif));
}

function aMotif(motif: string): string {
  if (needsNoArticle(motif)) return motif;
  return `${startsWithVowelSound(motif) ? 'an' : 'a'} ${motif}`;
}

function likeMotif(motif: string): string {
  return `like ${aMotif(motif)}`;
}

/**
 * Korean topic/subject/object/with particles change form depending on whether
 * the preceding syllable ends in a consonant (받침). Motif nouns vary per
 * song, so templates must pick the particle at render time instead of
 * hardcoding one form.
 */
function hasKoreanBatchim(word: string): boolean {
  const lastChar = word.trim().slice(-1);
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function koParticle(word: string, withBatchim: string, withoutBatchim: string): string {
  return hasKoreanBatchim(word) ? withBatchim : withoutBatchim;
}

// ---------------------------------------------------------------------------
// English pools
// ---------------------------------------------------------------------------

// 도입부 고유성 재조사 — koOpening's own doc comment above explains the root
// cause and fix pattern; same here. A 4-phrase connector rotation prepends
// ${c.motif} to each template's first line so it no longer depends on
// ${c.season} alone.
const enOpening: LineTemplate[] = [
  c => [`With the ${c.motif} close, the ${c.season} light is resting`, 'on the table by the door', 'I hear a quiet radio', 'like I have heard before'],
  c => [`Beside the ${c.motif}, a ${c.season} wind is turning`, 'the pages of the day', `The ${c.motif} sits beside me`, 'with nothing left to say'],
  c => [`Holding the ${c.motif}, somewhere past the ${c.season} street`, 'a small clock starts to chime', `I trace the ${c.motif} slowly`, 'like it could hold the time'],
  c => [`Like the ${c.motif}, one more ${c.season} morning`, 'comes soft against the wall', `The ${c.motif} keeps its color`, 'through everything at all'],
  c => [`With the ${c.motif} close, I open up the curtain`, `to a ${c.season} kind of gray`, `The ${c.motif} waits in silence`, 'for whatever I might say'],
  c => [`Beside the ${c.motif}, there is a ${c.season} quiet`, 'that only mornings know', `Beside the ${c.motif}, waiting`, 'I feel the hours grow slow'],
  c => [`Holding the ${c.motif}, the ${c.season} air is settling`, 'like dust on old good news', `I hold the ${c.motif} closer`, 'to keep away the blues'],
  c => [`Like the ${c.motif}, a ${c.season} hush is falling`, 'on every empty chair', `The ${c.motif} still carries`, 'a softer kind of air'],
  c => [`With the ${c.motif} close, under ${c.season} colors`, 'the whole street starts to wake', `I watch the ${c.motif} glowing`, 'for one more heart to take'],
  c => [`Beside the ${c.motif}, the ${c.season} calm arrives here`, 'before the noise gets loud', `The ${c.motif} sits unhurried`, 'above the passing crowd'],
  c => [`Holding the ${c.motif}, on this ${c.season} corner`, 'the world moves slow and kind', `The ${c.motif} keeps a rhythm`, 'that lingers in my mind'],
  c => [`Like the ${c.motif}, a ${c.season} note is drifting`, 'from somewhere down the hall', `The ${c.motif} leans in closer`, 'to answer when I call'],
  c => [`With the ${c.motif} close, I count the ${c.season} minutes`, 'the way an old friend would', `The ${c.motif} feels familiar`, 'in every neighborhood'],
  c => [`Beside the ${c.motif}, beneath a ${c.season} ceiling`, 'of quiet gray and gold', `The ${c.motif} holds a story`, 'that never gets too old']
];

const enSituation: LineTemplate[] = [
  c => [`In this ${c.situation}`, 'I breathe and let it be', `The ${c.motif} keeps shining`, 'like a small old memory'],
  c => [`Inside this ${c.situation}`, 'I find a slower pace', `The ${c.motif} sits nearby me`, 'like a familiar face'],
  c => [`Right here in this ${c.situation}`, 'the noise begins to fade', `The ${c.motif} feels like proof of`, 'a promise gently made'],
  c => [`Caught up in this ${c.situation}`, 'I let my shoulders rest', `The ${c.motif} does not ask me`, 'to be my very best'],
  c => [`Somewhere in this ${c.situation}`, 'the hours lose their weight', `The ${c.motif} waits beside me`, 'and never makes me wait'],
  c => [`Held here by this ${c.situation}`, 'I feel a little brave', `The ${c.motif} keeps a secret`, 'that only quiet gave'],
  c => [`Still inside this ${c.situation}`, 'the world feels close and small', `The ${c.motif} echoes my footsteps`, 'and answers when I call'],
  c => [`Through this ${c.situation}`, 'a softer voice comes home', `The ${c.motif} keeps the corners`, 'so I don’t feel alone'],
  c => [`Framed by this ${c.situation}`, 'my worries drift and thin', `The ${c.motif} holds the evening`, 'like it was always in'],
  c => [`Wrapped inside this ${c.situation}`, 'I hear my own name clear', `The ${c.motif} feels less distant`, 'the longer I stay here'],
  c => [`Set inside this ${c.situation}`, 'the day forgets to rush', `The ${c.motif} answers softly`, 'in nothing but a hush'],
  c => [`Steady in this ${c.situation}`, 'I let the moment stay', `The ${c.motif} keeps rewriting`, 'a gentler kind of day']
];

// pre-chorus: a short, generic 2-line lead-in that builds toward the hook.
// Deliberately hook-agnostic (the hook itself is interpolated as its own bare
// line by composeLyrics, not embedded in these templates) so the same small
// pool works before any hook phrase.
const enPreChorus: LineTemplate[] = [
  c => [`And when the ${c.season} light comes low`, 'I hear myself say'],
  _c => ['There is something in this quiet', 'that makes me want to stay'],
  _c => ['The quiet builds a little more', 'and then I finally say'],
  _c => ['I feel it rising soft and slow', 'right before I say'],
  c => [`Each ${c.season} evening calls me back`, 'to the words I always say'],
  c => [`The ${c.motif} waits for just this moment`, 'and I quietly say'],
  _c => ['I have carried this a long, long while', 'and now I have to say'],
  _c => ['Something in the silence shifts', 'and I can finally say'],
  _c => ['Right here in this moment', 'I stop and I say']
];

// TASK v4.6 (TASK E) — every one of these 10 templates used to lead its
// middle line with "every" (2 of them doubled up with a first-line "every"
// too), and this bank is drawn up to 3x per song (chorus/chorus/final
// chorus — see composeLyrics's own doc comment on that). Restoring 'every'
// to lyricVocabularyRepetition.ts's counted vocabulary (this task's own
// STOPWORDS fix) revealed this as the actual dominant source of the pack-
// wide "every" overuse this task investigates (a real generated 18-song
// pack measured 95 occurrences before this edit) — 8 of the 10 middle-line
// leads and both first-line instances are now varied synonyms; 2 middle
// lines keep "every" (still a legitimate word choice), matching this task's
// own "특히 every... 반복하지 마십시오" without eliminating it outright.
const enChorusDev: LineTemplate[] = [
  c => ['softly through the day', 'every lonely shadow', `${likeMotif(c.motif)}, slowly fades away`],
  c => ['gently one more time', 'each heavy morning', `${likeMotif(c.motif)}, glows a little brighter`],
  c => ['steady as it grows', 'this quiet worry', `${likeMotif(c.motif)}, settles and lets go`],
  c => ['warm however far', 'another empty evening', `${likeMotif(c.motif)}, finds a lower star`],
  c => ['close in some way', 'this tired heartbeat', `${likeMotif(c.motif)}, finds a softer day`],
  c => ['brighter than before', 'that folded moment', `${likeMotif(c.motif)}, opens like a door`],
  c => ['calm no matter what', 'any scattered feeling', `${likeMotif(c.motif)}, settles where it stopped`],
  c => ['home no matter where', 'each quiet distance', `${likeMotif(c.motif)}, turns to something near`],
  c => ['kind through the hours', 'every fading color', `${likeMotif(c.motif)}, finds a little power`],
  c => ['soft and unafraid', 'this fragile silence', `${likeMotif(c.motif)}, settles into okay`]
];

const enBridge: LineTemplate[] = [
  c => ['Some dreams become silence', `Some tears turn to light, ${likeMotif(c.motif)}`],
  c => ['Some roads lead to nowhere', `Some lead straight back home, ${likeMotif(c.motif)}`],
  c => ['Some words never leave us', `Some just fade to hum, ${likeMotif(c.motif)}`],
  c => ['Some winters feel endless', `Some end overnight, ${likeMotif(c.motif)}`],
  c => ['Some faces stay distant', `Some stay in the room, ${likeMotif(c.motif)}`],
  c => ['Some songs keep their color', `Some quietly fade, ${likeMotif(c.motif)}`],
  c => ['Some mornings feel heavy', `Some feel free and light, ${likeMotif(c.motif)}`],
  c => ['Some letters stay folded', `Some finally get read, ${likeMotif(c.motif)}`]
];

const enVerse2: LineTemplate[] = [
  c => ['There were roads behind me', 'I could not understand', `Now they feel ${likeMotif(c.motif)}`, 'resting in my hand'],
  c => ['I remember distances', 'that used to feel too wide', `Now they feel ${likeMotif(c.motif)}`, 'quietly by my side'],
  c => ['I used to count the reasons', 'a slower day would fail', `Now they feel ${likeMotif(c.motif)}`, 'a soft familiar trail'],
  c => ['The years I spent unsettled', 'still linger now and then', `But they feel ${likeMotif(c.motif)}`, 'that finally makes sense'],
  c => ['I carried doubts for seasons', 'not knowing where they’d land', `Now they feel ${likeMotif(c.motif)}`, 'I finally understand'],
  c => ['The nights I spent unanswered', 'come back a little clearer', `Now they feel ${likeMotif(c.motif)}`, 'that only brought me nearer'],
  c => ['I kept a list of maybes', 'too tired to say them out', `Now they feel ${likeMotif(c.motif)}`, 'without a trace of doubt'],
  c => ['I used to rush the mornings', 'afraid to miss the light', `Now they feel ${likeMotif(c.motif)}`, 'that stays no matter the night'],
  c => ['I thought the quiet meant losing', 'a version of the plan', `Now it feels ${likeMotif(c.motif)}`, 'I finally understand'],
  _c => ['One more quiet morning', 'another soft rain', `Turns the page so gently`, 'and calls me home again'],
  c => ['I kept the small regrets', 'folded soft and low', `Now they feel ${likeMotif(c.motif)}`, 'ready to let go'],
  c => ['The years moved like a river', 'too fast to hold at all', `Now they feel ${likeMotif(c.motif)}`, 'answering my call']
];

const enClosing: LineTemplate[] = [
  c => [`and here I finally rest, beside the ${c.motif}`],
  c => [`and everything feels right, ${likeMotif(c.motif)}`],
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

// 도입부 고유성 재조사 — 각 템플릿의 첫 줄은 원래 ${c.season}(팩 전체 고정값)에만
// 의존해, 팩 크기(보통 18곡)가 템플릿 개수(12개)를 넘으면 비둘기집 원리로
// 첫 줄이 구조적으로 중복될 수밖에 없었다(core/lyricsAst.ts's openingSixWords
// 실측: 18곡 팩에서 평균 12.7/18 고유). 곡마다 달라지는 ${c.motif}를 짧은
// 연결구로 첫 줄 맨 앞에 덧붙여, 기존 줄의 문법/줄 수는 그대로 두면서 첫
// 줄의 실제 가짓수를 (템플릿 수) × (motif 풀 크기)로 넓힌다. 연결구 4종을
// 순환시켜 같은 motif를 뽑은 두 곡이라도 연결구 자체가 곡마다 똑같이
// 반복되지 않게 한다.
const koOpening: LineTemplate[] = [
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, ${c.season} 빛이 문가에 내려`, '오래된 잔 위에 머물고', '작은 라디오 소리 하나', '아침을 천천히 깨워요'],
  c => [`${c.motif} 곁에서, ${c.season} 바람이 지나가며`, '하루의 페이지를 넘기고', `${c.motif} 하나가 곁에서`, '아무 말 없이 머물러요'],
  c => [`${c.motif}${koParticle(c.motif, '을', '를')} 품은 채, ${c.season} 거리 저편에서`, '작은 종소리가 울리고', `${c.motif}${koParticle(c.motif, '을', '를')} 가만히 만지면`, '시간이 잠시 멈춰요'],
  c => [`${c.motif}처럼 다가온, 또 하루의 ${c.season} 아침이`, '벽 위로 부드럽게 내려와', `${c.motif}${koParticle(c.motif, '은', '는')} 그 색을 지키며`, '모든 걸 다 품어줘요'],
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, 커튼을 살짝 걷으면`, `${c.season}의 흐린 하늘이 보여요`, `${c.motif}${koParticle(c.motif, '은', '는')} 조용히 기다리며`, '내 말을 듣고 있어요'],
  c => [`${c.motif} 곁에서, 아침만 아는 ${c.season}의 고요가`, '가만히 내려앉고', `${c.motif} 곁에 서서 기다리면`, '시간이 천천히 자라요'],
  c => [`${c.motif}${koParticle(c.motif, '을', '를')} 품은 채, ${c.season} 공기가 내려앉아`, '지난 소식처럼 쌓이고', `${c.motif}${koParticle(c.motif, '을', '를')} 더 꼭 안으면`, '우울함이 멀어져요'],
  c => [`${c.motif}처럼 다가온, ${c.season}의 침묵이 내려와`, '빈 의자마다 앉고', `${c.motif}${koParticle(c.motif, '은', '는')} 여전히 머금고 있어요`, '더 부드러운 공기를'],
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, ${c.season} 색깔 아래에서`, '거리 전체가 깨어나고', `빛나는 ${c.motif}${koParticle(c.motif, '을', '를')} 바라보면`, '마음 하나가 더 다가와요'],
  c => [`${c.motif} 곁에서, ${c.season}의 평온이 찾아와요`, '소음이 커지기 전에', `${c.motif}${koParticle(c.motif, '은', '는')} 서두르지 않고`, '차분히 자리를 지켜요'],
  c => [`${c.motif}${koParticle(c.motif, '을', '를')} 품은 채, 이 ${c.season} 모퉁이에서`, '세상은 천천히 다정하게 움직이고', `${c.motif}${koParticle(c.motif, '은', '는')} 리듬을 지키며`, '마음속에 오래 남아요'],
  c => [`${c.motif}처럼 다가온, ${c.season}의 음이 흘러와요`, '복도 저편 어디선가', `${c.motif}${koParticle(c.motif, '이', '가')} 조금 더 가까이`, '내가 부를 때 대답해요']
];

const koSituation: LineTemplate[] = [
  c => [`${c.situation} 속에서`, '나는 숨을 고르고', `${c.motif} 같은 기억 하나`, '조용히 다시 빛나요'],
  c => [`${c.situation} 안에서`, '조금 더 천천히 걸어요', `${c.motif}${koParticle(c.motif, '은', '는')} 곁에 있어요`, '익숙한 얼굴처럼요'],
  c => [`바로 이 ${c.situation}에서`, '소음이 서서히 사라지고', `${c.motif}${koParticle(c.motif, '은', '는')} 증명처럼 느껴져요`, '다정하게 지켜진 약속처럼'],
  c => [`${c.situation}에 머물러`, '어깨의 힘을 풀어봐요', `${c.motif}${koParticle(c.motif, '은', '는')} 나에게`, '최선을 요구하지 않아요'],
  c => [`${c.situation} 어딘가에서`, '시간의 무게가 가벼워지고', `${c.motif}${koParticle(c.motif, '은', '는')} 내 곁에서`, '기다림도 잊게 해요'],
  c => [`${c.situation}${koParticle(c.situation, '이', '가')} 나를 감싸고`, '조금은 용감해져요', `${c.motif}${koParticle(c.motif, '은', '는')} 비밀 하나를 품고`, '고요함만이 아는 이야기를'],
  c => [`여전히 이 ${c.situation} 안에서`, '세상이 작고 가깝게 느껴져요', `${c.motif}${koParticle(c.motif, '은', '는')} 내 발걸음을 따라오고`, '부를 때마다 대답해요'],
  c => [`${c.situation}${koParticle(c.situation, '을', '를')} 지나며`, '부드러운 목소리가 돌아와요', `${c.motif}${koParticle(c.motif, '은', '는')} 구석마다 지켜줘요`, '혼자가 아니게'],
  c => [`${c.situation}에 둘러싸여`, '걱정이 옅어지고 작아져요', `${c.motif}${koParticle(c.motif, '은', '는')} 저녁을 품고 있어요`, '늘 그래왔던 것처럼'],
  c => [`${c.situation} 속에 감싸여`, '내 이름을 또렷이 들어요', `${c.motif}${koParticle(c.motif, '은', '는')} 조금 덜 멀게 느껴져요`, '여기 오래 머물수록'],
  c => [`${c.situation} 안에 자리 잡아`, '하루가 서두르지 않아요', `${c.motif}${koParticle(c.motif, '은', '는')} 부드럽게 대답해요`, '고요함 하나로'],
  c => [`${c.situation} 안에서 차분히`, '이 순간을 붙잡아둬요', `${c.motif}${koParticle(c.motif, '은', '는')} 다시 써 내려가요`, '조금 더 다정한 하루로']
];

const koPreChorus: LineTemplate[] = [
  c => [`${c.season}빛이 낮게 내려올 때`, '나는 조용히 말해요'],
  _c => ['이 순간 속에서', '문득 이렇게 불러봐요'],
  _c => ['고요함이 조금 더 짙어지면', '나는 결국 말해요'],
  _c => ['천천히 차오르는 마음으로', '나는 이렇게 말해요'],
  c => [`${c.motif}${koParticle(c.motif, '이', '가')} 이 순간을 기다리고`, '나는 조용히 불러봐요'],
  _c => ['오래 품고 있던 마음을', '이제는 말해볼게요'],
  _c => ['고요 속에서 무언가 바뀌면', '나는 결국 이렇게 말해요'],
  c => [`${c.season} 저녁이 나를 부를 때`, '나는 이렇게 대답해요'],
  _c => ['바로 이 순간에서', '나는 마음을 열어 말해요']
];

const koChorusDev: LineTemplate[] = [
  c => ['오늘도 천천히 걸어요', '외로운 그림자도', `${c.motif}처럼, 조금씩 옅어져요`],
  c => ['다시 한번 부드럽게', '무거운 아침도', `${c.motif}처럼, 다시 빛을 내요`],
  c => ['자라날수록 차분하게', '작은 걱정들도', `${c.motif}처럼, 조용히 흘러가요`],
  c => ['멀리 있어도 따뜻하게', '텅 빈 저녁도', `${c.motif}처럼, 낮은 별을 찾아요`],
  c => ['어느 쪽이든 가깝게', '지친 마음도', `${c.motif}처럼, 더 부드러운 하루를 찾아요`],
  c => ['전보다 더 밝게', '접혀 있던 순간도', `${c.motif}처럼, 문처럼 열려요`],
  c => ['어떤 상황이든 차분히', '흩어진 감정도', `${c.motif}처럼, 멈췄던 자리로 돌아와요`],
  c => ['어디에 있든 집처럼', '조용한 거리도', `${c.motif}처럼, 가까움으로 바뀌어요`],
  c => ['매 시간 다정하게', '바래가는 색도', `${c.motif}처럼, 작은 힘을 찾아요`],
  c => ['부드럽고 두렵지 않게', '연약한 고요도', `${c.motif}처럼, 괜찮아져요`]
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
  _c => ['지나온 길들은 모두', '이제는 음악이 되고', `말하지 못한 마음까지`, '창가에 내려앉아요'],
  c => ['너무 멀게 느껴졌던 거리도', '이제는 다르게 보여요', `그것들은 ${c.motif}처럼`, '조용히 내 곁에 있어요'],
  c => ['느린 하루를 탓하던 이유도', '이제는 세어보지 않아요', `그것들은 ${c.motif}처럼`, '익숙한 길이 되었어요'],
  c => ['정착하지 못했던 시간도', '가끔 다시 떠오르지만', `${c.motif}처럼 느껴져요`, '이제야 이해가 돼요'],
  c => ['계절마다 품었던 의심도', '어디로 향할지 몰랐지만', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  c => ['대답받지 못한 밤들도', '조금 더 선명하게 돌아와요', `그것들은 ${c.motif}처럼`, '나를 더 가까이 데려왔어요'],
  c => ['말하지 못한 것들의 목록도', '너무 지쳐 꺼내지 못했지만', `이제는 ${c.motif}처럼`, '의심 없이 남아요'],
  c => ['빛을 놓칠까 서두르던 아침도', '이제는 천천히 흘러가요', `${c.motif}처럼 느껴져요`, '어떤 밤에도 머무는'],
  c => ['고요함이 잃음이라 생각했던 계획도', '이제는 다르게 보여요', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  _c => ['매일의 작은 커피와', '비에 젖은 거리도', '다시 돌아갈 곳처럼', '따뜻하게 불러요'],
  c => ['작은 후회들도', '조용히 접어두었지만', `이제는 ${c.motif}처럼`, '놓아줄 준비가 됐어요'],
  c => ['강물처럼 흘러간 시간도', '너무 빨라 붙잡지 못했지만', `이제는 ${c.motif}처럼`, '내 부름에 대답해요']
];

const koClosing: LineTemplate[] = [
  c => [`이제야 편히 쉬어요, ${c.motif}${koParticle(c.motif, '과', '와')} 함께`],
  c => [`모든 게 다 괜찮게 느껴져요, ${c.motif}처럼`],
  c => [`아침이 나를 집으로 데려가요, ${c.motif} 곁에서`],
  c => [`고요함이 은혜처럼 느껴져요, ${c.motif}${koParticle(c.motif, '과', '와')} 함께`],
  c => [`나는 더 이상 혼자가 아니에요, ${c.motif}${koParticle(c.motif, '이', '가')} 있어서`],
  c => [`그 빛이 조금 더 머물러요, ${c.motif} 위에`],
  c => [`이 계절이 숨 쉴 틈을 줘요, ${c.motif} 곁에서`],
  c => [`내일이 다정하게 느껴져요, ${c.motif}처럼`]
];

// ---------------------------------------------------------------------------
// kr-2030 Korean pools
// ---------------------------------------------------------------------------

/**
 * v5.7 (TASK D) — real audit finding (docs/v56-report.md): `poolsFor()`
 * used to branch only on LyricLanguage, so kr-2030 (and every other Korean
 * workspace) drew from `koPools` above — a template set built entirely
 * around senior-morning-radio imagery ('라디오', '커튼', '창가'/window,
 * 'morning' as the anchoring time of day). A kr-2030 song about a rainy
 * night out ended up singing about curtains and radios regardless of
 * concept. This is a parallel, entirely original Korean template set for
 * kr-2030 specifically: night/city imagery (거리·불빛·골목·이어폰·지하철·
 * 편의점·가로등) instead of morning/home imagery, and zero vocabulary
 * overlap with koPools by construction (every line written fresh, not
 * edited from the senior set) — matching this workspace's own real channel
 * character (after-work-band-pop/thirty-night-walk/rainy-seoul-nightscape,
 * see data/presets.ts) and its AudienceProfile constraints
 * (data/audienceProfiles.ts's KR_2030_EMOTIONAL_AUDIENCE_PROFILE, v5.7 TASK
 * B: 'contemporary Korean urban-pop production', excludes 'nostalgic
 * senior-radio announcer tone'). Same LineTemplate shape/line-count-per-
 * category as koPools so composeLyrics's section assembly needs no changes.
 */
// 도입부 고유성 재조사 — koOpening's own doc comment above의 동일 원인/수정.
const kr2030Opening: LineTemplate[] = [
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, ${c.season} 거리 위로 불빛이 번지고`, '이어폰 속 노래가 낮게 흐르고', `${c.motif}${koParticle(c.motif, '이', '가')} 골목 끝에서 기다리면`, '하루가 천천히 풀려요'],
  c => [`${c.motif} 곁에서, 퇴근길 ${c.season} 공기를 마시며`, '걸음이 조금씩 가벼워지고', `${c.motif}${koParticle(c.motif, '은', '는')} 늘 그 자리에 서서`, '나를 알아보는 것 같아요'],
  c => [`${c.motif}${koParticle(c.motif, '을', '를')} 품은 채, ${c.season} 밤이 도시를 덮으면`, '네온 불빛이 하나둘 켜지고', `${c.motif}${koParticle(c.motif, '을', '를')} 스쳐 지나가다가`, '문득 걸음을 멈춰요'],
  c => [`${c.motif}처럼 다가온, 버스 정류장에 서서 보는 ${c.season}`, '오늘의 소음이 잦아들고', `${c.motif}${koParticle(c.motif, '은', '는')} 조용히 곁을 지키며`, '말없이 나를 따라와요'],
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, 서른의 ${c.season}은 조금 다르게 와요`, '조급함 대신 익숙함으로', `${c.motif}${koParticle(c.motif, '이', '가')} 그 사이를 채우면`, '오늘 하루도 괜찮아져요'],
  c => [`${c.motif} 곁에서, ${c.season} 골목을 따라 걸으면`, '가로등이 하나씩 켜지고', `${c.motif}${koParticle(c.motif, '은', '는')} 그 빛 아래 서서`, '나를 집으로 이끌어요'],
  c => [`${c.motif}${koParticle(c.motif, '을', '를')} 품은 채, 이어폰 너머로 들리는 ${c.season}`, '도시의 소리가 낮게 섞이고', `${c.motif}${koParticle(c.motif, '을', '를')} 떠올리면`, '마음이 조금 느슨해져요'],
  c => [`${c.motif}처럼 다가온, ${c.season} 비가 아스팔트를 적시면`, '발걸음마다 불빛이 번지고', `${c.motif}${koParticle(c.motif, '은', '는')} 그 사이를 걸어와`, '내 하루 끝에 닿아요'],
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, 늦은 ${c.season} 밤, 편의점 불빛 아래`, '잠깐의 쉼표를 찍고', `${c.motif}${koParticle(c.motif, '이', '가')} 옆에 놓이면`, '오늘도 무사히 넘어가요'],
  c => [`${c.motif} 곁에서, ${c.season} 하늘 아래 도시가 반짝이고`, '지하철 계단을 오르내리며', `${c.motif}${koParticle(c.motif, '은', '는')} 내 발걸음에 맞춰`, '조용히 리듬을 지켜요']
];

const kr2030Situation: LineTemplate[] = [
  c => [`${c.situation} 속에서`, '숨 한 번 크게 고르고', `${c.motif}${koParticle(c.motif, '은', '는')} 그 모든 걸 지켜보며`, '말없이 곁에 있어요'],
  c => [`${c.situation} 안에서`, '어깨에 힘을 조금 빼고', `${c.motif}${koParticle(c.motif, '은', '는')} 나에게`, '아무것도 묻지 않아요'],
  c => [`바로 이 ${c.situation}에서`, '오늘 하루를 내려놓고', `${c.motif}${koParticle(c.motif, '은', '는')} 익숙한 얼굴처럼`, '조용히 다가와요'],
  c => [`${c.situation} 어딘가에서`, '마음의 속도를 늦추고', `${c.motif}${koParticle(c.motif, '은', '는')} 내 곁에 머물며`, '기다림도 잊게 해요'],
  c => [`${c.situation}${koParticle(c.situation, '이', '가')} 나를 감싸면`, '조금은 솔직해져요', `${c.motif}${koParticle(c.motif, '은', '는')} 그 순간을 기억하며`, '나만 아는 얘기를 들어줘요'],
  c => [`여전히 이 ${c.situation} 안에서`, '도시가 조금 가깝게 느껴지고', `${c.motif}${koParticle(c.motif, '은', '는')} 내 발걸음을 따라오며`, '부를 때마다 응답해요'],
  c => [`${c.situation}${koParticle(c.situation, '을', '를')} 지나며`, '익숙한 리듬이 돌아오고', `${c.motif}${koParticle(c.motif, '은', '는')} 구석마다 남아서`, '혼자가 아니게 해줘요'],
  c => [`${c.situation}에 둘러싸여`, '오늘의 무게가 가벼워지고', `${c.motif}${koParticle(c.motif, '은', '는')} 늦은 저녁을 함께 걸어요`, '늘 그래왔던 것처럼'],
  c => [`${c.situation} 속에 자리 잡아`, '하루가 서두르지 않고', `${c.motif}${koParticle(c.motif, '은', '는')} 부드럽게 응답해요`, '조용한 확신 하나로'],
  c => [`${c.situation} 안에서 차분히`, '이 순간을 붙잡아두고', `${c.motif}${koParticle(c.motif, '은', '는')} 다시 써 내려가요`, '조금 더 단단한 하루로']
];

const kr2030PreChorus: LineTemplate[] = [
  c => [`${c.season} 밤이 낮게 내려올 때`, '나는 나직이 말해요'],
  _c => ['이 도시의 소음 속에서', '문득 이렇게 불러봐요'],
  _c => ['익숙함이 조금 더 짙어지면', '나는 결국 말해요'],
  _c => ['천천히 차오르는 마음으로', '나는 이렇게 말해요'],
  c => [`${c.motif}${koParticle(c.motif, '이', '가')} 이 순간을 기다리고`, '나는 조용히 불러봐요'],
  _c => ['오래 미뤄뒀던 마음을', '이제는 말해볼게요'],
  _c => ['이 거리 끝에서 무언가 바뀌면', '나는 결국 이렇게 말해요'],
  c => [`${c.season} 밤이 나를 부를 때`, '나는 이렇게 대답해요']
];

const kr2030ChorusDev: LineTemplate[] = [
  c => ['오늘도 씩씩하게 걸어요', '지친 하루 끝에도', `${c.motif}처럼, 다시 걸음을 떼요`],
  c => ['다시 한번 담담하게', '무거운 마음도', `${c.motif}처럼, 조금씩 가벼워져요`],
  c => ['자랄수록 단단하게', '작은 걱정들도', `${c.motif}처럼, 조용히 흘려보내요`],
  c => ['멀리 있어도 든든하게', '텅 빈 방도', `${c.motif}처럼, 낮은 불빛을 찾아요`],
  c => ['어디에 있든 나답게', '흔들리던 마음도', `${c.motif}처럼, 제자리를 찾아요`],
  c => ['전보다 더 솔직하게', '감춰뒀던 얘기도', `${c.motif}처럼, 조금씩 꺼내봐요`],
  c => ['어떤 밤이든 담대하게', '흩어진 하루도', `${c.motif}처럼, 다시 모여들어요`],
  c => ['매일 조금씩 씩씩하게', '지친 걸음도', `${c.motif}처럼, 다시 리듬을 찾아요`]
];

const kr2030Bridge: LineTemplate[] = [
  c => ['어떤 밤은 유난히 길고', `어떤 밤은 순식간에 지나가요, ${c.motif}처럼`],
  c => ['어떤 길은 끝이 안 보이고', `어떤 길은 집으로 곧장 이어져요, ${c.motif}처럼`],
  c => ['어떤 말은 삼켜지고', `어떤 말은 결국 노래가 돼요, ${c.motif}처럼`],
  c => ['어떤 하루는 무겁게 남고', `어떤 하루는 가볍게 흘러가요, ${c.motif}처럼`],
  c => ['어떤 얼굴은 자꾸 떠오르고', `어떤 얼굴은 조용히 옅어져요, ${c.motif}처럼`],
  c => ['어떤 계절은 유독 더디고', `어떤 계절은 순식간에 지나가요, ${c.motif}처럼`],
  c => ['어떤 메시지는 끝내 못 보내고', `어떤 메시지는 결국 닿아요, ${c.motif}처럼`]
];

const kr2030Verse2: LineTemplate[] = [
  _c => ['지나온 밤들은 모두', '이제는 노래가 되고', '말하지 못한 마음까지', '거리 위에 내려앉아요'],
  c => ['너무 멀게 느껴졌던 거리도', '이제는 다르게 보여요', `그것들은 ${c.motif}처럼`, '조용히 내 곁에 있어요'],
  c => ['서두르던 걸음의 이유도', '이제는 세어보지 않아요', `그것들은 ${c.motif}처럼`, '익숙한 길이 되었어요'],
  c => ['정착하지 못했던 밤들도', '가끔 다시 떠오르지만', `${c.motif}처럼 느껴져요`, '이제야 이해가 돼요'],
  c => ['계절마다 흔들리던 마음도', '어디로 향할지 몰랐지만', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  c => ['대답받지 못한 밤들도', '조금 더 선명하게 돌아와요', `그것들은 ${c.motif}처럼`, '나를 더 단단하게 만들었어요'],
  c => ['하지 못한 말들의 목록도', '너무 지쳐 꺼내지 못했지만', `이제는 ${c.motif}처럼`, '의심 없이 남아요'],
  c => ['늦은 지하철을 서두르던 밤도', '이제는 천천히 흘러가요', `${c.motif}처럼 느껴져요`, '어떤 밤에도 머무는'],
  c => ['혼자라 생각했던 저녁도', '이제는 다르게 보여요', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  _c => ['매일의 작은 커피 한 잔과', '비에 젖은 거리도', '돌아갈 곳처럼', '따뜻하게 불러요']
];

const kr2030Closing: LineTemplate[] = [
  c => [`이제야 마음이 놓여요, ${c.motif}${koParticle(c.motif, '과', '와')} 함께`],
  c => [`오늘 하루도 다 괜찮았어요, ${c.motif}처럼`],
  c => [`이 밤이 나를 집으로 데려가요, ${c.motif} 곁에서`],
  c => [`익숙함이 위로처럼 느껴져요, ${c.motif}${koParticle(c.motif, '과', '와')} 함께`],
  c => [`나는 더 이상 혼자가 아니에요, ${c.motif}${koParticle(c.motif, '이', '가')} 있어서`],
  c => [`그 불빛이 조금 더 머물러요, ${c.motif} 위에`],
  c => [`내일도 씩씩하게 걸어볼게요, ${c.motif}처럼`]
];

// ---------------------------------------------------------------------------
// kr-idol Korean pools
// ---------------------------------------------------------------------------

/**
 * v5.7 (TASK E) — same root-cause fix as kr2030Opening above, for
 * kr-idol-male/kr-idol-female (both share this ONE pool, not two separate
 * ones). That's a deliberate choice, not a shortcut: v5.7 TASK B's own
 * AudienceProfile work already established that idol energy/tempo/
 * structure is a workspace-GENRE trait, not a gendered one (see
 * KR_IDOL_MALE_AUDIENCE_PROFILE/KR_IDOL_FEMALE_AUDIENCE_PROFILE's own doc
 * comment in data/audienceProfiles.ts — "any gendered vocal-register
 * difference belongs in the per-genre GenreTraits/idolExpressionLint layer,
 * not invented here"). Standard polite Korean lyric register (-요/-어요) is
 * already gender-neutral, so a single stage/performance-imagery pool
 * (무대·조명·함성·카운트다운·앙코르 instead of kr2030's 거리·불빛·골목·이어폰,
 * itself instead of koPools' 라디오·커튼·창가) serves both workspaces without
 * inventing an ungrounded gendered distinction in sentence grammar — the
 * two workspaces still differ in lyric THEME/hook-bank content (K2/K3's own
 * separate 18-scene lyric worlds, data/lyricThemes.ts), just not in this
 * sentence-template layer.
 */
// 도입부 고유성 재조사 — koOpening's own doc comment above의 동일 원인/수정.
const krIdolOpening: LineTemplate[] = [
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, ${c.season} 조명이 켜지면`, '심장이 먼저 뛰기 시작해요', `${c.motif}${koParticle(c.motif, '이', '가')} 무대 위로 번지고`, '오늘 밤이 시작돼요'],
  c => [`${c.motif} 곁에서, 무대 뒤 ${c.season} 공기 속에서`, '숨을 크게 들이쉬고', `${c.motif}${koParticle(c.motif, '은', '는')} 우리를 기다리며`, '카운트다운을 시작해요'],
  c => [`${c.motif}${koParticle(c.motif, '을', '를')} 품은 채, ${c.season} 함성이 커질수록`, '심장 박동도 빨라지고', `${c.motif}${koParticle(c.motif, '을', '를')} 손끝으로 느끼면`, '모든 게 선명해져요'],
  c => [`${c.motif}처럼 다가온, 스포트라이트 아래 ${c.season}`, '오늘의 우리가 빛나고', `${c.motif}${koParticle(c.motif, '은', '는')} 그 중심에 서서`, '눈을 마주쳐요'],
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, ${c.season} 리듬이 시작되면`, '발끝부터 깨어나고', `${c.motif}${koParticle(c.motif, '이', '가')} 신호처럼 울리면`, '망설임 없이 뛰어들어요'],
  c => [`${c.motif} 곁에서, 무대 위 ${c.season} 빛 아래서`, '우리 모두 하나가 되고', `${c.motif}${koParticle(c.motif, '은', '는')} 그 순간을 지키며`, '함께 노래해요'],
  c => [`${c.motif}${koParticle(c.motif, '을', '를')} 품은 채, ${c.season} 함성 속으로`, '한 걸음 더 나아가고', `${c.motif}${koParticle(c.motif, '을', '를')} 마주 보면`, '두려움이 사라져요'],
  c => [`${c.motif}처럼 다가온, ${c.season} 밤, 무대의 문이 열리면`, '준비했던 모든 순간이', `${c.motif}처럼 한 번에 터지고`, '우리가 완성돼요'],
  c => [`${c.motif}${koParticle(c.motif, '과', '와')} 함께, ${c.season} 카운트다운이 끝나면`, '문이 열리고 빛이 쏟아지고', `${c.motif}${koParticle(c.motif, '은', '는')} 우리 편에 서서`, '오늘을 함께 완성해요'],
  c => [`${c.motif} 곁에서, ${c.season} 함성이 파도처럼 밀려오면`, '심장이 그 리듬을 따라가고', `${c.motif}${koParticle(c.motif, '은', '는')} 우리 사이를 채우며`, '무대가 완성돼요']
];

const krIdolSituation: LineTemplate[] = [
  c => [`${c.situation} 위에서`, '숨 한 번 크게 몰아쉬고', `${c.motif}${koParticle(c.motif, '은', '는')} 그 모든 순간을 지켜보며`, '우리와 함께 빛나요'],
  c => [`${c.situation} 안에서`, '망설임을 다 내려놓고', `${c.motif}${koParticle(c.motif, '은', '는')} 우리에게`, '망설일 틈을 주지 않아요'],
  c => [`바로 이 ${c.situation}에서`, '오늘의 무게를 다 걸고', `${c.motif}${koParticle(c.motif, '은', '는')} 익숙한 신호처럼`, '우리를 이끌어요'],
  c => [`${c.situation} 한가운데서`, '심장의 속도를 맞추고', `${c.motif}${koParticle(c.motif, '은', '는')} 우리 곁에 머물며`, '망설임도 잊게 해요'],
  c => [`${c.situation}${koParticle(c.situation, '이', '가')} 우리를 감싸면`, '조금 더 대담해져요', `${c.motif}${koParticle(c.motif, '은', '는')} 그 순간을 기억하며`, '우리만 아는 신호를 보내요'],
  c => [`여전히 이 ${c.situation} 위에서`, '함성이 조금 더 가깝게 느껴지고', `${c.motif}${koParticle(c.motif, '은', '는')} 우리 걸음을 따라오며`, '부를 때마다 응답해요'],
  c => [`${c.situation}${koParticle(c.situation, '을', '를')} 지나며`, '익숙한 박자가 돌아오고', `${c.motif}${koParticle(c.motif, '은', '는')} 구석구석 채워져`, '혼자가 아니게 해줘요'],
  c => [`${c.situation}에 둘러싸여`, '긴장이 오히려 힘이 되고', `${c.motif}${koParticle(c.motif, '은', '는')} 오늘 밤을 함께 걸어요`, '늘 그래왔던 것처럼'],
  c => [`${c.situation} 위에 자리 잡아`, '오늘이 서두르지 않고', `${c.motif}${koParticle(c.motif, '은', '는')} 힘 있게 응답해요`, '확신에 찬 리듬 하나로'],
  c => [`${c.situation} 안에서 담대하게`, '이 순간을 붙잡아두고', `${c.motif}${koParticle(c.motif, '은', '는')} 다시 써 내려가요`, '조금 더 눈부신 오늘로']
];

const krIdolPreChorus: LineTemplate[] = [
  c => [`${c.season} 조명이 낮아질 때`, '나는 힘주어 말해요'],
  _c => ['이 함성 속에서', '문득 이렇게 외쳐봐요'],
  _c => ['긴장이 조금 더 짙어지면', '나는 결국 말해요'],
  _c => ['천천히 차오르는 확신으로', '나는 이렇게 말해요'],
  c => [`${c.motif}${koParticle(c.motif, '이', '가')} 이 순간을 기다리고`, '나는 크게 외쳐봐요'],
  _c => ['오래 준비해온 마음을', '이제는 보여줄게요'],
  _c => ['이 무대 위에서 무언가 바뀌면', '나는 결국 이렇게 말해요'],
  c => [`${c.season} 함성이 나를 부를 때`, '나는 이렇게 대답해요']
];

const krIdolChorusDev: LineTemplate[] = [
  c => ['오늘도 당당하게 나아가요', '떨리는 순간에도', `${c.motif}처럼, 다시 힘을 내요`],
  c => ['다시 한번 힘 있게', '무거운 긴장도', `${c.motif}처럼, 조금씩 빛으로 바뀌어요`],
  c => ['자랄수록 눈부시게', '작은 불안도', `${c.motif}처럼, 조용히 흘려보내요`],
  c => ['멀리 있어도 뜨겁게', '텅 빈 무대도', `${c.motif}처럼, 환한 빛을 찾아요`],
  c => ['어디에 있든 우리답게', '흔들리던 마음도', `${c.motif}처럼, 제자리를 찾아요`],
  c => ['전보다 더 뜨겁게', '감춰뒀던 진심도', `${c.motif}처럼, 조금씩 터져 나와요`],
  c => ['어떤 무대든 담대하게', '흩어진 순간도', `${c.motif}처럼, 다시 하나로 모여요`],
  c => ['매 순간 눈부시게', '지친 걸음도', `${c.motif}처럼, 다시 리듬을 찾아요`]
];

const krIdolBridge: LineTemplate[] = [
  c => ['어떤 밤은 유난히 떨리고', `어떤 밤은 순식간에 지나가요, ${c.motif}처럼`],
  c => ['어떤 무대는 끝이 안 보이고', `어떤 무대는 한순간에 완성돼요, ${c.motif}처럼`],
  c => ['어떤 말은 삼켜지고', `어떤 말은 결국 함성이 돼요, ${c.motif}처럼`],
  c => ['어떤 하루는 무겁게 남고', `어떤 하루는 가볍게 날아올라요, ${c.motif}처럼`],
  c => ['어떤 순간은 자꾸 떠오르고', `어떤 순간은 조용히 새겨져요, ${c.motif}처럼`],
  c => ['어떤 무대는 유독 길고', `어떤 무대는 순식간에 지나가요, ${c.motif}처럼`],
  c => ['어떤 신호는 끝내 못 보내고', `어떤 신호는 결국 닿아요, ${c.motif}처럼`]
];

const krIdolVerse2: LineTemplate[] = [
  _c => ['지나온 무대들은 모두', '이제는 우리의 노래가 되고', '말하지 못한 마음까지', '함성 위에 내려앉아요'],
  c => ['너무 멀게 느껴졌던 거리도', '이제는 다르게 보여요', `그것들은 ${c.motif}처럼`, '조용히 우리 곁에 있어요'],
  c => ['서두르던 걸음의 이유도', '이제는 세어보지 않아요', `그것들은 ${c.motif}처럼`, '익숙한 무대가 되었어요'],
  c => ['떨리기만 했던 순간도', '가끔 다시 떠오르지만', `${c.motif}처럼 느껴져요`, '이제야 이해가 돼요'],
  c => ['무대마다 흔들리던 마음도', '어디로 향할지 몰랐지만', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  c => ['대답받지 못한 밤들도', '조금 더 선명하게 돌아와요', `그것들은 ${c.motif}처럼`, '우리를 더 단단하게 만들었어요'],
  c => ['하지 못한 말들의 목록도', '너무 지쳐 꺼내지 못했지만', `이제는 ${c.motif}처럼`, '의심 없이 남아요'],
  c => ['늦은 연습을 서두르던 밤도', '이제는 천천히 흘러가요', `${c.motif}처럼 느껴져요`, '어떤 무대에도 머무는'],
  c => ['혼자라 생각했던 순간도', '이제는 다르게 보여요', `이제는 ${c.motif}처럼`, '드디어 이해가 돼요'],
  _c => ['매일의 작은 연습과', '땀에 젖은 무대도', '돌아갈 곳처럼', '뜨겁게 불러요']
];

const krIdolClosing: LineTemplate[] = [
  c => [`이제야 마음이 놓여요, ${c.motif}${koParticle(c.motif, '과', '와')} 함께`],
  c => [`오늘 무대도 완벽했어요, ${c.motif}처럼`],
  c => [`이 함성이 우리를 하나로 만들어요, ${c.motif} 곁에서`],
  c => [`뜨거움이 위로처럼 느껴져요, ${c.motif}${koParticle(c.motif, '과', '와')} 함께`],
  c => [`우리는 더 이상 혼자가 아니에요, ${c.motif}${koParticle(c.motif, '이', '가')} 있어서`],
  c => [`그 빛이 조금 더 머물러요, ${c.motif} 위에`],
  c => [`다음 무대도 눈부시게 걸어볼게요, ${c.motif}처럼`]
];

// ---------------------------------------------------------------------------
// Japanese pools
// ---------------------------------------------------------------------------

// 도입부 고유성 재조사 — koOpening's own doc comment above의 동일 원인/수정.
const jaOpening: LineTemplate[] = [
  c => [`${c.motif}と共に、${c.season}の光がそっと`, '古いカップに落ちて', '小さなラジオの音が', '朝をゆっくり起こす'],
  c => [`${c.motif}のそばで、${c.season}の風が過ぎて`, '一日のページをめくる', `${c.motif}がそばにいて`, '何も言わずにとどまる'],
  c => [`${c.motif}を見つめながら、${c.season}の街の向こうで`, '小さな鐘が鳴り', `${c.motif}にそっと触れると`, '時間が少し止まる'],
  c => [`${c.motif}のように、また巡る${c.season}の朝が`, '壁にやわらかく落ちて', `${c.motif}はその色を守り`, 'すべてを包み込む'],
  c => [`${c.motif}と共に、カーテンをそっと開けると`, `${c.season}の曇り空が見える`, `${c.motif}は静かに待ちながら`, '私の声を聞いている'],
  c => [`${c.motif}のそばで、朝だけが知る${c.season}の静けさが`, 'そっと降りてきて', `${c.motif}のそばで待てば`, '時間がゆっくり育つ'],
  c => [`${c.motif}を見つめながら、${c.season}の空気が降り積もり`, '古い便りのように重なる', `${c.motif}をもっと抱きしめれば`, '憂鬱が遠ざかる'],
  c => [`${c.motif}のように、${c.season}の沈黙が降りて`, '空いた椅子に座る', `${c.motif}はまだ含んでいる`, 'やわらかな空気を'],
  c => [`${c.motif}と共に、${c.season}色の下で`, '街全体が目を覚まし', `輝く${c.motif}を見つめれば`, '心がもう少し近づく'],
  c => [`${c.motif}のそばで、${c.season}の静けさが訪れる`, '騒がしさが増える前に', `${c.motif}は急がず`, '静かにそこにいる'],
  c => [`${c.motif}を見つめながら、この${c.season}の角で`, '世界はゆっくりやさしく動き', `${c.motif}はリズムを守り`, '心の中に長く残る'],
  c => [`${c.motif}のように、${c.season}の音が流れてくる`, '廊下の向こうのどこかから', `${c.motif}がもう少し近くで`, '呼べば応えてくれる']
];

const jaSituation: LineTemplate[] = [
  c => [`${c.situation}の中で`, '息をひとつ整え', `${c.motif}みたいな記憶が`, '静かにまた灯る'],
  c => [`${c.situation}の中で`, 'もう少しゆっくり歩く', `${c.motif}はそばにいる`, 'なじみのある顔のように'],
  c => [`まさにこの${c.situation}で`, '騒がしさが少しずつ消えて', `${c.motif}は証のように感じる`, 'やさしく守られた約束のように'],
  c => [`${c.situation}にとどまり`, '肩の力をそっと抜く', `${c.motif}は私に`, '何も求めない'],
  c => [`${c.situation}のどこかで`, '時間の重さが軽くなり', `${c.motif}は私のそばで`, '待つことさえ忘れさせる'],
  c => [`${c.situation}に包まれて`, '少しだけ勇気が出る', `${c.motif}は秘密をひとつ抱え`, '静けさだけが知る物語を'],
  c => [`まだこの${c.situation}の中で`, '世界が小さく近く感じる', `${c.motif}は私の足音を響かせ`, '呼べば応えてくれる'],
  c => [`${c.situation}を通り過ぎて`, 'やわらかな声が帰ってくる', `${c.motif}は隅々を守ってくれる`, 'ひとりじゃないように'],
  c => [`${c.situation}に囲まれて`, '心配が薄く小さくなる', `${c.motif}は夕暮れを抱えている`, 'いつもそうだったように'],
  c => [`${c.situation}の中に包まれて`, '自分の名前をはっきり聞く', `${c.motif}は少し遠くなくなる`, 'ここに長くいるほど'],
  c => [`${c.situation}の中に落ち着いて`, '一日が急がなくなる', `${c.motif}はやさしく応える`, '静けさひとつで'],
  c => [`${c.situation}の中で静かに`, 'この瞬間をつかまえておく', `${c.motif}はまた書き直す`, 'もう少しやさしい一日を']
];

const jaPreChorus: LineTemplate[] = [
  c => [`${c.season}の光が低くなる頃`, '私は静かに言う'],
  _c => ['この瞬間の中で', 'ふとこう呼びかける'],
  _c => ['静けさがもう少し深まると', '私はついに言う'],
  _c => ['ゆっくり満ちてゆく心で', '私はこう言う'],
  c => [`${c.motif}がこの瞬間を待っていて`, '私は静かに呼びかける'],
  _c => ['長く抱えていた気持ちを', '今こそ伝えよう'],
  _c => ['静寂の中で何かが変わるなら', '私はついにこう言う'],
  c => [`${c.season}の夕暮れが私を呼ぶとき`, '私はこう答える'],
  _c => ['まさにこの瞬間の中で', '心を開いて言う']
];

const jaChorusDev: LineTemplate[] = [
  c => ['今日もゆっくり歩こう', 'さみしい影さえ', `${c.motif}のように、少しずつほどけてく`],
  c => ['もう一度やわらかく', '重い朝さえ', `${c.motif}のように、また輝きを取り戻す`],
  c => ['育つほど落ち着いて', '小さな心配さえ', `${c.motif}のように、静かに流れてゆく`],
  c => ['遠くてもあたたかく', '空っぽの夜さえ', `${c.motif}のように、低い星を見つける`],
  c => ['どちらにいても近くに', '疲れた心さえ', `${c.motif}のように、やさしい一日を見つける`],
  c => ['前よりも明るく', '折りたたまれた瞬間さえ', `${c.motif}のように、扉のように開く`],
  c => ['どんな時も落ち着いて', '散らばった気持ちさえ', `${c.motif}のように、止まった場所へ戻る`],
  c => ['どこにいても家のように', '静かな通りさえ', `${c.motif}のように、近さに変わる`],
  c => ['毎時間やさしく', '色あせてゆくものさえ', `${c.motif}のように、小さな力を見つける`],
  c => ['やわらかく恐れずに', 'もろい静けささえ', `${c.motif}のように、大丈夫になる`]
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
  _c => ['通り過ぎた道も', '今は音楽になり', '言えなかった気持ちまで', '窓辺にそっと座る'],
  c => ['遠すぎると思った距離も', '今は違って見える', `それは${c.motif}のように`, '静かにそばにある'],
  c => ['遅い一日を責めた理由も', '今は数えない', `それは${c.motif}のように`, '見慣れた道になった'],
  c => ['落ち着けなかった時間も', 'たまにまた浮かぶけれど', `${c.motif}のように感じる`, '今ようやくわかる'],
  c => ['季節ごとに抱いた迷いも', 'どこへ向かうか分からなかったが', `今は${c.motif}のように`, 'ようやくわかる'],
  c => ['答えのなかった夜も', '少し鮮明に戻ってくる', `それは${c.motif}のように`, '私をより近づけた'],
  c => ['言えなかったことの一覧も', '疲れて出せなかったが', `今は${c.motif}のように`, '迷いなく残る'],
  c => ['光を逃すまいと急いだ朝も', '今はゆっくり流れる', `${c.motif}のように感じる`, 'どんな夜にもとどまる'],
  c => ['静けさを失うことだと思った計画も', '今は違って見える', `今は${c.motif}のように`, 'ようやくわかる'],
  _c => ['毎日の小さなコーヒーと', '雨に濡れた街が', '帰る場所のように', 'やさしく呼んでいる'],
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

// ---------------------------------------------------------------------------
// jp-2030 Japanese pools
// ---------------------------------------------------------------------------

/**
 * v5.7 (TASK F) — same root-cause fix as kr2030Opening above, for jp-2030.
 * jaPools above carries senior/showa-flavored imagery (ラジオ/radio,
 * カーテン/curtain, morning-anchored scenes) same as koPools did for
 * Korean; this is an entirely original set built around jp-2030's own real
 * channel character (reiwa-way-home-jpop/tokyo-night-melodic-pop/want-to-
 * cry-band-playlist — night/way-home/city imagery: 帰り道·夜の街·イヤホン·
 * ネオン·街灯·コンビニ, not ラジオ/カーテン), matching its
 * AudienceProfile constraints (JP_2030_MELODIC_AUDIENCE_PROFILE, v5.7 TASK
 * B: 'contemporary Japanese melodic pop/rock production', excludes
 * 'nostalgic senior-radio announcer tone'). Plain/poetic register (not
 * polite -です/-ます), matching jaPools' own existing style.
 */
// 도입부 고유성 재조사 — koOpening's own doc comment above의 동일 원인/수정.
const jp2030Opening: LineTemplate[] = [
  c => [`${c.motif}と共に、${c.season}の街に灯りが滲んで`, 'イヤホンの中で歌が低く流れ', `${c.motif}が路地の先で待っていれば`, '一日がゆっくりほどけてゆく'],
  c => [`${c.motif}のそばで、帰り道、${c.season}の空気を吸い込んで`, '足取りが少しずつ軽くなる', `${c.motif}はいつもそこに立って`, '私を見つけてくれる気がする'],
  c => [`${c.motif}を見つめながら、${c.season}の夜が街を包めば`, 'ネオンの灯りが一つずつ灯る', `${c.motif}をふと通り過ぎて`, 'ふいに足を止める'],
  c => [`${c.motif}のように、バス停に立って眺める${c.season}`, '今日の騒がしさが静まって', `${c.motif}は静かにそばにいて`, '黙って私についてくる'],
  c => [`${c.motif}と共に、三十路の${c.season}は少し違って来る`, '焦りの代わりに馴染みが増えて', `${c.motif}がその隙間を埋めれば`, '今日も何とかなる気がする'],
  c => [`${c.motif}のそばで、${c.season}の路地を歩いていけば`, '街灯が一つずつ灯りだす', `${c.motif}はその灯りの下に立って`, '私を家へ導いてくれる'],
  c => [`${c.motif}を見つめながら、イヤホンの向こうに聞こえる${c.season}`, '街の音が低く混ざり合う', `${c.motif}を思い出せば`, '心が少しゆるんでいく'],
  c => [`${c.motif}のように、${c.season}の雨がアスファルトを濡らせば`, '足音のたびに灯りが滲む', `${c.motif}はその間を歩いてきて`, '一日の終わりに辿り着く'],
  c => [`${c.motif}と共に、遅い${c.season}の夜、コンビニの灯りの下`, 'つかの間の休符を打って', `${c.motif}がそばに置かれれば`, '今日も無事に終わってゆく'],
  c => [`${c.motif}のそばで、${c.season}の空の下、街が輝いて`, '駅の階段を上り下りしながら', `${c.motif}は私の足取りに合わせて`, '静かにリズムを守っている']
];

const jp2030Situation: LineTemplate[] = [
  c => [`${c.situation}の中で`, '息をひとつ整えて', `${c.motif}はそのすべてを見つめながら`, '黙ってそばにいてくれる'],
  c => [`${c.situation}の中で`, '肩の力を少し抜いて', `${c.motif}は私に`, '何も求めてこない'],
  c => [`まさにこの${c.situation}で`, '今日という日を下ろして', `${c.motif}は見慣れた顔のように`, '静かに近づいてくる'],
  c => [`${c.situation}のどこかで`, '心の速度を緩めて', `${c.motif}は私のそばにとどまり`, '待つことさえ忘れさせる'],
  c => [`${c.situation}が私を包めば`, '少しだけ素直になれる', `${c.motif}はその瞬間を覚えていて`, '自分だけが知る話を聞いてくれる'],
  c => [`まだこの${c.situation}の中で`, '街が少し近く感じられる', `${c.motif}は私の足音を追いかけて`, '呼べば応えてくれる'],
  c => [`${c.situation}を通り過ぎて`, '見慣れたリズムが戻ってくる', `${c.motif}は隅々に残っていて`, 'ひとりじゃないと思わせてくれる'],
  c => [`${c.situation}に囲まれて`, '今日の重さが軽くなる', `${c.motif}は遅い夕暮れを共に歩く`, 'いつもそうだったように'],
  c => [`${c.situation}の中に落ち着いて`, '一日が急がなくなる', `${c.motif}はやさしく応えてくれる`, '静かな確信ひとつで'],
  c => [`${c.situation}の中で静かに`, 'この瞬間をつかまえておく', `${c.motif}はまた書き直してくれる`, 'もう少し確かな一日を']
];

const jp2030PreChorus: LineTemplate[] = [
  c => [`${c.season}の夜が低く降りてくる頃`, '私は静かに言う'],
  _c => ['この街の騒がしさの中で', 'ふとこう呼びかける'],
  _c => ['馴染みがもう少し深まると', '私はついに言う'],
  _c => ['ゆっくり満ちてゆく心で', '私はこう言う'],
  c => [`${c.motif}がこの瞬間を待っていて`, '私は静かに呼びかける'],
  _c => ['長く後回しにしていた気持ちを', '今こそ伝えよう'],
  _c => ['この道の先で何かが変わるなら', '私はついにこう言う'],
  c => [`${c.season}の夜が私を呼ぶとき`, '私はこう答える']
];

const jp2030ChorusDev: LineTemplate[] = [
  c => ['今日もゆっくり歩いてゆこう', '疲れた一日の終わりにも', `${c.motif}のように、また歩き出す`],
  c => ['もう一度落ち着いて', '重い気持ちさえ', `${c.motif}のように、少しずつ軽くなる`],
  c => ['育つほど落ち着いて', '小さな不安さえ', `${c.motif}のように、静かに流してゆく`],
  c => ['遠くにいても頼もしく', '空っぽの部屋さえ', `${c.motif}のように、低い灯りを見つける`],
  c => ['どこにいても自分らしく', '揺れていた心さえ', `${c.motif}のように、居場所を見つける`],
  c => ['前よりも素直に', '隠していた本音さえ', `${c.motif}のように、少しずつ溢れてくる`],
  c => ['どんな夜でも大胆に', '散らばった一日さえ', `${c.motif}のように、また集まってくる`],
  c => ['毎日少しずつ力強く', '疲れた足取りさえ', `${c.motif}のように、またリズムを見つける`]
];

const jp2030Bridge: LineTemplate[] = [
  c => ['ある夜はやけに長く', `ある夜はあっという間に過ぎてゆく、${c.motif}のように`],
  c => ['ある道は先が見えず', `ある道はまっすぐ家へと続く、${c.motif}のように`],
  c => ['ある言葉は飲み込まれ', `ある言葉はやがて歌になる、${c.motif}のように`],
  c => ['ある一日は重く残り', `ある一日は軽く流れてゆく、${c.motif}のように`],
  c => ['ある顔はふと浮かび', `ある顔は静かに薄れてゆく、${c.motif}のように`],
  c => ['ある季節はやけに長く', `ある季節はあっという間に過ぎてゆく、${c.motif}のように`],
  c => ['あるメッセージはついに送れず', `あるメッセージはやがて届く、${c.motif}のように`]
];

const jp2030Verse2: LineTemplate[] = [
  _c => ['過ぎてきた夜はすべて', '今は歌になって', '言えなかった気持ちまで', '街の上にそっと降りる'],
  c => ['遠すぎると思った距離も', '今は違って見える', `それは${c.motif}のように`, '静かにそばにある'],
  c => ['急いでいた足取りの理由も', '今はもう数えない', `それは${c.motif}のように`, '見慣れた道になった'],
  c => ['落ち着けなかった夜も', 'たまにまた浮かぶけれど', `${c.motif}のように感じる`, '今ようやくわかる'],
  c => ['季節ごとに揺れていた心も', 'どこへ向かうか分からなかったが', `今は${c.motif}のように`, 'ようやくわかる'],
  c => ['答えのなかった夜も', '少し鮮明に戻ってくる', `それは${c.motif}のように`, '私をより強くした'],
  c => ['言えなかったことの一覧も', '疲れて出せなかったが', `今は${c.motif}のように`, '迷いなく残る'],
  c => ['終電を急いでいた夜も', '今はゆっくり流れる', `${c.motif}のように感じる`, 'どんな夜にもとどまる'],
  c => ['ひとりだと思っていた夕暮れも', '今は違って見える', `今は${c.motif}のように`, 'ようやくわかる'],
  _c => ['毎日の小さなコーヒーと', '雨に濡れた街も', '帰る場所のように', 'あたたかく呼んでいる']
];

const jp2030Closing: LineTemplate[] = [
  c => [`ようやく心が休まる、${c.motif}と共に`],
  c => [`今日という日も悪くなかった、${c.motif}のように`],
  c => [`この夜が私を家へ連れてゆく、${c.motif}のそばで`],
  c => [`馴染みが慰めのように感じる、${c.motif}と共に`],
  c => [`私はもうひとりじゃない、${c.motif}がいるから`],
  c => [`その灯りがもう少しとどまる、${c.motif}の上に`],
  c => [`明日もゆっくり歩いてみよう、${c.motif}のように`]
];

interface LanguagePools {
  opening: LineTemplate[];
  situation: LineTemplate[];
  preChorus: LineTemplate[];
  chorusDev: LineTemplate[];
  bridge: LineTemplate[];
  verse2: LineTemplate[];
  closing: LineTemplate[];
}

const enPools: LanguagePools = { opening: enOpening, situation: enSituation, preChorus: enPreChorus, chorusDev: enChorusDev, bridge: enBridge, verse2: enVerse2, closing: enClosing };
const koPools: LanguagePools = { opening: koOpening, situation: koSituation, preChorus: koPreChorus, chorusDev: koChorusDev, bridge: koBridge, verse2: koVerse2, closing: koClosing };
const kr2030Pools: LanguagePools = { opening: kr2030Opening, situation: kr2030Situation, preChorus: kr2030PreChorus, chorusDev: kr2030ChorusDev, bridge: kr2030Bridge, verse2: kr2030Verse2, closing: kr2030Closing };
const krIdolPools: LanguagePools = { opening: krIdolOpening, situation: krIdolSituation, preChorus: krIdolPreChorus, chorusDev: krIdolChorusDev, bridge: krIdolBridge, verse2: krIdolVerse2, closing: krIdolClosing };
const jaPools: LanguagePools = { opening: jaOpening, situation: jaSituation, preChorus: jaPreChorus, chorusDev: jaChorusDev, bridge: jaBridge, verse2: jaVerse2, closing: jaClosing };
const jp2030Pools: LanguagePools = { opening: jp2030Opening, situation: jp2030Situation, preChorus: jp2030PreChorus, chorusDev: jp2030ChorusDev, bridge: jp2030Bridge, verse2: jp2030Verse2, closing: jp2030Closing };

/**
 * v5.7 (TASK D/E/F) — was branch-only-on-language (see kr2030Opening's own
 * doc comment for why that was the audit's root cause for kr-2030's,
 * kr-idol-male/female's, and jp-2030's senior-flavored lyrics). `archetype` is optional and
 * additive: every existing caller that doesn't pass one keeps exactly the
 * old koPools/jaPools/enPools behavior, so this is a strict no-op for
 * senior-oldpop and every other archetype that isn't one of these four.
 */
function poolsFor(language: LyricLanguage, archetype?: ChannelArchetype): LanguagePools {
  if (language === 'korean') {
    if (archetype === 'kr-2030-pop') return kr2030Pools;
    if (archetype === 'kr-idol-male' || archetype === 'kr-idol-female') return krIdolPools;
    return koPools;
  }
  if (language === 'japanese') return archetype === 'jp-2030-pop' ? jp2030Pools : jaPools;
  return enPools;
}

const tags: Record<LyricLanguage, { intro: string; verse1: string; preChorus: string; chorus: string; verse2: string; bridge: string; finalChorus: string; end: string }> = {
  english: { intro: '[short intro]', verse1: '[verse 1]', preChorus: '[pre-chorus]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' },
  korean: { intro: '[short intro]', verse1: '[verse 1]', preChorus: '[pre-chorus]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' },
  japanese: { intro: '[short intro]', verse1: '[verse 1]', preChorus: '[pre-chorus]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' },
  bilingual: { intro: '[short intro]', verse1: '[verse 1]', preChorus: '[pre-chorus]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' }
};

/**
 * SeasonPack.keywords is English-only by design (it also feeds the always-
 * English Suno style prompt and YouTube tags), so it can't be localized
 * globally without breaking those. This is a lyrics-only translation of the
 * single season word interpolated into opening/situation lines.
 */
const seasonWordLocalization: Record<string, { korean: string; japanese: string }> = {
  'new-year': { korean: '새해', japanese: '新年' },
  'late-winter': { korean: '늦겨울', japanese: '晩冬' },
  'spring-open': { korean: '봄', japanese: '春' },
  'cherry-blossom': { korean: '벚꽃', japanese: '桜' },
  'may-cafe': { korean: '5월', japanese: '五月' },
  'rainy-season': { korean: '장마', japanese: '梅雨' },
  'summer-night': { korean: '여름밤', japanese: '夏の夜' },
  'late-summer-open': { korean: '늦여름', japanese: '晩夏' },
  'early-autumn': { korean: '초가을', japanese: '初秋' },
  'autumn-rain': { korean: '가을비', japanese: '秋雨' },
  'maple-autumn': { korean: '단풍', japanese: '紅葉' },
  'late-autumn': { korean: '늦가을', japanese: '晩秋' },
  'early-winter': { korean: '초겨울', japanese: '初冬' },
  'first-snow': { korean: '첫눈', japanese: '初雪' },
  christmas: { korean: '크리스마스', japanese: 'クリスマス' },
  'year-end': { korean: '연말', japanese: '年末' }
};

export function seasonWordFor(season: SeasonPack, language: LyricLanguage): string {
  if (language === 'korean') return seasonWordLocalization[season.id]?.korean ?? season.label;
  if (language === 'japanese') return seasonWordLocalization[season.id]?.japanese ?? season.label;
  return season.keywords[0] ?? season.label;
}

/** Pools that must not repeat a picked line within a single blueprint. */
export interface LyricBatchPools {
  opening: UniquePool<LineTemplate>;
  situation: UniquePool<LineTemplate>;
  preChorus: UniquePool<LineTemplate>;
  chorusDev: UniquePool<LineTemplate>;
  bridge: UniquePool<LineTemplate>;
  verse2: UniquePool<LineTemplate>;
  closing: UniquePool<LineTemplate>;
  /**
   * Short hooks and generic motif fillers are drawn from small (~5-14 word)
   * pools, so an independent template draw in one category can coincidentally
   * reproduce an exact line already used by an earlier song in the same pack.
   * Tracked across every category (not just preChorus) so composeLyrics can
   * retry until it finds a line that hasn't been used yet in this blueprint.
   */
  usedLines: Set<string>;
}

export function createLyricBatchPools(language: LyricLanguage, seedBase: string, archetype?: ChannelArchetype): LyricBatchPools {
  const pools = poolsFor(language, archetype);
  const s = hashSeed(seedBase);
  return {
    opening: new UniquePool(pools.opening, s + 1),
    situation: new UniquePool(pools.situation, s + 2),
    preChorus: new UniquePool(pools.preChorus, s + 3),
    chorusDev: new UniquePool(pools.chorusDev, s + 4),
    bridge: new UniquePool(pools.bridge, s + 5),
    verse2: new UniquePool(pools.verse2, s + 6),
    closing: new UniquePool(pools.closing, s + 7),
    usedLines: new Set<string>()
  };
}

/** 'soft reset before the closing run' keeps its old extra closing-pool texture line after the final chorus. */
function extendedFinalChorusTextRoles(role: string) {
  return role === 'soft reset before the closing run';
}

/** 'clear opener' (legacy) and 'cold-open' (TASK I1, v3.11 — replaces it for track 1) should reach their first chorus (and first hook) sooner, so verse 1 is trimmed to 2 lines. */
function shortOpenerRoles(role: string) {
  return role === 'clear opener' || role === 'cold-open';
}

/** 'late-set emotional center' gets a style-prompt-only instruction (half-step modulation), applied in localGenerator.ts. */
export function wantsFinalChorusModulation(role: string) {
  return role === 'late-set emotional center';
}

// ---------------------------------------------------------------------------
// Motif budget — a motif appearing in every one of opening/situation/
// chorusDev/verse2/bridge (and doubled again in the final chorus repeat) is
// how a single song ends up saying "evening train" six times. Rather than
// writing a second motif-free variant of every one of ~220 templates, the
// same template runs against a context whose `motif` field is swapped for a
// neutral filler noun on non-budgeted slots — the likeMotif()/koParticle()
// grammar helpers from TASK B already make either word safe to interpolate.
// ---------------------------------------------------------------------------

const MOTIF_SECONDARY_SLOTS = ['opening', 'verse2', 'situation', 'bridge'] as const;
type MotifSecondarySlot = (typeof MOTIF_SECONDARY_SLOTS)[number];
const MOTIF_SECONDARY_WEIGHTS = [0.4, 0.25, 0.2, 0.15];

/** Exactly one non-chorus slot is chosen per song, weighted toward opening. */
function chooseSecondaryMotifSlot(rng: () => number): MotifSecondarySlot {
  let r = rng();
  for (let i = 0; i < MOTIF_SECONDARY_WEIGHTS.length - 1; i++) {
    if (r < MOTIF_SECONDARY_WEIGHTS[i]) return MOTIF_SECONDARY_SLOTS[i];
    r -= MOTIF_SECONDARY_WEIGHTS[i];
  }
  return MOTIF_SECONDARY_SLOTS[MOTIF_SECONDARY_SLOTS.length - 1];
}

/**
 * TASK A3 gives every song three chorus-type sections (chorus, chorus,
 * final chorus), each drawing its own chorusDev line. If every draw used the
 * real motif, that alone would put the pack-wide "no motif word >3x" (R2)
 * regression right at its ceiling before the secondary slot even runs.
 * Exactly one of the three chorusDev draws gets the real motif; the other
 * two get an independent filler, keeping the total real-motif count at 2
 * per song (1 chorus draw + 1 secondary slot) — unchanged from before A3.
 */
function chooseRealMotifChorusIndex(rng: () => number): 0 | 1 | 2 {
  return Math.floor(rng() * 3) as 0 | 1 | 2;
}

const genericMotifFillers: Record<LyricLanguage, string[]> = {
  english: ['morning', 'evening', 'quiet hour', 'soft light', 'gentle hour'],
  korean: ['아침', '저녁', '고요한 시간', '부드러운 빛', '작은 순간'],
  japanese: ['朝', '夕方', '静かな時間', '柔らかな光', '小さな瞬間'],
  bilingual: ['morning', 'evening', 'quiet hour', 'soft light', 'gentle hour']
};

function pickMotifFiller(language: LyricLanguage, rng: () => number): string {
  const fillers = genericMotifFillers[language];
  return fillers[Math.floor(rng() * fillers.length)];
}

/**
 * TASK I1 (v3.11) — a wordless vocal direction, not sung lyric text, so (like
 * the [tag] section markers themselves) it stays in English regardless of
 * lyricLanguage rather than being translated per language.
 */
const WORDLESS_HUM_LINE = '(soft wordless hum of the hook melody, no lyrics, 2 bars)';

/**
 * TASK v3.42 Part C — real measurement: a 15-song pack rendered only 2
 * distinct section-tag shapes (the cold-open variant for track 1, and one
 * fixed shape — intro/verse1/pre-chorus/chorus/verse2/chorus/bridge/final-
 * chorus/end — for every other track). These 4 additional shapes reorder/
 * relabel the SAME already-varied content blocks composeLyrics already
 * computes (opening/situation/preChorus/chorusDev/verse2/bridge/closing draw
 * from per-song UniquePools same as before) — this only changes which
 * sections appear, in what order, under what tag, never the deep motif-
 * budget/pool-uniqueness machinery above. T1 is the original/default shape,
 * used unconditionally for track 1 (cold-open) regardless of which template
 * the plan assigns it, since track 1's opening technique (hook-forward/
 * hum-intro, see openingStyle) is its own well-tested feature.
 */
export type StructureTemplateId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

/**
 * TASK v3.43 Part A3 — plain-language description of each template's section
 * order, for handing to a remote agent (Batch API/Claude Code bridge) that
 * writes its own lyrics and so never runs through this file's own
 * composeLyrics/pool machinery. Directive guidance, not a stylePrompt
 * phrase — see PreassignedSongSlot.structureTemplate's comment in types.ts
 * and core/promptComposer.ts's structureTemplateLegend (the one-time legend
 * built from this map).
 *
 * TASK v3.70 (TASK B) — real listening feedback measured 3:42-4:10 songs
 * against a 3:10-3:35 target, traced to 9-11 sections per song (a real
 * Codex-bridge pack literally reproduced this doc's old text: two
 * pre-chorus repeats, an "outro" section this app's own composeLyrics never
 * had a tag for, and a trailing "[end]" that adds nothing in Suno). Rewritten
 * to match what composeLyrics itself actually renders (T1/T3 now only
 * mention pre-chorus once — see composeLyrics's own T3 branch fix below), to
 * land every template at 6-8 sections, and to drop "outro"/an implied "end"
 * entirely: the final chorus is the last section, nothing after it.
 */
export const STRUCTURE_TEMPLATE_SECTION_NOTES: Record<StructureTemplateId, string> = {
  T1: 'intro, verse 1, pre-chorus, chorus, verse 2, chorus, bridge, final chorus (8 sections — this is the last one, no trailing outro/end tag)',
  T2: 'cold hook intro (hook line first, no instrumental lead-in), verse 1, chorus, verse 2, chorus, breakdown section, final chorus (7 sections — no trailing outro/end tag)',
  T3: 'intro, verse 1, pre-chorus, chorus, verse 2, chorus, key-lift final chorus (7 sections, pre-chorus used only once — no trailing outro/end tag)',
  T4: 'instrumental hook intro (short instrumental restatement of the melody, no lyrics), verse 1, chorus, verse 2, chorus, chorus repeated a third time as the final chorus (no bridge, no pre-chorus) (6 sections — no trailing outro/end tag)',
  T5: 'a cappella hook intro, verse 1, chorus, verse 2, bridge, chorus, tagged final chorus (7 sections — no trailing outro/end tag)'
};

/**
 * TASK v3.43 Step 2 (Part A3) — the one literal, language-independent
 * bracket tag each non-default template (T2-T5) always renders somewhere in
 * its lyrics (see composeLyrics below — every other tag either comes from
 * the per-language `tags` table or is shared with T1). Used only to check a
 * Batch/bridge-imported song's lyrics actually followed its assigned
 * structureTemplate (core/batchPreallocation.ts's reconcileWithPreassignedSlot)
 * — T1 has no entry since it's the unmarked default/fallback shape, nothing
 * distinctive to check for.
 */
export const STRUCTURE_TEMPLATE_MARKER_TAG: Partial<Record<StructureTemplateId, string>> = {
  T2: '[hook intro]',
  T3: '[key-lift final chorus]',
  T4: '[instrumental hook]',
  T5: '[a cappella hook]'
};

const ADULT_STRUCTURE_TEMPLATES: StructureTemplateId[] = ['T1', 'T2', 'T3', 'T4', 'T5'];
/** Kids stays simpler per the spec's own caveat ("반복이 장르 특성이라 과도한 변주는 역효과") — no instrumental-hook/breakdown shapes, just enough rotation to clear the "min 3" bar. */
const KIDS_STRUCTURE_TEMPLATES: StructureTemplateId[] = ['T1', 'T3', 'T5'];

/**
 * Deterministic (seeded) per-trackNo structure-template plan, same shuffle-
 * then-repair shape as buildVocalPlan/buildHookDevicePlan: track 1 is always
 * pinned to 'T1' (cold-open keeps its own dedicated opening logic), every
 * other track rotates through the archetype-appropriate template list with
 * no two adjacent tracks sharing the same template.
 */
export function buildStructureTemplatePlan(songCount: number, seed: number, archetype?: ChannelArchetype): StructureTemplateId[] {
  if (songCount <= 0) return [];
  const pool = isKidsArchetype(archetype) ? KIDS_STRUCTURE_TEMPLATES : ADULT_STRUCTURE_TEMPLATES;
  const plan: StructureTemplateId[] = ['T1'];
  let lap = 0;
  while (plan.length < songCount) {
    plan.push(...shuffle(pool, seed + lap * 601));
    lap += 1;
  }
  plan.length = songCount;

  for (let i = 1; i < plan.length; i++) {
    if (plan[i] !== plan[i - 1]) continue;
    let swapIndex = -1;
    for (let j = i + 1; j < plan.length; j++) {
      if (plan[j] !== plan[i]) { swapIndex = j; break; }
    }
    if (swapIndex === -1) {
      for (let j = 1; j < i - 1; j++) {
        if (plan[j] !== plan[i]) { swapIndex = j; break; }
      }
    }
    if (swapIndex !== -1) {
      const tmp = plan[i];
      plan[i] = plan[swapIndex];
      plan[swapIndex] = tmp;
    }
  }
  return plan;
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
  /** TASK I1 (v3.11) — only meaningful when role === 'cold-open'; resolved concrete value ('auto' is resolved by the caller before this point). */
  openingStyle?: 'hook-forward' | 'hum-intro';
  /**
   * TASK H2 (v3.13) — already language-resolved genre-flavor images (see
   * GenrePack.lyricFlavorImages), used in exactly the 'situation' slot only,
   * so a genre change is audible in the lyrics without redesigning the
   * shared template pools. Absent/empty falls back to the pre-v3.13 generic
   * filler behavior.
   */
  genreFlavorImages?: string[];
  /** Concrete lyric images resolved from GenerationOptions.customConcept. */
  conceptImages?: string[];
  /** TASK v3.42 Part C — which section-tag shape to assemble into; defaults to 'T1' (the original/only pre-v3.42 shape) when omitted, so every existing caller/test keeps working unchanged. */
  structureTemplate?: StructureTemplateId;
  /**
   * TASK v3.70 (TASK C) — real listening feedback: every chorus in every
   * song bookended the hook (open AND close), so the same hook line sang
   * 6x/song and the pack's choruses all felt identically shaped. Only the
   * FINAL chorus still bookends now; every earlier chorus-type section gets
   * exactly one hook occurrence, at a position that varies per song (first
   * line / after the first dev line / last line) — see buildChorus below.
   * Defaults to 0 (first line) when omitted, so any existing caller/test
   * that doesn't pass this keeps the simplest, most predictable placement.
   */
  hookPositionVariant?: 0 | 1 | 2;
}

export interface ComposedLyrics {
  lyrics: string;
  hookPhrase: string;
}

/**
 * v4.4 (TASK A) — `hookGuard` (the song's own hook phrase) is a new,
 * additive collision check alongside the existing exact-duplicate `used`
 * check: a drawn line is also retried if it contains the hook/title text
 * as a substring. This is what let the chorusDev double-draw below (TASK
 * v4.4's own history, see buildChorus) be re-enabled — it was reverted
 * earlier because an extra freshFillerCtx() draw occasionally pulled in a
 * filler line whose own trailing words happened to match the hook/title
 * (tests/lyricEngine.test.ts's "[R1] lyrics never contain the full title
 * ... stuffed into an unrelated line"). Fixing the actual collision here
 * (rather than reverting the draw) means every other double-draw in this
 * file gets the same protection for free, not just chorusDev.
 */
function takeUniqueLines(pool: UniquePool<LineTemplate>, ctx: LyricLineCtx, used: Set<string>, hookGuard?: string, maxAttempts = 12): string[] {
  const lowerHook = hookGuard?.trim().toLowerCase();
  const collides = (line: string) => used.has(line) || (!!lowerHook && lowerHook.length >= 2 && line.toLowerCase().includes(lowerHook));
  let lines = pool.take()(ctx);
  for (let attempt = 0; lines.some(collides) && attempt < maxAttempts; attempt++) {
    lines = pool.take()(ctx);
  }
  lines.forEach(line => used.add(line));
  return lines;
}

/**
 * TASK v3.70 (TASK D) — real listening feedback: a hook sung mid-lyric in
 * literal Title Case ("You're Still Here, riding shotgun in my mind") reads
 * like a title announcement, not a natural sung line.
 *
 * Deliberately NOT applied to the stored `song.lyrics`/composeLyrics output:
 * core/quality.ts's checkHookQuality (and other downstream checks — the
 * compositionScorer, SRT sung-line extraction, hook-collision detection)
 * count/match the hook by searching for `song.hookPhrase` verbatim inside
 * `song.lyrics`; silently lowercasing the stored copy would make every one
 * of those checks see 0 occurrences and misfire. This is a display-only
 * transform instead — applied where lyrics are actually shown/copied for
 * pasting into Suno (see its call sites) — capitalizing the first letter of
 * the phrase and the standalone pronoun "I" (including in contractions —
 * "i'll"/"i'm"), lowercasing everything else. English/Latin-script only by
 * construction — Korean/Japanese hooks have no case distinction, so
 * toLowerCase() is a no-op on them and this returns them unchanged.
 */
export function hookForLyrics(hook: string): string {
  if (!hook) return hook;
  const lower = hook.toLowerCase();
  const firstLetterIndex = lower.search(/[a-z]/i);
  if (firstLetterIndex === -1) return lower;
  const capitalized = lower.slice(0, firstLetterIndex) + lower[firstLetterIndex].toUpperCase() + lower.slice(firstLetterIndex + 1);
  return capitalized.replace(/\bi\b/g, 'I');
}

/**
 * TASK v3.70 (TASK D) — presentation-layer pass: rewrites every line that IS
 * the hook (exact match, or the hook plus trailing sentence punctuation an
 * agent may have added) to sentence case, for the copy actually shown/copied
 * to the user. Never mutates the canonical `song.lyrics` this function's own
 * doc comment above explains why (see hookForLyrics). A no-op when hookPhrase
 * is blank or already reads the same either way (Korean/Japanese).
 */
export function renderLyricsForDisplay(lyrics: string, hookPhrase: string): string {
  if (!hookPhrase?.trim()) return lyrics;
  const sentenceCaseHook = hookForLyrics(hookPhrase);
  if (sentenceCaseHook === hookPhrase) return lyrics;
  return lyrics
    .split('\n')
    .map(line => {
      const leadingWs = line.slice(0, line.length - line.trimStart().length);
      const trimmed = line.trim();
      const trailingPunctMatch = /[.,!?]+$/.exec(trimmed);
      const trailingPunct = trailingPunctMatch?.[0] ?? '';
      const core = trailingPunct ? trimmed.slice(0, -trailingPunct.length) : trimmed;
      return core === hookPhrase ? `${leadingWs}${sentenceCaseHook}${trailingPunct}` : line;
    })
    .join('\n');
}

export function composeLyrics(input: LyricComposeInput): ComposedLyrics {
  const { language, season, title, hook, situation, motif, role, pools, openingStyle, genreFlavorImages, conceptImages, structureTemplate = 'T1' } = input;
  const t = tags[language];
  const isColdOpen = role === 'cold-open';

  const motifRng = mulberry32(hashSeed(`${title}::${hook}::motif-budget`));
  const secondarySlot = chooseSecondaryMotifSlot(motifRng);
  const realMotifChorusIndex = chooseRealMotifChorusIndex(motifRng);
  const seasonWord = seasonWordFor(season, language);
  // TASK H2 (v3.13) — every motif-bearing slot (both the one guaranteed
  // "real motif" occurrence and every filler occurrence) prefers the
  // selected genre's own imagery over the per-song recurringMotifs pick when
  // available. Measured: gating this to a single filler slot only changed
  // ~1 line per song (~3-4% of pack-wide line overlap); even gating it to
  // fillers only (leaving the one true-motif slot alone) landed at ~15-20%
  // (~80-85% overlap) — genre-bearing lines are a firm minority of a song's
  // ~24 content lines (hook repeats/prechorus/tags carry no motif variable
  // at all), so this is the full set of slots that can carry genre color at
  // all. recurringMotifs itself isn't archetype identity (it's a shared,
  // genre-agnostic image pool — archetype identity lives in the vocabulary
  // rules, channel vocal/promise, and the hook engine's archetype-scoped
  // banks), so replacing it with a more specific genre image for genres that
  // have one is a strict quality improvement, not a loss.
  const flavorImages = [...(genreFlavorImages || []), ...(conceptImages || [])];
  let flavorPick = 0;
  const pickFlavor = () => {
    // Keep the selected concept audible while allowing genre imagery to carry
    // its own identity across otherwise similar lyric templates.
    if (conceptImages && conceptImages.length && flavorPick++ % 3 === 1) {
      return conceptImages[Math.floor(motifRng() * conceptImages.length)];
    }
    return flavorImages.length
      ? flavorImages[Math.floor(motifRng() * flavorImages.length)]
      : motif;
  };
  const pickMotifOrFlavor = () => conceptImages && conceptImages.length
    ? conceptImages[Math.floor(motifRng() * conceptImages.length)]
    : pickFlavor();
  const ctxWith: LyricLineCtx = { season: seasonWord, situation, motif: pickMotifOrFlavor(), title, hook };
  const pickFiller = () => flavorImages.length
    ? pickFlavor()
    : pickMotifFiller(language, motifRng);
  const freshFillerCtx = (): LyricLineCtx => ({ season: seasonWord, situation, motif: pickFiller(), title, hook });
  const ctxFor = (slot: MotifSecondarySlot) => (slot === secondarySlot ? ctxWith : freshFillerCtx());
  const chorusDevCtx = (index: number) => (index === realMotifChorusIndex ? ctxWith : freshFillerCtx());

  // TASK v4.4 — mirrors situationLines' own doc comment just below: a second
  // universal (present in every template via verse1Block, present for every
  // role except shortOpenerRoles) draw to help close the same 215-230 gap.
  const opening = shortOpenerRoles(role)
    ? takeUniqueLines(pools.opening, ctxFor('opening'), pools.usedLines, hook).slice(0, 2)
    : [...takeUniqueLines(pools.opening, ctxFor('opening'), pools.usedLines, hook), ...takeUniqueLines(pools.opening, freshFillerCtx(), pools.usedLines, hook)];
  // TASK v4.4 — real measurement: local generation was landing 137-177
  // words/song against a 215-230 target (fullAudit.ts's own 'lyric_word_count'
  // item). v4.1 (TASK B) raised the English word-count target from the
  // v3.70-era 175-205 to 215-230 (data/audienceProfiles.ts's
  // lyricMetricsByLanguage), explicitly deferring the matching generation
  // recalibration to "v4.2" — which never actually happened (v4.2 shipped a
  // quality-threshold-basis registry, not a word-count fix). situationLines
  // (verse1's own filler block) is conditionally doubled below, per
  // structureTemplate (STRUCTURE_TEMPLATE_SECTION_NOTES): universal
  // doubling overshot 230 on T1 (pre-chorus AND bridge — the fullest
  // shape); T2 (a "breakdown section" instead of pre-chorus/bridge) was
  // also tried here first, but its own section already carries enough
  // content that boosting it overshot to 236-253. T3 (pre-chorus, no
  // bridge — my own bridge-widening boost above never reaches it) and T4
  // (neither pre-chorus nor bridge at all, 6 sections vs. every other
  // template's 7-8) are the two shapes still measuring short (197-206)
  // after the opening/verse2/bridge/chorus2 boosts above, and are the ones
  // boosted here. shortOpenerRoles excluded, same as opening above —
  // cold-open stays deliberately short.
  const boostSituationLines = (structureTemplate === 'T4' || structureTemplate === 'T3') && !shortOpenerRoles(role);
  const situationLines = boostSituationLines
    ? [...takeUniqueLines(pools.situation, ctxFor('situation'), pools.usedLines, hook), ...takeUniqueLines(pools.situation, freshFillerCtx(), pools.usedLines, hook)]
    : takeUniqueLines(pools.situation, ctxFor('situation'), pools.usedLines, hook);
  // TASK v4.4 — tried doubling this too, but a real test
  // (tests/hook.test.ts's own "[pre-chorus] section, when present, has
  // exactly 2 lines") caught a real structural contract this would have
  // broken — pre-chorus is meant to stay a tight 2-line setup into the
  // chorus, not a second verse-length stanza. Reverted; the word-count gap
  // is closed by opening/bridge (universal, no such contract) instead.
  const preChorusLines = takeUniqueLines(pools.preChorus, ctxWith, pools.usedLines, hook);
  // TASK v3.29 — a real 20-song sample (both local and remote-generated)
  // came back short enough to render at ~2:00-2:20 in Suno despite every
  // song targeting 2:50-3:20; local generation measured ~190 words/song on
  // average. One extra verse2 draw (same "draw the pool twice, second draw
  // gets a fresh filler context" pattern extendedBridgeRoles already uses
  // below) is enough to close that gap without restructuring the whole
  // template system.
  //
  // TASK v3.70 (TASK B) — measured the opposite problem for the REMOTE/
  // bridge path (songs running 30-60s too long) and lowered the word-count
  // target to 175-205 (promptComposer.ts's MIN_LYRIC_WORDS) accordingly —
  // but this local double-draw's own ~190-words/song baseline already sits
  // comfortably inside that new range, so it's left as-is rather than
  // reverted (an earlier attempt at reverting this dropped the local
  // average to ~170, under the new 175 floor — confirmed by this file's own
  // test, tests/lyricEngine.test.ts).
  //
  // TASK v4.4 — see situationLines' own doc comment just above: the same
  // gap this verse2 double-draw was meant to close reopened when the target
  // moved to 215-230 without a matching recalibration.
  const verse2 = [...takeUniqueLines(pools.verse2, ctxFor('verse2'), pools.usedLines, hook), ...takeUniqueLines(pools.verse2, freshFillerCtx(), pools.usedLines, hook)];

  // TASK v3.70 (TASK C) — real listening feedback: bookending EVERY
  // chorus-type section made the same hook line sing 6x/song (2x per
  // chorus x3), and always in the identical open+close shape. Only the
  // FINAL chorus still bookends (2 occurrences); each earlier chorus gets
  // exactly ONE hook occurrence, placed at a position that varies per song
  // (hookPositionVariant, derived from this song's own hookDevice pick —
  // see localGenerator.ts's call site — so position variation reuses the
  // existing per-song rotation instead of a new axis).
  const hookPosition = ((input.hookPositionVariant ?? 0) % 3 + 3) % 3;
  function placeHookOnce(devLines: string[]): string[] {
    if (hookPosition === 2) return [...devLines, hook]; // last line
    if (hookPosition === 1 && devLines.length > 1) return [devLines[0], hook, ...devLines.slice(1)]; // after the first dev line
    return [hook, ...devLines]; // first line (default, and line2's fallback when there's only one dev line)
  }
  // TASK v4.4 — doubling the second chorus's dev lines closed the
  // remaining 215-230 gap for templates with no pre-chorus/bridge (T2/T4),
  // but was reverted once (see takeUniqueLines' own doc comment) after a
  // real 30-song Korean/Japanese regression test caught an extra
  // freshFillerCtx() draw occasionally pulling in a filler line whose own
  // trailing words matched the hook/title. Re-enabled now that
  // takeUniqueLines itself guards against that collision (retries instead
  // of accepting a hook-colliding line) — the root cause is fixed rather
  // than the draw avoided.
  const buildChorus = (index: number, isFinal = false) => {
    const devLines = index === 1
      ? [...takeUniqueLines(pools.chorusDev, chorusDevCtx(index), pools.usedLines, hook), ...takeUniqueLines(pools.chorusDev, freshFillerCtx(), pools.usedLines, hook)]
      : takeUniqueLines(pools.chorusDev, chorusDevCtx(index), pools.usedLines, hook);
    return isFinal ? [hook, ...devLines, hook] : placeHookOnce(devLines);
  };
  const chorus1 = buildChorus(0);
  const chorus2 = buildChorus(1);

  // Even when 'bridge' is the budgeted secondary slot, an extended bridge draws
  // the pool twice — only the first draw gets the real motif so bridge never
  // contributes more than one real-motif occurrence on its own.
  // TASK v4.4 — was extendedBridgeRoles(role)-only (2 of 12 roles); widened
  // to every role for the same 215-230 gap (see situationLines' own doc
  // comment above) — T1/T5 templates are the only ones with a bridge
  // section at all, so this only affects tracks already using one.
  const bridgeLines = [...takeUniqueLines(pools.bridge, ctxFor('bridge'), pools.usedLines, hook), ...takeUniqueLines(pools.bridge, freshFillerCtx(), pools.usedLines, hook)];

  // TASK X5-2 (v3.4): 'comforting closer' used to fade out on a 3rd hook
  // repeat here, but a 30-song pack clamps every track past the 12th to
  // this exact role (songRoles[Math.min(idx, songRoles.length-1)] has no
  // wraparound), so 19/30 songs in a full pack hit that extra repeat —
  // pushing well past the 4-7 target. Every role's final chorus now bookends
  // with exactly 2 hooks, capping every song at 6 total regardless of role
  // or pack size.
  //
  // TASK v3.70 (TASK C) — that 4-7 target itself is now roughly 4 (1 + 1 +
  // 2, see buildChorus above), so the final chorus is the ONLY section this
  // task leaves bookended — every earlier chorus dropped to a single
  // occurrence.
  const finalChorusBase = buildChorus(2, true);
  const finalChorusLines = extendedFinalChorusTextRoles(role)
    // Closing is only used for this one role and is never part of the
    // motif budget, so it always renders with a filler noun.
    ? [...finalChorusBase, ...takeUniqueLines(pools.closing, freshFillerCtx(), pools.usedLines, hook)]
    : finalChorusBase;

  // TASK I1 (v3.11) — track 1 (cold-open) skips the standard instrumental
  // intro entirely. 'hook-forward' puts the hook itself, bare, in its own
  // [cold open] section right before verse 1 (the safe, proven technique —
  // see openingDurationText in localGenerator.ts for the matching style
  // prompt instruction). 'hum-intro' keeps the [intro] tag but replaces the
  // fixed instrumental description with a wordless-hum vocal direction; this
  // is the more experimental of the two (Suno isn't guaranteed to honor a
  // text meta-tag literally), which is why it's never the 'auto' default.
  //
  // TASK v3.58 (TASK 5-3) — the default (non-cold-open) branch used to be
  // [t.intro, introLine[language]], putting a plain descriptive sentence
  // ("Soft Rhodes, acoustic guitar, close warm vocal.") directly under the
  // instrumental-intro tag with no vocal-suppression marker, so Suno could
  // (and measurably did, 9/18 in a real pack) sing it as if it were a lyric
  // line. The tag now stands alone; the same instrumentation description is
  // already carried non-singably by the style prompt's own introTexture atom
  // (see introTexturePlan.ts / localGenerator.ts), so nothing is lost.
  const openingLines = isColdOpen && openingStyle === 'hook-forward'
    ? ['[cold open]', hook]
    : isColdOpen && openingStyle === 'hum-intro'
      ? [t.intro, WORDLESS_HUM_LINE]
      : [t.intro];

  // TASK v3.42 Part C — track 1 (cold-open) always keeps the original T1
  // shape regardless of what the pack's structure-template plan assigned it:
  // its own opening-technique logic (openingLines above) is a separate,
  // well-tested feature (TASK I1) this task doesn't touch.
  const effectiveTemplate: StructureTemplateId = isColdOpen ? 'T1' : structureTemplate;
  const verse1Block = [t.verse1, ...opening, ...(shortOpenerRoles(role) ? [] : ['', ...situationLines])];

  // TASK v3.70 (TASK B) — real listening feedback: 3:42-4:10 songs against a
  // 3:10-3:35 target, traced to 9-11 sections/song. Every template below now
  // ends at its final chorus — no trailing "" + t.end: the [end] tag reads
  // as nothing in Suno, and dropping it (plus, for T3, its old second
  // pre-chorus repeat) is exactly the section-count cut this task's own
  // measurement called for, with zero change to any genre/lyric-content
  // vocabulary (STRUCTURE_TEMPLATE_SECTION_NOTES above documents the same
  // shapes for the remote/bridge path).
  const lines: string[] =
    effectiveTemplate === 'T2'
      ? [
        '[hook intro]', hook, '',
        ...verse1Block, '',
        t.chorus, ...chorus1, '',
        t.verse2, ...verse2, '',
        t.chorus, ...chorus2, '',
        '[breakdown]', ...bridgeLines, '',
        t.finalChorus, ...finalChorusLines
      ]
      : effectiveTemplate === 'T3'
        ? [
          ...openingLines, '',
          ...verse1Block, '',
          t.preChorus, ...preChorusLines, '',
          t.chorus, ...chorus1, '',
          t.verse2, ...verse2, '',
          t.chorus, ...chorus2, '',
          '[key-lift final chorus]', ...finalChorusLines
        ]
        : effectiveTemplate === 'T4'
          ? [
            // TASK v3.42 Part C — verse2 kept at full length (not literally
            // shortened): an earlier version trimmed it to ~half, which
            // dropped this template's word count enough to pull the whole
            // pack's average under promptComposer.ts's MIN_LYRIC_WORDS floor
            // (TASK v3.29 — a real rendering-length regression). The "short"
            // shape instead comes from omitting pre-chorus/bridge entirely
            // and using [instrumental hook] + a 3rd [chorus] repeat in place
            // of a tagged final chorus.
            '[instrumental hook]', '(instrumental hook, band plays the melody, no lyrics, 2 bars)', '',
            ...verse1Block, '',
            t.chorus, ...chorus1, '',
            t.verse2, ...verse2, '',
            t.chorus, ...chorus2, '',
            t.chorus, ...finalChorusLines
          ]
          : effectiveTemplate === 'T5'
            ? [
              '[a cappella hook]', hook, '',
              ...verse1Block, '',
              t.chorus, ...chorus1, '',
              t.verse2, ...verse2, '',
              t.bridge, ...bridgeLines, '',
              t.chorus, ...chorus2, '',
              '[chorus tag]', ...finalChorusLines
            ]
            // T1 — original/default shape.
            : [
              ...openingLines, '',
              ...verse1Block, '',
              t.preChorus, ...preChorusLines, '',
              t.chorus, ...chorus1, '',
              t.verse2, ...verse2, '',
              t.chorus, ...chorus2, '',
              t.bridge, ...bridgeLines, '',
              t.finalChorus, ...finalChorusLines
            ];

  return { lyrics: lines.join('\n'), hookPhrase: hook };
}

// ---------------------------------------------------------------------------
// Hook engine (TASK A1/A2 v3.3) — the hook now IS the 2-4 word singable
// phrase, generated first; the title is derived from it (never the other
// way around), so title and hook can never drift apart (H2). Every phrase
// is hand-curated per grammatical shape instead of composed at runtime from
// arbitrary nouns, so a vocative slot can never end up addressing an object
// noun (H3) — that class of bug is impossible by construction, not caught
// by a runtime check.
// ---------------------------------------------------------------------------

export type HookShape = 'vocative' | 'imperative' | 'nounPhrase' | 'declarative';
export type SungHookShape = Exclude<HookShape, 'nounPhrase'>;
export type HookEmotionalWeight = 'medium' | 'high';
const ALL_HOOK_SHAPES: HookShape[] = ['vocative', 'imperative', 'nounPhrase', 'declarative'];
export const HOOK_SHAPES: SungHookShape[] = ['vocative', 'imperative', 'declarative'];

export interface HookSpec {
  phrase: string;
  syllables: number;
  isTitle: boolean;
  shape: HookShape;
  emotionalWeight: HookEmotionalWeight;
}

export interface HookContext {
  language: LyricLanguage;
  shape: HookShape;
  usedHooks: Set<string>;
  targetSyllables?: number;
  emotionalWeight?: HookEmotionalWeight;
  /** v3.4 — scopes both the premium tier (senior-morning only) and the combinatorial vocabulary. Undefined behaves like 'senior-morning'. */
  archetype?: ChannelArchetype;
}

// Vocative hooks only ever address a person/abstract noun, never an object —
// H3's entire bug class is prevented by simply never parameterizing this
// bank with the object-word list used elsewhere.
const enHookVocative = [
  'Hold On, My Friend', 'Stay a While, Darling', 'Close Your Eyes, Winter', 'Rest Here, My Love',
  'Wake Up, My Dear', 'Breathe with Me, Morning', 'Hold My Hand, Friend', 'Come Home Soon, Darling',
  'Hush Now, My Love', "Don't Go, Old Heart", "Don't Let Go of Me", 'Stay with Me Tonight'
];
const enHookImperative = [
  'Keep the Light On', 'Pour the Coffee Warm', 'Write One More Letter', 'Play the Old Record',
  'Catch the Morning Train', 'Light the Candle Again', 'Turn the Page Slowly', 'Share the Warm Umbrella',
  'Keep the Radio Playing', 'Hold the Photo Close', 'Wrap the Old Sweater', 'Wait by the Window',
  'Come Back to This Morning', 'Remember Me at Sunrise',
  // 정합성 점검 §7 결함8 fix — real measured cause: this hand-written
  // "premium" hook pool (preferred first, before the combinatorial
  // hookParts.ts layer — see premiumBankFor's own doc comment) is what a
  // real 18-song senior-morning pack's chorus hooks actually draw from,
  // each repeated ~4x within its own song by design. A real measured pack
  // showed pack-wide counts of quiet 67x/soft 67x/radio 52x/window 50x/
  // coffee 45x, all traceable to this exact 14-entry pool (Coffee/Radio/
  // Window above) — far past core/lyricVocabularyRepetition.ts's
  // WORD_BLOCKING_THRESHOLD (30). Purely additive, positionally mirrored in
  // koHookImperative/jaHookImperative below (same index = same meaning, per
  // this file's own established convention), deliberately avoiding
  // coffee/radio/window/quiet/soft/warm as each new entry's own word.
  'Save the Old Letter', 'Light the Evening Star', 'Walk the Garden Path', 'Keep the Blanket Near',
  'Turn the Photograph Over'
];
const enHookNounPhrase = [
  'Winter Window Light', 'Golden Sunset Train', 'Quiet Morning Coffee', 'Old December Letter',
  'First Snow Radio', 'Slow Sunday Sweater', 'Midnight Hour Candle', 'Soft Christmas Doorway',
  'Rainy Afternoon Record', 'New Year Umbrella',
  'Amber Evening Star', 'Faded Garden Letter', 'Long Autumn Bench', 'Blue Dusk Melody', 'Bright Sunday Blanket'
];
const enHookDeclarative = [
  "I'll Wait for Morning", "We'll Be Alright", 'I Remember You', "I'm Coming Home",
  "I Won't Forget", "You're Still Here", 'I Found My Way', 'We Made It Through',
  'I Still Believe', "I Know You're Near", 'I Still Hear Your Song', 'I Still Wait for You'
];

const koHookVocative = [
  '잠시 멈춰요, 내 친구', '눈을 감아요, 그대', '여기 있어요, 겨울아', '천천히 말해요, 내 사랑',
  '잠깐 쉬어요, 오랜 마음', '돌아와요, 내 사람', '가지 마요, 그대', '안아줘요, 겨울아',
  '기다려요, 내 친구', '쉬어가요, 그대여'
];
// TASK X4 (v3.4): '기차를 잡아요' (catch the train) read as a practical, urging
// instruction rather than a comforting invitation — replaced with '그 길을
// 걸어요' (walk that path), which keeps a wistful, unhurried tone.
const koHookImperative = [
  '불을 켜둬요', '커피를 데워요', '편지를 써봐요', '라디오를 틀어요', '그 길을 걸어요',
  '촛불을 다시 켜요', '창문을 열어둬요', '우산을 함께 써요', '사진을 꺼내봐요', '달력을 넘겨봐요',
  '스웨터를 껴입어요', '레코드를 틀어봐요',
  '편지를 간직해요', '저녁별을 밝혀요', '정원 길을 걸어요', '이불을 가까이 둬요', '사진을 다시 넘겨봐요'
];
const koHookNounPhrase = [
  '겨울 창가의 빛', '금빛 새벽 기차', '고요한 아침 커피', '12월의 오래된 편지', '첫눈 내리는 라디오',
  '느린 일요일 스웨터', '한밤의 촛불', '부드러운 크리스마스 문가', '비 오는 오후의 레코드', '새해의 작은 우산',
  '호박빛 저녁별', '빛바랜 정원의 편지', '긴 가을 벤치', '푸른 황혼의 노래', '밝은 일요일의 이불'
];
const koHookDeclarative = [
  '아침을 기다릴게요', '우리 함께 괜찮을 거예요', '너를 기억해요', '이제 집에 가요', '잊지 않을게요',
  '아직 여기 있어요', '다시 길을 찾았어요', '우리 함께 견뎠어요', '아직 그댈 믿어요', '가까이 있다는 걸 알아요'
];

const jaHookVocative = [
  '少し止まって、友よ', '目を閉じて、あなたへ', 'ここにいて、冬よ', 'ゆっくり休んで、愛しい人',
  '戻ってきて、友よ', '行かないで、あなたへ', '抱きしめて、冬よ', '待っていて、友よ',
  'そばにいて、愛しい人', '少し眠って、あなたへ'
];
// TASK X4 (v3.4): '列車に間に合って' (make it in time for the train) read as a
// practical, urging instruction rather than a comforting invitation —
// replaced with 'あの駅で待って' (wait at that station), which keeps the
// train/station imagery but reframes it as a gentle, unhurried wait.
const jaHookImperative = [
  '灯りをつけて', 'コーヒーを温めて', '手紙を書いて', 'ラジオをつけて', 'あの駅で待って',
  'キャンドルをまた灯して', '窓を開けて', '傘を一緒にさして', '写真を取り出して', 'カレンダーをめくって',
  'セーターを着て', 'レコードをかけて',
  '手紙を大事にして', '夕べの星を灯して', '庭の小道を歩いて', '毛布をそばに置いて', '写真をめくり返して'
];
const jaHookNounPhrase = [
  '冬の窓辺の光', '金色の夕暮れ列車', '静かな朝のコーヒー', '十二月の古い手紙', '初雪のラジオ',
  'ゆっくりな日曜のセーター', '真夜中のキャンドル', 'やわらかなクリスマスの戸口', '雨の午後のレコード', '新年の小さな傘',
  '琥珀色の夕べの星', '色あせた庭の手紙', '長い秋のベンチ', '青い黄昏のメロディ', '明るい日曜の毛布'
];
const jaHookDeclarative = [
  '朝を待っている', 'きっと大丈夫', 'あなたを覚えている', 'もう家に着く', '忘れたりしない',
  'まだここにいる', 'また道を見つけた', '一緒に乗り越えた', 'あなたを信じている', 'そばにいるとわかる'
];

/** Premium tier is senior-morning's own hand-written imagery (coffee, radio, letters) — only that archetype (and the two fallback archetypes with no vocabulary override) draw from it, so it never leaks into showa-cafe/kids and break the "hooks never overlap across archetypes" guarantee. */
const extraPremiumHooks: Record<Exclude<LyricLanguage, 'bilingual'>, Partial<Record<SungHookShape, string[]>>> = {
  english: {
    vocative: ["Don't Let Go of Me", 'Stay with Me Tonight'],
    imperative: ['Come Back to This Morning', 'Remember Me at Sunrise'],
    declarative: ['I Still Hear Your Song', 'I Still Wait for You']
  },
  korean: {
    vocative: ['잠시 쉬어 가요', '여기 있어 줘요', '천천히 와 줘요'],
    imperative: ['그날까지 기다려요', '다시 여기 와줘요', '이 아침을 안아줘요', '불을 조금 켜둬요', '커피를 따뜻이 둬요', '창문을 열어 둬요'],
    declarative: ['그 노래가 들려요', '그대를 잊지 않아요', '이 아침이 고마워요', '아침을 기다려요', '오늘도 기억해요', '마음이 쉬어 가요']
  },
  japanese: {
    vocative: ['少しここにいて', '朝までそばにいて', '静かに戻って', '戻ってきてほしい', '歌を聞いていて'],
    imperative: ['また朝に帰って', 'ここで待っていて', 'その声を抱いて', '灯りをつけていて', '窓辺で待っていて', 'ゆっくり歩いて'],
    declarative: ['あの歌が聞こえる', '忘れないでいる', 'また会えると信じる', 'あの歌を覚えてる', 'ここで息をして', '朝を待っている']
  }
};

function premiumBankFor(language: LyricLanguage, shape: HookShape, archetype?: ChannelArchetype): string[] {
  // TASK B2 — real measurement: this app's own combinatorial hookBanks/
  // kr2030.ts override (0 vocabulary overlap with the senior default bank)
  // was correctly wired, but 8/18 real generated titles STILL carried
  // senior imagery (겨울아/그대/촛불/달력/창문/오랜 마음) — because composeHook
  // always tries this hand-written PREMIUM tier first (see its own doc
  // comment: "premium first, then the archetype-scoped combinatorial
  // layer"), and this exclusion list — a 6th leak path this task's own §0-3
  // never found — only ever excluded showa-cafe/showa-70s/j2000s/kids, not
  // kr-2030-pop. 'senior-morning' (and any archetype not in this list —
  // oldpop-lounge/modern-chill/city-night included) keeps its exact
  // pre-existing behavior; only kr-2030-pop is newly added here.
  //
  // TASK C2 — same exact leak path, found independently for jp-2030-pop:
  // real 18-song generation with hookBanks/jp2030.ts fully wired (0
  // vocabulary overlap with both japaneseDefault and showaCafeOverride)
  // still produced 18/18 senior-imagery titles (ラジオをつけて, レコードをかけて,
  // 待っていて、友よ, ...) because this array was still missing 'jp-2030-pop' —
  // every premium-tier draw (this function's own hand-written jaHook*/
  // extraPremiumHooks.japanese banks below) kept winning before
  // jp2030Override's combinatorial layer ever got a turn. Added here,
  // mirroring kr-2030-pop exactly.
  // TASK K2 — same exact leak path, found independently for kr-idol-male:
  // real 18-song generation with hookBanks/krIdolMale.ts fully wired (0
  // vocabulary overlap with both koreanDefault and kr2030Override) still
  // produced titles like 라디오를 틀어요/레코드를 틀어봐요/스웨터를 껴입어요/촛불을
  // 다시 켜요/달력을 넘겨봐요 — because this array was still missing
  // 'kr-idol-male'. Added here, same reasoning as kr-2030-pop/jp-2030-pop.
  // TASK K3 — 'kr-idol-female' added proactively (K2's own §14-5 handoff
  // note flagged this exact gap in advance), same leak path.
  if (archetype === 'showa-cafe' || archetype === 'showa-70s' || archetype === 'j2000s' || isKidsArchetype(archetype) || archetype === 'kr-2030-pop' || archetype === 'jp-2030-pop' || archetype === 'kr-idol-male' || archetype === 'kr-idol-female') return [];
  const banks: Record<Exclude<LyricLanguage, 'bilingual'>, Record<HookShape, string[]>> = {
    english: { vocative: enHookVocative, imperative: enHookImperative, nounPhrase: enHookNounPhrase, declarative: enHookDeclarative },
    korean: { vocative: koHookVocative, imperative: koHookImperative, nounPhrase: koHookNounPhrase, declarative: koHookDeclarative },
    japanese: { vocative: jaHookVocative, imperative: jaHookImperative, nounPhrase: jaHookNounPhrase, declarative: jaHookDeclarative }
  };
  const resolved = language === 'bilingual' ? 'english' : language;
  const extra = shape === 'nounPhrase' ? [] : (extraPremiumHooks[resolved][shape] || []);
  return [...extra, ...banks[resolved][shape]];
}

/** English: whitespace word count (matches how a singer would count it). CJK phrases carry no reliable whitespace word boundary, so they always read as short by this metric — syllable/character count is the real singability signal for those languages. */
export function hookWordCount(phrase: string): number {
  return phrase.split(/\s+/).filter(Boolean).length;
}

export function estimateSyllables(phrase: string, language: LyricLanguage): number {
  if (language === 'korean') {
    return [...phrase].filter(ch => { const code = ch.charCodeAt(0); return code >= 0xac00 && code <= 0xd7a3; }).length;
  }
  if (language === 'japanese') {
    return [...phrase].filter(ch => /[\u3040-\u309f\u30a0-\u30ff\u3400-\u9fff]/u.test(ch)).length;
  }
  if (false) {
    return [...phrase].filter(ch => /[぀-ヿ一-鿿]/.test(ch)).length;
  }
  return phrase.split(/\s+/).filter(Boolean).reduce((total, word) => {
    const groups = word.toLowerCase().replace(/[^a-z']/g, '').match(/[aeiouy]+/g);
    return total + Math.max(1, groups ? groups.length : 1);
  }, 0);
}

/**
 * TASK X4 (v3.4) — a single length metric that means something in every
 * language: English hooks are judged by word count (2-5 words), but a
 * word-count check on Korean/Japanese either always reads as short
 * (Japanese has no whitespace word boundary) or miscounts (Korean spacing
 * doesn't track singable units the way syllables do). Korean uses syllable
 * count (Hangul blocks), Japanese uses mora/character count — both via the
 * existing estimateSyllables().
 */
export function hookLength(phrase: string, language: LyricLanguage): number {
  if (language === 'korean' || language === 'japanese') return estimateSyllables(phrase, language);
  return hookWordCount(phrase);
}

const HOOK_LENGTH_BOUNDS: Record<'english' | 'korean' | 'japanese', { min: number; max: number }> = {
  english: { min: 2, max: 5 },
  korean: { min: 4, max: 12 },
  japanese: { min: 5, max: 14 }
};

export function isWithinHookLengthBounds(phrase: string, language: LyricLanguage): boolean {
  const resolved = language === 'bilingual' ? 'english' : language;
  const bounds = HOOK_LENGTH_BOUNDS[resolved];
  const length = hookLength(phrase, language);
  return length >= bounds.min && length <= bounds.max;
}

export function hookRhythmLength(phrase: string, language: LyricLanguage): number {
  return estimateSyllables(phrase, language);
}

export function targetHookSyllables(language: LyricLanguage, seed: number): number {
  const resolved = language === 'bilingual' ? 'english' : language;
  void seed;
  return { english: 5, korean: 8, japanese: 8 }[resolved];
}

function isWithinTargetRhythm(phrase: string, language: LyricLanguage, targetSyllables?: number): boolean {
  if (!targetSyllables) return true;
  return Math.abs(hookRhythmLength(phrase, language) - targetSyllables) <= 1;
}

export function hookEmotionalWeight(phrase: string): HookEmotionalWeight {
  const normalized = phrase.toLowerCase();
  const highMarkers = [
    "don't let go",
    "don't go",
    'come back',
    'remember me',
    'still hear',
    'still wait',
    '그날까지',
    '다시 여기',
    '그 노래',
    '그대를 잊지',
    'また朝',
    'ここで待って',
    '戻ってきて',
    '歌を聞いて',
    'あの歌',
    '忘れないで',
    'また会える'
  ];
  return highMarkers.some(marker => normalized.includes(marker.toLowerCase())) ? 'high' : 'medium';
}

export function targetHookEmotionalWeight(role?: string): HookEmotionalWeight {
  if (!role) return 'medium';
  return /late-set emotional center|memory-focused late track|first nostalgic turn/i.test(role) ? 'high' : 'medium';
}

/** Distributes shapes as evenly as possible across a pack so 30 songs never lean on one shape (each shape gets >=15% for songCount >= 4). */
export function buildShapeSequence(songCount: number, seed: number): HookShape[] {
  const perShape = Math.floor(songCount / HOOK_SHAPES.length);
  const remainder = songCount % HOOK_SHAPES.length;
  const remainderOrder = shuffle(HOOK_SHAPES, seed);
  const sequence: HookShape[] = [];
  HOOK_SHAPES.forEach(shape => {
    const bonus = remainderOrder.indexOf(shape) < remainder ? 1 : 0;
    for (let i = 0; i < perShape + bonus; i++) sequence.push(shape);
  });
  return shuffle(sequence, seed + 999);
}

// ---------------------------------------------------------------------------
// TASK X2/X3 (v3.4) — combinatorial hook supply. The 42 premium hooks above
// are exhausted first (highest hand-checked quality); once a channel has
// used all of those for a shape, composeHook falls through to this
// archetype-scoped combinatorial layer (500+/language), so an 18-week x
// 12-song roadmap doesn't run out of unique titles by week 2.
// ---------------------------------------------------------------------------

function joinImperative(language: LyricLanguage, verb: string, object: string, tail: string): string {
  if (language === 'korean') return `${tail} ${object} ${verb}`;
  if (language === 'japanese') return `${object}${tail}${verb}`;
  return `${verb} ${object} ${tail}`;
}

function joinVocativeParts(language: LyricLanguage, lead: string, addressee: string): string {
  return language === 'japanese' ? `${lead}、${addressee}` : `${lead}, ${addressee}`;
}

function joinNounPhraseParts(language: LyricLanguage, modifier: string, object: string): string {
  return language === 'japanese' ? `${modifier}${object}` : `${modifier} ${object}`;
}

function joinDeclarativeParts(language: LyricLanguage, stem: string, tail: string): string {
  if (language === 'english') return `${stem} ${tail}`;
  if (language === 'japanese') return `${tail}${stem}`;
  return `${tail} ${stem}`;
}

/**
 * Full combinatorial expansion for one shape (at most a few hundred short
 * strings — cheap to generate fresh per call at this scale). Anything
 * outside the language's singable length bounds is dropped rather than
 * offered, since a bad verb/tail combination showing up as a hook is
 * exactly the "Pour the Morning On" failure mode TASK X2 warns about.
 */
export function combinatorialHookBank(shape: HookShape, parts: HookPartBank, language: LyricLanguage): string[] {
  const out: string[] = [];
  if (shape === 'imperative') {
    for (const verb of parts.imperativeVerbs) {
      for (const object of parts.imperativeObjects) {
        for (const tail of parts.imperativeTails) out.push(joinImperative(language, verb, object, tail));
      }
    }
  } else if (shape === 'vocative') {
    for (const lead of parts.vocativeLeads) {
      for (const addressee of parts.vocativeAddressees) out.push(joinVocativeParts(language, lead, addressee));
    }
  } else if (shape === 'nounPhrase') {
    for (const modifier of parts.nounModifiers) {
      for (const object of parts.nounObjects) out.push(joinNounPhraseParts(language, modifier, object));
    }
  } else {
    for (const stem of parts.declarativeStems) {
      for (const tail of parts.declarativeTails) out.push(joinDeclarativeParts(language, stem, tail));
    }
  }
  return out.filter(candidate => isWithinHookLengthBounds(candidate, language));
}

/**
 * TASK X1 (v3.4) — ctx.usedHooks now carries cross-pack history (see
 * core/hookLedger.ts), not just the current pack, so a channel can never
 * silently reuse a hook/title across two different generated packs. Draws
 * premium first, then the archetype-scoped combinatorial layer; if both
 * pools are fully exhausted for this channel+language+shape (extremely
 * unlikely at 500+ combinatorial entries, but possible after months of
 * heavy use), this throws a clear error rather than looping forever or
 * silently returning a duplicate.
 */
export function composeHook(seed: number, ctx: HookContext): HookSpec {
  const pickUnused = (candidates: string[], shuffleSeed: number) => shuffle(candidates, shuffleSeed).find(candidate => !ctx.usedHooks.has(candidate));
  const premium = premiumBankFor(ctx.language, ctx.shape, ctx.archetype);
  const weightedPremium = ctx.emotionalWeight
    ? premium.filter(candidate => hookEmotionalWeight(candidate) === ctx.emotionalWeight)
    : premium;
  const rhythmPremium = weightedPremium.filter(candidate => isWithinTargetRhythm(candidate, ctx.language, ctx.targetSyllables));
  const fallbackPremium = premium.filter(candidate => isWithinTargetRhythm(candidate, ctx.language, ctx.targetSyllables));
  let phrase =
    pickUnused(rhythmPremium, seed) ||
    pickUnused(fallbackPremium, seed + 1) ||
    pickUnused(weightedPremium, seed + 2) ||
    pickUnused(premium, seed + 3);

  if (!phrase) {
    const parts = resolveHookParts(ctx.language, overrideForArchetype(ctx.archetype, ctx.language));
    const combinatorial = combinatorialHookBank(ctx.shape, parts, ctx.language);
    const weightedCombinatorial = ctx.emotionalWeight
      ? combinatorial.filter(candidate => hookEmotionalWeight(candidate) === ctx.emotionalWeight)
      : combinatorial;
    const rhythmCombinatorial = weightedCombinatorial.filter(candidate => isWithinTargetRhythm(candidate, ctx.language, ctx.targetSyllables));
    const fallbackCombinatorial = combinatorial.filter(candidate => isWithinTargetRhythm(candidate, ctx.language, ctx.targetSyllables));
    phrase =
      pickUnused(rhythmCombinatorial, seed + 104729) ||
      pickUnused(fallbackCombinatorial, seed + 104730) ||
      pickUnused(weightedCombinatorial, seed + 104731) ||
      pickUnused(combinatorial, seed + 104732);
  }

  if (!phrase) {
    throw new Error(
      `훅 풀이 소진되었습니다 (${ctx.language} / ${ctx.shape} / ${ctx.archetype ?? 'senior-morning'}). 설정에서 오래된 팩의 훅 이력을 정리하거나 훅 뱅크를 확장하세요.`
    );
  }

  return {
    phrase,
    syllables: estimateSyllables(phrase, ctx.language),
    isTitle: ctx.shape !== 'vocative',
    shape: ctx.shape,
    emotionalWeight: hookEmotionalWeight(phrase)
  };
}

/** True if `phrase` came from the curated premium bank for `shape`; used by tests to verify shape distribution on real generated output. Combinatorial-origin hooks are matched separately (see matchesCombinatorialShape) since they aren't a fixed list. */
export function matchHookShape(phrase: string, language: LyricLanguage): HookShape | null {
  for (const shape of ALL_HOOK_SHAPES) {
    if (premiumBankFor(language, shape).includes(phrase)) return shape;
  }
  return null;
}

/** Recomputes the full combinatorial pool for every shape and checks membership — used by tests to classify a hook that didn't come from the premium bank. */
export function matchCombinatorialShape(phrase: string, language: LyricLanguage, archetype?: ChannelArchetype): HookShape | null {
  const parts = resolveHookParts(language, overrideForArchetype(archetype, language));
  for (const shape of ALL_HOOK_SHAPES) {
    if (combinatorialHookBank(shape, parts, language).includes(phrase)) return shape;
  }
  return null;
}

/** Total premium + combinatorial pool size for a channel+language — used for exhaustion-warning UI (core/hookLedger.ts's exhaustionStats). */
export function hookPoolSize(language: LyricLanguage, archetype?: ChannelArchetype): number {
  const parts = resolveHookParts(language, overrideForArchetype(archetype, language));
  return HOOK_SHAPES.reduce((total, shape) => {
    const pool = new Set([...premiumBankFor(language, shape, archetype), ...combinatorialHookBank(shape, parts, language)]);
    return total + pool.size;
  }, 0);
}

/**
 * Per-shape breakdown of hookPoolSize — v3.12's capacityPlanner needs this
 * rather than the flat total, because composeHook draws each shape from its
 * own independent pool (buildShapeSequence splits demand evenly across
 * HOOK_SHAPES, with no cross-shape fallback). A channel's real
 * weeks-to-exhaustion is bounded by its smallest per-shape pool, not by
 * poolSize / songsPerWeek — that naive division is exactly the mistake that
 * made v3.11's showa-cafe finding look inconsistent (368 total hooks read
 * like ~30 weeks of runway, but the 64-deep vocative/declarative pools ran
 * out at week 17 while imperative's 240-deep pool was barely touched).
 */
export function hookPoolSizeByShape(language: LyricLanguage, archetype?: ChannelArchetype): Record<HookShape, number> {
  const parts = resolveHookParts(language, overrideForArchetype(archetype, language));
  const out = { vocative: 0, imperative: 0, nounPhrase: 0, declarative: 0 } as Record<HookShape, number>;
  for (const shape of HOOK_SHAPES) {
    out[shape] = new Set([...premiumBankFor(language, shape, archetype), ...combinatorialHookBank(shape, parts, language)]).size;
  }
  return out;
}

/**
 * v4.2 (TASK A3 / TASK C) — weighted, era-filtered, cap-respecting pattern
 * pick from data/titlePatterns.ts's TITLE_PATTERNS. Replaces the old fixed
 * probability-roll cascade (image-pair 45-80% of the time, everything else
 * a leftover) — see titlePatterns.ts's own doc comment for the real
 * measurement that motivated this. `patternUsage` is mutated in place
 * (maxPerPattern is a cross-song constraint, not a per-call one) only on a
 * successful pick.
 */
function pickTitleFromPatterns(
  hook: HookSpec,
  seed: number,
  usedTitles: Set<string>,
  constraints: ResolvedConstraints,
  patternUsage: Map<string, number>
): string | null {
  const era = constraints.era;
  const eligible = TITLE_PATTERNS.filter(pattern => {
    if (constraints.title.forbiddenPatterns.includes(pattern.id)) return false;
    if ((patternUsage.get(pattern.id) ?? 0) >= constraints.title.maxPerPattern) return false;
    if (era.unspecified || !pattern.fitsEras?.length) return true;
    return pattern.fitsEras.includes(era.primary) || era.adjacent.some(adjacent => pattern.fitsEras!.includes(adjacent.era));
  });
  if (!eligible.length) return null;

  // Weighted shuffle: each pattern appears in the pre-shuffle pool
  // round(weight * 4) times (min 1), so a weight-1 pattern still gets a fair
  // turn against a weight-0.5 one (image-pair — see buildTitleConstraint)
  // without needing a full cumulative-distribution draw.
  const pool: typeof TITLE_PATTERNS = [];
  for (const pattern of eligible) {
    const weight = Math.max(1, Math.round((constraints.title.patternWeights[pattern.id] ?? 1) * 4));
    for (let i = 0; i < weight; i++) pool.push(pattern);
  }
  const seen = new Set<string>();
  const order: typeof TITLE_PATTERNS = [];
  for (const pattern of shuffle(pool, seed)) {
    if (seen.has(pattern.id)) continue;
    seen.add(pattern.id);
    order.push(pattern);
  }

  const kidsAudience = constraints.audienceProfileId === 'kids' || constraints.audienceProfileId.startsWith('kids-');
  for (const pattern of order) {
    const candidate = pattern.build({ hook, seed, usedTitles, kidsAudience });
    if (candidate && !usedTitles.has(candidate)) {
      patternUsage.set(pattern.id, (patternUsage.get(pattern.id) ?? 0) + 1);
      return candidate;
    }
  }
  return null;
}

/**
 * TASK v3.28 — the title used to always contain the hook verbatim; real
 * measurement showed that left almost no room to diverge. v4.2 (TASK A3)
 * replaced the old fixed-probability shape cascade with constraints-driven
 * pattern selection (see pickTitleFromPatterns above and data/
 * titlePatterns.ts) — `constraints` (not `archetype`) now decides which
 * title shapes are even eligible, so a 60s-concept pack and an 80s-concept
 * pack draw from different pattern mixes instead of the same one. Korean/
 * Japanese are untouched (still hook-verbatim, per this task's own "하지
 * 말 것: lyricEngine.ts의 문장 생성 로직을 건드리지 말 것" — word-level
 * stopword-stripping was never reliable without whitespace-delimited words,
 * and the old joinTitle() particle-appending caused the double-genitive
 * title bug fixed in v3.2; this never reintroduces that class of bug for
 * those languages).
 */
export function titleFromHook(
  hook: HookSpec,
  seed: number,
  language: LyricLanguage,
  usedTitles: Set<string>,
  constraints: ResolvedConstraints,
  /** Cross-song pattern-usage tally for constraints.title.maxPerPattern — createTitleGenerator threads its own persistent Map; a bare call (e.g. a test, or nextContestedTitle's one-off contest pick) gets a fresh one, i.e. no cross-call cap. */
  patternUsage: Map<string, number> = new Map()
): string {
  if (language !== 'english') {
    return uniqueTitle(hook.phrase, usedTitles);
  }
  return pickTitleFromPatterns(hook, seed, usedTitles, constraints, patternUsage) ?? uniqueTitle(hook.phrase, usedTitles);
}

/**
 * v4.2 (TASK A3) — fallback for callers that only ever passed `archetype`
 * (pre-A3 signature) and haven't been threaded through to a real
 * resolveConstraints() call yet. Empty conceptLabel means extractEraConstraint
 * finds no era signal, i.e. unspecified:true — the same "don't filter"
 * behavior those callers had before this task (no era filtering existed at
 * all pre-A3).
 */
function defaultConstraintsFor(archetype: ChannelArchetype | undefined, songCount: number): ResolvedConstraints {
  const audience = isKidsArchetype(archetype) ? KIDS_AUDIENCE_PROFILE : SENIOR_AUDIENCE_PROFILE;
  return resolveConstraints({ conceptLabel: '' }, { id: 'senior-oldpop' }, audience, songCount || 18);
}

export interface TitleResult {
  title: string;
  hook: string;
}

/**
 * TASK I2 (v3.11) — the callable signature every existing caller already
 * uses (`nextTitle(role)`), plus the generator's internal seed/shape/used-set
 * state exposed as properties on the function object. core/openingContest.ts
 * needs this shared mutable state to run a local multi-candidate contest for
 * tracks 1-3 using the exact same composeHook/titleFromHook/shape-sequence
 * machinery nextTitle() itself uses — without it, a contest-picked hook for
 * track 1 wouldn't be visible to nextTitle()'s own usedHooks set, risking a
 * collision on track 4+. `index` is a mutable property (not a plain closure
 * variable) for the same reason: a caller who bypasses nextTitle() for a
 * contested slot must still advance it, so the shape sequence stays aligned.
 */
export interface TitleGenerator {
  (role?: string): TitleResult;
  usedHooks: Set<string>;
  usedTitles: Set<string>;
  shapeSequence: HookShape[];
  rhythmTarget: number;
  seed: number;
  index: number;
  /** v4.2 (TASK A3) — cross-song per-title-pattern usage, so titleFromHook's constraints.title.maxPerPattern is enforced over this generator's whole lifetime (see nextContestedTitle, which also writes into this same map for tracks 1-3). */
  patternUsage: Map<string, number>;
}

/**
 * Compatibility wrapper over composeHook/titleFromHook/buildShapeSequence:
 * keeps the {title, hook} shape the rest of the codebase (and existing
 * tests) already depend on, while the hook is now the source of truth the
 * title is derived from instead of the reverse. songCount defaults to 30 to
 * match every existing caller's actual pack size. `archetype` still scopes
 * composeHook's own word-bank selection (untouched sentence-generation
 * concern); `constraints` (v4.2, TASK A3) scopes title-pattern selection —
 * see titleFromHook's own doc comment for why these are two separate axes.
 */
export function createTitleGenerator(
  language: LyricLanguage,
  seedBase: string,
  songCount = 30,
  avoid?: { usedTitles?: Iterable<string>; usedHooks?: Iterable<string> },
  archetype?: ChannelArchetype,
  constraints?: ResolvedConstraints
): TitleGenerator {
  const s = hashSeed(seedBase);
  const shapeSequence = buildShapeSequence(songCount, s + 31);
  const rhythmTarget = targetHookSyllables(language, s + 17);
  // Seeding with a caller-supplied avoid-set (e.g. the rest of the pack, or —
  // as of TASK X1 — this channel's cross-pack hook history) makes collisions
  // structurally impossible instead of hoping an independently-seeded draw
  // gets lucky.
  const usedHooks = new Set<string>(avoid?.usedHooks ?? []);
  const usedTitles = new Set<string>(avoid?.usedTitles ?? []);
  const resolvedConstraints = constraints ?? defaultConstraintsFor(archetype, songCount);

  const nextTitle: TitleGenerator = Object.assign(
    (role?: string): TitleResult => {
      const idx = nextTitle.index;
      const shape = nextTitle.shapeSequence[idx % nextTitle.shapeSequence.length] ?? HOOK_SHAPES[idx % HOOK_SHAPES.length];
      const hook = composeHook(nextTitle.seed + 41 + idx * 97, {
        language,
        shape,
        usedHooks: nextTitle.usedHooks,
        archetype,
        targetSyllables: nextTitle.rhythmTarget,
        emotionalWeight: targetHookEmotionalWeight(role)
      });
      nextTitle.usedHooks.add(hook.phrase);
      const title = titleFromHook(hook, nextTitle.seed + 53 + idx * 131, language, nextTitle.usedTitles, resolvedConstraints, nextTitle.patternUsage);
      nextTitle.usedTitles.add(title);
      nextTitle.index += 1;
      return { title, hook: hook.phrase };
    },
    { usedHooks, usedTitles, shapeSequence, rhythmTarget, seed: s, index: 0, patternUsage: new Map<string, number>() }
  );

  return nextTitle;
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

/**
 * 지시문 08 (TASK D) — real, confirmed finding: two different concepts on
 * the same channel/projectTitle produced byte-identical output (208/786
 * identical lyric lines, 6/18 identical titles, 17/18 identical scenes)
 * because this seed — shared by EVERY downstream rotation (theme/genre/
 * hook/vocal/BPM plans, all keyed off `hashSeed(seedForBlueprint(opts))`)
 * — never depended on `customConcept`, only `channel.id`/`projectTitle`. A
 * first attempt appended customConcept here directly; real measurement
 * confirmed it fixes the duplication, but its blast radius (every one of
 * the 5 call sites listed below, i.e. genre/hook/BPM/vocal-combo rotation
 * too, not just lyric themes) broke ~20 existing tests whose exact
 * expected values were implicitly calibrated against the old seed formula
 * — recalibrating those safely means individually verifying each new
 * value is an intentional improvement, not just "make the test pass",
 * which is real, necessary follow-up work beyond this session's scope.
 * Reverted to the original 2-field formula; the actual, non-regressing fix
 * threads a concept-aware seed only into the ONE place duplication was
 * actually measured (core/lyricDiversityPlan.ts's buildLyricThemePlan —
 * see localGenerator.ts's own lyricThemeSeed) rather than the shared
 * pipeline-wide seed every other subsystem also depends on.
 */
export function seedForBlueprint(opts: Pick<GenerationOptions, 'channel' | 'projectTitle'>) {
  return `${opts.channel.id}:${opts.projectTitle}`;
}

/**
 * TASK v3.27 (Part A3) — letting a remote model/coding agent write its own
 * title (see GenerationOptions.titleMode) reopens a collision risk
 * preallocateSongSlots existed specifically to close for titles: two
 * parallel chunks (or a Batch API sub-batch, or a Claude Code run) can't see
 * each other's real output, so nothing stops both from independently landing
 * on the same title. hookPhrase never has this problem (still always
 * locally pre-decided, see reconcileWithPreassignedSlot) — this is title-only,
 * run once against the whole assembled pack (plus the channel's cross-pack
 * title history) after every chunk/sub-batch/import has already landed.
 * Suffix-style disambiguation ("Reprise", "Part II", ...) mirrors real album
 * conventions rather than reading like an error message pasted into a title.
 */
const TITLE_DEDUP_SUFFIXES = ['Reprise', 'Again', 'Part II', 'Revisited', 'Once More'];

export interface TitleDedupResult {
  songs: SongIdea[];
  changedTrackNos: number[];
}

export function dedupeTitlesAcrossPack(songs: SongIdea[], avoidTitles: string[] = []): TitleDedupResult {
  const seen = new Set(avoidTitles.map(title => stripSetTitlePrefix(title).trim().toLowerCase()));
  const changedTrackNos: number[] = [];

  const result = songs.map(song => {
    const key = stripSetTitlePrefix(song.title).trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      return song;
    }

    let candidate = song.title;
    let candidateKey = key;
    for (const suffix of TITLE_DEDUP_SUFFIXES) {
      candidate = `${song.title} (${suffix})`;
      candidateKey = stripSetTitlePrefix(candidate).trim().toLowerCase();
      if (!seen.has(candidateKey)) break;
    }
    let n = 2;
    while (seen.has(candidateKey)) {
      candidate = `${song.title} (${n})`;
      candidateKey = stripSetTitlePrefix(candidate).trim().toLowerCase();
      n += 1;
    }

    seen.add(candidateKey);
    changedTrackNos.push(song.trackNo);
    return {
      ...song,
      title: candidate,
      warnings: [...song.warnings, 'Title duplicated another title in this pack or the channel\'s history — auto-uniquified.']
    };
  });

  return { songs: result, changedTrackNos };
}
