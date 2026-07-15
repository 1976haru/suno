import type { ProviderSettings } from '../types';
import { DEFAULT_ANTHROPIC_MODEL, MODEL_REGISTRY } from '../data/modelRegistry';

/**
 * TASK D (v3.5) — the user explicitly asked for the app to say, in-context,
 * "이 부분은 API 추천입니다" instead of leaving every API decision to guesswork.
 * This is a pure, static advisory table plus a small amount of real stage
 * routing — it does not call any API itself.
 *
 * Cost framing correction (v3.5): a full 18-week x 12-song season (216
 * songs) is roughly 0.1-0.3M tokens total. At any current public per-token
 * rate that's a few dollars, not a budget concern — so this module never
 * frames API usage as something to avoid. It also never hardcodes a
 * per-token price (see costEstimator.ts) since provider pricing changes.
 */
export type ApiRecommendation = 'essential' | 'valuable' | 'optional' | 'unnecessary';

export type StageId = 'lyrics' | 'evaluation' | 'thumbnailCopy' | 'stylePrompt' | 'songStructure' | 'thumbnailImage' | 'conceptAgent';

export interface StageAdvice {
  stage: StageId;
  labelKo: string;
  recommendation: ApiRecommendation;
  suggestedModelKo: string;
  reasonKo: string;
}

export const RECOMMENDATION_BADGE: Record<ApiRecommendation, { emoji: string; labelKo: string }> = {
  essential: { emoji: '🟢', labelKo: 'API 추천 (핵심)' },
  valuable: { emoji: '🔵', labelKo: 'API 추천' },
  optional: { emoji: '⚪', labelKo: '선택' },
  unnecessary: { emoji: '⛔', labelKo: 'API 불필요' }
};

/** The full advisory table (TASK D1). Only "lyrics" and "evaluation" map to a real, routable API call in this app today (see StageModelSettings below) — the rest are informational, explaining why the current behavior (local/no-API) already is the recommendation. */
export const STAGE_ADVICE: Record<StageId, StageAdvice> = {
  lyrics: {
    stage: 'lyrics',
    labelKo: '가사·훅·제목',
    recommendation: 'essential',
    suggestedModelKo: 'Sonnet',
    reasonKo: '로컬은 조합형이라 표현이 단조롭습니다. 훅·제목·가사가 채널 성패를 가르므로 API를 쓸 가장 중요한 곳입니다.'
  },
  evaluation: {
    stage: 'evaluation',
    labelKo: '평가',
    recommendation: 'valuable',
    suggestedModelKo: 'Haiku',
    reasonKo: '30곡 중 뭘 쓸지 골라주는 채점 작업입니다. Haiku로 충분하고 Sonnet보다 훨씬 저렴합니다.'
  },
  thumbnailCopy: {
    stage: 'thumbnailCopy',
    labelKo: '썸네일 문구',
    recommendation: 'valuable',
    suggestedModelKo: 'Haiku (현재는 규칙 기반 무료 생성)',
    reasonKo: '클릭률에 직결되지만 출력이 200토큰 이하라 API를 써도 거의 공짜입니다. 지금은 규칙 기반으로 이미 무료 생성되고 있습니다.'
  },
  stylePrompt: {
    stage: 'stylePrompt',
    labelKo: '스타일 프롬프트',
    recommendation: 'unnecessary',
    suggestedModelKo: '로컬',
    reasonKo: '로컬 결과가 이미 충분히 좋습니다. API를 써도 개선이 크지 않습니다.'
  },
  songStructure: {
    stage: 'songStructure',
    labelKo: '곡 구조·BPM',
    recommendation: 'unnecessary',
    suggestedModelKo: '로컬',
    reasonKo: '규칙으로 충분합니다.'
  },
  thumbnailImage: {
    stage: 'thumbnailImage',
    labelKo: '썸네일 이미지',
    recommendation: 'unnecessary',
    suggestedModelKo: '외부 (Canva 등)',
    reasonKo: '이 앱은 이미지를 직접 만들지 않습니다. 이미지 생성 프롬프트만 제공합니다.'
  },
  // TASK H5 (v3.10) — concept agent's local keyword match always runs first
  // and free for every user (including the '무료로만' preset); the API path
  // only ever refines that same guess, with output capped at ~80 tokens on
  // Haiku, so it stays effectively free even for a channel opening 216 songs.
  conceptAgent: {
    stage: 'conceptAgent',
    labelKo: '컨셉 추천 에이전트',
    recommendation: 'valuable',
    suggestedModelKo: 'Haiku (로컬 키워드 매칭이 기본, API는 선택 보강)',
    reasonKo: '자연어 한 줄을 장르/무드/시즌 조합으로 번역해주는 보조 기능입니다. 출력이 짧아 Haiku로도 충분하고, 로컬 매칭만으로도 항상 결과가 나옵니다.'
  }
};

// ---------------------------------------------------------------------------
// TASK D3 — real per-stage model routing (lyrics + evaluation only, the two
// stages that actually have a remote API call path in this app).
// ---------------------------------------------------------------------------

export type ModelChoice = 'local' | 'sonnet' | 'haiku';

export interface StageModelSettings {
  lyrics: ModelChoice;
  evaluation: ModelChoice;
}

// TASK F1 (v3.6) — read from the single model registry instead of a second hardcoded copy.
const MODEL_ID: Record<'sonnet' | 'haiku', string> = {
  sonnet: MODEL_REGISTRY.anthropic.find(m => m.tier === 'balanced')?.id ?? DEFAULT_ANTHROPIC_MODEL,
  haiku: MODEL_REGISTRY.anthropic.find(m => m.tier === 'fast')?.id ?? DEFAULT_ANTHROPIC_MODEL
};

/** Applies a stage's ModelChoice onto a base ProviderSettings, producing the actual settings object to hand to a specific call site (generateBlueprint for 'lyrics', evaluatePack for 'evaluation'). */
export function resolveStageSettings(choice: ModelChoice, base: ProviderSettings): ProviderSettings {
  if (choice === 'local') return { ...base, provider: 'local' };
  return { ...base, provider: 'anthropic', model: MODEL_ID[choice] };
}

export type ApiPresetId = 'freeOnly' | 'recommended' | 'qualityFirst';

export interface ApiPreset {
  id: ApiPresetId;
  labelKo: string;
  descriptionKo: string;
  stageModels: StageModelSettings;
}

/** TASK D3 — three one-click presets; "recommended" is the default. */
export const API_PRESETS: Record<ApiPresetId, ApiPreset> = {
  freeOnly: {
    id: 'freeOnly',
    labelKo: '💰 무료로만',
    descriptionKo: '전부 로컬 — API 호출 없음',
    stageModels: { lyrics: 'local', evaluation: 'local' }
  },
  recommended: {
    id: 'recommended',
    labelKo: '⭐ 추천',
    descriptionKo: '가사·훅 → Sonnet, 평가 → Haiku',
    stageModels: { lyrics: 'sonnet', evaluation: 'haiku' }
  },
  qualityFirst: {
    id: 'qualityFirst',
    labelKo: '🎯 품질 최우선',
    descriptionKo: '전부 Sonnet',
    stageModels: { lyrics: 'sonnet', evaluation: 'sonnet' }
  }
};

export const DEFAULT_STAGE_MODELS: StageModelSettings = API_PRESETS.recommended.stageModels;
