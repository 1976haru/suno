import { Wand2 } from 'lucide-react';
import type { SongIdea } from '../types';

interface HybridRefinePanelProps {
  songs: SongIdea[];
  selected: number[];
  onToggle: (trackNo: number) => void;
  onRefine: () => void;
  isRefining: boolean;
  refineProgress: { done: number; total: number };
  refineWarnings: string[];
}

export default function HybridRefinePanel({ songs, selected, onToggle, onRefine, isRefining, refineProgress, refineWarnings }: HybridRefinePanelProps) {
  return (
    <div className="provider-summary">
      <div className="panel-title">
        <Wand2 size={18} />
        <h2>하이브리드 모드 — AI로 다듬을 곡 선택</h2>
      </div>
      <p className="supporting">
        지금 곡들은 로컬 템플릿으로 만든 무료 초안입니다. 마음에 드는 곡은 그대로 두고, AI로 더 다듬고 싶은 곡만 선택하세요.
        선택하지 않은 곡은 API로 전송되지 않습니다.
      </p>
      <div className="avoid-word-list">
        {songs.map(song => (
          <label key={song.trackNo} className="avoid-word-item">
            <input type="checkbox" checked={selected.includes(song.trackNo)} onChange={() => onToggle(song.trackNo)} />
            {song.trackNo}. {song.title}
          </label>
        ))}
      </div>
      {refineWarnings.length > 0 && (
        <p className="error">{refineWarnings.join(' / ')}</p>
      )}
      <div className="button-row">
        <button type="button" className="primary" disabled={isRefining || selected.length === 0} onClick={onRefine}>
          <Wand2 size={16} />
          {isRefining ? `AI로 다듬는 중... (${refineProgress.done}/${refineProgress.total})` : `선택한 ${selected.length}곡 AI로 다듬기`}
        </button>
      </div>
    </div>
  );
}
