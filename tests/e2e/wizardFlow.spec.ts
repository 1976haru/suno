import { test, expect } from '@playwright/test';
import { selectWorkspace, pickAnyArchetype, pickGenreAndMood, dismissMigrationPromptIfPresent, acknowledgeDesignGateIfNeeded } from './helpers';

/**
 * codex 지시문 07 (TASK C) — scenarios 1-6: workspace select, channel select,
 * user option change, contract check, generation preflight, bridge
 * instruction generation. Each test starts from a fresh browser context
 * (Playwright default) so WorkspaceSelectScreen always shows first.
 */

test.describe('[E2E 01] workspace select', () => {
  test('selecting a workspace card enters the wizard at step 1 (채널)', async ({ page }) => {
    await page.goto('/');
    await dismissMigrationPromptIfPresent(page);
    await expect(page.getByRole('heading', { name: '어떤 작업을 하시겠어요?' })).toBeVisible();
    await page.getByRole('button', { name: /^시니어 올드팝/ }).click();
    await expect(page.getByRole('button', { name: /시니어 올드팝 · 전환/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /어떤 채널인가요|Choose a channel/ })).toBeVisible();
  });
});

test.describe('[E2E 02] channel select', () => {
  test('picking an archetype card marks it active and unlocks 다음', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    const card = page.locator('.genre-card-choice').first();
    await card.click();
    await expect(card).toHaveClass(/active/);
    await page.getByRole('button', { name: '다음 →' }).click();
    await expect(page.getByRole('heading', { name: /어떤 장르로 만들까요/ })).toBeVisible();
  });
});

test.describe('[E2E 03] user option change', () => {
  test('changing song count updates the generate button label', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    await pickAnyArchetype(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await pickGenreAndMood(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    // Step 3 (설계안) -> Step 4 (생성) has the real song-count control.
    await page.getByRole('button', { name: '다음 →' }).click();
    await acknowledgeDesignGateIfNeeded(page);
    const songCountChip = page.getByRole('button', { name: '5곡', exact: true });
    await songCountChip.click();
    await expect(page.getByRole('button', { name: /5곡 생성하기/ }).first()).toBeVisible();
  });
});

test.describe('[E2E 04] contract check', () => {
  test('the generation contract panel lists the effective settings before generating', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    await pickAnyArchetype(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await pickGenreAndMood(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await page.getByRole('button', { name: '다음 →' }).click();
    await expect(page.getByRole('heading', { name: '이대로 생성합니다' })).toBeVisible();
    await expect(page.locator('dl.contract-summary-list')).toBeVisible();
  });
});

test.describe('[E2E 05] generation preflight', () => {
  test('the generate button is enabled once a valid channel+genre+mood combination is chosen', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    await pickAnyArchetype(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await pickGenreAndMood(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await page.getByRole('button', { name: '다음 →' }).click();
    await acknowledgeDesignGateIfNeeded(page);
    const generateButton = page.getByRole('button', { name: /곡 생성하기/ }).last();
    await expect(generateButton).toBeEnabled();
  });
});

test.describe('[E2E 06] bridge instruction generation', () => {
  test('copying the Claude Code bridge instruction writes real text to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await selectWorkspace(page, '시니어 올드팝');
    await pickAnyArchetype(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await pickGenreAndMood(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await page.getByRole('button', { name: '다음 →' }).click();
    await expect(page.getByRole('heading', { name: 'Claude Code 브릿지 (API 비용 0)' })).toBeVisible();
    await acknowledgeDesignGateIfNeeded(page);
    const copyButton = page.getByRole('button', { name: 'Claude Code용 지시문 복사' });
    await expect(copyButton).toBeEnabled();
    await copyButton.click();
    await expect(page.getByRole('button', { name: /복사됨/ })).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.length).toBeGreaterThan(50);
  });
});
