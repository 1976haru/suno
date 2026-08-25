import { useEffect, useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import {
  computeFadeOutPlan,
  computeSpeedPlan,
  buildEditedFileName,
  encodeWavFromAudioBuffer,
  formatMinSec,
  parseMinSec,
  renderFadeOutEdit,
  renderFadeOutPreview,
  renderSpeedEdit,
  renderSpeedPreview,
  FADE_LENGTH_DEFAULT_SEC,
  FADE_LENGTH_MIN_SEC,
  FADE_LENGTH_MAX_SEC,
  PREVIEW_TAIL_SEC,
  type FadeOutPlan,
  type SpeedPlan
} from '../core/audioEdit';

/**
 * TASK v3.79 (TASK E) — self-contained "shorten this finished mp3" panel.
 * 하루님's own framing: a track rendered 4:16 but she wanted ~3:30, and
 * wants to trim it without re-generating. Exactly two edit modes (see
 * src/core/audioEdit.ts's own doc comment for why no others): fade-out
 * early end (recommended/default) and a hard-capped-at-3% speed change.
 *
 * Deliberately standalone — takes a File + duration as props and exposes
 * nothing else, so another piece of UI (e.g. AudioAnalysisPanel.tsx, owned
 * by a different task in this same spec) can drop it into a modal/panel
 * later without this component reaching into shared app state.
 *
 * The original File is only ever read (file.arrayBuffer() inside
 * decodeAudioFile) — never mutated, and the edited output is always saved
 * under a different name (`<원본이름>_edit.wav`, see buildEditedFileName),
 * so the source file on the user's disk and in the app's own state is
 * never at risk of being overwritten.
 */
export interface AudioEditPanelProps {
  /** The original Suno export. Read-only — never mutated or discarded by this component. */
  file: File;
  /** The original file's duration in seconds (caller already knows this, e.g. from audioAnalysis.ts's analyzeAudioFile — avoids a redundant decode just to read duration). */
  durationSec: number;
  /** Optional display title (e.g. "T7 Dance Hall Smile") — falls back to file.name. */
  title?: string;
  onClose?: () => void;
}

type EditMode = 'fade' | 'speed';

function objectUrlFromBlob(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export default function AudioEditPanel({ file, durationSec, title, onClose }: AudioEditPanelProps) {
  const [mode, setMode] = useState<EditMode>('fade');
  const [targetInput, setTargetInput] = useState(() => formatMinSec(Math.max(10, durationSec - 30)));
  const [fadeLengthSec, setFadeLengthSec] = useState(FADE_LENGTH_DEFAULT_SEC);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState('');

  const targetDurationSec = useMemo(() => {
    const parsed = parseMinSec(targetInput);
    return parsed === null ? durationSec : Math.min(parsed, durationSec);
  }, [targetInput, durationSec]);

  const fadePlan: FadeOutPlan = useMemo(
    () => computeFadeOutPlan(durationSec, targetDurationSec, fadeLengthSec),
    [durationSec, targetDurationSec, fadeLengthSec]
  );
  const speedPlan: SpeedPlan = useMemo(
    () => computeSpeedPlan(durationSec, targetDurationSec),
    [durationSec, targetDurationSec]
  );

  // Revoke any preview blob URL on unmount or when a new one replaces it.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function handlePreview() {
    setError('');
    setPreviewBusy(true);
    try {
      const rendered = mode === 'fade'
        ? await renderFadeOutPreview(file, fadePlan, PREVIEW_TAIL_SEC)
        : await renderSpeedPreview(file, speedPlan, PREVIEW_TAIL_SEC);
      const blob = encodeWavFromAudioBuffer(rendered);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrlFromBlob(blob);
      });
    } catch {
      setError('미리듣기 렌더링에 실패했습니다 — 브라우저가 Web Audio API를 지원하는지 확인해주세요.');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleSave() {
    setError('');
    setSaveBusy(true);
    try {
      const rendered = mode === 'fade'
        ? await renderFadeOutEdit(file, fadePlan)
        : await renderSpeedEdit(file, speedPlan);
      const blob = encodeWavFromAudioBuffer(rendered);
      const url = objectUrlFromBlob(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildEditedFileName(file.name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Original `file` reference and on-disk file are never touched — this only downloads a new, separately-named file.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError('저장 렌더링에 실패했습니다 — 브라우저가 Web Audio API를 지원하는지 확인해주세요.');
    } finally {
      setSaveBusy(false);
    }
  }

  const speedShortfallLabel = speedPlan.targetReached
    ? null
    : `(${formatMinSec(speedPlan.shortfallSec)}는 줄일 수 없음)`;

  return (
    <div className="option-block audio-edit-panel">
      <div className="section-head">
        <h3><Scissors size={16} style={{ verticalAlign: '-2px', marginRight: 4 }} />{title ?? file.name} — {formatMinSec(durationSec)}</h3>
        {onClose && <button type="button" className="chip" onClick={onClose}>닫기</button>}
      </div>

      <p className="callout">
        ⓘ 완성된 음원을 짧게 자릅니다. 중간 부분을 잘라내지는 않습니다 — ① 끝을 페이드아웃으로 줄이거나 ② 전체 속도를
        최대 3%까지만 올립니다 (그 이상은 음정이 눈에 띄게 올라갑니다). 저장 파일은 mp3가 아닌 wav입니다.
      </p>

      <label>목표 길이</label>
      <div className="inline">
        <input
          type="range"
          min={Math.max(0, Math.round(durationSec * 0.5))}
          max={Math.round(durationSec)}
          value={Math.round(targetDurationSec)}
          onChange={event => setTargetInput(formatMinSec(Number(event.target.value)))}
        />
        <input
          type="text"
          value={targetInput}
          onChange={event => setTargetInput(event.target.value)}
          onBlur={() => setTargetInput(formatMinSec(targetDurationSec))}
          style={{ width: 64 }}
        />
      </div>

      <div className="option-block compact">
        <button type="button" className={mode === 'fade' ? 'chip active' : 'chip'} onClick={() => setMode('fade')}>
          ● 페이드 아웃으로 줄이기 (권장)
        </button>
        <p className="supporting">
          {formatMinSec(fadePlan.fadeStartSec)} 부터 {fadePlan.fadeLengthSec.toFixed(0)}초 페이드 → {formatMinSec(fadePlan.achievedDurationSec)}
          {fadePlan.warning && ` · ${fadePlan.warning}`}
        </p>
        {mode === 'fade' && (
          <div className="inline">
            <label style={{ minWidth: 80 }}>페이드 길이</label>
            <input
              type="range"
              min={FADE_LENGTH_MIN_SEC}
              max={FADE_LENGTH_MAX_SEC}
              value={fadeLengthSec}
              onChange={event => setFadeLengthSec(Number(event.target.value))}
            />
            <input
              type="number"
              min={FADE_LENGTH_MIN_SEC}
              max={FADE_LENGTH_MAX_SEC}
              value={fadeLengthSec}
              onChange={event => setFadeLengthSec(Number(event.target.value))}
              style={{ width: 56 }}
            />
            <span className="supporting">초</span>
          </div>
        )}
      </div>

      <div className="option-block compact">
        <button type="button" className={mode === 'speed' ? 'chip active' : 'chip'} onClick={() => setMode('speed')}>
          ○ 속도 조정
        </button>
        <p className="supporting">
          {((speedPlan.speedRatio - 1) * 100).toFixed(1)}% 빠르게 → {formatMinSec(speedPlan.achievedDurationSec)}
          {speedShortfallLabel && ` ${speedShortfallLabel}`}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="button-row">
        <button type="button" className="chip" onClick={() => void handlePreview()} disabled={previewBusy}>
          {previewBusy ? '미리듣기 렌더링 중...' : `미리듣기 (마지막 ${PREVIEW_TAIL_SEC}초)`}
        </button>
        <button type="button" className="chip active" onClick={() => void handleSave()} disabled={saveBusy}>
          {saveBusy ? '저장 렌더링 중...' : '저장 (.wav)'}
        </button>
      </div>

      {previewUrl && <audio controls src={previewUrl} style={{ width: '100%', marginTop: 8 }} />}
    </div>
  );
}
