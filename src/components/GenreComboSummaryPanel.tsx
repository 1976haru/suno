import { useMemo } from 'react';
import type { AxisAllocation, ChannelProfile, GenrePack, ListeningIntent } from '../types';
import { computeGenreComboSummary } from '../core/genreComboSummary';
import { computeGenreComboAdvice } from '../core/genreComboAdvisor';

/**
 * 지시문 25 (TASK B/C) — 장르 선택 영역 아래, 설계안으로 넘어가기 전에 보이는
 * 조합 요약 + 조언. 전부 참고용이다 — 무시하고 진행할 수 있다(§C-1, 이
 * 컴포넌트는 선택을 막는 어떤 disabled/blocking prop도 갖지 않는다).
 * 장르 선택이 바뀔 때마다 selectedGenres prop이 바뀌어 자동 갱신된다(§B-3).
 */

interface GenreComboSummaryPanelProps {
  selectedGenres: GenrePack[];
  channel: ChannelProfile;
  songCount: number;
  diversityAllocations: AxisAllocation[] | undefined;
  listeningIntent: ListeningIntent | undefined;
}

export default function GenreComboSummaryPanel({ selectedGenres, channel, songCount, diversityAllocations, listeningIntent }: GenreComboSummaryPanelProps) {
  const summary = useMemo(
    () => computeGenreComboSummary(selectedGenres, channel, songCount, diversityAllocations),
    [selectedGenres, channel, songCount, diversityAllocations]
  );
  const advice = useMemo(
    () => computeGenreComboAdvice(selectedGenres, summary, channel, listeningIntent),
    [selectedGenres, summary, channel, listeningIntent]
  );

  if (!selectedGenres.length) return null;

  return (
    <div className="option-block compact genre-combo-summary">
      <h4>📊 선택하신 조합</h4>
      <div className="genre-combo-rows">
        {summary.rows.map(row => (
          <div key={row.genreId} className="genre-combo-row">
            <span>{row.labelKo}</span>
            <span>{row.songCount}곡</span>
            <span>에너지 {row.perceivedEnergy}</span>
            <span>{row.eraBuckets.includes('era-neutral') ? '시대색 없음' : row.eraBuckets.join('-')}</span>
          </div>
        ))}
      </div>
      <p className="supporting">시대색 {summary.eraNoteKo}</p>
      <p className="supporting">에너지 {summary.energyNoteKo}</p>
      <p className="supporting">템포 {summary.tempoMin}~{summary.tempoMax} BPM · 중앙 {summary.tempoMedian}</p>
      {summary.vocalNoteKo && <p className="supporting">보컬 {summary.vocalNoteKo}</p>}

      {advice.length > 0 && (
        <div className="genre-combo-advice">
          {advice.map(item => (
            <p key={item.type}>⚠ {item.messageKo}</p>
          ))}
        </div>
      )}
    </div>
  );
}
