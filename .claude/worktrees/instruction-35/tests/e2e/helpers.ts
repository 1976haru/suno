import type { Page } from '@playwright/test';

/**
 * codex 지시문 07 (TASK C) — shared real selectors/flows for the E2E suite.
 * Selector strategy matches the app's own real DOM conventions (confirmed
 * via direct source read, not guessed): almost no data-testid anywhere, so
 * tests match on real visible Korean text via getByRole/getByText, exactly
 * as a real user would.
 */
export const WORKSPACE_LABELS: Record<string, string> = {
  'senior-oldpop': '시니어 올드팝',
  'kr-2030': '한국 20~30대',
  'jp-2030': '일본 20~30대',
  'kr-kids': '한국 동요',
  'jp-kids': '일본 동요',
  'kr-idol-male': '한국 남자 아이돌',
  'kr-idol-female': '한국 여자 아이돌'
};

/** Real app behavior (src/core/workspaceMigration.ts's isMigrationPending):
 * a brand-new browser profile with zero localStorage always shows the
 * migration-backup prompt first, even with no legacy data to migrate — a
 * genuinely fresh user sees this exact screen once. Every fresh-context
 * test must dismiss it (건너뛰고 계속, matching a user with nothing to back
 * up) before the real WorkspaceSelectScreen renders. */
export async function dismissMigrationPromptIfPresent(page: Page): Promise<void> {
  const skipButton = page.getByRole('button', { name: '건너뛰고 계속' });
  if (await skipButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipButton.click();
  }
}

export async function selectWorkspace(page: Page, label: string): Promise<void> {
  await page.goto('/');
  await dismissMigrationPromptIfPresent(page);
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

export async function pickAnyArchetype(page: Page): Promise<void> {
  await page.locator('.genre-card-choice').first().click();
}

export async function pickGenreAndMood(page: Page): Promise<void> {
  // Step2Concept: primary genre card (first `.genre-card-choice` under the
  // "어떤 장르로 만들까요?" section) + at least one mood chip.
  const genreHeading = page.getByRole('heading', { name: '어떤 장르로 만들까요?' });
  await genreHeading.scrollIntoViewIfNeeded();
  await page.locator('.genre-card-choice').first().click();
  const moodHeading = page.getByRole('heading', { name: /어떤 분위기로 만들까요/ });
  await moodHeading.scrollIntoViewIfNeeded();
  await page.locator('.chips .chip').first().click();
}

/** Navigates from a freshly-selected workspace (step 1) through channel
 * pick + genre/mood pick to step 3 (설계안), where a design gate result
 * is rendered. */
export async function goToDesignStep(page: Page): Promise<void> {
  await pickAnyArchetype(page);
  await page.getByRole('button', { name: '다음 →' }).click();
  await pickGenreAndMood(page);
  await page.getByRole('button', { name: '다음 →' }).click();
}

/** Real, expected behavior: which genre-family combo a test lands on (via
 * pickGenreAndMood's "click the first card" strategy) can occasionally mix
 * >4 palette families for a given archetype's own defaults, tripping the
 * real 관문 1 (design gate) advisory block — a genuine, intentional gate,
 * not a bug (see this repo's own [[gotcha_palette_family_coupling]] memory).
 * A real user facing this acknowledges it via "그래도 이대로 진행하기" to
 * proceed; tests that only care about reaching the generate button do the
 * same, rather than asserting on which exact combo was rolled. */
export async function acknowledgeDesignGateIfNeeded(page: Page): Promise<void> {
  const ackButton = page.getByRole('button', { name: '그래도 이대로 진행하기' });
  if (await ackButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ackButton.click();
  }
}
