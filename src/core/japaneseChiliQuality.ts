import type { ChannelProfile, ChiliStoryPov, LyricLanguage, SongIdea } from '../types';
import { checkLyricLanguageMatch } from './lyricMetrics';
import { checkTitleHookRelationships } from './titleHookRelationship';
import { isJpChillhopArchetype } from '../utils/channelArchetype';
import { CHILI_STORY_DEFAULT_SONG_COUNT, CHILI_STORY_POV_LABEL_JA, chiliStoryActForTrack, isSoloChiliStoryPov, normalizeChiliStoryPov } from './chiliStoryPov';
import { checkJpChillhopTranslationese, findJpChillhopKatakanaOveruse, JP_CHILLHOP_KATAKANA_OVERUSE_THRESHOLD, jpChillhopKatakanaShareOfKana } from './jpChillhopPolicy';

export interface JapaneseChiliQualityContext {
  channel?: ChannelProfile;
  language?: LyricLanguage;
  storyPov?: ChiliStoryPov;
  songCount?: number;
}

export interface JapaneseChiliQualityReport {
  applies: boolean;
  languageFailureTrackNos: number[];
  vocalCounts: { male: number; female: number; mixed: number; unknown: number };
  actCounts: Record<number, number>;
  packWarnings: string[];
  warningsByTrackNo: Map<number, string[]>;
}

function pushTrackWarning(map: Map<number, string[]>, trackNo: number, warning: string) {
  const warnings = map.get(trackNo) ?? [];
  if (!warnings.includes(warning)) warnings.push(warning);
  map.set(trackNo, warnings);
}

function normalizedIdentity(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s"'.,!?！？。、・「」『』（）()\[\]{}:;ー\-–—]+/g, '')
    .trim();
}

function vocalTypeOf(song: SongIdea): 'male' | 'female' | 'mixed' | 'unknown' {
  if (song.vocalType === 'male' || song.vocalType === 'female' || song.vocalType === 'mixed') return song.vocalType;
  if (song.vocalGender === 'male') return 'male';
  if (song.vocalGender === 'female') return 'female';
  if (song.vocalGender === 'mixed' || song.vocalGender === 'duet') return 'mixed';
  return 'unknown';
}

function duplicateTrackWarnings(
  songs: SongIdea[],
  field: 'title' | 'hookPhrase',
  label: string
): { packWarnings: string[]; duplicateTrackNos: number[] } {
  const byKey = new Map<string, number[]>();
  for (const song of songs) {
    const key = normalizedIdentity(song[field]);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), song.trackNo]);
  }
  const duplicateGroups = [...byKey.values()].filter(trackNos => trackNos.length > 1);
  return {
    packWarnings: duplicateGroups.map(trackNos => `JP CHILI ${label} duplicate: T${trackNos.join(', T')} share the same normalized ${field}.`),
    duplicateTrackNos: duplicateGroups.flat()
  };
}

function resolvePackPov(songs: SongIdea[], context: JapaneseChiliQualityContext): ChiliStoryPov {
  return normalizeChiliStoryPov(context.storyPov ?? songs.find(song => song.storyPov)?.storyPov);
}

export function evaluateJapaneseChiliQuality(
  songs: SongIdea[],
  context: JapaneseChiliQualityContext = {}
): JapaneseChiliQualityReport {
  const applies = Boolean(context.channel && isJpChillhopArchetype(context.channel.archetype));
  const warningsByTrackNo = new Map<number, string[]>();
  const packWarnings: string[] = [];
  const languageFailureTrackNos: number[] = [];
  const vocalCounts = { male: 0, female: 0, mixed: 0, unknown: 0 };
  const actCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!applies) return { applies, languageFailureTrackNos, vocalCounts, actCounts, packWarnings, warningsByTrackNo };

  const expectedLanguage = context.language ?? 'japanese';
  for (const song of songs) {
    const languageCheck = checkLyricLanguageMatch(song.lyrics, expectedLanguage, { archetype: context.channel?.archetype });
    if (!languageCheck?.ok) {
      languageFailureTrackNos.push(song.trackNo);
      pushTrackWarning(warningsByTrackNo, song.trackNo, 'JP CHILI language gate: lyrics must be native Japanese with enough kana/kanji and no Korean fallback.');
    }

    const vocalType = vocalTypeOf(song);
    vocalCounts[vocalType] += 1;
    const actNo = song.storyAct ?? chiliStoryActForTrack(song.trackNo, context.songCount ?? songs.length).storyAct;
    if (actNo >= 1 && actNo <= 5) actCounts[actNo] += 1;
  }

  const storyPov = resolvePackPov(songs, context);
  if (isSoloChiliStoryPov(storyPov)) {
    const wrongTracks = songs.filter(song => vocalTypeOf(song) !== storyPov).map(song => song.trackNo);
    if (wrongTracks.length) {
      const label = CHILI_STORY_POV_LABEL_JA[storyPov];
      packWarnings.push(`JP CHILI ${label} vocal hard lock failed: T${wrongTracks.join(', T')} are not ${storyPov} vocal.`);
      for (const trackNo of wrongTracks) {
        pushTrackWarning(warningsByTrackNo, trackNo, `JP CHILI vocal hard lock: ${label} requires ${storyPov} vocal only.`);
      }
    }
  }

  const titleDuplicates = duplicateTrackWarnings(songs, 'title', 'title');
  const hookDuplicates = duplicateTrackWarnings(songs, 'hookPhrase', 'hook');
  packWarnings.push(...titleDuplicates.packWarnings, ...hookDuplicates.packWarnings);
  for (const trackNo of [...titleDuplicates.duplicateTrackNos, ...hookDuplicates.duplicateTrackNos]) {
    pushTrackWarning(warningsByTrackNo, trackNo, 'JP CHILI title/hook uniqueness: this track collides with another track in the same story pack.');
  }

  const relationshipReport = checkTitleHookRelationships(songs.map(song => ({ trackNo: song.trackNo, title: song.title, hookPhrase: song.hookPhrase })));
  if (relationshipReport.dominantShapeOverQuota) {
    packWarnings.push(`JP CHILI title shape variety warning: ${relationshipReport.dominantShape?.shape} titles exceed 50% of the pack.`);
  }
  if (relationshipReport.excessAffix) {
    packWarnings.push(`JP CHILI title affix variety warning: "${relationshipReport.excessAffix.word}" appears on ${relationshipReport.excessAffix.count} titles.`);
  }

  const expectedSongCount = context.songCount ?? songs.length;
  if (expectedSongCount === CHILI_STORY_DEFAULT_SONG_COUNT) {
    const unevenActs = Object.entries(actCounts).filter(([, count]) => count !== 3);
    if (unevenActs.length) {
      packWarnings.push(`JP CHILI 5-act arc failed: 15-song pack must have 3 tracks per act (actual ${Object.entries(actCounts).map(([act, count]) => `A${act}:${count}`).join(', ')}).`);
    }
  } else {
    const missingActs = Object.entries(actCounts).filter(([, count]) => count === 0).map(([act]) => act);
    if (missingActs.length) {
      packWarnings.push(`JP CHILI 5-act arc warning: dynamic ${expectedSongCount}-song pack is missing act(s) ${missingActs.join(', ')}.`);
    }
  }

  for (const trackNo of findJpChillhopKatakanaOveruse(songs)) {
    const song = songs.find(item => item.trackNo === trackNo);
    const share = song ? Math.round(jpChillhopKatakanaShareOfKana(song.lyrics) * 100) : Math.round(JP_CHILLHOP_KATAKANA_OVERUSE_THRESHOLD * 100);
    pushTrackWarning(warningsByTrackNo, trackNo, `JP CHILI katakana balance: katakana share is ${share}%, above the ${Math.round(JP_CHILLHOP_KATAKANA_OVERUSE_THRESHOLD * 100)}% provisional ceiling.`);
  }

  for (const warning of checkJpChillhopTranslationese(songs)) {
    const match = warning.match(/JP CHILI Track (\d+):/);
    if (match) pushTrackWarning(warningsByTrackNo, Number(match[1]), warning);
    else packWarnings.push(warning);
  }

  return { applies, languageFailureTrackNos, vocalCounts, actCounts, packWarnings, warningsByTrackNo };
}

export function japaneseChiliQualityWarningsForPack(
  songs: SongIdea[],
  context: JapaneseChiliQualityContext = {}
): Map<number, string[]> {
  const report = evaluateJapaneseChiliQuality(songs, context);
  if (!report.applies) return new Map();
  if (report.packWarnings.length && songs[0]) {
    const existing = report.warningsByTrackNo.get(songs[0].trackNo) ?? [];
    report.warningsByTrackNo.set(songs[0].trackNo, [...existing, ...report.packWarnings.filter(warning => !existing.includes(warning))]);
  }
  return report.warningsByTrackNo;
}
