import { useMemo, useState } from 'react';
import { Captions, Download, Languages } from 'lucide-react';
import {
  buildSrtCues,
  buildSrtFile,
  extractLyricSungLines,
  parseDurationToSeconds,
  srtFilename,
  SRT_MODE_LABELS,
  SRT_TIMING_DISCLAIMER,
  type SrtMode
} from '../core/srtExport';
import {
  buildLyricsTranslationBridgeInstruction,
  importLyricsTranslationsJson,
  songLyricLinesFor,
  translateSongLyricsBatch,
  type LyricTranslationResult
} from '../core/lyricsTranslation';
import { buildZip } from '../utils/zipExporter';
import { downloadBlob, downloadText } from '../utils/exporters';
import { buildSetName } from '../utils/setNaming';
import { buildExportMeta } from '../core/exportMeta';
import type { PlaylistBlueprint, ProviderSettings, SongIdea } from '../types';

interface SrtExportPanelProps {
  blueprint: PlaylistBlueprint;
  textModelSettings?: ProviderSettings;
  onUpdateLyricTranslations: (translations: Map<number, LyricTranslationResult>) => void;
}

const ALL_MODES: SrtMode[] = ['en', 'en-ko', 'en-ja'];

function hasTranslation(song: SongIdea, mode: SrtMode): boolean {
  if (mode === 'en') return true;
  const lang = mode === 'en-ko' ? 'ko' : 'ja';
  return Boolean(song.lyricTranslations?.[lang]?.length);
}

export default function SrtExportPanel({ blueprint, textModelSettings, onUpdateLyricTranslations }: SrtExportPanelProps) {
  const songs = blueprint.songs;
  const [durations, setDurations] = useState<Record<number, string>>({});
  const [bulkPaste, setBulkPaste] = useState('');
  const [selectedModes, setSelectedModes] = useState<Set<SrtMode>>(new Set(['en']));
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [bridgeInstruction, setBridgeInstruction] = useState('');
  const [bridgeImportText, setBridgeImportText] = useState('');
  const [bridgeReport, setBridgeReport] = useState<{ imported: number; errors: string[] } | null>(null);

  const apiTranslationAvailable = Boolean(textModelSettings && textModelSettings.provider && textModelSettings.provider !== 'local');

  const songLines = useMemo(() => songLyricLinesFor(songs), [songs]);
  const totalKoDone = songs.filter(song => song.lyricTranslations?.ko?.length).length;
  const totalJaDone = songs.filter(song => song.lyricTranslations?.ja?.length).length;

  function toggleMode(mode: SrtMode) {
    setSelectedModes(prev => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  }

  function applyBulkPaste() {
    const lines = bulkPaste.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const next: Record<number, string> = { ...durations };
    songs.forEach((song, i) => {
      if (lines[i]) next[song.trackNo] = lines[i];
    });
    setDurations(next);
  }

  async function handleGenerateTranslationsViaApi() {
    if (!textModelSettings) return;
    setIsTranslating(true);
    setTranslationError('');
    try {
      const { translations, errors } = await translateSongLyricsBatch(songLines, textModelSettings);
      if (translations.size > 0) onUpdateLyricTranslations(translations);
      if (errors.length) setTranslationError(errors.join(' / '));
      if (!translations.size && !errors.length) setTranslationError('번역 결과를 받지 못했습니다. 잠시 후 다시 시도해주세요.');
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : '번역 요청이 실패했습니다.');
    } finally {
      setIsTranslating(false);
    }
  }

  function handleBuildBridgeInstruction() {
    const instruction = buildLyricsTranslationBridgeInstruction(songLines);
    setBridgeInstruction(instruction);
    downloadText('lyrics-translation-instruction.txt', instruction);
  }

  function handleImportBridgeJson() {
    if (!bridgeImportText.trim()) return;
    const { translations, report } = importLyricsTranslationsJson(bridgeImportText, songLines);
    setBridgeReport(report);
    if (translations.size > 0) onUpdateLyricTranslations(translations);
  }

  function cuesFor(song: SongIdea, mode: SrtMode) {
    const seconds = parseDurationToSeconds(durations[song.trackNo] || '');
    if (!seconds) return null;
    const lines = extractLyricSungLines(song.lyrics);
    const lang = mode === 'en-ko' ? 'ko' : mode === 'en-ja' ? 'ja' : undefined;
    const translated = lang ? song.lyricTranslations?.[lang] : undefined;
    return buildSrtCues(lines, seconds, translated);
  }

  function handleDownloadOne(song: SongIdea, mode: SrtMode) {
    const cues = cuesFor(song, mode);
    if (!cues || !cues.length) return;
    const content = buildSrtFile(cues, mode);
    downloadText(srtFilename(song.trackNo, song.title, mode), content, 'text/srt;charset=utf-8');
  }

  function handleBulkZipExport() {
    const files: { name: string; content: string }[] = [];
    // TASK v3.69 (TASK B) — one shared filename scheme (utils/setNaming.ts)
    // instead of this panel's own projectTitle-only name, so an SRT zip can
    // be traced back to the same set as its lyrics file/standalone export.
    const setName = buildSetName({
      date: blueprint.generatedAt ? new Date(blueprint.generatedAt) : new Date(),
      channelLabel: blueprint.channelName,
      conceptLabel: blueprint.oneLineConcept || blueprint.projectTitle
    });
    for (const song of songs) {
      for (const mode of selectedModes) {
        if (mode !== 'en' && !hasTranslation(song, mode)) continue;
        const cues = cuesFor(song, mode);
        if (!cues || !cues.length) continue;
        files.push({
          name: `${setName}/srt/${srtFilename(song.trackNo, song.title, mode)}`,
          content: buildSrtFile(cues, mode)
        });
      }
    }
    if (!files.length) return;
    // v4.0 (TASK C) — "SRT zip 안의 manifest" (this task's own spec item):
    // a listing of what's actually in the zip alongside the shared version/
    // schema meta block every export now carries (see core/exportMeta.ts).
    files.push({
      name: `${setName}/manifest.json`,
      content: JSON.stringify({
        ...buildExportMeta(blueprint.generatedAt),
        setName,
        files: files.map(file => file.name)
      }, null, 2)
    });
    downloadBlob(`${setName}_srt.zip`, buildZip(files));
  }

  const readyCount = songs.filter(song => parseDurationToSeconds(durations[song.trackNo] || '')).length;

  return (
    <div className="provider-summary">
      <div className="panel-title">
        <Captions size={18} />
        <h2>🎬 캡컷 자막(SRT) 내보내기</h2>
      </div>
      <p className="supporting">{SRT_TIMING_DISCLAIMER}</p>
      <p className="supporting">캡컷에서 정상적으로 임포트되는지는 직접 한 번 확인해보세요 — 캡컷 버전에 따라 자막 스타일 임포트 방식이 다를 수 있습니다.</p>

      <div className="panel-title">
        <Languages size={16} />
        <h3>1. 번역 생성 (한국어/일본어)</h3>
      </div>
      <p className="supporting">한국어 번역 완료 {totalKoDone}/{songs.length}곡 · 일본어 번역 완료 {totalJaDone}/{songs.length}곡</p>
      <div className="button-row">
        <button type="button" className="primary" disabled={!apiTranslationAvailable || isTranslating} onClick={() => void handleGenerateTranslationsViaApi()} title={!apiTranslationAvailable ? 'Claude 또는 ChatGPT API 설정이 필요합니다.' : undefined}>
          <Languages size={16} />
          {isTranslating ? '번역 생성 중...' : `AI로 전체 ${songs.length}곡 번역 생성`}
        </button>
        <button type="button" onClick={handleBuildBridgeInstruction}>
          <Download size={16} />
          브릿지 지시문 받기 (API 키 없이)
        </button>
      </div>
      {translationError && <p className="error">{translationError}</p>}
      {bridgeInstruction && (
        <p className="supporting">
          지시문 파일을 다운로드했어요. Claude Code/Codex 등에 붙여넣고 실행한 뒤, 생성된 <code>lyrics-translations.json</code> 내용을 아래에 붙여넣고 가져오기를 누르세요.
        </p>
      )}
      <textarea
        rows={4}
        placeholder="lyrics-translations.json 파일 내용을 여기에 붙여넣으세요"
        value={bridgeImportText}
        onChange={event => setBridgeImportText(event.target.value)}
      />
      <div className="button-row">
        <button type="button" disabled={!bridgeImportText.trim()} onClick={handleImportBridgeJson}>
          번역 가져오기
        </button>
      </div>
      {bridgeReport && (
        <p className={bridgeReport.errors.length ? 'error' : 'supporting'}>
          {bridgeReport.imported}곡 반영됨{bridgeReport.errors.length ? ` / ${bridgeReport.errors.join(' / ')}` : ''}
        </p>
      )}

      <div className="panel-title">
        <h3>2. 곡별 재생시간 입력 (MM:SS)</h3>
      </div>
      <p className="supporting">캡컷/수노에서 확인한 실제 재생시간을 입력하면 섹션([verse]/[chorus]/[bridge]) 비율로 자막 구간을 자동 분배합니다.</p>
      <textarea
        rows={3}
        placeholder={`한 줄에 한 곡씩, 트랙 순서대로 MM:SS를 붙여넣으세요 (예: 3:15)`}
        value={bulkPaste}
        onChange={event => setBulkPaste(event.target.value)}
      />
      <div className="button-row">
        <button type="button" onClick={applyBulkPaste}>일괄 적용</button>
      </div>
      <div className="avoid-word-list">
        {songs.map(song => (
          <label key={song.trackNo} className="avoid-word-item">
            {song.trackNo}. {song.titleDisplay ?? song.title}
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM:SS"
              style={{ width: 80, marginLeft: 8 }}
              value={durations[song.trackNo] || ''}
              onChange={event => setDurations(prev => ({ ...prev, [song.trackNo]: event.target.value }))}
            />
            {ALL_MODES.map(mode => (
              <button
                key={mode}
                type="button"
                className="action-button"
                style={{ marginLeft: 8 }}
                title={`${SRT_MODE_LABELS[mode]} SRT 다운로드`}
                disabled={!parseDurationToSeconds(durations[song.trackNo] || '') || (mode !== 'en' && !hasTranslation(song, mode))}
                onClick={() => handleDownloadOne(song, mode)}
              >
                {SRT_MODE_LABELS[mode]}
              </button>
            ))}
          </label>
        ))}
      </div>

      <div className="panel-title">
        <h3>3. 일괄 내보내기</h3>
      </div>
      <div className="chips">
        {ALL_MODES.map(mode => (
          <button key={mode} type="button" className={selectedModes.has(mode) ? 'chip active' : 'chip'} onClick={() => toggleMode(mode)}>
            {SRT_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      <p className="supporting">재생시간이 입력된 곡 {readyCount}/{songs.length}곡이 내보내기 대상입니다.</p>
      <div className="button-row">
        <button type="button" className="primary" disabled={!readyCount || !selectedModes.size} onClick={handleBulkZipExport}>
          <Download size={16} />
          {`선택한 형식으로 ${songs.length}곡 일괄 ZIP 내보내기`}
        </button>
      </div>
    </div>
  );
}
