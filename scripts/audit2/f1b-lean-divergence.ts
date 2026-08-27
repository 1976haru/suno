import { channelPresets, genrePacks } from '../../src/data/presets';
import { buildGenreRotationPlan } from '../../src/core/genreRotation';
import { deriveVocalQuotaFromGenrePlan } from '../../src/core/vocalQuotaFromGenre';
import { hashSeed } from '../../src/utils/prng';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { scaleVocalQuota, leaningGenderFor, leaningAdultVocalQuota } from '../../src/core/vocalPlan';
import { recommendVocalPlan } from '../../src/core/vocalRecommender';
import { vocalPresets } from '../../src/data/vocalPresets';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const channel = channelPresets.find(c => c.id === 'headphones-down-low')!;
const genreIds = ['chill-rap', 'lofi-hiphop-study', 'jazz-rap', 'boom-bap-mellow'];
const songCount = 15;

function run(label: string, vocalTone: string) {
  const opts = makeOptions({
    channel, projectTitle: '2026-08-28 헤드폰 세트', songCount, genreIds,
    lyricLanguage: 'english', vocalTone,
  } as Partial<GenerationOptions>) as GenerationOptions;

  // Step2Concept.tsx 재현
  const previewSeed = hashSeed(`${channel.id}:${opts.projectTitle}`);
  const previewPlan = buildGenreRotationPlan(genreIds, songCount, previewSeed);
  const derived = deriveVocalQuotaFromGenrePlan(previewPlan, songCount, channel.archetype);
  const isBalancedTone = !opts.vocalTone?.trim() || opts.vocalTone.trim() === channel.defaultVocal;
  const lean = isBalancedTone ? undefined : leaningGenderFor(opts);
  const resolvedPreview = lean ? leaningAdultVocalQuota(derived, songCount, lean) : scaleVocalQuota(derived, songCount);

  // 실제 생성
  const genres = genrePacks.filter(g => genreIds.includes(g.id));
  const rec = recommendVocalPlan({ channelArchetype: channel.archetype, songCount, vocalQuota: resolvedPreview, seed: previewSeed, genrePlan: previewPlan });
  const planIds = rec.map(r => r.presetId);
  const slots: any[] = preallocateSongSlots({ ...opts, vocalPresetPlan: planIds } as GenerationOptions, genres) as any;
  const actual: Record<string, number> = { male: 0, female: 0, mixed: 0 };
  for (const s of slots) actual[s.vocalType] = (actual[s.vocalType] ?? 0) + 1;
  const srcCounts: Record<string, number> = {};
  for (const s of slots) srcCounts[s.vocalPresetSource ?? 'undefined'] = (srcCounts[s.vocalPresetSource ?? 'undefined'] ?? 0) + 1;
  const planHit = slots.filter((s, i) => s.effectiveVocalPresetId === planIds[i]).length;

  console.log(`\n########## ${label}`);
  console.log('vocalTone            :', vocalTone.slice(0, 60));
  console.log('카드 문구(reasonKo)   :', derived.reasonKo);
  console.log('화면 표시 쿼터(resolved):', JSON.stringify(resolvedPreview));
  console.log('실제 생성 배분        :', JSON.stringify(actual));
  console.log('일치 여부(카드문구 vs 실제):',
    derived.male === actual.male && derived.female === actual.female && derived.mixed === actual.mixed ? 'OK' : '*** 불일치 ***');
  console.log('일치 여부(resolved vs 실제):',
    resolvedPreview.male === actual.male && resolvedPreview.female === actual.female && resolvedPreview.mixed === actual.mixed ? 'OK' : '*** 불일치 ***');
  console.log('vocalPresetSource 분포:', JSON.stringify(srcCounts));
  console.log(`추천 plan이 그대로 실린 트랙: ${planHit}/${songCount}`);
  console.log('effectiveVocalPresetId:', slots.map(s => s.effectiveVocalPresetId ?? '-').join(','));
}

run('A. 보컬 톤 미선택 (채널 기본값 그대로)', channel.defaultVocal);
const malePreset = vocalPresets.find(p => p.id === 'belted-male')!;
run('B. 사용자가 남성 프리셋 선택 (다시 추천 결과 반영과 동일)', malePreset.prompt);
const femPreset = vocalPresets.find(p => p.id === 'bright-clear-female')!;
run('C. 사용자가 여성 프리셋 선택', femPreset.prompt);
