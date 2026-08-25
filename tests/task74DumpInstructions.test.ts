import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { makeOptions } from './fixtures';

/**
 * 지시문 74 (§6) — 실제 청취 검증용 브릿지 지시문 2건을 파일로 떨군다.
 * 테스트가 아니라 산출물 생성용(하루가 Suno에 넣을 세트를 만들기 위한 입력).
 */
const OUT_DIR = path.join(process.cwd(), 'lyrics', 'task74');

const SETS = [
  { id: 'set1-deep-house', channelId: 'after-hours-deep-house', concept: '딥 하우스', songCount: 12 },
  { id: 'set2-showa-70s', channelId: 'showa-seventies', concept: '오래된 라디오에서 흘러나오던 저녁', songCount: 12 },
  { id: 'set3-chill-rap', channelId: 'headphones-down-low', concept: '옥상에서 듣는 칠 랩', songCount: 12 }
];

// 파일을 실제로 다시 쓰는 것은 TASK74_DUMP=1 일 때만 — 평소 `npm test`가
// 검증용 산출물을 매번 덮어쓰지 않게 한다.
//   TASK74_DUMP=1 npx vitest run tests/task74DumpInstructions.test.ts
describe('[지시문74 §6] 청취 검증 세트 지시문 덤프', () => {
  it.skipIf(!process.env.TASK74_DUMP)('세 세트의 브릿지 지시문과 슬롯 계획을 파일로 쓴다', () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const set of SETS) {
      const channel = channelPresets.find(c => c.id === set.channelId)!;
      const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
      const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
      const season = seasonPacks[0];
      const opts = makeOptions({
        channel,
        songCount: set.songCount,
        genreIds: channel.preferredGenres,
        moodIds: moods.map(m => m.id),
        customConcept: set.concept
      });
      const slots = preallocateSongSlots(opts, genres);
      const text = buildClaudeCodeInstruction(opts, genres, moods, season, undefined, slots);
      fs.writeFileSync(path.join(OUT_DIR, `${set.id}-instruction.md`), text, 'utf-8');
      fs.writeFileSync(
        path.join(OUT_DIR, `${set.id}-slots.json`),
        JSON.stringify(slots, null, 2),
        'utf-8'
      );
      expect(text.length).toBeGreaterThan(1000);
    }
  });
});
