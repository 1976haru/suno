import { Copy, Save } from 'lucide-react';
import type { PlaylistBlueprint, SoundSignature } from '../types';
import type { ChannelPersonaRecord } from '../core/library';
import { PERSONA_STYLE_LIMIT } from '../core/soundSignature';
import { copyText } from '../utils/exporters';

export interface PersonaPromptStats {
  beforeAvg: number;
  afterMin: number;
  afterMax: number;
  afterAvg: number;
}

interface PersonaPanelProps {
  blueprint: PlaylistBlueprint;
  soundSignature: SoundSignature;
  personaMode: boolean;
  promptStats: PersonaPromptStats;
  savedPersonas: ChannelPersonaRecord[];
  onPersonaModeChange: (enabled: boolean) => void;
  onSavePersona: () => void;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}월 생성`;
}

export default function PersonaPanel({
  blueprint,
  soundSignature,
  personaMode,
  promptStats,
  savedPersonas,
  onPersonaModeChange,
  onSavePersona
}: PersonaPanelProps) {
  const seedSong = blueprint.songs[0];
  return (
    <section className="persona-panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Persona / Sound Signature</p>
          <h2>이 팩의 사운드 시그니처</h2>
          <p className="supporting">30곡을 같은 분위기로 만들려면 1번 곡을 먼저 만들고, 결과가 좋을 때 Suno에서 Make Persona로 저장하세요.</p>
        </div>
      </div>

      <div className="copy-block persona-copy">
        <div className="copy-head">
          <h4>시드 곡 Style 필드에 넣을 시그니처</h4>
          <span className={soundSignature.shortLength > PERSONA_STYLE_LIMIT ? 'prompt-length-badge over-limit' : 'prompt-length-badge'}>
            {soundSignature.shortLength} / {PERSONA_STYLE_LIMIT}자
          </span>
          <button type="button" onClick={() => void copyText(soundSignature.short)}>
            <Copy size={15} />
            복사
          </button>
        </div>
        <pre>{soundSignature.short}</pre>
      </div>

      <div className="persona-steps">
        <div>
          <b>1번 곡이 마음에 들면 Suno에서 Make Persona</b>
          <span>추천 이름: {soundSignature.personaName}</span>
          <div className="button-row">
            <button type="button" onClick={() => void copyText(soundSignature.personaName)}>
              <Copy size={15} />
              이름 복사
            </button>
            <button type="button" onClick={onSavePersona}>
              <Save size={15} />
              이 이름 저장
            </button>
          </div>
        </div>
        <div>
          <b>2번 곡부터는 Suno에서 저장한 Persona를 선택</b>
          <span>Persona가 목소리와 톤을 잡고, 곡별 프롬프트는 훅, 코드, 템포, 길이 같은 차이만 담당합니다.</span>
        </div>
      </div>

      <label className="persona-toggle">
        <input type="checkbox" checked={personaMode} onChange={event => onPersonaModeChange(event.target.checked)} />
        <span>
          Persona 모드로 곡별 프롬프트 다시 만들기
          <small>정체성 설명을 빼서 프롬프트가 짧아집니다. 가사는 바뀌지 않고 API를 호출하지 않습니다.</small>
        </span>
      </label>
      <p className="supporting">
        프롬프트 길이 평균: {promptStats.beforeAvg}자 → {promptStats.afterAvg}자
        {' '}({promptStats.afterMin}-{promptStats.afterMax}자)
      </p>

      {seedSong && (
        <div className="provider-summary">
          <p className="supporting">
            시드 곡: {seedSong.trackNo}. {seedSong.title} — 이 곡을 먼저 만들고 결과가 좋으면 위 이름으로 Persona를 저장하세요.
          </p>
        </div>
      )}

      <div className="signature-grid">
        <div style={{ gridColumn: '1 / -1' }}>
          <b>전체 시그니처</b>
          <span>{soundSignature.full}</span>
        </div>
      </div>

      <div className="persona-saved">
        <h3>이 채널에 저장된 Persona</h3>
        {savedPersonas.length === 0 ? (
          <p className="supporting">아직 저장된 Persona 이름이 없습니다. 1번 곡 결과가 좋을 때 위 추천 이름을 저장하세요.</p>
        ) : (
          <div className="persona-list">
            {savedPersonas.map(item => (
              <div key={item.id} className="persona-list-item">
                <b>{item.personaName}</b>
                <span>{dateLabel(item.createdAt)} · {item.useCount}개 팩에서 사용</span>
              </div>
            ))}
          </div>
        )}
        <p className="supporting">새 팩에서도 이 목록을 보고 같은 채널 목소리를 이어갈 수 있습니다. 앱 안에서 Persona를 선택하지는 않습니다.</p>
      </div>
    </section>
  );
}
