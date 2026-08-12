/**
 * 지시문 44 (TASK A) — senior-morning · oldpop-lounge 두 채널의
 * preferredGenres 합집합(39종, §2-1)에 대해 장르 쌍별 유사도를 실측한다.
 * 하루의 질문 ②("장르가 너무 많은 것 같은데 비슷한 건 분류해서 좁히는 게
 * 낫지 않아?")에 추정이 아니라 실측으로 답하기 위한 것 — TASK B의 통합
 * 실행은 이 스크립트의 출력(특히 0.9 이상 쌍)을 근거로만 진행한다(§규약 7
 * "실측 없이 blocking을 만들지 않는다"는 이 스크립트 자체에는 적용되지
 * 않지만, "유사도 측정 없이 통합하지 말 것"이 곧 이 스크립트의 존재 이유다).
 *
 * 계산 축 (지시문 원문 1-3/A-1 그대로):
 *   tempoRange 겹침 비율      — 두 구간의 overlap/union
 *   eraBuckets 일치도         — Jaccard(다중 버킷 허용, 지시문 12)
 *   instruments 교집합 비율   — Jaccard(대소문자 무시)
 *   rhythm/production/vocal   — 각각 Jaccard
 *   styleCore 어휘 겹침       — 불용어/BPM 숫자 제거 후 단어 집합 Jaccard
 *
 * 종합 유사도 = 가중합. 가중치는 실측값이 아니라 정책 필드(WEIGHTS, 아래)다 —
 * §규약 6 "추정 임계값은 정책 필드로 두고 주석에 명시한다": instruments를
 * 가장 무겁게 둔 이유는 실제 stylePrompt에 그대로 노출되는 축이라 청취
 * 체감에 가장 직접 연결되기 때문(하루의 질문 ①과의 연결점). tempo/era는
 * "같은 시간대·같은 빠르기인가"라는 구조적 신호라 그다음. rhythm/production/
 * vocal은 장르 레코드에 있지만 종종 1-2개뿐이라 항목 자체가 얇아 과대평가를
 * 피하려 낮춘다. styleCore 어휘 겹침은 label 변화가 그대로 섞여 들어가는
 * 축이라(예: "Classic Vocal Jazz Lounge"의 "Vocal"과 "Jazz") 가장 낮게 둔다.
 * verified: false — 하루의 실제 청취 판단이 최종 기준이다(§A-3).
 *
 * Usage: npx tsx scripts/checkGenreOverlap.ts
 */
import { channelPresets } from '../src/data/presets';
import { getGenreById } from '../src/data/genreLibrary';
import type { GenrePack } from '../src/types';
import type { EraBucket } from '../src/data/eraBuckets';
import * as fs from 'node:fs';
import * as path from 'node:path';

type SeniorEraTaggedGenre = GenrePack & { eraBuckets?: EraBucket[] };

const WEIGHTS = {
  tempo: 0.15,
  era: 0.15,
  instruments: 0.25,
  rhythm: 0.15,
  production: 0.15,
  vocal: 0.1,
  styleCore: 0.05
} as const;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'of', 'in', 'on', 'into', 'for', 'to', 'at',
  'pop', 'style', 'core', 'genre'
]);

function normalizeToken(s: string): string {
  return s.trim().toLowerCase();
}

function jaccard(a: string[], b: string[]): { ratio: number; note: string } {
  const setA = new Set(a.map(normalizeToken).filter(Boolean));
  const setB = new Set(b.map(normalizeToken).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return { ratio: 1, note: '(둘 다 비어있음 — 무정보)' };
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return { ratio: intersection.length / union.size, note: '' };
}

function tempoOverlap(a: [number, number], b: [number, number]): number {
  const [aLo, aHi] = a;
  const [bLo, bHi] = b;
  const overlapLen = Math.max(0, Math.min(aHi, bHi) - Math.max(aLo, bLo));
  const unionLen = Math.max(aHi, bHi) - Math.min(aLo, bLo);
  if (unionLen <= 0) return aLo === bLo && aHi === bHi ? 1 : 0;
  return overlapLen / unionLen;
}

function styleCoreWords(styleCore: string): string[] {
  return styleCore
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .split(/[^a-z]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

interface PairScore {
  a: string;
  b: string;
  score: number;
  breakdown: Record<string, number>;
  tempoA: [number, number];
  tempoB: [number, number];
  eraA: EraBucket[];
  eraB: EraBucket[];
}

function seniorGenreUnion(): string[] {
  const seniorMorning = channelPresets.find(c => c.id === 'good-morning-memory-radio');
  const oldpopLounge = channelPresets.find(c => c.id === 'oldpop-lounge-main');
  if (!seniorMorning || !oldpopLounge) throw new Error('good-morning-memory-radio / oldpop-lounge-main 채널을 찾을 수 없음');
  return Array.from(new Set([...seniorMorning.preferredGenres, ...oldpopLounge.preferredGenres]));
}

function computeMatrix(ids: string[]): PairScore[] {
  const pairs: PairScore[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const gA = getGenreById(ids[i]) as SeniorEraTaggedGenre | undefined;
      const gB = getGenreById(ids[j]) as SeniorEraTaggedGenre | undefined;
      if (!gA || !gB) continue;

      const tempo = tempoOverlap(gA.tempoRange, gB.tempoRange);
      const era = jaccard(gA.eraBuckets || [], gB.eraBuckets || []).ratio;
      const instruments = jaccard(gA.instruments || [], gB.instruments || []).ratio;
      const rhythm = jaccard(gA.rhythm || [], gB.rhythm || []).ratio;
      const production = jaccard(gA.production || [], gB.production || []).ratio;
      const vocal = jaccard(gA.vocal || [], gB.vocal || []).ratio;
      const styleCore = jaccard(styleCoreWords(gA.styleCore), styleCoreWords(gB.styleCore)).ratio;

      const score =
        tempo * WEIGHTS.tempo +
        era * WEIGHTS.era +
        instruments * WEIGHTS.instruments +
        rhythm * WEIGHTS.rhythm +
        production * WEIGHTS.production +
        vocal * WEIGHTS.vocal +
        styleCore * WEIGHTS.styleCore;

      pairs.push({
        a: ids[i],
        b: ids[j],
        score,
        breakdown: { tempo, era, instruments, rhythm, production, vocal, styleCore },
        tempoA: gA.tempoRange,
        tempoB: gB.tempoRange,
        eraA: gA.eraBuckets || [],
        eraB: gB.eraBuckets || []
      });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

function fmtPct(n: number): string {
  return n.toFixed(2);
}

function printTier(title: string, pairs: PairScore[]) {
  console.log(`\n${title} (${pairs.length}쌍)`);
  if (!pairs.length) {
    console.log('  (없음)');
    return;
  }
  for (const p of pairs) {
    console.log(
      `  ${p.a} ↔ ${p.b}  ${fmtPct(p.score)}` +
      `  [tempo ${fmtPct(p.breakdown.tempo)} · era ${fmtPct(p.breakdown.era)} · instr ${fmtPct(p.breakdown.instruments)}` +
      ` · rhythm ${fmtPct(p.breakdown.rhythm)} · prod ${fmtPct(p.breakdown.production)} · vocal ${fmtPct(p.breakdown.vocal)}` +
      ` · style ${fmtPct(p.breakdown.styleCore)}]` +
      `  (tempo ${p.tempoA[0]}-${p.tempoA[1]} vs ${p.tempoB[0]}-${p.tempoB[1]}, era ${p.eraA.join('/')} vs ${p.eraB.join('/')})`
    );
  }
}

function main() {
  const ids = seniorGenreUnion();
  const missing = ids.filter(id => !getGenreById(id));
  console.log(`[check:genre-overlap] senior 계열(senior-morning ∪ oldpop-lounge) ${ids.length}종`);
  if (missing.length) console.log(`  ⚠ genreLibrary에 없는 id: ${missing.join(', ')}`);

  const matrix = computeMatrix(ids);
  const high = matrix.filter(p => p.score >= 0.9);
  const mid = matrix.filter(p => p.score >= 0.7 && p.score < 0.9);
  const low = matrix.filter(p => p.score < 0.7);

  printTier('유사도 0.9 이상 (사실상 동일 — 통합 후보)', high);
  printTier('유사도 0.7~0.9 (통합 검토)', mid);
  console.log(`\n유사도 0.7 미만 (구분됨) — ${low.length}쌍 (개별 목록 생략, 총 ${matrix.length}쌍 중)`);

  console.log(`\n[요약] 전체 쌍 ${matrix.length} · 0.9+ ${high.length} · 0.7~0.9 ${mid.length} · 0.7미만 ${low.length}`);
  console.log(`0.9 이상만 통합하면: ${ids.length}종 → 대표 선정 후 예상 감소는 TASK B에서 계산(연결된 쌍을 그룹으로 묶어야 함).`);

  const outPath = path.join(process.cwd(), 'docs', 'genre-overlap-matrix.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), weights: WEIGHTS, genreCount: ids.length, ids, pairs: matrix }, null, 2));
  console.log(`\n전체 유사도 행렬을 ${path.relative(process.cwd(), outPath)}에 저장했다.`);
}

main();
