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

export const VOCABULARY_BANKS: VocabularyBank[] = [...SENIOR_VOCABULARY_BANKS];

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
 * data/lyricThemes.ts's own field doc comment) falls back to
 * 'quiet-morning' — this app's own pre-v4.5 default, not a new bias.
 */
export function vocabularyBankForScene(frameId: string | undefined, motionKo: string | undefined, workspaceId?: WorkspaceId): VocabularyBank {
  const scoped = workspaceId ? VOCABULARY_BANKS.filter(bank => !bank.fitsWorkspaces?.length || bank.fitsWorkspaces.includes(workspaceId)) : VOCABULARY_BANKS;
  const frameMatch = frameId ? scoped.find(bank => bank.fitsFrames?.includes(frameId)) : undefined;
  if (frameMatch) return frameMatch;
  const motionMatch = motionKo ? scoped.find(bank => bank.fitsMotions?.includes(motionKo)) : undefined;
  if (motionMatch) return motionMatch;
  return scoped.find(bank => bank.id === QUIET_MORNING_BANK_ID) ?? scoped[0];
}

export function vocabularyBankById(id: string): VocabularyBank | undefined {
  return VOCABULARY_BANKS.find(bank => bank.id === id);
}

export function vocabularyBanksForEra(era: EraBucket | undefined): VocabularyBank[] {
  if (!era) return VOCABULARY_BANKS.filter(bank => !bank.fitsEras?.length);
  return VOCABULARY_BANKS.filter(bank => !bank.fitsEras?.length || bank.fitsEras.includes(era));
}
