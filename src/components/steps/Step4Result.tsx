import { Download, Save, Sparkles } from 'lucide-react';
import SongCard, { SongCardSkeleton } from '../SongCard';
import { downloadText, exportCsv, exportJson, exportMarkdown } from '../../utils/exporters';
import type { AgentEvaluation, PlaylistBlueprint, SongIdea } from '../../types';

interface Step4ResultProps {
  blueprint: PlaylistBlueprint | null;
  isGenerating: boolean;
  genProgress: { done: number; total: number };
  partialSongs: SongIdea[];
  moneyChordLabel: string;
  evaluation: AgentEvaluation | null;
  evalError: string;
  isEvaluating: boolean;
  evalProgress: { done: number; total: number };
  evaluationAvailable: boolean;
  retryingTrack: number | null;
  onSave: () => void;
  onEvaluate: () => void;
  onRetrySong: (trackNo: number, issues: string[]) => void;
}

export default function Step4Result({
  blueprint,
  isGenerating,
  genProgress,
  partialSongs,
  moneyChordLabel,
  evaluation,
  evalError,
  isEvaluating,
  evalProgress,
  evaluationAvailable,
  retryingTrack,
  onSave,
  onEvaluate,
  onRetrySong
}: Step4ResultProps) {
  if (!blueprint && !isGenerating) {
    return (
      <section className="panel">
        <p className="step-hint">아직 생성된 결과가 없어요. 이전 단계에서 곡을 생성해 보세요.</p>
      </section>
    );
  }

  const songs = blueprint?.songs ?? partialSongs;
  const skeletonCount = isGenerating ? Math.max(0, genProgress.total - songs.length) : 0;

  return (
    <section className="panel results">
      <p className="step-hint">완성된 곡부터 순서대로 나타납니다. 카드를 클릭하면 스타일 프롬프트 / 가사 / YouTube 탭을 볼 수 있어요.</p>

      {blueprint && (
        <div className="panel-header">
          <div>
            <p className="eyebrow">Generated Pack</p>
            <h2>{blueprint.projectTitle}</h2>
            <p className="supporting">{blueprint.oneLineConcept}</p>
          </div>
          <div className="button-row">
            <button type="button" className="primary" onClick={onSave}>
              <Save size={16} />
              💾 이 팩 저장하기
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.md', exportMarkdown(blueprint), 'text/markdown;charset=utf-8')}>
              <Download size={16} />
              MD
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.json', exportJson(blueprint), 'application/json;charset=utf-8')}>
              <Download size={16} />
              JSON
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.csv', exportCsv(blueprint), 'text/csv;charset=utf-8')}>
              <Download size={16} />
              CSV
            </button>
            <button
              type="button"
              disabled={isEvaluating || !evaluationAvailable}
              onClick={onEvaluate}
              title={!evaluationAvailable ? '평가 기능은 Claude 또는 ChatGPT API 설정이 필요합니다.' : undefined}
            >
              <Sparkles size={16} />
              {isEvaluating ? `AI 평가 중... (${evalProgress.done}/${evalProgress.total})` : '🧪 AI 평가하기'}
            </button>
          </div>
        </div>
      )}

      {blueprint && !evaluationAvailable && (
        <p className="supporting">평가 기능은 Claude 또는 ChatGPT API 설정이 필요합니다. (설정에서 제공자를 변경하세요)</p>
      )}
      {evalError && <p className="error">{evalError}</p>}

      {evaluation && (
        <div className="signature-grid">
          <div><b>다양성</b><span>{evaluation.packLevel.diversityScore}/100</span></div>
          <div><b>톤 일관성</b><span>{evaluation.packLevel.coherenceScore}/100</span></div>
          <div><b>구성 순서</b><span>{evaluation.packLevel.sequencingScore}/100</span></div>
          <div style={{ gridColumn: '1 / -1' }}><b>총평</b><span>{evaluation.packLevel.summary}</span></div>
          {evaluation.packLevel.duplicateWarnings.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}><b>중복 경고</b><span>{evaluation.packLevel.duplicateWarnings.join(' / ')}</span></div>
          )}
        </div>
      )}

      {blueprint && (
        <div className="signature-grid">
          <div><b>Sonic</b><span>{blueprint.sonicSignature}</span></div>
          <div><b>Vocal</b><span>{blueprint.vocalSignature}</span></div>
          <div><b>Visual</b><span>{blueprint.visualRules.join(' / ')}</span></div>
        </div>
      )}

      {songs.map(song => (
        <SongCard
          key={song.trackNo}
          song={song}
          moneyChordLabel={moneyChordLabel}
          evaluation={evaluation?.songs.find(item => item.trackNo === song.trackNo)}
          isRetrying={retryingTrack === song.trackNo}
          onRetry={onRetrySong}
        />
      ))}
      {Array.from({ length: skeletonCount }, (_, i) => (
        <SongCardSkeleton key={`skeleton-${songs.length + i + 1}`} trackNo={songs.length + i + 1} />
      ))}
    </section>
  );
}
