import { useEffect, useMemo, useState } from 'react';
import { Music, Upload } from 'lucide-react';
import type { AudienceProfile, SongIdea } from '../types';
import { analyzeFullAudioFile, type FullAudioAnalysis } from '../core/audioAnalysis';
import { groupMatchesByTrackNo, labelTakesInGroup, matchAudioFileName, type AudioMatchResult } from '../core/audioTrackMatch';
import { buildAudioSetReport, buildVocalDiversityReport, type VocalDiversityEntry } from '../core/audioSetReport';
import { attributesFromSong, getRatingForSong, recordRating, type SongRating } from '../core/ratingLedger';
import { buildTakeDirectives, getTakes, recordTake, setAdopted, type AudioTake } from '../core/audioTakes';
import { buildDirectiveExecutionReport } from '../core/audioDirectiveAnalysis';
import { analyzeAdoption, isNeutralWinRate } from '../core/audioAdoption';

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

function takeIdFor(packId: string, fileName: string): string {
  return `${packId}::${fileName}`;
}

function RmsBarRow({ metrics }: { metrics: FullAudioAnalysis['metrics'] }) {
  const avg = metrics.rmsCurve.reduce((a, b) => a + b, 0) / metrics.rmsCurve.length;
  const minRms = Math.min(...metrics.rmsCurve);
  const maxRms = Math.max(...metrics.rmsCurve);
  const range = Math.max(1, maxRms - minRms);
  return (
    <div className="audio-rms-bar-row" title={`상대 RMS (LUFS 아님) · 진폭 ${metrics.dynamicRange.toFixed(1)}dB`}>
      {metrics.rmsCurve.map((value, idx) => (
        <span key={idx} className={value >= avg ? 'audio-rms-bar loud' : 'audio-rms-bar'} style={{ height: `${8 + ((value - minRms) / range) * 24}px` }} />
      ))}
    </div>
  );
}

/**
 * TASK v3.73/v3.74 — the UI entry point for browser-in mp3 analysis. Still
 * processes one file at a time (sequential `for...of` + `await`, never
 * Promise.all — TASK A's own "한 곡씩 처리하고 즉시 해제하십시오").
 *
 * TASK v3.74 additions: records every analyzed+matched file as a persisted
 * AudioTake (core/audioTakes.ts, not just ephemeral component state), a
 * real A/B take-comparison view, a 200-3500Hz vocal-band diversity section,
 * and a channel-wide "무엇이 통하나" learning-results section
 * (core/audioAdoption.ts + core/audioDirectiveAnalysis.ts).
 */
export default function AudioAnalysisPanel({ songs, packId, channelId, audienceProfile }: AudioAnalysisPanelProps) {
  const [analysesByFileName, setAnalysesByFileName] = useState<Map<string, FullAudioAnalysis>>(new Map());
  const [matches, setMatches] = useState<AudioMatchResult[]>([]);
  const [adoptedFileNameByTrack, setAdoptedFileNameByTrack] = useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [ratings, setRatings] = useState<Record<string, SongRating>>({});
  const [dragOver, setDragOver] = useState(false);
  const [channelTakes, setChannelTakes] = useState<AudioTake[]>([]);
  const [learningEnabled, setLearningEnabled] = useState(true);

  const candidates = useMemo(() => songs.map(s => ({ trackNo: s.trackNo, title: s.title })), [songs]);

  function loadChannelTakes() {
    void getTakes({ channelId }).then(setChannelTakes).catch(() => setChannelTakes([]));
  }
  useEffect(loadChannelTakes, [channelId]);

  async function analyzeFiles(files: File[]) {
    const audioFiles = files.filter(f => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f.name));
    if (!audioFiles.length) {
      setError('오디오 파일(mp3/wav/m4a/flac/ogg)이 없습니다.');
      return;
    }
    setError('');
    setAnalyzing(true);
    setProgress({ done: 0, total: audioFiles.length });

    const nextAnalyses = new Map(analysesByFileName);
    const nextMatches: AudioMatchResult[] = [...matches];

    // Sequential — never Promise.all across the whole batch. Each
    // analyzeFullAudioFile() call's decoded buffers go out of scope as soon
    // as this iteration ends, so only one file's PCM is ever live at a time.
    for (const file of audioFiles) {
      try {
        const full = await analyzeFullAudioFile(file);
        const match = matchAudioFileName(file.name, candidates);
        full.metrics.matchedTrackNo = match.trackNo;
        const song = match.trackNo !== undefined ? songs.find(s => s.trackNo === match.trackNo) : undefined;
        full.metrics.matchedSongId = song?.songId;
        nextAnalyses.set(file.name, full);
        nextMatches.push(match);

        if (song?.songId) {
          const take: AudioTake = {
            takeId: takeIdFor(packId, file.name),
            songId: song.songId,
            trackNo: song.trackNo,
            packId,
            channelId,
            fileName: file.name,
            versionLabel: 'A', // recomputed below once the whole group for this trackNo is known
            adopted: false,
            metrics: full.metrics,
            vocalMetrics: full.vocalMetrics,
            tempoEstimate: full.tempoEstimate,
            directives: buildTakeDirectives(song, audienceProfile),
            analyzedAt: new Date().toISOString()
          };
          await recordTake(take);
        }
      } catch {
        setError(prev => (prev ? `${prev}\n"${file.name}" 분석 실패 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.` : `"${file.name}" 분석 실패 — 지원하지 않는 형식이거나 손상된 파일일 수 있습니다.`));
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setAnalysesByFileName(nextAnalyses);
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
    loadChannelTakes();
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

  async function adoptTake(trackNo: number, fileName: string) {
    setAdoptedFileNameByTrack(prev => ({ ...prev, [trackNo]: fileName }));
    try {
      await setAdopted(takeIdFor(packId, fileName));
    } catch {
      // best-effort — the local "which take is shown" state above still updates either way.
    }
    loadChannelTakes();
  }

  const matchGroups = useMemo(() => groupMatchesByTrackNo(matches), [matches]);
  const labeledGroups = useMemo(() => {
    const labeled = new Map<number, ReturnType<typeof labelTakesInGroup>>();
    for (const [trackNo, group] of matchGroups) labeled.set(trackNo, labelTakesInGroup(group));
    return labeled;
  }, [matchGroups]);

  const adoptedMetrics = useMemo(() => {
    const list: FullAudioAnalysis['metrics'][] = [];
    for (const [trackNo, fileName] of Object.entries(adoptedFileNameByTrack)) {
      const full = analysesByFileName.get(fileName);
      if (full) list.push({ ...full.metrics, matchedTrackNo: Number(trackNo) });
    }
    return list.sort((a, b) => (a.matchedTrackNo ?? 0) - (b.matchedTrackNo ?? 0));
  }, [adoptedFileNameByTrack, analysesByFileName]);

  // v3.75 (TASK B) — a track with no designed killing point has no
  // amplitude/late-peak expectation at all (this task's own spec: "킬링포인트가
  // 없는 곡: 진폭 제한 없음, 평평해도 됩니다") — see buildAudioSetReport's own doc
  // comment for why judging every track against the same bar both mis-flags
  // legitimately-flat non-peak tracks and dilutes the peak-share stat.
  const killingPointTrackNos = useMemo(
    () => new Set(songs.filter(song => song.killingPointId).map(song => song.trackNo)),
    [songs]
  );
  const report = useMemo(
    () => buildAudioSetReport(adoptedMetrics, songs.length, audienceProfile, killingPointTrackNos),
    [adoptedMetrics, songs.length, audienceProfile, killingPointTrackNos]
  );

  const vocalReport = useMemo(() => {
    const entries: VocalDiversityEntry[] = [];
    for (const [trackNo, fileName] of Object.entries(adoptedFileNameByTrack)) {
      const full = analysesByFileName.get(fileName);
      const song = songs.find(s => s.trackNo === Number(trackNo));
      if (full) entries.push({ trackNo: Number(trackNo), vocalType: song?.vocalType ?? 'unknown', vocalCentroid: full.vocalMetrics.vocalCentroid, vocalProfile: full.vocalMetrics.vocalProfile });
    }
    return buildVocalDiversityReport(entries.sort((a, b) => a.trackNo - b.trackNo));
  }, [adoptedFileNameByTrack, analysesByFileName, songs]);

  const adoptionInsights = useMemo(() => analyzeAdoption(channelTakes), [channelTakes]);
  const executionEntries = useMemo(() => buildDirectiveExecutionReport(channelTakes), [channelTakes]);

  const unmatchedFiles = matches.filter(m => m.trackNo === undefined);

  async function rateTrack(metrics: FullAudioAnalysis['metrics'], rating: SongRating) {
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
        <p>수노에서 받은 mp3 파일(A/B 2버전 포함)을 여기로 드래그하거나</p>
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
            <p className="supporting">※ 킬링포인트가 직접 검증된 것은 아니며, "후반 상승" 여부를 대리 지표로 봅니다.</p>
          </div>

          <div className="option-block compact">
            <h4>전체 음색 다양성</h4>
            <p className="supporting">중심 주파수 폭 {Math.round(report.timbre.centroidSpread)}Hz · 세트 평균 유사도 {report.timbre.meanSimilarity.toFixed(2)}</p>
          </div>

          <div className="option-block compact">
            <h4>보컬 음색 분포</h4>
            <p className="supporting">ⓘ 반주가 일부 섞인 200-3500Hz 대역 분석입니다. 곡 간 상대 비교용입니다.</p>
            {vocalReport.sameTypeSpread.map(({ vocalType, spread, count }) => (
              <p key={vocalType} className="supporting">{vocalType} {count}곡 · 중심 폭 {Math.round(spread)}Hz{spread < 200 ? ' ⚠ 좁음' : ''}</p>
            ))}
            {vocalReport.advisories.map(text => <p key={text} className="supporting">⚠ {text}</p>)}
          </div>

          <div className="option-block compact">
            <h4>음량</h4>
            <p className="supporting">편차 {report.level.spread.toFixed(1)}dB {report.level.spread <= 3 ? '— 균일함 ✅' : '— 편차 있음 ⚠'}</p>
          </div>

          <div className="option-block">
            <h4>테이크 비교 / 곡별 상세</h4>
            {adoptedMetrics.map(metrics => {
              const trackNo = metrics.matchedTrackNo!;
              const song = songs.find(s => s.trackNo === trackNo);
              const takes = labeledGroups.get(trackNo) ?? [];
              const full = analysesByFileName.get(adoptedFileNameByTrack[trackNo]);
              return (
                <div key={trackNo} className="option-block compact audio-track-detail">
                  <div className="section-head">
                    <b>T{trackNo} {song?.title ?? metrics.fileName}</b>
                  </div>

                  {takes.length > 1 ? (
                    <div className="audio-take-compare">
                      {takes.map(take => {
                        const takeFull = analysesByFileName.get(take.fileName);
                        if (!takeFull) return null;
                        const isAdopted = adoptedFileNameByTrack[trackNo] === take.fileName;
                        return (
                          <div key={take.fileName} className={isAdopted ? 'audio-take-card adopted' : 'audio-take-card'}>
                            <div className="section-head">
                              <b>{take.versionLabel}버전{isAdopted ? ' ●채택' : ''}</b>
                              <span className="supporting">{formatMinSec(takeFull.metrics.durationSec)}</span>
                            </div>
                            <RmsBarRow metrics={takeFull.metrics} />
                            <p className="supporting">
                              진폭 {takeFull.metrics.dynamicRange.toFixed(1)}dB · 보컬중심 {Math.round(takeFull.vocalMetrics.vocalCentroid)}Hz ·
                              템포 {takeFull.tempoEstimate.confidence >= 0.4 ? `${Math.round(takeFull.tempoEstimate.bpm)} BPM` : '신뢰도 낮음'}
                            </p>
                            <button type="button" className={isAdopted ? 'chip active' : 'chip'} onClick={() => void adoptTake(trackNo, take.fileName)}>
                              {take.versionLabel} 채택
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    full && (
                      <>
                        <RmsBarRow metrics={full.metrics} />
                        <p className="supporting">
                          최대 구간 {Math.round(metrics.peakPosition * (metrics.rmsCurve.length - 1)) + 1}/{metrics.rmsCurve.length} · 진폭 {metrics.dynamicRange.toFixed(1)}dB ·
                          중심 {Math.round(metrics.spectralCentroid)}Hz · 보컬중심 {Math.round(full.vocalMetrics.vocalCentroid)}Hz ·
                          템포 {full.tempoEstimate.confidence >= 0.4 ? `${Math.round(full.tempoEstimate.bpm)} BPM` : '신뢰도 낮음'}
                        </p>
                      </>
                    )
                  )}

                  {song?.songId && (
                    <div className="button-row">
                      <button type="button" className={ratings[song.songId] === 'good' ? 'chip active' : 'chip'} onClick={() => void rateTrack(metrics, 'good')}>👍 좋음</button>
                      <button type="button" className={ratings[song.songId] === 'ok' ? 'chip active' : 'chip'} onClick={() => void rateTrack(metrics, 'ok')}>🤷 보통</button>
                      <button type="button" className={ratings[song.songId] === 'bad' ? 'chip active' : 'chip'} onClick={() => void rateTrack(metrics, 'bad')}>👎 별로</button>
                      {ratings[song.songId] && <span className="supporting">{RATING_LABELS_KO[ratings[song.songId]]}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="option-block">
        <div className="section-head">
          <h4>무엇이 통하나 — 채택 경향 (누적 짝비교)</h4>
          <button type="button" className={learningEnabled ? 'chip active' : 'chip'} onClick={() => setLearningEnabled(v => !v)}>
            {learningEnabled ? '반영 끄기' : '반영 켜기'}
          </button>
        </div>
        {learningEnabled && (
          <>
            <p className="supporting">⓵ 채택/미채택 짝: 트랙마다 채택 1개 + 미채택 1개 이상 있을 때만 집계됩니다. 짝 10개 미만은 참고하지 않습니다.</p>
            {adoptionInsights.filter(i => i.totalPairs > 0).map(insight => (
              <p key={insight.metric} className="supporting">
                {insight.labelKo}: 채택 쪽이 큼 {insight.adoptedHigherCount}/{insight.totalPairs} · 승률 {Math.round(insight.winRate * 100)}%
                {isNeutralWinRate(insight.winRate) ? ' (중립)' : ''} · {insight.confidence}
              </p>
            ))}
            {adoptionInsights.every(i => i.totalPairs === 0) && <p className="supporting">아직 채택/미채택 짝이 없습니다 — 트랙마다 여러 테이크를 올리고 하나를 채택해보세요.</p>}

            <h4 style={{ marginTop: 12 }}>지시 실행률</h4>
            <p className="supporting">※ 정확한 반음 전조, 특정 악기 식별, 화성 진행, 가사 내용은 측정하지 않습니다 (대리 지표만 사용).</p>
            {executionEntries.map(entry => (
              <p key={entry.directiveKey} className="supporting">
                {entry.labelKo}: {entry.executedCount}/{entry.totalCount} ({Math.round(entry.executionRate * 100)}%) · {entry.confidence}
              </p>
            ))}
            {!executionEntries.length && <p className="supporting">아직 측정된 지시 실행률이 없습니다.</p>}
          </>
        )}
      </div>
    </div>
  );
}
