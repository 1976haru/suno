import { useState } from 'react';
import { Music2, Download } from 'lucide-react';
import type { SongIdea } from '../types';
import { matchAudioFiles } from '../core/audioTrackMatch';
import { buildPreviewConcat, encodeWavFile, previewConcatFileName, type DecodedTrackAudio } from '../core/previewConcat';
import { downloadBlob } from '../utils/exporters';

/**
 * v4.3 (TASK E-2) — "각 곡의 첫 15초만 이어붙인 파일 생성 ... 인트로만
 * 빠르게 확인해 어색한 곡을 골라낼 수 있습니다" (하루님). Browser-only:
 * decodes uploaded Suno mp3 exports via Web Audio API, matches each
 * filename back to a trackNo (core/audioTrackMatch.ts — same matcher
 * AudioAnalysisPanel already uses), then hands the decoded buffers to
 * core/previewConcat.ts's pure truncate+concatenate+WAV-encode logic. This
 * app never persists the uploaded audio itself (same policy as
 * core/audioTakes.ts) — files only ever exist in this tab's own memory for
 * the duration of building the preview.
 */

interface PreviewConcatPanelProps {
  songs: SongIdea[];
  setLabel: string;
}

export default function PreviewConcatPanel({ songs, setLabel }: PreviewConcatPanelProps) {
  const [status, setStatus] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setBusy(true);
    setStatus('디코딩 중...');
    setWarnings([]);
    try {
      const files = Array.from(fileList);
      const matches = matchAudioFiles(files.map(f => f.name), songs.map(s => ({ trackNo: s.trackNo, title: s.title })));
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decoded: DecodedTrackAudio[] = [];
      const localWarnings: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const match = matches[i];
        if (match.trackNo === undefined) {
          localWarnings.push(`"${files[i].name}" — 트랙을 찾지 못해 건너뜁니다.`);
          continue;
        }
        const song = songs.find(s => s.trackNo === match.trackNo);
        const arrayBuffer = await files[i].arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        decoded.push({ trackNo: match.trackNo, title: song?.title ?? files[i].name, buffer: audioBuffer });
      }
      decoded.sort((a, b) => a.trackNo - b.trackNo);

      const { result, warnings: buildWarnings } = buildPreviewConcat(decoded, { secondsPerTrack: 15 });
      const allWarnings = [...localWarnings, ...buildWarnings];
      setWarnings(allWarnings);

      if (!result) {
        setStatus('미리듣기를 만들지 못했습니다.');
        return;
      }
      const blob = encodeWavFile(result);
      downloadBlob(previewConcatFileName(setLabel), blob);
      setStatus(`완료 — ${decoded.length}곡, 총 ${Math.round(result.totalSeconds)}초 (${previewConcatFileName(setLabel)} 다운로드됨)`);
    } catch (error) {
      setStatus(`오류: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="preview-concat-panel panel">
      <div className="button-row">
        <Music2 size={16} />
        <strong>첫 15초 미리듣기 파일 만들기</strong>
      </div>
      <p className="supporting">
        수노에서 내려받은 mp3 파일들을 한꺼번에 선택하세요 — 파일명 앞의 트랙번호("01 ...")로 자동 매칭합니다.
        각 곡의 첫 15초만 곡 사이 0.5초 무음을 두고 이어붙인 wav 파일 하나로 다운로드됩니다 (곡 수 x 15초 + 무음 분량).
      </p>
      <label className="button-row">
        <Download size={14} />
        <input type="file" accept="audio/*" multiple disabled={busy} onChange={event => void handleFiles(event.target.files)} />
      </label>
      {status && <p className="supporting">{status}</p>}
      {warnings.length > 0 && (
        <ul className="supporting">
          {warnings.map((warning, i) => <li key={i}>{warning}</li>)}
        </ul>
      )}
    </div>
  );
}
