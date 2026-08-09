import type { GenrePack, PerceivedEnergy, PreassignedSongSlot } from '../types';
import type { ArrangementDensityLevel } from './promptComposer';
import type { PerceivedEnergyPolicy } from '../data/perceivedEnergyPolicy';
import { lexiconAxisDiff, matchedLexiconPhrases } from '../data/perceivedEnergyLexicon';

/**
 * 지시문 23 (TASK A) — 체감 에너지. §0의 원칙: "사람이 354개 장르에 손으로
 * 1~5를 매기지 않는다. 기존 필드에서 계산한다. 새 입력 필드를 만들지 않는다."
 *
 * 슬롯(PreassignedSongSlot)과 장르(GenrePack)가 이미 갖고 있는 필드만 읽는다:
 * tempo·arrangementDensity·instrumentSet·vocalText(슬롯) + rhythm·instruments·
 * vocal·production(장르, 문자열 배열). 새 데이터 입력 화면·저장 필드 0개.
 */

export interface PerceivedEnergyResult {
  value: PerceivedEnergy;
  /** 각 축의 "가중치 적용 후" 기여도 — 부호 있는 raw 값(대략 -weight~+weight). 왜 이 값인지 사람이 읽을 수 있어야 한다(§A-2). */
  breakdown: {
    tempo: number;
    rhythm: number;
    instrumentation: number;
    density: number;
    vocal: number;
    production: number;
  };
  /** 판정에 쓰이지 않는다 — 사람이 읽는 필드다(§A-2, eraTag 자유 문자열 문제 재발 방지). */
  reasonKo: string;
}

/** computePerceivedEnergy가 실제로 읽는 슬롯 필드 — Pick이라 완성된 슬롯이 없어도(구성 중이어도) 호출 가능하다. distinctChoiceGate.ts의 SongInput = Pick<SongIdea, ...>과 같은 패턴. */
export type PerceivedEnergySlotInput = Pick<PreassignedSongSlot, 'tempo' | 'arrangementDensity' | 'instrumentSet' | 'vocalText'>;

const DENSITY_SCORE: Record<ArrangementDensityLevel, number> = { sparse: -1, medium: 0, full: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** rhythm/instrumentation/vocal/production 4축 공통: 장르 필드(항상 존재) + 슬롯의 per-song 보강(있으면)을 합쳐 텍스트로 만들고, 렉시콘 매치 수 차이를 -1~+1로 정규화한다. */
function textAxisScore(genreParts: readonly (string | undefined)[], slotParts: readonly (string | undefined)[], axis: 'rhythm' | 'instrument' | 'vocal' | 'production'): { score: number; text: string } {
  const text = [...genreParts, ...slotParts].filter((part): part is string => Boolean(part && part.trim())).join(', ');
  if (!text) return { score: 0, text: '' };
  // §A-3 어휘는 3~4단어 구인 경우가 많아 하나의 매치가 이미 강한 신호다 —
  // diff 2 이상이면 이미 그 축의 최댓값(-1/+1)으로 클램프한다.
  const diff = lexiconAxisDiff(text, axis);
  return { score: clamp(diff / 2, -1, 1), text };
}

function tempoScore(tempo: number, policy: PerceivedEnergyPolicy): number {
  const { tempoAnchorLow, tempoAnchorHigh } = policy;
  if (tempoAnchorHigh <= tempoAnchorLow) return 0;
  const normalized = (tempo - tempoAnchorLow) / (tempoAnchorHigh - tempoAnchorLow);
  return clamp(normalized * 2 - 1, -1, 1);
}

function levelKo(value: PerceivedEnergy): string {
  if (value <= 2) return '낮음';
  if (value === 3) return '중간';
  return '높음';
}

export function computePerceivedEnergy(
  slot: PerceivedEnergySlotInput,
  genre: GenrePack,
  policy: PerceivedEnergyPolicy
): PerceivedEnergyResult {
  const density = slot.arrangementDensity ? DENSITY_SCORE[slot.arrangementDensity] : 0;
  const tempo = tempoScore(slot.tempo, policy);
  const rhythm = textAxisScore(genre.rhythm ?? [], [], 'rhythm');
  const instrumentation = textAxisScore(genre.instruments ?? [], slot.instrumentSet ?? [], 'instrument');
  const vocal = textAxisScore(genre.vocal ?? [], [slot.vocalText], 'vocal');
  const production = textAxisScore(genre.production ?? [], [], 'production');

  const w = policy.weights;
  const breakdown = {
    tempo: tempo * w.tempo,
    rhythm: rhythm.score * w.rhythm,
    instrumentation: instrumentation.score * w.instrumentation,
    density: density * w.density,
    vocal: vocal.score * w.vocal,
    production: production.score * w.production
  };
  const weightSum = w.tempo + w.rhythm + w.instrumentation + w.density + w.vocal + w.production || 1;
  const raw = (breakdown.tempo + breakdown.rhythm + breakdown.instrumentation + breakdown.density + breakdown.vocal + breakdown.production) / weightSum;

  const [t1, t2, t3, t4] = policy.thresholds;
  let value: PerceivedEnergy = 3;
  if (raw < t1) value = 1;
  else if (raw < t2) value = 2;
  else if (raw < t3) value = 3;
  else if (raw < t4) value = 4;
  else value = 5;

  // reasonKo — 판정에 쓰지 않는다(§A-2). 가장 크게 기여한 두 축의 매치 어휘를 사람이 읽을 문장으로 조립.
  const contributions = [
    { axis: '리듬', abs: Math.abs(breakdown.rhythm), text: rhythm.text, axisKey: 'rhythm' as const },
    { axis: '악기', abs: Math.abs(breakdown.instrumentation), text: instrumentation.text, axisKey: 'instrument' as const },
    { axis: '보컬', abs: Math.abs(breakdown.vocal), text: vocal.text, axisKey: 'vocal' as const },
    { axis: '프로덕션', abs: Math.abs(breakdown.production), text: production.text, axisKey: 'production' as const }
  ].sort((a, b) => b.abs - a.abs);
  const phraseFragments: string[] = [];
  for (const c of contributions) {
    if (phraseFragments.length >= 2) break;
    const matched = matchedLexiconPhrases(c.text, c.axisKey);
    const picked = [...matched.up, ...matched.down][0];
    if (picked) phraseFragments.push(picked);
  }
  const tempoNote = `${slot.tempo} BPM`;
  const reasonKo = phraseFragments.length
    ? `${tempoNote} + ${phraseFragments.join(' + ')} → ${levelKo(value)}`
    : `${tempoNote} (어휘 매치 없음, 템포 중심 판정) → ${levelKo(value)}`;

  return { value, breakdown, reasonKo };
}
