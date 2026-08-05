import { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronDown, Upload } from 'lucide-react';
import type { AudienceProfile, SongIdea } from '../types';
import type { FullAudioAnalysis } from '../core/audioAnalysis';
import { analyzeFullAudioFileResponsive } from '../core/audioAnalysisClient';
import { matchAudioFileName } from '../core/audioTrackMatch';
import {
  archiveExists,
  buildArchiveEntry,
  buildArchiveTrackEntry,
  buildArchiveTrend,
  deleteArchive,
  listArchives,
  saveArchive,
  type AudioArchiveEntry
} from '../core/audioArchive';
import {
  archiveTrackCsvFileName,
  buildArchiveTrackCsv,
  buildChannelArchiveSummaryCsv,
  channelArchiveSummaryCsvFileName,
  downloadCsv
} from '../core/csvExport';

/**
 * TASK v4.15 (TASK B) — "음원 분석 아카이브" 패널 (§2-5/§2-6). Self-contained,
 * same "own drag-drop, own analysis pass" shape as AudioEditPanel.tsx/
 * ShortsHighlightPanel.tsx rather than reaching into AudioAnalysisPanel's
 * internal state — matches the spec's own §2-5 mockup, which shows the
 * archive screen with its own independent file-drop, not a checkbox bolted
 * onto the existing analysis screen's internals.
 *
 * §5 do-not-list this is built against: never lets the app invent the
 * archive name (archiveLabel is stored exactly as typed), never blocks a
 * save when the name fails to parse into channelSlug/sequence, never stores
 * the audio files themselves (only AudioArchiveTrackEntry measurements).
 */
export interface AudioArchivePanelProps {
  songs: SongIdea[];
  audienceProfile: AudienceProfile;
  packId?: string;
  setName?: string;
}

interface PendingFile {
  file: File;
  full?: FullAudioAnalysis;
  trackNo?: number;
}

function formatMinSec(totalSec: number): string {
  const clamped = Number.isFinite(totalSec) && totalSec > 0 ? totalSec : 0;
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.round(clamped % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function AudioArchivePanel({ songs, audienceProfile, packId, setName }: AudioArchivePanelProps) {
  const [view, setView] = useState<'save' | 'list'>('save');

  // --- Save view state ---
  const [archiveLabel, setArchiveLabel] = useState('');
  const [saveEnabled, setSaveEnabled] = useState(true);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // --- List view state ---
  const [archives, setArchives] = useState<AudioArchiveEntry[]>([]);
  const [channelFilter, setChannelFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  function loadArchives() {
    void listArchives().then(setArchives).catch(() => setArchives([]));
  }
  useEffect(() => {
    if (view === 'list') loadArchives();
  }, [view]);

  const candidates = useMemo(() => songs.map(s => ({ trackNo: s.trackNo, title: s.title })), [songs]);

  async function addFiles(newFiles: File[]) {
    const audioFiles = newFiles.filter(f => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f.name));
    if (!audioFiles.length) return;
    const existingNames = new Set(pending.map(p => p.file.name));
    const toAdd = audioFiles.filter(f => !existingNames.has(f.name));
    if (!toAdd.length) return;

    setSaveError('');
    setAnalyzing(true);
    const nextPending: PendingFile[] = [...pending];
    for (const file of toAdd) {
      try {
        const full = await analyzeFullAudioFileResponsive(file);
        const match = matchAudioFileName(file.name, candidates);
        nextPending.push({ file, full, trackNo: match.trackNo });
      } catch {
        setSaveError(prev => (prev ? `${prev}\n"${file.name}" 분석 실패` : `"${file.name}" 분석 실패 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.`));
        nextPending.push({ file });
      }
      setPending([...nextPending]);
    }
    setAnalyzing(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    void addFiles(picked);
  }

  const analyzedCount = useMemo(() => pending.filter(p => p.full).length, [pending]);

  async function doSave(label: string) {
    const tracks = pending
      .filter((p): p is PendingFile & { full: FullAudioAnalysis } => !!p.full)
      .map(p => buildArchiveTrackEntry(p.full, { trackNo: p.trackNo }));
    const entry = buildArchiveEntry({
      archiveLabel: label,
      packId,
      setName,
      tracks,
      targetRangeSec: audienceProfile.songLengthSecondsRange
    });
    await saveArchive(entry);
    setSaved(label);
    setConfirmOverwrite(false);
  }

  async function handleSaveClick() {
    setSaveError('');
    const label = archiveLabel.trim() || setName || '';
    if (!label) {
      setSaveError('이름을 입력하거나 세트명을 사용할 수 있어야 합니다.');
      return;
    }
    if (!pending.some(p => p.full)) {
      setSaveError('분석된 파일이 없습니다 — 먼저 mp3/wav 파일을 올려주세요.');
      return;
    }
    const exists = await archiveExists(label);
    if (exists && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    await doSave(label);
  }

  const filteredArchives = useMemo(
    () => (channelFilter ? archives.filter(a => (a.channelSlug ?? '') === channelFilter) : archives),
    [archives, channelFilter]
  );
  const channelOptions = useMemo(() => [...new Set(archives.map(a => a.channelSlug).filter((s): s is string => !!s))], [archives]);
  const trend = useMemo(() => buildArchiveTrend(filteredArchives), [filteredArchives]);

  async function handleDelete(label: string) {
    await deleteArchive(label);
    loadArchives();
  }

  function handleArchiveCsv(entry: AudioArchiveEntry) {
    downloadCsv(archiveTrackCsvFileName(entry.archiveLabel), buildArchiveTrackCsv(entry));
  }

  function handleChannelCsv(channelSlug: string) {
    const inChannel = archives.filter(a => (a.channelSlug ?? '') === channelSlug);
    downloadCsv(channelArchiveSummaryCsvFileName(channelSlug), buildChannelArchiveSummaryCsv(inChannel));
  }

  return (
    <div className="option-block audio-archive-panel">
      <div className="section-head">
        <h3><Archive size={16} style={{ verticalAlign: '-2px', marginRight: 4 }} />음원 분석 아카이브</h3>
        <div className="button-row">
          <button type="button" className={view === 'save' ? 'chip active' : 'chip'} onClick={() => setView('save')}>저장</button>
          <button type="button" className={view === 'list' ? 'chip active' : 'chip'} onClick={() => setView('list')}>목록</button>
        </div>
      </div>

      {view === 'save' && (
        <>
          <p className="callout">ⓘ 채널·회차별로 측정값만 저장합니다(음원 파일 자체는 저장하지 않습니다). 나중에 찾기 쉽게 이름을 붙여주세요, 예: oldpoplounge2st</p>

          <label>아카이브 이름</label>
          <input type="text" value={archiveLabel} onChange={event => { setArchiveLabel(event.target.value); setConfirmOverwrite(false); }} placeholder={setName || 'oldpoplounge2st'} />

          <div
            className={dragOver ? 'audio-drop-zone drag-over' : 'audio-drop-zone'}
            onDragOver={event => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={20} />
            <p>분석할 mp3/wav 파일을 여기로 드래그하거나</p>
            <label className="chip">
              파일 선택
              <input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg" multiple onChange={handleFileInput} style={{ display: 'none' }} />
            </label>
          </div>

          {analyzing && <p className="supporting">분석 중... {analyzedCount}/{pending.length}곡</p>}
          {!analyzing && analyzedCount > 0 && <p className="supporting">분석 완료 {analyzedCount}곡</p>}
          {saveError && <p className="error" style={{ whiteSpace: 'pre-line' }}>{saveError}</p>}

          <label className="inline">
            <input type="checkbox" checked={saveEnabled} onChange={event => setSaveEnabled(event.target.checked)} />
            {' '}☑ 분석 결과 저장
          </label>

          {confirmOverwrite && (
            <div className="error">
              <p>"{archiveLabel.trim() || setName}" 이름이 이미 있습니다. 덮어쓸까요?</p>
              <div className="button-row">
                <button type="button" className="chip active" onClick={() => void doSave(archiveLabel.trim() || setName || '')}>덮어쓰기</button>
                <button type="button" className="chip" onClick={() => setConfirmOverwrite(false)}>취소</button>
              </div>
            </div>
          )}

          <div className="button-row">
            <button type="button" className="chip active" disabled={!saveEnabled || analyzing} onClick={() => void handleSaveClick()}>
              저장
            </button>
          </div>

          {saved && <p className="supporting">"{saved}" 저장 완료.</p>}
        </>
      )}

      {view === 'list' && (
        <>
          <label>채널 필터</label>
          <select value={channelFilter} onChange={event => setChannelFilter(event.target.value)}>
            <option value="">전체</option>
            {channelOptions.map(slug => (
              <option key={slug} value={slug}>{slug}</option>
            ))}
          </select>

          {filteredArchives.length === 0 && <p className="supporting">저장된 아카이브가 없습니다.</p>}

          {filteredArchives.map(a => (
            <div key={a.archiveLabel} className="option-block compact">
              <div className="section-head">
                <b>{a.archiveLabel}</b>
                <span className="supporting">{a.analyzedAt.slice(0, 10)}</span>
              </div>
              <p className="supporting">
                {a.trackCount}곡 · 평균 {formatMinSec(a.summary.avgDuration)} · 범위 {formatMinSec(a.summary.durationRange[0])}~{formatMinSec(a.summary.durationRange[1])}
                {' '}· 진폭 {a.summary.avgDynamicRange.toFixed(1)}dB · 목표범위내 {a.summary.inTargetRange}곡 · 후반상승 {a.summary.lateRiseCount}곡
              </p>
              <div className="button-row">
                <button type="button" className="chip" onClick={() => setExpanded(prev => (prev === a.archiveLabel ? null : a.archiveLabel))}>
                  상세 <ChevronDown size={13} style={{ verticalAlign: '-2px' }} />
                </button>
                <button type="button" className="chip" onClick={() => handleArchiveCsv(a)}>CSV</button>
                <button type="button" className="chip error" onClick={() => void handleDelete(a.archiveLabel)}>삭제</button>
              </div>
              {expanded === a.archiveLabel && (
                <div className="option-block compact">
                  {a.tracks.map((t, idx) => (
                    <p key={idx} className="supporting">
                      {t.trackNo ? `T${t.trackNo}` : '-'} {t.fileName} · {formatMinSec(t.durationSec)} · 진폭 {t.dynamicRange.toFixed(1)}dB · 믹스중심 {Math.round(t.spectralCentroid)}Hz
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}

          {channelFilter && (
            <div className="button-row">
              <button type="button" className="chip" onClick={() => handleChannelCsv(channelFilter)}>채널 전체 누적 CSV</button>
            </div>
          )}

          {trend.length >= 2 && (
            <div className="option-block compact">
              <h4>── 추이 ────</h4>
              <p className="supporting">평균 길이 {trend.map(p => formatMinSec(p.avgDuration)).join(' → ')}</p>
              <p className="supporting">평균 진폭 {trend.map(p => `${p.avgDynamicRange.toFixed(1)}dB`).join(' → ')}</p>
              <p className="supporting">목표범위내 곡수 {trend.map(p => p.inTargetRange).join(' → ')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
