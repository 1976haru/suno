/**
 * 지시문 10 (TASK E) — excludePrompt 길이 청취 실험 키트. 892자/832자 실측(두
 * 실제 팩 전곡 동일값)이 정확한 길이인지 아무 근거가 없다는 것이 이 지시문의
 * 전제 — short/medium/long 세 버전을 만들어 산출까지만 하고, 무엇이 좋은지는
 * 하루가 직접 들어보고 정한다. 가사·stylePrompt는 절대 건드리지 않는다.
 *
 * 세 버전 모두 안전(audience exclusions)·저작권 문구는 무조건 포함한다 — 이
 * 실험이 절대 건드리지 않는 하한선이다. 실측 결과 이 하한선 자체가 이미
 * ~350-450자에 달해(시니어 audience exclusions 9개 항목), 지시문이 제시한
 * "short 100-150자" 목표는 안전 문구를 유지하는 한 달성 불가능했다 — short는
 * 그 실측 하한선을 그대로 쓰고(장르별 추가 항목 없음), medium에서 처음으로
 * 그 곡의 장르·시대에 실제로 충돌 가능한 항목을 추가한다. 목표 상수는 참고용
 * 상한으로 남겨 두고, 실제 달성 길이를 README에 정직하게 기록한다.
 *
 * Usage:
 *   npx tsx scripts/excludeLengthTrial.ts --pack <path> --tracks 3 [--out <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPackBlueprint } from './audit';
import { getGenreById } from '../src/data/genreLibrary';
import { buildNegativePromptSpec } from '../src/core/negativePromptSpec';
import { mergeNegativeStyleText } from '../src/data/negativeStyles';
import { fitWithinBudget } from '../src/core/promptComposer';
import { eraBucketForGenreId, ERA_FORBIDDEN_DESCRIPTORS } from '../src/data/eraExclusions';
import type { SongIdea } from '../src/types';

// 참고용 상한 — 실측 결과 안전·저작권·워크스페이스 하한선(alwaysKeepText)
// 자체가 이미 ~496자여서, 절대값 기준 budget(150/450)은 항상 이미 초과 상태가
// 되어 short/medium이 서로 구별되지 않는 문제가 있었다(첫 실행에서 실측
// 확인). 그래서 medium은 하한선 위에 얹는 "여유폭"으로 정의한다 — short는
// 여유 0(하한선 그대로), medium은 하한선 + MEDIUM_HEADROOM자까지 그 곡의
// 장르·시대 항목을 추가한다.
const MEDIUM_HEADROOM = 200;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  return {
    packPath: get('--pack') ?? '',
    tracks: Math.max(1, parseInt(get('--tracks') ?? '3', 10) || 3),
    outDir: get('--out') ?? path.resolve(process.cwd(), 'exclude-trial')
  };
}

/** 세트 전체가 아니라 장르가 다양한 몇 곡을 보기 위해 trackNo 기준 처음·중간·끝 근방으로 고른다. */
function pickSampleTracks(songs: SongIdea[], count: number): SongIdea[] {
  const sorted = [...songs].sort((a, b) => a.trackNo - b.trackNo);
  if (sorted.length <= count) return sorted;
  const indices = new Set<number>();
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i * (sorted.length - 1)) / Math.max(1, count - 1)));
  }
  return [...indices].sort((a, b) => a - b).map(i => sorted[i]);
}

export interface ExcludeVariant {
  label: 'short' | 'medium' | 'long';
  text: string;
  length: number;
}

export interface ExcludeTrialEntry {
  trackNo: number;
  title: string;
  genreId: string | undefined;
  variants: ExcludeVariant[];
}

/**
 * Pure — builds the short/medium/long triple for one song. `channel` comes
 * from the loaded pack (real audience/soundFloor for that workspace), never
 * fabricated. Exported so tests can assert on real lengths/content instead
 * of parsing written files.
 */
export function buildExcludeVariants(song: SongIdea, channel: Parameters<typeof buildNegativePromptSpec>[0]['channel']): ExcludeVariant[] {
  const genre = getGenreById(song.genreId);
  const spec = buildNegativePromptSpec({ avoidWords: '', channel, negativeStyle: undefined }, genre ? [genre] : [], []);
  const alwaysKeepText = mergeNegativeStyleText(spec.copyright.join(', '), spec.safety.join(', '), spec.workspace.join(', '));

  const eraBucket = eraBucketForGenreId(song.genreId);
  const eraTerms = eraBucket ? ERA_FORBIDDEN_DESCRIPTORS[eraBucket] : [];

  // short — the safety/copyright/workspace floor, nothing else. No genre or
  // era terms at all; this is the "only what can never be cut" version.
  const shortText = alwaysKeepText;

  // medium — this song's OWN genre.avoidTraits + era-consistency terms only
  // (never spec.arrangement's full mix, which prepends 8 generic
  // GLOBAL_NEGATIVE_STYLE_TERMS + the channel's own forbiddenCliches ahead of
  // the genre-specific terms — a first version passed spec.arrangement
  // directly and measured all 3 sampled tracks getting byte-for-byte
  // identical medium text: the generic filler consumed the whole headroom
  // before fitWithinBudget ever reached the genre-specific avoidTraits at the
  // end of that list, so the one thing meant to vary per song never did).
  // Genre-specific terms go first here so they're never the ones cut.
  const songSpecificCandidates = [...(genre?.avoidTraits ?? []), ...eraTerms];
  const mediumKept = fitWithinBudget(alwaysKeepText, songSpecificCandidates, alwaysKeepText.length + MEDIUM_HEADROOM);
  const mediumText = mergeNegativeStyleText(alwaysKeepText, mediumKept.join(', '));

  const longText = song.excludePrompt ?? '';

  return [
    { label: 'short', text: shortText, length: shortText.length },
    { label: 'medium', text: mediumText, length: mediumText.length },
    { label: 'long', text: longText, length: longText.length }
  ];
}

function songFileContent(song: SongIdea, variant: ExcludeVariant, lengthNote: string): string {
  return [
    `제목: ${song.title}`,
    `트랙 번호: T${song.trackNo} (원본 팩 기준)`,
    `장르: ${song.genreId ?? '(없음)'}`,
    `버전: ${variant.label}${lengthNote}`,
    '',
    '[가사] (버전 간 동일 — 변경 없음)',
    song.lyrics,
    '',
    '[stylePrompt] (버전 간 동일 — 변경 없음)',
    song.stylePrompt,
    '',
    `[excludePrompt] (이 버전만 다름 — 실측 ${variant.length}자)`,
    variant.text,
    ''
  ].join('\n');
}

function buildReadme(entries: ExcludeTrialEntry[]): string {
  const lines: string[] = [
    '지시문 10 TASK E — excludePrompt 길이 청취 실험',
    '',
    '가사와 stylePrompt는 세 버전 모두 완전히 동일합니다. excludePrompt(Suno Exclude',
    'styles 필드)만 다릅니다. 안전·저작권 문구는 short를 포함한 모든 버전에',
    '반드시 남아 있습니다 — 실험이 지우는 것은 그 이상의 장르별/시대별 항목뿐입니다.',
    '',
    '실측 길이 안내: 시니어 오디언스의 안전·저작권·워크스페이스 항목만으로',
    '이미 약 496자입니다. 지시문이 제시한 "short 100~150자" 목표는 안전',
    '문구를 지키는 한 달성되지 않았습니다 — 그래서 short는 그 하한선 그대로',
    '(장르·시대 항목 없음), medium은 하한선 위에 이 곡의 장르·시대 항목을',
    '최대 200자만큼만 얹은 버전입니다. long은 실제 발매 팩의 원래 값입니다.',
    '길이 자체보다 "내용이 이 곡에 맞는가/불필요한 게 섞여 있는가"로 들어',
    '주시면 됩니다.',
    '',
    '=== 실측 길이 표 ===',
    ''
  ];
  for (const entry of entries) {
    lines.push(`T${entry.trackNo} · ${entry.title} (${entry.genreId ?? '장르 없음'})`);
    for (const v of entry.variants) lines.push(`  ${v.label.padEnd(6)} ${v.length}자`);
    lines.push('');
  }
  lines.push(
    '=== 듣는 순서 ===',
    '',
    '각 곡을 short → medium → long 순서로 수노에 넣고 들어 주세요. 파일명',
    '앞자리(01/02/03)가 곡 순서, 뒷부분이 버전입니다. 가사·stylePrompt는',
    '파일에 이미 포함돼 있으니 그대로 붙여넣고, excludePrompt만 Suno의',
    'Exclude styles 필드에 넣으면 됩니다.',
    '',
    '=== 기록 양식 ===',
    ''
  );
  entries.forEach((entry, i) => {
    const n = String(i + 1).padStart(2, '0');
    lines.push(
      `곡 ${n} (T${entry.trackNo} · ${entry.title})`,
      '  short   [ ] 좋음  [ ] 보통  [ ] 별로   메모:',
      '  medium  [ ] 좋음  [ ] 보통  [ ] 별로   메모:',
      '  long    [ ] 좋음  [ ] 보통  [ ] 별로   메모:',
      '  가장 좋았던 것:            이유(한 줄):',
      ''
    );
  });
  return lines.join('\n');
}

export function runExcludeLengthTrial(packPath: string, trackCount: number, outDir: string): ExcludeTrialEntry[] {
  const loaded = loadPackBlueprint(packPath, undefined);
  if (loaded.blocked) {
    console.error('[excludeLengthTrial] 팩을 불러올 수 없습니다:');
    for (const reason of loaded.reasons) console.error(`  - ${reason}`);
    process.exit(1);
  }
  const sample = pickSampleTracks(loaded.blueprint.songs, trackCount);

  fs.mkdirSync(outDir, { recursive: true });
  const entries: ExcludeTrialEntry[] = [];

  sample.forEach((song, i) => {
    const variants = buildExcludeVariants(song, loaded.channel);
    entries.push({ trackNo: song.trackNo, title: song.title, genreId: song.genreId, variants });
    const n = String(i + 1).padStart(2, '0');
    for (const variant of variants) {
      const lengthNote = variant.label === 'short'
        ? ' (안전·저작권·워크스페이스 하한선 그대로 — 장르·시대 추가 없음)'
        : variant.label === 'medium' ? ` (하한선 + 최대 ${MEDIUM_HEADROOM}자 — 이 곡의 장르·시대 항목 추가)` : ' (원본 팩 값 그대로, 변경 없음)';
      const filePath = path.join(outDir, `${n}_${variant.label}.txt`);
      fs.writeFileSync(filePath, songFileContent(song, variant, lengthNote), 'utf-8');
    }
  });

  fs.writeFileSync(path.join(outDir, 'README.txt'), buildReadme(entries), 'utf-8');

  console.log(`[excludeLengthTrial] ${sample.length}곡 × 3버전 = ${sample.length * 3}개 파일 산출 완료 → ${outDir}`);
  for (const entry of entries) {
    console.log(`  T${entry.trackNo} · ${entry.title} (${entry.genreId ?? '장르 없음'})`);
    for (const v of entry.variants) console.log(`    ${v.label.padEnd(6)} ${v.length}자`);
  }
  return entries;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = parseArgs();
  if (!args.packPath) {
    console.error('사용법: npx tsx scripts/excludeLengthTrial.ts --pack <path> --tracks 3 [--out <dir>]');
    process.exit(1);
  }
  runExcludeLengthTrial(args.packPath, args.tracks, args.outDir);
}
