import type {
  AxisAllocation,
  ChannelProfile,
  ChiliStoryPov,
  ChiliStorySpeaker,
  GenerationOptions,
  LyricLanguage,
  LyricPerspective,
  PlaylistBlueprint,
  PreassignedSongSlot,
  ScenePlanningMode,
  WorkspaceId
} from '../types';
import {
  isJapaneseChillhopArchetype,
  isJpCafeChillhopArchetype,
  isJpChillhopArchetype
} from '../utils/channelArchetype';
import { normalizeDiversityAllocations } from './diversityAllocation';
import type { VocalQuota } from './vocalPlan';

export const JP_CHILLHOP_WORKSPACE_ID: WorkspaceId = 'jp-chillhop';
export const JP_CAFE_CHILLHOP_WORKSPACE_ID: WorkspaceId = 'jp-cafe-chillhop';
export const JP_CHILLHOP_CHANNEL_PROFILE_ID = 'jp-chili-lab-story';
export const JP_CAFE_CHILLHOP_CHANNEL_PROFILE_ID = 'jp-cafe-chili-lab';
export const CHILI_STORY_DEFAULT_SONG_COUNT = 15;

export const CHILI_STORY_POV_LABEL_JA: Record<ChiliStoryPov, string> = {
  couple: 'ふたりのSTORY',
  male: '彼のSTORY',
  female: '彼女のSTORY'
};

export const CAFE_STORY_MODE_LABEL_JA: Record<ChiliStoryPov, string> = {
  couple: 'ふたりのCAFÉ STORY',
  male: '彼のCAFÉ STORY',
  female: '彼女のCAFÉ STORY'
};

export const CHILI_STORY_ACTS = [
  { act: 1, label: 'Act 1 / setup', focus: 'source event setup, first signal, emotional baseline' },
  { act: 2, label: 'Act 2 / warmth', focus: 'small choices, attraction, warmer details' },
  { act: 3, label: 'Act 3 / misread', focus: 'misread message, hesitation, conflict without melodrama' },
  { act: 4, label: 'Act 4 / decision', focus: 'decision, honest confession, changed self-understanding' },
  { act: 5, label: 'Act 5 / afterglow', focus: 'afterglow, callback, forward-looking unresolved tenderness' }
] as const;

export const CAFE_CHILI_STORY_ACTS = [
  { act: 1, label: 'Act 1 / cafe arrival', focus: 'cafe arrival, first expression, place, season' },
  { act: 2, label: 'Act 2 / conversation', focus: 'conversation, tea, coffee, and small shared actions' },
  { act: 3, label: 'Act 3 / realization', focus: 'emotional realization and the central hook' },
  { act: 4, label: 'Act 4 / unsaid words', focus: 'hesitation, resentment, and words left unsaid' },
  { act: 5, label: 'Act 5 / leaving', focus: 'leaving the cafe, message, station, umbrella, seaside, or the next promise' }
] as const;

type ChiliStoryOptionsLike = {
  channel?: Pick<ChannelProfile, 'archetype' | 'id' | 'name'>;
  songCount: number;
  lyricLanguage?: LyricLanguage;
  perspective?: LyricPerspective;
  perspectiveMode?: GenerationOptions['perspectiveMode'];
  perspectiveModeIsExplicitChoice?: boolean;
  vocalTone?: string;
  vocalQuota?: VocalQuota;
  vocalQuotaMode?: GenerationOptions['vocalQuotaMode'];
  storyVocalQuotaSource?: GenerationOptions['storyVocalQuotaSource'];
  diversityAllocations?: AxisAllocation[];
  scenePlanningMode?: ScenePlanningMode;
  storyPov?: ChiliStoryPov;
  cafeStoryMode?: ChiliStoryPov;
  storySourceLine?: string;
  storyPlanLine?: string;
  storyPlanEpisodeId?: string;
  storyPovTitle?: string;
  storySourceEpisodeId?: string;
  storySourceTitle?: string;
  storySourceSummary?: string;
  storyPovIntentSummary?: string;
  storyPreviousContext?: string;
  storyNextHint?: string;
  storyLocation?: string;
  storySeason?: string;
  cafeLocation?: string;
  cafeType?: string;
  cafeSeason?: string;
  cafeTimeOfDay?: string;
  cafeWeather?: string;
  storySpeaker?: ChiliStorySpeaker;
};

export interface ParsedChiliStoryLine {
  storySourceEpisodeId?: string;
  storySourceTitle: string;
  storySourceSummary?: string;
}

export interface ResolvedChiliStorySource {
  storySourceEpisodeId?: string;
  storySourceTitle?: string;
  storySourceSummary?: string;
}

export interface ParsedChiliStoryPlanLine {
  planEpisodeId?: string;
  povTitle: string;
  sourceEpisodeId?: string;
  sourceTitle?: string;
  sourceEventSummary?: string;
  povIntentSummary?: string;
}

export type StoryVocalLock =
  | { locked: false }
  | {
      locked: true;
      gender: 'male' | 'female';
      quota: VocalQuota;
      reason: 'jp-chili-solo-story';
    };

export type StoryInputUiMode = 'default' | 'jp-chili-story-simple' | 'jp-cafe-story';

export function normalizeChiliStoryPov(value: unknown): ChiliStoryPov {
  return value === 'male' || value === 'female' || value === 'couple' ? value : 'couple';
}

export function isSoloChiliStoryPov(pov: ChiliStoryPov | undefined): pov is 'male' | 'female' {
  return pov === 'male' || pov === 'female';
}

export function isJpChillhopOptions(opts: { channel?: { archetype?: string } }): boolean {
  return isJpChillhopArchetype(opts.channel?.archetype);
}

export function isJpCafeChillhopOptions(opts: { channel?: { archetype?: string } }): boolean {
  return isJpCafeChillhopArchetype(opts.channel?.archetype);
}

export function isJapaneseChiliStoryOptions(opts: { channel?: { archetype?: string } }): boolean {
  return isJapaneseChillhopArchetype(opts.channel?.archetype);
}

export function vocalQuotaForChiliStoryPov(pov: ChiliStoryPov, songCount: number): VocalQuota | undefined {
  const total = Math.max(0, Math.round(songCount));
  if (pov === 'male') return { male: total, female: 0, mixed: 0 };
  if (pov === 'female') return { male: 0, female: total, mixed: 0 };
  return undefined;
}

export function vocalQuotaForCafeStoryMode(pov: ChiliStoryPov, songCount: number): VocalQuota {
  const total = Math.max(0, Math.round(songCount));
  if (pov === 'male') return { male: total, female: 0, mixed: 0 };
  if (pov === 'female') return { male: 0, female: total, mixed: 0 };
  if (total === 0) return { male: 0, female: 0, mixed: 0 };
  const mixed = total >= 3
    ? Math.min(Math.max(1, Math.round(total * 0.2)), Math.floor((total - 1) / 2))
    : 0;
  const remaining = total - mixed;
  return {
    male: Math.ceil(remaining / 2),
    female: Math.floor(remaining / 2),
    mixed
  };
}

function storyPovFromOptions(opts: ChiliStoryOptionsLike): ChiliStoryPov {
  return normalizeChiliStoryPov(isJpCafeChillhopOptions(opts) ? opts.cafeStoryMode ?? opts.storyPov : opts.storyPov);
}

export function resolveEffectiveStoryVocalQuota(opts: ChiliStoryOptionsLike): VocalQuota | undefined {
  if (!isJapaneseChiliStoryOptions(opts)) return undefined;
  const storyPov = storyPovFromOptions(opts);
  return isJpCafeChillhopOptions(opts)
    ? vocalQuotaForCafeStoryMode(storyPov, opts.songCount)
    : vocalQuotaForChiliStoryPov(storyPov, opts.songCount);
}

export function isStoryVocalHardLocked(opts: ChiliStoryOptionsLike): StoryVocalLock {
  if (!isJapaneseChiliStoryOptions(opts)) return { locked: false };
  const storyPov = storyPovFromOptions(opts);
  if (!isSoloChiliStoryPov(storyPov)) return { locked: false };
  const quota = resolveEffectiveStoryVocalQuota(opts);
  return quota ? { locked: true, gender: storyPov, quota, reason: 'jp-chili-solo-story' } : { locked: false };
}

export function storyInputUiModeForWorkspace(workspaceId: WorkspaceId | undefined): StoryInputUiMode {
  if (workspaceId === JP_CHILLHOP_WORKSPACE_ID) return 'jp-chili-story-simple';
  if (workspaceId === JP_CAFE_CHILLHOP_WORKSPACE_ID) return 'jp-cafe-story';
  return 'default';
}

function vocalTypeAllocationForQuota(quota: VocalQuota): AxisAllocation {
  return {
    axis: 'vocalType',
    mode: 'manual',
    counts: { male: quota.male, female: quota.female, mixed: quota.mixed }
  };
}

function withoutVocalTypeAllocation(allocations: AxisAllocation[] | undefined): AxisAllocation[] {
  return normalizeDiversityAllocations(allocations).filter(allocation => allocation.axis !== 'vocalType');
}

function quotaEquals(a: VocalQuota | undefined, b: VocalQuota | undefined): boolean {
  return Boolean(a && b && a.male === b.male && a.female === b.female && a.mixed === b.mixed);
}

function isSoloStoryQuotaShape(quota: VocalQuota | undefined, songCount: number): boolean {
  return quotaEquals(quota, vocalQuotaForChiliStoryPov('male', songCount))
    || quotaEquals(quota, vocalQuotaForChiliStoryPov('female', songCount));
}

function hasStoryOwnedSoloVocalQuota(opts: ChiliStoryOptionsLike): boolean {
  return isSoloStoryQuotaShape(opts.vocalQuota, opts.songCount)
    && (opts.storyVocalQuotaSource === 'story-contract' || opts.vocalQuotaMode === 'balanced');
}

function hasStoryOwnedSoloVocalTypeAllocation(opts: ChiliStoryOptionsLike): boolean {
  if (opts.storyVocalQuotaSource !== 'story-contract' && opts.vocalQuotaMode !== 'balanced') return false;
  const allocation = normalizeDiversityAllocations(opts.diversityAllocations).find(item => item.axis === 'vocalType');
  if (!allocation || allocation.mode !== 'manual') return false;
  return isSoloStoryQuotaShape({
    male: Number(allocation.counts.male ?? 0),
    female: Number(allocation.counts.female ?? 0),
    mixed: Number(allocation.counts.mixed ?? 0)
  }, opts.songCount);
}

export function clearChiliStorySoloVocalLock<T extends ChiliStoryOptionsLike>(opts: T): T {
  return {
    ...opts,
    vocalQuota: undefined,
    vocalQuotaMode: undefined,
    storyVocalQuotaSource: undefined,
    diversityAllocations: withoutVocalTypeAllocation(opts.diversityAllocations)
  } as T;
}

function withStoryVocalQuota<T extends ChiliStoryOptionsLike>(opts: T, quota: VocalQuota): T {
  return {
    ...opts,
    vocalQuota: quota,
    vocalQuotaMode: undefined,
    storyVocalQuotaSource: 'story-contract',
    diversityAllocations: [
      ...withoutVocalTypeAllocation(opts.diversityAllocations),
      vocalTypeAllocationForQuota(quota)
    ]
  } as T;
}

function normalizeStoryVocalTone(value: string | undefined, gender: 'male' | 'female'): string {
  const tone = value?.trim() ?? '';
  const oppositeGender = gender === 'female'
    ? /\b(?:male|man|men|tenor|baritone|falsetto)\b/i
    : /\b(?:female|woman|women|soprano|alto)\b/i;
  if (!tone || oppositeGender.test(tone)) {
    return gender === 'female'
      ? 'restrained female lead vocal, intimate contemporary Japanese delivery'
      : 'restrained male lead vocal, intimate contemporary Japanese delivery';
  }
  return tone;
}

function speakerFor(storyPov: ChiliStoryPov, vocalType?: PreassignedSongSlot['vocalType']): ChiliStorySpeaker {
  if (storyPov === 'male' || storyPov === 'female') return storyPov;
  if (vocalType === 'male' || vocalType === 'female') return vocalType;
  return 'couple';
}

export function applyChiliStoryGenerationContract<T extends ChiliStoryOptionsLike>(opts: T): T {
  if (!isJapaneseChiliStoryOptions(opts)) return opts;

  const isCafe = isJpCafeChillhopOptions(opts);
  const storyPov = storyPovFromOptions(opts);
  const base = {
    ...opts,
    lyricLanguage: 'japanese',
    storyPov,
    ...(isCafe ? { cafeStoryMode: storyPov } : {})
  } as T;

  if (isCafe) {
    return withStoryVocalQuota({
      ...base,
      ...(isSoloChiliStoryPov(storyPov) ? { vocalTone: normalizeStoryVocalTone(opts.vocalTone, storyPov) } : {}),
      perspective: 'firstPerson',
      perspectiveMode: 'fixed',
      perspectiveModeIsExplicitChoice: true,
      scenePlanningMode: 'same-story-comparison',
      storySpeaker: speakerFor(storyPov)
    } as T, vocalQuotaForCafeStoryMode(storyPov, opts.songCount));
  }

  if (!isSoloChiliStoryPov(storyPov)) {
    if (hasStoryOwnedSoloVocalQuota(base) || hasStoryOwnedSoloVocalTypeAllocation(base)) {
      return {
        ...base,
        vocalQuota: undefined,
        vocalQuotaMode: undefined,
        storyVocalQuotaSource: undefined,
        diversityAllocations: withoutVocalTypeAllocation(base.diversityAllocations)
      } as T;
    }
    return base;
  }
  const sourceSummaryPresent = Boolean(opts.storySourceSummary?.trim());
  const scenePlanningMode = sourceSummaryPresent
    ? 'same-story-comparison'
    : base.scenePlanningMode === 'same-story-comparison'
      ? undefined
      : base.scenePlanningMode;
  return withStoryVocalQuota({
    ...base,
    vocalTone: normalizeStoryVocalTone(opts.vocalTone, storyPov),
    perspective: 'firstPerson',
    perspectiveMode: 'fixed',
    perspectiveModeIsExplicitChoice: true,
    scenePlanningMode
  } as T, vocalQuotaForChiliStoryPov(storyPov, opts.songCount)!);
}

export function parseChiliStorySourceLine(input: string): ParsedChiliStoryLine | null {
  const value = input.trim();
  if (!value) return null;
  const numbered = value.match(/^(\d{1,4})\s*[\.)]\s*(.+)$/u);
  const episodeId = numbered?.[1]?.padStart(3, '0');
  const body = numbered?.[2]?.trim() ?? value;
  const inline = body.match(/^(.+?)\s*(?:[-:：]|[–—])\s*(.+)$/u);
  return {
    ...(episodeId ? { storySourceEpisodeId: episodeId } : {}),
    storySourceTitle: (inline?.[1] ?? body).trim(),
    ...(inline?.[2]?.trim() ? { storySourceSummary: inline[2].trim() } : {})
  };
}

export function resolveChiliStorySource(input: { rawLine?: string; separateSummary?: string }): ResolvedChiliStorySource {
  const parsed = parseChiliStorySourceLine(input.rawLine ?? '');
  const separateSummary = input.separateSummary?.trim();
  return {
    ...(parsed?.storySourceEpisodeId ? { storySourceEpisodeId: parsed.storySourceEpisodeId } : {}),
    ...(parsed?.storySourceTitle ? { storySourceTitle: parsed.storySourceTitle } : {}),
    ...((separateSummary || parsed?.storySourceSummary)
      ? { storySourceSummary: separateSummary || parsed?.storySourceSummary }
      : {})
  };
}

export function parseChiliStoryLine(input: string): ParsedChiliStoryLine | null {
  return parseChiliStorySourceLine(input);
}

function splitStorySentences(input: string): string[] {
  return input.split(/(?<=[.!?。！？])\s*/u).map(value => value.trim()).filter(Boolean);
}

export function parseChiliStoryPlanLine(input: string): ParsedChiliStoryPlanLine | null {
  const value = input.trim();
  if (!value) return null;
  const numbered = value.match(/^(\d{1,4})\s*[.)]\s*(.+)$/u);
  const planEpisodeId = numbered?.[1]?.padStart(3, '0');
  const body = numbered?.[2]?.trim() ?? value;
  const ep = body.match(/\bEP\.?\s*(\d{1,4})\b/iu);
  const sourceEpisodeId = ep?.[1]?.padStart(3, '0');
  const beforeSource = ep ? body.slice(0, ep.index).trim() : '';
  const povTitle = beforeSource.replace(/[|:：,，]+\s*$/u, '').trim() || body.split(/[.!?。！？]/u)[0].trim();
  const afterEpisode = ep ? body.slice((ep.index ?? 0) + ep[0].length).trim() : '';
  const quoted = afterEpisode.match(/^["“「『](.+?)["”」』]\s*(.*)$/u);
  const sourceTitle = quoted?.[1]?.trim() || (afterEpisode ? afterEpisode.split(/[.!?。！？]/u)[0].trim() : undefined);
  const remainder = (quoted?.[2]?.trim() || (sourceTitle ? afterEpisode.slice(sourceTitle.length).trim() : ''))
    .replace(/^[.。:：\-–—]\s*/u, '');
  const sentences = splitStorySentences(remainder);
  return {
    ...(planEpisodeId ? { planEpisodeId } : {}),
    povTitle,
    ...(sourceEpisodeId ? { sourceEpisodeId } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(sentences[0] ? { sourceEventSummary: sentences[0] } : {}),
    ...(sentences.slice(1).join(' ') ? { povIntentSummary: sentences.slice(1).join(' ') } : {})
  };
}

function nonEmptyField<T extends string>(value: T | undefined): T | undefined {
  return value && value.trim() ? value.trim() as T : undefined;
}

function storySourceFields(opts: ChiliStoryOptionsLike) {
  return {
    ...(nonEmptyField(opts.storySourceLine) ? { storySourceLine: nonEmptyField(opts.storySourceLine) } : {}),
    ...(nonEmptyField(opts.storyPlanLine) ? { storyPlanLine: nonEmptyField(opts.storyPlanLine) } : {}),
    ...(nonEmptyField(opts.storyPlanEpisodeId) ? { storyPlanEpisodeId: nonEmptyField(opts.storyPlanEpisodeId) } : {}),
    ...(nonEmptyField(opts.storyPovTitle) ? { storyPovTitle: nonEmptyField(opts.storyPovTitle) } : {}),
    ...(nonEmptyField(opts.storySourceEpisodeId) ? { storySourceEpisodeId: nonEmptyField(opts.storySourceEpisodeId) } : {}),
    ...(nonEmptyField(opts.storySourceTitle) ? { storySourceTitle: nonEmptyField(opts.storySourceTitle) } : {}),
    ...(nonEmptyField(opts.storySourceSummary) ? { storySourceSummary: nonEmptyField(opts.storySourceSummary) } : {}),
    ...(nonEmptyField(opts.storyPovIntentSummary) ? { storyPovIntentSummary: nonEmptyField(opts.storyPovIntentSummary) } : {}),
    ...(nonEmptyField(opts.storyPreviousContext) ? { storyPreviousContext: nonEmptyField(opts.storyPreviousContext) } : {}),
    ...(nonEmptyField(opts.storyNextHint) ? { storyNextHint: nonEmptyField(opts.storyNextHint) } : {}),
    ...(nonEmptyField(opts.storyLocation) ? { storyLocation: nonEmptyField(opts.storyLocation) } : {}),
    ...(nonEmptyField(opts.storySeason) ? { storySeason: nonEmptyField(opts.storySeason) } : {}),
    ...(nonEmptyField(opts.cafeLocation) ? { cafeLocation: nonEmptyField(opts.cafeLocation) } : {}),
    ...(nonEmptyField(opts.cafeType) ? { cafeType: nonEmptyField(opts.cafeType) } : {}),
    ...(nonEmptyField(opts.cafeSeason) ? { cafeSeason: nonEmptyField(opts.cafeSeason) } : {}),
    ...(nonEmptyField(opts.cafeTimeOfDay) ? { cafeTimeOfDay: nonEmptyField(opts.cafeTimeOfDay) } : {}),
    ...(nonEmptyField(opts.cafeWeather) ? { cafeWeather: nonEmptyField(opts.cafeWeather) } : {})
  };
}

function actDefinitionsFor(isCafe: boolean) {
  return isCafe ? CAFE_CHILI_STORY_ACTS : CHILI_STORY_ACTS;
}

function storyActForTrack(trackNo: number, songCount: number, isCafe: boolean): { storyAct: number; storyActLabel: string } {
  const acts = actDefinitionsFor(isCafe);
  const total = Math.max(1, songCount);
  const actIndex = total === CHILI_STORY_DEFAULT_SONG_COUNT
    ? Math.min(acts.length - 1, Math.floor((Math.max(1, trackNo) - 1) / 3))
    : Math.min(acts.length - 1, Math.floor(((Math.max(1, trackNo) - 1) * acts.length) / total));
  const act = acts[actIndex];
  return { storyAct: act.act, storyActLabel: act.label };
}

export function chiliStoryActForTrack(trackNo: number, songCount: number): { storyAct: number; storyActLabel: string } {
  return storyActForTrack(trackNo, songCount, false);
}

export function cafeChiliStoryActForTrack(trackNo: number, songCount: number): { storyAct: number; storyActLabel: string } {
  return storyActForTrack(trackNo, songCount, true);
}

export function chiliStoryArcRoleForTrack(
  trackNo: number,
  songCount: number,
  pov: ChiliStoryPov = 'couple',
  isCafe = false
): string {
  const { storyAct } = storyActForTrack(trackNo, songCount, isCafe);
  const inActPosition = songCount === CHILI_STORY_DEFAULT_SONG_COUNT ? ((trackNo - 1) % 3) + 1 : undefined;
  const povTail = pov === 'male'
    ? 'from his inner first-person angle'
    : pov === 'female'
      ? 'from her inner first-person angle'
      : 'holding both sides without reducing the story to a pronoun swap';
  const generalRoles: Record<number, string[]> = {
    1: ['opening memory anchor', 'first close detail', 'the feeling becomes undeniable'],
    2: ['shared routine begins', 'private signal grows', 'almost-confession'],
    3: ['message or timing misread', 'silence stretches', 'lowest emotional night'],
    4: ['decision to speak honestly', 'confession or repair', 'new promise tested'],
    5: ['quiet morning after', 'callback with changed meaning', 'afterglow closer']
  };
  const cafeRoles: Record<number, string[]> = {
    1: ['arriving at the cafe and noticing the first expression', 'settling into the place and season', 'first small sign across the table'],
    2: ['coffee or tea conversation starts', 'small shared action reveals closeness', 'a casual line almost becomes confession'],
    3: ['central hook arrives through a cafe detail', 'emotion becomes clear but quiet', 'the table feels different after the realization'],
    4: ['hesitation returns between sips', 'resentment or hurt stays politely unsaid', 'silence at the cafe becomes the conflict'],
    5: ['leaving the cafe with afterglow', 'message or station scene after the cafe', 'umbrella, seaside, or next promise carries the cafe memory forward']
  };
  const actRoles = isCafe ? cafeRoles : generalRoles;
  const rolePool = actRoles[storyAct] ?? actRoles[5];
  const role = inActPosition ? rolePool[inActPosition - 1] : rolePool[Math.min(rolePool.length - 1, Math.max(0, Math.floor((trackNo - 1) % rolePool.length)))];
  return `${role} - ${povTail}`;
}

export function buildChiliStoryArc(songCount = CHILI_STORY_DEFAULT_SONG_COUNT, isCafe = false) {
  const tracks = Array.from({ length: Math.max(0, songCount) }, (_, idx) => idx + 1);
  return {
    model: isCafe ? 'jp-cafe-chillhop-five-act-cafe-story' : 'jp-chillhop-five-act-story',
    songCount,
    expectedTracksPerAct: songCount === CHILI_STORY_DEFAULT_SONG_COUNT ? 3 : undefined,
    acts: actDefinitionsFor(isCafe).map(act => ({
      act: act.act,
      label: act.label,
      focus: act.focus,
      trackNos: tracks.filter(trackNo => storyActForTrack(trackNo, songCount, isCafe).storyAct === act.act)
    }))
  };
}

export function storyMetaFieldsFromOptions(opts: ChiliStoryOptionsLike): Partial<NonNullable<PlaylistBlueprint['meta']>> {
  if (!isJapaneseChiliStoryOptions(opts)) return {};
  const isCafe = isJpCafeChillhopOptions(opts);
  const storyPov = storyPovFromOptions(opts);
  const cafeSeason = nonEmptyField(opts.cafeSeason) ?? nonEmptyField(opts.storySeason);
  return {
    workspaceId: isCafe ? JP_CAFE_CHILLHOP_WORKSPACE_ID : JP_CHILLHOP_WORKSPACE_ID,
    storyPov,
    ...(isCafe ? { cafeStoryMode: storyPov, storySpeaker: speakerFor(storyPov) } : {}),
    ...(isCafe && cafeSeason ? { season: cafeSeason } : {}),
    ...storySourceFields(opts),
    storyArc: buildChiliStoryArc(opts.songCount, isCafe)
  };
}

export function chiliStorySlotFields(
  opts: ChiliStoryOptionsLike,
  trackNo: number,
  vocalType?: PreassignedSongSlot['vocalType']
): Partial<PreassignedSongSlot> {
  if (!isJapaneseChiliStoryOptions(opts)) return {};
  const isCafe = isJpCafeChillhopOptions(opts);
  const storyPov = storyPovFromOptions(opts);
  const act = storyActForTrack(trackNo, opts.songCount, isCafe);
  const storySpeaker = speakerFor(storyPov, vocalType);
  return {
    storyPov,
    ...(isCafe ? { cafeStoryMode: storyPov, storySpeaker } : {}),
    ...storySourceFields(opts),
    ...act,
    storyArcRole: chiliStoryArcRoleForTrack(trackNo, opts.songCount, storyPov, isCafe)
  };
}

export function storyFieldsFromSlot(slot: PreassignedSongSlot): Partial<SongStoryFields> {
  return {
    ...(slot.storyPov ? { storyPov: slot.storyPov } : {}),
    ...(slot.cafeStoryMode ? { cafeStoryMode: slot.cafeStoryMode } : {}),
    ...(slot.storySourceLine ? { storySourceLine: slot.storySourceLine } : {}),
    ...(slot.storyPlanLine ? { storyPlanLine: slot.storyPlanLine } : {}),
    ...(slot.storyPlanEpisodeId ? { storyPlanEpisodeId: slot.storyPlanEpisodeId } : {}),
    ...(slot.storyPovTitle ? { storyPovTitle: slot.storyPovTitle } : {}),
    ...(slot.storySourceEpisodeId ? { storySourceEpisodeId: slot.storySourceEpisodeId } : {}),
    ...(slot.storySourceTitle ? { storySourceTitle: slot.storySourceTitle } : {}),
    ...(slot.storySourceSummary ? { storySourceSummary: slot.storySourceSummary } : {}),
    ...(slot.storyPovIntentSummary ? { storyPovIntentSummary: slot.storyPovIntentSummary } : {}),
    ...(slot.storyPreviousContext ? { storyPreviousContext: slot.storyPreviousContext } : {}),
    ...(slot.storyNextHint ? { storyNextHint: slot.storyNextHint } : {}),
    ...(slot.storyLocation ? { storyLocation: slot.storyLocation } : {}),
    ...(slot.storySeason ? { storySeason: slot.storySeason } : {}),
    ...(slot.cafeLocation ? { cafeLocation: slot.cafeLocation } : {}),
    ...(slot.cafeType ? { cafeType: slot.cafeType } : {}),
    ...(slot.cafeSeason ? { cafeSeason: slot.cafeSeason } : {}),
    ...(slot.cafeTimeOfDay ? { cafeTimeOfDay: slot.cafeTimeOfDay } : {}),
    ...(slot.cafeWeather ? { cafeWeather: slot.cafeWeather } : {}),
    ...(slot.storySpeaker ? { storySpeaker: slot.storySpeaker } : {}),
    ...(slot.storyAct !== undefined ? { storyAct: slot.storyAct } : {}),
    ...(slot.storyActLabel ? { storyActLabel: slot.storyActLabel } : {}),
    ...(slot.storyArcRole ? { storyArcRole: slot.storyArcRole } : {})
  };
}

type SongStoryFields = Pick<
  PreassignedSongSlot,
  | 'storyPov'
  | 'cafeStoryMode'
  | 'storySourceLine'
  | 'storyPlanLine'
  | 'storyPlanEpisodeId'
  | 'storyPovTitle'
  | 'storySourceEpisodeId'
  | 'storySourceTitle'
  | 'storySourceSummary'
  | 'storyPovIntentSummary'
  | 'storyPreviousContext'
  | 'storyNextHint'
  | 'storyLocation'
  | 'storySeason'
  | 'cafeLocation'
  | 'cafeType'
  | 'cafeSeason'
  | 'cafeTimeOfDay'
  | 'cafeWeather'
  | 'storySpeaker'
  | 'storyAct'
  | 'storyActLabel'
  | 'storyArcRole'
>;

function normalizeStorySpeaker(value: unknown): ChiliStorySpeaker | undefined {
  return value === 'male' || value === 'female' || value === 'couple' ? value : undefined;
}

export function rawStoryFieldsFromObject(obj: Record<string, unknown>): Partial<SongStoryFields> {
  const storyPov = normalizeChiliStoryPov(obj.storyPov);
  const cafeStoryMode = normalizeChiliStoryPov(obj.cafeStoryMode);
  const storySpeaker = normalizeStorySpeaker(obj.storySpeaker);
  return {
    ...(obj.storyPov ? { storyPov } : {}),
    ...(obj.cafeStoryMode ? { cafeStoryMode } : {}),
    ...(nonEmptyField(typeof obj.storySourceLine === 'string' ? obj.storySourceLine : undefined) ? { storySourceLine: String(obj.storySourceLine).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyPlanLine === 'string' ? obj.storyPlanLine : undefined) ? { storyPlanLine: String(obj.storyPlanLine).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyPlanEpisodeId === 'string' ? obj.storyPlanEpisodeId : undefined) ? { storyPlanEpisodeId: String(obj.storyPlanEpisodeId).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyPovTitle === 'string' ? obj.storyPovTitle : undefined) ? { storyPovTitle: String(obj.storyPovTitle).trim() } : {}),
    ...(nonEmptyField(typeof obj.storySourceEpisodeId === 'string' ? obj.storySourceEpisodeId : undefined) ? { storySourceEpisodeId: String(obj.storySourceEpisodeId).trim() } : {}),
    ...(nonEmptyField(typeof obj.storySourceTitle === 'string' ? obj.storySourceTitle : undefined) ? { storySourceTitle: String(obj.storySourceTitle).trim() } : {}),
    ...(nonEmptyField(typeof obj.storySourceSummary === 'string' ? obj.storySourceSummary : undefined) ? { storySourceSummary: String(obj.storySourceSummary).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyPovIntentSummary === 'string' ? obj.storyPovIntentSummary : undefined) ? { storyPovIntentSummary: String(obj.storyPovIntentSummary).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyPreviousContext === 'string' ? obj.storyPreviousContext : undefined) ? { storyPreviousContext: String(obj.storyPreviousContext).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyNextHint === 'string' ? obj.storyNextHint : undefined) ? { storyNextHint: String(obj.storyNextHint).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyLocation === 'string' ? obj.storyLocation : undefined) ? { storyLocation: String(obj.storyLocation).trim() } : {}),
    ...(nonEmptyField(typeof obj.storySeason === 'string' ? obj.storySeason : undefined) ? { storySeason: String(obj.storySeason).trim() } : {}),
    ...(nonEmptyField(typeof obj.cafeLocation === 'string' ? obj.cafeLocation : undefined) ? { cafeLocation: String(obj.cafeLocation).trim() } : {}),
    ...(nonEmptyField(typeof obj.cafeType === 'string' ? obj.cafeType : undefined) ? { cafeType: String(obj.cafeType).trim() } : {}),
    ...(nonEmptyField(typeof obj.cafeSeason === 'string' ? obj.cafeSeason : undefined) ? { cafeSeason: String(obj.cafeSeason).trim() } : {}),
    ...(nonEmptyField(typeof obj.cafeTimeOfDay === 'string' ? obj.cafeTimeOfDay : undefined) ? { cafeTimeOfDay: String(obj.cafeTimeOfDay).trim() } : {}),
    ...(nonEmptyField(typeof obj.cafeWeather === 'string' ? obj.cafeWeather : undefined) ? { cafeWeather: String(obj.cafeWeather).trim() } : {}),
    ...(storySpeaker ? { storySpeaker } : {}),
    ...(typeof obj.storyAct === 'number' ? { storyAct: obj.storyAct } : {}),
    ...(nonEmptyField(typeof obj.storyActLabel === 'string' ? obj.storyActLabel : undefined) ? { storyActLabel: String(obj.storyActLabel).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyArcRole === 'string' ? obj.storyArcRole : undefined) ? { storyArcRole: String(obj.storyArcRole).trim() } : {})
  };
}

export function buildJpChillhopStoryInstructionLines(
  opts: ChiliStoryOptionsLike,
  preassignedSongs: readonly PreassignedSongSlot[]
): string[] {
  if (!isJapaneseChiliStoryOptions(opts)) return [];
  const isCafe = isJpCafeChillhopOptions(opts);
  const storyPov = storyPovFromOptions(opts);
  const povLabel = (isCafe ? CAFE_STORY_MODE_LABEL_JA : CHILI_STORY_POV_LABEL_JA)[storyPov];
  const source = storySourceFields(opts);
  const sourcePrefix = source.storySourceLine ? `raw line "${source.storySourceLine}" / ` : '';
  const sourceLine = source.storySourceSummary
    ? `- Source event: ${sourcePrefix}episode ${source.storySourceEpisodeId ?? '(unlisted)'} "${source.storySourceTitle ?? 'untitled'}" - ${source.storySourceSummary}`
    : source.storySourceLine
      ? `- Source event: raw line "${source.storySourceLine}". Parse it as the event seed, then keep one coherent original Japanese relationship episode consistent across all tracks.`
      : '- Source event: no user episode summary was supplied; create one coherent original Japanese relationship episode and keep it consistent across all tracks.';
  const planBrief = [
    ...(source.storyPovTitle ? [`- POV TITLE: ${source.storyPovTitle}`] : []),
    ...(source.storyPlanEpisodeId ? [`- POV PLAN EPISODE: EP.${source.storyPlanEpisodeId}`] : []),
    ...(source.storySourceTitle ? [`- SOURCE STORY TITLE: ${source.storySourceTitle}`] : []),
    ...(source.storyPovIntentSummary ? [`- POV INTENT: ${source.storyPovIntentSummary}`] : [])
  ];
  const quota = resolveEffectiveStoryVocalQuota(opts);
  const quotaText = quota ? `male ${quota.male}/${opts.songCount}, female ${quota.female}/${opts.songCount}, mixed/duet ${quota.mixed}/${opts.songCount}` : '';
  const vocalLine = storyPov === 'male'
    ? `- VOCAL HARD LOCK: every one of the ${opts.songCount} songs is male vocal only (${quotaText}). Do not write female lead, duet, mixed, group, or gender-ambiguous lead vocal.`
    : storyPov === 'female'
      ? `- VOCAL HARD LOCK: every one of the ${opts.songCount} songs is female vocal only (${quotaText}). Do not write male lead, duet, mixed, group, or gender-ambiguous lead vocal.`
      : isCafe
        ? `- Couple Cafe Story Mode: follow preassignedSongs vocalType exactly (${quotaText}); mixed couple tracks stay below half the pack.`
        : '- Couple POV: do not hard-lock vocal gender here; keep the two-person relationship continuous without reducing it to a pronoun swap.';

  const sharedLines = [
    vocalLine,
    '- Titles and hookPhrase values must not duplicate within the pack. A hook may connect semantically to the title, but do not reuse one formula or one refrain across multiple tracks.',
    '- Lyrics must sound like fluent sung Japanese: conversational, specific, emotionally restrained, and free of translationese. Avoid Korean fallback, romanized filler, and stiff textbook constructions.',
    '- Keep Suno "stylePrompt" and "lyrics" separate. Put visual identity, typography, thumbnail, and layout language only in thumbnail/YouTube fields, never in stylePrompt.',
    '- Do not imitate, name, evoke as soundalike, clone, or request the vocal style of any famous artist, band, song, melody, cover, or copyrighted recording.'
  ];

  const trackMap = [
    '',
    'Track story arc map:',
    ...preassignedSongs.map(slot => {
      const act = slot.storyActLabel ?? storyActForTrack(slot.trackNo, opts.songCount, isCafe).storyActLabel;
      const role = slot.storyArcRole ?? chiliStoryArcRoleForTrack(slot.trackNo, opts.songCount, storyPov, isCafe);
      return `- T${slot.trackNo}: ${act} - ${role} - vocal=${slot.vocalType ?? 'planned by slot'} - storySpeaker=${slot.storySpeaker ?? speakerFor(storyPov, slot.vocalType)} - title="${slot.title}" - hook="${slot.hookPhrase}"`;
    })
  ];

  if (isCafe) {
    const cafeSettingParts = [
      source.cafeLocation || source.storyLocation,
      source.cafeType,
      source.cafeSeason || source.storySeason,
      source.cafeTimeOfDay,
      source.cafeWeather
    ].filter(Boolean);
    return [
      '',
      '[JP CAFE CHILI LAB STORY CONTRACT]',
      `- Workspace is "jp-cafe-chillhop"; Cafe Story Mode is ${povLabel} (cafeStoryMode="${storyPov}", storyPov="${storyPov}"). Write natively in natural contemporary Japanese. Do not draft in English or Korean and translate afterward.`,
      ...(cafeSettingParts.length ? [`- Cafe setting supplied by app: ${cafeSettingParts.join(' / ')}.`] : []),
      ...planBrief,
      sourceLine,
      '- Treat the pack as a 5-act cafe story album. For a 15-track run, keep exactly 3 tracks per act: Act 1 arrival/first expression/place/season; Act 2 conversation/tea/coffee/small actions; Act 3 realization/central hook; Act 4 hesitation/resentment/unsaid words; Act 5 leaving cafe/message/station/umbrella/seaside/next promise.',
      '- Keep the cafe as the event center. Short before/after movement is allowed, but do not let the pack drift into airport, moving-day, office, commute, or generic travel stories. Do not repeat the same table scene across all 15 songs.',
      '- Cafe sound policy: Chill Rap, Melodic Chill Rap, Emotional Chill House, Chill Deep House, Lounge House, Lo-fi House, light Jazz Rap accents, organic warm cafe groove, and subtle city-pop color.',
      '- Avoid festival EDM, big-room drop, aggressive club build, hard trap/drill, overdone hi-hat, shouting, theatrical belting, senior crooner, and enka vibrato.',
      ...sharedLines,
      ...trackMap
    ];
  }

  return [
    '',
    '[JP CHILI LAB STORY POV CONTRACT]',
    `- Workspace is "jp-chillhop"; POV selector is ${povLabel} (storyPov="${storyPov}"). Write natively in natural contemporary Japanese. Do not draft in English or Korean and translate afterward.`,
    '- For 彼のSTORY / 彼女のSTORY, every lyric must stay first-person from that POV. This is not a pronoun swap: change memories, details, guilt, hesitation, and emotional logic for that side.',
    sourceLine,
    ...planBrief,
    '- Treat the pack as one 5-act story album. For a 15-track run, keep exactly 3 tracks per act; for any other songCount, keep all 5 acts represented in order.',
    '- Preserve each track\'s storyAct, storyActLabel, and storyArcRole from preassignedSongs. Use those fields as narrative structure, not as literal lyric text.',
    ...sharedLines,
    ...trackMap
  ];
}

export function chiliStoryContractSummaryKo(opts: ChiliStoryOptionsLike): string {
  if (!isJapaneseChiliStoryOptions(opts)) return '';
  const isCafe = isJpCafeChillhopOptions(opts);
  const storyPov = storyPovFromOptions(opts);
  const quota = resolveEffectiveStoryVocalQuota(opts);
  const quotaText = quota ? `남성 ${quota.male} / 여성 ${quota.female} / 혼성 ${quota.mixed}` : '보컬 하드락 없음';
  const sourceText = opts.storySourceSummary?.trim()
    ? `원작 사건: ${opts.storySourceEpisodeId ? `${opts.storySourceEpisodeId}. ` : ''}${opts.storySourceTitle || '제목 없음'}`
    : '원작 사건 미입력';
  const label = (isCafe ? CAFE_STORY_MODE_LABEL_JA : CHILI_STORY_POV_LABEL_JA)[storyPov];
  return `${label} · 일본어 고정 · ${quotaText} · ${isCafe ? '카페 5막' : '5막'} 스토리 앨범 · ${sourceText}`;
}
