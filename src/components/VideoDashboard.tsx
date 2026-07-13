import { useEffect, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import {
  channelInsights,
  deleteVideo,
  exportVideosToCsv,
  importYoutubeStudioCsv,
  listVideos,
  updateVideo,
  type VideoInsights,
  type VideoRecord
} from '../core/videoLedger';
import { downloadText } from '../utils/exporters';
import type { ChannelProfile } from '../types';

interface VideoDashboardProps {
  channel: ChannelProfile;
  onClose: () => void;
}

function statusLabel(video: VideoRecord): string {
  return video.publishedAt ? '✅ 발행' : '📝 기획중';
}

export default function VideoDashboard({ channel, onClose }: VideoDashboardProps) {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [insights, setInsights] = useState<VideoInsights | null>(null);
  const [importMessage, setImportMessage] = useState('');

  async function refresh() {
    const list = await listVideos(channel.id);
    setVideos(list);
    setInsights(await channelInsights(channel.id));
  }

  useEffect(() => {
    void refresh();
  }, [channel.id]);

  async function handleFieldChange(id: string, patch: Partial<VideoRecord>) {
    setVideos(prev => prev.map(v => (v.id === id ? { ...v, ...patch } : v)));
    await updateVideo(id, patch);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 영상 기록을 삭제할까요?')) return;
    await deleteVideo(id);
    await refresh();
  }

  async function handleImport(file: File) {
    const text = await file.text();
    const result = await importYoutubeStudioCsv(channel.id, text);
    setImportMessage(`${result.total}개 행 중 ${result.matched}개를 제목으로 매칭해 반영했습니다.`);
    await refresh();
  }

  function handleExport() {
    downloadText(`${channel.name}-video-dashboard.csv`, exportVideosToCsv(videos), 'text/csv;charset=utf-8');
  }

  return (
    <section className="panel video-dashboard">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Video Operations</p>
          <h2>📺 영상 운영 대시보드 — {channel.name}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} title="닫기">
          <X size={18} />
        </button>
      </div>

      <p className="step-hint">
        "곡"이 아니라 "영상" 단위로 관리합니다. 곡 팩을 저장하면 자동으로 한 줄이 추가돼요.
        CTR·조회수·시청 지속시간은 <b>이 앱이 자동으로 가져올 수 없습니다</b> — YouTube Analytics는 채널 소유권을 확인하는 로그인 절차가 필요해서예요.
        YouTube 스튜디오에서 직접 보고 아래 표에 입력하거나, 스튜디오에서 내보낸 CSV를 가져오세요 (주 1회, 2분이면 충분해요).
      </p>

      <div className="button-row">
        <label className="import-button">
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = '';
            }}
          />
          <Upload size={16} />
          CSV 가져오기 (YouTube 스튜디오 내보내기)
        </label>
        <button type="button" onClick={handleExport}>
          <Download size={16} />
          CSV로 내보내기 (엑셀에서 열기)
        </button>
      </div>
      {importMessage && <p className="supporting">{importMessage}</p>}

      {insights && (
        <div className="provider-summary">
          <div className="panel-title">
            <h2>💡 인사이트 (규칙 기반 — API 호출 없음)</h2>
          </div>
          {insights.insufficientData ? (
            <p className="supporting">
              CTR이 입력된 영상이 {insights.sampleSize}개뿐입니다. 최소 3개 이상 쌓이면 인사이트를 계산합니다 (표본이 적을 때 성급한 결론을 내지 않기 위해서예요).
            </p>
          ) : (
            <>
              {Object.keys(insights.variantAverageCtr).length > 0 && (
                <p className="supporting">
                  안별 평균 CTR:{' '}
                  {(['A', 'B', 'C'] as const)
                    .filter(id => insights.variantAverageCtr[id] != null)
                    .map(id => `${id}안 ${insights.variantAverageCtr[id]!.toFixed(1)}%`)
                    .join(' · ')}
                  {insights.bestVariant && ` — ${insights.bestVariant}안이 가장 높습니다.`}
                </p>
              )}
              {insights.topKeywords.length > 0 && (
                <p className="supporting">CTR 상위 영상의 공통 키워드: {insights.topKeywords.join(', ')}</p>
              )}
              {insights.belowAverageWeeks.length > 0 && (
                <p className="supporting">
                  {insights.belowAverageWeeks.join(', ')}주차의 시청 지속시간이 평균보다 15% 이상 낮습니다 — 곡 순서나 훅을 점검해보세요.
                </p>
              )}
              {insights.ctrRetentionDiagnosis && (
                <p className="supporting">
                  {insights.ctrRetentionDiagnosis.weekNo}주차 진단 (CTR {insights.ctrRetentionDiagnosis.ctrLevel} · 시청지속 {insights.ctrRetentionDiagnosis.retentionLevel}): {insights.ctrRetentionDiagnosis.messageKo}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="table-scroll">
        <table className="video-table">
          <thead>
            <tr>
              <th>주차</th>
              <th>제목</th>
              <th>사용 썸네일</th>
              <th>상태</th>
              <th>YouTube URL</th>
              <th>CTR(%)</th>
              <th>시청지속(초)</th>
              <th>조회수</th>
              <th>구독전환</th>
              <th>좋아요율(%)</th>
              <th>댓글 키워드</th>
              <th>회고 / 다음 액션</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {videos.map(video => (
              <tr key={video.id}>
                <td>{video.weekNo}</td>
                <td>{video.videoTitle}</td>
                <td>{video.thumbnailUsed || '—'}</td>
                <td>{statusLabel(video)}</td>
                <td>
                  <input
                    value={video.youtubeUrl || ''}
                    placeholder="https://youtu.be/..."
                    onChange={event => void handleFieldChange(video.id, { youtubeUrl: event.target.value, publishedAt: video.publishedAt || (event.target.value ? new Date().toISOString() : undefined) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    value={video.ctr ?? ''}
                    onChange={event => void handleFieldChange(video.id, { ctr: event.target.value ? Number(event.target.value) : undefined })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={video.avgViewDuration ?? ''}
                    onChange={event => void handleFieldChange(video.id, { avgViewDuration: event.target.value ? Number(event.target.value) : undefined })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={video.views ?? ''}
                    onChange={event => void handleFieldChange(video.id, { views: event.target.value ? Number(event.target.value) : undefined })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={video.subscribersGained ?? ''}
                    onChange={event => void handleFieldChange(video.id, { subscribersGained: event.target.value ? Number(event.target.value) : undefined })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    value={video.likeRate ?? ''}
                    onChange={event => void handleFieldChange(video.id, { likeRate: event.target.value ? Number(event.target.value) : undefined })}
                  />
                </td>
                <td>
                  <input
                    value={(video.commentKeywords || []).join(', ')}
                    placeholder="예: 목소리, 감성"
                    onChange={event => void handleFieldChange(video.id, { commentKeywords: event.target.value.split(',').map(w => w.trim()).filter(Boolean) })}
                  />
                </td>
                <td>
                  <input
                    value={video.learnings || ''}
                    placeholder="예: 빨간 배경이 CTR 높았음"
                    onChange={event => void handleFieldChange(video.id, { learnings: event.target.value })}
                  />
                </td>
                <td>
                  <button type="button" className="icon-button" title="삭제" onClick={() => void handleDelete(video.id)}>
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {videos.length === 0 && (
              <tr>
                <td colSpan={13} className="supporting">아직 저장된 팩이 없습니다. 곡을 생성하고 "이 팩 저장하기"를 누르면 여기 표시됩니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
