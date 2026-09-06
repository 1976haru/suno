import type {
  ChannelProfile,
  ChiliStoryPov,
  GenerationOptions,
  LyricLanguage,
  LyricPerspective,
  PlaylistBlueprint,
  PreassignedSongSlot,
  ScenePlanningMode,
  WorkspaceId
} from '../types';
import { isJpChillhopArchetype } from '../utils/channelArchetype';
import type { VocalQuota } from './vocalPlan';

export const JP_CHILLHOP_WORKSPACE_ID: WorkspaceId = 'jp-chillhop';
export const JP_CHILLHOP_CHANNEL_PROFILE_ID = 'jp-chili-lab-story';
export const CHILI_STORY_DEFAULT_SONG_COUNT = 15;

export const CHILI_STORY_POV_LABEL_JA: Record<ChiliStoryPov, string> = {
  couple: 'ふたりのSTORY',
  male: '彼のSTORY',
  female: '彼女のSTORY'
};

export const CHILI_STORY_ACTS = [
  { act: 1, label: 'Act 1 / 出会い', focus: 'source event setup, first signal, emotional baseline' },
  { act: 2, label: 'Act 2 / 近づく距離', focus: 'small choices, attraction, warmer details' },
  { act: 3, label: 'Act 3 / すれ違い', focus: 'misread message, hesitation, conflict without melodrama' },
  { act: 4, label: 'Act 4 / 選び直す夜', focus: 'decision, honest confession, changed self-understanding' },
  { act: 5, label: 'Act 5 / 余韻', focus: 'afterglow, callback, forward-looking unresolved tenderness' }
] as const;

type ChiliStoryOptionsLike = {
  channel?: Pick<ChannelProfile, 'archetype' | 'id' | 'name'>;
  songCount: number;
  lyricLanguage?: LyricLanguage;
  perspective?: LyricPerspective;
  perspectiveMode?: GenerationOptions['perspectiveMode'];
  perspectiveModeIsExplicitChoice?: boolean;
  vocalQuota?: VocalQuota;
  vocalQuotaMode?: GenerationOptions['vocalQuotaMode'];
  scenePlanningMode?: ScenePlanningMode;
  storyPov?: ChiliStoryPov;
  storySourceEpisodeId?: string;
  storySourceTitle?: string;
  storySourceSummary?: string;
  storyPreviousContext?: string;
  storyNextHint?: string;
  storyLocation?: string;
  storySeason?: string;
};

export interface ParsedChiliStoryLine {
  storySourceEpisodeId: string;
  storySourceTitle: string;
  storySourceSummary: string;
}

export function normalizeChiliStoryPov(value: unknown): ChiliStoryPov {
  return value === 'male' || value === 'female' || value === 'couple' ? value : 'couple';
}

export function isSoloChiliStoryPov(pov: ChiliStoryPov | undefined): pov is 'male' | 'female' {
  return pov === 'male' || pov === 'female';
}

export function isJpChillhopOptions(opts: { channel?: { archetype?: string } }): boolean {
  return isJpChillhopArchetype(opts.channel?.archetype);
}

export function vocalQuotaForChiliStoryPov(pov: ChiliStoryPov, songCount: number): VocalQuota | undefined {
  const total = Math.max(0, Math.round(songCount));
  if (pov === 'male') return { male: total, female: 0, mixed: 0 };
  if (pov === 'female') return { male: 0, female: total, mixed: 0 };
  return undefined;
}

export function applyChiliStoryGenerationContract<T extends ChiliStoryOptionsLike>(opts: T): T {
  if (!isJpChillhopOptions(opts)) return opts;
  const storyPov = normalizeChiliStoryPov(opts.storyPov);
  const base = {
    ...opts,
    lyricLanguage: 'japanese',
    storyPov
  } as T;
  if (!isSoloChiliStoryPov(storyPov)) return base;
  const sourceSummaryPresent = Boolean(opts.storySourceSummary?.trim());
  const scenePlanningMode = sourceSummaryPresent
    ? 'same-story-comparison'
    : base.scenePlanningMode === 'same-story-comparison'
      ? undefined
      : base.scenePlanningMode;
  return {
    ...base,
    perspective: 'firstPerson',
    perspectiveMode: 'fixed',
    perspectiveModeIsExplicitChoice: true,
    vocalQuota: vocalQuotaForChiliStoryPov(storyPov, opts.songCount),
    vocalQuotaMode: 'balanced',
    scenePlanningMode
  } as T;
}

export function parseChiliStoryLine(input: string): ParsedChiliStoryLine | null {
  const match = input.trim().match(/^(\d{1,4})\s*[\.)]\s*([^—–-]+?)\s*[—–-]\s*(.+)$/);
  if (!match) return null;
  return {
    storySourceEpisodeId: match[1].padStart(3, '0'),
    storySourceTitle: match[2].trim(),
    storySourceSummary: match[3].trim()
  };
}

function nonEmptyField<T extends string>(value: T | undefined): T | undefined {
  return value && value.trim() ? value.trim() as T : undefined;
}

function storySourceFields(opts: ChiliStoryOptionsLike) {
  return {
    ...(nonEmptyField(opts.storySourceEpisodeId) ? { storySourceEpisodeId: nonEmptyField(opts.storySourceEpisodeId) } : {}),
    ...(nonEmptyField(opts.storySourceTitle) ? { storySourceTitle: nonEmptyField(opts.storySourceTitle) } : {}),
    ...(nonEmptyField(opts.storySourceSummary) ? { storySourceSummary: nonEmptyField(opts.storySourceSummary) } : {}),
    ...(nonEmptyField(opts.storyPreviousContext) ? { storyPreviousContext: nonEmptyField(opts.storyPreviousContext) } : {}),
    ...(nonEmptyField(opts.storyNextHint) ? { storyNextHint: nonEmptyField(opts.storyNextHint) } : {}),
    ...(nonEmptyField(opts.storyLocation) ? { storyLocation: nonEmptyField(opts.storyLocation) } : {}),
    ...(nonEmptyField(opts.storySeason) ? { storySeason: nonEmptyField(opts.storySeason) } : {})
  };
}

export function chiliStoryActForTrack(trackNo: number, songCount: number): { storyAct: number; storyActLabel: string } {
  const total = Math.max(1, songCount);
  const actIndex = total === CHILI_STORY_DEFAULT_SONG_COUNT
    ? Math.min(CHILI_STORY_ACTS.length - 1, Math.floor((Math.max(1, trackNo) - 1) / 3))
    : Math.min(CHILI_STORY_ACTS.length - 1, Math.floor(((Math.max(1, trackNo) - 1) * CHILI_STORY_ACTS.length) / total));
  const act = CHILI_STORY_ACTS[actIndex];
  return { storyAct: act.act, storyActLabel: act.label };
}

export function chiliStoryArcRoleForTrack(trackNo: number, songCount: number, pov: ChiliStoryPov = 'couple'): string {
  const { storyAct } = chiliStoryActForTrack(trackNo, songCount);
  const inActPosition = songCount === CHILI_STORY_DEFAULT_SONG_COUNT ? ((trackNo - 1) % 3) + 1 : undefined;
  const povTail = pov === 'male'
    ? 'from his inner first-person angle'
    : pov === 'female'
      ? 'from her inner first-person angle'
      : 'holding both sides without locking vocal gender';
  const actRoles: Record<number, string[]> = {
    1: ['opening memory anchor', 'first close detail', 'the feeling becomes undeniable'],
    2: ['shared routine begins', 'private signal grows', 'almost-confession'],
    3: ['message or timing misread', 'silence stretches', 'lowest emotional night'],
    4: ['decision to speak honestly', 'confession or repair', 'new promise tested'],
    5: ['quiet morning after', 'callback with changed meaning', 'afterglow closer']
  };
  const rolePool = actRoles[storyAct] ?? actRoles[5];
  const role = inActPosition ? rolePool[inActPosition - 1] : rolePool[Math.min(rolePool.length - 1, Math.max(0, Math.floor((trackNo - 1) % rolePool.length)))];
  return `${role} — ${povTail}`;
}

export function buildChiliStoryArc(songCount = CHILI_STORY_DEFAULT_SONG_COUNT) {
  const tracks = Array.from({ length: Math.max(0, songCount) }, (_, idx) => idx + 1);
  return {
    model: 'jp-chillhop-five-act-story',
    songCount,
    expectedTracksPerAct: songCount === CHILI_STORY_DEFAULT_SONG_COUNT ? 3 : undefined,
    acts: CHILI_STORY_ACTS.map(act => ({
      act: act.act,
      label: act.label,
      focus: act.focus,
      trackNos: tracks.filter(trackNo => chiliStoryActForTrack(trackNo, songCount).storyAct === act.act)
    }))
  };
}

export function storyMetaFieldsFromOptions(opts: ChiliStoryOptionsLike): Partial<NonNullable<PlaylistBlueprint['meta']>> {
  if (!isJpChillhopOptions(opts)) return {};
  const storyPov = normalizeChiliStoryPov(opts.storyPov);
  return {
    workspaceId: JP_CHILLHOP_WORKSPACE_ID,
    storyPov,
    ...storySourceFields(opts),
    storyArc: buildChiliStoryArc(opts.songCount)
  };
}

export function chiliStorySlotFields(opts: ChiliStoryOptionsLike, trackNo: number): Partial<PreassignedSongSlot> {
  if (!isJpChillhopOptions(opts)) return {};
  const storyPov = normalizeChiliStoryPov(opts.storyPov);
  const act = chiliStoryActForTrack(trackNo, opts.songCount);
  return {
    storyPov,
    ...storySourceFields(opts),
    ...act,
    storyArcRole: chiliStoryArcRoleForTrack(trackNo, opts.songCount, storyPov)
  };
}

export function storyFieldsFromSlot(slot: PreassignedSongSlot): Partial<SongStoryFields> {
  return {
    ...(slot.storyPov ? { storyPov: slot.storyPov } : {}),
    ...(slot.storySourceEpisodeId ? { storySourceEpisodeId: slot.storySourceEpisodeId } : {}),
    ...(slot.storySourceTitle ? { storySourceTitle: slot.storySourceTitle } : {}),
    ...(slot.storySourceSummary ? { storySourceSummary: slot.storySourceSummary } : {}),
    ...(slot.storyPreviousContext ? { storyPreviousContext: slot.storyPreviousContext } : {}),
    ...(slot.storyNextHint ? { storyNextHint: slot.storyNextHint } : {}),
    ...(slot.storyLocation ? { storyLocation: slot.storyLocation } : {}),
    ...(slot.storySeason ? { storySeason: slot.storySeason } : {}),
    ...(slot.storyAct !== undefined ? { storyAct: slot.storyAct } : {}),
    ...(slot.storyActLabel ? { storyActLabel: slot.storyActLabel } : {}),
    ...(slot.storyArcRole ? { storyArcRole: slot.storyArcRole } : {})
  };
}

type SongStoryFields = Pick<
  PreassignedSongSlot,
  | 'storyPov'
  | 'storySourceEpisodeId'
  | 'storySourceTitle'
  | 'storySourceSummary'
  | 'storyPreviousContext'
  | 'storyNextHint'
  | 'storyLocation'
  | 'storySeason'
  | 'storyAct'
  | 'storyActLabel'
  | 'storyArcRole'
>;

export function rawStoryFieldsFromObject(obj: Record<string, unknown>): Partial<SongStoryFields> {
  const storyPov = normalizeChiliStoryPov(obj.storyPov);
  return {
    ...(obj.storyPov ? { storyPov } : {}),
    ...(nonEmptyField(typeof obj.storySourceEpisodeId === 'string' ? obj.storySourceEpisodeId : undefined) ? { storySourceEpisodeId: String(obj.storySourceEpisodeId).trim() } : {}),
    ...(nonEmptyField(typeof obj.storySourceTitle === 'string' ? obj.storySourceTitle : undefined) ? { storySourceTitle: String(obj.storySourceTitle).trim() } : {}),
    ...(nonEmptyField(typeof obj.storySourceSummary === 'string' ? obj.storySourceSummary : undefined) ? { storySourceSummary: String(obj.storySourceSummary).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyPreviousContext === 'string' ? obj.storyPreviousContext : undefined) ? { storyPreviousContext: String(obj.storyPreviousContext).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyNextHint === 'string' ? obj.storyNextHint : undefined) ? { storyNextHint: String(obj.storyNextHint).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyLocation === 'string' ? obj.storyLocation : undefined) ? { storyLocation: String(obj.storyLocation).trim() } : {}),
    ...(nonEmptyField(typeof obj.storySeason === 'string' ? obj.storySeason : undefined) ? { storySeason: String(obj.storySeason).trim() } : {}),
    ...(typeof obj.storyAct === 'number' ? { storyAct: obj.storyAct } : {}),
    ...(nonEmptyField(typeof obj.storyActLabel === 'string' ? obj.storyActLabel : undefined) ? { storyActLabel: String(obj.storyActLabel).trim() } : {}),
    ...(nonEmptyField(typeof obj.storyArcRole === 'string' ? obj.storyArcRole : undefined) ? { storyArcRole: String(obj.storyArcRole).trim() } : {})
  };
}

export function buildJpChillhopStoryInstructionLines(
  opts: ChiliStoryOptionsLike,
  preassignedSongs: readonly PreassignedSongSlot[]
): string[] {
  if (!isJpChillhopOptions(opts)) return [];
  const storyPov = normalizeChiliStoryPov(opts.storyPov);
  const povLabel = CHILI_STORY_POV_LABEL_JA[storyPov];
  const source = storySourceFields(opts);
  const sourceLine = source.storySourceSummary
    ? `- Source event: episode ${source.storySourceEpisodeId ?? '(unlisted)'} "${source.storySourceTitle ?? 'untitled'}" — ${source.storySourceSummary}`
    : '- Source event: no user episode summary was supplied; create one coherent original Japanese relationship episode and keep it consistent across all tracks.';
  const vocalLine = storyPov === 'male'
    ? `- VOCAL HARD LOCK: every one of the ${opts.songCount} songs is male vocal only. Do not write female lead, duet, mixed, group, or gender-ambiguous lead vocal.`
    : storyPov === 'female'
      ? `- VOCAL HARD LOCK: every one of the ${opts.songCount} songs is female vocal only. Do not write male lead, duet, mixed, group, or gender-ambiguous lead vocal.`
      : '- Couple POV: do not hard-lock vocal gender here; keep the two-person relationship continuous without reducing it to a pronoun swap.';
  return [
    '',
    '[JP CHILI LAB STORY POV CONTRACT]',
    `- Workspace is "jp-chillhop"; POV selector is ${povLabel} (storyPov="${storyPov}"). Write natively in natural contemporary Japanese. Do not draft in English or Korean and translate afterward.`,
    vocalLine,
    '- For 彼のSTORY / 彼女のSTORY, every lyric must stay first-person from that POV. This is not a pronoun swap: change memories, details, guilt, hesitation, and emotional logic for that side.',
    sourceLine,
    `- Treat the pack as one 5-act story album. For a 15-track run, keep exactly 3 tracks per act; for any other songCount, keep all 5 acts represented in order.`,
    '- Preserve each track\'s storyAct, storyActLabel, and storyArcRole from preassignedSongs. Use those fields as narrative structure, not as literal lyric text.',
    '- Titles and hookPhrase values must not duplicate within the pack. A hook may connect semantically to the title, but do not reuse one formula or one refrain across multiple tracks.',
    '- Lyrics must sound like fluent sung Japanese: conversational, specific, emotionally restrained, and free of translationese. Avoid Korean fallback, romanized filler, and stiff textbook constructions.',
    '- Keep Suno "stylePrompt" and "lyrics" separate. Put visual identity, typography, thumbnail, and layout language only in thumbnail/YouTube fields, never in stylePrompt.',
    '- Do not imitate, name, evoke as soundalike, clone, or request the vocal style of any famous artist, band, song, melody, cover, or copyrighted recording.',
    '',
    'Track story arc map:',
    ...preassignedSongs.map(slot => `- T${slot.trackNo}: ${slot.storyActLabel ?? chiliStoryActForTrack(slot.trackNo, opts.songCount).storyActLabel} — ${slot.storyArcRole ?? chiliStoryArcRoleForTrack(slot.trackNo, opts.songCount, storyPov)} — vocal=${slot.vocalType ?? 'planned by slot'} — title="${slot.title}" — hook="${slot.hookPhrase}"`)
  ];
}

export function chiliStoryContractSummaryKo(opts: ChiliStoryOptionsLike): string {
  if (!isJpChillhopOptions(opts)) return '';
  const storyPov = normalizeChiliStoryPov(opts.storyPov);
  const quota = vocalQuotaForChiliStoryPov(storyPov, opts.songCount);
  const quotaText = quota ? `남 ${quota.male} · 여 ${quota.female} · 혼성 ${quota.mixed}` : '보컬 하드락 없음';
  const sourceText = opts.storySourceSummary?.trim()
    ? `원작 사건: ${opts.storySourceEpisodeId ? `${opts.storySourceEpisodeId}. ` : ''}${opts.storySourceTitle || '제목 없음'}`
    : '원작 사건 미입력';
  return `${CHILI_STORY_POV_LABEL_JA[storyPov]} · 일본어 고정 · ${quotaText} · 5막 스토리 앨범 · ${sourceText}`;
}
