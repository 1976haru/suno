/**
 * 감사 2차 §1 재현 — Step2 미리보기 쿼터 vs 실제 생성 쿼터.
 * src/ 는 한 줄도 수정하지 않는다. 읽기 전용 재현.
 */
import { channelPresets, genrePacks } from '../../src/data/presets';
import { buildGenreRotationPlan } from '../../src/core/genreRotation';
import { deriveVocalQuotaFromGenrePlan, resolveBaseVocalQuota } from '../../src/core/vocalQuotaFromGenre';
import { hashSeed } from '../../src/utils/prng';
import { seedForBlueprint } from '../../src/core/lyricEngine';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { scaleVocalQuota, leaningGenderFor, leaningAdultVocalQuota } from '../../src/core/vocalPlan';
import { recommendVocalPlan } from '../../src/core/vocalRecommender';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const channel = channelPresets.find(c => c.id === 'headphones-down-low')!;
const genreIds = ['chill-rap', 'lofi-hiphop-study', 'jazz-rap', 'boom-bap-mellow'];
const songCount = 15;

const opts: GenerationOptions = makeOptions({
  channel,
  projectTitle: '2026-08-28 헤드폰 세트',
  songCount,
  genreIds,
  lyricLanguage: 'english',
  vocalTone: channel.defaultVocal,
  vocalQuota: undefined,
  vocalQuotaMode: undefined,
} as Partial<GenerationOptions>);

// ---- Step2Concept.tsx 재현 (291/292행, 300행, 330행) ----
const previewSeed = hashSeed(`${channel.id}:${opts.projectTitle}`);
const previewGenrePlan = buildGenreRotationPlan(genreIds, songCount, previewSeed);
const genreDerivedQuota = deriveVocalQuotaFromGenrePlan(previewGenrePlan, songCount, channel.archetype);
const balancedPreview = scaleVocalQuota(genreDerivedQuota, songCount);
const leaning = leaningGenderFor(opts);
const resolvedPreview = leaning ? leaningAdultVocalQuota(genreDerivedQuota, songCount, leaning) : balancedPreview;

console.log('=== Step2 미리보기 ===');
console.log('previewSeed        :', previewSeed);
console.log('previewGenrePlan   :', previewGenrePlan.join(','));
console.log('genreDerivedQuota  :', JSON.stringify({ m: genreDerivedQuota.male, f: genreDerivedQuota.female, x: genreDerivedQuota.mixed }));
console.log('reasonKo(화면 문구) :', genreDerivedQuota.reasonKo);
console.log('leaningGenderFor   :', leaning);
console.log('화면 표시 쿼터      :', JSON.stringify(resolvedPreview));

// ---- 실제 생성 경로 재현 ----
const genSeed = hashSeed(seedForBlueprint(opts));
console.log('\n=== 실제 생성 ===');
console.log('generationSeed     :', genSeed, '(미리보기 시드와 같은가:', genSeed === previewSeed, ')');

const genres = genrePacks.filter(g => genreIds.includes(g.id));
const slots = preallocateSongSlots(opts, genres);
const actual = { male: 0, female: 0, mixed: 0 } as Record<string, number>;
for (const s of slots) actual[(s as any).vocalType] = (actual[(s as any).vocalType] ?? 0) + 1;
console.log('실제 배분(slots)    :', JSON.stringify(actual));
console.log('실제 genrePlan      :', slots.map((s: any) => s.genreIds?.[0] ?? s.genreId).join(','));

// ---- vocalPresetPlan 왕복 ----
const recPreview = recommendVocalPlan({
  channelArchetype: channel.archetype, songCount,
  vocalQuota: resolvedPreview, seed: previewSeed, genrePlan: previewGenrePlan
});
const planIds = recPreview.map(r => r.presetId);
const optsWithPlan = { ...opts, vocalPresetPlan: planIds } as GenerationOptions;
const slots2 = preallocateSongSlots(optsWithPlan, genres);
const actual2 = { male: 0, female: 0, mixed: 0 } as Record<string, number>;
for (const s of slots2) actual2[(s as any).vocalType] = (actual2[(s as any).vocalType] ?? 0) + 1;
console.log('\n=== vocalPresetPlan 적용 후 ===');
console.log('추천 프리셋 순서    :', planIds.join(','));
console.log('실제 배분           :', JSON.stringify(actual2));
const applied = slots2.filter((s: any, i: number) => s.vocalPresetId && s.vocalPresetId === planIds[i]).length;
console.log(`추천 프리셋이 그대로 실린 트랙: ${applied}/${songCount}`);
console.log('slot.vocalPresetId  :', slots2.map((s: any) => s.vocalPresetId ?? '-').join(','));
