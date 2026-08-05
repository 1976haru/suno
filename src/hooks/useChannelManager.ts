import { useEffect, useMemo, useState } from 'react';
import { channelPresets } from '../data/presets';
import { createDraftChannel, makeUniqueId, normalizeChannel, readStoredChannels, writeStoredChannels } from '../utils/channelProfile';
import { getWorkspace } from '../data/workspaces';
import type { ChannelProfile, WorkspaceId } from '../types';

/**
 * v5.7 (TASK A) — real audit finding (docs/v56-report.md §10, browser-
 * verified): this used to import `channelPresets` wholesale with no
 * workspace filter at all, so switching to kr-2030/kr-kids/jp-kids still
 * showed all 25 built-in channels including senior's own ("굿모닝
 * 추억라디오"), which was also always the hardcoded default selection
 * regardless of workspace — directly contradicting the workspace-select
 * screen's own promise ("다른 워크스페이스의 채널·팩·훅·평가는 여기서 보이지
 * 않습니다"). Every channel preset has a real `archetype` field (verified:
 * 25/25, no undefined) and every WorkspaceDefinition has a real
 * `archetypeIds` list, so filtering by `archetypeIds.includes(channel.archetype)`
 * needed no new data — it was already there, just never applied here.
 * Custom channels don't need the same filter: `readStoredChannels()` is
 * already workspace-scoped via `scopedKey()` (a separate localStorage slot
 * per workspace), confirmed by the same audit's isolation checks.
 */
function presetsForWorkspace(workspaceId: WorkspaceId): ChannelProfile[] {
  const archetypeIds = new Set(getWorkspace(workspaceId).archetypeIds);
  const scoped = channelPresets.filter(channel => channel.archetype && archetypeIds.has(channel.archetype));
  // Defensive fallback only — every current workspace has at least one matching preset (v5.6 audit §1), but a
  // future workspace shipped without one should still get a usable default instead of an empty channel list.
  return scoped.length ? scoped : channelPresets;
}

export function useChannelManager(workspaceId: WorkspaceId, onApply: (channel: ChannelProfile) => void) {
  const presets = useMemo(() => presetsForWorkspace(workspaceId), [workspaceId]);
  const defaultChannel = presets[0];
  const [customChannels, setCustomChannels] = useState<ChannelProfile[]>(() => readStoredChannels());
  const channels = useMemo(() => [...presets, ...customChannels], [presets, customChannels]);
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannel.id);
  const selectedChannel = channels.find(channel => channel.id === selectedChannelId) || defaultChannel;
  const [editorChannel, setEditorChannel] = useState<ChannelProfile>(() => ({ ...defaultChannel }));
  const [quickChannelName, setQuickChannelName] = useState('');
  const isSelectedCustom = customChannels.some(channel => channel.id === selectedChannelId);

  useEffect(() => {
    writeStoredChannels(customChannels);
  }, [customChannels]);

  function selectChannel(id: string) {
    const channel = channels.find(item => item.id === id) || defaultChannel;
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    onApply(channel);
  }

  function addQuickChannel() {
    const name = quickChannelName.trim();
    if (!name) return;
    const existingIds = new Set(channels.map(channel => channel.id));
    const channel = normalizeChannel({ ...createDraftChannel(name), id: makeUniqueId(name, existingIds) });
    setCustomChannels(prev => [...prev, channel]);
    setQuickChannelName('');
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    onApply(channel);
  }

  function startNewProfile() {
    const existingIds = new Set(channels.map(channel => channel.id));
    const channel = normalizeChannel({ ...createDraftChannel(), id: makeUniqueId('new-playlist-channel', existingIds) });
    setEditorChannel(channel);
  }

  function saveEditorProfile() {
    const editingCustom = customChannels.some(channel => channel.id === editorChannel.id);
    const existingIds = new Set(channels.map(channel => channel.id));
    const id = editingCustom
      ? editorChannel.id
      : makeUniqueId(editorChannel.englishName || editorChannel.name, existingIds);
    const channel = normalizeChannel({ ...editorChannel, id });

    setCustomChannels(prev => (
      editingCustom
        ? prev.map(item => (item.id === channel.id ? channel : item))
        : [...prev, channel]
    ));
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    onApply(channel);
  }

  function deleteSelectedCustomChannel() {
    if (!isSelectedCustom) return;
    setCustomChannels(prev => prev.filter(channel => channel.id !== selectedChannelId));
    setSelectedChannelId(defaultChannel.id);
    setEditorChannel({ ...defaultChannel });
    onApply(defaultChannel);
  }

  function updateEditorField<K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) {
    setEditorChannel(prev => ({ ...prev, [key]: value }));
  }

  return {
    channels,
    selectedChannelId,
    setSelectedChannelId,
    selectedChannel,
    editorChannel,
    quickChannelName,
    setQuickChannelName,
    isSelectedCustom,
    selectChannel,
    addQuickChannel,
    startNewProfile,
    saveEditorProfile,
    deleteSelectedCustomChannel,
    updateEditorField
  };
}
