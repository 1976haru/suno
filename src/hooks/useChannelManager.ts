import { useEffect, useMemo, useState } from 'react';
import { channelPresets } from '../data/presets';
import { createDraftChannel, makeUniqueId, normalizeChannel, readStoredChannels, writeStoredChannels } from '../utils/channelProfile';
import type { ChannelProfile } from '../types';

const defaultChannel = channelPresets[0];

export function useChannelManager(onApply: (channel: ChannelProfile) => void) {
  const [customChannels, setCustomChannels] = useState<ChannelProfile[]>(() => readStoredChannels());
  const channels = useMemo(() => [...channelPresets, ...customChannels], [customChannels]);
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
