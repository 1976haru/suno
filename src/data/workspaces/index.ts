import type { ChannelArchetype, LyricLanguage, WorkspaceId } from '../../types';

/**
 * v4.0 (TASK A1) — one app, five isolated workspaces. Picking a workspace on
 * the entry screen (see components/WorkspaceSelectScreen.tsx) fully switches
 * the UI and the data underneath it (core/workspaceScope.ts). This file only
 * defines the workspaces' identity/skeleton; A3 fills in
 * defaultAudienceProfileId properly, and B1/C1/D1/E1/F1 fill in each
 * non-senior workspace's real archetypeIds/terms/hiddenFeatures/artistName —
 * see this task's own §10 "다음 문서와의 관계".
 */

export interface WorkspaceTheme {
  accent: string;
  surface: string;
}

export interface WorkspaceDefinition {
  id: WorkspaceId;
  labelKo: string;
  descriptionKo: string;

  /** Channel archetypes available in this workspace. Empty until the workspace's own document fills it in — see `ready` below. */
  archetypeIds: ChannelArchetype[];
  /** data/audienceProfiles.ts id. Provisional for the 4 not-yet-built workspaces (A3 replaces this with a real per-workspace framework). */
  defaultAudienceProfileId: string;
  defaultLyricLanguage: LyricLanguage;

  theme: WorkspaceTheme;
  /** Same feature, different label per workspace (e.g. setLabel: "플레이리스트 세트" vs "동요 묶음"). Looked up via getWorkspaceTerm() — a missing key falls back to the caller-supplied default, never throws. */
  terms: Record<string, string>;
  /** Feature ids to hide in this workspace (conditional rendering only — never deleted code). */
  hiddenFeatures: string[];

  /** DistroKid distribution artist name. Undefined until the workspace is actually built out. */
  artistName?: string;

  /** D1's safety policy reads this. */
  contentTier: 'adult' | 'children';

  /**
   * v4.0 own addition (not in the spec's literal WorkspaceDefinition sketch,
   * needed so the entry screen and App.tsx's routing guard can tell "usable
   * today" apart from "skeleton only, placeholder value") — true only for
   * senior-oldpop until its own B1/C1/D1/E1/F1 document lands.
   */
  ready: boolean;
}

const SENIOR_OLDPOP: WorkspaceDefinition = {
  id: 'senior-oldpop',
  labelKo: '시니어 올드팝',
  descriptionKo: '지금까지 운영해 온 시니어 올드팝 채널 전용 워크스페이스.',
  // Every archetype this app currently ships, unchanged from pre-workspace
  // behavior — this task moves the existing single global workspace as-is,
  // it does not narrow what senior-oldpop can do.
  archetypeIds: ['senior-morning', 'showa-cafe', 'christmas', 'lofi-study', 'kids', 'showa-70s', 'j2000s', 'modern-chill', 'city-night', 'oldpop-lounge'],
  defaultAudienceProfileId: 'senior',
  defaultLyricLanguage: 'english',
  theme: { accent: '#0f766e', surface: '#f6f8fb' },
  terms: {},
  hiddenFeatures: [],
  contentTier: 'adult',
  ready: true
};

const KR_2030: WorkspaceDefinition = {
  id: 'kr-2030',
  labelKo: '한국 20~30대',
  descriptionKo: '한국 20~30대 대상 워크스페이스 — 준비 중 (B1/B2에서 채워집니다).',
  // TASK B1 — genre layer filled in (kr2030GenrePacks, 6 genres). `ready`
  // stays false until B2 (lyric world/hooks/titles/thumbnails/UI) lands —
  // opening this workspace today would still serve the senior lyric
  // dictionary underneath it.
  archetypeIds: ['kr-2030-pop'],
  defaultAudienceProfileId: 'general',
  defaultLyricLanguage: 'korean',
  theme: { accent: '#7c3aed', surface: '#f5f3ff' },
  terms: {},
  hiddenFeatures: [],
  contentTier: 'adult',
  ready: false
};

const JP_2030: WorkspaceDefinition = {
  id: 'jp-2030',
  labelKo: '일본 20~30대',
  descriptionKo: '일본 20~30대 대상 워크스페이스 — 준비 중 (C1/C2에서 채워집니다).',
  archetypeIds: [],
  defaultAudienceProfileId: 'general',
  defaultLyricLanguage: 'japanese',
  theme: { accent: '#db2777', surface: '#fdf2f8' },
  terms: {},
  hiddenFeatures: [],
  contentTier: 'adult',
  ready: false
};

const KR_KIDS: WorkspaceDefinition = {
  id: 'kr-kids',
  labelKo: '한국 동요',
  descriptionKo: '한국 동요 워크스페이스 — 준비 중 (D1/E1에서 채워집니다).',
  archetypeIds: [],
  defaultAudienceProfileId: 'kids',
  defaultLyricLanguage: 'korean',
  theme: { accent: '#f59e0b', surface: '#fffbeb' },
  terms: {},
  hiddenFeatures: [],
  contentTier: 'children',
  ready: false
};

const JP_KIDS: WorkspaceDefinition = {
  id: 'jp-kids',
  labelKo: '일본 동요',
  descriptionKo: '일본 동요 워크스페이스 — 준비 중 (F1에서 채워집니다).',
  archetypeIds: [],
  defaultAudienceProfileId: 'kids',
  defaultLyricLanguage: 'japanese',
  theme: { accent: '#0ea5e9', surface: '#f0f9ff' },
  terms: {},
  hiddenFeatures: [],
  contentTier: 'children',
  ready: false
};

export const workspaceDefinitions: WorkspaceDefinition[] = [SENIOR_OLDPOP, KR_2030, JP_2030, KR_KIDS, JP_KIDS];

const BY_ID = new Map(workspaceDefinitions.map(w => [w.id, w]));

export function getWorkspace(id: WorkspaceId): WorkspaceDefinition {
  const found = BY_ID.get(id);
  if (found) return found;
  // Defensive fallback only — every WorkspaceId union member has a matching
  // entry above; this path exists so a corrupted/foreign stored id (e.g. an
  // old localStorage value from a future version) never crashes the app.
  return SENIOR_OLDPOP;
}

/** terms lookup — a missing key falls back to the caller-supplied default rather than throwing or rendering blank (this task's own §6-1 "값이 없으면 기본값 사용"). */
export function getWorkspaceTerm(workspace: WorkspaceDefinition, key: string, fallback: string): string {
  return workspace.terms[key] ?? fallback;
}

export function isFeatureHidden(workspace: WorkspaceDefinition, featureId: string): boolean {
  return workspace.hiddenFeatures.includes(featureId);
}
