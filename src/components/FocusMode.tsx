import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Copy, X } from 'lucide-react';
import type { SongIdea } from '../types';
import { copyText } from '../utils/exporters';
import { getPackProgress, setTrackProgress } from '../core/library';

type FocusTab = 'style' | 'lyrics' | 'exclude';

interface FocusModeProps {
  songs: SongIdea[];
  packId: string;
  onClose: () => void;
}

/**
 * TASK G3 (v3.7) — a single-song, large-touch-target view for pasting into
 * the Suno mobile app one song at a time. Scrolling a 30-song list on a
 * phone to find and copy three separate fields per song is the actual
 * friction point once generation is done; this trades the list for
 * prev/next + one song's three fields + a done checkbox.
 */
export default function FocusMode({ songs, packId, onClose }: FocusModeProps) {
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<FocusTab>('style');
  const [done, setDone] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPackProgress(packId).then(list => {
      if (!cancelled) setDone(list);
    });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  const song = songs[index];
  if (!song) return null;

  const isDone = done.includes(song.trackNo);
  const tabText = tab === 'style' ? song.stylePrompt : tab === 'lyrics' ? song.lyrics : song.excludePrompt || '(제외할 항목 없음)';

  async function handleCopy() {
    await copyText(tabText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function toggleDone() {
    const next = await setTrackProgress(packId, song.trackNo, !isDone);
    setDone(next);
  }

  return (
    <div className="focus-mode-overlay">
      <div className="focus-mode">
        <div className="focus-mode-header">
          <button type="button" className="icon-button" onClick={onClose} aria-label="집중 모드 닫기">
            <X size={20} />
          </button>
          <span>{index + 1} / {songs.length}</span>
          <span className="supporting">{done.length}/{songs.length}곡 완료</span>
        </div>

        <div className="focus-mode-nav">
          <button
            type="button"
            className="focus-nav-button"
            disabled={index === 0}
            onClick={() => { setIndex(i => Math.max(0, i - 1)); setTab('style'); }}
          >
            <ChevronLeft size={28} />
          </button>
          <h3>{song.title}</h3>
          <button
            type="button"
            className="focus-nav-button"
            disabled={index === songs.length - 1}
            onClick={() => { setIndex(i => Math.min(songs.length - 1, i + 1)); setTab('style'); }}
          >
            <ChevronRight size={28} />
          </button>
        </div>

        <div className="tab-row focus-tab-row">
          <button type="button" className={tab === 'style' ? 'tab active' : 'tab'} onClick={() => setTab('style')}>Style</button>
          <button type="button" className={tab === 'lyrics' ? 'tab active' : 'tab'} onClick={() => setTab('lyrics')}>Lyrics</button>
          <button type="button" className={tab === 'exclude' ? 'tab active' : 'tab'} onClick={() => setTab('exclude')}>Exclude</button>
        </div>

        <pre className="focus-mode-text">{tabText}</pre>

        <button type="button" className="primary focus-copy-button" onClick={() => void handleCopy()}>
          <Copy size={18} />
          {copied ? '복사됨!' : `${tab === 'style' ? 'Style' : tab === 'lyrics' ? 'Lyrics' : 'Exclude'} 복사`}
        </button>

        <button type="button" className={isDone ? 'chip active focus-done-button' : 'chip focus-done-button'} onClick={() => void toggleDone()}>
          <Check size={16} />
          {isDone ? 'Suno에 넣었음' : 'Suno에 넣었음으로 표시'}
        </button>
      </div>
    </div>
  );
}
