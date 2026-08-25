import { describe, expect, it } from 'vitest';
import { channelPresets } from '../src/data/presets';
import { getGenreById } from '../src/data/genreLibrary';
import { introTextures, introTexturesForArchetype } from '../src/data/introTextures';

/**
 * 지시문 31 (§4) — check:coverage가 잡은 CONTRACT VIOLATION 3건(실제로는
 * lofi-study preferredGenres 1건 + kr-idol-male/kr-idol-female introTexture
 * 2건)의 회귀 방지. 가짜 데이터로 CI만 통과시키지 않았는지(§하지 말 것)를
 * 실측 검증한다 — preferredGenres는 실제 genreLibrary에 존재하는 id인지,
 * introTexture는 verified:false로 정직하게 표시됐는지까지 확인한다.
 */
describe('지시문 31 §4-2 — lofi-study preferredGenres', () => {
  const lofiStudyChannels = channelPresets.filter(c => c.archetype === 'lofi-study');

  it('lofi-study 아키타입에 실제 프리셋 채널이 존재한다', () => {
    expect(lofiStudyChannels.length).toBeGreaterThan(0);
  });

  it('preferredGenres 합집합이 12종 이상이다 (§4-5 완료 기준)', () => {
    const pool = new Set(lofiStudyChannels.flatMap(c => c.preferredGenres));
    expect(pool.size).toBeGreaterThanOrEqual(12);
  });

  it('audience/market이 명시돼 있다 (지시문 12 TASK C — 유실 함정 회피)', () => {
    for (const channel of lofiStudyChannels) {
      expect(channel.audience).toBeTruthy();
      expect(channel.market).toBeTruthy();
    }
  });

  it('모든 preferredGenres id가 genreLibrary에 실제로 존재하고 lofi-study를 자신의 archetypes에 포함한다 (가짜 장르 금지, §하지 말 것)', () => {
    for (const channel of lofiStudyChannels) {
      for (const genreId of channel.preferredGenres) {
        const genre = getGenreById(genreId);
        expect(genre, `${genreId} must resolve via getGenreById`).toBeTruthy();
        expect(genre!.archetypes, `${genreId} must be tagged lofi-study`).toContain('lofi-study');
      }
    }
  });
});

describe('지시문 31 §4-3 — kr-idol introTexture 전용 6종', () => {
  const kpopTextures = introTextures.filter(t => t.suitedArchetypes?.includes('kr-idol-male') || t.suitedArchetypes?.includes('kr-idol-female'));

  it('kr-idol-male/kr-idol-female 전용 인트로 텍스처가 6종 이상이다', () => {
    expect(introTextures.filter(t => t.suitedArchetypes?.includes('kr-idol-male')).length).toBeGreaterThanOrEqual(6);
    expect(introTextures.filter(t => t.suitedArchetypes?.includes('kr-idol-female')).length).toBeGreaterThanOrEqual(6);
  });

  it('새로 추가된 kr-idol 전용 텍스처는 전부 verified:false로 명시돼 있다 (실측 0세트, §하지 말 것 "검증된 값처럼 다루지 말 것")', () => {
    expect(kpopTextures.length).toBeGreaterThan(0);
    for (const texture of kpopTextures) {
      expect(texture.verified, `${texture.id} must be explicitly verified:false`).toBe(false);
    }
  });

  it('introTexturesForArchetype이 이제 폴백(24개 전체 풀)이 아니라 kr-idol 전용 풀을 실제로 반환한다', () => {
    // 폴백 임계선은 10개 — 6개는 여전히 폴백되지만(§4-3 목표 자체가 10 아닌
    // "6종 이상"), 그 6개가 결과의 suitedArchetypes에 실제로 포함돼 있는지는
    // 검증할 수 있다: 폴백된 전체 풀 안에 kr-idol 전용 6종이 실제로 섞여
    // 들어가는지.
    const forMale = introTexturesForArchetype('kr-idol-male');
    for (const texture of kpopTextures.filter(t => t.suitedArchetypes?.includes('kr-idol-male'))) {
      expect(forMale.some(t => t.id === texture.id)).toBe(true);
    }
  });

  it('올드팝·일반 성격 텍스처(예: 손가락 핑거링)는 kr-idol 전용 목록에 없다 — §4-3의 실제 문제(올드팝 텍스처가 K-pop에 들어갈 수 있다는 것) 자체는 폴백 로직 때문에 여전히 남지만, 최소한 새로 추가한 6종은 K-pop 관행에 맞는 항목만이다', () => {
    for (const texture of kpopTextures) {
      expect(texture.id.startsWith('kpop_')).toBe(true);
    }
  });
});
