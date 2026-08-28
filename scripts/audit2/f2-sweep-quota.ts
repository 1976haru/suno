/** 전 채널 × 조건별로 Step2 표시값과 실제 생성값을 대조한다. */
import { channelPresets, genrePacks } from '../../src/data/presets';
import { buildGenreRotationPlan } from '../../src/core/genreRotation';
import { deriveVocalQuotaFromGenrePlan } from '../../src/core/vocalQuotaFromGenre';
import { hashSeed } from '../../src/utils/prng';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { scaleVocalQuota, leaningGenderFor, leaningAdultVocalQuota } from '../../src/core/vocalPlan';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const CONCEPTS = ['', '겨울밤 드라이브', '70년대 추억이 느껴지는 올드팝', '숨소리 섞인 목소리로 부르는 칠 딥하우스'];
const rows: string[] = [];
let cardMismatch = 0, resolvedMismatch = 0, planMismatch = 0, total = 0;
const origWarn = console.warn; console.warn = () => {};

for (const channel of channelPresets) {
  for (const concept of CONCEPTS) {
    const songCount = 15;
    const genreIds = channel.preferredGenres.slice(0, 5);
    const opts = makeOptions({
      channel, projectTitle: 'Audit2 Sweep', songCount, genreIds,
      customConcept: concept, vocalTone: channel.defaultVocal,
    } as Partial<GenerationOptions>) as GenerationOptions;

    const previewSeed = hashSeed(`${channel.id}:${opts.projectTitle}`);
    const previewPlan = buildGenreRotationPlan(genreIds, songCount, previewSeed);
    const derived = deriveVocalQuotaFromGenrePlan(previewPlan, songCount, channel.archetype);
    const isBal = !opts.vocalTone?.trim() || opts.vocalTone.trim() === channel.defaultVocal;
    const hasFixed = Boolean(channel.vocalQuotaOverride);
    const lean = hasFixed || isBal ? undefined : leaningGenderFor(opts);
    const base = hasFixed ? channel.vocalQuotaOverride! : derived;
    const resolvedPreview = lean ? leaningAdultVocalQuota(base, songCount, lean) : scaleVocalQuota(base, songCount);

    const genres = genrePacks.filter(g => genreIds.includes(g.id));
    let slots: any[];
    try { slots = preallocateSongSlots(opts, genres) as any; } catch (e) { rows.push(`ERR ${channel.id}|${concept}|${e}`); continue; }
    const actual: Record<string, number> = { male: 0, female: 0, mixed: 0 };
    for (const s of slots) actual[s.vocalType] = (actual[s.vocalType] ?? 0) + 1;
    const actualPlan = slots.map(s => s.effectiveGenreIds?.[0]).join(',');

    total++;
    const cardOK = derived.male === actual.male && derived.female === actual.female && derived.mixed === actual.mixed;
    const resOK = resolvedPreview.male === actual.male && resolvedPreview.female === actual.female && resolvedPreview.mixed === actual.mixed;
    const planOK = previewPlan.join(',') === actualPlan;
    if (!cardOK && !hasFixed) cardMismatch++;
    if (!resOK) resolvedMismatch++;
    if (!planOK) planMismatch++;
    if (!resOK || !planOK) {
      rows.push(`${resOK ? '   ' : 'Q!!'} ${planOK ? '   ' : 'G!!'} ${channel.id}/${channel.archetype} concept="${concept}"`);
      if (!resOK) rows.push(`      화면 ${JSON.stringify(resolvedPreview)}  실제 ${JSON.stringify(actual)}  카드문구 남${derived.male}·여${derived.female}·혼${derived.mixed}`);
      if (!planOK) rows.push(`      미리보기 장르 ${previewPlan.join(',')}\n      실제     장르 ${actualPlan}`);
    }
  }
}
console.warn = origWarn;
console.log(rows.join('\n'));
console.log(`\n총 ${total}건 | 카드문구(reasonKo) 불일치 ${cardMismatch} | 화면 resolved 쿼터 불일치 ${resolvedMismatch} | 장르플랜 불일치 ${planMismatch}`);
