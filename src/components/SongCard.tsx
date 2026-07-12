import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Download, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import type { SongEvaluation, SongIdea } from '../types';
import { copyText, downloadText } from '../utils/exporters';

type Tab = 'style' | 'lyrics' | 'youtube';

interface SongCardProps {
  song: SongIdea;
  moneyChordLabel: string;
  evaluation?: SongEvaluation;
  isRetrying: boolean;
  onRetry: (trackNo: number, issues: string[]) => void;
}

const VERDICT_LABEL: Record<SongEvaluation['verdict'], string> = {
  pass: '통과',
  revise: '수정 권장',
  reject: '재생성 권장'
};

export default function SongCard({ song, moneyChordLabel, evaluation, isRetrying, onRetry }: SongCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('style');

  const hasWarnings = song.warnings.length > 0 || Boolean(evaluation);

  return (
    <article className="song">
      <button type="button" className="song-head song-head-toggle" onClick={() => setExpanded(v => !v)}>
        <div>
          <h3>{song.trackNo}. {song.title}</h3>
          <p>{song.listenerSituation} / {song.emotionArc}</p>
          <span className="chip">{moneyChordLabel}</span>
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
              <div className="copy-head">
                <h4>Style Prompt</h4>
                <button type="button" onClick={() => void copyText(song.stylePrompt)}>
                  <Copy size={15} />
                  Copy
                </button>
              </div>
              <pre>{song.stylePrompt}</pre>
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
