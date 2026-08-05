import type { WorkspaceId } from '../types';
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
    verbs: ['confess', 'catch up', 'text', 'cross paths'],
    adjectives: ['warm', 'awkward', 'honest', 'fleeting'],
    avoid: []
  },
  {
    id: 'kr2030-everyday',
    labelKo: '한국 2030 — 일상 전반 (기본값)',
    fitsWorkspaces: ['kr-2030'],
    nouns: ['alley', 'convenience store', 'delivery bike', 'company dinner'],
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
    verbs: ['gather', 'cheer', 'remember', 'laugh together'],
    adjectives: ['nostalgic', 'joyful', 'crowded'],
    avoid: []
  },
  {
    id: 'jp2030-everyday',
    labelKo: '일본 2030 — 일상 전반 (기본값)',
    fitsWorkspaces: ['jp-2030'],
    nouns: ['station', 'convenience store', 'evening train', 'city street'],
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
    verbs: ['celebrate', 'turn the page'],
    adjectives: ['bright', 'warm', 'renewed'],
    avoid: []
  }
];

export const VOCABULARY_BANKS: VocabularyBank[] = [
  ...SENIOR_VOCABULARY_BANKS,
  ...KR_2030_VOCABULARY_BANKS,
  ...JP_2030_VOCABULARY_BANKS,
  ...KR_IDOL_MALE_VOCABULARY_BANKS,
  ...KR_IDOL_FEMALE_VOCABULARY_BANKS
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
 * have zero entries in VOCABULARY_BANKS at all (out of this task's scope —
 * the user's own instruction was the 4 non-kids workspaces only), so
 * workspace-filtering `scoped` down to an empty array made this crash on
 * `scoped[0]` being undefined the moment a real caller passed their
 * workspaceId (core/localGenerator.ts calls this unconditionally, before
 * the kids-vs-adult branch decides whether the result even gets used — see
 * that call site's own comment). A workspace with no dedicated banks yet
 * now falls back to the full unscoped list instead of crashing — the
 * pre-v5.7 behavior for every non-senior workspace anyway, so this is a
 * strict no-op for kids, not a new bias.
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
