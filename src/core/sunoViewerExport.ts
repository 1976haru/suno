/**
 * TASK v5.20 (독립 수노모드 뷰어) — the shared, genuinely dependency-free
 * pieces behind both offline Suno-copy-workflow exports:
 *  - core/standaloneProgressExport.ts's buildStandaloneProgressHtml (one
 *    pack's data baked in at generation time, from inside the running app)
 *  - this file's own buildSunoViewerHtml (no data — loads a lyrics/*.json
 *    file at runtime, built once via `npm run build:suno-viewer`)
 *
 * This file deliberately imports NOTHING from the rest of src/core — not
 * even core/exportMeta.ts, which standaloneProgressExport.ts uses for its
 * own baked-mode build-info comment. That one extra import would transitively
 * pull in core/generationPreflight.ts -> core/localGenerationClient.ts's
 * `?worker` Vite-only import, which a plain `tsx scripts/buildSunoViewer.ts`
 * run (Node, no Vite pipeline) cannot resolve at all — exactly the kind of
 * "앱 코드를 뷰어에 번들하지 말 것" this task's own §8 warns about, discovered
 * the hard way (first draft of the build script crashed on this). Keeping
 * every symbol this file needs local (STYLE, embedJson/escapeHtml,
 * REVIEW_ENGINE_JS) is what makes scripts/buildSunoViewer.ts able to import
 * this module in plain Node at all.
 *
 * REVIEW_ENGINE_JS is the actual review-screen engine — currentSong/render/
 * copyField/rateSong/keyboard handling, line-for-line the same logic
 * standaloneProgressExport.ts's original (pre-v5.20) single-pack script
 * always had. Both builders emit it verbatim into their own `<script>`; see
 * this constant's own doc comment for the two optional hooks
 * (renderPicker/onIndexChangedHook) that let the same engine serve a
 * baked-in single pack and a "open any file" viewer without forking the
 * copy/rate/keyboard logic itself.
 */

export const SUNO_VIEWER_FILE_NAME = 'suno-mode.html';
/** TASK v5.20 (TASK D-4) — shown in the viewer's own footer; bump by hand whenever REVIEW_ENGINE_JS or the viewer-mode script below changes behavior or the on-disk ratings-export JSON contract. 지시문 13 TASK C — 1.0.0 -> 1.1.0 for TASK B's normalizeSong titleDisplay/noLocalizedTitleWarning fix, so a user comparing footers can tell a previously-downloaded suno-mode.html is stale. */
export const SUNO_VIEWER_VERSION = '1.1.0';

/** Mirrors core/promptBudget.ts's SUNO_COPY_LIMIT (1000) and core/soundSignature.ts's PERSONA_STYLE_LIMIT (200) — duplicated as plain numbers rather than imported, same reasoning as standaloneProgressExport.ts's own copy: this file must stay free of any app-module import. */
const SUNO_COPY_LIMIT = 1000;
const PERSONA_STYLE_LIMIT = 200;

/** Prevents a lyric/style-prompt string containing "</script>" from closing the inline <script> tag early. */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const STYLE = `
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
.drop-zone {
  border: 2px dashed var(--line); border-radius: 16px; padding: 36px 20px; text-align: center;
  display: flex; flex-direction: column; gap: 10px; align-items: center; color: var(--text-soft);
}
.drop-zone.drag-over { border-color: var(--accent); background: var(--accent-soft); }
.drop-zone strong { color: var(--text); font-size: 15px; }
.file-picker-button {
  border-radius: 10px; border: 1px solid var(--line); background: var(--panel-soft); color: var(--text);
  padding: 10px 18px; font-size: 14px; cursor: pointer;
}
.recent-list { display: flex; flex-direction: column; gap: 6px; }
.recent-item {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 13px;
}
.recent-item .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-item .progress { color: var(--text-soft); flex: 0 0 auto; }
.banner { border-radius: 10px; padding: 10px 14px; font-size: 13px; }
.banner.warn { background: var(--accent-soft); color: var(--text); border: 1px solid var(--line); }
.footer-version { text-align: center; font-size: 11px; color: var(--text-soft); margin: 4px 0 0; }
`;

/**
 * The review-screen engine — currentSong/render/copyField/rateSong/keyboard
 * handling, unchanged from standaloneProgressExport.ts's original
 * (pre-v5.20) single-pack script, plus two additions ONLY:
 *  1. `render()` starts with `if (!FILE_LOADED) { renderPicker(); return; }`
 *     — a dead branch for the baked single-pack export (FILE_LOADED is
 *     always true there, renderPicker is never even declared) and the real
 *     empty-state entry point for buildSunoViewerHtml below.
 *  2. `goNext`/`goPrev`/`goTo` call `onIndexChangedHook()` after moving — a
 *     no-op unless a mode defines it (only the viewer does, to persist
 *     currentIndex).
 * Assumes the including script already declared, above this text: SONGS,
 * META, SUNO_COPY_LIMIT, PERSONA_STYLE_LIMIT, FILE_LOADED, progress,
 * ratings, index, copiedFields, flashTimer, root, and functions
 * saveProgress/saveRatings/exportRatings — each mode supplies its own
 * (baked: two separate always-present localStorage keys; viewer: one
 * combined per-file key, only once a file is loaded). Optionally declares
 * renderPicker/onIndexChangedHook/afterPanel below this text (hoisted
 * function declarations — declaration order doesn't matter).
 */
export const REVIEW_ENGINE_JS = `
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
    return capitalized.replace(/\\bi\\b/g, 'I');
  }
  function renderLyricsForDisplay(lyrics, hookPhrase) {
    if (!hookPhrase) return lyrics;
    var sentenceCaseHook = hookForLyrics(hookPhrase);
    if (sentenceCaseHook === hookPhrase) return lyrics;
    return lyrics.split('\\n').map(function (line) {
      var leadingWs = line.slice(0, line.length - line.replace(/^\\s+/, '').length);
      var trimmed = line.trim();
      var trailingPunctMatch = /[.,!?]+$/.exec(trimmed);
      var trailingPunct = trailingPunctMatch ? trailingPunctMatch[0] : '';
      var core = trailingPunct ? trimmed.slice(0, -trailingPunct.length) : trimmed;
      return core === hookPhrase ? (leadingWs + sentenceCaseHook + trailingPunct) : line;
    }).join('\\n');
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
  var SET_TITLE_PREFIX_RE = /^\\d{2}\\.\\s+/;
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

  function goNext() { index = Math.min(SONGS.length - 1, index + 1); resetFieldFlags(); onIndexChanged(); render(); }
  function goPrev() { index = Math.max(0, index - 1); resetFieldFlags(); onIndexChanged(); render(); }
  function goTo(i) { index = i; resetFieldFlags(); onIndexChanged(); render(); }
  function resetFieldFlags() { copiedFields = { title: false, style: false, lyrics: false, exclude: false }; }
  function onIndexChanged() { if (typeof onIndexChangedHook === 'function') onIndexChangedHook(); }

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
    if (!FILE_LOADED) { renderPicker(); return; }
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
    var children = [header, panel];
    if (typeof afterPanel === 'function') { var extra = afterPanel(); if (extra) children.push(extra); }
    root.appendChild(el('div', { class: 'wrap' }, children));
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
`;

/**
 * TASK v5.20 (독립 수노모드 뷰어, TASK A/B/C/D) — the standalone, data-free
 * viewer: double-click, open a lyrics/*.json bridge-output file (drag-drop
 * or [파일 선택]), review/copy/rate exactly like
 * standaloneProgressExport.ts's buildStandaloneProgressHtml (same
 * REVIEW_ENGINE_JS), export ratings for the app to re-import (see
 * core/viewerRatingsImport.ts). No args — every run produces the same
 * output; see scripts/buildSunoViewer.ts for the `npm run build:suno-viewer`
 * CLI entry point this is built for.
 *
 * Progress persists per opened file under `sunoViewer:progress:<key>`
 * (`key` = the file's own meta.setName when present, else its filename
 * without extension — TASK B's "파일별로 진행 상태를 저장"), plus a small
 * `sunoViewer:recent` index (name + key only, NEVER file content — TASK
 * B-2's explicit "파일 내용 자체는 저장하지 마십시오") so the empty-state
 * screen can show "이미 몇 곡 했는지" before the user re-picks a file.
 */
export function buildSunoViewerHtml(): string {
  const title = '수노 진행 모드 뷰어';

  const script = `
(function () {
  'use strict';
  var VIEWER_VERSION = ${embedJson(SUNO_VIEWER_VERSION)};
  var SUNO_COPY_LIMIT = ${SUNO_COPY_LIMIT};
  var PERSONA_STYLE_LIMIT = ${PERSONA_STYLE_LIMIT};
  var RATING_MARK = { good: '\\u25CF', ok: '\\u25CB', bad: '\\u00D7' };
  var RATING_LABEL_KO = { good: '\\uC88B\\uC74C', ok: '\\uBCF4\\uD1B5', bad: '\\uBCC4\\uB85C' };
  var RECENT_KEY = 'sunoViewer:recent';
  var RECENT_LIMIT = 20;

  var SONGS = [];
  var META = { channelLabel: '', conceptLabel: '', personaMode: false, promptCharLimit: null, channelId: '', setName: '', generatedAt: '' };
  var FILE_LOADED = false;
  var CURRENT_KEY = null;
  var progress = { done: [], pastedAt: {} };
  var ratings = {};
  var index = 0;
  var copiedFields = { title: false, style: false, lyrics: false, exclude: false };
  var flashTimer = null;
  var loadError = '';
  var secretWarning = '';
  var noLocalizedTitleWarning = '';
  var dragActive = false;

  var root = document.getElementById('app');

  // TASK v5.20 (TASK D-2) — file:// pages sometimes throw on any
  // localStorage access (some browsers block it entirely for the file:
  // origin); probed once so the picker screen can say so instead of
  // silently losing progress.
  var LOCAL_STORAGE_OK = (function () {
    try {
      var testKey = '\\u0000sunoViewerProbe';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function safeGetItem(key) {
    if (!LOCAL_STORAGE_OK) return null;
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSetItem(key, value) {
    if (!LOCAL_STORAGE_OK) return;
    try { window.localStorage.setItem(key, value); } catch (e) { /* quota or disabled — best effort */ }
  }

  function progressStorageKey(key) { return 'sunoViewer:progress:' + key; }

  function readRecent() {
    try {
      var raw = safeGetItem(RECENT_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  function writeRecent(list) {
    safeSetItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)));
  }
  function touchRecent(key, displayName, songCount) {
    var list = readRecent().filter(function (entry) { return entry.key !== key; });
    list.unshift({ key: key, displayName: displayName, songCount: songCount, lastOpenedAt: new Date().toISOString() });
    writeRecent(list);
  }

  // Combined progress+ratings+currentIndex, one localStorage value per
  // opened file (TASK B-1's own literal shape: "{ done, ratings,
  // currentIndex }", ratings keyed by trackNo there). ratings itself is kept
  // keyed by songId at runtime (same shape REVIEW_ENGINE_JS already expects
  // from the single-pack export above) — trackNo is a display/identity
  // convenience only a real songId sometimes lacks (raw Codex bridge output
  // has none), so this file always synthesizes one (see normalizeSong) and
  // the two functions below translate between the two representations only
  // at the localStorage boundary.
  function ratingsByTrackNo() {
    var out = {};
    SONGS.forEach(function (s) {
      var r = ratings[s.songId];
      if (r) out[s.trackNo] = r;
    });
    return out;
  }
  function ratingsFromTrackNoMap(map) {
    var out = {};
    if (!map || typeof map !== 'object') return out;
    SONGS.forEach(function (s) {
      var r = map[s.trackNo] || map[String(s.trackNo)];
      if (r && typeof r === 'object' && r.rating) out[s.songId] = { rating: r.rating, ratedAt: r.ratedAt || new Date().toISOString() };
    });
    return out;
  }

  function persistState() {
    if (!CURRENT_KEY) return;
    safeSetItem(progressStorageKey(CURRENT_KEY), JSON.stringify({ done: progress.done, ratings: ratingsByTrackNo(), currentIndex: index }));
  }
  // REVIEW_ENGINE_JS calls these two by name after every change — routed to
  // the same combined persistState() here (the single-pack export instead
  // keeps two separate always-present localStorage keys; this file has
  // nothing to write until a file is actually loaded, hence the CURRENT_KEY
  // guard inside persistState itself).
  function saveProgress() { persistState(); }
  function saveRatings() { persistState(); }
  function onIndexChangedHook() { persistState(); }

  function loadPersistedState(key) {
    try {
      var raw = safeGetItem(progressStorageKey(key));
      var parsed = raw ? JSON.parse(raw) : {};
      return {
        done: Array.isArray(parsed.done) ? parsed.done : [],
        ratings: parsed.ratings,
        currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : 0
      };
    } catch (e) {
      return { done: [], ratings: {}, currentIndex: 0 };
    }
  }

  function exportRatings() {
    var records = [];
    SONGS.forEach(function (song) {
      var r = ratings[song.songId];
      if (!r) return;
      records.push({
        trackNo: song.trackNo,
        songId: song.songId.indexOf('trackNo:') === 0 ? '' : song.songId,
        rating: r.rating,
        ratedAt: r.ratedAt
      });
    });
    var payload = {
      setName: META.setName,
      exportedAt: new Date().toISOString(),
      source: 'suno-viewer',
      viewerVersion: VIEWER_VERSION,
      // TASK v5.20 — additive fields beyond the task doc's own minimal
      // {setName, exportedAt, source, viewerVersion, ratings} shape: when
      // the opened file had a real v3.69+ meta block, channelId +
      // packGeneratedAt let the app match ratings back to the exact saved
      // pack even when that pack's own library name doesn't literally equal
      // setName (see core/viewerRatingsImport.ts's own doc comment for why
      // a bare setName match alone is NOT reliable against this app's real
      // save-naming scheme). Both undefined (and simply omitted from the
      // JSON) for a legacy/meta-less file — the app then falls back to a
      // setName-only match, best-effort.
      channelId: META.channelId || undefined,
      packGeneratedAt: META.generatedAt || undefined,
      ratings: records
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ratings_' + (META.setName || 'suno-viewer') + '_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

${REVIEW_ENGINE_JS}

  function normalizeSong(raw, idx) {
    var trackNo = typeof raw.trackNo === 'number' && raw.trackNo > 0 ? raw.trackNo : idx + 1;
    var songId = typeof raw.songId === 'string' && raw.songId ? raw.songId : ('trackNo:' + trackNo);
    var title = typeof raw.title === 'string' && raw.title ? raw.title : ('Track ' + trackNo);
    var titleLocalized = typeof raw.titleLocalized === 'string' && raw.titleLocalized ? raw.titleLocalized : undefined;
    // 지시문 13 (TASK B) — normalizeSong never filled titleDisplay, so the
    // review screen's h2 (song.titleDisplay || song.title) always fell
    // through to the bare English title even for a pack whose titleLocalized
    // was fully populated; buildTitleCopyText (above) already used
    // titleLocalized correctly, so only the on-screen heading was affected.
    // Mirrors core/titleLocalization.ts's buildTitleDisplay, but prefers the
    // file's own raw.titleDisplay when present (the real pipeline computes
    // it before applySetTitlePrefixesToBlueprint runs, so it's already
    // correct) and only synthesizes one here as a fallback for files that
    // never carried it — stripSetTitlePrefix keeps that fallback from
    // showing a doubled "01. 01. Title" the way buildTitleCopyText's own
    // v4.12 bugfix note above already had to guard against.
    var titleDisplay = typeof raw.titleDisplay === 'string' && raw.titleDisplay
      ? raw.titleDisplay
      : (titleLocalized ? stripSetTitlePrefix(title) + ' (' + titleLocalized + ')' : undefined);
    return {
      trackNo: trackNo,
      title: title,
      titleLocalized: titleLocalized,
      titleDisplay: titleDisplay,
      stylePrompt: typeof raw.stylePrompt === 'string' ? raw.stylePrompt : '',
      lyrics: typeof raw.lyrics === 'string' ? raw.lyrics : '',
      hookPhrase: typeof raw.hookPhrase === 'string' ? raw.hookPhrase : '',
      excludePrompt: typeof raw.excludePrompt === 'string' ? raw.excludePrompt : '',
      songId: songId,
      genreId: typeof raw.genreId === 'string' ? raw.genreId : 'unknown',
      eraTag: typeof raw.eraTag === 'string' ? raw.eraTag : '',
      killingPointId: typeof raw.killingPointId === 'string' ? raw.killingPointId : '',
      arcPhase: typeof raw.arcPhase === 'string' ? raw.arcPhase : '',
      intensity: typeof raw.intensity === 'number' ? raw.intensity : null,
      bpm: typeof raw.bpm === 'number' ? raw.bpm : 0,
      vocalType: typeof raw.vocalType === 'string' ? raw.vocalType : 'unknown',
      structureTemplate: typeof raw.structureTemplate === 'string' ? raw.structureTemplate : '',
      earwormText: typeof raw.earwormText === 'string' ? raw.earwormText : '',
      lyricFrameId: typeof raw.lyricFrameId === 'string' ? raw.lyricFrameId : '',
      moneyChordId: typeof raw.moneyChordId === 'string' ? raw.moneyChordId : ''
    };
  }

  // TASK v5.20 (TASK D-3) — this format never carries API keys, but a
  // malformed/tampered file might; never trusted, always stripped, always
  // surfaced so the user knows a field was ignored rather than silently
  // dropped.
  function containsApiKey(value, depth) {
    if (depth > 4 || !value || typeof value !== 'object') return false;
    if (Object.prototype.hasOwnProperty.call(value, 'apiKey')) return true;
    return Object.keys(value).some(function (k) { return containsApiKey(value[k], depth + 1); });
  }

  // TASK v5.20 (TASK A-3) — supports all three documented shapes:
  // { meta, songs } (v3.69+), a bare array (legacy), and { songs } with no
  // meta block.
  function parseLyricsFile(parsed, fallbackName) {
    var metaRaw = null;
    var songsRaw = null;
    if (Array.isArray(parsed)) {
      songsRaw = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.songs)) songsRaw = parsed.songs;
      if (parsed.meta && typeof parsed.meta === 'object') metaRaw = parsed.meta;
    }
    if (!songsRaw || !songsRaw.length) return null;
    var songs = songsRaw.map(normalizeSong);
    var setName = (metaRaw && typeof metaRaw.setName === 'string' && metaRaw.setName) || fallbackName;
    var meta = {
      channelLabel: (metaRaw && typeof metaRaw.channelLabel === 'string' && metaRaw.channelLabel) || fallbackName,
      conceptLabel: (metaRaw && typeof metaRaw.conceptLabel === 'string' && metaRaw.conceptLabel) || '',
      channelId: (metaRaw && typeof metaRaw.channelId === 'string' && metaRaw.channelId) || '',
      generatedAt: (metaRaw && typeof metaRaw.generatedAt === 'string' && metaRaw.generatedAt) || '',
      setName: setName,
      personaMode: false,
      promptCharLimit: null
    };
    return { songs: songs, meta: meta };
  }

  function loadFile(file) {
    loadError = '';
    secretWarning = '';
    noLocalizedTitleWarning = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        loadError = '\\uC774 \\uD30C\\uC77C\\uC740 \\uC62C\\uBC14\\uB978 JSON\\uC774 \\uC544\\uB2D9\\uB2C8\\uB2E4.';
        render();
        return;
      }
      var fallbackName = file.name.replace(/\\.json$/i, '');
      var result = parseLyricsFile(parsed, fallbackName);
      if (!result) {
        loadError = '\\uACE1 \\uBAA9\\uB85D\\uC744 \\uCC3E\\uC744 \\uC218 \\uC5C6\\uC2B5\\uB2C8\\uB2E4 \\u2014 songs \\uBC30\\uC5F4\\uC774 \\uC788\\uB294 JSON\\uC778\\uC9C0 \\uD655\\uC778\\uD574\\uC8FC\\uC138\\uC694.';
        render();
        return;
      }
      if (containsApiKey(parsed, 0)) {
        secretWarning = '\\uAC00\\uC838\\uC628 \\uD30C\\uC77C\\uC5D0 apiKey \\uD544\\uB4DC\\uAC00 \\uC788\\uC5B4 \\uBB34\\uC2DC\\uD588\\uC2B5\\uB2C8\\uB2E4.';
      }
      SONGS = result.songs;
      META = result.meta;
      // 지시문 13 (TASK B-3) — a separate, real gap from B's own titleDisplay
      // fix: some packs never carry titleLocalized at all (root cause is
      // core/bridgeInstruction.ts's titleLocalizedInstructionLineFor
      // returning '' whenever packagingLanguage resolves to 'english' — see
      // core/packagingLanguage.ts's defaultPackagingLanguage; fixing THAT is
      // 지시문 12 TASK C-3's scope, not this one). This viewer only ever sees
      // the finished JSON, so the most it can do is say so instead of
      // silently rendering English-only titles with no explanation.
      noLocalizedTitleWarning = SONGS.length && SONGS.every(function (s) { return !s.titleLocalized; })
        ? '\\uC774 \\uD329\\uC5D0\\uB294 \\uD55C\\uAE00 \\uC81C\\uBAA9(titleLocalized)\\uC774 \\uC5C6\\uC2B5\\uB2C8\\uB2E4 \\u2014 \\uCC44\\uB110\\uC758 packagingLanguage \\uC124\\uC815\\uC744 \\uD655\\uC778\\uD558\\uC138\\uC694.'
        : '';
      FILE_LOADED = true;
      CURRENT_KEY = META.setName;
      var persisted = loadPersistedState(CURRENT_KEY);
      progress = { done: persisted.done, pastedAt: {} };
      ratings = ratingsFromTrackNoMap(persisted.ratings);
      index = Math.max(0, Math.min(SONGS.length - 1, persisted.currentIndex || 0));
      copiedFields = { title: false, style: false, lyrics: false, exclude: false };
      touchRecent(CURRENT_KEY, META.channelLabel + (META.conceptLabel ? ' \\u00B7 ' + META.conceptLabel : ''), SONGS.length);
      render();
    };
    reader.onerror = function () {
      loadError = '\\uD30C\\uC77C\\uC744 \\uC77D\\uB294 \\uB370 \\uC2E4\\uD328\\uD588\\uC2B5\\uB2C8\\uB2E4.';
      render();
    };
    reader.readAsText(file);
  }

  function recentDoneCount(key, songCount) {
    var persisted = loadPersistedState(key);
    var doneFromRatings = persisted.ratings ? Object.keys(persisted.ratings).length : 0;
    return Math.max(persisted.done.length, doneFromRatings, 0) + '/' + songCount;
  }

  function renderPicker() {
    root.innerHTML = '';
    var header = el('header', {}, [
      el('h1', { text: '\\uC218\\uB178 \\uC9C4\\uD589 \\uBAA8\\uB4DC \\uBDF0\\uC5B4' }),
      el('p', { text: '\\uC571 \\uC5C6\\uC774 \\uAC00\\uC0AC JSON\\uC744 \\uC5F4\\uC5B4 \\uBCF5\\uC0AC\\u00B7\\uD3C9\\uAC00\\uD569\\uB2C8\\uB2E4.' })
    ]);

    var fileInput = el('input', {
      type: 'file', accept: 'application/json,.json', style: 'display:none',
      onChange: function (e) { var f = e.target.files && e.target.files[0]; loadFile(f); e.target.value = ''; }
    });
    var dropZone = el('div', { class: dragActive ? 'drop-zone drag-over' : 'drop-zone' }, [
      el('strong', { text: '\\uAC00\\uC0AC \\uD30C\\uC77C\\uC744 \\uC5EC\\uAE30\\uB85C \\uB04C\\uC5B4\\uB193\\uAC70\\uB098' }),
      el('button', { type: 'button', class: 'file-picker-button', text: '[\\uD30C\\uC77C \\uC120\\uD0DD]', onClick: function () { fileInput.click(); } }),
      el('p', { class: 'hint', text: 'lyrics \\uD3F4\\uB354\\uC758 JSON \\uD30C\\uC77C\\uC744 \\uC120\\uD0DD\\uD558\\uC138\\uC694' }),
      fileInput
    ]);
    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dragActive = true; dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', function () { dragActive = false; dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dragActive = false;
      dropZone.classList.remove('drag-over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      loadFile(f);
    });

    var panelChildren = [dropZone];
    if (loadError) panelChildren.push(el('p', { class: 'error-line', text: '\\u26A0\\uFE0F ' + loadError }));
    if (!LOCAL_STORAGE_OK) panelChildren.push(el('p', { class: 'banner warn', text: '\\u26A0\\uFE0F \\uC774 \\uBE0C\\uB77C\\uC6B0\\uC800\\uB294 file:// \\uD398\\uC774\\uC9C0\\uC5D0\\uC11C localStorage\\uB97C \\uCC28\\uB2E8\\uD574\\uC11C \\uC9C4\\uD589 \\uC0C1\\uD0DC \\uC800\\uC7A5\\uC774 \\uBE44\\uD65C\\uC131\\uD654\\uB429\\uB2C8\\uB2E4 \\u2014 \\uBCF5\\uC0AC\\u00B7\\uD3C9\\uAC00\\uB294 \\uC815\\uC0C1 \\uB3D9\\uC791\\uD569\\uB2C8\\uB2E4.' }));
    var panel = el('div', { class: 'panel' }, panelChildren);

    var recent = readRecent();
    var children = [header, panel];
    if (recent.length) {
      var items = recent.map(function (entry) {
        return el('div', { class: 'recent-item' }, [
          el('span', { class: 'name', text: entry.displayName || entry.key }),
          el('span', { class: 'progress', text: recentDoneCount(entry.key, entry.songCount || 0) + ' \\uC644\\uB8CC' })
        ]);
      });
      var recentPanel = el('div', { class: 'panel' }, [
        el('strong', { text: '\\uCD5C\\uADFC \\uC791\\uC5C5' }),
        el('div', { class: 'recent-list' }, items),
        el('p', { class: 'hint', text: '\\u24D8 \\uD30C\\uC77C\\uC744 \\uB2E4\\uC2DC \\uC120\\uD0DD\\uD558\\uBA74 \\uC774\\uC5B4\\uC11C \\uD560 \\uC218 \\uC788\\uC2B5\\uB2C8\\uB2E4.' })
      ]);
      children.push(recentPanel);
    }
    children.push(el('p', { class: 'footer-version', text: '\\uC218\\uB178 \\uC9C4\\uD589 \\uBAA8\\uB4DC \\uBDF0\\uC5B4 ' + VIEWER_VERSION }));
    root.appendChild(el('div', { class: 'wrap' }, children));
  }

  function afterPanel() {
    var children = [];
    if (secretWarning) children.push(el('p', { class: 'banner warn', text: '\\u26A0\\uFE0F ' + secretWarning }));
    if (noLocalizedTitleWarning) children.push(el('p', { class: 'banner warn', text: '\\u26A0\\uFE0F ' + noLocalizedTitleWarning }));
    children.push(el('div', { class: 'button-row' }, [
      el('button', { type: 'button', class: 'chip', text: '\\u2190 \\uB2E4\\uB978 \\uD30C\\uC77C \\uC5F4\\uAE30', onClick: function () { FILE_LOADED = false; render(); } })
    ]));
    children.push(el('p', { class: 'footer-version', text: '\\uC218\\uB178 \\uC9C4\\uD589 \\uBAA8\\uB4DC \\uBDF0\\uC5B4 ' + VIEWER_VERSION }));
    return el('div', {}, children);
  }

  render();
})();
`;

  return [
    '<!doctype html>',
    `<!-- suno-mode viewer ${escapeHtml(SUNO_VIEWER_VERSION)} — offline, zero network requests -->`,
    '<html lang="ko">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    '<noscript>이 페이지는 JavaScript가 필요합니다.</noscript>',
    '<div id="app"></div>',
    `<script>${script}</script>`,
    '</body>',
    '</html>'
  ].join('\n');
}
