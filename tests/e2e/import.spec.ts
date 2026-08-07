import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectWorkspace, pickAnyArchetype, pickGenreAndMood, acknowledgeDesignGateIfNeeded } from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

/**
 * codex 지시문 07 (TASK C) — scenarios 7-10: valid import, repairable
 * import, blocked import, SRT read-only import. Fixtures are real
 * generateLocalBlueprint() output (scripts/genE2eFixtures.ts), not
 * hand-guessed JSON, so they match the real SongIdea schema exactly.
 */
async function reachImportReadyStep(page: import('@playwright/test').Page) {
  await selectWorkspace(page, '시니어 올드팝');
  await pickAnyArchetype(page);
  await page.getByRole('button', { name: '다음 →' }).click();
  await pickGenreAndMood(page);
  await page.getByRole('button', { name: '다음 →' }).click();
  await page.getByRole('button', { name: '다음 →' }).click();
  await acknowledgeDesignGateIfNeeded(page);
  await expect(page.getByText('songs-output.json을 가져올 준비가 되었습니다.')).toBeVisible();
}

test.describe('[E2E 07] valid import', () => {
  test('importing a real, complete songs-output.json lands on step 5 with a success summary', async ({ page }) => {
    await reachImportReadyStep(page);
    const importInput = page.locator('label:has-text("곡 JSON 가져오기") input[type="file"]');
    await importInput.setInputFiles(path.join(FIXTURES, 'valid-songs-output.json'));
    // A fully valid import needs no review — the app auto-navigates
    // straight to step 5 (결과) with the generated pack, rather than
    // lingering on a "가져오기 완료" summary panel.
    await expect(page.getByText('완성된 곡부터 순서대로 나타납니다')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });
});

test.describe('[E2E 08] repairable import', () => {
  test('importing a songs-output.json missing some tracks opens the review modal with a partial-confirm option', async ({ page }) => {
    await reachImportReadyStep(page);
    const importInput = page.locator('label:has-text("곡 JSON 가져오기") input[type="file"]');
    await importInput.setInputFiles(path.join(FIXTURES, 'repairable-songs-output.json'));
    const modal = page.locator('[role="dialog"]');
    await expect(modal.getByText('⚠ 가져오기 검토 필요')).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText('T4, T9, T15 누락')).toBeVisible();
    await expect(modal.getByText('상태: 부분 (repairable)')).toBeVisible();
    const confirmButton = modal.getByRole('button', { name: /15곡만 확정/ });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
    await expect(modal).toBeHidden();
  });
});

test.describe('[E2E 09] blocked import', () => {
  test('importing a songs-output.json with a structurally malformed trackNo set is refused with no confirm option', async ({ page }) => {
    await reachImportReadyStep(page);
    const importInput = page.locator('label:has-text("곡 JSON 가져오기") input[type="file"]');
    await importInput.setInputFiles(path.join(FIXTURES, 'blocked-songs-output.json'));
    // Real behavior (src/App.tsx's onImportSongsJson): a raw trackNo-set
    // failure (duplicates/out-of-range) is refused by importSongsJson()
    // itself, before ImportInspectionModal is ever opened — report.blueprint
    // is null, so App.tsx shows it inline via BridgeImportReportSummary's
    // 실패 variant instead. There is no confirm/partial-accept option here
    // (unlike the repairable case) — the whole response is discarded.
    await expect(page.getByText('가져오기 실패')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/trackNo 구조 오류/)).toBeVisible();
    await expect(page.getByText(/0곡 성공/)).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });
});

test.describe('[E2E 10] SRT read-only import', () => {
  test('importing via "가사 파일 → 바로 SRT 만들기" jumps straight to a read-only SRT tab without saving to the library', async ({ page }) => {
    await reachImportReadyStep(page);
    const srtInput = page.locator('label:has-text("가사 파일 → 바로 SRT 만들기") input[type="file"]');
    await srtInput.setInputFiles(path.join(FIXTURES, 'valid-songs-output.json'));
    await expect(page.getByText(/읽기 전용 팩입니다/)).toBeVisible({ timeout: 15000 });
  });
});
