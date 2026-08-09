import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';
import type { PackGeneratedBy, SongIdea } from '../types';
import { copyText } from '../utils/exporters';
import { getPackPastedAt, getPackProgress, markTrackPasted, setTrackProgress } from '../core/library';
import { SUNO_COPY_LIMIT } from '../core/promptBudget';
import { PERSONA_STYLE_LIMIT } from '../core/soundSignature';
import { attributesFromSong, getRatingForSong, recordRating, type SongRating } from '../core/ratingLedger';
import { renderLyricsForDisplay } from '../core/lyricEngine';
import { stripSetTitlePrefix } from '../utils/generation';

type ProgressField = 'title' | 'style' | 'lyrics' | 'exclude';

interface SunoProgressModeProps {
  songs: SongIdea[];
  packId: string;
  /** TASK v3.68 (TASK C) — needed to snapshot/scope this pack's ratings (see core/ratingLedger.ts's attributesFromSong). */
  channelId: string;
  personaMode?: boolean;
  promptCharLimit?: number;
  onClose: () => void;
  /** 지시문 18 (TASK C-3) — 이 팩을 만든 생성 에이전트, 채점 시 RatingRecord.generatedBy로 그대로 실린다. */
  generatedBy?: PackGeneratedBy;
}

const RATING_LABELS_KO: Record<SongRating, string> = { good: '좋음', ok: '보통', bad: '별로' };

/**
 * TASK v4.10 — the "1 키" title copy used to copy `song.title` alone, even
 * though the screen already shows the bilingual `titleDisplay` ("Thaw
 * (봄이 스미던 오후)") right above it. v4.9's own "복사에 괄호를 넣지 말 것"
 * is retracted there — Suno's title field is a non-generation label (never
 * touches the actual music), and the user re-types the localized title by
 * hand into YouTube/file names afterward every single time otherwise. Track
 * number is 2-digit zero-padded ("01."); the "(localized)" half is only
 * added when `titleLocalized` is actually present and non-blank — an
 * english-packaging pack (or any song titleLocalized wasn't built for)
 * naturally has no such field, so this never produces an empty "()" pair
 * without a separate language check.
 * TASK v4.12 bugfix — `song.title` already carries its own "NN. " prefix by
 * default (utils/generation.ts's applySetTitlePrefixesToBlueprint, on by
 * default via GenerationOptions.setNumberPrefix), so prepending trackNo here
 * too doubled it ("02. 02. Folded"). Strips any existing prefix first via
 * that same module's own stripSetTitlePrefix — the same trusted utility
 * utils/exporters.ts's buildSongTxt already uses for this identical bug —
 * rather than assuming song.title is bare.
 */
// 지시문 19 (TASK C) — real cross-file utility, not dead code; see
// ExplorationLedgerPanel.tsx's identical doc comment on why this stays
// co-located rather than being split into its own module for a dev-only
// Fast Refresh lint rule.
// eslint-disable-next-line react-refresh/only-export-components
export function buildTitleCopyText(song: Pick<SongIdea, 'trackNo' | 'title' | 'titleLocalized'>): string {
  const trackNoPadded = String(song.trackNo).padStart(2, '0');
  const bareTitle = stripSetTitlePrefix(song.title);
  const localized = song.titleLocalized?.trim();
  return localized ? `${trackNoPadded}. ${bareTitle} (${localized})` : `${trackNoPadded}. ${bareTitle}`;
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
export default function SunoProgressMode({ songs, packId, channelId, personaMode = false, promptCharLimit, onClose, generatedBy }: SunoProgressModeProps) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [pastedAt, setPastedAt] = useState<Record<number, string>>({});
  const [copiedFields, setCopiedFields] = useState<Record<ProgressField, boolean>>({ title: false, style: false, lyrics: false, exclude: false });
  const [flash, setFlash] = useState<ProgressField | null>(null);
  // TASK v3.68 (TASK C) — "곡마다 3초짜리 평가": keyed by songId so a rating
  // survives across sessions/packs (see core/ratingLedger.ts).
  const [ratings, setRatings] = useState<Record<string, SongRating>>({});

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

  useEffect(() => {
    let cancelled = false;
    Promise.all(songs.map(item => (item.songId ? getRatingForSong(item.songId) : Promise.resolve(null))))
      .then(records => {
        if (cancelled) return;
        const next: Record<string, SongRating> = {};
        records.forEach((record, i) => {
          const songId = songs[i]?.songId;
          if (record && songId) next[songId] = record.rating;
        });
        setRatings(next);
      })
      .catch(() => { if (!cancelled) setRatings({}); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // TASK v3.70 (TASK D) — copy/display only: the stored song.lyrics keeps
    // its exact hookPhrase match so core/quality.ts's checks keep working —
    // see renderLyricsForDisplay's own doc comment.
    const text = field === 'title' ? buildTitleCopyText(song) : field === 'style' ? song.stylePrompt : field === 'lyrics' ? renderLyricsForDisplay(song.lyrics, song.hookPhrase) : song.excludePrompt || '';
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

  // TASK v3.68 (TASK C) — rating is always optional (never forced) and
  // always ≤1 click/key: this is the only action a rating requires,
  // including re-rating an already-rated song (recordRating overwrites by
  // songId — see core/ratingLedger.ts). Auto-advances to the next song,
  // same as this screen's own Enter/→ convention.
  async function rateSong(rating: SongRating) {
    if (!song?.songId) return;
    await recordRating({
      songId: song.songId,
      packId,
      rating,
      ratedAt: new Date().toISOString(),
      attributes: attributesFromSong(song, channelId),
      ...(generatedBy ? { generatedBy } : {})
    });
    setRatings(prev => ({ ...prev, [song.songId!]: rating }));
    goNext();
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
      else if (event.key.toLowerCase() === 'g') void rateSong('good');
      else if (event.key.toLowerCase() === 'o') void rateSong('ok');
      else if (event.key.toLowerCase() === 'b') void rateSong('bad');
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
          <span className="supporting">평가 {Object.keys(ratings).length}/{songs.length}곡</span>
        </div>

        <div className="progress-track-strip">
          {songs.map((trackSong, trackIdx) => {
            const trackDone = done.includes(trackSong.trackNo);
            const trackRating = trackSong.songId ? ratings[trackSong.songId] : undefined;
            const ratingMark = trackRating === 'good' ? '●' : trackRating === 'ok' ? '○' : trackRating === 'bad' ? '×' : undefined;
            return (
              <button
                key={trackSong.trackNo}
                type="button"
                className={trackIdx === index ? 'progress-track-chip active' : trackDone ? 'progress-track-chip done' : 'progress-track-chip'}
                title={trackRating ? `${trackSong.title} — ${RATING_LABELS_KO[trackRating]}` : trackSong.title}
                onClick={() => setIndex(trackIdx)}
              >
                {ratingMark ?? (trackDone ? <Check size={11} /> : trackSong.trackNo)}
              </button>
            );
          })}
        </div>

        <div className="focus-mode-nav">
          <button type="button" className="focus-nav-button" disabled={index === 0} onClick={goPrev}>
            <ChevronLeft size={28} />
          </button>
          <div className="suno-progress-title">
            <h3>{song.titleDisplay ?? song.title}</h3>
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

        {/* TASK v3.68 (TASK C) — 수노에서 들어본 뒤 이 곡을 평가. 완전히
            선택 사항: 누르지 않고 바로 다음 곡으로 넘어가도 됩니다. 이미
            평가한 곡을 다시 누르면 수정됩니다. */}
        <div className="button-row">
          <button type="button" className={song.songId && ratings[song.songId] === 'good' ? 'chip active' : 'chip'} onClick={() => void rateSong('good')}>
            <span className="suno-progress-field-key">G</span>
            👍 좋음
          </button>
          <button type="button" className={song.songId && ratings[song.songId] === 'ok' ? 'chip active' : 'chip'} onClick={() => void rateSong('ok')}>
            <span className="suno-progress-field-key">O</span>
            🤷 보통
          </button>
          <button type="button" className={song.songId && ratings[song.songId] === 'bad' ? 'chip active' : 'chip'} onClick={() => void rateSong('bad')}>
            <span className="suno-progress-field-key">B</span>
            👎 별로
          </button>
        </div>

        <div className="button-row">
          <button type="button" className={isDone ? 'chip active' : 'chip'} onClick={() => void toggleDone()}>
            <Check size={16} />
            {isDone ? 'Suno에 넣었음' : '완료 처리'}
          </button>
          <button type="button" className={allCopied ? 'primary full-width' : 'full-width'} onClick={goNext} disabled={index === songs.length - 1}>
            다음 곡 → (Enter)
          </button>
        </div>
        <p className="supporting">단축키: 1=제목 2=스타일 3=가사 4=Exclude · G=좋음 O=보통 B=별로 · Enter/→=다음 곡 · ←=이전 곡{flash ? ' · 복사됨 ✅' : ''}</p>
      </div>
    </div>
  );
}
