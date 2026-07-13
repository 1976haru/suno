import { BookOpen, Download, Film, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react';
import type { ChannelProfile, SavedPackMeta } from '../types';

interface SidebarProps {
  channels: ChannelProfile[];
  selectedChannelId: string;
  onSelectChannel: (id: string) => void;
  quickChannelName: string;
  onQuickChannelNameChange: (value: string) => void;
  onAddQuickChannel: () => void;
  selectedChannel: ChannelProfile;
  savedPacks: SavedPackMeta[];
  onLoadPack: (id: string) => void;
  onRenamePack: (id: string, currentName: string) => void;
  onDeletePack: (id: string) => void;
  onExportAll: () => void;
  onImportAll: (file: File) => void;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
}

export default function Sidebar({
  channels,
  selectedChannelId,
  onSelectChannel,
  quickChannelName,
  onQuickChannelNameChange,
  onAddQuickChannel,
  selectedChannel,
  savedPacks,
  onLoadPack,
  onRenamePack,
  onDeletePack,
  onExportAll,
  onImportAll,
  onOpenSettings,
  onOpenDashboard
}: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="panel-title">
        <Sparkles size={18} />
        <h2>📻 채널</h2>
      </div>
      <select value={selectedChannelId} onChange={event => onSelectChannel(event.target.value)}>
        {channels.map(channel => (
          <option key={channel.id} value={channel.id}>{channel.name}</option>
        ))}
      </select>

      <div className="inline">
        <input
          value={quickChannelName}
          onChange={event => onQuickChannelNameChange(event.target.value)}
          placeholder="+ 새 채널 이름"
        />
        <button type="button" className="icon-button" title="새 채널 추가" onClick={onAddQuickChannel}>
          <Plus size={18} />
        </button>
      </div>

      <div className="profile-summary">
        <b>{selectedChannel.englishName || selectedChannel.name}</b>
        <span>{selectedChannel.promise}</span>
      </div>

      <div className="panel-title">
        <BookOpen size={18} />
        <h2>📚 저장된 팩</h2>
      </div>
      {savedPacks.length === 0 && <p className="supporting">아직 저장된 팩이 없어요.</p>}
      <ul className="saved-pack-list">
        {savedPacks.map(pack => (
          <li key={pack.id}>
            <button type="button" className="saved-pack-name" onClick={() => onLoadPack(pack.id)}>
              {pack.isAutosave ? `🕓 ${pack.name}` : pack.name}
            </button>
            <span className="supporting">{pack.songCount}곡 · {pack.avgQualityScore}점</span>
            <div className="button-row">
              <button type="button" className="icon-button" title="이름 변경" onClick={() => onRenamePack(pack.id, pack.name)}>
                <Sparkles size={14} />
              </button>
              <button type="button" className="icon-button" title="삭제" onClick={() => onDeletePack(pack.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="button-row">
        <button type="button" onClick={onExportAll}>
          <Download size={14} />
          전체 백업
        </button>
        <label className="import-button" title="백업 불러오기">
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) onImportAll(file);
              event.target.value = '';
            }}
          />
          불러오기
        </label>
      </div>

      <button type="button" className="full-width" onClick={onOpenDashboard}>
        <Film size={16} />
        📺 영상 운영 대시보드
      </button>

      <button type="button" className="full-width" onClick={onOpenSettings}>
        <Settings2 size={16} />
        ⚙️ 설정
      </button>
    </aside>
  );
}
