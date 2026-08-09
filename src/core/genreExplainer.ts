import type { ChannelProfile, GenrePack, PerceivedEnergy } from '../types';
import { representativePerceivedEnergy } from './listeningIntent';
import { PERCEIVED_ENERGY_POLICY } from '../data/perceivedEnergyPolicy';
import { workspaceForArchetype } from '../data/workspaces';
import { genrePacks } from '../data/genreLibrary';
import { ERA_BUCKETS_BY_GENRE_ID, type EraBucket } from '../data/eraBuckets';
import { MOOD_KO } from '../data/genreMoodKo';
import { PHRASE_KO } from '../data/genrePhraseKo';

/**
 * 지시문 25 (TASK A) — 장르 레코드의 기존 필드를 한국어 문장으로 조립해
 * 보여주는 "설명 카드". §0-2 원칙: LLM으로 생성하지 않는다, 새 서술 데이터를
 * 손으로 쓰지 않는다(labelKo 제외) — genreLibrary가 이미 채워둔
 * label/styleCore/instruments/rhythm/tempoRange/moods/eraBuckets/eraNoteKo/
 * production/vocalPreference만 읽어 조립한다.
 *
 * 체감 에너지는 지시문 23의 computePerceivedEnergy(core/listeningIntent.ts의
 * representativePerceivedEnergy 경유)를 그대로 재사용한다 — 새 계산 로직
 * 0개. 시대 판정은 eraBuckets.ts의 ERA_BUCKETS_BY_GENRE_ID를 그대로 읽는다
 * (genreLibrary/index.ts의 최종 파생 단계와 동일한 조회 방식) — 새 시대
 * 판정 로직을 만들지 않는다.
 *
 * instruments/rhythm/vocal/production 네 축의 영→한 변환은 PHRASE_KO
 * (genrePhraseKo.ts)에 있는 구만 옮긴다 — 사전에 없는 구는 "원문 그대로
 * 나열"하지 않고 조용히 건너뛴다(§ 하지 말 것). 1차 배치(50/362 labelKo,
 * 8종 전체 phrase) 밖의 장르는 facts.instrumentsKo/rhythmKo가 비어 있거나
 * summaryKo 두 번째 문장이 생략될 수 있다 — 사전이 채워지는 대로 자동
 * 개선된다.
 */

export interface GenreExplanation {
  genreId: string;
  labelKo: string;
  labelEn: string;
  summaryKo: string;
  facts: {
    instrumentsKo: string[];
    tempoKo: string;
    rhythmKo: string;
    moodKo: string;
    eraKo: string;
    vocalKo?: string;
  };
  perceivedEnergy: PerceivedEnergy;
  glossaryTerms: string[];
}

function translateList(values: readonly string[] | undefined, dict: Record<string, string>, limit?: number): string[] {
  if (!values?.length) return [];
  const translated = values.map(v => dict[v]).filter((v): v is string => Boolean(v));
  return limit ? translated.slice(0, limit) : translated;
}

/** 이 채널의 preferredGenres 풀 tempoRange 중앙값 평균 — "이 채널 평균보다 느림/빠름" 상대 표현의 기준선. */
function channelAverageMidTempo(channel: ChannelProfile): number | null {
  const ids = channel.preferredGenres;
  if (!ids?.length) return null;
  const mids = ids
    .map(id => genrePacks.find(g => g.id === id))
    .filter((g): g is GenrePack => Boolean(g))
    .map(g => (g.tempoRange[0] + g.tempoRange[1]) / 2);
  if (!mids.length) return null;
  return mids.reduce((a, b) => a + b, 0) / mids.length;
}

// 추정치(verified: false) — 채널 평균 대비 "비슷함/조금 느림·빠름/느림·빠름"을
// 가르는 BPM 폭. 근거 없음, 하루의 실제 사용 반응을 보고 조정한다(§C-4와
// 같은 원칙 — TASK A의 임계값도 정책 상수로 남긴다).
const TEMPO_RELATIVE_MARGIN_BPM = 4;
const TEMPO_RELATIVE_STRONG_BPM = 12;

function tempoKo(genre: GenrePack, channel: ChannelProfile): string {
  const [low, high] = genre.tempoRange;
  const base = `${low}~${high} BPM`;
  const avg = channelAverageMidTempo(channel);
  if (avg === null) return base;
  const mid = (low + high) / 2;
  const diff = mid - avg;
  if (Math.abs(diff) < TEMPO_RELATIVE_MARGIN_BPM) return `${base} (이 채널 평균과 비슷합니다)`;
  if (diff < 0) return `${base} (이 채널 평균보다 ${diff < -TEMPO_RELATIVE_STRONG_BPM ? '' : '조금 '}느립니다)`;
  return `${base} (이 채널 평균보다 ${diff > TEMPO_RELATIVE_STRONG_BPM ? '' : '조금 '}빠릅니다)`;
}

function eraBucketsFor(genreId: string): EraBucket[] {
  return ERA_BUCKETS_BY_GENRE_ID[genreId] ?? ['era-neutral'];
}

function isEraNeutral(buckets: EraBucket[]): boolean {
  return buckets.length === 1 && buckets[0] === 'era-neutral';
}

function eraKo(genreId: string): string {
  const buckets = eraBucketsFor(genreId);
  if (isEraNeutral(buckets)) return '특정 시대색 없음 — 무드 중심 장르입니다';
  return `${buckets.join(' · ')} — 시대색이 뚜렷합니다`;
}

function vocalPreferenceKo(pref: NonNullable<GenrePack['vocalPreference']>): string {
  const { male, female, mixed } = pref;
  if (mixed >= male && mixed >= female) return '남녀 보컬이 고르게 쓰입니다';
  if (Math.abs(male - female) < 0.15) return '남녀 보컬이 고르게 쓰입니다';
  return female > male
    ? `여성 보컬 우세 (여성 ${Math.round(female * 100)}%)`
    : `남성 보컬 우세 (남성 ${Math.round(male * 100)}%)`;
}

/** eraBuckets만으로 만드는 안전한 시대 문장 — eraNoteKo 원문(감사용 자유 문자열, 예: "기존 eraTag 자유문자열 \"...\" — 시작 연대 1980년대를 채택")을 그대로 사용자에게 보여주지 않는다. eraTag 자유문자열을 판정에 쓰지 않는다는 지시문 23의 원칙과 같은 이유로, 사람이 읽을 문장도 그 원문을 그대로 노출하지 않는다. */
function eraSentenceKo(genreId: string): string {
  const buckets = eraBucketsFor(genreId);
  if (isEraNeutral(buckets)) return '특정 시대를 내세우기보다 무드로 듣는 장르입니다.';
  return `${buckets.join('~')} 스타일을 담은 장르입니다.`;
}

function soundSentenceKo(genre: GenrePack): string {
  const instrumentsKoList = translateList(genre.instruments, PHRASE_KO, 2);
  const rhythmKoList = translateList(genre.rhythm, PHRASE_KO, 1);
  const parts = [...instrumentsKoList, ...rhythmKoList];
  if (!parts.length) return '';
  return `${parts.join(', ')} 특징을 가진 소리입니다.`;
}

function usageSentenceKo(genre: GenrePack): string {
  const moodsKoList = translateList(genre.moods, MOOD_KO);
  if (!moodsKoList.length) return '';
  return `${moodsKoList.join(' · ')} 느낌이 필요할 때 어울립니다.`;
}

export function explainGenre(genre: GenrePack, channel: ChannelProfile): GenreExplanation {
  const workspaceId = workspaceForArchetype(channel.archetype)?.id ?? 'senior-oldpop';
  const energyPolicy = PERCEIVED_ENERGY_POLICY[workspaceId];
  const perceivedEnergy = representativePerceivedEnergy(genre, energyPolicy);

  const instrumentsKo = translateList(genre.instruments, PHRASE_KO, 3);
  const rhythmKo = translateList(genre.rhythm, PHRASE_KO, 1)[0] ?? '';
  const moodKoList = translateList(genre.moods, MOOD_KO);

  const summaryKo = [eraSentenceKo(genre.id), soundSentenceKo(genre), usageSentenceKo(genre)]
    .filter(Boolean)
    .join(' ');

  const glossaryTerms = [
    ...(genre.instruments ?? []),
    ...(genre.rhythm ?? []),
    ...(genre.vocal ?? []),
    ...(genre.production ?? [])
  ];

  return {
    genreId: genre.id,
    labelKo: genre.labelKo ?? genre.label,
    labelEn: genre.label,
    summaryKo,
    facts: {
      instrumentsKo,
      tempoKo: tempoKo(genre, channel),
      rhythmKo,
      moodKo: moodKoList.join(' · '),
      eraKo: eraKo(genre.id),
      ...(genre.vocalPreference ? { vocalKo: vocalPreferenceKo(genre.vocalPreference) } : {})
    },
    perceivedEnergy,
    glossaryTerms
  };
}
