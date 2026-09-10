import type { SunoEngineProfile, SunoModelFamily } from '../types';

export const SUNO_V6_DEFAULT_PROFILE: SunoEngineProfile = {
  model: 'v6',
  recommendedVariety: 0,
  executionMode: 'standard',
  recommendedMaxMode: false,
  promptCompiler: 'v6',
  stylePromptBudget: 900,
  purpose: 'production'
};

export const SUNO_V6_ENGINE_PROFILES: Record<SunoModelFamily, SunoEngineProfile> = {
  v6: { ...SUNO_V6_DEFAULT_PROFILE },
  'v6-wild': {
    model: 'v6-wild',
    recommendedVariety: 50,
    executionMode: 'standard',
    recommendedMaxMode: false,
    promptCompiler: 'v6',
    stylePromptBudget: 900,
    purpose: 'exploration',
    notes: ['Variety is a recommendation for the Suno UI, not an API control.']
  },
  'v6-mini': {
    model: 'v6-mini',
    recommendedVariety: 0,
    executionMode: 'standard',
    recommendedMaxMode: false,
    promptCompiler: 'v6',
    stylePromptBudget: 900,
    purpose: 'draft'
  }
};

export function resolveSunoEngineProfile(value: unknown): SunoEngineProfile {
  if (!value || typeof value !== 'object') return { ...SUNO_V6_DEFAULT_PROFILE };
  const raw = value as Partial<SunoEngineProfile>;
  if (raw.model !== 'v6' && raw.model !== 'v6-wild' && raw.model !== 'v6-mini') {
    return { ...SUNO_V6_DEFAULT_PROFILE };
  }
  const profile = SUNO_V6_ENGINE_PROFILES[raw.model];
  return {
    ...profile,
    ...(raw.executionMode === 'max' || raw.executionMode === 'standard' ? { executionMode: raw.executionMode } : {}),
    ...(typeof raw.recommendedMaxMode === 'boolean' ? { recommendedMaxMode: raw.recommendedMaxMode } : {})
  };
}

export function effectiveSunoEngineForOptions(opts: { sunoEngine?: unknown }): SunoEngineProfile {
  return resolveSunoEngineProfile(opts.sunoEngine);
}

export function recommendedMaxModeForSong(song: { songRole?: string; durationSec?: number; killingPointText?: string; vocalConsistencyNeeded?: boolean }): boolean {
  const targetSeconds = song.durationSec ?? 0;
  const role = `${song.songRole ?? ''} ${song.killingPointText ?? ''}`.toLowerCase();
  return targetSeconds >= 120 && (
    /flagship|emotional peak|closer|final|high point/.test(role)
    || song.vocalConsistencyNeeded === true
  );
}

export interface SunoV6PromptConstraints {
  genre: string;
  bpm: string;
  vocal: string;
  rhythm?: string;
  instrumentation?: string;
  moneyChord: string;
  structure: string;
  distinctiveProduction?: string;
  scene?: string;
  duration: string;
  optional?: string[];
  budget?: number;
}

function cleanClause(value: string | undefined): string {
  return value?.replace(/\s+/gu, ' ').trim() ?? '';
}

function uniqueClauses(clauses: string[]): string[] {
  const seen = new Set<string>();
  return clauses.filter(clause => {
    const key = clause.toLowerCase();
    if (!clause || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Compile ordered Suno style atoms without cutting a clause in half. */
export function compileSunoStylePromptV6(input: SunoV6PromptConstraints): string {
  const required = [
    input.genre,
    input.bpm,
    input.vocal,
    input.rhythm,
    input.instrumentation,
    input.moneyChord,
    input.structure,
    input.distinctiveProduction,
    input.scene,
    input.duration
  ].map(cleanClause);
  const optional = (input.optional ?? []).map(cleanClause);
  const budget = input.budget ?? SUNO_V6_DEFAULT_PROFILE.stylePromptBudget;
  const result: string[] = [];
  for (const clause of uniqueClauses(required)) {
    result.push(clause);
  }
  for (const clause of uniqueClauses(optional)) {
    const candidate = [...result, clause].join(', ');
    if (candidate.length <= budget) result.push(clause);
  }
  return result.join(', ');
}

export interface SunoV6PromptAudit {
  ok: boolean;
  withinBudget: boolean;
  missingConstraints: string[];
  warnings: string[];
}

export function auditSunoV6Prompt(prompt: string, input: SunoV6PromptConstraints): SunoV6PromptAudit {
  const budget = input.budget ?? SUNO_V6_DEFAULT_PROFILE.stylePromptBudget;
  const required = [input.genre, input.bpm, input.vocal, input.moneyChord, input.structure, input.duration]
    .map(cleanClause)
    .filter(Boolean);
  const missingConstraints = required.filter(clause => !prompt.toLowerCase().includes(clause.toLowerCase()));
  const warnings: string[] = [];
  if (/\[[^\]]+\]/u.test(prompt)) warnings.push('Style prompt contains lyric-like section tags.');
  if (/thumbnail|typography|layout|youtube/iu.test(prompt)) warnings.push('Style prompt contains visual or packaging language.');
  return {
    ok: prompt.length <= budget && missingConstraints.length === 0 && warnings.length === 0,
    withinBudget: prompt.length <= budget,
    missingConstraints,
    warnings
  };
}
