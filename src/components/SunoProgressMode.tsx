import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';
import type { SongIdea } from '../types';
import { copyText } from '../utils/exporters';
import { getPackPastedAt, getPackProgress, markTrackPasted, setTrackProgress } from '../core/library';
import { SUNO_COPY_LIMIT } from '../core/promptBudget';
import { PERSONA_STYLE_LIMIT } from '../core/soundSignature';

type ProgressField = 'title' | 'style' | 'lyrics' | 'exclude';

interface SunoProgressModeProps {
  songs: SongIdea[];
  packId: string;
  personaMode?: boolean;
  promptCharLimit?: number;
  onClose: () => void;
}

/**
 * TASK v3.31 (Part 1) — "수노 진행 모드": a tighter, keyboard-driven version
 * of FocusMode.tsx's single-song view, aimed squarely at the actual
 * bottleneck at 40-songs/day scale — copying title/style/lyrics/exclude into
 * Suno one field at a time. All four copy targets are visible at once (not
 * behind a tab switch), each gets a real keyboard shortcut (1/2/3/4), and
 * Enter/→ advances — the "1,붙,2,붙,3,붙,Enter" rhythm the user described.
 * Reuses the same packId convention and getPackProgress/setTrackProgress
 * persistence FocusMode already established, so the two views' "done"
 * checkmarks stay in sync rather than tracking two separate progress sets.
 */
export default function SunoProgressMode({ songs, packId, personaMode = false, promptCharLimit, onClose }: SunoProgressModeProps) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [pastedAt, setPastedAt] = useState<Record<number, string>>({});
  const [copiedFields, setCopiedFields] = useState<Record<ProgressField, boolean>>({ title: false, style: false, lyrics: false, exclude: false });
  const [flash, setFlash] = useState<ProgressField | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getPackProgress(packId), getPackPastedAt(packId)]).then(([doneList, pastedMap]) => {
      if (!cancelled) {
        setDone(doneList);
        setPastedAt(pastedMap);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  // Reset the per-field checkmarks whenever the song changes — these are
  // session-only progress within the current song, not persisted (see
  // markTrackPasted for what does persist).
  useEffect(() => {
    setCopiedFields({ title: false, style: false, lyrics: false, exclude: false });
  }, [index]);

  const song = songs[index];

  // Same style-prompt budget rule SongCard.tsx already enforces — copying a
  // style prompt that Suno will truncate mid-phrase is worse than not
  // copying it at all, so this mirrors that block rather than relaxing it
  // for speed.
  const isSeedSong = personaMode && song?.trackNo === 1;
  const configuredPromptLimit = Math.min(SUNO_COPY_LIMIT, Math.max(PERSONA_STYLE_LIMIT, promptCharLimit || SUNO_COPY_LIMIT));
  const promptLimit = personaMode && !isSeedSong ? Math.min(configuredPromptLimit, PERSONA_STYLE_LIMIT) : configuredPromptLimit;
  const isOverPromptLimit = (song?.stylePrompt.length ?? 0) > promptLimit;

  const hasExclude = Boolean(song?.excludePrompt);
  const requiredFields = useMemo<ProgressField[]>(
    () => (hasExclude ? ['title', 'style', 'lyrics', 'exclude'] : ['title', 'style', 'lyrics']),
    [hasExclude]
  );
  const allCopied = requiredFields.every(field => copiedFields[field]);
  const isDone = song ? done.includes(song.trackNo) : false;
  const lastPastedAt = song ? pastedAt[song.trackNo] : undefined;

  useEffect(() => {
    if (allCopied && song) {
      void markTrackPasted(packId, song.trackNo).then(setPastedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCopied]);

  function goNext() {
    setIndex(i => Math.min(songs.length - 1, i + 1));
  }
  function goPrev() {
    setIndex(i => Math.max(0, i - 1));
  }

  async function copyField(field: ProgressField) {
    if (!song) return;
    if (field === 'exclude' && !hasExclude) return;
    if (field === 'style' && isOverPromptLimit) return;
    const text = field === 'title' ? song.title : field === 'style' ? song.stylePrompt : field === 'lyrics' ? song.lyrics : song.excludePrompt || '';
    await copyText(text);
    setCopiedFields(prev => ({ ...prev, [field]: true }));
    setFlash(field);
    setTimeout(() => setFlash(current => (current === field ? null : current)), 900);
  }

  async function toggleDone() {
    if (!song) return;
    const next = await setTrackProgress(packId, song.trackNo, !isDone);
    setDone(next);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Don't hijack keystrokes typed into some other focused field —
      // defensive only, since this overlay normally owns all keyboard focus.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (event.key === '1') void copyField('title');
      else if (event.key === '2') void copyField('style');
      else if (event.key === '3') void copyField('lyrics');
      else if (event.key === '4' && hasExclude) void copyField('exclude');
      else if (event.key === 'Enter' || event.key === 'ArrowRight') goNext();
      else if (event.key === 'ArrowLeft') goPrev();
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, hasExclude, isOverPromptLimit]);

  if (!song) return null;

  return (
    <div className="focus-mode-overlay">
      <div className="focus-mode suno-progress-mode">
        <div className="focus-mode-header">
          <button type="button" className="icon-button" onClick={onClose} aria-label="수노 진행 모드 닫기">
            <X size={20} />
          </button>
          <span>{index + 1} / {songs.length}</span>
          <span className="supporting">완료 {done.length}/{songs.length}곡</span>
        </div>

        <div className="progress-track-strip">
          {songs.map((trackSong, trackIdx) => {
            const trackDone = done.includes(trackSong.trackNo);
            return (
              <button
                key={trackSong.trackNo}
                type="button"
                className={trackIdx === index ? 'progress-track-chip active' : trackDone ? 'progress-track-chip done' : 'progress-track-chip'}
                title={trackSong.title}
                onClick={() => setIndex(trackIdx)}
              >
                {trackDone ? <Check size={11} /> : trackSong.trackNo}
              </button>
            );
          })}
        </div>

        <div className="focus-mode-nav">
          <button type="button" className="focus-nav-button" disabled={index === 0} onClick={goPrev}>
            <ChevronLeft size={28} />
          </button>
          <div className="suno-progress-title">
            <h3>{song.title}</h3>
            {lastPastedAt && <p className="supporting">마지막 붙여넣기: {new Date(lastPastedAt).toLocaleString()}</p>}
          </div>
          <button type="button" className="focus-nav-button" disabled={index === songs.length - 1} onClick={goNext}>
            <ChevronRight size={28} />
          </button>
        </div>

        <div className="suno-progress-fields">
          <button type="button" className={copiedFields.title ? 'suno-progress-field copied' : 'suno-progress-field'} onClick={() => void copyField('title')}>
            {copiedFields.title ? <Check size={18} /> : <Copy size={18} />}
            <span className="suno-progress-field-key">1</span>
            제목 복사
          </button>
          <button
            type="button"
            className={copiedFields.style ? 'suno-progress-field copied' : 'suno-progress-field'}
            disabled={isOverPromptLimit}
            title={isOverPromptLimit ? `스타일 프롬프트가 ${promptLimit}자를 초과해 복사를 막았습니다 (현재 ${song.stylePrompt.length}자)` : undefined}
            onClick={() => void copyField('style')}
          >
            {copiedFields.style ? <Check size={18} /> : <Copy size={18} />}
            <span className="suno-progress-field-key">2</span>
            스타일 프롬프트 복사
          </button>
          <button type="button" className={copiedFields.lyrics ? 'suno-progress-field copied' : 'suno-progress-field'} onClick={() => void copyField('lyrics')}>
            {copiedFields.lyrics ? <Check size={18} /> : <Copy size={18} />}
            <span className="suno-progress-field-key">3</span>
            가사 복사
          </button>
          {hasExclude && (
            <button type="button" className={copiedFields.exclude ? 'suno-progress-field copied' : 'suno-progress-field'} onClick={() => void copyField('exclude')}>
              {copiedFields.exclude ? <Check size={18} /> : <Copy size={18} />}
              <span className="suno-progress-field-key">4</span>
              Exclude 복사
            </button>
          )}
        </div>

        {isOverPromptLimit && (
          <p className="error">⚠️ 스타일 프롬프트가 {promptLimit}자를 초과해 복사를 막았습니다 (현재 {song.stylePrompt.length}자). 카드 화면에서 줄여주세요.</p>
        )}

        <div className="button-row">
          <button type="button" className={isDone ? 'chip active' : 'chip'} onClick={() => void toggleDone()}>
            <Check size={16} />
            {isDone ? 'Suno에 넣었음' : '완료 처리'}
          </button>
          <button type="button" className={allCopied ? 'primary full-width' : 'full-width'} onClick={goNext} disabled={index === songs.length - 1}>
            다음 곡 → (Enter)
          </button>
        </div>
        <p className="supporting">단축키: 1=제목 2=스타일 3=가사 4=Exclude · Enter/→=다음 곡 · ←=이전 곡{flash ? ' · 복사됨 ✅' : ''}</p>
      </div>
    </div>
  );
}
