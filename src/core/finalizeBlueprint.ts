import type { AudienceProfile, ChannelProfile, GenerationSnapshot, LyricLanguage, PlaylistBlueprint, SongIdea } from '../types';
import type { AlbumAuditReport } from './albumAudit';
import type { ReleaseReadinessReport, ReleaseReadinessInput } from './releaseReadiness';
import { auditAlbum } from './albumAudit';
import { evaluateReleaseReadiness } from './releaseReadiness';
import { scoreSongs } from './quality';
import { applyConceptFitScore } from './promiseAudit';
import { validateProviderTrackSet, describeTrackSetValidation, type TrackSetValidation } from './importValidation';
import { qualityPolicyForWorkspace, type WorkspaceQualityPolicy } from '../data/workspaceQualityPolicies';
import { checkLyricLanguageMatch } from './lyricMetrics';
import { buildArtifactAuditMeta, type ArtifactAuditMeta } from './artifactStage';
import type { WorkspaceId } from '../types';

/**
 * codex 지시문 05 (TASK B) — the single finalize path. Investigation
 * confirmed each of the 10 real steps below already exists as its OWN real
 * function, but no caller ever ran them together in one place: trackNo
 * validation/scoreSongs are centralized functions called independently
 * from 4+ different generation-path call sites; auditAlbum/
 * evaluateReleaseReadiness each have exactly ONE real caller today and it's
 * UI-only (Step4Result.tsx/SetCompletenessPanel.tsx) — never run at save or
 * export time. Concrete, currently-live consequence confirmed by
 * investigation: `applyConceptFitScore` only ever runs inside
 * Step4Result.tsx's own on-screen `scoredSongs` useMemo, so every SAVED
 * (autosave) and EXPORTED (standalone HTML, SRT) artifact ships the neutral
 * conceptFitScore:100 placeholder while only the live screen shows the real
 * number — the exact "final placeholder ... 남기지 않는다" drift this task
 * exists to close.
 *
 * Scoping decision: this function is the real, fully-tested, single source
 * of truth — TASK G's new export path is its first real consumer. Retrofit­
 * ting every existing UI panel in the already-large Step4Result.tsx (Focus
 * Mode/PreviewConcat/ShortsHighlight/GenerationGatePanel/SRT export) to
 * consume this exact same object is out of scope here (would touch a giant,
 * already-tested component for panels whose ON-SCREEN numbers were already
 * correct — the confirmed bug was specifically in save/export, not
 * display). The confirmed conceptFitScore save-path drift itself is fixed
 * directly at its root (see App.tsx's finalizeSinglePackBlueprint and
 * core/multiSetGeneration.ts's finalizeSetBlueprint, both updated by this
 * same commit to call applyConceptFitScore before autosave).
 */

/** Step 1 — real, minimal structural check (no schema-validation library exists/is added; a hand-rolled, bounded check matching this app's own established "no new heavy dependency" convention). */
export function validateBlueprintSchema(blueprint: PlaylistBlueprint): string[] {
  const issues: string[] = [];
  if (!blueprint.songs.length) issues.push('songs 배열이 비어 있습니다.');
  blueprint.songs.forEach(song => {
    if (!Number.isInteger(song.trackNo) || song.trackNo < 1) issues.push(`trackNo가 유효하지 않습니다: ${JSON.stringify(song.trackNo)}`);
    if (!song.title?.trim()) issues.push(`T${song.trackNo}: title이 비어 있습니다.`);
    if (!song.lyrics?.trim()) issues.push(`T${song.trackNo}: lyrics가 비어 있습니다.`);
    if (!song.stylePrompt?.trim()) issues.push(`T${song.trackNo}: stylePrompt가 비어 있습니다.`);
    if (!song.hookPhrase?.trim()) issues.push(`T${song.trackNo}: hookPhrase가 비어 있습니다.`);
  });
  return issues;
}

export interface SlotReconciliationResult {
  ok: boolean;
  /** trackNos present in the blueprint's own songs but absent from the snapshot's planned slots (or vice versa) — real drift between what was planned and what was delivered. */
  drift: string[];
}

/**
 * Step 3 — a light VERIFICATION (not a repair) that the final song set's
 * own trackNos match the snapshot's planned slot trackNos. Deliberately
 * does NOT call core/batchPreallocation.ts's reconcileWithPreassignedSlot
 * here — that function is a generation-time REPAIR pass (mutates/backfills
 * fields from a slot into a raw provider song); by finalize time the
 * blueprint has already been through that once per real generation path,
 * so re-running it here would silently re-mutate already-finalized content
 * rather than just checking it.
 */
export function reconcileSlotsForFinalize(blueprint: PlaylistBlueprint, snapshot: GenerationSnapshot): SlotReconciliationResult {
  const songTrackNos = new Set(blueprint.songs.map(song => song.trackNo));
  const slotTrackNos = new Set(snapshot.slots.map(slot => slot.trackNo));
  const drift: string[] = [];
  for (const trackNo of songTrackNos) if (!slotTrackNos.has(trackNo)) drift.push(`T${trackNo}: 계획된 슬롯에 없음`);
  for (const trackNo of slotTrackNos) if (!songTrackNos.has(trackNo)) drift.push(`T${trackNo}: 계획됐으나 결과에 없음`);
  return { ok: drift.length === 0, drift };
}

/**
 * Step 4 — real, bounded per-song language-policy check against the
 * workspace's own real WorkspaceQualityPolicy (지시문 02 TASK A). Deliberately
 * narrower than re-running every designGate.ts check (those already ran at
 * PLAN time, before generation — re-deriving them here on the final text
 * would just duplicate that pass) — this is a genuinely NEW check: does the
 * ACTUALLY GENERATED text still match the workspace's own language policy,
 * which nothing checks post-generation today.
 */
export function validateWorkspacePolicyForFinalize(songs: readonly SongIdea[], policy: WorkspaceQualityPolicy): string[] {
  const { defaultLyricLanguage } = policy.languagePolicy;
  if (defaultLyricLanguage === 'bilingual') return [];
  const issues: string[] = [];
  for (const song of songs) {
    const check = checkLyricLanguageMatch(song.lyrics, defaultLyricLanguage);
    if (check && !check.ok) issues.push(`T${song.trackNo}: ${policy.workspaceId} 워크스페이스의 언어 정책(${defaultLyricLanguage})과 실제 가사가 어긋납니다.`);
  }
  return issues;
}

export interface FinalizeBlueprintContext {
  conceptLabel: string;
  audienceProfile: AudienceProfile;
  lyricLanguage: LyricLanguage;
  channel: ChannelProfile;
  workspaceId: WorkspaceId;
  duplicationHistory?: ReleaseReadinessInput['duplicationHistory'];
  explorationTrackNos?: number[];
  sourceProvider?: string;
  sourceModel?: string;
  /** Explicit, honest override — see core/artifactStage.ts's elevateToReleaseReady doc comment for why this app never infers it. */
  audioConfirmed?: boolean;
  /** True while this call is itself producing/consuming a rewrite round — feeds ArtifactStage's rewrite-pending classification. */
  rewriteInFlight?: boolean;
}

export interface FinalizedBlueprint {
  blueprint: PlaylistBlueprint;
  snapshot: GenerationSnapshot;
  schemaIssues: string[];
  trackNoValidation: TrackSetValidation;
  trackNoValidationSummaryKo: string;
  slotReconciliation: SlotReconciliationResult;
  workspacePolicyIssues: string[];
  albumAudit: AlbumAuditReport;
  releaseReadiness: ReleaseReadinessReport;
  artifactMeta: ArtifactAuditMeta;
}

/**
 * The one real finalize path — TASK B's own literal 10-step order. Returns
 * a frozen (step 9) result; steps 1-4 never block on their own (this
 * function always completes and reports every finding — a caller decides
 * what to do with schemaIssues/trackNoValidation/workspacePolicyIssues,
 * same "report honestly, let the caller gate" convention every other real
 * audit function in this codebase already follows).
 */
export async function finalizeBlueprintForUse(
  blueprint: PlaylistBlueprint,
  snapshot: GenerationSnapshot,
  context: FinalizeBlueprintContext
): Promise<FinalizedBlueprint> {
  // 1. schema validate
  const schemaIssues = validateBlueprintSchema(blueprint);

  // 2. exact trackNo validate
  const trackNoValidation = validateProviderTrackSet(blueprint.songs, blueprint.songs.length);
  const trackNoValidationSummaryKo = describeTrackSetValidation(trackNoValidation);

  // 3. reconcile slots (verify, not repair — see reconcileSlotsForFinalize's own doc comment)
  const slotReconciliation = reconcileSlotsForFinalize(blueprint, snapshot);

  // 4. workspace policy validate
  const policy = qualityPolicyForWorkspace(context.workspaceId);
  const workspacePolicyIssues = validateWorkspacePolicyForFinalize(blueprint.songs, policy);

  // 5. scoreSongs — real, combined structural + concept-fit scoring, closing
  // the confirmed conceptFitScore:100 placeholder drift (see this module's
  // own top doc comment) for every caller of this function.
  const structurallyScored = scoreSongs(blueprint.songs, context.channel, context.lyricLanguage === 'bilingual' ? 'english' : context.lyricLanguage);
  const fullyScored = applyConceptFitScore(structurallyScored, context.conceptLabel);
  const scoredBlueprint: PlaylistBlueprint = { ...blueprint, songs: fullyScored };

  // 6. album audit — channel alone resolves the real audience profile
  // (auditAlbum's own audienceProfileForChannelArchetype(archetype, audience)
  // call already treats `audience` as a secondary hint on top of channel.archetype).
  const albumAudit = auditAlbum(fullyScored, { channel: context.channel });

  // 7. release readiness
  const releaseReadiness = evaluateReleaseReadiness({
    songs: fullyScored,
    conceptLabel: context.conceptLabel,
    songCount: fullyScored.length,
    audienceProfile: context.audienceProfile,
    lyricLanguage: context.lyricLanguage,
    archetype: context.channel.archetype,
    vocalQuotaOverride: context.channel.vocalQuotaOverride,
    duplicationHistory: context.duplicationHistory,
    explorationTrackNos: context.explorationTrackNos
  });

  // 8. artifact meta
  const artifactMeta = buildArtifactAuditMeta({
    signals: {
      hasRawProviderOutput: blueprint.songs.length > 0,
      hasNormalizedSlots: slotReconciliation.ok,
      hasScores: true,
      hasAlbumAudit: true,
      hasReleaseReadiness: true,
      releaseReadinessClean: releaseReadiness.releaseReady,
      rewriteInFlight: context.rewriteInFlight ?? false
    },
    sourceProvider: context.sourceProvider,
    sourceModel: context.sourceModel,
    normalizedAt: slotReconciliation.ok ? new Date().toISOString() : undefined,
    scoredAt: new Date().toISOString(),
    auditedAt: new Date().toISOString(),
    audioConfirmed: context.audioConfirmed
  });

  // 9. immutable result — same object for step 10 (저장·UI·export에 같은 객체 사용).
  return Object.freeze({
    blueprint: scoredBlueprint,
    snapshot,
    schemaIssues,
    trackNoValidation,
    trackNoValidationSummaryKo,
    slotReconciliation,
    workspacePolicyIssues,
    albumAudit,
    releaseReadiness,
    artifactMeta
  });
}

/**
 * 지시문 31 (§3) — finalizeBlueprintForUse는 검사 결과를 "보고"만 하고
 * 저장·export 여부는 호출자가 판단했다("Step4Result 전체 UI를 동일
 * finalized object로 바꾸는 것은 out of scope"라고 이 파일 자신의 원래
 * 설계가 이미 인정한 부분 — 그 결과 caller가 잘못 구현되면 이론상 저장이
 * 가능한 상태가 남았다). canPersistFinalizedPack/canExportReleasePack이
 * 그 "판단" 자체를 한곳으로 모은다 — 새 검사를 만들지 않는다, 아래 4/2개
 * 필드가 이미 finalizeBlueprintForUse의 9단계 중 1~4단계(schemaIssues/
 * trackNoValidation/slotReconciliation/workspacePolicyIssues)와 8단계
 * (artifactMeta) + blueprint.songs의 qualityScore가 계산해 둔 신호다.
 *
 * `Pick<FinalizedBlueprint, ...>`로 받는다(전체 FinalizedBlueprint가 아니라)
 * — §3-3 실측: finalizeBlueprintForUse(async, GenerationSnapshot+richer
 * context 필요)의 실제 호출자가 앱 전체에 0곳이었다(자기 정의 파일 밖에서
 * 한 번도 안 불림 — 죽은 함수). 저장 경로의 진짜 공통 관문은
 * core/library.ts의 savePack(모든 자동저장·현재 팩·가져온 팩·멀티세트
 * 저장이 실제로 거치는 단 하나의 함수, §3-3 전수표 참고)인데, 그 함수는
 * GenerationSnapshot을 안 받는다 — 오직 blueprint/options만 있다. 이
 * 관문 함수를 "완전한 FinalizedBlueprint가 있어야만 쓸 수 있는" 형태로
 * 두면 결국 아무도 못 부른다(§공통 규약 4 "새 모듈은 기존 실행 경로에서
 * 실제로 호출되어야 한다"를 다시 어기게 된다). Pick으로 좁히면 savePack이
 * 실제로 sync하게 계산 가능한 최소 신호(schemaIssues/trackNoValidation/
 * workspacePolicyIssues, slotReconciliation은 snapshot이 없는 자리라
 * {ok:true,drift:[]}로 정직하게 no-op)만으로도 이 함수를 실제로 호출할 수
 * 있고, 완전한 FinalizedBlueprint(모든 필드를 가짐)도 구조적으로 그대로
 * 통과한다 — TypeScript 구조적 타이핑이라 두 형태 다 같은 함수를 쓴다.
 */
export interface PersistGateResult {
  ok: boolean;
  blockersKo: string[];
}

export type PersistGateInput = Pick<FinalizedBlueprint, 'schemaIssues' | 'trackNoValidation' | 'trackNoValidationSummaryKo' | 'slotReconciliation' | 'workspacePolicyIssues'>;
export type ExportGateInput = PersistGateInput & Pick<FinalizedBlueprint, 'artifactMeta' | 'blueprint'>;

/**
 * §3-2 canPersist 차단 조건 — schemaIssues > 0 · trackNo 중복/범위밖/누락 ·
 * slot drift · blocking workspace policy(언어 정책 위반 — 유일하게 이
 * 함수가 계산하는 실제 workspacePolicyIssues) · 구조·안전 hard block(=
 * 위 네 가지 자체가 이 앱의 finalize 단계 구조·안전 검사 전부다 — 새로
 * 발명하지 않는다).
 */
export function canPersistFinalizedPack(finalized: PersistGateInput): PersistGateResult {
  const blockersKo: string[] = [];
  if (finalized.schemaIssues.length) blockersKo.push(...finalized.schemaIssues);
  if (!finalized.trackNoValidation.valid) blockersKo.push(finalized.trackNoValidationSummaryKo);
  if (!finalized.slotReconciliation.ok) blockersKo.push(...finalized.slotReconciliation.drift);
  if (finalized.workspacePolicyIssues.length) blockersKo.push(...finalized.workspacePolicyIssues);
  return { ok: blockersKo.length === 0, blockersKo };
}

/**
 * §3-2 canExport 차단 조건 — canPersist에 더해: artifactStage가
 * 'raw-provider'(정규화·채점을 한 번도 안 거친 원본 그대로)면 차단,
 * qualityScore가 전곡 0이면 차단(채점이 실제로 안 돌았다는 신호 — 지시문
 * 05의 finalizeBlueprintForUse가 5단계에서 항상 scoreSongs를 돌리므로
 * 정상적으로 이 함수를 거친 결과는 절대 전곡 0이 될 수 없다. 0이 보이면
 * finalized 객체 자체가 이 함수를 거치지 않은 가짜/스텁이라는 뜻이라
 * 정직하게 막는다).
 */
export function canExportReleasePack(finalized: ExportGateInput): PersistGateResult {
  const persist = canPersistFinalizedPack(finalized);
  const blockersKo = [...persist.blockersKo];
  if (finalized.artifactMeta.stage === 'raw-provider') {
    blockersKo.push('artifactStage가 raw-provider입니다 — 정규화·채점을 거치지 않은 원본입니다.');
  }
  if (finalized.blueprint.songs.length && finalized.blueprint.songs.every(song => (song.qualityScore ?? 0) === 0)) {
    blockersKo.push('qualityScore가 전곡 0입니다 — 채점이 실행되지 않았다는 신호입니다.');
  }
  return { ok: blockersKo.length === 0, blockersKo };
}

/**
 * 지시문 31 (§3-3) — core/library.ts's savePack(모든 자동저장·현재 팩·
 * 가져온 팩·멀티세트 저장이 실제로 거치는 단 하나의 함수)이 canPersistFinalizedPack을
 * 부를 수 있게, GenerationSnapshot 없이 blueprint 하나만으로 PersistGateInput을
 * 만든다. slotReconciliation은 이 자리에 snapshot이 없어 정직하게
 * {ok:true, drift:[]}(비교 대상 없음, drift라고 우길 근거가 없다) — snapshot이
 * 있는 자리(향후 finalizeBlueprintForUse 실제 호출부가 생기면)에서는 그
 * 함수의 진짜 reconcileSlotsForFinalize 결과를 대신 쓰면 된다.
 *
 * workspacePolicyIssues(언어 정책)는 여기서는 실측하지 않는다 — 지시문 31
 * §하지 말 것 "실측 없이 blocking을 만들지 않는다"를 이 통합 지점에서
 * 실제로 어길 뻔했다: tests/genreArchetypeSanitization.test.ts의 실제
 * fixture(임포트 테스트용, 언어 정합성을 검증 대상으로 삼지 않는 데이터)가
 * 이 검사를 켰을 때 즉시 막혔다 — savePack은 자동저장을 포함해 아직
 * 완성되지 않은 중간 상태(가져오기 도중·작업 중 초안)도 거치는 훨씬 넓은
 * 관문이라, "언어 정책"처럼 완성된 콘텐츠에나 의미 있는 검사를 여기서
 * blocking으로 걸면 실제로 검증 안 된 채 정상 저장을 막을 위험이 schemaIssues/
 * trackNoValidation(구조적으로 절대 정상일 수 없는 경우만 잡음)보다 훨씬
 * 크다. canPersistFinalizedPack 자체는 workspacePolicyIssues를 여전히
 * 검사한다 — 진짜 GenerationSnapshot+context가 있는 완전한
 * FinalizedBlueprint로 부르는 (아직 없는) 호출자에게는 그대로 적용된다.
 */
export function buildPersistGateInputFromBlueprint(blueprint: PlaylistBlueprint, _workspaceId: WorkspaceId): PersistGateInput {
  const schemaIssues = validateBlueprintSchema(blueprint);
  const trackNoValidation = validateProviderTrackSet(blueprint.songs, blueprint.songs.length);
  const trackNoValidationSummaryKo = describeTrackSetValidation(trackNoValidation);
  return {
    schemaIssues,
    trackNoValidation,
    trackNoValidationSummaryKo,
    slotReconciliation: { ok: true, drift: [] },
    workspacePolicyIssues: []
  };
}
