/**
 * 지시문 16 (TASK A-2) — stylePrompt 길이 청취 실험 키트. 문자 기준(감사)과
 * 단어 기준(지시문 03·CI matrix)이 서로 반대 답을 내는 실측(§1-1: 문자
 * 350~650 통과 17/18, 단어 35~55 통과 0/18) — 어느 쪽이 옳은지는 코드로 정할
 * 수 없다는 것이 이 지시문의 전제. short/medium/long 세 버전을 만들어
 * 산출까지만 하고, 단위·임계값은 하루가 직접 들어보고 정한다. 가사와
 * excludePrompt는 절대 건드리지 않는다(지시문 자체의 명시적 금지).
 *
 * 삭제 금지 8종(지시문 03 TASK C): 시대·장르·BPM·리드보컬·핵심악기·핵심구조·
 * 사용자선택·길이 — short에서도 반드시 남는다. 축약 우선순위(지시문 03):
 * 1 중복 믹스 표현 2 장식적 형용사 3 보조 악기 4 세부 훅 설명.
 *
 * data/promptAxisLexicon.ts의 classifyClause로 각 stylePrompt 클로즈를
 * 축(axis)으로 분류한다 — 자유 정규식이 아니라 지시문 16 §B-4가 요구하는
 * "어휘는 데이터, 판정은 코드" 원칙을 이 스크립트도 그대로 따른다(TASK B의
 * mergeAtom과 같은 lexicon을 공유 — 축 판정이 두 곳에서 다르게 나오는 일이
 * 없다).
 *
 * Usage:
 *   npx tsx scripts/promptLengthTrial.ts --pack <path> --tracks 3 [--out <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPackBlueprint } from './audit';
import { classifyClause, REQUIRED_AXES_BY_POSITION, SINGLE_DECLARATION_AXES, type PromptAxis } from '../src/data/promptAxisLexicon';
import type { SongIdea } from '../src/types';

const SHORT_WORD_TARGET = { min: 35, max: 45 };
const MEDIUM_WORD_TARGET = { min: 55, max: 65 };

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  return {
    packPath: get('--pack') ?? '',
    tracks: Math.max(1, parseInt(get('--tracks') ?? '3', 10) || 3),
    outDir: get('--out') ?? path.resolve(process.cwd(), 'prompt-trial')
  };
}

/** 세트 전체가 아니라 몇 곡만 보기 위해 trackNo 기준 처음·중간·끝 근방으로 고른다 — excludeLengthTrial.ts의 pickSampleTracks와 동일 로직(중복 구현이 아니라 그 파일도 로컬 함수라 임포트할 공개 API가 없음). */
function pickSampleTracks(songs: SongIdea[], count: number): SongIdea[] {
  const sorted = [...songs].sort((a, b) => a.trackNo - b.trackNo);
  if (sorted.length <= count) return sorted;
  const indices = new Set<number>();
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i * (sorted.length - 1)) / Math.max(1, count - 1)));
  }
  return [...indices].sort((a, b) => a - b).map(i => sorted[i]);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

interface ClassifiedClause {
  text: string;
  axis: PromptAxis | undefined;
}

function classifyClauses(stylePrompt: string): ClassifiedClause[] {
  return stylePrompt.split(',').map(c => c.trim()).filter(Boolean).map((text, index) => ({
    text,
    axis: classifyClause(text, index === 0)
  }));
}

/**
 * Pure — the actual reduction algorithm. Picks one "required" clause per
 * axis in REQUIRED_AXES_BY_POSITION (first occurrence), plus the first
 * 'instrument' clause (핵심 악기) and first 'harmony' clause (사용자 선택—
 * this app's own money-chord progression is exactly this kind of user
 * choice, and it's the only axis reliably carrying it in free-prose
 * stylePrompt text). Everything else is reducible, added back for medium in
 * the stated priority order (지시문 03 TASK C, reversed — least-reducible
 * added back first): structure/backingVocal/intro/extra-genre content first,
 * then hookDevice detail, then supporting instruments, then decorative
 * (unclassified) clauses, then duplicate mix clauses last.
 */
export function buildStylePromptVariants(stylePrompt: string): { short: string; medium: string; long: string } {
  const clauses = classifyClauses(stylePrompt);
  const long = stylePrompt;

  const requiredByAxis = new Map<PromptAxis, ClassifiedClause>();
  for (const axis of REQUIRED_AXES_BY_POSITION) {
    const found = clauses.find(c => c.axis === axis);
    if (found) requiredByAxis.set(axis, found);
  }
  const coreInstrument = clauses.find(c => c.axis === 'instrument');
  if (coreInstrument) requiredByAxis.set('instrument', coreInstrument);
  const userSelection = clauses.find(c => c.axis === 'harmony');
  if (userSelection) requiredByAxis.set('harmony', userSelection);

  const requiredSet = new Set(Array.from(requiredByAxis.values()).map(c => c.text));
  const required = clauses.filter(c => requiredSet.has(c.text));

  // 축약 우선순위(지시문 03 TASK C, 제거 순서): 1 중복 믹스 2 장식적 형용사
  // 3 보조 악기 4 세부 훅 설명. 아래 배열은 "다시 채우는" 순서라 역순 —
  // 마지막에 채워지는 항목이 가장 먼저 잘린다.
  const remaining = clauses.filter(c => !requiredSet.has(c.text));
  const structureAndOther = remaining.filter(c => c.axis === 'structure' || c.axis === 'backingVocal' || c.axis === 'intro' || c.axis === 'genre' || c.axis === 'era' || c.axis === 'harmony');
  const hookDeviceDetail = remaining.filter(c => c.axis === 'hookDevice');
  const supportingInstruments = remaining.filter(c => c.axis === 'instrument');
  const decorative = remaining.filter(c => c.axis === undefined);
  const duplicateMix = remaining.filter(c => c.axis === 'mix');
  // fill order: least-reducible added back first (highest priority to keep)
  const fillOrder = [...structureAndOther, ...hookDeviceDetail, ...supportingInstruments, ...decorative, ...duplicateMix];

  // 지시문 16 §B-2 — 단일 선언 축(era/tempo/leadVocal/intro/duration/
  // arrangementDensity)은 required에 이미 하나 있으면 다시 채우지 않는다.
  // 이걸 빼먹으면 short/medium이 원문의 바로 그 모순(§1-2: intro 축에 즉시
  // 시작+인트로있음 동시 선언)을 그대로 물려받는다 — 길이만 줄이고 모순은
  // 남기는 것은 이 지시문의 실패 조건이다.
  const requiredAxes = new Set(Array.from(requiredByAxis.keys()));
  function buildWithBudget(target: { min: number; max: number }): string {
    const usedSingleAxes = new Set(requiredAxes);
    let current = [...required];
    let text = current.map(c => c.text).join(', ');
    if (wordCount(text) >= target.min) return text;
    for (const candidate of fillOrder) {
      if (current.includes(candidate)) continue;
      if (candidate.axis && SINGLE_DECLARATION_AXES.includes(candidate.axis) && usedSingleAxes.has(candidate.axis)) continue;
      current.push(candidate);
      if (candidate.axis && SINGLE_DECLARATION_AXES.includes(candidate.axis)) usedSingleAxes.add(candidate.axis);
      text = current.map(c => c.text).join(', ');
      if (wordCount(text) >= target.min) break;
    }
    return text;
  }

  const short = buildWithBudget(SHORT_WORD_TARGET);
  const medium = buildWithBudget(MEDIUM_WORD_TARGET);

  return { short, medium, long };
}

export interface PromptVariant {
  label: 'short' | 'medium' | 'long';
  text: string;
  words: number;
  chars: number;
}

export interface PromptTrialEntry {
  trackNo: number;
  title: string;
  genreId: string | undefined;
  variants: PromptVariant[];
}

function songFileContent(song: SongIdea, variant: PromptVariant): string {
  return [
    `제목: ${song.title}`,
    `트랙 번호: T${song.trackNo} (원본 팩 기준)`,
    `장르: ${song.genreId ?? '(없음)'}`,
    `버전: ${variant.label} (실측 ${variant.words}단어 · ${variant.chars}자)`,
    '',
    '[가사] (버전 간 동일 — 변경 없음)',
    song.lyrics,
    '',
    `[stylePrompt] (이 버전만 다름)`,
    variant.text,
    '',
    '[excludePrompt] (버전 간 동일 — 변경 없음)',
    song.excludePrompt ?? '',
    ''
  ].join('\n');
}

function buildReadme(entries: PromptTrialEntry[]): string {
  const lines: string[] = [
    '지시문 16 TASK A-2 — stylePrompt 길이 청취 실험',
    '',
    '가사와 excludePrompt는 세 버전 모두 완전히 동일합니다. stylePrompt만',
    '다릅니다. 시대·장르·BPM·리드보컬·핵심악기·핵심구조(편곡밀도)·',
    '사용자선택(코드 진행)·길이는 short에도 반드시 남아 있습니다 —',
    '실험이 줄이는 것은 그 이상의 장식/중복 표현뿐입니다.',
    '',
    'short는 필수 8종만으로 목표(35~45단어)에 못 미치면 덜 중요한 항목을',
    '역순으로(구조·훅 설명·보조 악기·장식어·중복 믹스 표현 순) 다시 채워',
    '목표에 맞춥니다 — 그래서 short도 완전한 문장처럼 읽힙니다.',
    '',
    '=== 실측 길이 표 ===',
    ''
  ];
  for (const entry of entries) {
    lines.push(`T${entry.trackNo} · ${entry.title} (${entry.genreId ?? '장르 없음'})`);
    for (const v of entry.variants) lines.push(`  ${v.label.padEnd(6)} ${String(v.words).padStart(3)}단어 · ${v.chars}자`);
    lines.push('');
  }
  lines.push(
    '=== 듣는 순서 ===',
    '',
    '각 곡을 short → medium → long 순서로 수노에 넣고 들어 주세요. 파일명',
    '앞자리(01/02/03)가 곡 순서, 뒷부분이 버전입니다.',
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
  lines.push(
    '=== 어느 쪽 단위를 기준으로 할지 (지시문 16 TASK A-1) ===',
    '',
    '문자수와 단어수 중 무엇을 기준으로 할지도 함께 정해 주세요.',
    '수노 상한은 1,000자라 문자 기준이 실제 제약에 더 가깝고,',
    '정보 밀도(악기/보컬/구조가 몇 개나 들어가는지)는 단어 기준이',
    '더 정확하게 잡습니다. 위 short/medium/long을 들으면서',
    '"이 정도 정보량이 적당하다" 싶은 지점의 단어수/문자수를',
    '함께 적어 주시면 지시문 16 TASK A-4에서 그 값으로 확정합니다.'
  );
  return lines.join('\n');
}

export function runPromptLengthTrial(packPath: string, trackCount: number, outDir: string): PromptTrialEntry[] {
  const loaded = loadPackBlueprint(packPath, undefined);
  if (loaded.blocked) {
    console.error('[promptLengthTrial] 팩을 불러올 수 없습니다:');
    for (const reason of loaded.reasons) console.error(`  - ${reason}`);
    process.exit(1);
  }
  const sample = pickSampleTracks(loaded.blueprint.songs, trackCount);

  fs.mkdirSync(outDir, { recursive: true });
  const entries: PromptTrialEntry[] = [];

  sample.forEach((song, i) => {
    const built = buildStylePromptVariants(song.stylePrompt);
    const variants: PromptVariant[] = (['short', 'medium', 'long'] as const).map(label => ({
      label,
      text: built[label],
      words: wordCount(built[label]),
      chars: built[label].length
    }));
    entries.push({ trackNo: song.trackNo, title: song.title, genreId: song.genreId, variants });
    const n = String(i + 1).padStart(2, '0');
    for (const variant of variants) {
      const filePath = path.join(outDir, `${n}_${variant.label}.txt`);
      fs.writeFileSync(filePath, songFileContent(song, variant), 'utf-8');
    }
  });

  fs.writeFileSync(path.join(outDir, 'README.txt'), buildReadme(entries), 'utf-8');

  console.log(`[promptLengthTrial] ${sample.length}곡 × 3버전 = ${sample.length * 3}개 파일 산출 완료 → ${outDir}`);
  for (const entry of entries) {
    console.log(`  T${entry.trackNo} · ${entry.title} (${entry.genreId ?? '장르 없음'})`);
    for (const v of entry.variants) console.log(`    ${v.label.padEnd(6)} ${String(v.words).padStart(3)}단어 · ${v.chars}자`);
  }
  return entries;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = parseArgs();
  if (!args.packPath) {
    console.error('사용법: npx tsx scripts/promptLengthTrial.ts --pack <path> --tracks 3 [--out <dir>]');
    process.exit(1);
  }
  runPromptLengthTrial(args.packPath, args.tracks, args.outDir);
}
