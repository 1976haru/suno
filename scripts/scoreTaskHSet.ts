/**
 * 지시문 11 (TASK H) — 하루가 직접 작성한(이 세션에서는 Claude Code가 실제
 * bridge songwriter 역할로 작성한) 18곡을 core/quality.ts의 실제 scoreSong과
 * core/albumAudit.ts의 실제 auditAlbum에 통과시켜 "텍스트 품질 성공률"을
 * 측정한다.
 *
 * "성공"의 정의 — 실측 근거: 지시문 05/06이 원래 설계한 재작성 루프의 진짜
 * revise/reject 판정은 실시간 Claude/ChatGPT API 평가(agents/evaluator.ts)를
 * 필요로 한다(tests/e2e/resultsFlow.spec.ts 자신의 doc comment가 "requires a
 * live Claude/ChatGPT API call — genuinely unreachable in a zero-cost E2E
 * suite"라고 명시). 이 세션에는 그 API 접근이 없다 — 그래서 이 스크립트는
 * 그 대신 이 앱이 이미 갖고 있는 결정적(API 불필요) 코드 레벨 텍스트 품질
 * 신호 두 가지를 조합한다:
 *   1) core/quality.ts scoreSong의 song.warnings — 단, 그 자체 doc comment가
 *      "advisory only, never blocking"이라고 명시한 항목(English syllable
 *      density)은 실패로 세지 않는다(광고성 스타일 지적까지 실패로 세면
 *      실측 성공률이 부당하게 낮아진다).
 *   2) core/albumAudit.ts auditAlbum의 errors — 이미 이 앱 자신이 "Track N:"
 *      접두사로 트랙별 차단 오류를 구분해 두고 있다(중복 제목/훅, 아티스트명
 *      유출, 글자수 초과, idol 표현 위반 등).
 * 이 정의는 지시문 05/06의 원래 AI 평가 기반 revise/reject와 다르다 — 정직하게
 * "결정적 코드 체크 기준"이라고 보고서에 명시한다.
 *
 * Usage: npx tsx scripts/scoreTaskHSet.ts <set-id>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreSong } from '../src/core/quality';
import { auditAlbum } from '../src/core/albumAudit';
import { channelPresets } from '../src/data/presets';
import type { SongIdea } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'lyrics', 'taskH');

const ADVISORY_ONLY_PREFIXES = [
  'English lyric quality (syllable-density)',
  'English lyric quality (consonant-cluster)'
];

function isAdvisoryOnly(warning: string): boolean {
  return ADVISORY_ONLY_PREFIXES.some(prefix => warning.startsWith(prefix));
}

export interface TrackResult {
  trackNo: number;
  blockingWarnings: string[];
  albumErrors: string[];
  passed: boolean;
}

export function scoreSet(setId: string, songsFile: string = `${setId}-songs.json`): TrackResult[] {
  const slots = JSON.parse(fs.readFileSync(path.join(dir, `${setId}-slots.json`), 'utf-8')) as { trackNo: number; negativeStyleText: string }[];
  const songsRaw = JSON.parse(fs.readFileSync(path.join(dir, songsFile), 'utf-8')) as { songs: SongIdea[] };
  const negativeByTrack = new Map(slots.map(s => [s.trackNo, s.negativeStyleText]));
  const songs: SongIdea[] = songsRaw.songs.map(song => ({ ...song, excludePrompt: negativeByTrack.get(song.trackNo) ?? '' }));

  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const scored = songs.map(song => scoreSong(song, channel, 'english'));
  const albumReport = auditAlbum(scored, { channel });

  return scored.map(song => {
    const blockingWarnings = (song.warnings ?? []).filter(w => !isAdvisoryOnly(w));
    const albumErrors = albumReport.errors.filter(e => e.startsWith(`Track ${song.trackNo}:`));
    return { trackNo: song.trackNo, blockingWarnings, albumErrors, passed: blockingWarnings.length === 0 && albumErrors.length === 0 };
  });
}

const setId = process.argv[2];
const songsFile = process.argv[3];
if (setId) {
  const results = scoreSet(setId, songsFile);
  const passed = results.filter(r => r.passed);
  console.log(`[scoreTaskHSet] ${setId} (${songsFile ?? `${setId}-songs.json`}): ${passed.length}/${results.length} passed (${((passed.length / results.length) * 100).toFixed(1)}%)`);
  for (const r of results) {
    if (!r.passed) {
      console.log(`  T${r.trackNo} FAIL`);
      for (const w of r.blockingWarnings) console.log(`    - warning: ${w}`);
      for (const e of r.albumErrors) console.log(`    - album error: ${e}`);
    }
  }
}
