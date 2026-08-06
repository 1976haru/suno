import { APP_VERSION, BUILT_AT, COMMIT_SHA } from './buildInfo';
import { CURRENT_SCHEMA_VERSION } from './schemaVersion';
import { currentWorkspaceId } from './workspaceScope';
import { stableHash } from './generationPreflight';
import type { ChannelArchetype, ChannelProfile, GenerationOptions, LyricLanguage, PreassignedSongSlot, WorkspaceId } from '../types';

/**
 * v4.0 (TASK C) — every export this app produces (가사 JSON, 워크스페이스 백업,
 * CSV, 독립 수노모드 HTML, SRT zip manifest) previously carried, at best, its
 * own ad-hoc timestamp — nothing said which app version or IndexedDB schema
 * shape produced the file, so an old export re-imported into a newer app
 * (or vice versa) had no way to detect a mismatch before failing partway
 * through. One shared shape, used by every exporter, so a future format
 * change only needs a `schemaVersion` bump here to be enforceable
 * everywhere at once.
 *
 * `schemaVersion` starts at 1 for this task; a real per-store IndexedDB
 * schemaVersion (see core/workspaceTransfer.ts's own import-time check) is
 * the thing this number is meant to travel alongside, not a duplicate of
 * `exportFormatVersion` (which versions the FILE'S shape, e.g.
 * workspaceTransfer.ts's own TRANSFER_FORMAT_VERSION) or `appVersion`
 * (which versions the whole app).
 *
 * v5.14 — now derived from schemaVersion.ts's CURRENT_SCHEMA_VERSION (the
 * canonical constant as of this task) rather than the other way around;
 * see that file's own doc comment for why the direction flipped
 * (buildInfo.ts needed the schema version too, and exportMeta.ts already
 * imports APP_VERSION/COMMIT_SHA from buildInfo.ts, so the old direction
 * would have created a cycle). Value is unchanged (still 1).
 */
export const EXPORT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
export const EXPORT_FORMAT_VERSION = 1;

export interface ExportMeta {
  appVersion: string;
  schemaVersion: number;
  commitSha: string;
  /** v5.14 — when this build was produced (see core/buildInfo.ts's BUILD_INFO.builtAt); 'dev' outside a real `npm run build`. */
  builtAt: string;
  workspaceId: WorkspaceId;
  generatedAt: string;
  exportFormatVersion: number;
  /**
   * TASK (post-generation operation snapshot, TASK 5 — expand import file
   * meta) — real gap: every export before this task carried, at best, the
   * channel's display NAME (blueprint.channelName, a free-text string a
   * remote model wrote) and this module's own pre-existing workspaceId/
   * schemaVersion/appVersion — nothing machine-readable enough to
   * reconstruct the real generation context (which channel id, which
   * archetype, which language, which genres/moods, which money-chord/vocal
   * settings, how many songs, or what slot plan) a re-imported file was
   * actually generated under. These 9 fields are populated together, from a
   * single real GenerationOptions (+ optional slot plan) — see
   * `generationContext` below — never partially, so a consumer never sees
   * some new fields present and others silently missing from the same
   * export. Undefined for every export whose blueprint has no
   * GenerationSnapshot (types.ts) to source them from — an old pack from
   * before this task, or a display-only synthetic blueprint — same graceful
   * degradation this module's pre-existing fields already have.
   */
  channelId?: string;
  archetype?: ChannelArchetype;
  lyricLanguage?: LyricLanguage;
  genreIds?: string[];
  moodIds?: string[];
  moneyChordMode?: string;
  vocalTone?: string;
  songCount?: number;
  /** stableHash (core/generationPreflight.ts) over the real preassigned slot plan this pack was generated against — lets an importer detect whether two exports of "the same" pack actually planned identical slots, without embedding the (much larger) slot array itself. Undefined when no slot plan was supplied. */
  preassignedSlotHash?: string;
}

export interface ExportGenerationContext {
  channel: ChannelProfile;
  options: Pick<GenerationOptions, 'lyricLanguage' | 'genreIds' | 'moodIds' | 'moneyChordMode' | 'vocalTone' | 'songCount'>;
  slots?: PreassignedSongSlot[];
}

/**
 * `generatedAt` defaults to "now" (export time) — callers with their own
 * more meaningful timestamp (e.g. PlaylistBlueprint.generatedAt, a set's
 * actual generation time) should pass it explicitly.
 *
 * `generationContext` (TASK 5) — the real, resolved generation context this
 * export's channelId/archetype/lyricLanguage/genreIds/moodIds/
 * moneyChordMode/vocalTone/songCount/preassignedSlotHash fields are sourced
 * from (typically a PlaylistBlueprint.generationSnapshot's own channel/
 * options/slots — see utils/exporters.ts's exportJson). Omitted entirely for
 * a blueprint with no snapshot, leaving those 9 fields undefined exactly as
 * they were before this task.
 */
export function buildExportMeta(generatedAt?: string, workspaceId: WorkspaceId = currentWorkspaceId(), generationContext?: ExportGenerationContext): ExportMeta {
  return {
    appVersion: APP_VERSION,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    commitSha: COMMIT_SHA,
    builtAt: BUILT_AT,
    workspaceId,
    generatedAt: generatedAt ?? new Date().toISOString(),
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    ...(generationContext ? {
      channelId: generationContext.channel.id,
      archetype: generationContext.channel.archetype,
      lyricLanguage: generationContext.options.lyricLanguage,
      genreIds: generationContext.options.genreIds,
      moodIds: generationContext.options.moodIds,
      moneyChordMode: generationContext.options.moneyChordMode,
      vocalTone: generationContext.options.vocalTone,
      songCount: generationContext.options.songCount,
      ...(generationContext.slots ? { preassignedSlotHash: stableHash(generationContext.slots) } : {})
    } : {})
  };
}
