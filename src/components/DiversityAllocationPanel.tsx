import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, RotateCcw, Save, Upload } from 'lucide-react';
import { hookDevices } from '../data/hookDevices';
import { introTexturesForArchetype } from '../data/introTextures';
import { isKidsArchetype } from '../utils/channelArchetype';
import { lyricThemesForOptions } from '../data/lyricThemes';
import {
  ADULT_STRUCTURE_TEMPLATE_IDS,
  allocationForAxis,
  allocationStatus,
  ARRANGEMENT_DENSITY_IDS,
  DIVERSITY_AXIS_IDS,
  DIVERSITY_AXIS_LABELS,
  hasAllocationOverflow,
  KIDS_STRUCTURE_TEMPLATE_IDS,
  normalizeAxisAllocation,
  normalizeDiversityAllocations,
  VOCAL_TYPE_IDS
} from '../core/diversityAllocation';
import { getDiversityAllocationTemplate, saveDiversityAllocationTemplate } from '../core/diversityAllocationStore';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL } from '../core/promptComposer';
import { clampToLimit, INPUT_LIMITS } from '../core/inputLimits';
import type { AxisAllocation, DiversityAxisId, GenerationOptions, GenrePack } from '../types';

interface AxisOption {
  id: string;
  label: string;
  detail?: string;
}

interface AxisDefinition {
  axis: DiversityAxisId;
  label: string;
  help: string;
  options: AxisOption[];
  disabled?: boolean;
  disabledReason?: string;
}

interface DiversityAllocationPanelProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  genres: GenrePack[];
}

const POV_OPTIONS: AxisOption[] = [
  { id: 'firstPerson', label: '1인칭', detail: 'First person' },
  { id: 'secondPerson', label: '2인칭', detail: 'Second person' },
  { id: 'thirdPerson', label: '3인칭', detail: 'Third person' },
  { id: 'radioHost', label: '라디오 DJ', detail: 'Radio host' }
];

const STRUCTURE_LABELS: Record<string, string> = {
  T1: '기본',
  T2: '훅 인트로',
  T3: '키 리프트',
  T4: '인스트 훅',
  T5: '아카펠라 태그'
};

const ARRANGEMENT_LABELS: Record<string, string> = {
  sparse: 'Sparse',
  medium: 'Medium',
  full: 'Full'
};

const VOCAL_LABELS: Record<string, string> = {
  male: '남자아이',
  female: '여자아이',
  mixed: '혼성 합창'
};

function axisDefinitions(opts: GenerationOptions, genres: GenrePack[]): AxisDefinition[] {
  const archetype = opts.channel.archetype;
  const structureIds = isKidsArchetype(archetype) ? KIDS_STRUCTURE_TEMPLATE_IDS : ADULT_STRUCTURE_TEMPLATE_IDS;
  const narrativeGenre = genres.some(genre => Boolean(genre.arrangementNarrative));
  return [
    {
      axis: 'genre',
      label: 'Genre',
      help: 'Assign the selected main/sub genres per track. Auto keeps the existing selected-genre stride rotation.',
      options: opts.genreIds.map(id => {
        const genre = genres.find(item => item.id === id);
        return {
          id,
          label: genre?.label || id,
          detail: genre?.shortPrompt || genre?.styleCore
        };
      })
    },
    {
      axis: 'vocalType',
      label: '보컬 쿼터',
      help: isKidsArchetype(archetype)
        ? '키즈 채널 기본은 세 타입을 같은 비율(33/33/33)로 돌립니다.'
        : '이 채널은 단일 보컬 프리셋을 사용합니다. 키즈 채널에서만 수동 쿼터가 실제 보컬 타입을 바꿉니다.',
      disabled: !isKidsArchetype(archetype),
      disabledReason: !isKidsArchetype(archetype) ? '키즈 채널 전용 축' : undefined,
      options: VOCAL_TYPE_IDS.map(id => ({ id, label: VOCAL_LABELS[id] }))
    },
    {
      axis: 'introTexture',
      label: '인트로 텍스처',
      help: '첫 5초의 악기 질감을 곡별로 배정합니다.',
      options: introTexturesForArchetype(archetype).map(texture => ({
        id: texture.id,
        label: texture.labelKo || texture.labelEn,
        detail: texture.labelEn
      }))
    },
    {
      axis: 'hookDevice',
      label: '훅 진입 장치',
      help: narrativeGenre ? '서사 장르는 auto에서 생략됩니다. 수동 배정하면 보조 장치로만 사용합니다.' : '코러스 직전/직후의 편곡 포인트를 배정합니다.',
      options: hookDevices.map(device => ({ id: device.id, label: device.label, detail: device.prompt }))
    },
    {
      axis: 'arrangementDensity',
      label: '편곡 밀도',
      help: '곡별로 sparse/medium/full 편곡 무게를 배정합니다.',
      options: ARRANGEMENT_DENSITY_IDS.map(id => ({
        id,
        label: ARRANGEMENT_LABELS[id],
        detail: ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[id]
      }))
    },
    {
      axis: 'structureTemplate',
      label: '구조 템플릿',
      help: '가사 섹션 순서를 배정합니다. 1번 트랙은 cold-open 안정성을 위해 T1로 고정됩니다.',
      options: structureIds.map(id => ({ id, label: `${id} ${STRUCTURE_LABELS[id]}` }))
    },
    {
      axis: 'lyricTheme',
      label: '가사 테마',
      help: '곡마다 중심 이미지나 키즈 테마를 배정합니다.',
      options: lyricThemesForOptions(opts).map(theme => ({
        id: theme.id,
        label: theme.labelKo,
        detail: theme.scene
      }))
    },
    {
      axis: 'pov',
      label: '시점',
      help: '곡마다 가사 화자의 시점을 배정합니다.',
      options: POV_OPTIONS
    }
  ];
}

function statusText(status: ReturnType<typeof allocationStatus>, songCount: number): string {
  if (status.state === 'auto') return `자동 / 총 ${songCount}곡`;
  return `배정 합계 ${status.total} / 총 ${songCount}곡`;
}

function statusClass(status: ReturnType<typeof allocationStatus>): string {
  if (status.state === 'over') return 'over';
  if (status.state === 'under') return 'under';
  if (status.state === 'exact') return 'exact';
  return 'auto';
}

export default function DiversityAllocationPanel({ opts, setOpts, genres }: DiversityAllocationPanelProps) {
  const definitions = useMemo(
    () => axisDefinitions(opts, genres),
    [opts.channel.archetype, opts.customLyricThemeScene, opts.genreIds, opts.lyricLanguage, genres]
  );
  const [openAxes, setOpenAxes] = useState<Set<DiversityAxisId>>(() => new Set());
  const [hasSavedPreset, setHasSavedPreset] = useState(false);
  const [message, setMessage] = useState('');
  const allocations = normalizeDiversityAllocations(opts.diversityAllocations);
  const overflow = hasAllocationOverflow(allocations, opts.songCount);

  useEffect(() => {
    let cancelled = false;
    void getDiversityAllocationTemplate(opts.channel.id).then(template => {
      if (!cancelled) setHasSavedPreset(Boolean(template));
    });
    return () => {
      cancelled = true;
    };
  }, [opts.channel.id]);

  function toggleAxis(axis: DiversityAxisId) {
    setOpenAxes(prev => {
      const next = new Set(prev);
      if (next.has(axis)) next.delete(axis);
      else next.add(axis);
      return next;
    });
  }

  function setAxisAllocation(axis: DiversityAxisId, updater: (current: AxisAllocation) => AxisAllocation) {
    setOpts(prev => {
      const current = allocationForAxis(prev.diversityAllocations, axis) ?? { axis, mode: 'auto', counts: {} };
      const next = normalizeAxisAllocation(updater(current));
      const withoutAxis = normalizeDiversityAllocations(prev.diversityAllocations).filter(item => item.axis !== axis);
      if (!next || (next.mode === 'auto' && Object.keys(next.counts).length === 0)) {
        return { ...prev, diversityAllocations: withoutAxis };
      }
      return { ...prev, diversityAllocations: [...withoutAxis, next] };
    });
  }

  function setCount(axis: DiversityAxisId, id: string, value: number) {
    setAxisAllocation(axis, current => ({
      axis,
      mode: 'manual',
      counts: {
        ...current.counts,
        [id]: Math.max(0, Math.min(opts.songCount, Math.round(value) || 0))
      }
    }));
  }

  function resetAxis(axis: DiversityAxisId) {
    setAxisAllocation(axis, () => ({ axis, mode: 'auto', counts: {} }));
  }

  async function savePreset() {
    try {
      await saveDiversityAllocationTemplate(opts.channel.id, allocations, opts.songCount);
      setHasSavedPreset(true);
      setMessage('채널 배정 프리셋을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프리셋 저장에 실패했습니다.');
    }
  }

  async function loadPreset() {
    const template = await getDiversityAllocationTemplate(opts.channel.id);
    if (!template) {
      setMessage('저장된 채널 배정 프리셋이 없습니다.');
      return;
    }
    setOpts(prev => ({ ...prev, diversityAllocations: template.allocations }));
    setMessage('채널 배정 프리셋을 불러왔습니다.');
  }

  return (
    <div className="diversity-allocation-panel">
      <div className="diversity-allocation-head">
        <div>
          <h3>다양성 축 배정</h3>
          <p className="supporting">auto는 기존 균등/stride 배정을 그대로 사용합니다. 수동 합계가 부족하면 남은 곡은 auto로 채웁니다.</p>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => setOpts(prev => ({ ...prev, diversityAllocations: [] }))}>
            <RotateCcw size={14} />
            전부 초기화
          </button>
          <button type="button" onClick={() => void loadPreset()} disabled={!hasSavedPreset}>
            <Upload size={14} />
            불러오기
          </button>
          <button type="button" onClick={() => void savePreset()} disabled={overflow}>
            <Save size={14} />
            저장
          </button>
        </div>
      </div>
      {overflow && <p className="error">초과 배정이 있는 축은 저장할 수 없습니다.</p>}
      {message && <p className="supporting">{message}</p>}

      <div className="option-block compact">
        <label>직접 주제/상황</label>
        <textarea
          value={opts.customLyricThemeScene || ''}
          onChange={event => setOpts(prev => ({ ...prev, customLyricThemeScene: clampToLimit('customLyricThemeScene', event.target.value) }))}
          placeholder="Example: opening a faded photo envelope at a rainy cafe table before the last train"
          maxLength={INPUT_LIMITS.customLyricThemeScene}
        />
        <p className="supporting">{(opts.customLyricThemeScene || '').length} / {INPUT_LIMITS.customLyricThemeScene}</p>
      </div>

      <div className="diversity-axis-list">
        {definitions.map(def => {
          const allocation = allocationForAxis(allocations, def.axis) ?? { axis: def.axis, mode: 'auto' as const, counts: {} };
          const status = allocationStatus(allocation, opts.songCount);
          const open = openAxes.has(def.axis);
          return (
            <div key={def.axis} className="diversity-axis-card">
              <button type="button" className="diversity-axis-toggle" onClick={() => toggleAxis(def.axis)}>
                <span>
                  <b>{def.label}</b>
                  <em>{DIVERSITY_AXIS_LABELS[def.axis]}</em>
                </span>
                <span className={`allocation-status ${statusClass(status)}`}>{statusText(status, opts.songCount)}</span>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {open && (
                <div className="diversity-axis-body">
                  <p className="supporting">{def.help}</p>
                  {def.disabledReason && <p className="supporting">{def.disabledReason}</p>}
                  <div className="chips">
                    <button type="button" className={allocation.mode === 'auto' ? 'chip active' : 'chip'} onClick={() => resetAxis(def.axis)}>
                      자동 균등
                    </button>
                    <button
                      type="button"
                      className={allocation.mode === 'manual' ? 'chip active' : 'chip'}
                      disabled={def.disabled}
                      onClick={() => setAxisAllocation(def.axis, current => ({ ...current, axis: def.axis, mode: 'manual' }))}
                    >
                      수동 배정
                    </button>
                  </div>
                  <div className="allocation-row-list">
                    {def.options.map(option => {
                      const value = allocation.mode === 'manual' ? allocation.counts[option.id] ?? 0 : 0;
                      return (
                        <div key={option.id} className="allocation-row">
                          <div className="allocation-label">
                            <b>{option.label}</b>
                            {option.detail && <span>{option.detail}</span>}
                          </div>
                          <button type="button" className="icon-button" disabled={def.disabled} onClick={() => setCount(def.axis, option.id, value - 1)} title="감소">
                            <Minus size={14} />
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={opts.songCount}
                            value={value}
                            disabled={def.disabled}
                            onChange={event => setCount(def.axis, option.id, Number(event.target.value))}
                          />
                          <button type="button" className="icon-button" disabled={def.disabled} onClick={() => setCount(def.axis, option.id, value + 1)} title="증가">
                            <Plus size={14} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={opts.songCount}
                            value={value}
                            disabled={def.disabled}
                            onChange={event => setCount(def.axis, option.id, Number(event.target.value))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
