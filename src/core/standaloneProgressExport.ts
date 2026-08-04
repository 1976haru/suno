import type { SongIdea } from '../types';
import { buildSetName } from '../utils/setNaming';
import { buildExportMeta } from './exportMeta';

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

/** Prevents a lyric/style-prompt string containing "</script>" from closing the inline <script> tag early. */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #f5f6f8;
  --panel: #ffffff;
  --panel-soft: #eef0f4;
  --text: #14161a;
  --text-soft: #5b616e;
  --line: #dde1e7;
  --accent: #2563eb;
  --accent-soft: #dbeafe;
  --good: #16a34a;
  --ok: #a16207;
  --bad: #dc2626;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a;
    --panel: #1d2026;
    --panel-soft: #262a32;
    --text: #eef0f4;
    --text-soft: #9aa1ad;
    --line: #333842;
    --accent: #60a5fa;
    --accent-soft: #1e3a5f;
    --good: #4ade80;
    --ok: #fbbf24;
    --bad: #f87171;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Pretendard, sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  justify-content: center;
  padding: 20px 12px 60px;
}
.wrap { width: min(640px, 100%); display: flex; flex-direction: column; gap: 14px; }
header { display: flex; flex-direction: column; gap: 4px; padding: 4px 2px; }
header h1 { font-size: 18px; margin: 0; }
header p { margin: 0; font-size: 13px; color: var(--text-soft); }
.status-row { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--text-soft); }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.track-strip { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px; }
.track-chip {
  flex: 0 0 auto; min-width: 28px; min-height: 28px; padding: 0 6px; font-size: 12px;
  border-radius: 6px; border: 1px solid var(--line); background: var(--panel-soft); color: var(--text);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.track-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
.track-chip.done { opacity: 0.45; }
.nav-row { display: flex; align-items: center; gap: 10px; }
.nav-button {
  min-width: 44px; min-height: 44px; border-radius: 10px; border: 1px solid var(--line);
  background: var(--panel-soft); color: var(--text); font-size: 18px; cursor: pointer;
}
.nav-button:disabled { opacity: 0.4; cursor: default; }
.title-block { flex: 1; text-align: center; }
.title-block h2 { margin: 0 0 2px; font-size: 18px; }
.title-block p { margin: 0; font-size: 12px; color: var(--text-soft); }
.fields { display: flex; flex-direction: column; gap: 8px; }
.field-button {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; font-size: 15px;
  border-radius: 10px; border: 1px solid var(--line); background: var(--panel-soft); color: var(--text);
  padding: 0 16px; cursor: pointer; text-align: left;
}
.field-button.copied { background: var(--accent-soft); border-color: var(--accent); }
.field-button:disabled { opacity: 0.5; cursor: default; }
.field-key {
  display: inline-flex; align-items: center; justify-content: center; min-width: 22px; min-height: 22px;
  border-radius: 6px; background: var(--panel); font-weight: 700; font-size: 12px; border: 1px solid var(--line);
}
.error-line { color: var(--bad); font-size: 13px; margin: 0; }
.button-row { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  border-radius: 8px; border: 1px solid var(--line); background: var(--panel-soft); color: var(--text);
  padding: 8px 14px; font-size: 13px; cursor: pointer;
}
.chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.chip.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.full-width { flex: 1; text-align: center; }
.hint { font-size: 12px; color: var(--text-soft); margin: 0; }
.export-row { display: flex; justify-content: flex-end; }
.export-row button {
  border-radius: 8px; border: 1px solid var(--line); background: var(--panel-soft); color: var(--text);
  padding: 6px 12px; font-size: 12px; cursor: pointer;
}
`;

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
  function saveRatings(ratings) {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
  }

  var progress = loadProgress();
  var ratings = loadRatings();
  var index = 0;
  var copiedFields = { title: false, style: false, lyrics: false, exclude: false };
  var flashTimer = null;

  var root = document.getElementById('app');

  function currentSong() { return SONGS[index]; }
  function isDone(song) { return progress.done.indexOf(song.trackNo) !== -1; }
  function promptLimit(song) {
    var isSeedSong = META.personaMode && song.trackNo === 1;
    var configured = Math.min(SUNO_COPY_LIMIT, Math.max(PERSONA_STYLE_LIMIT, META.promptCharLimit || SUNO_COPY_LIMIT));
    return META.personaMode && !isSeedSong ? Math.min(configured, PERSONA_STYLE_LIMIT) : configured;
  }
  function isOverPromptLimit(song) { return song.stylePrompt.length > promptLimit(song); }
  function hasExclude(song) { return Boolean(song.excludePrompt); }
  function requiredFields(song) { return hasExclude(song) ? ['title', 'style', 'lyrics', 'exclude'] : ['title', 'style', 'lyrics']; }
  function allCopied(song) { return requiredFields(song).every(function (f) { return copiedFields[f]; }); }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    }
    legacyCopy(text);
    return Promise.resolve();
  }
  function legacyCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } catch (e) { /* best-effort */ }
    document.body.removeChild(textarea);
  }

  // TASK v3.70 (TASK D) — copy/display only, mirroring
  // core/lyricEngine.ts's hookForLyrics/renderLyricsForDisplay: a hook sung
  // in literal Title Case reads like a title announcement when pasted into
  // Suno. Never mutates SONGS itself.
  function hookForLyrics(hook) {
    if (!hook) return hook;
    var lower = hook.toLowerCase();
    var firstLetterIndex = lower.search(/[a-z]/i);
    if (firstLetterIndex === -1) return lower;
    var capitalized = lower.slice(0, firstLetterIndex) + lower[firstLetterIndex].toUpperCase() + lower.slice(firstLetterIndex + 1);
    return capitalized.replace(/\bi\b/g, 'I');
  }
  function renderLyricsForDisplay(lyrics, hookPhrase) {
    if (!hookPhrase) return lyrics;
    var sentenceCaseHook = hookForLyrics(hookPhrase);
    if (sentenceCaseHook === hookPhrase) return lyrics;
    return lyrics.split('\n').map(function (line) {
      var leadingWs = line.slice(0, line.length - line.replace(/^\s+/, '').length);
      var trimmed = line.trim();
      var trailingPunctMatch = /[.,!?]+$/.exec(trimmed);
      var trailingPunct = trailingPunctMatch ? trailingPunctMatch[0] : '';
      var core = trailingPunct ? trimmed.slice(0, -trailingPunct.length) : trimmed;
      return core === hookPhrase ? (leadingWs + sentenceCaseHook + trailingPunct) : line;
    }).join('\n');
  }

  // TASK v4.10 — mirrors SunoProgressMode.tsx's own buildTitleCopyText: "01. Thaw
  // (봄이 스미던 오후)", omitting the parenthetical entirely when the song has no
  // titleLocalized (never an empty "()").
  // TASK v4.12 bugfix — song.title already carries its own "NN. " prefix by
  // default (src/utils/generation.ts's applySetTitlePrefixesToBlueprint), so
  // prepending trackNo here too doubled it ("02. 02. Folded"). Strips any
  // existing 2-digit-dot prefix first — same regex as that module's own
  // stripSetTitlePrefix, duplicated here (not imported) since this file must
  // stay a self-contained standalone HTML with zero app code at runtime.
  var SET_TITLE_PREFIX_RE = /^\d{2}\.\s+/;
  function stripSetTitlePrefix(title) {
    return title.replace(SET_TITLE_PREFIX_RE, '');
  }
  function buildTitleCopyText(song) {
    var trackNoPadded = String(song.trackNo).length < 2 ? '0' + song.trackNo : String(song.trackNo);
    var bareTitle = stripSetTitlePrefix(song.title);
    var localized = song.titleLocalized ? song.titleLocalized.trim() : '';
    return localized ? trackNoPadded + '. ' + bareTitle + ' (' + localized + ')' : trackNoPadded + '. ' + bareTitle;
  }

  function copyField(field) {
    var song = currentSong();
    if (!song) return;
    if (field === 'exclude' && !hasExclude(song)) return;
    if (field === 'style' && isOverPromptLimit(song)) return;
    var text = field === 'title' ? buildTitleCopyText(song) : field === 'style' ? song.stylePrompt : field === 'lyrics' ? renderLyricsForDisplay(song.lyrics, song.hookPhrase) : song.excludePrompt;
    copyToClipboard(text).then(function () {
      copiedFields[field] = true;
      if (allCopied(song)) {
        progress.pastedAt[song.trackNo] = new Date().toISOString();
        saveProgress(progress);
      }
      render();
      clearTimeout(flashTimer);
      flashTimer = setTimeout(render, 900);
    });
  }

  function toggleDone() {
    var song = currentSong();
    if (!song) return;
    var i = progress.done.indexOf(song.trackNo);
    if (i === -1) progress.done.push(song.trackNo); else progress.done.splice(i, 1);
    saveProgress(progress);
    render();
  }

  function rateSong(rating) {
    var song = currentSong();
    if (!song || !song.songId) return;
    ratings[song.songId] = { rating: rating, ratedAt: new Date().toISOString() };
    saveRatings(ratings);
    goNext();
  }

  function goNext() { index = Math.min(SONGS.length - 1, index + 1); resetFieldFlags(); render(); }
  function goPrev() { index = Math.max(0, index - 1); resetFieldFlags(); render(); }
  function goTo(i) { index = i; resetFieldFlags(); render(); }
  function resetFieldFlags() { copiedFields = { title: false, style: false, lyrics: false, exclude: false }; }

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

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else if (key === 'text') node.textContent = attrs[key];
      else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
      else if (attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== false) node.setAttribute(key, attrs[key] === true ? '' : attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function render() {
    var song = currentSong();
    root.innerHTML = '';
    if (!song) return;

    var doneCount = progress.done.length;
    var ratedCount = Object.keys(ratings).length;

    var header = el('header', {}, [
      el('h1', { text: META.channelLabel + ' \\u00B7 ' + META.conceptLabel }),
      el('p', { text: '\\uC218\\uB178 \\uC9C4\\uD589 \\uBAA8\\uB4DC (\\uB3C5\\uB9BD \\uD30C\\uC77C) \\u00B7 ' + SONGS.length + '\\uACE1' })
    ]);

    var statusRow = el('div', { class: 'status-row' }, [
      el('span', { text: (index + 1) + ' / ' + SONGS.length }),
      el('span', { text: '\\uC644\\uB8CC ' + doneCount + '/' + SONGS.length + '\\uACE1' }),
      el('span', { text: '\\uD3C9\\uAC00 ' + ratedCount + '/' + SONGS.length + '\\uACE1' })
    ]);

    var strip = el('div', { class: 'track-strip' }, SONGS.map(function (trackSong, trackIdx) {
      var trackDone = progress.done.indexOf(trackSong.trackNo) !== -1;
      var trackRating = trackSong.songId ? ratings[trackSong.songId] : undefined;
      var mark = trackRating ? RATING_MARK[trackRating.rating] : (trackDone ? '\\u2713' : String(trackSong.trackNo));
      var cls = trackIdx === index ? 'track-chip active' : trackDone ? 'track-chip done' : 'track-chip';
      return el('button', {
        class: cls,
        type: 'button',
        title: trackRating ? trackSong.title + ' \\u2014 ' + RATING_LABEL_KO[trackRating.rating] : trackSong.title,
        text: mark,
        onClick: function () { goTo(trackIdx); }
      });
    }));

    var lastPastedAt = progress.pastedAt[song.trackNo];
    var titleBlock = el('div', { class: 'title-block' }, [
      el('h2', { text: song.titleDisplay || song.title }),
      lastPastedAt ? el('p', { text: '\\uB9C8\\uC9C0\\uB9C9 \\uBD99\\uC5EC\\uB123\\uAE30: ' + new Date(lastPastedAt).toLocaleString() }) : null
    ]);
    var navRow = el('div', { class: 'nav-row' }, [
      el('button', { class: 'nav-button', type: 'button', text: '\\u2039', disabled: index === 0, onClick: goPrev }),
      titleBlock,
      el('button', { class: 'nav-button', type: 'button', text: '\\u203A', disabled: index === SONGS.length - 1, onClick: goNext })
    ]);

    var overLimit = isOverPromptLimit(song);
    var fields = el('div', { class: 'fields' }, [
      el('button', {
        class: copiedFields.title ? 'field-button copied' : 'field-button', type: 'button',
        onClick: function () { copyField('title'); }
      }, [el('span', { class: 'field-key', text: '1' }), el('span', { text: (copiedFields.title ? '\\u2713 ' : '') + '\\uC81C\\uBAA9 \\uBCF5\\uC0AC' })]),
      el('button', {
        class: copiedFields.style ? 'field-button copied' : 'field-button', type: 'button', disabled: overLimit,
        title: overLimit ? ('\\uC2A4\\uD0C0\\uC77C \\uD504\\uB86C\\uD504\\uD2B8\\uAC00 ' + promptLimit(song) + '\\uC790\\uB97C \\uCD08\\uACFC\\uD588\\uC2B5\\uB2C8\\uB2E4') : null,
        onClick: function () { copyField('style'); }
      }, [el('span', { class: 'field-key', text: '2' }), el('span', { text: (copiedFields.style ? '\\u2713 ' : '') + '\\uC2A4\\uD0C0\\uC77C \\uD504\\uB86C\\uD504\\uD2B8 \\uBCF5\\uC0AC' })]),
      el('button', {
        class: copiedFields.lyrics ? 'field-button copied' : 'field-button', type: 'button',
        onClick: function () { copyField('lyrics'); }
      }, [el('span', { class: 'field-key', text: '3' }), el('span', { text: (copiedFields.lyrics ? '\\u2713 ' : '') + '\\uAC00\\uC0AC \\uBCF5\\uC0AC' })])
    ]);
    if (hasExclude(song)) {
      fields.appendChild(el('button', {
        class: copiedFields.exclude ? 'field-button copied' : 'field-button', type: 'button',
        onClick: function () { copyField('exclude'); }
      }, [el('span', { class: 'field-key', text: '4' }), el('span', { text: (copiedFields.exclude ? '\\u2713 ' : '') + 'Exclude \\uBCF5\\uC0AC' })]));
    }

    var errorLine = overLimit ? el('p', { class: 'error-line', text: '\\u26A0\\uFE0F \\uC2A4\\uD0C0\\uC77C \\uD504\\uB86C\\uD504\\uD2B8\\uAC00 ' + promptLimit(song) + '\\uC790\\uB97C \\uCD08\\uACFC\\uD574 \\uBCF5\\uC0AC\\uB97C \\uB9C9\\uC558\\uC2B5\\uB2C8\\uB2E4 (\\uD604\\uC7AC ' + song.stylePrompt.length + '\\uC790)' }) : null;

    var songRating = song.songId ? ratings[song.songId] : undefined;
    var ratingRow = el('div', { class: 'button-row' }, [
      el('button', { class: songRating && songRating.rating === 'good' ? 'chip active' : 'chip', type: 'button', text: 'G \\uD83D\\uDC4D \\uC88B\\uC74C', onClick: function () { rateSong('good'); } }),
      el('button', { class: songRating && songRating.rating === 'ok' ? 'chip active' : 'chip', type: 'button', text: 'O \\uD83E\\uDD37 \\uBCF4\\uD1B5', onClick: function () { rateSong('ok'); } }),
      el('button', { class: songRating && songRating.rating === 'bad' ? 'chip active' : 'chip', type: 'button', text: 'B \\uD83D\\uDC4E \\uBCC4\\uB85C', onClick: function () { rateSong('bad'); } })
    ]);

    var doneRow = el('div', { class: 'button-row' }, [
      el('button', { class: isDone(song) ? 'chip active' : 'chip', type: 'button', text: isDone(song) ? '\\u2713 Suno\\uC5D0 \\uB123\\uC5C8\\uC74C' : '\\uC644\\uB8CC \\uCC98\\uB9AC', onClick: toggleDone }),
      el('button', { class: allCopied(song) ? 'chip primary full-width' : 'chip full-width', type: 'button', text: '\\uB2E4\\uC74C \\uACE1 \\u2192 (Enter)', disabled: index === SONGS.length - 1, onClick: goNext })
    ]);

    var hint = el('p', { class: 'hint', text: '\\uB2E8\\uCD95\\uD0A4: 1=\\uC81C\\uBAA9 2=\\uC2A4\\uD0C0\\uC77C 3=\\uAC00\\uC0AC 4=Exclude \\u00B7 G=\\uC88B\\uC74C O=\\uBCF4\\uD1B5 B=\\uBCC4\\uB85C \\u00B7 Enter/\\u2192=\\uB2E4\\uC74C \\u00B7 \\u2190=\\uC774\\uC804' });

    var exportRow = el('div', { class: 'export-row' }, [
      el('button', { type: 'button', text: '[\\uD3C9\\uAC00 \\uB0B4\\uBCF4\\uB0B4\\uAE30]', onClick: exportRatings })
    ]);

    var panel = el('div', { class: 'panel' }, [statusRow, strip, navRow, fields, errorLine, ratingRow, doneRow, hint, exportRow]);
    root.appendChild(el('div', { class: 'wrap' }, [header, panel]));
  }

  window.addEventListener('keydown', function (event) {
    var target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (event.key === '1') copyField('title');
    else if (event.key === '2') copyField('style');
    else if (event.key === '3') copyField('lyrics');
    else if (event.key === '4' && hasExclude(currentSong())) copyField('exclude');
    else if (event.key.toLowerCase() === 'g') rateSong('good');
    else if (event.key.toLowerCase() === 'o') rateSong('ok');
    else if (event.key.toLowerCase() === 'b') rateSong('bad');
    else if (event.key === 'Enter' || event.key === 'ArrowRight') goNext();
    else if (event.key === 'ArrowLeft') goPrev();
    else return;
    event.preventDefault();
  });

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
