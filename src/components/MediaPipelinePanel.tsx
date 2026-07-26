import { useEffect, useMemo, useState } from 'react';
import { Download, FileAudio, FolderOpen, Image as ImageIcon, Square, Video } from 'lucide-react';
import type { PlaylistBlueprint } from '../types';
import { downloadText } from '../utils/exporters';

interface MediaPipelinePanelProps {
  blueprint: PlaylistBlueprint;
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function buildChapters(titles: string[], files: DesktopFileRef[]) {
  let cursor = 0;
  return files.map((file, index) => {
    const line = `${formatDuration(cursor)} ${titles[index] || file.name}`;
    cursor += Number.isFinite(file.durationSec) ? file.durationSec : 0;
    return line;
  }).join('\n') + (files.length ? '\n' : '');
}

export default function MediaPipelinePanel({ blueprint }: MediaPipelinePanelProps) {
  const api = window.desktopAPI;
  const [audioFiles, setAudioFiles] = useState<DesktopFileRef[]>([]);
  const [imageFile, setImageFile] = useState<DesktopFileRef | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [resolution, setResolution] = useState<1280 | 1920>(1920);
  const [imageMode, setImageMode] = useState<'contain' | 'cover'>('cover');
  const [preset, setPreset] = useState<'ultrafast' | 'veryfast' | 'medium'>('veryfast');
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [progress, setProgress] = useState<DesktopMediaProgress | null>(null);
  const [activeJobId, setActiveJobId] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [error, setError] = useState('');

  const titles = useMemo(() => blueprint.songs.map(song => song.title), [blueprint.songs]);
  const exactMatch = audioFiles.length === blueprint.songs.length;
  const totalDuration = audioFiles.reduce((sum, file) => sum + (file.durationSec || 0), 0);
  const isRendering = progress != null && progress.stage !== 'done';
  const projectName = blueprint.projectTitle.trim() || 'Suno Playlist';

  useEffect(() => {
    if (!api) return undefined;
    return api.onMediaProgress(next => {
      setProgress(next);
      if (next.jobId) setActiveJobId(next.jobId);
    });
  }, [api]);

  async function selectAudioFiles() {
    if (!api) return;
    setError('');
    try {
      setAudioFiles(await api.pickAudioFiles());
      setOutputPath('');
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  }

  async function selectImage() {
    if (!api) return;
    setError('');
    try {
      const selected = await api.pickImage();
      setImageFile(selected);
      setImagePreview(selected ? (await api.readImageDataUrl(selected.id)) || '' : '');
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  }

  async function renderPlaylist() {
    if (!api || !imageFile || !exactMatch) return;
    setError('');
    setOutputPath('');
    setProgress({ jobId: '', stage: 'encode', percent: 0, label: '렌더링 준비 중' });
    try {
      const result = await api.renderPlaylistMp4({
        audioFileIds: audioFiles.map(file => file.id),
        imageFileId: imageFile.id,
        outName: projectName,
        playlist: projectName,
        titles,
        options: { width: resolution, imageMode, preset, normalizeAudio }
      });
      setOutputPath(result.outputPath);
      setActiveJobId(result.jobId);
      setProgress({ jobId: result.jobId, stage: 'done', percent: 100, label: '완료' });
    } catch (renderError) {
      setProgress(null);
      setError(renderError instanceof Error ? renderError.message : String(renderError));
    }
  }

  async function cancelRender() {
    if (!api || !activeJobId) return;
    await api.cancelMediaJob(activeJobId);
  }

  function exportChapters() {
    downloadText(`${projectName}-chapters.txt`, buildChapters(titles, audioFiles));
  }

  if (!api) {
    return (
      <div className="provider-summary">
        <h3>🎬 음원·영상 제작</h3>
        <p className="supporting">
          이 기능은 브라우저가 아닌 데스크톱 앱에서만 사용할 수 있습니다. 저장소의 <code>desktop</code> 폴더에서 Electron 셸을 실행하면
          WAV·MP3 자동 매칭, 실제 길이 기반 챕터, 1080p 통합 MP4 제작과 작업 취소 기능이 활성화됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="media-pipeline">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Desktop Media Pipeline</p>
          <h2>🎬 음원·영상 제작</h2>
          <p className="supporting">번호가 붙은 WAV·MP3 파일을 선택하면 현재 {blueprint.songs.length}곡 순서에 맞춰 하나의 플레이리스트 영상으로 만듭니다.</p>
        </div>
      </div>

      <div className="signature-grid">
        <div><b>필요 곡 수</b><span>{blueprint.songs.length}곡</span></div>
        <div><b>선택한 음원</b><span>{audioFiles.length}곡</span></div>
        <div><b>예상 재생시간</b><span>{formatDuration(totalDuration)}</span></div>
        <div><b>출력</b><span>{resolution === 1920 ? '1920×1080' : '1280×720'} MP4</span></div>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => void selectAudioFiles()} disabled={isRendering}>
          <FileAudio size={16} /> WAV·MP3 선택
        </button>
        <button type="button" onClick={() => void selectImage()} disabled={isRendering}>
          <ImageIcon size={16} /> 배경 이미지 선택
        </button>
        <button type="button" onClick={exportChapters} disabled={!exactMatch || isRendering}>
          <Download size={16} /> 챕터 TXT
        </button>
      </div>

      {audioFiles.length > 0 && !exactMatch && (
        <p className="warning">⚠️ 생성 팩은 {blueprint.songs.length}곡인데 음원은 {audioFiles.length}곡입니다. 잘못된 곡 순서를 막기 위해 정확히 같은 개수일 때만 렌더링합니다.</p>
      )}

      {imagePreview && (
        <div style={{ margin: '16px 0' }}>
          <img src={imagePreview} alt="선택한 배경 미리보기" style={{ width: '100%', maxHeight: 280, objectFit: imageMode === 'cover' ? 'cover' : 'contain', background: '#111', borderRadius: 12 }} />
          <p className="supporting">{imageFile?.name}</p>
        </div>
      )}

      <div className="provider-summary">
        <div className="chips">
          <button type="button" className={resolution === 1920 ? 'chip active' : 'chip'} onClick={() => setResolution(1920)} disabled={isRendering}>1080p</button>
          <button type="button" className={resolution === 1280 ? 'chip active' : 'chip'} onClick={() => setResolution(1280)} disabled={isRendering}>720p</button>
          <button type="button" className={imageMode === 'cover' ? 'chip active' : 'chip'} onClick={() => setImageMode('cover')} disabled={isRendering}>화면 채우기</button>
          <button type="button" className={imageMode === 'contain' ? 'chip active' : 'chip'} onClick={() => setImageMode('contain')} disabled={isRendering}>전체 이미지</button>
          <button type="button" className={preset === 'ultrafast' ? 'chip active' : 'chip'} onClick={() => setPreset('ultrafast')} disabled={isRendering}>빠름</button>
          <button type="button" className={preset === 'veryfast' ? 'chip active' : 'chip'} onClick={() => setPreset('veryfast')} disabled={isRendering}>균형</button>
          <button type="button" className={preset === 'medium' ? 'chip active' : 'chip'} onClick={() => setPreset('medium')} disabled={isRendering}>고화질</button>
          <button type="button" className={normalizeAudio ? 'chip active' : 'chip'} onClick={() => setNormalizeAudio(value => !value)} disabled={isRendering}>음량 균일화 {normalizeAudio ? 'ON' : 'OFF'}</button>
        </div>
      </div>

      {audioFiles.length > 0 && (
        <div className="table-scroll" style={{ maxHeight: 320 }}>
          <table className="video-table">
            <thead><tr><th>#</th><th>생성 제목</th><th>연결 음원</th><th>길이</th></tr></thead>
            <tbody>
              {Array.from({ length: Math.max(blueprint.songs.length, audioFiles.length) }, (_, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{titles[index] || '—'}</td>
                  <td>{audioFiles[index]?.name || '—'}</td>
                  <td>{audioFiles[index] ? formatDuration(audioFiles[index].durationSec) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {progress && (
        <div className="provider-summary">
          <p className="supporting">{progress.label} · {progress.percent}%</p>
          <progress value={progress.percent} max={100} style={{ width: '100%' }} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {outputPath && <p className="supporting">완성 파일: {outputPath}</p>}

      <div className="button-row">
        <button type="button" className="primary" onClick={() => void renderPlaylist()} disabled={!exactMatch || !imageFile || isRendering}>
          <Video size={16} /> 통합 MP4 만들기
        </button>
        {isRendering && (
          <button type="button" onClick={() => void cancelRender()}>
            <Square size={15} /> 실제 작업 취소
          </button>
        )}
        <button type="button" onClick={() => void api.openOutputDir(projectName)} disabled={isRendering}>
          <FolderOpen size={16} /> 출력 폴더
        </button>
      </div>
    </div>
  );
}
