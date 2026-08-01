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
  }
];

export const VOCABULARY_BANKS: VocabularyBank[] = [...SENIOR_VOCABULARY_BANKS];

export function vocabularyBankById(id: string): VocabularyBank | undefined {
  return VOCABULARY_BANKS.find(bank => bank.id === id);
}

export function vocabularyBanksForEra(era: EraBucket | undefined): VocabularyBank[] {
  if (!era) return VOCABULARY_BANKS.filter(bank => !bank.fitsEras?.length);
  return VOCABULARY_BANKS.filter(bank => !bank.fitsEras?.length || bank.fitsEras.includes(era));
}
