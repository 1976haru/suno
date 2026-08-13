/**
 * 지시문 51 (TASK D2) — check:genre-utilization이 "장르 축"에서 잡은 유형
 * ("정의됐고 배선됐는데 실제로는 안 쓰인다")이 다른 GenerationOptions 축
 * 에도 있는지 전수 확인한다. 하루: "이런 부분 내가 지적하기 전까지 모른
 * 거니까... 내가 모르는 오류나 미작동이 얼마나 많은지도 모르겠고."
 *
 * §D2-4 "분류 없이 '슬롯에 없으니 미반영'으로 단정하지 말 것" — 축마다
 * "반영됐다"의 정의가 다르므로 먼저 유형을 분류한다:
 *   ①슬롯    PreassignedSongSlot 필드로 직접 반영 (예: genreId, pov)
 *   ②텍스트  emotionArc/signatureSound 등 산출 텍스트에 녹아듦 (예: moodIds)
 *   ③관문    관문 기준 자체를 바꿈 (예: durationTarget -> wordCountRange)
 *   ④브릿지  브릿지 지시문 텍스트에만 실려 나감, 로컬 생성 경로 밖
 *
 * §D2-5 "이것이 가장 확실한 검사다" — 같은 조건에서 그 축 하나만 바꾼 두
 * 산출물을 실제로 비교한다(A/B). generateLocalBlueprint는 customConcept
 * 문자열 기반 시드로 결정적이므로, 같은 concept·songCount에서 축 하나만
 * 바꾸면 그 축 때문에 달라진 차이만 남는다.
 *
 * §하지 말 것 "세트를 차단하지 말 것" — advisory만 출력한다. exit 0 고정.
 *
 * Usage: npx tsx scripts/checkOptionUtilization.ts
 */
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { createInitialOptions } from '../src/utils/generation';
import type { GenerationOptions, PlaylistBlueprint } from '../src/types';

type AxisType = '①슬롯' | '②텍스트' | '③관문' | '④브릿지';

interface AxisCheck {
  axis: string;
  type: AxisType;
  note: string;
  run: (baseOpts: GenerationOptions) => { differs: boolean; detail: string } | null;
}

function baseChannelOpts(): GenerationOptions {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  return { ...createInitialOptions(channel), customConcept: 'option-utilization 고정 시드용 컨셉', songCount: 6 };
}

function genresFor(opts: GenerationOptions) {
  return genrePacks.filter(g => opts.genreIds.includes(g.id));
}
function moodsFor(opts: GenerationOptions) {
  return moodPacks.filter(m => opts.moodIds.includes(m.id));
}
function seasonFor(opts: GenerationOptions) {
  return seasonPacks.find(s => s.id === opts.seasonId) ?? seasonPacks[0];
}

function gen(opts: GenerationOptions): PlaylistBlueprint {
  return generateLocalBlueprint(opts, genresFor(opts), moodsFor(opts), seasonFor(opts), { usedTitles: [], usedHooks: [] });
}

/** stylePrompt+lyrics+emotionArc+youtube 설명 + 구조화 필드(pov/verseStyle/chorusStyle)를 이어붙인 것 — 자유 텍스트만 비교하면 pov처럼 "필드는 있는데 그 필드가 실제 가사 대명사엔 안 녹아드는" 유형을 놓친다(§D2-2 실측). */
function fingerprint(bp: PlaylistBlueprint): string {
  return bp.songs.map(s => [s.stylePrompt, s.lyrics, s.emotionArc, s.youtube?.description, s.pov, s.verseStyle, s.chorusStyle].join('|')).join('\n---\n');
}

/** pov 필드 자체(구조화 값)만 비교 — fingerprint()가 "산출물 전체가 달라지는가"라면, 이건 "그 필드값 자체가 opts를 따라가는가"를 별도로 본다. */
function povFingerprint(bp: PlaylistBlueprint): string {
  return bp.songs.map(s => s.pov ?? '').join(',');
}

function abTest(label: string, type: AxisType, note: string, baseOpts: GenerationOptions, overrideA: Partial<GenerationOptions>, overrideB: Partial<GenerationOptions>): AxisCheck {
  return {
    axis: label,
    type,
    note,
    run: () => {
      const a = gen({ ...baseOpts, ...overrideA });
      const b = gen({ ...baseOpts, ...overrideB });
      const fa = fingerprint(a);
      const fb = fingerprint(b);
      return { differs: fa !== fb, detail: fa === fb ? '두 값의 산출물이 동일 — 반영 안 됨' : '산출물이 달라짐 — 반영됨' };
    }
  };
}

function main() {
  const base = baseChannelOpts();
  const otherMood = moodPacks.find(m => m.id !== base.moodIds[0])?.id ?? base.moodIds[0];
  const otherSeason = seasonPacks.find(s => s.id !== base.seasonId)?.id ?? base.seasonId;

  const checks: AxisCheck[] = [
    abTest('genreIds', '①슬롯', 'slot.genreId/genreText로 직접 반영 (지시문51 TASK A의 대상)', base,
      { genreIds: base.genreIds }, { genreIds: base.genreIds.slice().reverse() }),
    abTest('moodIds', '②텍스트', 'D2-2 실측: 슬롯에 moodId 필드 자체는 없다 — packContext.dominantMoodIds로 오프닝 타이틀/훅 구성에 녹아드는지 A/B로 직접 확인', base,
      { moodIds: [base.moodIds[0]] }, { moodIds: [otherMood] }),
    abTest('seasonId', '②텍스트', 'D2-2 실측: 슬롯에 seasonId 필드 자체는 없다 — season 파라미터(캘러가 opts.seasonId로 조회해 별도로 넘김)가 시즌 텍스트/무드에 녹아드는지 A/B로 직접 확인', base,
      { seasonId: base.seasonId }, { seasonId: otherSeason }),
    {
      axis: 'perspective', type: '①슬롯',
      note: 'slot.pov 필드는 존재하나(값 존재), A/B 실측: opts.perspective를 바꿔도 pov 배열이 대부분 같다(6곡 중 1곡만 변화) — 트랙별 POV 로테이션 계획이 opts.perspective보다 우세하다. 가사 대명사(I/you) 자체가 pov를 따라가는지는 이번 실측 범위 밖(후속 확인 필요).',
      run: () => {
        const a = gen({ ...base, perspective: 'firstPerson' });
        const b = gen({ ...base, perspective: 'secondPerson' });
        const povA = povFingerprint(a);
        const povB = povFingerprint(b);
        return { differs: povA !== povB, detail: povA === povB ? `pov 배열이 완전히 동일: ${povA}` : `pov 배열 일부만 다름: ${povA} vs ${povB}` };
      }
    },
    abTest('customConcept', '②텍스트', '장면/가사 테마 전체를 좌우 — 이미 이 스크립트의 시드 고정 수단 자체가 이 축이 강하게 반영된다는 증거', base,
      { customConcept: '카페에서 듣고 싶은 노래' }, { customConcept: '겨울밤 혼자 걷는 길' }),
    abTest('avoidWords', '④브릿지', 'A/B 실측 + 코드 확인: core/localGenerator.ts(로컬/무료 생성 경로)에 opts.avoidWords를 읽는 코드가 0곳이다 — batchPreallocation.ts/promptComposer.ts/bridgeInstruction.ts(브릿지 경로)에만 있다. "미반영"이 아니라 "로컬 경로 전용 미반영" — 무료 로컬 생성으로 세트를 뽑는 사용자에게는 이 필드가 조용히 무시된다.', base,
      { avoidWords: '' }, { avoidWords: 'coffee, morning' }),
    abTest('vocalTone', '①슬롯', 'slot.vocalText로 직접 반영 (기존 확인됨)', base,
      { vocalTone: base.channel.defaultVocal }, { vocalTone: 'mature soulful male tenor, husky' })
  ];

  console.log('[check:option-utilization] GenerationOptions 축별 반영 여부 (A/B 비교)\n');
  console.log('축                  유형     반영    설명');
  console.log('─'.repeat(100));

  let unreflectedCount = 0;
  const unreflected: string[] = [];
  for (const check of checks) {
    const result = check.run(base);
    if (!result) continue;
    if (!result.differs) { unreflectedCount++; unreflected.push(check.axis); }
    console.log(`${check.axis.padEnd(18)} ${check.type.padEnd(7)} ${(result.differs ? '반영' : '미반영⚠').padEnd(8)} ${check.note}`);
  }

  console.log('\n[정적 분류 — A/B 자동 비교 대상 밖 (로컬 생성 경로가 이 필드를 직접 안 읽거나, 관문/브릿지 전용)]');
  const staticNotes: { axis: string; type: AxisType; note: string }[] = [
    { axis: 'durationTarget', type: '③관문', note: 'core/bpmLengthControl.ts의 wordBudgetForTarget/estimateSongLengthSec 목표 길이를 바꾼다 — 지시문40에서 이미 직접 확인됨' },
    { axis: 'introUniqueness', type: '①슬롯', note: 'slot.introMode/introTextureText로 반영 — 지시문 다수에서 이미 확인됨' },
    { axis: 'negativeStyle', type: '②텍스트', note: 'excludePrompt/negativeStyleText로 직접 반영 — mergeNegativeStyleText 호출부로 확인됨' },
    { axis: 'moneyChordMode', type: '①슬롯', note: 'slot.moneyChordId/moneyChordText로 직접 반영 — 이미 확인됨' },
    { axis: 'lyricDepth', type: '④브릿지', note: '로컬 경로 자체 소비처 미확인 — core/promptComposer.ts의 브릿지 지시문 텍스트 빌더 쪽만 실제로 참조하는지 후속 확인 필요' },
    { axis: 'hookMode', type: '④브릿지', note: "'pool' 모드는 core/hookLedger.ts 풀 소진 경로, 'ai-creative'는 브릿지 응답 훅을 그대로 신뢰 — reconcileWithPreassignedSlot의 hookMode 분기로 존재 확인됨(로컬 경로는 항상 ai-creative 취급)" },
    { axis: 'paletteFamilyOverride', type: '③관문', note: 'core/paletteFamilies.ts 계열 — 시대 정전 팔레트 선택에 관여 (별도 실측 필요, 이번 회차 미검증)' },
    { axis: 'kidsAgeTierId', type: '①슬롯', note: 'slot.effectiveKidsAgeTierId로 직접 반영 — 지시문 다수에서 이미 확인됨(비-kids 채널은 undefined가 정상)' },
    { axis: 'breadthOverride', type: '③관문', note: 'core/constraints.ts의 resolveConstraints breadth 판정에 관여 — 별도 실측 필요, 이번 회차 미검증' },
    { axis: 'genreBlendMode', type: '③관문', note: '장르 블렌딩 비율 결정 — 별도 실측 필요, 이번 회차 미검증' }
  ];
  for (const n of staticNotes) {
    console.log(`${n.axis.padEnd(18)} ${n.type.padEnd(7)} 정적분류  ${n.note}`);
  }

  console.log(`\nA/B 비교로 확인한 축: ${checks.length}개, 그중 미반영: ${unreflectedCount}개 ${unreflected.length ? '(' + unreflected.join(', ') + ')' : ''}`);
  console.log('정적 분류만 된 축(후속 A/B 확인 필요): ' + staticNotes.filter(n => n.note.includes('미검증')).length + '개');
  console.log('\n[check:option-utilization] advisory — 통과 처리(exit 0). 차단하지 않는다.');
}

main();
