import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { recommendVocalPlan } from '../src/core/vocalRecommender';
import { buildGenreRotationPlan } from '../src/core/genreRotation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { GenerationOptions } from '../src/types';

/**
 * 지시문 56 (TASK A/D) — 8/14 P0 회귀 재발 방지 테스트. 실측된 결함: 프리셋이
 * 걸린 트랙(vocalPresetOverride)은 buildAdultVocalTraitPlan을 완전히
 * 건너뛰고 preset.prompt 고정 문구를 그대로 썼다 — 같은 프리셋을 쓰는
 * 트랙끼리 vocalText 앞 두 구절이 완전히 같아졌다(발라드 세트 15곡 중
 * soft-female 3곡 실측, "6070 감성 돌아왔다"였던 8/13 카페 세트는
 * 15/15 고유). presetVariantVocalText(batchPreallocation.ts/
 * localGenerator.ts)로 고친 뒤: preset.prompt의 첫 구절(정체성)만 고정하고
 * 나머지(딜리버리·질감·공간감)는 adultVocalTraitPlan이 곡마다 만든 변주를
 * 쓴다. 인수 기준(§D-2 "1번이 인수 기준") — 같은 프리셋을 쓰는 곡들도
 * vocalText가 서로 달라야 하고, 팩 전체 15/15가 고유해야 한다.
 */
function vocalPresetPlanFor(opts: GenerationOptions, seed: number): (string | undefined)[] {
  const genrePlan = buildGenreRotationPlan(opts.genreIds, opts.songCount, seed);
  const preview = recommendVocalPlan({
    channelArchetype: opts.channel.archetype,
    songCount: opts.songCount,
    vocalQuota: { male: 5, female: 5, mixed: 5 },
    seed,
    genrePlan
  });
  return preview.map(rec => rec.presetId || undefined);
}

/** 같은 프리셋을 공유하는 트랙끼리 vocalText가 서로 다른지, 그리고 팩
 * 전체가 15/15 고유한지 확인한다. 두 세대 경로(로컬/배치) 모두 검사한다. */
function assertVocalTextDiversity(vocalTexts: (string | undefined)[], vocalPresetPlan: (string | undefined)[], label: string) {
  expect(vocalTexts.every(text => Boolean(text?.trim())), `${label}: vocalText가 비어 있는 트랙이 있음`).toBe(true);
  const nonEmpty = vocalTexts.filter((text): text is string => Boolean(text));
  expect(new Set(nonEmpty).size, `${label}: vocalText 전체 고유성`).toBe(nonEmpty.length);

  const byPreset = new Map<string, string[]>();
  vocalPresetPlan.forEach((presetId, idx) => {
    if (!presetId) return;
    const text = vocalTexts[idx];
    if (!text) return;
    if (!byPreset.has(presetId)) byPreset.set(presetId, []);
    byPreset.get(presetId)!.push(text);
  });
  for (const [presetId, texts] of byPreset) {
    if (texts.length > 1) {
      expect(new Set(texts).size, `${label}: 프리셋 "${presetId}"를 공유하는 ${texts.length}곡의 vocalText 고유성`).toBe(texts.length);
    }
  }
}

describe('지시문 56 TASK A/D — vocalPresetOverride 트랙의 vocalText 곡별 고유성 (8/14 회귀 재발 방지)', () => {
  const seeds = [1, 2, 3, 4, 5];

  it('로컬 생성 경로(generateLocalBlueprint): 같은 프리셋을 쓰는 트랙도 vocalText가 서로 다르다', () => {
    for (const seed of seeds) {
      const opts = makeOptions({ songCount: 15 });
      const vocalPresetPlan = vocalPresetPlanFor(opts, seed);
      const optsWithPlan = { ...opts, vocalPresetPlan };
      const blueprint = generateLocalBlueprint(optsWithPlan, testGenres, testMoods, testSeason);
      const vocalTexts = blueprint.songs.map(s => s.vocalText);
      assertVocalTextDiversity(vocalTexts, vocalPresetPlan, `local seed=${seed}`);
    }
  });

  it('배치/브릿지 경로(preallocateSongSlots + reconcileWithPreassignedSlot): 같은 프리셋을 쓰는 트랙도 vocalText가 서로 다르고, 최종 팩까지 살아남는다', () => {
    for (const seed of seeds) {
      const opts = makeOptions({ songCount: 15 });
      const vocalPresetPlan = vocalPresetPlanFor(opts, seed);
      const optsWithPlan = { ...opts, vocalPresetPlan };
      const slots = preallocateSongSlots(optsWithPlan, testGenres);
      const slotVocalTexts = slots.map(s => s.vocalText);
      assertVocalTextDiversity(slotVocalTexts, vocalPresetPlan, `slot seed=${seed}`);

      // 슬롯 -> 최종 SongIdea 왕복(TASK A-4/B-3)까지 함께 검사한다.
      const songs = slots.map(slot => reconcileWithPreassignedSlot(
        { trackNo: slot.trackNo, title: 'x', seasonMoment: 'x', listenerSituation: 'x', emotionArc: 'x', hookPhrase: slot.hookPhrase, stylePrompt: 'placeholder', lyrics: '[chorus]\nx\nx', youtube: { title: 'yt', description: 'd', tags: [] }, qualityScore: 0, warnings: [], effectiveMoneyChordId: 'default', effectiveGenreIds: [] },
        slot,
        'local',
        { archetype: opts.channel.archetype, lyricLanguage: opts.lyricLanguage }
      ));
      const songVocalTexts = songs.map(s => s.vocalText);
      assertVocalTextDiversity(songVocalTexts, vocalPresetPlan, `song(reconciled) seed=${seed}`);
      expect(songVocalTexts, `song seed=${seed}: vocalText 슬롯 왕복`).toEqual(slotVocalTexts);
    }
  });
});
