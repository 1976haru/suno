import { useEffect, useState } from 'react';
import { Archive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SongIdea, WorkspaceId } from '../types';
import { getTakes, type AudioTake } from '../core/audioTakes';
import { evaluatePackAudioReadiness, type PackAudioReadiness } from '../core/packAudioReadiness';
import { buildProductionBundleManifest, buildProductionBundleFiles, type ProductionBundleTrackInput } from '../core/productionBundle';
import { buildExportMeta } from '../core/exportMeta';
import { buildZip, safeFileName } from '../utils/zipExporter';
import { downloadBlob } from '../utils/exporters';

interface ProductionBundlePanelProps {
  songs: SongIdea[];
  packId: string;
  workspaceId: WorkspaceId;
  setName: string;
}

/**
 * 지시문 11 (TASK F-5) — "프로덕션 번들 ZIP UI 진입점". core/productionBundle.ts는
 * 이미 실제로 완성돼 있었지만(매니페스트/CSV/ffmpeg manifest/zip 파일 목록 조립
 * 전부 테스트로 검증됨) 그걸 실제로 호출하는 화면이 어디에도 없었다 — 이 패널이
 * 그 진입점이다.
 *
 * "빠진 파일을 미리보기로 보여주고, 조용히 빼지 않는다"는 이 지시문의 명시적
 * 요구를 그대로 따른다: PackAudioReadiness(F-6)로 트랙별 실제 상태를 먼저 계산해
 * 화면에 그대로 나열하고, 오디오가 없는 트랙도 번들에서 조용히 빠지는 게 아니라
 * "오디오 없음"으로 표시된 채 나머지 아티팩트(가사/SRT/메타데이터)는 포함된다
 * (core/productionBundle.ts 자신의 문서화된 설계 — audioBlob은 optional).
 *
 * 실제 오디오 bytes는 이 컴포넌트가 갖고 있지 않다 — AudioAnalysisPanel의
 * filesByName은 그 컴포넌트 내부 상태로, 부모(Step4Result)로도 이 패널로도
 * 전달되지 않는다(브라우저 File 객체를 여러 화면에 걸쳐 들고 있게 만드는 건
 * 이 세션 범위를 넘는 리팩터링). 그래서 이 번들은 항상 audio/ 없이 나머지
 * 전부를 담고, tracksWithoutAudio를 그대로 정직하게 화면에 보여준다.
 */
export default function ProductionBundlePanel({ songs, packId, workspaceId, setName }: ProductionBundlePanelProps) {
  const [takes, setTakes] = useState<AudioTake[]>([]);
  // 지시문 11 (TASK J) — 이펙트 본문에서 동기적으로 setState를 호출하지 않도록
  // "이 packId까지 로드 완료"만 기록하고, loaded 자체는 아래에서 파생시킨다
  // (react-hooks/set-state-in-effect 실제 lint 오류를 고치며 발견한 패턴).
  const [loadedForPackId, setLoadedForPackId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getTakes({ packId }).then(result => {
      if (!cancelled) { setTakes(result); setLoadedForPackId(packId); }
    }).catch(() => { if (!cancelled) setLoadedForPackId(packId); });
    return () => { cancelled = true; };
  }, [packId]);

  const loaded = loadedForPackId === packId;

  const readiness: PackAudioReadiness = evaluatePackAudioReadiness(songs.map(s => ({ trackNo: s.trackNo })), takes);
  const missingTracks = readiness.trackReadiness.filter(t => !t.hasAdoptedTake);
  const blockedTracks = readiness.trackReadiness.filter(t => t.hasAdoptedTake && !t.ready);

  function handleBuildBundle() {
    setBuilding(true);
    try {
      const trackInputs: ProductionBundleTrackInput[] = [];
      for (const song of songs) {
        const adopted = takes.find(t => t.trackNo === song.trackNo && t.adopted);
        if (adopted) trackInputs.push({ song, selectedTake: adopted });
      }
      const manifest = buildProductionBundleManifest({
        setName,
        workspaceId,
        exportMeta: buildExportMeta(undefined, workspaceId),
        tracks: trackInputs
      });
      const files = buildProductionBundleFiles(manifest, trackInputs);
      const blob = buildZip(files);
      downloadBlob(`${safeFileName(setName)}_production-bundle.zip`, blob);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="option-block">
      <div className="section-head">
        <h4><Archive size={16} style={{ verticalAlign: '-2px', marginRight: 4 }} />프로덕션 번들</h4>
      </div>

      {!loaded && <p className="supporting">테이크 정보를 불러오는 중...</p>}

      {loaded && (
        <>
          <p className="supporting">
            {readiness.totalTracks}곡 중 준비 완료 {readiness.readyTrackCount}곡
            {missingTracks.length > 0 && ` · 채택 안 됨 ${missingTracks.length}곡`}
            {blockedTracks.length > 0 && ` · 문제 있음 ${blockedTracks.length}곡`}
          </p>

          {missingTracks.length > 0 && (
            <p className="supporting">
              채택된 테이크 없음: T{missingTracks.map(t => t.trackNo).join(', T')}
            </p>
          )}
          {blockedTracks.length > 0 && (
            <div className="error">
              <b><AlertTriangle size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />문제 있는 트랙 {blockedTracks.length}개</b>
              {blockedTracks.map(t => (
                <p key={t.trackNo} className="supporting">
                  T{t.trackNo}: {!t.hasMeasurements ? '측정값 없음' : t.selectionIssues.map(i => i.labelKo).join(', ') || `컴플라이언스 ${t.complianceStatus}`}
                </p>
              ))}
            </div>
          )}

          {readiness.overallReady && (
            <p className="provider-summary design-gate-panel passed">
              <CheckCircle2 size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />전체 트랙이 채택·측정 완료됐습니다.
            </p>
          )}

          <p className="supporting">
            ⓘ 실제 오디오 파일(mp3)은 이 브라우저 세션에 남아있는 원본을 이 앱이 다시 들고 있지 않아 번들에는 포함되지 않습니다 —
            가사·SRT·메타데이터·타임라인·매니페스트만 담깁니다. 오디오는 위 "음원 분석" 화면에서 채택한 파일을 별도로 audio/ 폴더에 넣어 합치세요.
          </p>

          <div className="button-row">
            <button type="button" className="chip" disabled={building || readiness.readyTrackCount + readiness.blockedTrackCount === 0} onClick={handleBuildBundle}>
              {building ? '만드는 중...' : '번들 ZIP 다운로드'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
