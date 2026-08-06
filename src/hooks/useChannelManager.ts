import { useEffect, useMemo, useState } from 'react';
import { channelPresets } from '../data/presets';
import { createDraftChannel, makeUniqueId, normalizeChannel, readStoredChannels, validateChannelProfile, writeStoredChannels } from '../utils/channelProfile';
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
export function presetsForWorkspace(workspaceId: WorkspaceId): ChannelProfile[] {
  const archetypeIds = new Set(getWorkspace(workspaceId).archetypeIds);
  const scoped = channelPresets.filter(channel => channel.archetype && archetypeIds.has(channel.archetype));
  // Defensive fallback only — every current workspace has at least one matching preset (v5.6 audit §1), but a
  // future workspace shipped without one should still get a usable default instead of an empty channel list.
  return scoped.length ? scoped : channelPresets;
}

/**
 * v5.9 (TASK: workspace-scoped draft channels §4) — real user data that may
 * already exist from before this fix: a custom channel saved while
 * createDraftChannel had no workspace context could have any archetype at
 * all under any workspace's own storage slot. Deliberately does NOT auto-fix
 * anything (a mismatch could be the user's own deliberate choice, e.g. a
 * hand-built mixed-genre custom channel) — just names which stored channels
 * don't belong to this workspace's own archetypeIds so the caller can warn.
 */
export function findArchetypeMismatches(workspaceId: WorkspaceId, channels: ChannelProfile[]): ChannelProfile[] {
  const allowed = new Set(getWorkspace(workspaceId).archetypeIds);
  return channels.filter(channel => channel.archetype && !allowed.has(channel.archetype));
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
  // v5.9 (TASK §4) — computed once at load time from the lazy initializer
  // above's own read, not re-derived reactively off `customChannels`: this
  // component is remounted with key={workspaceId} on every workspace switch
  // (see App.tsx's WizardApp), so a fresh mount always re-checks the right
  // workspace's own storage slot, and a user dismissing the warning won't
  // see it silently reappear just because customChannels' array identity
  // changed for an unrelated reason (e.g. autosave's own writeStoredChannels effect).
  const [archetypeMismatchWarning, setArchetypeMismatchWarning] = useState<string | null>(() => {
    const mismatches = findArchetypeMismatches(workspaceId, customChannels);
    if (!mismatches.length) return null;
    const names = mismatches.map(channel => `"${channel.name}"`).join(', ');
    return `이 워크스페이스에서 사용할 수 없는 채널 유형을 가진 커스텀 채널이 있습니다: ${names}. 자동으로 바꾸지 않았습니다 — 의도한 설정일 수 있으니, 필요하면 채널 편집기에서 직접 확인하고 저장하세요.`;
  });

  function dismissArchetypeMismatchWarning() {
    setArchetypeMismatchWarning(null);
  }

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
    // v5.9 (TASK §1/§2) — passes this workspace's own default preset so the
    // new draft clones its archetype/audience/market/defaultVocal/preferredGenres
    // instead of falling through to createDraftChannel's unscoped 'senior-morning' default.
    const channel = normalizeChannel({ ...createDraftChannel(name, defaultChannel), id: makeUniqueId(name, existingIds) });
    setCustomChannels(prev => [...prev, channel]);
    setQuickChannelName('');
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    onApply(channel);
  }

  function startNewProfile() {
    const existingIds = new Set(channels.map(channel => channel.id));
    // v5.9 (TASK §1/§2) — same workspace-templated draft as addQuickChannel above.
    const channel = normalizeChannel({ ...createDraftChannel(undefined, defaultChannel), id: makeUniqueId('new-playlist-channel', existingIds) });
    setEditorChannel(channel);
  }

  /**
   * v5.9 (TASK §3) — save-time guard: Step1Channel's archetype card grid
   * (components/steps/Step1Channel.tsx's archetypeChoices) shows every
   * archetype across every workspace, not just the current one, so a user
   * can still click a foreign archetype's card even though this hook now
   * seeds workspace-correct drafts. Blocks the save and surfaces a clear
   * error rather than silently persisting a channel that doesn't belong to
   * this workspace. Uses window.alert — the same blocking-notice mechanism
   * main.tsx already uses for its own schema/recovery messages — since this
   * hook has no dedicated error-return contract for its callers to display
   * inline. Returns a boolean so a future caller can react to the outcome;
   * existing JSX `onClick={onSave}` callers simply ignore it, unaffected.
   */
  function saveEditorProfile(): boolean {
    const allowedArchetypes = new Set(getWorkspace(workspaceId).archetypeIds);
    if (editorChannel.archetype && !allowedArchetypes.has(editorChannel.archetype)) {
      window.alert('현재 워크스페이스에서 사용할 수 없는 채널 유형입니다. 다른 채널 유형을 선택한 뒤 다시 저장하세요.');
      return false;
    }
    const editingCustom = customChannels.some(channel => channel.id === editorChannel.id);
    const existingIds = new Set(channels.map(channel => channel.id));
    const id = editingCustom
      ? editorChannel.id
      : makeUniqueId(editorChannel.englishName || editorChannel.name, existingIds);
    const channel = normalizeChannel({ ...editorChannel, id });

    // TASK v5.18 (TASK F, P2) — real-value guard on top of normalizeChannel's
    // own fill-in-what's-missing pass, so a channel with a genre/mood id
    // that no longer exists (or a market/language/audience/archetype string
    // normalizeChannel doesn't itself validate) is caught here, at save
    // time, instead of silently persisting and failing much later inside an
    // actual generation run.
    const validation = validateChannelProfile(channel);
    if (!validation.valid) {
      window.alert(`채널을 저장할 수 없습니다:\n${validation.errors.join('\n')}`);
      return false;
    }

    setCustomChannels(prev => (
      editingCustom
        ? prev.map(item => (item.id === channel.id ? channel : item))
        : [...prev, channel]
    ));
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    onApply(channel);
    return true;
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
    updateEditorField,
    archetypeMismatchWarning,
    dismissArchetypeMismatchWarning
  };
}
