import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, X, FileJson } from 'lucide-react';
import type { BilingualPair, ChannelArchetype, LyricLanguage, SongIdea } from '../types';
import { parseSongsJsonForViewer, type ViewerParseResult } from '../core/bridgeImport';
import { recentSituations } from '../core/situationLedger';
import { recentLyricLines } from '../core/lyricLineLedger';
import { usedTitles as fetchHistoricalTitles } from '../core/hookLedger';
import { renderLyricsForDisplay } from '../core/lyricEngine';
import { copyText } from '../utils/exporters';
import { SUNO_COPY_LIMIT } from '../core/promptBudget';
import { currentWorkspaceId } from '../core/workspaceScope';

type CopyField = 'title' | 'style' | 'lyrics' | 'exclude';

interface SunoModeReadOnlyViewerProps {
  /** For the language-ratio/archetype advisory check only — never used to gate/block, and never changed by this component (지시문 13 §A-1 "채널 선택 변경 금지"). */
  archetype?: ChannelArchetype;
  channelId?: string;
  lyricLanguage?: LyricLanguage;
  bilingualPair?: BilingualPair;
  onClose: () => void;
}

function buildTitleCopyText(song: Pick<SongIdea, 'trackNo' | 'title' | 'titleLocalized'>): string {
  const trackNoPadded = String(song.trackNo).padStart(2, '0');
  const localized = song.titleLocalized?.trim();
  return localized ? `${trackNoPadded}. ${song.title} (${localized})` : `${trackNoPadded}. ${song.title}`;
}

/**
 * 지시문 13 (TASK A-2) — "수노모드로 열기 (읽기 전용)": the read-only twin of
 * SunoProgressMode, reachable without a saved/imported blueprint at all (no
 * `blueprint &&` gate the way every other Step4Result screen has). Structural
 * difference from SunoProgressMode, not just a smaller feature set — this
 * component calls ZERO persistence functions anywhere in its body (no
 * core/library.ts pack-progress, no core/ratingLedger.ts ratings, no
 * hook/situation/lyric-line ledger writes, no library save) — every "done"/
 * rating affordance SunoProgressMode has is deliberately absent here, not
 * just unused, so the always-visible "읽기 전용 — 저장·이력 기록 없음" badge
 * below stays literally true rather than aspirational.
 *
 * The one thing this component's OWN duplication-history checks read (via
 * parseSongsJsonForViewer's optional context) is real cross-set history from
 * situationLedger/lyricLineLedger/hookLedger — genuine IndexedDB READS, never
 * writes; see this file's own loadFile for the exact 3 calls.
 */
export default function SunoModeReadOnlyViewer({ archetype, channelId, lyricLanguage, bilingualPair, onClose }: SunoModeReadOnlyViewerProps) {
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ViewerParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [copiedFields, setCopiedFields] = useState<Record<CopyField, boolean>>({ title: false, style: false, lyrics: false, exclude: false });
  const [flash, setFlash] = useState<CopyField | null>(null);
  const [checksOpen, setChecksOpen] = useState(false);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setFileName(file.name);
    try {
      const text = await file.text();
      // Best-effort, read-only: a history-fetch failure (or no channelId/
      // lyricLanguage available yet) just means the 2 duplication-history
      // advisory checks are skipped — parseSongsJsonForViewer's own
      // duplicationHistory param is optional exactly for this case, and
      // omitting it can never turn into a block (see that function's own
      // header comment).
      let duplicationHistory: { recentSituations: string[]; recentLyricLines: string[]; historicalTitles: Set<string> } | undefined;
      if (channelId && lyricLanguage) {
        try {
          // 지시문 14 (TASK C) — workspace-scoped, not channel-scoped: this
          // viewer's own duplication-history checks now see every channel's
          // history within the current workspace, matching the real
          // generation paths' avoid-list fetches (App.tsx etc).
          const scope = { workspaceId: currentWorkspaceId() };
          const [situations, lyricLines, historicalTitles] = await Promise.all([
            recentSituations(scope, lyricLanguage),
            recentLyricLines(scope, lyricLanguage),
            fetchHistoricalTitles(scope, lyricLanguage)
          ]);
          duplicationHistory = { recentSituations: situations, recentLyricLines: lyricLines, historicalTitles };
        } catch {
          // best-effort only
        }
      }
      const parsed = parseSongsJsonForViewer(text, { archetype, lyricLanguage: lyricLanguage ?? 'english', bilingualPair, duplicationHistory });
      setResult(parsed);
      setIndex(0);
      setCopiedFields({ title: false, style: false, lyrics: false, exclude: false });
    } finally {
      setLoading(false);
    }
  }

  const song = result?.status === 'ok' ? result.songs[index] : undefined;
  const hasExclude = Boolean(song?.excludePrompt);
  const isOverPromptLimit = (song?.stylePrompt.length ?? 0) > SUNO_COPY_LIMIT;

  function goNext() {
    if (!result || result.status !== 'ok') return;
    setIndex(i => Math.min(result.songs.length - 1, i + 1));
    setCopiedFields({ title: false, style: false, lyrics: false, exclude: false });
  }
  function goPrev() {
    setIndex(i => Math.max(0, i - 1));
    setCopiedFields({ title: false, style: false, lyrics: false, exclude: false });
  }

  async function copyField(field: CopyField) {
    if (!song) return;
    if (field === 'exclude' && !hasExclude) return;
    if (field === 'style' && isOverPromptLimit) return;
    const text = field === 'title'
      ? buildTitleCopyText(song)
      : field === 'style'
        ? song.stylePrompt
        : field === 'lyrics'
          ? renderLyricsForDisplay(song.lyrics, song.hookPhrase)
          : song.excludePrompt || '';
    await copyText(text);
    setCopiedFields(prev => ({ ...prev, [field]: true }));
    setFlash(field);
    setTimeout(() => setFlash(current => (current === field ? null : current)), 900);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void loadFile(event.dataTransfer.files?.[0]);
  }

  const warnChecks = result?.status === 'ok' ? result.checks.filter(c => c.status === 'warn') : [];

  return (
    <div className="focus-mode-overlay">
      <div className="focus-mode suno-progress-mode">
        <div className="focus-mode-header">
          <button type="button" className="icon-button" onClick={onClose} aria-label="수노모드(읽기 전용) 닫기">
            <X size={20} />
          </button>
          <span>📄 수노모드 (읽기 전용)</span>
        </div>
        <p className="warning" role="note">읽기 전용 — 저장·이력 기록 없음</p>

        {!result && (
          <div className={dragActive ? 'basic-import-drop drag-over' : 'basic-import-drop'}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <FileJson size={28} />
            <p><strong>가사 JSON 파일을 여기로 끌어놓거나</strong></p>
            <label className="import-button">
              [파일 선택]
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={e => { void loadFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>
            <p className="supporting">중복 방지 검사에 blocked 된 파일도 읽기 전용으로는 열립니다 — 구조가 깨진 파일만 열리지 않습니다.</p>
            {loading && <p className="supporting">읽는 중...</p>}
          </div>
        )}

        {result?.status === 'blocked' && (
          <div className="panel">
            <p className="error">⚠️ {fileName}을(를) 열 수 없습니다:</p>
            {result.blockedReasons.map((reason, i) => (
              <p key={i} className="error">{reason}</p>
            ))}
            <button type="button" onClick={() => setResult(null)}>← 다른 파일 열기</button>
          </div>
        )}

        {result?.status === 'ok' && song && (
          <>
            <div className="progress-track-strip">
              {result.songs.map((trackSong, trackIdx) => (
                <button
                  key={trackSong.trackNo}
                  type="button"
                  className={trackIdx === index ? 'progress-track-chip active' : 'progress-track-chip'}
                  title={trackSong.title}
                  onClick={() => { setIndex(trackIdx); setCopiedFields({ title: false, style: false, lyrics: false, exclude: false }); }}
                >
                  {trackSong.trackNo}
                </button>
              ))}
            </div>

            <div className="focus-mode-nav">
              <button type="button" className="focus-nav-button" disabled={index === 0} onClick={goPrev}>
                <ChevronLeft size={28} />
              </button>
              <div className="suno-progress-title">
                <h3>{song.titleDisplay ?? song.title}</h3>
                <p className="supporting">{index + 1} / {result.songs.length}</p>
              </div>
              <button type="button" className="focus-nav-button" disabled={index === result.songs.length - 1} onClick={goNext}>
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
                title={isOverPromptLimit ? `스타일 프롬프트가 ${SUNO_COPY_LIMIT}자를 초과해 복사를 막았습니다` : undefined}
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
            {flash && <p className="supporting">복사됨 ✅</p>}

            <div className="button-row">
              <button type="button" className="full-width" onClick={goNext} disabled={index === result.songs.length - 1}>
                다음 곡 → (Enter)
              </button>
            </div>

            {warnChecks.length > 0 && (
              <div className="panel">
                <button type="button" className="chip" onClick={() => setChecksOpen(v => !v)}>
                  {checksOpen ? '▾' : '▸'} 품질/중복 검사 결과 {warnChecks.length}건 (읽기 전용이므로 차단하지 않음)
                </button>
                {checksOpen && (
                  <ul>
                    {warnChecks.map(check => (
                      <li key={check.id} className="supporting">
                        <strong>{check.labelKo}</strong>{check.detail ? ` — ${check.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button type="button" onClick={() => setResult(null)}>← 다른 파일 열기</button>
          </>
        )}
      </div>
    </div>
  );
}
