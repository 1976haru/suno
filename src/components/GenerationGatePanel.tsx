import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import type { GenerationGateResult, GenerationGateTrackResult } from '../core/generationGate';
import { buildRecomposeInstruction, songsForScopedIssue } from '../core/bridgeRecompose';
import { copyText } from '../utils/exporters';
import type { ScopedIssue, SongIdea } from '../types';

/**
 * v4.1 (TASK C) — "관문 2" panel, extracted from Step4Result.tsx's own
 * inline "N곡이 생성 검증을 통과하지 못했습니다" block (same DesignGatePanel-
 * pairing convention as that file). Before this task, a pack-level finding
 * (title pattern, era share, ...) was copied into every track's own
 * blocking list, so a 3-song title-pattern problem read as an 18-song
 * failure — see core/generationGate.ts's own GenerationGateResult doc
 * comment. This panel groups by what a fix actually requires:
 * - "곡별 문제": track/pair-scope findings — each song's own text is at
 *   fault, and regenerating those specific tracks (via the full recompose
 *   instruction) fixes it.
 * - "일부만 손보면 되는 것": rebalance-scope findings — a real minimum
 *   subset of tracks needs a targeted rewrite, with its OWN narrow copy
 *   button (never the whole pack).
 * - "설계 단계 문제": design/full-scope findings — no song regeneration can
 *   fix these; the pre-generation design itself needs to change. The
 *   track-regen button is disabled while any of these are open, since
 *   attempting a song-level fix here just burns tokens for nothing.
 */

interface GenerationGatePanelProps {
  result: GenerationGateResult;
  songs: SongIdea[];
}

function trackScopeIssues(tracks: GenerationGateTrackResult[]): GenerationGateTrackResult[] {
  return tracks.filter(track => !track.passed);
}

function CopyButton({ label, text, disabled, title }: { label: string; text: string; disabled?: boolean; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-button"
      disabled={disabled}
      title={title}
      onClick={() => {
        void copyText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Copy size={14} />
      {copied ? '복사됨 ✅' : label}
    </button>
  );
}

function RebalanceIssueRow({ issue, songs }: { issue: ScopedIssue; songs: SongIdea[] }) {
  // Title-pattern is the one rebalance issue this task's spec explicitly
  // narrows to a titles-only rewrite ("가사와 스타일 프롬프트는 유지하십시오");
  // every other rebalance-scope finding (vocab repetition, emotion arc, ...)
  // still gets a full per-track rewrite, just scoped to its own real
  // minimum affectedTracks instead of the whole pack.
  const fields = issue.id === 'title-pattern-variety' ? 'titleOnly' : 'all';
  const instruction = buildRecomposeInstruction(songsForScopedIssue(issue, songs), fields);
  return (
    <div className="design-gate-issue">
      <div>
        <b>{issue.labelKo}</b>
        <span className="supporting"> 트랙 {issue.affectedTracks.join(', ')}</span>
      </div>
      <p className="supporting">{issue.fixHintKo}</p>
      <CopyButton label={`${issue.affectedTracks.length}곡만 재생성 지시문 복사`} text={instruction} />
    </div>
  );
}

export default function GenerationGatePanel({ result, songs }: GenerationGatePanelProps) {
  if (result.passed) {
    return (
      <div className="provider-summary design-gate-panel passed">
        <CheckCircle2 size={16} />
        <b>생성 검증(관문 2) 통과 ✅ — {songs.length}곡 중 {songs.length}곡 통과</b>
      </div>
    );
  }

  const failingTracks = trackScopeIssues(result.tracks);
  const rebalanceIssues = result.packBlocking.filter(issue => issue.scope === 'rebalance');
  const designIssues = result.packBlocking.filter(issue => issue.scope === 'design' || issue.scope === 'full');
  const hasDesignOrFullIssue = designIssues.length > 0;

  const trackAndPairBlockingSongs = failingTracks
    .map(track => ({ song: songs.find(song => song.trackNo === track.trackNo)!, blocking: track.blocking }))
    .filter(entry => entry.song);
  const pairIssues = result.packBlocking.filter(issue => issue.scope === 'pair');

  return (
    <div className="error design-gate-panel failed">
      <div className="section-head">
        <b><AlertTriangle size={16} /> {songs.length}곡 중 생성 검증(관문 2)을 통과하지 못한 부분이 있습니다</b>
      </div>

      {(failingTracks.length > 0 || pairIssues.length > 0) && (
        <div className="option-block compact">
          <h4>곡별 문제 {failingTracks.length > 0 && `(${failingTracks.length}곡)`}</h4>
          {failingTracks.map(track => (
            <p key={track.trackNo} className="supporting">
              트랙 {track.trackNo}: {track.blocking.join(' / ')}
            </p>
          ))}
          {pairIssues.map(issue => (
            <p key={issue.id} className="supporting">{issue.labelKo} — {issue.fixHintKo}</p>
          ))}
          {trackAndPairBlockingSongs.length > 0 && (
            <CopyButton
              label="재작곡 지시문 복사"
              text={buildRecomposeInstruction(trackAndPairBlockingSongs)}
              disabled={hasDesignOrFullIssue}
              title={hasDesignOrFullIssue ? '설계 단계 문제가 먼저 해결되어야 합니다 — 곡을 다시 만들어도 설계 문제는 고쳐지지 않습니다.' : undefined}
            />
          )}
        </div>
      )}

      {rebalanceIssues.length > 0 && (
        <div className="option-block compact">
          <h4>일부만 손보면 되는 것</h4>
          {rebalanceIssues.map(issue => <RebalanceIssueRow key={issue.id} issue={issue} songs={songs} />)}
        </div>
      )}

      {designIssues.length > 0 && (
        <div className="option-block compact">
          <h4>설계 단계 문제</h4>
          <p className="supporting">이 문제들은 곡을 다시 만드는 것으로 고쳐지지 않습니다 — 설계(장르/BPM/보컬 배분)를 다시 실행해야 합니다.</p>
          {designIssues.map(issue => (
            <p key={issue.id} className="supporting">
              {issue.scope === 'full' ? '⚠ 전체 재생성 권장 — ' : ''}{issue.labelKo}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
