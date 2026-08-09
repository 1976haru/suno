import type { PackGeneratedBy } from '../types';

/**
 * 지시문 18 (TASK C-2) — "가져오기 화면에서 한 번 선택한다. 기본값은 직전에
 * 고른 값(매번 고르는 부담을 줄인다)." 워크스페이스와 무관하게 전역으로
 * 기억한다 — 어느 코딩 에이전트를 쓰는지는 워크스페이스가 아니라 지금 이
 * 세션의 습관이기 때문이다(core/recentGenreStore.ts처럼 scopedKey로
 * 워크스페이스별로 나누지 않는 이유).
 */
const STORAGE_KEY = 'suno-weaver-generated-by-last';

export function readLastGeneratedByChoice(): PackGeneratedBy | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && ALLOWED_VALUES.has(value as PackGeneratedBy) ? (value as PackGeneratedBy) : undefined;
  } catch {
    return undefined;
  }
}

export function rememberGeneratedByChoice(value: PackGeneratedBy) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Convenience only — blocked storage should not break import.
  }
}

const ALLOWED_VALUES = new Set<PackGeneratedBy>(['claude-code', 'codex', 'fable-5', 'api-direct', 'local', 'other']);
