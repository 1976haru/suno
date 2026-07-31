/**
 * TASK v3.24 — a flat-rate coding agent (Claude Code, Codex, ...) can
 * generate the exact same song content this app would otherwise pay
 * per-token for through api/generate.js/api/batch.js. This module is the
 * bridge: buildClaudeCodeInstruction() produces a single self-contained
 * prompt (copy/paste or download as .txt) that such an agent can execute
 * directly and write its result to a file; importSongsJson() reads that
 * file back in and pushes it through the exact same quality/safety
 * pipeline (core/quality.ts's scoreSongs) every API-generated song already
 * goes through, so it doesn't matter which path a song came from — the same
 * gates apply either way.
 *
 * v3.66 (TASK C) — this file used to hold all of the above directly
 * (1,207 lines, one of the largest and most frequently revised files in
 * src/core). It is now a barrel that re-exports three focused modules so
 * every existing `from '../core/claudeCodeBridge'` import across the app
 * and test suite keeps working unchanged:
 *   - bridgeInstruction.ts — builds the instruction text a coding agent runs
 *   - bridgeImport.ts       — parses songs-output.json back into a blueprint
 *   - bridgeRecompose.ts    — builds the scoped re-composition instruction
 * Pure move — no logic was altered. See docs/v366-report.md for the full
 * before/after line-count table and regression verification.
 */
export {
  CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME,
  buildSetPlanHandoffSection,
  buildClaudeCodeInstruction,
  buildMultiSetClaudeCodeInstructions,
  buildMultiSetClaudeCodeMasterInstruction,
  type ClaudeCodeInstructionOptions,
  type MultiSetBridgeInstruction,
  type MultiSetBridgeMasterInstruction
} from './bridgeInstruction';

export {
  importSongsJson,
  type ImportSongsReport
} from './bridgeImport';

export { buildRecomposeInstruction } from './bridgeRecompose';
