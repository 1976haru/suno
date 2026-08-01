import { useEffect, useMemo, useState } from 'react';
import { Music, Upload } from 'lucide-react';
import type { AudienceProfile, SongIdea } from '../types';
import { analyzeAudioFile, type SongAudioMetrics } from '../core/audioAnalysis';
import { groupMatchesByTrackNo, matchAudioFileName, type AudioMatchResult } from '../core/audioTrackMatch';
import { buildAudioSetReport } from '../core/audioSetReport';
import { attributesFromSong, getRatingForSong, recordRating, type SongRating } from '../core/ratingLedger';

interface AudioAnalysisPanelProps {
  songs: SongIdea[];
  packId: string;
  channelId: string;
  audienceProfile: AudienceProfile;
}

const RATING_LABELS_KO: Record<SongRating, string> = { good: '좋음', ok: '보통', bad: '별로' };

function formatMinSec(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.round(totalSec % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * TASK v3.73 (TASK D) — the UI entry point for browser-in mp3 analysis.
 * Deliberately processes one file at a time (sequential `for...of` +
 * `await`, never Promise.all) — TASK A's own "한 곡씩 처리하고 즉시
 * 해제하십시오" (18 songs x ~5MB decoded to PCM would stall the tab if held
 * simultaneously).
 */
export default function AudioAnalysisPanel({ songs, packId, channelId, audienceProfile }: AudioAnalysisPanelProps) {
  const [metricsByFileName, setMetricsByFileName] = useState<Map<string, SongAudioMetrics>>(new Map());
  const [matches, setMatches] = useState<AudioMatchResult[]>([]);
  const [adoptedFileNameByTrack, setAdoptedFileNameByTrack] = useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [ratings, setRatings] = useState<Record<string, SongRating>>({});
  const [dragOver, setDragOver] = useState(false);

  const candidates = useMemo(() => songs.map(s => ({ trackNo: s.trackNo, title: s.title })), [songs]);

  async function analyzeFiles(files: File[]) {
    const audioFiles = files.filter(f => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f.name));
    if (!audioFiles.length) {
      setError('오디오 파일(mp3/wav/m4a/flac/ogg)이 없습니다.');
      return;
    }
    setError('');
    setAnalyzing(true);
    setProgress({ done: 0, total: audioFiles.length });

    const nextMetrics = new Map(metricsByFileName);
    const nextMatches: AudioMatchResult[] = [...matches];

    // Sequential — never Promise.all across the whole batch. Each
    // analyzeAudioFile() call's decoded buffers go out of scope as soon as
    // this iteration ends, so only one file's PCM is ever live at a time.
    for (const file of audioFiles) {
      try {
        const metrics = await analyzeAudioFile(file);
        const match = matchAudioFileName(file.name, candidates);
        metrics.matchedTrackNo = match.trackNo;
        metrics.matchedSongId = match.trackNo !== undefined ? songs.find(s => s.trackNo === match.trackNo)?.songId : undefined;
        nextMetrics.set(file.name, metrics);
        nextMatches.push(match);
      } catch {
        setError(prev => (prev ? `${prev}\n"${file.name}" 분석 실패 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.` : `"${file.name}" 분석 실패 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.`));
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setMetricsByFileName(nextMetrics);
    setMatches(nextMatches);
    // Default-adopt the first file seen for each trackNo; a user can switch
    // takes below when Suno produced more than one version.
    setAdoptedFileNameByTrack(prev => {
      const next = { ...prev };
      for (const match of nextMatches) {
        if (match.trackNo !== undefined && !(match.trackNo in next)) next[match.trackNo] = match.fileName;
      }
      return next;
    });
    setAnalyzing(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void analyzeFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    void analyzeFiles(files);
  }

  const matchGroups = useMemo(() => groupMatchesByTrackNo(matches), [matches]);
  const adoptedMetrics = useMemo(() => {
    const list: SongAudioMetrics[] = [];
    for (const [trackNo, fileName] of Object.entries(adoptedFileNameByTrack)) {
      const metrics = metricsByFileName.get(fileName);
      if (metrics) list.push({ ...metrics, matchedTrackNo: Number(trackNo) });
    }
    return list.sort((a, b) => (a.matchedTrackNo ?? 0) - (b.matchedTrackNo ?? 0));
  }, [adoptedFileNameByTrack, metricsByFileName]);

  const report = useMemo(
    () => buildAudioSetReport(adoptedMetrics, songs.length, audienceProfile),
    [adoptedMetrics, songs.length, audienceProfile]
  );

  const unmatchedFiles = matches.filter(m => m.trackNo === undefined);

  async function rateTrack(metrics: SongAudioMetrics, rating: SongRating) {
    const song = songs.find(s => s.trackNo === metrics.matchedTrackNo);
    if (!song?.songId) return;
    await recordRating({
      songId: song.songId,
      packId,
      rating,
      ratedAt: new Date().toISOString(),
      attributes: attributesFromSong(song, channelId, {
        durationSec: metrics.durationSec,
        peakPosition: metrics.peakPosition,
        dynamicRange: metrics.dynamicRange,
        spectralCentroid: metrics.spectralCentroid,
        lowBandRatio: metrics.lowBandRatio,
        overallLevel: metrics.overallLevel
      })
    });
    setRatings(prev => ({ ...prev, [song.songId!]: rating }));
  }

  useEffect(() => {
    // Load any existing ratings once per pack, so re-opening this panel shows prior state.
    let cancelled = false;
    void Promise.all(songs.map(s => (s.songId ? getRatingForSong(s.songId) : Promise.resolve(null)))).then(records => {
      if (cancelled) return;
      const next: Record<string, SongRating> = {};
      records.forEach((record, i) => {
        const songId = songs[i]?.songId;
        if (record && songId) next[songId] = record.rating;
      });
      setRatings(next);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  return (
    <div className="option-block audio-analysis-panel">
      <div className="section-head">
        <h3><Music size={16} style={{ verticalAlign: '-2px', marginRight: 4 }} />음원 분석</h3>
        <span className="supporting">{report.analyzedCount}/{report.totalTracks}곡 분석됨</span>
      </div>

      <p className="callout">
        ⓘ 이 분석은 음색·다이내믹·길이를 측정합니다. 멜로디·화성·가사·곡의 좋고 나쁨은 측정하지 않습니다.
        귀로 듣는 판단을 대체하지 않고 보조합니다. 파일은 브라우저 밖으로 나가지 않습니다.
      </p>

      <div
        className={dragOver ? 'audio-drop-zone drag-over' : 'audio-drop-zone'}
        onDragOver={event => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload size={20} />
        <p>수노에서 받은 mp3 파일을 여기로 드래그하거나</p>
        <label className="chip">
          파일 선택
          <input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg" multiple onChange={handleFileInput} style={{ display: 'none' }} />
        </label>
      </div>

      {analyzing && <p className="supporting">분석 중... {progress.done}/{progress.total}곡</p>}
      {error && <p className="error" style={{ whiteSpace: 'pre-line' }}>{error}</p>}

      {unmatchedFiles.length > 0 && (
        <p className="error">매칭 실패: {unmatchedFiles.map(m => m.fileName).join(', ')} — 파일명에서 트랙을 알아내지 못했습니다.</p>
      )}

      {report.analyzedCount > 0 && (
        <>
          <div className="option-block compact">
            <h4>길이</h4>
            <p className="supporting">
              목표 {formatMinSec(report.duration.targetRange[0])}~{formatMinSec(report.duration.targetRange[1])}
              {report.duration.overTarget.length > 0 && ` · 초과 ${report.duration.overTarget.length}곡`}
              {report.duration.underTarget.length > 0 && ` · 미달 ${report.duration.underTarget.length}곡`}
            </p>
            <div className="chips">
              {Object.entries(report.duration.values).map(([trackNo, sec]) => (
                <span key={trackNo} className={report.duration.overTarget.includes(Number(trackNo)) || report.duration.underTarget.includes(Number(trackNo)) ? 'chip error' : 'chip'}>
                  T{trackNo} {formatMinSec(sec)}
                </span>
              ))}
            </div>
          </div>

          <div className="option-block compact">
            <h4>킬링포인트</h4>
            <p className="supporting">
              후반 상승 있음 {report.killingPoint.latePeakTracks.length}곡 (T{report.killingPoint.latePeakTracks.join(', T')})
              {report.killingPoint.noLatePeakTracks.length > 0 && ` · 후반 상승 없음 ${report.killingPoint.noLatePeakTracks.length}곡 (T${report.killingPoint.noLatePeakTracks.join(', T')})`}
            </p>
            {report.killingPoint.weakDynamicTracks.length > 0 && (
              <p className="supporting">진폭 부족(&lt;6dB) {report.killingPoint.weakDynamicTracks.length}곡: T{report.killingPoint.weakDynamicTracks.join(', T')}</p>
            )}
          </div>

          <div className="option-block compact">
            <h4>음색 다양성</h4>
            <p className="supporting">중심 주파수 폭 {Math.round(report.timbre.centroidSpread)}Hz · 세트 평균 유사도 {report.timbre.meanSimilarity.toFixed(2)}</p>
            {report.timbre.clusteredPairs.map(([a, b]) => (
              <p key={`${a}-${b}`} className="supporting">⚠ 비슷한 조합: T{a}↔T{b}</p>
            ))}
          </div>

          <div className="option-block compact">
            <h4>음량</h4>
            <p className="supporting">편차 {report.level.spread.toFixed(1)}dB {report.level.spread <= 3 ? '— 균일함 ✅' : '— 편차 있음 ⚠'}</p>
          </div>

          <div className="option-block">
            <h4>곡별 상세</h4>
            {adoptedMetrics.map(metrics => {
              const trackNo = metrics.matchedTrackNo!;
              const song = songs.find(s => s.trackNo === trackNo);
              const takes = matchGroups.get(trackNo) ?? [];
              const avg = metrics.rmsCurve.reduce((a, b) => a + b, 0) / metrics.rmsCurve.length;
              const minRms = Math.min(...metrics.rmsCurve);
              const maxRms = Math.max(...metrics.rmsCurve);
              const range = Math.max(1, maxRms - minRms);
              return (
                <div key={trackNo} className="option-block compact audio-track-detail">
                  <div className="section-head">
                    <b>T{trackNo} {song?.title ?? metrics.fileName}</b>
                    <span className="supporting">{formatMinSec(metrics.durationSec)}</span>
                  </div>
                  {takes.length > 1 && (
                    <div className="chips">
                      {takes.map(take => (
                        <button
                          key={take.fileName}
                          type="button"
                          className={adoptedFileNameByTrack[trackNo] === take.fileName ? 'chip active' : 'chip'}
                          onClick={() => setAdoptedFileNameByTrack(prev => ({ ...prev, [trackNo]: take.fileName }))}
                        >
                          {take.fileName}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="audio-rms-bar-row" title={`상대 RMS (LUFS 아님) · 진폭 ${metrics.dynamicRange.toFixed(1)}dB`}>
                    {metrics.rmsCurve.map((value, idx) => (
                      <span
                        key={idx}
                        className={value >= avg ? 'audio-rms-bar loud' : 'audio-rms-bar'}
                        style={{ height: `${8 + ((value - minRms) / range) * 24}px` }}
                      />
                    ))}
                  </div>
                  <p className="supporting">
                    최대 구간 {Math.round(metrics.peakPosition * (metrics.rmsCurve.length - 1)) + 1}/{metrics.rmsCurve.length} · 진폭 {metrics.dynamicRange.toFixed(1)}dB ·
                    중심 {Math.round(metrics.spectralCentroid)}Hz · 저역 {Math.round(metrics.lowBandRatio * 100)}% · 고역 {Math.round(metrics.highBandRatio * 100)}%
                  </p>
                  {song?.songId && (
                    <div className="button-row">
                      <button type="button" className={ratings[song.songId] === 'good' ? 'chip active' : 'chip'} onClick={() => void rateTrack(metrics, 'good')}>👍 좋음</button>
                      <button type="button" className={ratings[song.songId] === 'ok' ? 'chip active' : 'chip'} onClick={() => void rateTrack(metrics, 'ok')}>🤷 보통</button>
                      <button type="button" className={ratings[song.songId] === 'bad' ? 'chip active' : 'chip'} onClick={() => void rateTrack(metrics, 'bad')}>👎 별로</button>
                      {song.songId && ratings[song.songId] && <span className="supporting">{RATING_LABELS_KO[ratings[song.songId]]}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
