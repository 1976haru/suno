import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadPackBlueprint } from '../scripts/audit';
import { buildStylePromptVariants } from '../scripts/promptLengthTrial';
import { classifyClause, SINGLE_DECLARATION_AXES, type PromptAxis } from '../src/data/promptAxisLexicon';

const FIXTURE_60S = path.resolve(__dirname, 'fixtures/realPack60s.json');

function axesOf(stylePrompt: string): PromptAxis[] {
  return stylePrompt.split(',').map(c => c.trim()).filter(Boolean)
    .map((text, index) => classifyClause(text, index === 0))
    .filter((axis): axis is PromptAxis => Boolean(axis));
}

/**
 * 지시문 16 (TASK A-2) — real fixture regression lock, same convention as
 * tests/excludeLengthTrial.test.ts. The fixture's own real stylePrompt
 * ("...no intro tag, short instrumental breath before final chorus, short
 * intro, 3:10-3:35, full arrangement, not a short cut...") already carries a
 * real intro-axis contradiction (no intro tag = immediate, short intro =
 * has-intro) AND a real arrangementDensity duplicate ("medium arrangement" +
 * "full arrangement, not a short cut") — this is exactly the class of bug
 * short/medium must not inherit just because they're shorter.
 */
describe('[지시문 16 TASK A-2] buildStylePromptVariants — real fixture', () => {
  const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
  if (loaded.blocked) throw new Error('fixture blocked');
  const song = loaded.blueprint.songs[0];

  it('long is the real pack value, unchanged', () => {
    const { long } = buildStylePromptVariants(song.stylePrompt);
    expect(long).toBe(song.stylePrompt);
  });

  it('medium is longer (by word count) than short, for a real multi-clause prompt', () => {
    const { short, medium } = buildStylePromptVariants(song.stylePrompt);
    expect(medium.split(/\s+/).length).toBeGreaterThanOrEqual(short.split(/\s+/).length);
  });

  it('short and medium each keep the 6 position-decidable single-declaration axes present in the original (era/tempo/leadVocal/duration/arrangementDensity — intro is optional, see its own test)', () => {
    const { short, medium } = buildStylePromptVariants(song.stylePrompt);
    for (const axis of ['era', 'tempo', 'leadVocal', 'duration', 'arrangementDensity'] as const) {
      expect(axesOf(short), `short missing ${axis}`).toContain(axis);
      expect(axesOf(medium), `medium missing ${axis}`).toContain(axis);
    }
  });

  it('short and medium never carry two clauses of the same single-declaration axis — the exact bug this directive exists to fix (§1-2 intro contradiction, §1-3 duplicate lead)', () => {
    const { short, medium } = buildStylePromptVariants(song.stylePrompt);
    for (const variant of [short, medium]) {
      const axes = axesOf(variant);
      for (const axis of SINGLE_DECLARATION_AXES) {
        const count = axes.filter(a => a === axis).length;
        expect(count, `${axis} appeared ${count}x in "${variant}"`).toBeLessThanOrEqual(1);
      }
    }
    // 지시문 31 (§2) 이전에는 이 fixture의 "long" 원문 자체가 arrangementDensity
    // 중복("medium arrangement" + "full arrangement, not a short cut")을
    // 그대로 들고 있었다 — scripts/audit.ts의 loadPackBlueprint가
    // reconcileWithPreassignedSlot(core/batchPreallocation.ts)을 거치지
    // 않았기 때문. 지시문 31 (§2-5)가 그 재조립 경로에
    // core/finalPromptNormalizer.ts를 연결해 이제는 loadPackBlueprint 단계
    // 에서부터 이 중복이 사라진다 — "long이 원본 그대로"라는 위 첫 번째
    // it()가 이미 확인하듯 song.stylePrompt 자체(=long)가 이제 정규화된
    // 값이다. 그래서 이 아래 서브테스트는 더 이상 "long은 원시 버그를
    // 보존한다"를 확인할 수 없다 — 대신 정규화 자체가 실제로 이 축을
    // 정리했는지 직접 확인한다.
    const longAxes = axesOf(song.stylePrompt);
    const longArrangementCount = longAxes.filter(a => a === 'arrangementDensity').length;
    expect(longArrangementCount, '지시문 31 정규화 이후 long에도 arrangementDensity 중복이 없어야 한다').toBeLessThanOrEqual(1);
  });

  it('genre (first clause) is always present in every variant', () => {
    const { short, medium, long } = buildStylePromptVariants(song.stylePrompt);
    for (const variant of [short, medium, long]) {
      expect(axesOf(variant)).toContain('genre');
    }
  });
});
