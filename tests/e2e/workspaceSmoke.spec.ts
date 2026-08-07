import { test, expect } from '@playwright/test';
import { WORKSPACE_LABELS, selectWorkspace, pickAnyArchetype, pickGenreAndMood, acknowledgeDesignGateIfNeeded } from './helpers';

/**
 * codex 지시문 07 (TASK C) — smoke tests for all 7 workspaces: each one can
 * be entered, walked through channel -> concept -> design -> generate
 * without a hard crash, reaching a real, enabled generate button. Not a
 * full per-workspace policy test (that's tests/*.test.ts's job) — this is
 * the E2E floor: "the wizard doesn't break for this workspace."
 */
for (const [workspaceId, label] of Object.entries(WORKSPACE_LABELS)) {
  test(`[E2E smoke] ${workspaceId} (${label}) — channel to generate-ready without crashing`, async ({ page }) => {
    await selectWorkspace(page, label);
    await expect(page.getByRole('button', { name: new RegExp(`^${label} · 전환`) })).toBeVisible();

    await pickAnyArchetype(page);
    // Kids workspaces show a one-time informational banner with its own
    // dismiss button before the rest of the step is interactable.
    const kidsAck = page.getByRole('button', { name: '확인했어요' });
    if (await kidsAck.isVisible({ timeout: 1000 }).catch(() => false)) {
      await kidsAck.click();
    }
    await page.getByRole('button', { name: '다음 →' }).click();

    await pickGenreAndMood(page);
    await page.getByRole('button', { name: '다음 →' }).click();
    await page.getByRole('button', { name: '다음 →' }).click();
    await acknowledgeDesignGateIfNeeded(page);

    const generateButton = page.getByRole('button', { name: /곡 생성하기/ }).last();
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
  });
}
