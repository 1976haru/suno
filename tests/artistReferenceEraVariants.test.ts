import { describe, expect, it } from 'vitest';
import { ARTIST_REFERENCE_SEEDS } from '../src/data/artistReferenceSeeds';
import {
  assertNoArtistReferenceLeak,
  decomposeArtistReferences,
  decomposedReferenceDescriptors,
  findArtistReferenceLeaks
} from '../src/core/artistReferenceDecomposer';
import { recommendConceptLocal } from '../src/core/conceptAgent';
import { genrePacks } from '../src/data/presets';

/**
 * 지시문 60 — 하루가 겪은 실측: "비지스 느낌의 감미로운 발라드"를 입력했는데
 * 시드가 1975~79년 디스코 시기 하나만 정의하고 있어 디스코가 나왔다. TASK A/B
 * 는 시기별 variants를 추가하고, 같은 문장 안의 사용자 수식어로 그 variant를
 * 고르게 한다.
 */
describe('[지시문 60 TASK A/B] artist reference era variants', () => {
  const VARIANT_ALIAS_PATTERNS = ['bee gees', 'beatles', 'abba', 'elton john', 'stevie wonder', 'fleetwood mac'];

  it('exactly the 6 prioritized artists carry a `variants` entry', () => {
    const withVariants = ARTIST_REFERENCE_SEEDS.filter(seed => seed.variants?.length);
    expect(withVariants.length).toBeGreaterThanOrEqual(6);
    for (const pattern of VARIANT_ALIAS_PATTERNS) {
      const seed = ARTIST_REFERENCE_SEEDS.find(s => s.aliasPattern.includes(pattern));
      expect(seed?.variants?.length, pattern).toBeGreaterThan(0);
    }
  });

  it('인수 기준 — "비지스 느낌의 감미로운 발라드" decomposes to the 1960s ballad era, not disco', () => {
    const [ref] = decomposeArtistReferences('비지스 느낌의 감미로운 발라드');
    expect(ref.eraTag).toBe('late-1960s orchestral pop ballad');
    expect(ref.eraTag).not.toContain('disco');
    expect(ref.suggestedGenreIds).toContain('oldpop-piano-ballad-70s');
    expect(ref.reasonKo).toBeTruthy();
    expect(ref.alternateHintKo).toContain('디스코');
  });

  it('회귀 확인 — "비지스" 단독 입력은 기본 동작(디스코)을 그대로 유지한다', () => {
    const [ref] = decomposeArtistReferences('비지스');
    expect(ref.eraTag).toBe('late-1970s falsetto disco pop');
    expect(ref.reasonKo).toBeUndefined();
    expect(ref.alternateHintKo).toBeUndefined();
  });

  it('B-2 — the modifier can sit before OR after the artist name, in the same sentence', () => {
    const cases = ['비지스 느낌의 감미로운 발라드', '감미로운 발라드, 비지스 스타일', '잔잔한 비지스'];
    for (const text of cases) {
      const [ref] = decomposeArtistReferences(text);
      expect(ref.eraTag, text).toBe('late-1960s orchestral pop ballad');
    }
  });

  it('B-3 — no trigger word anywhere falls back to the seed default, unchanged', () => {
    const [ref] = decomposeArtistReferences('비지스 디스코');
    expect(ref.eraTag).toBe('late-1970s falsetto disco pop');
  });

  it('D-2 — "비틀즈 초기" stays on the default era; "비틀즈 후기 발라드" switches to the late-60s variant', () => {
    const early = decomposeArtistReferences('비틀즈 초기')[0];
    expect(early.eraTag).toBe('mid-1960s British beat pop');

    const late = decomposeArtistReferences('비틀즈 후기 발라드')[0];
    expect(late.eraTag).toContain('psychedelic');
  });

  it('D-2 — "엘튼 존 80년대" switches to the 1980s adult-contemporary variant', () => {
    const [ref] = decomposeArtistReferences('엘튼 존 80년대');
    expect(ref.eraTag).toBe('1980s adult-contemporary pop ballad');
  });

  it('recommendConceptLocal routes "비지스 느낌의 감미로운 발라드" to ballad-era oldpop genres, not the disco defaults', () => {
    const result = recommendConceptLocal('비지스 느낌의 감미로운 발라드', 'senior-morning');
    const ids = result.recommendations[0]?.genreAllocation.map(slot => slot.genreId) ?? [];
    expect(ids).toContain('oldpop-orchestral-easy');
    expect(ids).not.toContain('oldpop-europop-glow');
    expect(ids).not.toContain('oldpop-philly-soul-sweet');
  });

  it('every variant\'s suggestedGenreIds resolve to a real genrePacks entry', () => {
    const allIds = new Set(genrePacks.map(g => g.id));
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      for (const variant of seed.variants ?? []) {
        for (const id of variant.suggestedGenreIds) {
          expect(allIds.has(id), `${seed.aliasPattern} variant: ${id}`).toBe(true);
        }
      }
    }
  });

  it('no variant\'s musical-descriptor fields leak any seed\'s detectable name', () => {
    const violations: string[] = [];
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      for (const variant of seed.variants ?? []) {
        const descriptorText = [
          variant.eraTag,
          ...variant.instrumentation,
          ...variant.harmonyTraits,
          ...variant.rhythmTraits,
          ...variant.productionTraits,
          ...variant.vocalTraits
        ].join(', ');
        const leaks = findArtistReferenceLeaks(descriptorText);
        if (leaks.length) violations.push(`${seed.aliasPattern}: ${leaks.map(l => l.surface).join(', ')}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

/**
 * 지시문 60 TASK C — 아티스트명·곡 제목 유출 방지는 그대로 유지된다.
 * reasonKo/alternateHintKo는 decomposedReferenceDescriptors에 포함되지 않으므로
 * 애초에 stylePrompt 조립 경로(artistReferenceStyleAtoms, Step2Concept.tsx)에
 * 들어갈 수 없다 — 구조적으로 화면 전용이다.
 */
describe('[지시문 60 TASK C] reasonKo/alternateHintKo never reach the prompt-safe descriptor set', () => {
  it('decomposedReferenceDescriptors excludes reasonKo and alternateHintKo', () => {
    const [ref] = decomposeArtistReferences('비지스 느낌의 감미로운 발라드');
    expect(ref.reasonKo).toBeTruthy();
    const descriptors = decomposedReferenceDescriptors(ref);
    expect(descriptors.join(' | ')).not.toContain(ref.reasonKo);
    expect(descriptors.join(' | ')).not.toContain(ref.alternateHintKo ?? '__none__');
  });

  it('assertNoArtistReferenceLeak still throws on a raw artist name regardless of variants', () => {
    expect(() => assertNoArtistReferenceLeak('warm ballad, 비지스 느낌, string section')).toThrow();
  });

  it('a full decomposed-descriptor style prompt for the ballad variant carries no artist name or leak', () => {
    const [ref] = decomposeArtistReferences('비지스 느낌의 감미로운 발라드');
    const prompt = decomposedReferenceDescriptors(ref).join(', ');
    expect(() => assertNoArtistReferenceLeak(prompt)).not.toThrow();
  });
});
