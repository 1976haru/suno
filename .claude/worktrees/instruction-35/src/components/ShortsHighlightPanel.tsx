import { useEffect, useMemo, useState } from 'react';
import { Film, Upload } from 'lucide-react';
import type { SongIdea } from '../types';
import {
  analyzeForHighlight,
  buildShortsFadePlan,
  buildShortsFileName,
  renderShortsClipToWav,
  SHORTS_LENGTH_DEFAULT_SEC,
  SHORTS_LENGTH_OPTIONS,
  type HighlightAnalysis,
  type ShortsLengthSec
} from '../core/audioHighlight';
import { parseLeadingTrackNumber } from '../core/audioTrackMatch';

/**
 * TASK v4.15 (TASK A) — "숏츠용 하이라이트" 패널 (§1-7). Self-contained, like
 * AudioEditPanel.tsx: takes an optional `songs` list (for nicer titles when
 * a filename's leading track number matches a real song) and exposes
 * nothing else — a parent just drops this into a tab/panel.
 *
 * Auto-detection (core/audioHighlight.ts) always produces a RECOMMENDATION,
 * never a forced result (§5 "자동 탐지 결과를 강제하지 말 것") — `manualStartSec`
 * below is the per-file override the ◀5초/5초▶ buttons write to; the
 * recommendation is only ever the fallback when no override has been set.
 */
export interface ShortsHighlightPanelProps {
  songs?: SongIdea[];
}

interface FileState {
  file: File;
  analyzing: boolean;
  error?: string;
  analysis?: HighlightAnalysis;
  manualStartSec?: number;
  previewUrl?: string;
  previewBusy: boolean;
  saveBusy: boolean;
  savedFileName?: string;
}

function formatMinSec(totalSec: number): string {
  const clamped = Number.isFinite(totalSec) && totalSec > 0 ? totalSec : 0;
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.round(clamped % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function titleFor(fileName: string, songs?: SongIdea[]): string | undefined {
  if (!songs?.length) return undefined;
  const trackNo = parseLeadingTrackNumber(fileName.replace(/\.[^./\\]+$/, ''));
  if (trackNo === null) return undefined;
  return songs.find(s => s.trackNo === trackNo)?.title;
}

export default function ShortsHighlightPanel({ songs }: ShortsHighlightPanelProps) {
  const [lengthSec, setLengthSec] = useState<ShortsLengthSec>(SHORTS_LENGTH_DEFAULT_SEC);
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Revoke every preview blob URL on unmount.
  useEffect(() => () => { files.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function analyzeOne(file: File, targetLengthSec: ShortsLengthSec) {
    setFiles(prev => prev.map(f => (f.file === file ? { ...f, analyzing: true, error: undefined } : f)));
    try {
      const analysis = await analyzeForHighlight(file, targetLengthSec);
      setFiles(prev => prev.map(f => (f.file === file ? { ...f, analyzing: false, analysis, manualStartSec: undefined } : f)));
    } catch {
      setFiles(prev => prev.map(f => (f.file === file ? { ...f, analyzing: false, error: '분석에 실패했습니다 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.' } : f)));
    }
  }

  function addFiles(newFiles: File[]) {
    const audioFiles = newFiles.filter(f => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f.name));
    if (!audioFiles.length) return;
    const existingNames = new Set(files.map(f => f.file.name));
    const toAdd = audioFiles.filter(f => !existingNames.has(f.name));
    if (!toAdd.length) return;
    setFiles(prev => [...prev, ...toAdd.map(file => ({ file, analyzing: true, previewBusy: false, saveBusy: false }))]);
    // Each file analyzed independently (§1-7's own "여러 파일을 한 번에 드롭해도 각각 처리") — sequential, matching this app's established "한 곡씩 처리" convention elsewhere in the audio tooling.
    void (async () => {
      for (const file of toAdd) await analyzeOne(file, lengthSec);
    })();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    addFiles(picked);
  }

  function changeLength(next: ShortsLengthSec) {
    setLengthSec(next);
    const toReanalyze = files.map(f => f.file);
    void (async () => {
      for (const file of toReanalyze) await analyzeOne(file, next);
    })();
  }

  function nudge(fileName: string, deltaSec: number) {
    setFiles(prev => prev.map(f => {
      if (f.file.name !== fileName || !f.analysis) return f;
      const current = f.manualStartSec ?? f.analysis.recommendedStartSec;
      const maxStart = Math.max(0, f.analysis.durationSec - f.analysis.lengthSec);
      const next = Math.max(0, Math.min(maxStart, current + deltaSec));
      return { ...f, manualStartSec: next };
    }));
  }

  function effectiveStart(f: FileState): number {
    return f.manualStartSec ?? f.analysis?.recommendedStartSec ?? 0;
  }

  async function preview(fileName: string) {
    const target = files.find(f => f.file.name === fileName);
    if (!target?.analysis) return;
    setFiles(prev => prev.map(f => (f.file.name === fileName ? { ...f, previewBusy: true } : f)));
    try {
      const plan = buildShortsFadePlan(effectiveStart(target), target.analysis.lengthSec);
      const blob = await renderShortsClipToWav(target.file, plan);
      const url = URL.createObjectURL(blob);
      setFiles(prev => prev.map(f => {
        if (f.file.name !== fileName) return f;
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        return { ...f, previewUrl: url, previewBusy: false };
      }));
    } catch {
      setFiles(prev => prev.map(f => (f.file.name === fileName ? { ...f, previewBusy: false, error: '미리듣기 렌더링에 실패했습니다.' } : f)));
    }
  }

  async function save(fileName: string) {
    const target = files.find(f => f.file.name === fileName);
    if (!target?.analysis) return;
    setFiles(prev => prev.map(f => (f.file.name === fileName ? { ...f, saveBusy: true } : f)));
    try {
      const plan = buildShortsFadePlan(effectiveStart(target), target.analysis.lengthSec);
      const blob = await renderShortsClipToWav(target.file, plan);
      const outName = buildShortsFileName(target.file.name, target.analysis.lengthSec);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setFiles(prev => prev.map(f => (f.file.name === fileName ? { ...f, saveBusy: false, savedFileName: outName } : f)));
    } catch {
      setFiles(prev => prev.map(f => (f.file.name === fileName ? { ...f, saveBusy: false, error: '저장 렌더링에 실패했습니다.' } : f)));
    }
  }

  // §1-8 — 트랙 1-3(대표곡)을 상단에 표시, 나머지는 업로드 순서 유지.
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const aRep = a.analysis?.isRepresentative ? 0 : 1;
      const bRep = b.analysis?.isRepresentative ? 0 : 1;
      return aRep - bRep;
    });
  }, [files]);

  return (
    <div className="option-block shorts-highlight-panel">
      <div className="section-head">
        <h3><Film size={16} style={{ verticalAlign: '-2px', marginRight: 4 }} />숏츠용 하이라이트</h3>
        <span className="supporting">{files.length}개 파일</span>
      </div>

      <p className="callout">
        ⓘ 마지막 후렴 부근이 자동 선택됩니다. 화살표로 조정할 수 있어요. 인트로·아웃트로(앞 15%·뒤 10%)는 후보에서 제외됩니다.
        저장 파일은 mp3가 아닌 wav이며, 원본 파일은 절대 덮어쓰지 않습니다.
      </p>

      <label>길이</label>
      <div className="button-row">
        {SHORTS_LENGTH_OPTIONS.map(opt => (
          <button key={opt} type="button" className={lengthSec === opt ? 'chip active' : 'chip'} onClick={() => changeLength(opt)}>
            {opt}초
          </button>
        ))}
      </div>

      <div
        className={dragOver ? 'audio-drop-zone drag-over' : 'audio-drop-zone'}
        onDragOver={event => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload size={20} />
        <p>완성된 mp3/wav 파일을 여기로 드래그하거나</p>
        <label className="chip">
          파일 선택
          <input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg" multiple onChange={handleFileInput} style={{ display: 'none' }} />
        </label>
      </div>

      {sortedFiles.map(f => {
        const title = titleFor(f.file.name, songs);
        return (
          <div key={f.file.name} className="option-block compact shorts-file-card">
            <div className="section-head">
              <b>{title ? `${title} (${f.file.name})` : f.file.name}</b>
              {f.analysis?.isRepresentative && <span className="chip active">대표곡 — 숏츠 추천</span>}
            </div>

            {f.analyzing && <p className="supporting">분석 중...</p>}
            {f.error && <p className="error">{f.error}</p>}

            {f.analysis && (
              <>
                <p className="supporting">
                  추천 구간 {formatMinSec(effectiveStart(f))} ~ {formatMinSec(effectiveStart(f) + f.analysis.lengthSec)}
                  {' '}(전체 {formatMinSec(f.analysis.durationSec)})
                  {f.manualStartSec !== undefined && ' · 수동 조정됨'}
                </p>

                <div className="audio-rms-bar-row" title="음량 곡선 — 파란 막대가 선택 구간입니다">
                  {f.analysis.rmsBinsSec.map((value, idx) => {
                    const maxRms = Math.max(...f.analysis!.rmsBinsSec, 1e-6);
                    const selected = idx >= effectiveStart(f) && idx < effectiveStart(f) + f.analysis!.lengthSec;
                    return (
                      <span
                        key={idx}
                        className={selected ? 'audio-rms-bar selected' : 'audio-rms-bar'}
                        style={{ height: `${4 + (value / maxRms) * 32}px` }}
                      />
                    );
                  })}
                </div>

                <div className="button-row">
                  <button type="button" className="chip" onClick={() => nudge(f.file.name, -5)}>◀ 5초</button>
                  <button type="button" className="chip" onClick={() => nudge(f.file.name, 5)}>5초 ▶</button>
                  <button type="button" className="chip" disabled={f.previewBusy} onClick={() => void preview(f.file.name)}>
                    {f.previewBusy ? '렌더링 중...' : '미리듣기'}
                  </button>
                  <button type="button" className="chip active" disabled={f.saveBusy} onClick={() => void save(f.file.name)}>
                    {f.saveBusy ? '저장 중...' : '저장 (.wav)'}
                  </button>
                </div>

                {f.savedFileName && <p className="supporting">저장됨: {f.savedFileName}</p>}
                {f.previewUrl && <audio controls src={f.previewUrl} style={{ width: '100%', marginTop: 6 }} />}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
