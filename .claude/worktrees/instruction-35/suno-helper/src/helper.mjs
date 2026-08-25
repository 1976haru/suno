#!/usr/bin/env node
/**
 * TASK v3.31 (Part 2) — local semi-automated Suno input helper.
 *
 * PRINCIPLES (do not violate these — see README.md ②-0):
 *   1. This script only ever fills text fields (title/style/lyrics/exclude).
 *      It NEVER clicks Create/Generate — that stays a deliberate, manual,
 *      human action every single time.
 *   2. The browser is always visible (headless: false) and reuses a
 *      persistent profile the user logs into themselves — this script never
 *      touches credentials.
 *   3. Moving from one song to the next requires the human to press Enter
 *      in this terminal. There is no unattended loop.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { loadSongsFromFile } from './parseSongs.mjs';
import { fillField } from './fillField.mjs';
import { resolveSessionQueue } from './sessionQueue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const PROFILE_DIR = path.join(ROOT_DIR, '.profile');
const SELECTORS_PATH = path.join(ROOT_DIR, 'selectors.json');

function parseArgs(argv) {
  const positional = argv.filter(arg => !arg.startsWith('--'));
  const maxArg = argv.find(arg => arg.startsWith('--max='));
  const maxSongs = maxArg ? Number(maxArg.split('=')[1]) : undefined;
  return { songsPath: positional[0], maxSongs };
}

function loadSelectors() {
  const raw = fs.readFileSync(SELECTORS_PATH, 'utf8');
  return JSON.parse(raw);
}

const FIELD_LABELS = { title: '제목', stylePrompt: '스타일 프롬프트', lyrics: '가사', excludePrompt: 'Exclude' };

async function fillSongFields(page, selectors, song, log) {
  const fieldsToFill = ['title', 'stylePrompt', 'lyrics', ...(song.excludePrompt ? ['excludePrompt'] : [])];

  for (const field of fieldsToFill) {
    const label = FIELD_LABELS[field];
    const result = await fillField(page, selectors[field], song[field]);
    if (result.filled) {
      log(`  ✓ ${label} 채움 (${result.usedSelector})`);
    } else if (result.fallback) {
      log(`  ⚠ ${label} 필드를 찾지 못했습니다.${result.clipboardOk ? ' 값을 클립보드에 복사했습니다 — 직접 붙여넣으세요.' : ' 클립보드 복사도 실패했습니다. 아래 값을 직접 복사하세요:'}`);
      if (!result.clipboardOk) {
        log('  ---');
        log(`  ${song[field]}`);
        log('  ---');
      }
    }
  }
}

async function main() {
  const { songsPath, maxSongs } = parseArgs(process.argv.slice(2));
  if (!songsPath) {
    console.error('사용법: npm run helper -- <songs-output.json 또는 suno-pack.json 경로> [--max=N]');
    process.exitCode = 1;
    return;
  }

  const songs = loadSongsFromFile(songsPath);
  const { queue, limited, limit } = resolveSessionQueue(songs, maxSongs);

  console.log('=================================================');
  console.log(' Suno 반자동 입력기 — 보조 도구 (자동 생성 없음)');
  console.log(' - 이 도구는 필드만 채웁니다. Create/Generate 버튼은 절대 누르지 않습니다.');
  console.log(' - 곡마다 이 터미널에서 Enter를 눌러야만 다음으로 진행됩니다.');
  console.log('=================================================');
  if (limited) {
    console.log(`\n※ 이번 세션은 최대 ${limit}곡까지만 처리합니다 (--max=N으로 변경 가능). 총 ${songs.length}곡 중 처음 ${limit}곡만 진행합니다.`);
  }

  const selectors = loadSelectors();
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, viewport: null });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = context.pages()[0] ?? await context.newPage();
  if (selectors.createPageUrl) {
    await page.goto(selectors.createPageUrl).catch(err => {
      console.log(`⚠ 페이지 이동 실패 (${err.message}). 브라우저에서 직접 Suno 작성 화면으로 이동하세요.`);
    });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n브라우저에서 아직 로그인 전이라면 지금 로그인하세요. 준비되면 이 터미널로 돌아와 Enter를 누르세요.');
  await rl.question('준비되면 Enter... ');

  for (let i = 0; i < queue.length; i++) {
    const song = queue[i];
    console.log(`\n[${i + 1}/${queue.length}] ${song.title}`);
    const answer = await rl.question('이 곡을 채우려면 Enter, 건너뛰려면 s + Enter... ');
    if (answer.trim().toLowerCase() === 's') {
      console.log('건너뜁니다.');
      continue;
    }
    await fillSongFields(page, selectors, song, console.log);
    console.log('필드를 확인·수정하고, 직접 Create를 클릭하세요.');
    await rl.question('다음 곡으로 넘어가려면 Enter... ');
  }

  console.log('\n모든 곡을 처리했습니다. 브라우저는 계속 열어둡니다 — 필요하면 그냥 닫으세요.');
  rl.close();
}

main().catch(err => {
  console.error('오류:', err);
  process.exitCode = 1;
});
