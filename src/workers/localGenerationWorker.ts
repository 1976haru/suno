import { generateLocalBlueprint } from '../core/localGenerator';
import { scoreSongs } from '../core/quality';
import { runFullAudit } from '../core/fullAudit';
import { evaluateDesignGate } from '../core/designGate';
import { evaluateGenerationGate } from '../core/generationGate';
import type { AudienceProfile, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, PreassignedSongSlot, SeasonPack, SongIdea } from '../types';
import type { AudioSetReport } from '../core/audioSetReport';
import type { ResolvedConstraints } from '../core/constraints';
import type { VocalType } from '../core/vocalPlan';
import type { ScoreCompositionOptions } from '../core/compositionScorer';
import type { VerifiedCombo } from '../core/verifiedCombos';

/**
 * v4.0 (TASK A) — ported from main's localGenerationWorker.ts (the browser-
 * freeze fix this branch never got — see docs/v400-report.md). main's own
 * worker only covered `generate` (generateLocalBlueprint + scoreSongs);
 * this branch has since grown three more genuinely heavy, pure, main-thread
 * computations (49-item audit, design gate, and the pack-wide style-prompt
 * similarity linter that rides inside runFullAudit) that this task's own
 * spec explicitly calls out as freeze risks on an 18-80 song pack. Rather
 * than add a 4th/5th worker (spec: "워커를 여러 개 만들지 마십시오"), they're
 * additional message types on this same worker — all four are pure
 * functions with no IndexedDB/fetch/DOM access, so sharing one worker
 * instance's lifecycle costs nothing extra.
 */

interface GenerateRequest {
  type: 'generate';
  opts: GenerationOptions;
  genres: GenrePack[];
  moods: MoodPack[];
  season: SeasonPack;
  avoid?: { usedTitles?: string[]; usedHooks?: string[]; recentVocalComboSignatures?: string[]; previousFlagshipOrder?: VocalType[]; verifiedCombos?: VerifiedCombo[] };
  promptCharLimit?: number;
}

interface FullAuditRequest {
  type: 'fullAudit';
  songs: SongIdea[];
  opts: { conceptLabel: string; songCount: number; audienceProfile: AudienceProfile; audioReport?: AudioSetReport };
}

interface DesignGateRequest {
  type: 'designGate';
  slots: PreassignedSongSlot[];
  constraints: ResolvedConstraints;
  opts: GenerationOptions;
}

/** v4.1 (TASK C) — evaluateGenerationGate ("관문 2") was the one heavy pure computation from this same family that v4.0's own worker migration missed (it moved evaluateDesignGate/runFullAudit but not this one) — closing that gap here, on the existing worker, rather than a new one. */
interface GenerationGateRequest {
  type: 'generationGate';
  songs: SongIdea[];
  opts: ScoreCompositionOptions & { conceptLabel?: string };
}

type LocalGenerationWorkerRequest = GenerateRequest | FullAuditRequest | DesignGateRequest | GenerationGateRequest;

type LocalGenerationWorkerResponse =
  | { type: 'generate'; ok: true; blueprint: PlaylistBlueprint }
  | { type: 'fullAudit'; ok: true; report: ReturnType<typeof runFullAudit> }
  | { type: 'designGate'; ok: true; result: ReturnType<typeof evaluateDesignGate> }
  | { type: 'generationGate'; ok: true; result: ReturnType<typeof evaluateGenerationGate> }
  | { type: LocalGenerationWorkerRequest['type']; ok: false; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<LocalGenerationWorkerRequest>) => void) | null;
  postMessage: (message: LocalGenerationWorkerResponse) => void;
};

workerScope.onmessage = event => {
  const request = event.data;
  try {
    if (request.type === 'generate') {
      const blueprint = generateLocalBlueprint(request.opts, request.genres, request.moods, request.season, request.avoid, request.promptCharLimit);
      const songs = scoreSongs(blueprint.songs, request.opts.channel, request.opts.lyricLanguage);
      workerScope.postMessage({ type: 'generate', ok: true, blueprint: { ...blueprint, songs } });
      return;
    }
    if (request.type === 'fullAudit') {
      const report = runFullAudit(request.songs, request.opts);
      workerScope.postMessage({ type: 'fullAudit', ok: true, report });
      return;
    }
    if (request.type === 'designGate') {
      const result = evaluateDesignGate(request.slots, request.constraints, request.opts);
      workerScope.postMessage({ type: 'designGate', ok: true, result });
      return;
    }
    if (request.type === 'generationGate') {
      const result = evaluateGenerationGate(request.songs, request.opts);
      workerScope.postMessage({ type: 'generationGate', ok: true, result });
      return;
    }
  } catch (error) {
    workerScope.postMessage({
      type: request.type,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export {};
