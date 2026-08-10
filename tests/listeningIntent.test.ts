import { describe, expect, it } from 'vitest';
import {
  applyListeningIntentIfPending,
  applyListeningIntentToOptions,
  buildGenreAllocationForListeningIntent,
  buildGenreCountsForExistingSelection,
  isEraColorGenreId,
  listeningIntentApplicationStatus,
  representativePerceivedEnergy,
  scaleEnergyDistribution
} from '../src/core/listeningIntent';
import { LISTENING_INTENT_POLICY, DEFAULT_LISTENING_INTENT } from '../src/data/listeningIntentPolicy';
import { PERCEIVED_ENERGY_POLICY } from '../src/data/perceivedEnergyPolicy';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import { MAX_SELECTED_GENRES } from '../src/core/genreSelection';
import { createInitialOptions } from '../src/utils/generation';

const energyPolicy = PERCEIVED_ENERGY_POLICY['senior-oldpop'];

describe('지시문 23 TASK B — isEraColorGenreId', () => {
  it('1950s-60s/1970s 장르는 시대색으로 판정한다', () => {
    expect(isEraColorGenreId('oldpop-doowop-harmony')).toBe(true);
    expect(isEraColorGenreId('oldpop-piano-ballad-70s')).toBe(true);
  });

  it('1980s·timeless·era 무관 장르는 시대색이 아니다', () => {
    expect(isEraColorGenreId('smooth-jazz-lounge')).toBe(false);
    expect(isEraColorGenreId('oldpop-evening-lamp-ballad')).toBe(false);
    expect(isEraColorGenreId('jazz-classic-vocal-lounge')).toBe(false);
  });
});

describe('지시문 23 TASK B — scaleEnergyDistribution', () => {
  it('songCount=18이면 원본 분포를 그대로 유지한다', () => {
    const dist = { 1: 3, 2: 8, 3: 4, 4: 3, 5: 0 } as const;
    expect(scaleEnergyDistribution(dist, 18)).toEqual(dist);
  });

  it('다른 songCount로도 합이 정확히 songCount가 되도록 비례 스케일한다', () => {
    const dist = { 1: 3, 2: 8, 3: 4, 4: 3, 5: 0 } as const;
    const scaled = scaleEnergyDistribution(dist, 12);
    const total = Object.values(scaled).reduce((a, b) => a + b, 0);
    expect(total).toBe(12);
  });
});

describe('지시문 23 TASK B — representativePerceivedEnergy', () => {
  it('british-beat(상향 어휘)가 doowop-harmony(하향 어휘)보다 대표값이 높다', () => {
    const britishBeat = getGenreById('oldpop-british-beat')!;
    const doowop = getGenreById('oldpop-doowop-harmony')!;
    expect(representativePerceivedEnergy(britishBeat, energyPolicy)).toBeGreaterThan(representativePerceivedEnergy(doowop, energyPolicy));
  });
});

describe('지시문 23 TASK B — buildGenreAllocationForListeningIntent (실제 oldpop-lounge-main 채널)', () => {
  const channel = channelPresets.find(c => c.id === 'oldpop-lounge-main')!;
  const candidates = channel.preferredGenres.map(getGenreById).filter((g): g is NonNullable<typeof g> => Boolean(g));

  it('기본값은 감성 장시간형이다', () => {
    expect(DEFAULT_LISTENING_INTENT).toBe('long-listen-comfort');
  });

  for (const intentId of ['long-listen-comfort', 'balanced', 'era-authentic'] as const) {
    it(`${intentId}: 18곡 전부 배정되고 장르 종수가 ${MAX_SELECTED_GENRES}개를 넘지 않으며 minEraColorTracks 하한을 만족한다`, () => {
      const policy = LISTENING_INTENT_POLICY[intentId];
      const alloc = buildGenreAllocationForListeningIntent(candidates, policy, 18, energyPolicy);
      const total = Object.values(alloc.counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(18);
      expect(alloc.genreIds.length).toBeLessThanOrEqual(MAX_SELECTED_GENRES);
      expect(alloc.eraColorTrackCount).toBeGreaterThanOrEqual(policy.minEraColorTracks);
    });

    // 실측 회귀 방지 — 실제 브라우저(dev 서버)로 감성 장시간형을 적용해 18곡
    // 생성을 시도했을 때 core/designGate.ts의 "같은 장르 최대 곡수" 관문이
    // 실제로 위반됨을 발견(장르 5종 중 chanson 1종에 6곡 몰림, 관문 상한은
    // 5). 원인은 perGenreCap을 songCount*0.28 어림값(반올림 시 6)으로 잡아
    // designGate의 실제 상한(가장 타이트한 variety 등급 4곡)보다 느슨했던
    // 것 — songCount/MAX_SELECTED_GENRES 기반으로 교정.
    it(`${intentId}: 어느 한 장르에도 ceil(songCount/${MAX_SELECTED_GENRES})곡을 초과해 몰리지 않는다 (designGate "같은 장르 최대 곡수" 관문 실측 회귀 방지)`, () => {
      const policy = LISTENING_INTENT_POLICY[intentId];
      const alloc = buildGenreAllocationForListeningIntent(candidates, policy, 18, energyPolicy);
      const cap = Math.ceil(18 / MAX_SELECTED_GENRES);
      for (const count of Object.values(alloc.counts)) {
        expect(count).toBeLessThanOrEqual(cap);
      }
    });
  }

  it('감성 장시간형의 minEraColorTracks는 3 이상, maxEnergy는 4다 (하지 말 것: 0으로 만들지 말 것 / 3으로 낮추지 말 것)', () => {
    const policy = LISTENING_INTENT_POLICY['long-listen-comfort'];
    expect(policy.minEraColorTracks).toBeGreaterThanOrEqual(3);
    expect(policy.maxEnergy).toBe(4);
  });

  it('정통 올드팝형(되돌릴 길) preset이 존재하고 verified는 전부 false다', () => {
    expect(LISTENING_INTENT_POLICY['era-authentic']).toBeDefined();
    for (const intent of Object.values(LISTENING_INTENT_POLICY)) {
      expect(intent.verified).toBe(false);
      expect(intent.sourceKo).toBeTruthy();
    }
  });
});

describe('지시문 24 TASK A-6 — buildGenreCountsForExistingSelection: 청취 목적은 "몇 곡씩"만 바꾸고 "어떤 장르"는 절대 바꾸지 않는다', () => {
  // 실제 라이브 브라우저 재현: oldpop-lounge-main에서 사용자가 Piano Pop
  // Ballad/Adult Contemporary Pop/Chanson Cafe/Bossa Cafe Pop/Smooth Jazz
  // Lounge 5종을 직접 골라둔 상태에서 "정통 올드팝형"을 눌렀더니 genreIds가
  // Doo-Wop Close Harmony/Doo-Wop Ballad/Night Chanson/Classic Vocal Jazz
  // Lounge로 통째로 바뀌었다 — buildGenreAllocationForListeningIntent가
  // 후보 전체(channel.preferredGenres)에서 새로 골랐기 때문. 이 함수는
  // existingGenres 인자로 받은 것 이외의 장르를 절대 counts에 추가하지 않는다.
  const userPickedGenreIds = ['piano-ballad', 'adult-contemporary', 'chanson', 'bossa-cafe', 'smooth-jazz-lounge'];
  const userPickedGenres = userPickedGenreIds.map(getGenreById).filter((g): g is NonNullable<typeof g> => Boolean(g));

  it('실제 장르 id들이 genreLibrary에 존재한다 (테스트 자체의 전제 검증)', () => {
    expect(userPickedGenres.length).toBe(userPickedGenreIds.length);
  });

  for (const intentId of ['long-listen-comfort', 'balanced', 'era-authentic'] as const) {
    it(`${intentId}: counts의 키 집합이 existingGenres와 정확히 같다 — 다른 장르가 섞여 들어오지 않는다`, () => {
      const policy = LISTENING_INTENT_POLICY[intentId];
      const { counts } = buildGenreCountsForExistingSelection(userPickedGenres, policy, 18, energyPolicy);
      expect(new Set(Object.keys(counts))).toEqual(new Set(userPickedGenreIds));
    });

    it(`${intentId}: 사용자가 고른 장르는 단 하나도 0곡으로 남지 않는다`, () => {
      const policy = LISTENING_INTENT_POLICY[intentId];
      const { counts } = buildGenreCountsForExistingSelection(userPickedGenres, policy, 18, energyPolicy);
      for (const id of userPickedGenreIds) {
        expect(counts[id], `${id} must not be 0`).toBeGreaterThan(0);
      }
    });

    it(`${intentId}: 총합이 정확히 songCount(18)와 같다 — 곡이 조용히 사라지거나 늘지 않는다`, () => {
      const policy = LISTENING_INTENT_POLICY[intentId];
      const { counts } = buildGenreCountsForExistingSelection(userPickedGenres, policy, 18, energyPolicy);
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(18);
    });
  }

  it('감성 장시간형과 정통 올드팝형은 같은 장르 집합에서도 실제로 다른 곡 수 배분을 낸다 (프리셋이 무의미해지지 않았는지 확인)', () => {
    const comfortCounts = buildGenreCountsForExistingSelection(userPickedGenres, LISTENING_INTENT_POLICY['long-listen-comfort'], 18, energyPolicy).counts;
    const authenticCounts = buildGenreCountsForExistingSelection(userPickedGenres, LISTENING_INTENT_POLICY['era-authentic'], 18, energyPolicy).counts;
    expect(comfortCounts).not.toEqual(authenticCounts);
  });
});

/**
 * 지시문 30 TASK B — 실측 재현: opts.listeningIntent가 write-once였고 생성
 * 경로 어디도 다시 확인하지 않았다는 결함(B-2)과, 그 수정(B-4: 생성 직전
 * 재적용)·B-5(3단 상태)를 코드로 고정한다.
 */
describe('지시문 30 TASK B — applyListeningIntentToOptions / listeningIntentApplicationStatus / applyListeningIntentIfPending', () => {
  const channel = channelPresets.find(c => c.id === 'oldpop-lounge-main')!;
  const baseOpts = createInitialOptions(channel);
  const workspacePolicy = LISTENING_INTENT_POLICY['long-listen-comfort'];

  it('status는 listeningIntent를 한 번도 고르지 않았으면 unselected다 (기본값 long-listen-comfort를 강제 적용하지 않는다, §B-6)', () => {
    expect(baseOpts.listeningIntent).toBeUndefined();
    expect(listeningIntentApplicationStatus(baseOpts, workspacePolicy, energyPolicy)).toBe('unselected');
  });

  it('applyListeningIntentToOptions 적용 직후에는 status가 applied다', () => {
    const applied = applyListeningIntentToOptions(baseOpts, 'long-listen-comfort', workspacePolicy, energyPolicy);
    expect(applied).not.toBe(baseOpts);
    expect(applied.listeningIntent).toBe('long-listen-comfort');
    expect(listeningIntentApplicationStatus(applied, workspacePolicy, energyPolicy)).toBe('applied');
  });

  it('지시문 30 B-2 실측 재현: 적용 후 songCount만 바꾸면 status가 modified로 바뀐다 — 배분이 낡은 songCount를 그대로 들고 있다는 신호', () => {
    const applied = applyListeningIntentToOptions(baseOpts, 'long-listen-comfort', workspacePolicy, energyPolicy);
    const staleAfterSongCountChange = { ...applied, songCount: applied.songCount + 6 };
    expect(listeningIntentApplicationStatus(staleAfterSongCountChange, workspacePolicy, energyPolicy)).toBe('modified');
  });

  it('applyListeningIntentIfPending은 modified일 때만 실제로 재적용하고, 재적용 후에는 다시 applied로 수렴한다 (지시문 30 TASK B-4의 실제 생성-경로 호출부와 동일 로직)', () => {
    const applied = applyListeningIntentToOptions(baseOpts, 'long-listen-comfort', workspacePolicy, energyPolicy);
    const stale = { ...applied, songCount: applied.songCount + 6 };
    const rePending = applyListeningIntentIfPending(stale, workspacePolicy, energyPolicy);
    expect(rePending).not.toBe(stale);
    expect(listeningIntentApplicationStatus(rePending, workspacePolicy, energyPolicy)).toBe('applied');
    expect(Object.values(rePending.diversityAllocations.find(a => a.axis === 'genre')!.counts).reduce((a, b) => a + b, 0)).toBe(stale.songCount);
  });

  it('applyListeningIntentIfPending은 unselected/applied일 때 완전한 no-op(동일 참조 반환)이다 — 생성마다 매번 새 객체를 만들지 않는다', () => {
    expect(applyListeningIntentIfPending(baseOpts, workspacePolicy, energyPolicy)).toBe(baseOpts);
    const applied = applyListeningIntentToOptions(baseOpts, 'long-listen-comfort', workspacePolicy, energyPolicy);
    expect(applyListeningIntentIfPending(applied, workspacePolicy, energyPolicy)).toBe(applied);
  });

  it('지시문 24 TASK A-6 우선순위(§하지 말 것 — 다시 짜지 말 것)가 core로 옮긴 뒤에도 그대로 보존된다: genreIds가 이미 user 선택이면 genreIds 자체는 바뀌지 않고 곡수만 바뀐다', () => {
    const userGenreIds = ['piano-ballad', 'adult-contemporary', 'chanson'];
    const withUserGenres = {
      ...baseOpts,
      genreIds: userGenreIds,
      choiceProvenance: { ...baseOpts.choiceProvenance, genreIds: 'user' as const }
    };
    const applied = applyListeningIntentToOptions(withUserGenres, 'era-authentic', LISTENING_INTENT_POLICY['era-authentic'], energyPolicy);
    expect(applied.genreIds).toEqual(userGenreIds);
    expect(applied.choiceProvenance?.genreIds).toBe('user');
  });

  it('applyListeningIntentToOptions은 없앤 것 없이 handleApplyListeningIntent가 예전에 하던 것과 같은 필드만 바꾼다 (channel/songCount 등 무관한 필드는 그대로)', () => {
    const applied = applyListeningIntentToOptions(baseOpts, 'balanced', LISTENING_INTENT_POLICY['balanced'], energyPolicy);
    expect(applied.channel).toBe(baseOpts.channel);
    expect(applied.songCount).toBe(baseOpts.songCount);
    expect(applied.lyricLanguage).toBe(baseOpts.lyricLanguage);
  });
});
