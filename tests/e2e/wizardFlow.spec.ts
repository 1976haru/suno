import { test, expect } from '@playwright/test';
import { selectWorkspace, pickAnyArchetype, openChannelManager, dismissMigrationPromptIfPresent, acknowledgeDesignGateIfNeeded, goToDesignStep } from './helpers';

/**
 * codex 지시문 07 (TASK C) — scenarios 1-6: workspace select, channel select,
 * user option change, contract check, generation preflight, bridge
 * instruction generation. Each test starts from a fresh browser context
 * (Playwright default) so WorkspaceSelectScreen always shows first.
 *
 * 지시문 41 (TASK A) — 워크스페이스를 고르면 더 이상 별도 "채널" 단계를
 * 거치지 않고 곧바로 컨셉 화면(마법사 1단계)으로 간다 — 채널 선택기는 그
 * 화면 상단으로 옮겼다. 이 파일 전체를 그 새 흐름에 맞춰 갱신했다: E2E 01은
 * "채널" 화면 대신 컨셉 화면(채널 선택기 포함)이 뜨는지 확인하고, E2E 02는
 * 컨셉 화면 채널 선택기 자체를 검증하는 시나리오로, 03~06은 pickAnyArchetype
 * + 다음(구 1→2단계 전환) 호출을 없애 goToDesignStep 하나로 단순화했다.
 */

test.describe('[E2E 01] workspace select', () => {
  test('selecting a workspace card enters the wizard at step 1 (컨셉), channel picker included', async ({ page }) => {
    await page.goto('/');
    await dismissMigrationPromptIfPresent(page);
    await expect(page.getByRole('heading', { name: '어떤 작업을 하시겠어요?' })).toBeVisible();
    await page.getByRole('button', { name: /^시니어 올드팝/ }).click();
    await expect(page.getByRole('button', { name: /시니어 올드팝 · 전환/ })).toBeVisible();
    // 지시문 41 (TASK A) — 채널 화면이 아니라 컨셉 화면(상단 채널 선택기 포함)이 바로 뜬다.
    await expect(page.getByRole('heading', { name: '🎬 채널' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '어떤 장르로 만들까요?' })).toBeVisible();
  });
});

test.describe('[E2E 02] channel select', () => {
  test('picking a channel in the concept-screen picker switches the active channel', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    const options = page.locator('.channel-picker-option');
    const first = options.nth(0);
    const second = options.nth(1);
    await expect(first).toHaveClass(/active/);
    const secondName = await second.locator('.channel-picker-name').innerText();
    await second.click();
    // App.tsx의 cm.selectChannel 단일 경로 — 픽커의 active 표시와 사이드바
    // <select>가 항상 같은 selectedChannelId를 공유하므로, 둘 다 새 채널로 바뀐다.
    await expect(second).toHaveClass(/active/);
    await expect(first).not.toHaveClass(/active/);
    const sidebarSelect = page.locator('.app-sidebar select');
    await expect(sidebarSelect.locator('option:checked')).toHaveText(secondName);
  });

  test('"채널 관리" opens the channel editor overlay and can close back to the concept screen', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    await openChannelManager(page);
    await pickAnyArchetype(page);
    await page.getByRole('button', { name: '닫기' }).click();
    await expect(page.getByRole('heading', { name: '🎬 채널' })).toBeVisible();
  });
});

test.describe('[E2E 03] user option change', () => {
  test('changing song count updates the generate button label', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    await goToDesignStep(page);
    // Step 2 (설계안) -> Step 3 (생성) has the real song-count control.
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
    await goToDesignStep(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await expect(page.getByRole('heading', { name: '이대로 생성합니다' })).toBeVisible();
    await expect(page.locator('dl.contract-summary-list')).toBeVisible();
  });
});

test.describe('[E2E 05] generation preflight', () => {
  test('the generate button is enabled once a valid channel+genre+mood combination is chosen', async ({ page }) => {
    await selectWorkspace(page, '시니어 올드팝');
    await goToDesignStep(page);
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
    await goToDesignStep(page);
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
