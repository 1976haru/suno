import type { LyricLanguage, WorkspaceId } from '../types';
import type { EraBucket } from './eraExclusions';

/**
 * v4.2 (TASK A3 / TASK D) — real measurement: a real 18-song pack repeated
 * "every" 55x (3x/song), "light" 39x, "nothing" 39x — core/
 * lyricVocabularyRepetition.ts already caps and flags this pack-wide
 * (GENERIC_WORD_CAP/CHANNEL_IDENTITY_WORD_CAP, since v3.64 TASK A), but that
 * module only detects overuse after the fact; nothing upstream steered word
 * *choice* toward the concept at all — one flat, always-shared vocabulary
 * regardless of whether the concept said "60년대 젊은 시절" or "조용한 아침".
 * This file is the missing upstream half: named, era/workspace-scoped word
 * pools a concept can be matched against. Per this task's own §5-3/§11 and
 * its "하지 말 것" (lyricEngine.ts의 문장 생성 로직을 건드리지 말 것), these
 * pools are wired into core/constraints.ts's resolveConstraints() (which
 * concept keywords/era select from) but NOT yet spliced into the hook/lyric
 * sentence-generation word lists themselves — see docs/v4.2-a3-report.md
 * for what's implemented vs. what's data-only pending B1/D1's own workspace
 * builds.
 */
export interface VocabularyBank {
  id: string;
  labelKo: string;
  fitsEras?: EraBucket[];
  fitsWorkspaces?: WorkspaceId[];
  /**
   * v4.5 (TASK C) — data/lyricThemes.ts's LyricTheme.frameId this bank
   * pairs with (see bridgeInstruction.ts's LYRIC_FRAME_LABEL for the full
   * frame list) — the axis that actually matters for "does the vocabulary
   * match the scene", unlike fitsEras/fitsWorkspaces above which only ever
   * scoped by decade/workspace regardless of what's happening in the scene.
   * A bank with no fitsFrames (e.g. 'seasonal') is frame-agnostic and can
   * pair with any scene.
   */
  fitsFrames?: string[];
  /** v4.5 (TASK C) — data/lyricThemes.ts's LyricTheme.motionKo this bank pairs with, for banks whose fit is about motion/energy rather than a fixed frame (e.g. 'dance-night' fits any scene with motionKo '춤'). */
  fitsMotions?: string[];
  nouns: string[];
  verbs: string[];
  adjectives: string[];
  /** Words this bank's own concept should avoid even though they're common English vocabulary (e.g. a 1960s bank avoiding "digital"). */
  avoid: string[];
  /**
   * 정합성 감사 2026-08-23 (유형 D, 높음) 후속 — core/localGenerator.ts는
   * `nouns`(영어 전용) 중 최대 2개를 sceneVocabImages로 뽑아 genreFlavorImages에
   * 그대로 합쳐 가사 본문에 꽂는다(phraseFor 같은 언어 변환 없이). kr-2030/
   * kr-idol-male/kr-idol-female처럼 lyricLanguage가 korean인 워크스페이스,
   * jp-2030처럼 japanese인 워크스페이스에서 이 결함이 실제로 영어 명사가
   * 한국어/일본어 가사에 섞여 나오는 원인이었다. `nouns`와 정확히 같은
   * 길이·순서로 자연스러운 한국어/일본어 번역을 병렬로 제공하면
   * nounsForLanguage(vocabularyBanks.ts)가 언어에 맞는 배열을 고른다 — 둘 다
   * 없는 뱅크(영어 lyricLanguage 워크스페이스용, 이미 한국어/일본어 원어인
   * kr-kids/jp-kids 뱅크)는 기존 `nouns` 그대로 폴백해 동작이 바뀌지 않는다.
   */
  nounsKo?: string[];
  nounsJa?: string[];
}

/**
 * 정합성 감사 2026-08-23 (유형 D, 높음) 후속 — VocabularyBank.nounsKo/nounsJa의
 * 실제 소비 지점. 요청 언어에 맞는 병렬 번역 배열이 있으면 그것을, 없으면
 * (길이가 안 맞거나 아예 없으면) 안전하게 기존 `nouns`로 폴백한다 — 번역이
 * 아직 없는 뱅크의 동작을 절대 깨뜨리지 않는다.
 */
export function nounsForLanguage(bank: VocabularyBank, language: LyricLanguage): string[] {
  if (language === 'korean' && bank.nounsKo?.length === bank.nouns.length) return bank.nounsKo;
  if (language === 'japanese' && bank.nounsJa?.length === bank.nouns.length) return bank.nounsJa;
  return bank.nouns;
}

export const SENIOR_VOCABULARY_BANKS: VocabularyBank[] = [
  {
    id: '1960s-youth',
    labelKo: '1960년대 젊은 시절',
    fitsEras: ['1950s-60s'],
    fitsWorkspaces: ['senior-oldpop'],
    nouns: ['dance hall', 'jukebox', 'letter', 'platform', 'transistor radio', 'soda fountain', 'record sleeve', 'street corner'],
    verbs: ['twist', 'wave', 'write', 'wait', 'catch the train', 'spin the record'],
    adjectives: ['golden', 'bright', 'young', 'restless', 'hopeful'],
    avoid: ['digital', 'screen', 'download']
  },
  {
    id: '1970s-domestic',
    labelKo: '1970년대 일상',
    fitsEras: ['1970s'],
    fitsWorkspaces: ['senior-oldpop'],
    nouns: ['kitchen', 'porch', 'kettle', 'album', 'cardigan', 'garden gate', 'evening paper', 'radio dial'],
    verbs: ['simmer', 'mend', 'water the garden', 'set the table', 'hum along'],
    adjectives: ['warm', 'quiet', 'settled', 'familiar', 'unhurried'],
    avoid: ['app', 'wireless', 'stream']
  },
  {
    id: 'seasonal',
    labelKo: '계절',
    fitsWorkspaces: ['senior-oldpop'],
    nouns: ['frost', 'blossom', 'rain', 'snow', 'harvest', 'first light', 'long shadow'],
    verbs: ['bloom', 'fall', 'thaw', 'settle', 'drift'],
    adjectives: ['crisp', 'mellow', 'fading', 'fresh'],
    avoid: []
  },
  {
    id: 'emotional',
    labelKo: '정서',
    fitsWorkspaces: ['senior-oldpop'],
    nouns: ['promise', 'courage', 'farewell', 'homecoming', 'memory', 'quiet joy'],
    verbs: ['remember', 'forgive', 'hold on', 'let go', 'return'],
    adjectives: ['tender', 'steady', 'grateful', 'wistful'],
    avoid: []
  },
  // -------------------------------------------------------------------------
  // v4.5 (TASK C) — scene/motion-based banks, added because the four banks
  // above are all era/mood axes, never "what is physically happening in
  // this scene" — a real measurement found a concept naming a scene with
  // real motion (dancing) still produced quiet/strum/worn-dominated
  // vocabulary, because nothing in this app's vocabulary system was keyed
  // to scene/motion at all until now. See core/bridgeInstruction.ts's
  // vocabularyBankInstructionLineFor for how these actually reach
  // generation (per-track "words to use / avoid" reference list — never a
  // checklist to paste in verbatim, see that function's own doc comment).
  // -------------------------------------------------------------------------
  {
    id: 'dance-night',
    labelKo: '댄스홀·토요일 밤·네온',
    fitsWorkspaces: ['senior-oldpop'],
    fitsFrames: ['dance-saturday'],
    fitsMotions: ['춤'],
    nouns: ['dance floor', 'band', 'spotlight', 'heel', 'ribbon', 'record', 'crowd', 'neon'],
    verbs: ['spin', 'sway', 'laugh', 'twirl', 'call', 'cheer', 'glide'],
    adjectives: ['crowded', 'bright', 'loud', 'dizzy', 'warm'],
    avoid: ['quiet', 'alone', 'still', 'faded', 'worn']
  },
  {
    id: 'summer-drive',
    labelKo: '드라이브·바닷가·여름밤',
    fitsWorkspaces: ['senior-oldpop'],
    fitsFrames: ['travel-window', 'summer-night'],
    nouns: ['highway', 'windshield', 'radio dial', 'salt air', 'tail light', 'boardwalk'],
    verbs: ['drive', 'roll down', 'sing along', 'race', 'wander'],
    adjectives: ['open', 'humid', 'endless', 'golden'],
    avoid: ['quiet', 'alone', 'still']
  },
  {
    id: 'young-romance',
    labelKo: '첫사랑·설렘·고백',
    fitsWorkspaces: ['senior-oldpop'],
    fitsFrames: ['young-first-love'],
    nouns: ['letter', 'doorway', 'corner', 'ring', 'photograph', 'bench'],
    verbs: ['wait', 'blush', 'whisper', 'promise', 'hold'],
    adjectives: ['nervous', 'new', 'bright', 'breathless'],
    avoid: ['faded', 'worn']
  },
  {
    id: 'reunion-parting',
    labelKo: '재회·이별·기차역',
    fitsWorkspaces: ['senior-oldpop'],
    fitsFrames: ['reunion-parting'],
    nouns: ['platform', 'whistle', 'suitcase', 'gate', 'timetable'],
    verbs: ['run', 'wave', 'return', 'hold on', 'let go'],
    adjectives: ['sudden', 'long-awaited', 'bittersweet'],
    avoid: []
  },
  {
    id: 'city-night',
    labelKo: '도시의 밤·극장·번화가',
    fitsWorkspaces: ['senior-oldpop'],
    fitsFrames: ['city-lights'],
    nouns: ['marquee', 'streetlight', 'taxi', 'window display', 'jukebox'],
    verbs: ['walk', 'glance', 'meet', 'linger'],
    adjectives: ['electric', 'late', 'glittering'],
    avoid: ['quiet', 'still']
  },
  {
    id: 'gathering',
    labelKo: '식탁·모임·친구',
    fitsWorkspaces: ['senior-oldpop'],
    fitsFrames: ['shared-table'],
    nouns: ['table', 'dish', 'chair', 'glass', 'doorway', 'laughter'],
    verbs: ['gather', 'pass', 'toast', 'tease', 'remember together'],
    adjectives: ['full', 'noisy', 'generous'],
    avoid: ['alone', 'empty']
  },
  {
    id: 'quiet-morning',
    labelKo: '조용한 아침·창가·회상',
    fitsWorkspaces: ['senior-oldpop'],
    fitsFrames: ['solitary-object', 'letter-sending'],
    nouns: ['window', 'cup', 'kettle', 'letter', 'curtain'],
    verbs: ['sit', 'watch', 'fold', 'wait'],
    adjectives: ['quiet', 'soft', 'still', 'warm'],
    avoid: []
  }
];

/**
 * v5.7 (TASK G) — real audit finding: `vocabularyBankForScene` already had a
 * `workspaceId` parameter (below) and workspace-scoping logic, but every
 * bank in this file had `fitsWorkspaces: ['senior-oldpop']`, and its real
 * caller (core/localGenerator.ts) never passed a workspaceId at all — so
 * kr-2030/jp-2030/kr-idol-* always drew from the full unscoped senior bank
 * list. These 4 new bank sets, plus the localGenerator.ts fix that now
 * passes a real workspaceId, close that gap. fitsFrames values match each
 * workspace's own real data/lyricThemes.ts frameId vocabulary exactly (see
 * that file's own B2/C2/K2/K3 doc comments for the full frame lists) so a
 * scene actually resolves to workspace-appropriate words, not just
 * workspace-appropriate by coincidence.
 */
const KR_2030_VOCABULARY_BANKS: VocabularyBank[] = [
  {
    id: 'kr2030-commute-drive',
    labelKo: '한국 2030 — 퇴근길·드라이브',
    fitsWorkspaces: ['kr-2030'],
    fitsFrames: ['commute-transit', 'night-drive'],
    nouns: ['subway car', 'earbuds', 'night bus', 'river road', 'streetlight', 'phone screen'],
    nounsKo: ['지하철', '이어폰', '심야버스', '강변도로', '가로등', '휴대폰 화면'],
    verbs: ['ride', 'scroll', 'drive', 'cruise', 'step off'],
    adjectives: ['dim', 'tired', 'restless', 'open'],
    avoid: ['radio', 'curtain', 'kettle']
  },
  {
    id: 'kr2030-solitary-room',
    labelKo: '한국 2030 — 원룸·혼자',
    fitsWorkspaces: ['kr-2030'],
    fitsFrames: ['solitary-room', 'screen-memory'],
    nouns: ['studio apartment', 'takeout container', 'lamp', 'laptop screen', 'city lights'],
    nounsKo: ['원룸', '포장 용기', '스탠드', '노트북 화면', '도시의 불빛'],
    verbs: ['sit', 'watch', 'scroll back', 'exhale'],
    adjectives: ['small', 'quiet', 'alone', 'nostalgic'],
    avoid: ['radio', 'curtain', 'kettle']
  },
  {
    id: 'kr2030-threshold',
    labelKo: '한국 2030 — 갈림길·결정',
    fitsWorkspaces: ['kr-2030'],
    fitsFrames: ['threshold-decision'],
    nouns: ['resignation email', 'packed bag', 'cursor', 'doorway'],
    nounsKo: ['사직 메일', '짐 가방', '커서', '현관'],
    verbs: ['hesitate', 'decide', 'pack', 'send'],
    adjectives: ['uncertain', 'determined', 'nervous'],
    avoid: []
  },
  {
    id: 'kr2030-two-people',
    labelKo: '한국 2030 — 대화·재회',
    fitsWorkspaces: ['kr-2030'],
    fitsFrames: ['two-people-talk', 'reunion-passing'],
    nouns: ['late-night table', 'shared glass', 'crosswalk', 'crowded street'],
    nounsKo: ['늦은 밤 테이블', '나눠 마신 잔', '횡단보도', '붐비는 거리'],
    verbs: ['confess', 'catch up', 'text', 'cross paths'],
    adjectives: ['warm', 'awkward', 'honest', 'fleeting'],
    avoid: []
  },
  {
    id: 'kr2030-everyday',
    labelKo: '한국 2030 — 일상 전반 (기본값)',
    fitsWorkspaces: ['kr-2030'],
    nouns: ['alley', 'convenience store', 'delivery bike', 'company dinner'],
    nounsKo: ['골목', '편의점', '배달 오토바이', '회식'],
    verbs: ['pass by', 'smile along', 'walk'],
    adjectives: ['ordinary', 'tired', 'hopeful'],
    avoid: ['radio', 'curtain', 'kettle', 'grandchildren']
  }
];

const JP_2030_VOCABULARY_BANKS: VocabularyBank[] = [
  {
    id: 'jp2030-seasonal-narrative',
    labelKo: '일본 2030 — 계절·전환점',
    fitsWorkspaces: ['jp-2030'],
    fitsFrames: ['seasonal-marker', 'narrative-arc'],
    nouns: ['cherry blossom', 'graduation gate', 'season change', 'new chapter'],
    nounsJa: ['桜', '卒業の門', '季節の変わり目', '新しい章'],
    verbs: ['bloom', 'depart', 'begin again'],
    adjectives: ['fleeting', 'hopeful', 'bittersweet'],
    avoid: []
  },
  {
    id: 'jp2030-inner-affirmation',
    labelKo: '일본 2030 — 내면·자기 확신',
    fitsWorkspaces: ['jp-2030'],
    fitsFrames: ['inner-monologue', 'self-affirmation'],
    nouns: ['mirror', 'quiet room', 'notebook', 'inner voice'],
    nounsJa: ['鏡', '静かな部屋', 'ノート', '心の声'],
    verbs: ['whisper to yourself', 'decide', 'stand tall', 'breathe'],
    adjectives: ['quiet', 'resolute', 'steady'],
    avoid: []
  },
  {
    id: 'jp2030-night-solitary',
    labelKo: '일본 2030 — 밤·홀로',
    fitsWorkspaces: ['jp-2030'],
    fitsFrames: ['solitary-room', 'night-drive', 'parallel-world'],
    nouns: ['city skyline', 'night road', 'glass window', 'another version of me'],
    nounsJa: ['街のスカイライン', '夜の道', 'ガラス窓', 'もう一人の自分'],
    verbs: ['drive', 'wonder', 'drift', 'imagine'],
    adjectives: ['quiet', 'distant', 'wondering'],
    avoid: ['curtain']
  },
  {
    id: 'jp2030-crowd-memory',
    labelKo: '일본 2030 — 축제·추억',
    fitsWorkspaces: ['jp-2030'],
    fitsFrames: ['school-memory', 'festival-crowd'],
    nouns: ['gymnasium', 'festival crowd', 'fireworks', 'yukata', 'classmates'],
    nounsJa: ['体育館', '祭りの人混み', '花火', '浴衣', 'クラスメイト'],
    verbs: ['gather', 'cheer', 'remember', 'laugh together'],
    adjectives: ['nostalgic', 'joyful', 'crowded'],
    avoid: []
  },
  {
    id: 'jp2030-everyday',
    labelKo: '일본 2030 — 일상 전반 (기본값)',
    fitsWorkspaces: ['jp-2030'],
    nouns: ['station', 'convenience store', 'evening train', 'city street'],
    nounsJa: ['駅', 'コンビニ', '夕方の電車', '街の通り'],
    verbs: ['walk', 'pass by', 'wait'],
    adjectives: ['ordinary', 'gentle', 'hopeful'],
    avoid: ['radio', 'curtain']
  }
];

/** v5.7 (TASK G) — shared by kr-idol-male/kr-idol-female is deliberately NOT done here (unlike krIdolPools in lyricEngine.ts): each workspace's own data/lyricThemes.ts frameId set is explicitly disjoint by K3's own "0 overlap" design (§5-2), so the words a scene actually needs genuinely differ (무대/조명/투어버스 vs 거리/일출/우정), unlike sentence grammar which stays identical either way. */
const KR_IDOL_MALE_VOCABULARY_BANKS: VocabularyBank[] = [
  {
    id: 'kridol-m-stage',
    labelKo: '한국 남자 아이돌 — 무대·선언',
    fitsWorkspaces: ['kr-idol-male'],
    fitsFrames: ['stage-declaration', 'backstage-before', 'promise-made'],
    nouns: ['spotlight', 'stage', 'countdown clock', 'crowd roar', 'microphone'],
    nounsKo: ['스포트라이트', '무대', '카운트다운 시계', '함성', '마이크'],
    verbs: ['step out', 'bow', 'promise', 'shine'],
    adjectives: ['confident', 'electric', 'ready'],
    avoid: []
  },
  {
    id: 'kridol-m-grind',
    labelKo: '한국 남자 아이돌 — 연습·한계',
    fitsWorkspaces: ['kr-idol-male'],
    fitsFrames: ['rehearsal-grind', 'turning-point'],
    nouns: ['practice room mirror', 'eight-count', 'sweat', 'exhaustion'],
    nounsKo: ['연습실 거울', '에잇카운트', '땀', '지친 몸'],
    verbs: ['push through', 'repeat', 'break through'],
    adjectives: ['relentless', 'stubborn', 'hard-won'],
    avoid: []
  },
  {
    id: 'kridol-m-crew-road',
    labelKo: '한국 남자 아이돌 — 크루·투어',
    fitsWorkspaces: ['kr-idol-male'],
    fitsFrames: ['crew-together', 'night-city-move'],
    nouns: ['tour bus window', 'formation line', 'city skyline', 'crew'],
    nounsKo: ['투어버스 창밖', '대형', '도시의 스카이라인', '크루'],
    verbs: ['sync', 'ride', 'move together'],
    adjectives: ['united', 'in motion', 'wide-eyed'],
    avoid: []
  },
  {
    id: 'kridol-m-focus',
    labelKo: '한국 남자 아이돌 — 시선·엇갈림 (기본값)',
    fitsWorkspaces: ['kr-idol-male'],
    fitsFrames: ['chase-focus', 'crossed-paths'],
    nouns: ['crowded room', 'crossed platform', 'departure gate'],
    nounsKo: ['붐비는 공간', '엇갈린 플랫폼', '출국 게이트'],
    verbs: ['scan', 'wave', 'lock eyes'],
    adjectives: ['sudden', 'wistful', 'focused'],
    avoid: []
  }
];

const KR_IDOL_FEMALE_VOCABULARY_BANKS: VocabularyBank[] = [
  {
    id: 'kridol-f-direction',
    labelKo: '한국 여자 아이돌 — 방향·확신',
    fitsWorkspaces: ['kr-idol-female'],
    fitsFrames: ['self-direction', 'unshaken-ground', 'leading-the-approach'],
    nouns: ['crossroads', 'own path', 'compass', 'steady ground'],
    nounsKo: ['갈림길', '나만의 길', '나침반', '단단한 땅'],
    verbs: ['choose', 'stand firm', 'lead'],
    adjectives: ['certain', 'unshaken', 'deliberate'],
    avoid: []
  },
  {
    id: 'kridol-f-social',
    labelKo: '한국 여자 아이돌 — 거리·우정',
    fitsWorkspaces: ['kr-idol-female'],
    fitsFrames: ['gaze-passed', 'friends-line', 'daylight-city'],
    nouns: ['crowded street', 'daylight skyline', 'circle of friends'],
    nounsKo: ['붐비는 거리', '햇살 아래 스카이라인', '친구들의 원'],
    verbs: ['walk past', 'gather', 'support'],
    adjectives: ['confident', 'bright', 'easy'],
    avoid: []
  },
  {
    id: 'kridol-f-release',
    labelKo: '한국 여자 아이돌 — 정리·해방',
    fitsWorkspaces: ['kr-idol-female'],
    fitsFrames: ['direct-release', 'clean-break'],
    nouns: ['clean break', 'open door', 'clear sky'],
    nounsKo: ['깔끔한 이별', '열린 문', '맑은 하늘'],
    verbs: ['let go', 'release', 'walk away'],
    adjectives: ['direct', 'clear', 'free'],
    avoid: []
  },
  {
    id: 'kridol-f-season',
    labelKo: '한국 여자 아이돌 — 뒤풀이·전환 (기본값)',
    fitsWorkspaces: ['kr-idol-female'],
    fitsFrames: ['after-party', 'season-turning'],
    nouns: ['after-party lights', 'turning season', 'rooftop night'],
    nounsKo: ['뒤풀이 조명', '바뀌는 계절', '옥상의 밤'],
    verbs: ['celebrate', 'turn the page'],
    adjectives: ['bright', 'warm', 'renewed'],
    avoid: []
  }
];

/**
 * v5.10 (TASK H) — real audit finding (this task's own brief): kr-kids/
 * jp-kids had ZERO entries in VOCABULARY_BANKS at all, so
 * vocabularyBankForScene's workspace filter always found an empty
 * `workspaceScoped` list for those two workspaces and silently fell back to
 * the FULL unscoped list (see that function's own v5.7 doc comment) —
 * meaning a kids track's `vocabularyBankId` metadata, and the "words to
 * use/avoid" line core/bridgeInstruction.ts's vocabularyBankInstructionLineFor
 * builds from it for the Claude Code bridge path, could silently carry
 * senior/2030/idol vocabulary (e.g. "kettle", "grandchildren") for a
 * children's song. The real hand-authored kids lyric body
 * (core/kidsLyricEngine.ts's composeKidsLyrics) never reads this system —
 * per this task's own scope, that composer is untouched — so this was a
 * metadata/bridge-instruction accuracy gap, not the local-generation lyric
 * text itself. These two bank sets close it.
 */
const KR_KIDS_AVOID_WORDS = ['그리움', '추억', '회상', '이별', '외로움', '쓸쓸함', '창가', '주전자', '사진첩', '편지', '라디오'];

export const KR_KIDS_VOCABULARY_BANKS: VocabularyBank[] = [
  {
    id: 'kids-kr-routine',
    labelKo: '한국 동요 — 생활습관',
    fitsWorkspaces: ['kr-kids'],
    nouns: ['손', '비누', '칫솔', '이불', '신발', '가방', '컵'],
    verbs: ['씻어요', '닦아요', '개어요', '신어요', '정리해요'],
    adjectives: ['깨끗한', '반짝반짝', '뽀득뽀득'],
    avoid: KR_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-kr-count',
    labelKo: '한국 동요 — 숫자·색깔·모양',
    fitsWorkspaces: ['kr-kids'],
    nouns: ['하나', '둘', '셋', '빨강', '노랑', '파랑', '동그라미', '네모'],
    verbs: ['세어요', '찾아요', '그려요'],
    adjectives: ['알록달록', '커다란', '작은'],
    avoid: KR_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-kr-animal',
    labelKo: '한국 동요 — 동물·탈것',
    fitsWorkspaces: ['kr-kids'],
    nouns: ['강아지', '고양이', '코끼리', '버스', '기차', '자동차'],
    verbs: ['달려요', '뛰어요', '날아요'],
    adjectives: ['귀여운', '커다란', '빠른'],
    avoid: KR_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-kr-action',
    labelKo: '한국 동요 — 율동',
    fitsWorkspaces: ['kr-kids'],
    nouns: ['손', '발', '어깨', '무릎', '박수'],
    verbs: ['흔들어요', '뛰어요', '돌아요', '손뼉쳐요'],
    adjectives: ['신나는', '즐거운'],
    avoid: KR_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-kr-calm',
    labelKo: '한국 동요 — 수면·진정',
    fitsWorkspaces: ['kr-kids'],
    nouns: ['별', '달', '이불', '인형', '꿈'],
    verbs: ['자요', '쉬어요', '안아요'],
    adjectives: ['포근한', '조용한', '따뜻한'],
    avoid: KR_KIDS_AVOID_WORDS
  }
];

const JP_KIDS_AVOID_WORDS = ['さびしい', 'かなしい', 'わかれ', 'こわい', 'おもいで'];

/**
 * v5.10 (TASK H) — the VocabularyBank type has only nouns/verbs/adjectives
 * (no dedicated onomatopoeia field — checked before writing these). Each
 * bank's given onomatopoeia (ぴょんぴょん, ごしごし, etc.) is placed in
 * `adjectives` since it functions the same way as this file's existing
 * mood/manner adjectives (e.g. senior's 'crowded', 'dizzy'), never forced
 * into `nouns`/`verbs` where it wouldn't fit grammatically. A small number
 * of plain companion verbs (たたく/のる/ねる, etc.) are added alongside the
 * task-specified words so `verbs` isn't left empty, matching every other
 * bank in this file.
 */
export const JP_KIDS_VOCABULARY_BANKS: VocabularyBank[] = [
  {
    id: 'kids-jp-teasobi',
    labelKo: '일본 동요 — 手遊び(손놀이)',
    fitsWorkspaces: ['jp-kids'],
    nouns: ['おてて', 'ゆび'],
    verbs: ['はねる', 'たたく', 'まわす'],
    adjectives: ['ぴょんぴょん', 'ぱちぱち', 'くるくる'],
    avoid: JP_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-jp-routine',
    labelKo: '일본 동요 — 生活習慣(생활습관)',
    fitsWorkspaces: ['jp-kids'],
    nouns: ['はみがき', 'おきがえ', 'おかたづけ'],
    verbs: ['する', 'がんばる'],
    adjectives: ['ごしごし', 'しゅっしゅっ'],
    avoid: JP_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-jp-food',
    labelKo: '일본 동요 — 食べ物(음식)',
    fitsWorkspaces: ['jp-kids'],
    nouns: ['りんご', 'おにぎり'],
    verbs: ['たべる', 'あじわう'],
    adjectives: ['もぐもぐ', 'ぱくぱく', 'おいしい'],
    avoid: JP_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-jp-vehicle',
    labelKo: '일본 동요 — 乗り物(탈것)',
    fitsWorkspaces: ['jp-kids'],
    nouns: ['バス', 'でんしゃ'],
    verbs: ['はしる', 'のる'],
    adjectives: ['ぶーぶー', 'がたんごとん'],
    avoid: JP_KIDS_AVOID_WORDS
  },
  {
    id: 'kids-jp-calm',
    labelKo: '일본 동요 — ねんね(잠자리)',
    fitsWorkspaces: ['jp-kids'],
    nouns: ['おほしさま', 'おつきさま'],
    verbs: ['ねる', 'ゆれる'],
    adjectives: ['ゆらゆら', 'すやすや'],
    avoid: JP_KIDS_AVOID_WORDS
  }
];

export const VOCABULARY_BANKS: VocabularyBank[] = [
  ...SENIOR_VOCABULARY_BANKS,
  ...KR_2030_VOCABULARY_BANKS,
  ...JP_2030_VOCABULARY_BANKS,
  ...KR_IDOL_MALE_VOCABULARY_BANKS,
  ...KR_IDOL_FEMALE_VOCABULARY_BANKS,
  ...KR_KIDS_VOCABULARY_BANKS,
  ...JP_KIDS_VOCABULARY_BANKS
];

/** v4.5 (TASK C, 3-4) — this app's own pre-v4.5 default lean; capped at 40% of a set's per-track bank assignments so it stays available (real listening feedback: "quiet-morning 뱅크를 삭제하지 말 것. 좋은 가사가 나오는 뱅크입니다") without being able to dominate a whole set again — see core/lyricVocabularyRepetition.ts's setVocabularyBankIssues for the actual set-level check. */
export const QUIET_MORNING_BANK_ID = 'quiet-morning';
export const QUIET_MORNING_MAX_SHARE = 0.4;
/** v4.5 (TASK C, 3-4) — "같은 뱅크 최대 <= 6곡" (an 18-song set). Expressed as an absolute count, not a share, per the spec's own literal wording. */
export const SAME_BANK_MAX_SONGS = 6;
/** v4.5 (TASK C, 3-4) — "사용 뱅크 종류 >= 4종". */
export const MIN_DISTINCT_BANKS_USED = 4;

/**
 * v4.5 (TASK C, 3-3) — the actual frame/motion-matching lookup: given a
 * track's own lyricTheme frameId/motionKo (already computed, see
 * core/lyricDiversityPlan.ts's lyricThemeForSlot), picks the best-fitting
 * bank. Frame match wins over motion match (more specific); a track with
 * neither (most of the 95-theme pool predates this axis — see
 * data/lyricThemes.ts's own field doc comment) falls back to a workspace-
 * appropriate default.
 *
 * v5.7 (TASK G) — the no-match fallback used to hardcode
 * `QUIET_MORNING_BANK_ID` ('quiet-morning', senior-oldpop's own bank) before
 * falling to `scoped[0]`. That was harmless for senior (its real default)
 * but meaningless for every other workspace — `quiet-morning` never appears
 * in a non-senior `scoped` list, so it always silently fell through to
 * `scoped[0]` (whichever bank happens to be declared first for that
 * workspace) regardless of that bank's own intended role. Now prefers a
 * bank with no fitsFrames/fitsMotions at all (a deliberate, frame-agnostic
 * catch-all — every one of this file's per-workspace bank sets has exactly
 * one, its own "기본값" bank) over array-position luck, and keeps
 * `QUIET_MORNING_BANK_ID` as the literal senior-oldpop case so senior's own
 * resolution is unchanged.
 *
 * v5.7 (TASK G) bugfix — real test failure caught this: kr-kids/jp-kids
 * had zero entries in VOCABULARY_BANKS at all (out of that task's own
 * scope — the user's instruction there was the 4 non-kids workspaces
 * only), so workspace-filtering `scoped` down to an empty array made this
 * crash on `scoped[0]` being undefined the moment a real caller passed
 * their workspaceId (core/localGenerator.ts calls this unconditionally,
 * before the kids-vs-adult branch decides whether the result even gets
 * used — see that call site's own comment). A workspace with no dedicated
 * banks fell back to the full unscoped list instead of crashing.
 *
 * v5.10 (TASK H) — kr-kids/jp-kids now have their own dedicated bank sets
 * (KR_KIDS_VOCABULARY_BANKS/JP_KIDS_VOCABULARY_BANKS above), so the
 * empty-`scoped` fallback above is no longer reachable for either of them —
 * it stays only as defensive code for a hypothetical future workspace that
 * ships with no banks yet, same as it protected kr-2030/jp-2030/kr-idol-*
 * before their own bank sets landed in v5.7.
 */
export function vocabularyBankForScene(frameId: string | undefined, motionKo: string | undefined, workspaceId?: WorkspaceId): VocabularyBank {
  const workspaceScoped = workspaceId ? VOCABULARY_BANKS.filter(bank => !bank.fitsWorkspaces?.length || bank.fitsWorkspaces.includes(workspaceId)) : VOCABULARY_BANKS;
  const scoped = workspaceScoped.length ? workspaceScoped : VOCABULARY_BANKS;
  const frameMatch = frameId ? scoped.find(bank => bank.fitsFrames?.includes(frameId)) : undefined;
  if (frameMatch) return frameMatch;
  const motionMatch = motionKo ? scoped.find(bank => bank.fitsMotions?.includes(motionKo)) : undefined;
  if (motionMatch) return motionMatch;
  const genericFallback = scoped.find(bank => !bank.fitsFrames?.length && !bank.fitsMotions?.length);
  return scoped.find(bank => bank.id === QUIET_MORNING_BANK_ID) ?? genericFallback ?? scoped[0];
}

export function vocabularyBankById(id: string): VocabularyBank | undefined {
  return VOCABULARY_BANKS.find(bank => bank.id === id);
}

export function vocabularyBanksForEra(era: EraBucket | undefined): VocabularyBank[] {
  if (!era) return VOCABULARY_BANKS.filter(bank => !bank.fitsEras?.length);
  return VOCABULARY_BANKS.filter(bank => !bank.fitsEras?.length || bank.fitsEras.includes(era));
}
