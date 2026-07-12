import type { ChannelProfile, GenerationOptions } from '../types';
import { defaultAvoidWordsString } from '../data/avoidWordPresets';

export function clampSongCount(value: number) {
  if (!Number.isFinite(value)) return 12;
  return Math.min(30, Math.max(1, Math.round(value)));
}

export function createInitialOptions(channel: ChannelProfile): GenerationOptions {
  return {
    channel,
    projectTitle: 'Autumn to Christmas Playlist Pack',
    songCount: 12,
    lyricLanguage: 'english',
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: 'christmas',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: defaultAvoidWordsString()
  };
}
