import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Download, RefreshCw, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';
import type { SongEvaluation, SongIdea } from '../types';
import { copyText, downloadText } from '../utils/exporters';
import { SUNO_COPY_LIMIT } from '../core/promptBudget';
import { PERSONA_STYLE_LIMIT } from '../core/soundSignature';

type Tab = 'style' | 'lyrics' | 'youtube';

interface SongCardProps {
  song: SongIdea;
  moneyChordLabel: string;
  evaluation?: SongEvaluation;
  isRetrying: boolean;
  onRetry: (trackNo: number, issues: string[]) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (trackNo: number) => void;
  personaMode?: boolean;
  personaName?: string;
}

const VERDICT_LABEL: Record<SongEvaluation['verdict'], string> = {
  pass: '통과',
  revise: '수정 권장',
  reject: '재생성 권장'
};

export default function SongCard({ song, moneyChordLabel, evaluation, isRetrying, onRetry, selectable, selected, onToggleSelect, personaMode = false, personaName }: SongCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('style');
  const [styleDraft, setStyleDraft] = useState(song.stylePrompt);

  useEffect(() => {
    setStyleDraft(song.stylePrompt);
  }, [song.stylePrompt, song.trackNo]);

  const hasWarnings = song.warnings.length > 0 || Boolean(evaluation);
  const isSeedSong = personaMode && song.trackNo === 1;
  const promptLimit = personaMode && !isSeedSong ? PERSONA_STYLE_LIMIT : SUNO_COPY_LIMIT;

  return (
    <article className="song">
      {selectable && (
        <label className="song-select-row">
          <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect?.(song.trackNo)} />
          이 곡을 평가 대상에 포함
        </label>
      )}
      <button type="button" className="song-head song-head-toggle" onClick={() => setExpanded(v => !v)}>
        <div>
          <h3>{song.trackNo}. {song.title}</h3>
          <p>{song.listenerSituation} / {song.emotionArc}</p>
          <span className="chip">{moneyChordLabel}</span>
          {isSeedSong && <span className="chip">시드 곡</span>}
          {personaMode && !isSeedSong && <span className="chip">Persona 모드</span>}
          {hasWarnings && <span className="chip warning-chip">⚠ 확인 필요</span>}
        </div>
        <div className="button-row">
          <span className="score">{song.qualityScore}/100</span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {evaluation && (
        <div className="warning">
          <Sparkles size={16} />
          <span>
            AI 평가: {evaluation.total}/100 ({VERDICT_LABEL[evaluation.verdict]})
            {evaluation.issues.length > 0 && ` — ${evaluation.issues.join(' / ')}`}
            {(evaluation.verdict === 'reject' || evaluation.verdict === 'revise') && (
              <button
                type="button"
                className={evaluation.verdict === 'reject' ? 'primary' : ''}
                title={evaluation.issues.length ? `문제: ${evaluation.issues.join(' / ')}` : '이 곡만 다시 만들기'}
                disabled={isRetrying}
                onClick={() => onRetry(song.trackNo, evaluation.issues)}
              >
                <RefreshCw size={14} />
                🔄 이 곡만 다시 만들기
              </button>
            )}
          </span>
        </div>
      )}

      {song.warnings.length > 0 && (
        <div className="warning">
          <ShieldAlert size={16} />
          <span>{song.warnings.join(' / ')}</span>
        </div>
      )}

      {expanded && (
        <>
          <div className="button-row song-actions">
            <button
              type="button"
              onClick={() => downloadText(
                `${song.trackNo.toString().padStart(2, '0')}-${song.title}.txt`,
                `Style Prompt\n\n${song.stylePrompt}\n\nLyrics\n\n${song.lyrics}\n\nYouTube\n\n${JSON.stringify(song.youtube, null, 2)}`,
                'text/plain;charset=utf-8'
              )}
            >
              <Download size={14} />
              이 곡만 txt로 내보내기
            </button>
          </div>

          <div className="tab-row">
            <button type="button" className={tab === 'style' ? 'tab active' : 'tab'} onClick={() => setTab('style')}>스타일 프롬프트</button>
            <button type="button" className={tab === 'lyrics' ? 'tab active' : 'tab'} onClick={() => setTab('lyrics')}>가사</button>
            <button type="button" className={tab === 'youtube' ? 'tab active' : 'tab'} onClick={() => setTab('youtube')}>YouTube</button>
          </div>

          {tab === 'style' && (
            <section className="copy-block">
              {personaMode && (
                <div className="persona-song-note">
                  {isSeedSong ? (
                    <>
                      <b>시드 곡</b>
                      <span>이 곡을 먼저 만들고 결과가 좋으면 Suno에서 Persona로 저장하세요. 이 프롬프트에는 사운드 시그니처가 포함되어 있습니다.</span>
                    </>
                  ) : (
                    <>
                      <b>Persona 모드</b>
                      <span>Suno에서 "{personaName || '저장한 Persona'}"를 선택하세요. 이 프롬프트는 곡별 차이만 담습니다.</span>
                    </>
                  )}
                </div>
              )}
              <div className="copy-head">
                <h4>Style Prompt</h4>
                <span className={styleDraft.length > promptLimit ? 'prompt-length-badge over-limit' : 'prompt-length-badge'}>
                  {styleDraft.length} / {promptLimit}자 {styleDraft.length > promptLimit ? '⚠️' : '✅'}
                </span>
                <button type="button" title="원래 생성된 프롬프트로 되돌리기" onClick={() => setStyleDraft(song.stylePrompt)}>
                  <RotateCcw size={14} />
                  기본값으로
                </button>
                <button type="button" disabled={styleDraft.length > promptLimit} onClick={() => void copyText(styleDraft)}>
                  <Copy size={15} />
                  Copy
                </button>
              </div>
              <textarea
                className="style-prompt-editor"
                value={styleDraft}
                onChange={event => setStyleDraft(event.target.value)}
                rows={8}
              />
              {styleDraft.length > promptLimit && (
                <p className="error">⚠️ {promptLimit}자를 초과했습니다. 초과 상태에서는 복사를 막습니다.</p>
              )}
              {song.promptDroppedTerms && song.promptDroppedTerms.length > 0 && (
                <p className="supporting">ℹ️ 길이 제한으로 제외된 항목: {song.promptDroppedTerms.join(', ')}</p>
              )}
            </section>
          )}

          {tab === 'lyrics' && (
            <section className="copy-block">
              <div className="copy-head">
                <h4>Lyrics</h4>
                <button type="button" onClick={() => void copyText(song.lyrics)}>
                  <Copy size={15} />
                  Copy
                </button>
              </div>
              <pre>{song.lyrics}</pre>
            </section>
          )}

          {tab === 'youtube' && (
            <section className="copy-block metadata">
              <div className="copy-head">
                <h4>YouTube</h4>
                <button type="button" onClick={() => void copyText(JSON.stringify(song.youtube, null, 2))}>
                  <Copy size={15} />
                  Copy all
                </button>
              </div>
              <div className="metadata-row">
                <b>Title</b>
                <button type="button" onClick={() => void copyText(song.youtube.title)}><Copy size={14} />Copy</button>
                <span>{song.youtube.title}</span>
              </div>
              <div className="metadata-row">
                <b>Description</b>
                <button type="button" onClick={() => void copyText(song.youtube.description)}><Copy size={14} />Copy</button>
                <span>{song.youtube.description}</span>
              </div>
              <div className="metadata-row">
                <b>Tags</b>
                <button type="button" onClick={() => void copyText(song.youtube.tags.join(', '))}><Copy size={14} />Copy</button>
                <span>{song.youtube.tags.join(', ')}</span>
              </div>
              <div className="metadata-row">
                <b>Thumbnail</b>
                <button type="button" onClick={() => void copyText(song.youtube.thumbnailText)}><Copy size={14} />Copy</button>
                <span>{song.youtube.thumbnailText}</span>
              </div>
            </section>
          )}
        </>
      )}
    </article>
  );
}

export function SongCardSkeleton({ trackNo }: { trackNo: number }) {
  return (
    <article className="song song-skeleton">
      <div className="song-head">
        <div>
          <h3>{trackNo}. 생성 중...</h3>
          <div className="skeleton-line" />
        </div>
        <span className="score skeleton-score">...</span>
      </div>
    </article>
  );
}
