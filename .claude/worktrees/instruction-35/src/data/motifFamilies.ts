import type { WorkspaceId } from '../types';

/**
 * codex 지시문 02 (TASK C) — real gap: core/releaseReadiness.ts's own
 * "same-subject-cap" item grouped songs by EXACT lyricTheme id (its own doc
 * comment already admitted this was "근사치" — an approximation) —
 * data/lyricThemes.ts has dozens of individual theme entries sharing one of
 * only ~44 real `frameId` values (see that file's own FRAME_ID list, e.g.
 * 'dance-saturday'/'reunion-parting'/'night-drive'), so grouping by the
 * theme id itself almost never actually catches "too many songs about the
 * same subject" — an 18-song pack essentially never repeats the exact same
 * theme id 5+ times, even when 5+ songs are all, say, nightlife/motion
 * scenes. This registry groups the real 44 frameIds into coarser semantic
 * families (seeded directly from those ids' own real names/content — not
 * invented subject labels), which is the actual granularity "같은 소재"
 * needs to mean anything.
 *
 * Family membership below is a best-effort semantic grouping of REAL
 * frameId values (see data/lyricThemes.ts's own frame usages) — documented
 * as an approximation, same honesty convention as the same-subject-cap item
 * it replaces, not claimed as a precise taxonomy this app doesn't actually
 * have the content-classification power to build.
 */
export interface MotifFamily {
  id: string;
  labelKo: string;
  /** data/lyricThemes.ts frameId values that belong to this family. */
  aliases: string[];
  /** Max songs from this family allowed within ONE pack — mirrors releaseReadiness.ts's own pre-existing MAX_SAME_SUBJECT=4 default; a family can set its own tighter/looser cap. */
  maxPerPack: number;
  /**
   * How many RECENT packs (same channel) this family should stay under its
   * own cap before being leaned on heavily again — 0 means no cross-pack
   * cooldown, only the within-pack maxPerPack applies. See
   * core/motifFamilyCooldown.ts for the real consumer.
   */
  recentPackCooldown: number;
  /** Which workspaces this family is realistically relevant to; undefined = every workspace (every workspace draws from the SAME data/lyricThemes.ts pool today — see that file's own lyricThemesForArchetype). */
  workspaces?: WorkspaceId[];
}

export const MOTIF_FAMILIES: MotifFamily[] = [
  {
    id: 'romantic-connection',
    labelKo: '만남·인연·이별',
    aliases: ['young-first-love', 'reunion-parting', 'letter-sending', 'reunion-passing', 'gaze-passed', 'crossed-paths', 'promise-made', 'clean-break', 'direct-release'],
    maxPerPack: 4,
    recentPackCooldown: 2
  },
  {
    id: 'nightlife-motion',
    labelKo: '밤·이동·도시',
    aliases: ['dance-saturday', 'night-drive', 'city-lights', 'night-city-move', 'after-party', 'daylight-city', 'chase-focus'],
    maxPerPack: 4,
    recentPackCooldown: 2
  },
  {
    id: 'everyday-life',
    labelKo: '일상·이동·관계',
    aliases: ['commute-transit', 'travel-window', 'shared-table', 'threshold-decision', 'two-people-talk', 'solitary-room', 'crowd-alone'],
    maxPerPack: 4,
    recentPackCooldown: 2
  },
  {
    id: 'memory-reflection',
    labelKo: '추억·회상·계절',
    aliases: ['summer-night', 'season-turning', 'seasonal-marker', 'screen-memory', 'school-memory', 'parallel-world', 'inner-monologue', 'narrative-arc'],
    maxPerPack: 4,
    recentPackCooldown: 2
  },
  {
    id: 'self-growth',
    labelKo: '자기 확신·방향',
    aliases: ['self-affirmation', 'self-direction', 'turning-point', 'unshaken-ground', 'leading-the-approach'],
    maxPerPack: 4,
    recentPackCooldown: 2
  },
  {
    id: 'group-community',
    labelKo: '무리·축제·우정',
    aliases: ['festival-crowd', 'friends-line', 'crew-together'],
    maxPerPack: 3,
    recentPackCooldown: 2
  },
  // kr-idol-*'s own real frameId vocabulary (stage/rehearsal/backstage
  // language) — grep-verified to appear only alongside kr-idol content in
  // data/lyricThemes.ts, so scoped to those 2 workspaces rather than
  // claimed universal like the groups above.
  {
    id: 'performance-stage',
    labelKo: '무대·백스테이지',
    aliases: ['stage-declaration', 'backstage-before', 'rehearsal-grind'],
    maxPerPack: 4,
    recentPackCooldown: 2,
    workspaces: ['kr-idol-male', 'kr-idol-female']
  },
  // kr-kids/jp-kids' own real frameId vocabulary (call-and-response/counting/
  // list-song structural devices, not scene content) — same scoping
  // rationale as performance-stage above.
  {
    id: 'kids-interactive',
    labelKo: '반복·세기·묻고답하기',
    aliases: ['instruct-repeat', 'count-invite', 'list-question'],
    maxPerPack: 6,
    recentPackCooldown: 1,
    workspaces: ['kr-kids', 'jp-kids']
  }
];

const FAMILY_BY_FRAME_ID: Map<string, MotifFamily> = new Map(
  MOTIF_FAMILIES.flatMap(family => family.aliases.map(frameId => [frameId, family] as const))
);

export function motifFamilyFor(frameId: string | undefined): MotifFamily | undefined {
  if (!frameId) return undefined;
  return FAMILY_BY_FRAME_ID.get(frameId);
}

export function motifFamilyIdForFrameId(frameId: string | undefined): string | undefined {
  return motifFamilyFor(frameId)?.id;
}
