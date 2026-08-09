import type { ChannelProfile, GenrePack, ListeningIntent } from '../types';
import type { GenreComboSummary } from './genreComboSummary';
import { representativePerceivedEnergy, isEraColorGenreId } from './listeningIntent';
import { PERCEIVED_ENERGY_POLICY } from '../data/perceivedEnergyPolicy';
import { LISTENING_INTENT_POLICY } from '../data/listeningIntentPolicy';
import { workspaceForArchetype } from '../data/workspaces';
import { genrePacks } from '../data/genreLibrary';

/**
 * 지시문 25 (TASK C) — 실행 가능한 조언. §C-1 원칙: 차단하지 않는다, 제안만
 * 한다. 사용자가 무시하고 진행할 수 있다 — 아래 어떤 advice도 저장/생성을
 * 막지 않는다(호출부가 advice 배열을 그냥 보여주기만 하면 된다).
 *
 * 추천 장르는 반드시 channel.preferredGenres 안에 있고 현재 선택되지 않은
 *것만 고른다(§C-3) — 채널 밖 장르를 추천하지 않는다.
 *
 * 임계값은 전부 정책 상수, verified: false로 시작한다(§C-4) — 근거 없는
 * 추정치이고, 지시문24 §0-3의 실제 결함 사례(adult-contemporary·
 * healing-ballad·piano-ballad·retro-soul-pop, tempoRange 78~106 BPM, 폭
 * 28)를 감지할 수 있도록 첫 값을 잡았다. 첫 세트 실사용 후 조정한다.
 */

const TEMPO_SPAN_THRESHOLD_BPM = 30;
const HIGH_ENERGY_LEVEL = 4;
const HIGH_ENERGY_COUNT_THRESHOLD = 4;
const MIN_GENRE_COUNT = 3;
const LISTENING_INTENT_ENERGY_MARGIN = 0.6;

export interface GenreComboAdvice {
  type: 'tempo-concentration' | 'energy-skew' | 'era-shortage' | 'era-excess' | 'genre-count-shortage' | 'listening-intent-mismatch';
  messageKo: string;
}

function unusedChannelGenres(channel: ChannelProfile, selectedIds: readonly string[]): GenrePack[] {
  const selected = new Set(selectedIds);
  return (channel.preferredGenres ?? [])
    .filter(id => !selected.has(id))
    .map(id => genrePacks.find(g => g.id === id))
    .filter((g): g is GenrePack => Boolean(g));
}

export function computeGenreComboAdvice(
  genres: readonly GenrePack[],
  summary: GenreComboSummary,
  channel: ChannelProfile,
  listeningIntent: ListeningIntent | undefined
): GenreComboAdvice[] {
  const advice: GenreComboAdvice[] = [];
  if (!genres.length) return advice;

  const selectedIds = genres.map(g => g.id);
  const candidates = unusedChannelGenres(channel, selectedIds);
  const workspaceId = workspaceForArchetype(channel.archetype)?.id ?? 'senior-oldpop';
  const energyPolicy = PERCEIVED_ENERGY_POLICY[workspaceId];

  // 1) 템포 대역 편중 — 지시문24 §0-3의 실제 사례를 감지하는 항목(인수 기준).
  const tempoLows = genres.map(g => g.tempoRange[0]);
  const tempoHighs = genres.map(g => g.tempoRange[1]);
  const tempoSpan = Math.max(...tempoHighs) - Math.min(...tempoLows);
  if (tempoSpan <= TEMPO_SPAN_THRESHOLD_BPM) {
    const slower = candidates
      .filter(g => g.tempoRange[0] < Math.min(...tempoLows))
      .sort((a, b) => a.tempoRange[0] - b.tempoRange[0])
      .slice(0, 2);
    const suggestion = slower.length
      ? ` ${slower.map(g => g.labelKo ?? g.label).join('나 ')}를 추가해보세요.`
      : '';
    advice.push({
      type: 'tempo-concentration',
      messageKo: `선택하신 ${genres.length}종이 모두 ${Math.min(...tempoLows)}~${Math.max(...tempoHighs)} BPM 대역입니다. 잔잔한 곡을 만들 장르가 부족할 수 있습니다.${suggestion}`
    });
  }

  // 2) 에너지 편중(4단계 이상 곡 초과).
  const highEnergyCount = summary.rows
    .filter(r => r.perceivedEnergy >= HIGH_ENERGY_LEVEL)
    .reduce((sum, r) => sum + r.songCount, 0);
  if (highEnergyCount > HIGH_ENERGY_COUNT_THRESHOLD) {
    const calmer = candidates
      .map(g => ({ g, pe: representativePerceivedEnergy(g, energyPolicy) }))
      .filter(x => x.pe <= 2)
      .sort((a, b) => a.pe - b.pe)
      .slice(0, 1);
    const suggestion = calmer.length ? ` ${calmer[0].g.labelKo ?? calmer[0].g.label}처럼 차분한 장르를 넣어보세요.` : '';
    advice.push({
      type: 'energy-skew',
      messageKo: `${HIGH_ENERGY_LEVEL}단계 이상 곡이 ${highEnergyCount}곡입니다. 배경음악으로 오래 틀어두기에는 다소 바쁠 수 있습니다.${suggestion}`
    });
  }

  // 3) 시대색 부족 — 채널 풀에는 시대색 장르가 있는데 지금 고른 것 중엔 없음.
  const channelHasEraColor = (channel.preferredGenres ?? []).some(id => isEraColorGenreId(id));
  if (channelHasEraColor && summary.eraColorSongCount === 0) {
    const eraCandidate = candidates.find(g => isEraColorGenreId(g.id));
    const suggestion = eraCandidate ? ` ${eraCandidate.labelKo ?? eraCandidate.label} 같은 장르를 추가해보세요.` : '';
    advice.push({
      type: 'era-shortage',
      messageKo: `선택하신 장르 중 시대색이 뚜렷한 것이 없습니다. 이 채널에는 시대색 있는 장르도 있는데, 지금 조합은 시대감이 약할 수 있습니다.${suggestion}`
    });
  }

  // 4) 시대색 과다 — 선택한 전부가 시대색 장르(반대 방향 제안).
  if (genres.length >= 2 && summary.eraColorSongCount === summary.totalSongCount && summary.totalSongCount > 0) {
    const neutralCandidate = candidates.find(g => !isEraColorGenreId(g.id));
    const suggestion = neutralCandidate ? ` ${neutralCandidate.labelKo ?? neutralCandidate.label} 같은 era-neutral 장르를 섞어보세요.` : '';
    advice.push({
      type: 'era-excess',
      messageKo: `선택하신 장르가 모두 시대색이 강합니다. 장시간 청취용으로는 시대색 없는 장르를 섞는 것도 방법입니다.${suggestion}`
    });
  }

  // 5) 장르 수 부족.
  if (genres.length < MIN_GENRE_COUNT && summary.totalSongCount > 0) {
    advice.push({
      type: 'genre-count-shortage',
      messageKo: `장르가 ${genres.length}종입니다. ${summary.totalSongCount}곡이면 장르당 곡 수가 많아져 단조로울 수 있습니다.`
    });
  }

  // 6) 청취 목적과 불일치.
  if (listeningIntent) {
    const intentPolicy = LISTENING_INTENT_POLICY[listeningIntent];
    const diff = summary.energyAvg - intentPolicy.targetAverageEnergy;
    if (summary.totalSongCount > 0 && Math.abs(diff) > LISTENING_INTENT_ENERGY_MARGIN) {
      advice.push({
        type: 'listening-intent-mismatch',
        messageKo: `"${intentPolicy.labelKo}"인데 선택하신 장르의 평균 에너지가 ${summary.energyAvg.toFixed(1)}입니다(목표 ${intentPolicy.targetAverageEnergy.toFixed(1)}). ${diff > 0 ? '더 차분한' : '더 활기찬'} 장르로 바꿔보는 것도 방법입니다.`
      });
    }
  }

  return advice;
}
