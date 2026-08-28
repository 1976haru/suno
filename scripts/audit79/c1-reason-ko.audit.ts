/** 지시문 79 §7-9 — 카드 문구가 실제 생성값과 일치하는지 (2차 감사 §1의 세트 그대로). */
import { it } from 'vitest';
import { channelPresets, genrePacks } from '../../src/data/presets';
import { buildGenreRotationPlan } from '../../src/core/genreRotation';
import { deriveVocalQuotaFromGenrePlan } from '../../src/core/vocalQuotaFromGenre';
import { hashSeed } from '../../src/utils/prng';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { scaleVocalQuota, leaningGenderFor, leaningAdultVocalQuota } from '../../src/core/vocalPlan';
import { vocalPresets } from '../../src/data/vocalPresets';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('reasonKo card text matches generated quota', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const channel = channelPresets.find(c => c.id === 'headphones-down-low')!;
  const genreIds = ['chill-rap', 'lofi-hiphop-study', 'jazz-rap', 'boom-bap-mellow'];
  const songCount = 15;

  const run = (label: string, vocalTone: string) => {
    const opts = makeOptions({ channel, projectTitle: '2026-08-28 헤드폰 세트', songCount, genreIds, vocalTone } as Partial<GenerationOptions>) as GenerationOptions;
    const seed = hashSeed(`${channel.id}:${opts.projectTitle}`);
    const plan = buildGenreRotationPlan(genreIds, songCount, seed);
    const derived = deriveVocalQuotaFromGenrePlan(plan, songCount, channel.archetype);
    const isBal = !opts.vocalTone?.trim() || opts.vocalTone.trim() === channel.defaultVocal;
    const lean = isBal ? undefined : leaningGenderFor(opts);
    const resolved = lean ? leaningAdultVocalQuota(derived, songCount, lean) : scaleVocalQuota(derived, songCount);

    // Step2Concept.tsx의 genreQuotaDescriptionKo와 같은 조립.
    const cardKo = derived.genreSummaryKo
      ? `선택하신 장르 구성(${derived.genreSummaryKo})에서 계산했습니다 — 남성 ${resolved.male}곡 · 여성 ${resolved.female}곡 · 듀엣 ${resolved.mixed}곡.`
      : '(장르 선호 정보 없음)';

    const slots = preallocateSongSlots(opts, genrePacks.filter(g => genreIds.includes(g.id))) as unknown as Array<{ vocalType: string }>;
    const actual: Record<string, number> = { male: 0, female: 0, mixed: 0 };
    for (const s of slots) actual[s.vocalType] = (actual[s.vocalType] ?? 0) + 1;

    const ok = resolved.male === actual.male && resolved.female === actual.female && resolved.mixed === actual.mixed;
    console.log(`\n##### ${label}`);
    console.log(`  카드 문구 : ${cardKo}`);
    console.log(`  실제 생성 : 남성 ${actual.male}곡 · 여성 ${actual.female}곡 · 듀엣 ${actual.mixed}곡`);
    console.log(`  일치 여부 : ${ok ? 'OK' : '*** 불일치 ***'}`);
  };

  run('A. 보컬 톤 미선택 (채널 기본값)', channel.defaultVocal);
  run('B. 남성 프리셋 선택 (belted-male)', vocalPresets.find(p => p.id === 'belted-male')!.prompt);
  run('C. 여성 프리셋 선택 (bright-clear-female)', vocalPresets.find(p => p.id === 'bright-clear-female')!.prompt);
  console.warn = origWarn;
});
