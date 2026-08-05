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
   * TASK K2 §10-5 — a place to record what human editing/arrangement/mixing
   * decisions went into a workspace's output, in case content-authenticity
   * regulation eventually requires it (K1 §12's own note: this is the one
   * item worth preparing a home for ahead of time, since "인간의 창작 개입"
   * is likely to stay a requirement even after distribution rules loosen).
   * Deliberately just a free-text slot with no collection/recording feature
   * behind it yet (§10-5's own explicit "과하게 만들지 마십시오, 자리만
   * 잡습니다") — undefined for every workspace until an actual requirement
   * exists to wire it up to.
   */
  humanCreativeInterventionNote?: string;

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
  // TASK B1 — genre layer filled in (kr2030GenrePacks, 6 genres).
  // TASK B2 — lyric world (18 scenes), hook bank (kr2030Override, all 6
  // fields, 0 vocabulary overlap with the senior default), 3 thumbnail
  // archetypes, 6 concept-keyword rules, and 3 channel presets all filled
  // in and verified (18-song real generation: 0/18 titles carry senior
  // vocabulary, 18/18 unique titles and hooks). terms/hiddenFeatures stay
  // {}/[] — no UI currently reads WorkspaceDefinition.terms or
  // .hiddenFeatures at all (grep-verified zero callers), so there is
  // nothing real to put there yet; see this task's own §12-4.
  archetypeIds: ['kr-2030-pop'],
  defaultAudienceProfileId: 'general',
  defaultLyricLanguage: 'korean',
  theme: { accent: '#7c3aed', surface: '#f5f3ff' },
  terms: {},
  hiddenFeatures: [],
  contentTier: 'adult',
  ready: true
};

const JP_2030: WorkspaceDefinition = {
  id: 'jp-2030',
  labelKo: '일본 20~30대',
  descriptionKo: '일본 20~30대 대상 워크스페이스 — 帰り道の令和J-POP.',
  // TASK C1 — genre layer filled in (jp2030GenrePacks, 7 genres).
  // TASK C2 — lyric world (18 scenes), hook bank (jp2030Override, all 6
  // fields, 0 vocabulary overlap with BOTH senior Japanese dictionaries —
  // japaneseDefault and showaCafeOverride), 3 thumbnail archetypes, 9
  // concept-keyword rules, and 3 channel presets all filled in and
  // verified (18-song real generation: 0/18 titles carry senior/showa
  // imagery, 18/18 unique titles and hooks — see docs/c2-report.md).
  // terms/hiddenFeatures stay {}/[] — no UI currently reads
  // WorkspaceDefinition.terms or .hiddenFeatures at all (same grep-verified
  // zero-callers finding B2's own KR_2030 comment made), so there is
  // nothing real to put there yet. `ready: true` set last, only after
  // npm run audit:isolation showed jp-2030 PASS across L1/L3/L4/L6 (was
  // SKIP throughout before this task) and npm run test:fast passed clean.
  archetypeIds: ['jp-2030-pop'],
  defaultAudienceProfileId: 'general',
  defaultLyricLanguage: 'japanese',
  theme: { accent: '#db2777', surface: '#fdf2f8' },
  terms: {},
  hiddenFeatures: [],
  contentTier: 'adult',
  ready: true
};

const KR_KIDS: WorkspaceDefinition = {
  id: 'kr-kids',
  labelKo: '한국 동요',
  // TASK E1 — genre (7)/lyric themes (22)/hook bank (9/9)/thumbnails (4)/
  // concept keywords (7)/channel presets (3) all landed; see docs/e1-report.md.
  descriptionKo: '한국 동요 워크스페이스 — 장르 7종, 교육 주제 동요, 한영 이중언어 지원',
  // TASK D1 §3-2/§5 — Approach A (per user decision): own archetype, not the
  // senior workspace's shared 'kids'.
  archetypeIds: ['kr-kids-song'],
  defaultAudienceProfileId: 'kids',
  defaultLyricLanguage: 'korean',
  theme: { accent: '#f59e0b', surface: '#fffbeb' },
  terms: {},
  hiddenFeatures: [],
  // TASK E1 §9-3 — DistroKid distribution requires its own artist name for
  // kids content; "하루 님 결정 필요", not invented — see docs/e1-report.md §13-4[A].
  artistName: undefined,
  contentTier: 'children',
  // TASK E1 §9-2 — flipped true as the last step, after the full
  // verification battery in docs/e1-report.md passed.
  ready: true
};

const JP_KIDS: WorkspaceDefinition = {
  id: 'jp-kids',
  labelKo: '일본 동요',
  // TASK F1 — genre (7)/lyric themes (23)/onomatopoeia (26)/hook bank (9/9)/
  // thumbnails (4)/concept keywords (7)/channel presets (3) all landed; see docs/f1-report.md.
  descriptionKo: '일본 동요 워크스페이스 — 장르 7종, 의성어 시스템, 일영 이중언어 지원',
  // TASK D1 §3-2/§5 — Approach A (per user decision): own archetype, not the
  // senior workspace's shared 'kids'.
  archetypeIds: ['jp-kids-song'],
  defaultAudienceProfileId: 'kids',
  defaultLyricLanguage: 'japanese',
  theme: { accent: '#0ea5e9', surface: '#f0f9ff' },
  terms: {},
  hiddenFeatures: [],
  // TASK F1 §9-4 — DistroKid distribution requires its own artist name for
  // jp-kids content, separate from kr-kids's own; "하루 님 결정 필요", not
  // invented — see docs/f1-report.md §13-4[A].
  artistName: undefined,
  contentTier: 'children',
  // TASK F1 §9-3 — flipped true as the last step, after the full
  // verification battery in docs/f1-report.md passed.
  ready: true
};

const KR_IDOL_M: WorkspaceDefinition = {
  id: 'kr-idol-male',
  labelKo: '한국 남자 아이돌',
  // TASK K2 — genre (7, shared with the future kr-idol-female)/section-genre-
  // plan presets (6, K1's engine)/lyric themes (18)/hook bank (9/9)/
  // thumbnails (3)/concept keywords (10)/channel presets (3) all landed;
  // see docs/k2-report.md. Vocal quota override ({male:15,female:0,mixed:3})
  // is this workspace's own core deliverable (§5) — see that report for the
  // real measured before/after.
  descriptionKo: '한국 남자 아이돌 워크스페이스 — 장르 7종, 구간별 장르 배정, 그룹 보컬 파트 지원',
  archetypeIds: ['kr-idol-male'],
  // TASK A3 hasn't built a real per-workspace audience-profile framework yet
  // (kr-2030/jp-2030's own KR_2030/JP_2030 comments already note this same
  // gap) — 'general' is the same provisional placeholder those two use.
  defaultAudienceProfileId: 'general',
  defaultLyricLanguage: 'korean',
  theme: { accent: '#dc2626', surface: '#fef2f2' },
  terms: {},
  hiddenFeatures: [],
  // TASK K2 §10-4 — DistroKid distribution requires its own artist name for
  // idol content, separate from every other workspace's own; "하루 님 결정
  // 필요", not invented — see docs/k2-report.md's own decision-pending list.
  artistName: undefined,
  contentTier: 'adult',
  // TASK K2 §10-5 — structure only, not collected anywhere yet.
  humanCreativeInterventionNote: undefined,
  // TASK K2 §13 item 16 — flipped true as the last step, after the full
  // verification battery in docs/k2-report.md passed.
  ready: true
};

export const workspaceDefinitions: WorkspaceDefinition[] = [SENIOR_OLDPOP, KR_2030, JP_2030, KR_KIDS, JP_KIDS, KR_IDOL_M];

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
