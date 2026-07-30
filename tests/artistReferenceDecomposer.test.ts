import { describe, expect, it } from 'vitest';
import { ARTIST_REFERENCE_SEEDS } from '../src/data/artistReferenceSeeds';
import {
  assertNoArtistReferenceLeak,
  decomposeArtistReferences,
  decomposedReferenceDescriptors,
  findArtistReferenceLeaks,
  isSafeDecomposedReference,
  type DecomposedReference
} from '../src/core/artistReferenceDecomposer';

describe('[v3.58 TASK 3] decomposeArtistReferences', () => {
  it('detects a Korean-phrased reference and returns generic era/musical traits, never the artist name', () => {
    const results = decomposeArtistReferences('비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝');
    expect(results.length).toBeGreaterThan(0);
    const beatles = results.find(ref => ref.eraTag.includes('British beat pop'));
    expect(beatles).toBeTruthy();
    expect(beatles!.matchedSurface).toContain('비틀즈');
    for (const descriptor of decomposedReferenceDescriptors(beatles!)) {
      expect(descriptor.toLowerCase()).not.toContain('beatles');
      expect(descriptor).not.toContain('비틀즈');
    }
  });

  it('detects an English-phrased reference case-insensitively', () => {
    const results = decomposeArtistReferences('give me something in the style of the Beatles');
    expect(results.some(ref => ref.eraTag.includes('British beat pop'))).toBe(true);
  });

  it('detects multiple references in one input', () => {
    const results = decomposeArtistReferences('비틀즈랑 카펜터스 느낌 섞어서');
    expect(results.length).toBe(2);
  });

  it('returns [] for input with no recognizable reference', () => {
    expect(decomposeArtistReferences('아침에 커피와 함께 듣고 싶은 올드팝')).toEqual([]);
    expect(decomposeArtistReferences('')).toEqual([]);
  });

  it('every seed maps to at least one real genre id used elsewhere in the library', () => {
    // Loaded lazily to avoid a hard circular-import risk between data modules.
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      expect(seed.suggestedGenreIds.length, seed.aliasPattern).toBeGreaterThan(0);
    }
  });

  it('every seed\'s excludeAdditions reads as an imitation-avoidance phrase, never a bare name', () => {
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      expect(seed.excludeAdditions.length, seed.aliasPattern).toBeGreaterThan(0);
      for (const phrase of seed.excludeAdditions) {
        expect(phrase, seed.aliasPattern).toMatch(/imitation|soundalike|copied/i);
      }
    }
  });
});

describe('[v3.58 TASK 3] artist-name leak guard', () => {
  it('flags a style prompt that still contains a detected artist name', () => {
    const leaks = findArtistReferenceLeaks('warm nostalgic pop, in the style of the Beatles, jangly guitars');
    expect(leaks.length).toBeGreaterThan(0);
  });

  it('assertNoArtistReferenceLeak throws when a name is present', () => {
    expect(() => assertNoArtistReferenceLeak('jangly guitars, 비틀즈 느낌, tambourine backbeat')).toThrow();
  });

  it('assertNoArtistReferenceLeak does not throw for clean decomposed descriptors', () => {
    const [ref] = decomposeArtistReferences('비틀즈 스타일로');
    const prompt = decomposedReferenceDescriptors(ref).join(', ');
    expect(() => assertNoArtistReferenceLeak(prompt)).not.toThrow();
  });

  it('does not false-positive on ordinary style-prompt vocabulary', () => {
    const ordinaryPrompt = 'warm adult contemporary pop, sustained piano pads, clean strummed acoustic guitar, mature soulful male tenor, 96 BPM';
    expect(findArtistReferenceLeaks(ordinaryPrompt)).toEqual([]);
  });

  it('no seed\'s own musical-descriptor fields accidentally contain ANY seed\'s detectable name (self-consistency across the whole table)', () => {
    const violations: string[] = [];
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      const descriptorText = [
        seed.eraTag,
        ...seed.instrumentation,
        ...seed.harmonyTraits,
        ...seed.rhythmTraits,
        ...seed.productionTraits,
        ...seed.vocalTraits
      ].join(', ');
      const leaks = findArtistReferenceLeaks(descriptorText);
      if (leaks.length) violations.push(`${seed.aliasPattern}: ${leaks.map(l => l.surface).join(', ')}`);
    }
    expect(violations).toEqual([]);
  });
});

describe('[v3.58 TASK 3] isSafeDecomposedReference (LLM-path validation)', () => {
  const base: DecomposedReference = {
    matchedSurface: '비틀즈 스타일로',
    eraTag: 'mid-1960s British beat pop',
    instrumentation: ['jangly 12-string electric guitar'],
    harmonyTraits: ['major-key verses with a borrowed chord'],
    rhythmTraits: ['driving eighth-note strum'],
    productionTraits: ['narrow warm mono-leaning mix'],
    vocalTraits: ['two-part male harmony'],
    suggestedGenreIds: ['folk-pop'],
    excludeAdditions: ['famous band imitation']
  };

  it('accepts a clean decomposition', () => {
    expect(isSafeDecomposedReference(base)).toBe(true);
  });

  it('rejects a decomposition whose LLM-authored trait leaked the artist name', () => {
    const tainted: DecomposedReference = { ...base, vocalTraits: ['sounds just like the Beatles'] };
    expect(isSafeDecomposedReference(tainted)).toBe(false);
  });
});
