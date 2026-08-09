import type { ChannelArchetype, WorkspaceId } from '../types';
import { channelPresets } from '../data/presets';
import { readStoredChannelsForWorkspace } from '../utils/channelProfile';
import { workspaceDefinitions, workspaceForArchetype } from '../data/workspaces';

/**
 * 지시문 14 (TASK C-3 / TASK D) — the one real gap both this directive's
 * tasks hit independently: nothing in this codebase ever resolved a bare
 * channelId string back to the archetype/workspace that owns it. Checks the
 * built-in presets first (data/presets.ts, no storage read needed), then
 * falls back to scanning every workspace's own stored custom channels
 * (utils/channelProfile.ts's readStoredChannelsForWorkspace — already
 * workspace-scoped storage, one key per workspace) — a channel like
 * "oldpoplounge" that isn't a shipped preset is almost always a custom
 * channel created inside some workspace's own channel editor.
 *
 * Pure/sync: readStoredChannelsForWorkspace only reads localStorage
 * synchronously. Returns undefined (never guesses) when nothing matches —
 * a real, expected outcome in a non-browser context (Node has no
 * localStorage at all) or for a channelId that was renamed/deleted since
 * the record was written. Callers decide their own fallback (see
 * core/historyBackfill.ts's default-to-current-workspace vs.
 * situationLedger.ts's own migration 'unknown' tag — two different, both
 * legitimate, policies for the same unresolved case).
 */
export function resolveArchetypeForChannel(channelId: string): ChannelArchetype | undefined {
  const preset = channelPresets.find(channel => channel.id === channelId);
  if (preset?.archetype) return preset.archetype;
  for (const workspace of workspaceDefinitions) {
    const custom = readStoredChannelsForWorkspace(workspace.id).find(channel => channel.id === channelId);
    if (custom?.archetype) return custom.archetype;
  }
  return undefined;
}

export function resolveWorkspaceIdForChannel(channelId: string): WorkspaceId | undefined {
  const archetype = resolveArchetypeForChannel(channelId);
  return archetype ? workspaceForArchetype(archetype)?.id : undefined;
}
