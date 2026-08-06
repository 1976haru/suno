import type { SongIdea } from '../types';
import { buildSetName } from '../utils/setNaming';
import { buildExportMeta } from './exportMeta';
import { embedJson, escapeHtml, REVIEW_ENGINE_JS, STYLE } from './sunoViewerExport';

/**
 * TASK v3.69 (TASK A) — "독립 실행 수노모드": the real workflow (see this
 * task's own §0 problem statement) is bridge instruction -> Codex ->
 * songs-output.json -> import -> open Suno Progress Mode -> copy 18 songs'
 * fields into Suno one at a time. Step 4 alone can take real time, during
 * which the app has to stay open and the dev server can't be restarted.
 * This module renders that same copy workflow as one self-contained,
 * offline HTML file — no server, no React bundle (SunoProgressMode.tsx's own
 * UI/keyboard logic is deliberately re-implemented in vanilla JS here; see
 * this task's own instruction that duplication, not a shared bundle, is the
 * intended answer, since bundling React would blow well past the 300KB
 * target and pull in state/store code this file has no use for).
 *
 * Progress/ratings persist to localStorage (not IndexedDB — this file has no
 * access to the app's own databases when opened from disk/a different
 * origin, and doesn't need to: it's a self-contained companion, not a synced
 * client), keyed by this pack's own packId so reopening the same exported
 * file later resumes where the user left off.
 *
 * TASK v5.20 (독립 수노모드 뷰어) — the actual review-screen engine
 * (currentSong/render/copyField/rateSong/keyboard handling — everything
 * below `${REVIEW_ENGINE_JS}` in buildStandaloneProgressHtml's script) now
 * lives in core/sunoViewerExport.ts, shared verbatim with that module's own
 * buildSunoViewerHtml (the data-free, open-any-file viewer this task added —
 * see that file's own doc comment for why it had to be its own,
 * genuinely-zero-app-import module rather than living here: this file's
 * buildExportMeta import transitively pulls in a Vite-only `?worker` import
 * that a plain Node/tsx script can't resolve, and the viewer needs to be
 * buildable from exactly such a script). This file's own behavior is
 * unchanged by that split — same output, byte for byte.
 */

export interface StandaloneProgressMeta {
  packId: string;
  channelId: string;
  channelLabel: string;
  conceptLabel: string;
  /** ISO timestamp — used for the header display and the exported file's own name (utils/setNaming.ts). */
  generatedAt: string;
  personaMode?: boolean;
  promptCharLimit?: number;
}

/** Mirrors core/promptBudget.ts's SUNO_COPY_LIMIT (1000) and core/soundSignature.ts's PERSONA_STYLE_LIMIT (200) — intentionally duplicated as plain numbers rather than imported, since this file must stand alone with zero app code at runtime. */
const SUNO_COPY_LIMIT = 1000;
const PERSONA_STYLE_LIMIT = 200;

/** Same filename scheme as every other v3.69 set-level export (utils/setNaming.ts) — "<setName>_수노모드". */
export function standaloneProgressFileName(meta: Pick<StandaloneProgressMeta, 'channelLabel' | 'conceptLabel' | 'generatedAt'>): string {
  const setName = buildSetName({ date: new Date(meta.generatedAt), channelLabel: meta.channelLabel, conceptLabel: meta.conceptLabel });
  return `${setName}_수노모드.html`;
}

interface StandaloneSong {
  trackNo: number;
  title: string;
  /** v4.3 (TASK A) — "English (Localized)" display string; undefined when the song has no titleLocalized. Used for the on-screen title only — the "제목 복사" clipboard field builds its own "NN. Title (Localized)" string from trackNo/title/titleLocalized directly (see buildTitleCopyText below; TASK v4.10). */
  titleDisplay?: string;
  /** TASK v4.10 — the localized-title copy behind titleDisplay's parenthetical; needed separately from titleDisplay since the "제목 복사" field's own "NN. " track-number prefix means it can't just reuse the prebuilt display string. */
  titleLocalized?: string;
  stylePrompt: string;
  lyrics: string;
  /** TASK v3.70 (TASK D) — needed to render the sung hook in sentence case for copy/display, without touching the stored lyrics string itself. */
  hookPhrase: string;
  excludePrompt: string;
  songId: string;
  genreId: string;
  eraTag: string;
  killingPointId: string;
  arcPhase: string;
  intensity: number | null;
  bpm: number;
  vocalType: string;
  structureTemplate: string;
  earwormText: string;
  lyricFrameId: string;
  moneyChordId: string;
}

function toStandaloneSong(song: SongIdea): StandaloneSong {
  return {
    trackNo: song.trackNo,
    title: song.title,
    ...(song.titleDisplay ? { titleDisplay: song.titleDisplay } : {}),
    ...(song.titleLocalized ? { titleLocalized: song.titleLocalized } : {}),
    stylePrompt: song.stylePrompt,
    lyrics: song.lyrics,
    hookPhrase: song.hookPhrase || '',
    excludePrompt: song.excludePrompt || '',
    songId: song.songId || '',
    genreId: song.genreId || 'unknown',
    eraTag: song.eraTag || '',
    killingPointId: song.killingPointId || '',
    arcPhase: song.arcPhase || '',
    intensity: song.intensity ?? null,
    bpm: song.bpm ?? 0,
    vocalType: song.vocalType || 'unknown',
    structureTemplate: song.structureTemplate || '',
    earwormText: song.earwormText || '',
    lyricFrameId: song.lyricFrameId || '',
    moneyChordId: song.moneyChordId || ''
  };
}

/**
 * Builds one self-contained HTML file: mirrors SunoProgressMode.tsx's
 * keyboard-driven copy workflow (1/2/3/4, G/O/B, Enter/→/←) in vanilla JS,
 * with the song data inlined as JSON and progress/ratings persisted to
 * localStorage. No React, no external requests, no build step required to
 * open it — double-click and go.
 */
export function buildStandaloneProgressHtml(songs: SongIdea[], meta: StandaloneProgressMeta): string {
  const standaloneSongs = songs.map(toStandaloneSong);
  const dateLabel = new Date(meta.generatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = `${meta.channelLabel} · ${meta.conceptLabel} — 수노 진행 모드`;
  // v4.0 (TASK C) — computed here (regular app code, generation time), not
  // inside `script` below — this file's own runtime must stay zero-app-code
  // (see this module's own doc comment), so the meta is baked into a plain
  // literal exactly like SONGS/META already are, never a live import.
  const exportMeta = buildExportMeta(meta.generatedAt);

  const script = `
(function () {
  'use strict';
  var SONGS = ${embedJson(standaloneSongs)};
  var EXPORT_META = ${embedJson(exportMeta)};
  var META = ${embedJson({
    packId: meta.packId,
    channelId: meta.channelId,
    channelLabel: meta.channelLabel,
    conceptLabel: meta.conceptLabel,
    personaMode: Boolean(meta.personaMode),
    promptCharLimit: meta.promptCharLimit ?? null
  })};
  var SUNO_COPY_LIMIT = ${SUNO_COPY_LIMIT};
  var PERSONA_STYLE_LIMIT = ${PERSONA_STYLE_LIMIT};
  var FILE_LOADED = true;
  var PROGRESS_KEY = 'suno-standalone-progress:' + META.packId;
  var RATINGS_KEY = 'suno-standalone-ratings:' + META.packId;
  var RATING_MARK = { good: '\\u25CF', ok: '\\u25CB', bad: '\\u00D7' };
  var RATING_LABEL_KO = { good: '\\uC88B\\uC74C', ok: '\\uBCF4\\uD1B5', bad: '\\uBCC4\\uB85C' };

  function loadProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return { done: Array.isArray(parsed.done) ? parsed.done : [], pastedAt: parsed.pastedAt || {} };
    } catch (e) {
      return { done: [], pastedAt: {} };
    }
  }
  function saveProgress(state) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
  }
  function loadRatings() {
    try {
      var raw = localStorage.getItem(RATINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveRatings(ratingsState) {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratingsState));
  }

  var progress = loadProgress();
  var ratings = loadRatings();
  var index = 0;
  var copiedFields = { title: false, style: false, lyrics: false, exclude: false };
  var flashTimer = null;

  var root = document.getElementById('app');

  function exportRatings() {
    var records = [];
    Object.keys(ratings).forEach(function (songId) {
      var song = SONGS.filter(function (s) { return s.songId === songId; })[0];
      if (!song) return;
      records.push({
        songId: songId,
        packId: META.packId,
        rating: ratings[songId].rating,
        ratedAt: ratings[songId].ratedAt,
        attributes: {
          genreId: song.genreId,
          eraTag: song.eraTag || undefined,
          killingPointId: song.killingPointId || undefined,
          arcPhase: song.arcPhase || undefined,
          intensity: song.intensity === null ? undefined : song.intensity,
          bpm: song.bpm,
          vocalType: song.vocalType,
          structureTemplate: song.structureTemplate || undefined,
          earwormVariantId: song.earwormText || undefined,
          segmentLabel: undefined,
          lyricFrameId: song.lyricFrameId || undefined,
          moneyChordId: song.moneyChordId || undefined,
          channelId: META.channelId
        }
      });
    });
    var blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = ${embedJson(standaloneRatingsFileName(meta))};
    a.click();
    URL.revokeObjectURL(url);
  }

${REVIEW_ENGINE_JS}

  render();
})();
`;

  return [
    '<!doctype html>',
    `<!-- ${escapeHtml(JSON.stringify(exportMeta))} -->`,
    '<html lang="ko">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    `<noscript>이 페이지는 JavaScript가 필요합니다. (생성일: ${escapeHtml(dateLabel)})</noscript>`,
    '<div id="app"></div>',
    `<script>${script}</script>`,
    '</body>',
    '</html>'
  ].join('\n');
}

function standaloneRatingsFileName(meta: Pick<StandaloneProgressMeta, 'channelLabel' | 'conceptLabel' | 'generatedAt'>): string {
  const setName = buildSetName({ date: new Date(meta.generatedAt), channelLabel: meta.channelLabel, conceptLabel: meta.conceptLabel });
  return `${setName}_평가.json`;
}
