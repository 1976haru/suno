import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectWorkspace, pickAnyArchetype, pickGenreAndMood, acknowledgeDesignGateIfNeeded } from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

/**
 * codex 지시문 07 (TASK C) — scenarios 11-14: retry uses snapshot, rewrite
 * selected tracks, export audited JSON, workspace switch preserves
 * existing results.
 *
 * Real constraint: SongCard.tsx's individual "🔄 이 곡만 다시 만들기" retry
 * button and the bulk HybridRefinePanel both only appear after a real AI
 * evaluation (revise/reject verdict), which requires a live Claude/ChatGPT
 * API call — genuinely unreachable in a zero-cost E2E suite (see TASK D's
 * own "실제 비용이 드는 테스트는 opt-in smoke로 분리" principle, generalized
 * here). Scenario 11 instead exercises GenerationGatePanel's real,
 * locally-reachable "재작곡 지시문 복사" (regenerate-from-snapshot
 * instruction copy) — the one snapshot-based regen path that needs no API
 * key. Scenario 12 flips the provider chip to Anthropic (client-side state
 * only, no key entered, no network call ever made) to reach the real
 * multi-track selection UI (agents/evaluator.ts's isEvaluationAvailable is
 * `provider !== 'local'`, independent of whether a key was ever entered),
 * then verifies real selection interaction without ever clicking the
 * evaluate button itself.
 */
async function reachStep5WithValidImport(page: import('@playwright/test').Page) {
  await selectWorkspace(page, '시니어 올드팝');
  await pickAnyArchetype(page);
  await page.getByRole('button', { name: '다음 →' }).click();
  await pickGenreAndMood(page);
  await page.getByRole('button', { name: '다음 →' }).click();
  await page.getByRole('button', { name: '다음 →' }).click();
  await acknowledgeDesignGateIfNeeded(page);
  const importInput = page.locator('label:has-text("곡 JSON 가져오기") input[type="file"]');
  await importInput.setInputFiles(path.join(FIXTURES, 'valid-songs-output.json'));
  await expect(page.getByText('완성된 곡부터 순서대로 나타납니다')).toBeVisible({ timeout: 15000 });
}

test.describe('[E2E 11] retry uses snapshot', () => {
  test('the 관문 2 regenerate-instruction copy button produces a real, track-specific instruction from the original snapshot', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await reachStep5WithValidImport(page);
    const copyButton = page.getByRole('button', { name: /재작곡 지시문 복사/ }).first();
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(page.getByRole('button', { name: /복사됨/ }).first()).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.length).toBeGreaterThan(30);
    expect(clipboardText).toMatch(/트랙|Track/);
  });
});

test.describe('[E2E 12] rewrite selected tracks', () => {
  test('selecting specific tracks for evaluation updates the selection count and enables the scoped action', async ({ page }) => {
    await reachStep5WithValidImport(page);
    await page.getByRole('button', { name: '⚙️ 설정' }).click();
    await page.getByRole('button', { name: 'Claude (Anthropic)' }).click();
    await page.locator('[role="dialog"] button[title="닫기"]').click();
    await expect(page.getByRole('button', { name: /선택한 곡만 평가/ })).toBeVisible();
    await page.getByRole('button', { name: /선택한 곡만 평가/ }).click();
    const checkboxes = page.locator('label.song-select-row input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await expect(page.getByRole('button', { name: '선택한 곡만 평가 (2곡 선택됨)' })).toBeVisible();
    const evaluateButton = page.getByRole('button', { name: '🧪 선택한 2곡만 평가하기' });
    await expect(evaluateButton).toBeEnabled();
  });
});

test.describe('[E2E 13] export audited JSON', () => {
  test('the JSON export button downloads a real, audited pack file with export metadata', async ({ page }) => {
    await reachStep5WithValidImport(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'JSON', exact: true }).click()
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const fs = await import('node:fs');
    const content = JSON.parse(fs.readFileSync(downloadPath!, 'utf-8'));
    expect(content.appVersion).toBeTruthy();
    expect(content.schemaVersion).toBeTruthy();
    expect(Array.isArray(content.songs)).toBe(true);
    expect(content.songs.length).toBe(18);
  });
});

test.describe('[E2E 14] workspace switch preserves existing results', () => {
  test('saving a pack, switching workspace, and returning shows the pack still in the saved-pack list', async ({ page }) => {
    await reachStep5WithValidImport(page);
    await page.getByRole('button', { name: '💾 이 팩 저장하기' }).click();
    await expect(page.getByRole('listitem').first()).toBeVisible();

    await page.getByRole('button', { name: /시니어 올드팝 · 전환/ }).click();
    await expect(page.getByRole('heading', { name: '어떤 작업을 하시겠어요?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^시니어 올드팝.*세트 \d+개/ })).toBeVisible();

    await page.getByRole('button', { name: /^시니어 올드팝/ }).click();
    await expect(page.getByRole('heading', { name: '📚 저장된 팩' })).toBeVisible();
    await expect(page.getByRole('listitem').first()).toBeVisible();
  });
});
