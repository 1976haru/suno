/**
 * 지시문 79 (TASK C-3) — en-chillhop 대역 잠금의 **공통 함수**.
 *
 * 지시문 71 TASK E가 만들고 76 TASK A가 브리지로 넓힌 "한 세트에 62 BPM과
 * 128 BPM을 섞지 않는다"는 규칙이, 실제로는 core/setDirector.ts의
 * directSetLocal **안에만** 있었다. Step2Plan을 거쳐 [설계 적용]을 누른
 * 세트에는 적용되고, 그 화면을 건너뛰고 바로 생성하는 경로
 * (core/batchPreallocation.ts의 preallocateSongSlots가 opts.genreIds를
 * 그대로 회전시키는 경로)에는 적용되지 않았다.
 *
 * 실측(2차 감사 항목 8 · check:path-coverage): setDirector 경로는 25세트
 * 전부 혼재 0건인데, 직접 생성 경로는 25세트 중 9세트가 64~68 BPM과
 * 124~127 BPM을 함께 냈다(after-hours-deep-house / city-lights-crossfade).
 * 지시문 76 커밋이 "대역 혼재 0건"으로 보고한 실측 3세트가 전부 setDirector
 * 경로였기 때문에 이 구멍이 보이지 않았다.
 *
 * 규칙 자체는 한 글자도 바꾸지 않는다 — setDirector가 쓰던 판정
 * (컨셉 텍스트의 하우스 신호 → 하우스 대역, 그 외 랩 대역이 기본값,
 * 브리지 3종은 양쪽 대역의 정규 후보)을 그대로 옮겨 두 경로가 같은 함수를
 * 부르게 한 것뿐이다. docs/generation-paths.md §2의 "산출물을 실제로 바꾸는
 * 정책은 공통 함수로 추출해 각 경로가 호출한다"가 이 파일이다.
 */
import {
  EN_CHILLHOP_BRIDGE_BAND_GENRE_IDS,
  EN_CHILLHOP_HOUSE_BAND_GENRE_IDS,
  EN_CHILLHOP_RAP_BAND_GENRE_IDS
} from '../data/genreLibrary';
import { isEnChillhopArchetype } from '../utils/channelArchetype';
import type { ChannelArchetype } from '../types';

/**
 * 컨셉 자유 텍스트가 하우스 대역을 지목하는가. setDirector.ts가 쓰던 정규식
 * 그대로다 — 두 경로가 같은 신호를 봐야 같은 대역을 고른다.
 */
export const EN_CHILLHOP_HOUSE_SIGNAL =
  /딥\s*하우스|deep\s*house|하우스\s*비트|하우스\s*그루브|하우스\s*뮤직|house\s*beat|house\s*groove|house\s*music|개러지|게러지|garage/i;

/**
 * 이 세트가 쓸 대역의 장르 id 집합(브리지 3종 포함).
 *
 * 대역 판정은 두 신호를 본다.
 *  ① 컨셉 텍스트의 하우스 신호 — setDirector가 쓰던 그대로.
 *  ② **사용자가 고른 장르 풀 자체** — 지시문 79에서 추가. 텍스트만 보면
 *     after-hours-deep-house 채널(하우스 3종 + alt-rnb)에 컨셉 없이 생성할
 *     때 기본값인 랩 대역이 걸려 alt-rnb 한 종만 남았다(실측 회귀,
 *     tests/bpmSectionFloor.test.ts가 잡았다). 풀이 이미 한쪽 대역으로
 *     기울어 있으면 그것이 사용자의 실제 선택이므로 텍스트보다 우선한다 —
 *     setDirector 경로는 후보를 스스로 넓게 만들어서 이 문제가 없었다.
 */
export function enChillhopBandGenreIds(freeText: string, poolGenreIds: readonly string[] = []): Set<string> {
  const houseInPool = poolGenreIds.filter(id => (EN_CHILLHOP_HOUSE_BAND_GENRE_IDS as readonly string[]).includes(id)).length;
  const rapInPool = poolGenreIds.filter(id => (EN_CHILLHOP_RAP_BAND_GENRE_IDS as readonly string[]).includes(id)).length;
  const house = EN_CHILLHOP_HOUSE_SIGNAL.test(freeText) || houseInPool > rapInPool;
  return new Set<string>([
    ...(house ? EN_CHILLHOP_HOUSE_BAND_GENRE_IDS : EN_CHILLHOP_RAP_BAND_GENRE_IDS),
    ...EN_CHILLHOP_BRIDGE_BAND_GENRE_IDS
  ]);
}

/**
 * 주어진 장르 풀에서 이 세트의 대역에 속하는 것만 남긴다.
 *
 * **아무것도 남지 않으면 원본을 그대로 돌려준다** — 대역 잠금은 다양성을
 * 좁히자는 규칙이 아니라 섞이지 않게 하자는 규칙이라, 풀 전체가 반대
 * 대역이면(사용자가 하우스 장르만 골라 놓고 컨셉에는 하우스 신호가 없는
 * 경우 등) 그 선택을 존중하는 편이 맞다. en-chillhop이 아닌 아키타입은
 * 언제나 원본 그대로다(§지시문 71 "다른 워크스페이스의 BPM/장르 배분
 * 로직은 전혀 건드리지 않는다").
 */
export function applyEnChillhopBandLock(
  genreIds: readonly string[],
  archetype: ChannelArchetype | undefined,
  freeText: string
): string[] {
  if (!isEnChillhopArchetype(archetype) || !genreIds.length) return [...genreIds];
  const bandIds = enChillhopBandGenreIds(freeText, genreIds);
  const locked = genreIds.filter(id => bandIds.has(id));
  return locked.length ? locked : [...genreIds];
}
