import { useEffect, useState } from 'react';
import { Download, FileText, Focus, Headphones, ListMusic, RotateCcw, Save, Sparkles, Image as ImageIcon, Mic2 } from 'lucide-react';
import SongCard, { SongCardSkeleton } from '../SongCard';
import HybridRefinePanel from '../HybridRefinePanel';
import ThumbnailSpecPanel from '../ThumbnailSpecPanel';
import ThumbnailImageStudioPanel from '../ThumbnailImageStudioPanel';
import PersonaPanel, { type PersonaPromptStats } from '../PersonaPanel';
import FocusMode from '../FocusMode';
import SunoProgressMode from '../SunoProgressMode';
import { buildSongTxt, downloadBlob, downloadText, exportCsv, exportJson, exportMarkdown } from '../../utils/exporters';
import { buildZip, safeFileName } from '../../utils/zipExporter';
import { exportDocxBlob } from '../../utils/docxExporter';
import { RECOMMENDATION_BADGE, STAGE_ADVICE } from '../../core/apiAdvisor';
import type { AgentEvaluation, DisplayLanguage, PlaylistBlueprint, SongIdea, SoundSignature, ThumbnailVariantId } from '../../types';
import type { ChannelPersonaRecord } from '../../core/library';
import type { ThumbnailSpec } from '../../core/thumbnailSpec';
import type { ThumbnailArchetypeId } from '../../data/thumbnailArchetypes';

interface Step4ResultProps {
  blueprint: PlaylistBlueprint | null;
  isGenerating: boolean;
  genProgress: { done: number; total: number };
  partialSongs: SongIdea[];
  generationError: string;
  moneyChordLabel: string;
  evaluation: AgentEvaluation | null;
  evalError: string;
  isEvaluating: boolean;
  evalProgress: { done: number; total: number };
  evaluationAvailable: boolean;
  retryingTrack: number | null;
  retryWarning: string;
  undoTrackNo: number | null;
  hybridRefineAvailable: boolean;
  isRefining: boolean;
  refineProgress: { done: number; total: number };
  refineWarnings: string[];
  thumbnailSpec: ThumbnailSpec | null;
  thumbnailSeasonId: string;
  thumbnailArchetypeId: ThumbnailArchetypeId;
  thumbnailPackagingLanguage: DisplayLanguage;
  /** TASK v3.37-b — GenerationOptions.customConcept for the pack currently in the editor. */
  thumbnailCustomConcept: string;
  soundSignature: SoundSignature | null;
  personaMode: boolean;
  personaPromptStats: PersonaPromptStats | null;
  savedPersonas: ChannelPersonaRecord[];
  promptCharLimit?: number;
  onSelectThumbnailArchetype: (id: ThumbnailArchetypeId) => void;
  onPersonaModeChange: (enabled: boolean) => void;
  onSavePersonaName: () => void;
  onSave: () => void;
  onEvaluate: (scopeTrackNos?: number[]) => void;
  onRetrySong: (trackNo: number, issues: string[]) => void;
  onUndoRetry: () => void;
  onRefineSelected: (trackNos: number[]) => void;
  onRegenerateHeadline: () => void;
  onSelectThumbnailVariant: (id: ThumbnailVariantId) => void;
  onApplyThumbnailFreeText: (suggestions: { headline: string; angle: string }[]) => void;
  /** TASK I3 (v3.11, PART D-4) — manual override for the automatic cold-open/flagship pick. */
  onPromoteTrack: (trackNo: number, role: 'cold-open' | 'flagship') => void;
}

export default function Step4Result({
  blueprint,
  isGenerating,
  genProgress,
  partialSongs,
  generationError,
  moneyChordLabel,
  evaluation,
  evalError,
  isEvaluating,
  evalProgress,
  evaluationAvailable,
  retryingTrack,
  retryWarning,
  undoTrackNo,
  hybridRefineAvailable,
  isRefining,
  refineProgress,
  refineWarnings,
  thumbnailSpec,
  thumbnailSeasonId,
  thumbnailArchetypeId,
  thumbnailPackagingLanguage,
  thumbnailCustomConcept,
  soundSignature,
  personaMode,
  personaPromptStats,
  savedPersonas,
  promptCharLimit,
  onSelectThumbnailArchetype,
  onPersonaModeChange,
  onSavePersonaName,
  onSave,
  onEvaluate,
  onRetrySong,
  onUndoRetry,
  onRefineSelected,
  onRegenerateHeadline,
  onSelectThumbnailVariant,
  onApplyThumbnailFreeText,
  onPromoteTrack
}: Step4ResultProps) {
  const [evalScope, setEvalScope] = useState<'all' | 'selected'>('all');
  const [selectedTrackNos, setSelectedTrackNos] = useState<number[]>([]);
  const [refineSelection, setRefineSelection] = useState<number[]>([]);
  const [resultTab, setResultTab] = useState<'songs' | 'thumbnail' | 'persona'>('songs');
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [progressModeOpen, setProgressModeOpen] = useState(false);

  // TASK I6 (v3.11, PART D-3) — tracks 1-3 decide the video's first
  // impression, so they're pre-checked for hybrid refinement by default;
  // the user can still uncheck them (this only sets a default, it never
  // calls the API on its own — see v3.2's "묻고 실행" principle).
  useEffect(() => {
    if (!blueprint) return;
    setRefineSelection([1, 2, 3].filter(trackNo => trackNo <= blueprint.songs.length));
  }, [blueprint]);

  function toggleTrackSelected(trackNo: number) {
    setSelectedTrackNos(prev => (prev.includes(trackNo) ? prev.filter(no => no !== trackNo) : [...prev, trackNo]));
  }

  function toggleRefineSelected(trackNo: number) {
    setRefineSelection(prev => (prev.includes(trackNo) ? prev.filter(no => no !== trackNo) : [...prev, trackNo]));
  }

  function handleEvaluateClick() {
    onEvaluate(evalScope === 'selected' ? selectedTrackNos : undefined);
  }

  function handleRefineClick() {
    onRefineSelected(refineSelection);
    setRefineSelection([]);
  }

  async function handleWordExport() {
    if (!blueprint) return;
    const blob = await exportDocxBlob({ blueprint, thumbnailSpec: thumbnailSpec ?? undefined, soundSignature: soundSignature ?? undefined, personaMode });
    downloadBlob('suno-pack.docx', blob);
  }

  function handleTxtZipExport() {
    if (!blueprint) return;
    const zip = buildZip(blueprint.songs.map(song => ({
      name: `${song.trackNo.toString().padStart(2, '0')}_${safeFileName(song.title)}.txt`,
      content: buildSongTxt(song)
    })));
    downloadBlob('suno-pack-txt.zip', zip);
  }

  const packId = blueprint ? `${blueprint.channelName}::${blueprint.projectTitle}::${blueprint.songs.length}` : '';

  if (!blueprint && !isGenerating && !partialSongs.length) {
    return (
      <section className="panel">
        <p className="step-hint">아직 생성된 결과가 없어요. 이전 단계에서 곡을 생성해 보세요.</p>
        {generationError && <p className="error">{generationError}</p>}
      </section>
    );
  }

  const songs = blueprint?.songs ?? partialSongs;
  const skeletonCount = isGenerating ? Math.max(0, genProgress.total - songs.length) : 0;

  return (
    <section className="panel results">
      <p className="step-hint">완성된 곡부터 순서대로 나타납니다. 카드를 클릭하면 스타일 프롬프트 / 가사 / YouTube 탭을 볼 수 있어요.</p>

      {!isGenerating && generationError && (
        <p className="error">
          {generationError}
          {partialSongs.length > 0 && !blueprint && ` (완료된 ${partialSongs.length}곡은 아래에 남아 있습니다. 다시 생성하면 처음부터 다시 만들어집니다.)`}
        </p>
      )}

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
            <button type="button" onClick={() => void handleWordExport()}>
              <FileText size={16} />
              📄 WORD
            </button>
            <button type="button" title="곡별로 나눈 .txt 30개를 zip으로 내보내기 — 모바일에서 한 곡씩 열어 복사하기 좋습니다" onClick={handleTxtZipExport}>
              <Download size={16} />
              📝 TXT (곡별)
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.md', exportMarkdown(blueprint, thumbnailSpec ?? undefined, soundSignature ?? undefined, personaMode), 'text/markdown;charset=utf-8')}>
              <Download size={16} />
              MD
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.json', exportJson(blueprint, thumbnailSpec ?? undefined, soundSignature ?? undefined, personaMode), 'application/json;charset=utf-8')}>
              <Download size={16} />
              JSON
            </button>
            <button type="button" onClick={() => downloadText('suno-pack.csv', exportCsv(blueprint, soundSignature ?? undefined, personaMode), 'text/csv;charset=utf-8')}>
              <Download size={16} />
              CSV
            </button>
            <button
              type="button"
              disabled={isEvaluating || isRefining || !evaluationAvailable || (evalScope === 'selected' && selectedTrackNos.length === 0)}
              onClick={handleEvaluateClick}
              title={!evaluationAvailable ? '평가 기능은 Claude 또는 ChatGPT API 설정이 필요합니다.' : undefined}
            >
              <Sparkles size={16} />
              {isEvaluating
                ? `AI 평가 중... (${evalProgress.done}/${evalProgress.total})`
                : evalScope === 'selected'
                  ? `🧪 선택한 ${selectedTrackNos.length}곡만 평가하기`
                  : '🧪 전체 AI 평가하기'}
            </button>
            <button type="button" className="primary" onClick={() => setFocusModeOpen(true)}>
              <Focus size={16} />
              📱 집중 모드
            </button>
            <button type="button" className="primary" onClick={() => setProgressModeOpen(true)}>
              <Headphones size={16} />
              🎧 수노 진행 모드
            </button>
          </div>
        </div>
      )}

      {blueprint && focusModeOpen && (
        <FocusMode songs={blueprint.songs} packId={packId} onClose={() => setFocusModeOpen(false)} />
      )}

      {blueprint && progressModeOpen && (
        <SunoProgressMode
          songs={blueprint.songs}
          packId={packId}
          personaMode={personaMode}
          promptCharLimit={promptCharLimit}
          onClose={() => setProgressModeOpen(false)}
        />
      )}

      {blueprint && (
        <div className="tab-row">
          <button type="button" className={resultTab === 'songs' ? 'tab active' : 'tab'} onClick={() => setResultTab('songs')}>
            <ListMusic size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            곡 목록
          </button>
          <button type="button" className={resultTab === 'thumbnail' ? 'tab active' : 'tab'} onClick={() => setResultTab('thumbnail')}>
            <ImageIcon size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            🖼 썸네일 사양
          </button>
          <button type="button" className={resultTab === 'persona' ? 'tab active' : 'tab'} onClick={() => setResultTab('persona')}>
            <Mic2 size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Persona / Sound
          </button>
        </div>
      )}

      {blueprint && resultTab === 'thumbnail' && thumbnailSpec && (
        <ThumbnailSpecPanel
          spec={thumbnailSpec}
          defaultSeasonId={thumbnailSeasonId}
          selectedArchetypeId={thumbnailArchetypeId}
          packagingLanguage={thumbnailPackagingLanguage}
          customConcept={thumbnailCustomConcept}
          onSelectArchetype={onSelectThumbnailArchetype}
          onRegenerateHeadline={onRegenerateHeadline}
          onSelectVariant={onSelectThumbnailVariant}
          onApplyFreeTextHeadlines={onApplyThumbnailFreeText}
        />
      )}

      {blueprint && resultTab === 'thumbnail' && thumbnailSpec && (
        <ThumbnailImageStudioPanel
          spec={thumbnailSpec}
          defaultSeasonId={thumbnailSeasonId}
          defaultArchetypeId={thumbnailArchetypeId}
        />
      )}

      {blueprint && resultTab === 'persona' && soundSignature && personaPromptStats && (
        <PersonaPanel
          blueprint={blueprint}
          soundSignature={soundSignature}
          personaMode={personaMode}
          promptStats={personaPromptStats}
          savedPersonas={savedPersonas}
          onPersonaModeChange={onPersonaModeChange}
          onSavePersona={onSavePersonaName}
        />
      )}

      {resultTab === 'songs' && blueprint && hybridRefineAvailable && (
        <>
          <p className="supporting">
            💡 1~3번 곡은 영상의 첫인상을 좌우합니다. API로 다듬는 걸 권장해서 기본으로 선택해뒀어요. (원치 않으면 체크 해제하세요)
          </p>
          <HybridRefinePanel
            songs={blueprint.songs}
            selected={refineSelection}
            onToggle={toggleRefineSelected}
            onRefine={handleRefineClick}
            isRefining={isRefining}
            refineProgress={refineProgress}
            refineWarnings={refineWarnings}
          />
        </>
      )}

      {resultTab === 'songs' && blueprint && !evaluationAvailable && (
        <p className="supporting">평가 기능은 Claude 또는 ChatGPT API 설정이 필요합니다. (설정에서 제공자를 변경하세요)</p>
      )}

      {resultTab === 'songs' && blueprint && evaluationAvailable && (
        <div className="provider-summary">
          <p className="supporting api-advice-line">
            {RECOMMENDATION_BADGE[STAGE_ADVICE.evaluation.recommendation].emoji} {RECOMMENDATION_BADGE[STAGE_ADVICE.evaluation.recommendation].labelKo} ({STAGE_ADVICE.evaluation.suggestedModelKo}): {STAGE_ADVICE.evaluation.reasonKo}
          </p>
          <p className="supporting">
            평가 범위를 좁히면 API 호출 수가 줄어 비용이 절약됩니다. 곡이 많을수록 효과가 커요.
          </p>
          <div className="chips">
            <button type="button" className={evalScope === 'all' ? 'chip active' : 'chip'} onClick={() => setEvalScope('all')}>
              전체 {blueprint.songs.length}곡 평가
            </button>
            <button type="button" className={evalScope === 'selected' ? 'chip active' : 'chip'} onClick={() => setEvalScope('selected')}>
              선택한 곡만 평가 ({selectedTrackNos.length}곡 선택됨)
            </button>
          </div>
          {evalScope === 'selected' && (
            <p className="supporting">아래 곡 목록에서 평가하고 싶은 곡의 체크박스를 선택하세요.</p>
          )}
        </div>
      )}
      {resultTab === 'songs' && evalError && <p className="error">{evalError}</p>}
      {resultTab === 'songs' && retryWarning && <p className="error">{retryWarning}</p>}
      {resultTab === 'songs' && undoTrackNo !== null && (
        <div className="warning">
          <RotateCcw size={16} />
          <span>
            {undoTrackNo}번 곡을 다시 만들었어요.
            <button type="button" className="icon-button" title="이전 곡으로 되돌리기" onClick={onUndoRetry}>
              <RotateCcw size={14} />
              되돌리기
            </button>
          </span>
        </div>
      )}

      {resultTab === 'songs' && evaluation && (
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

      {resultTab === 'songs' && blueprint && (
        <div className="signature-grid">
          <div><b>Sonic</b><span>{blueprint.sonicSignature}</span></div>
          <div><b>Vocal</b><span>{blueprint.vocalSignature}</span></div>
          <div><b>Visual</b><span>{blueprint.visualRules.join(' / ')}</span></div>
        </div>
      )}

      {resultTab === 'songs' && songs.map(song => (
        retryingTrack === song.trackNo ? (
          <SongCardSkeleton key={song.trackNo} trackNo={song.trackNo} />
        ) : (
          <SongCard
            key={song.trackNo}
            song={song}
            moneyChordLabel={moneyChordLabel}
            evaluation={evaluation?.songs.find(item => item.trackNo === song.trackNo)}
            isRetrying={false}
            onRetry={onRetrySong}
            selectable={evalScope === 'selected' && evaluationAvailable}
            selected={selectedTrackNos.includes(song.trackNo)}
            onToggleSelect={toggleTrackSelected}
            personaMode={personaMode}
            personaName={soundSignature?.personaName}
            promptCharLimit={promptCharLimit}
            onPromote={onPromoteTrack}
          />
        )
      ))}
      {resultTab === 'songs' && Array.from({ length: skeletonCount }, (_, i) => (
        <SongCardSkeleton key={`skeleton-${songs.length + i + 1}`} trackNo={songs.length + i + 1} />
      ))}
    </section>
  );
}
