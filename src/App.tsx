import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Plus, Save, Settings2, ShieldAlert, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { channelPresets, generationPacks, genrePacks, moodPacks, seasonPacks } from './data/presets';
import type { AgeGroup, ChannelProfile, GenerationOptions, LyricLanguage, Market, PlaylistBlueprint, ProviderSettings } from './types';
import { generateBlueprint } from './providers';
import { downloadText, exportCsv, exportJson, exportMarkdown } from './utils/exporters';

const STORAGE_KEY = 'suno-weaver-custom-channels-v2';
const defaultChannel = channelPresets[0];

const marketOptions: { value: Market; label: string }[] = [
  { value: 'korea', label: 'Korea' },
  { value: 'japan', label: 'Japan' },
  { value: 'global', label: 'Global' },
  { value: 'custom', label: 'Custom' }
];

const languageOptions: { value: LyricLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'korean', label: 'Korean' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'bilingual', label: 'Bilingual' }
];

function clampSongCount(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.min(20, Math.max(10, Math.round(value)));
}

function parseList(value: string) {
  return value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
}

function formatList(value: string[]) {
  return value.join(', ');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44) || `channel-${Date.now()}`;
}

function makeUniqueId(label: string, existingIds: Set<string>, currentId?: string) {
  const root = slugify(label);
  let candidate = root;
  let suffix = 2;
  while (existingIds.has(candidate) && candidate !== currentId) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeChannel(input: Partial<ChannelProfile>): ChannelProfile {
  return {
    id: input.id || `channel-${Date.now()}`,
    name: input.name?.trim() || 'Untitled Channel',
    englishName: input.englishName?.trim() || input.name?.trim() || 'Untitled Channel',
    market: input.market || 'custom',
    primaryLanguage: input.primaryLanguage || 'english',
    audience: input.audience || 'allAges',
    promise: input.promise?.trim() || 'custom playlist channel concept',
    visualIdentity: input.visualIdentity?.trim() || 'consistent thumbnail layout, readable typography, recognizable channel colors',
    defaultVocal: input.defaultVocal?.trim() || 'clear emotional vocal, polished playlist-friendly delivery',
    preferredGenres: input.preferredGenres?.length ? input.preferredGenres : ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: input.preferredMoods?.length ? input.preferredMoods : ['warm', 'hopeful'],
    forbiddenCliches: input.forbiddenCliches?.length ? input.forbiddenCliches : ['famous artist imitation', 'copied song structure'],
    seoKeywords: input.seoKeywords || []
  };
}

function createDraftChannel(name = 'New Playlist Channel'): ChannelProfile {
  return normalizeChannel({
    id: slugify(name),
    name,
    englishName: name,
    market: 'custom',
    primaryLanguage: 'english',
    audience: 'allAges',
    promise: 'creator-defined playlist channel with a clear listener promise',
    visualIdentity: 'consistent colors, readable thumbnail typography, clear seasonal object',
    defaultVocal: 'clear emotional vocal, polished playlist-friendly delivery',
    preferredGenres: ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: ['warm', 'hopeful'],
    forbiddenCliches: ['famous artist imitation', 'copied song structure'],
    seoKeywords: []
  });
}

function readStoredChannels() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => normalizeChannel(item)).filter(channel => channel.id);
  } catch {
    return [];
  }
}

function writeStoredChannels(channels: ChannelProfile[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  } catch {
    // Storage can be blocked in private or embedded browser contexts.
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function App() {
  const [customChannels, setCustomChannels] = useState<ChannelProfile[]>(() => readStoredChannels());
  const channels = useMemo(() => [...channelPresets, ...customChannels], [customChannels]);
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannel.id);
  const selectedChannel = channels.find(channel => channel.id === selectedChannelId) || defaultChannel;
  const [editorChannel, setEditorChannel] = useState<ChannelProfile>(() => ({ ...defaultChannel }));
  const [quickChannelName, setQuickChannelName] = useState('');
  const [provider, setProvider] = useState<ProviderSettings>({ provider: 'local', temperature: 0.8, proxyEndpoint: '/api/generate' });
  const [opts, setOpts] = useState<GenerationOptions>({
    channel: selectedChannel,
    projectTitle: 'Autumn to Christmas Playlist Pack',
    songCount: 12,
    lyricLanguage: 'english',
    market: selectedChannel.market,
    audience: selectedChannel.audience,
    genreIds: selectedChannel.preferredGenres,
    moodIds: selectedChannel.preferredMoods,
    seasonId: 'christmas',
    vocalTone: selectedChannel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customConcept: '',
    avoidWords: ''
  });
  const [blueprint, setBlueprint] = useState<PlaylistBlueprint | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const selectedGenres = useMemo(() => genrePacks.filter(genre => opts.genreIds.includes(genre.id)), [opts.genreIds]);
  const selectedMoods = useMemo(() => moodPacks.filter(mood => opts.moodIds.includes(mood.id)), [opts.moodIds]);
  const selectedSeason = useMemo(() => seasonPacks.find(season => season.id === opts.seasonId) || seasonPacks[0], [opts.seasonId]);
  const selectedGenerationPack = useMemo(() => generationPacks.find(pack => pack.id === opts.audience), [opts.audience]);
  const isSelectedCustom = customChannels.some(channel => channel.id === selectedChannelId);

  useEffect(() => {
    writeStoredChannels(customChannels);
  }, [customChannels]);

  function applyChannelToOptions(channel: ChannelProfile) {
    setOpts(prev => ({
      ...prev,
      channel,
      market: channel.market,
      audience: channel.audience,
      lyricLanguage: channel.primaryLanguage,
      genreIds: channel.preferredGenres,
      moodIds: channel.preferredMoods,
      vocalTone: channel.defaultVocal
    }));
  }

  function selectChannel(id: string) {
    const channel = channels.find(item => item.id === id) || defaultChannel;
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    applyChannelToOptions(channel);
  }

  function addQuickChannel() {
    const name = quickChannelName.trim();
    if (!name) return;
    const existingIds = new Set(channels.map(channel => channel.id));
    const channel = normalizeChannel({ ...createDraftChannel(name), id: makeUniqueId(name, existingIds) });
    setCustomChannels(prev => [...prev, channel]);
    setQuickChannelName('');
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    applyChannelToOptions(channel);
  }

  function startNewProfile() {
    const existingIds = new Set(channels.map(channel => channel.id));
    const channel = normalizeChannel({ ...createDraftChannel(), id: makeUniqueId('new-playlist-channel', existingIds) });
    setEditorChannel(channel);
  }

  function saveEditorProfile() {
    const editingCustom = customChannels.some(channel => channel.id === editorChannel.id);
    const existingIds = new Set(channels.map(channel => channel.id));
    const id = editingCustom
      ? editorChannel.id
      : makeUniqueId(editorChannel.englishName || editorChannel.name, existingIds);
    const channel = normalizeChannel({ ...editorChannel, id });

    setCustomChannels(prev => (
      editingCustom
        ? prev.map(item => (item.id === channel.id ? channel : item))
        : [...prev, channel]
    ));
    setSelectedChannelId(channel.id);
    setEditorChannel({ ...channel });
    applyChannelToOptions(channel);
  }

  function deleteSelectedCustomChannel() {
    if (!isSelectedCustom) return;
    setCustomChannels(prev => prev.filter(channel => channel.id !== selectedChannelId));
    setSelectedChannelId(defaultChannel.id);
    setEditorChannel({ ...defaultChannel });
    applyChannelToOptions(defaultChannel);
  }

  function updateEditorField<K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) {
    setEditorChannel(prev => ({ ...prev, [key]: value }));
  }

  function updateEditorList(key: 'preferredGenres' | 'preferredMoods' | 'forbiddenCliches' | 'seoKeywords', value: string) {
    setEditorChannel(prev => ({ ...prev, [key]: parseList(value) }));
  }

  function toggleArray(key: 'genreIds' | 'moodIds', id: string) {
    setOpts(prev => {
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [key]: Array.from(next) };
    });
  }

  async function onGenerate() {
    setIsGenerating(true);
    setError('');
    try {
      const songCount = clampSongCount(opts.songCount);
      const genres = selectedGenres.length ? selectedGenres : [genrePacks[0]];
      const moods = selectedMoods.length ? selectedMoods : [moodPacks[0]];
      const next = await generateBlueprint(
        { ...opts, channel: selectedChannel, songCount },
        genres,
        moods,
        selectedSeason,
        provider
      );
      setOpts(prev => ({ ...prev, songCount }));
      setBlueprint(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Suno Weaver Studio v2</p>
          <h1>Playlist prompt and lyrics workbench</h1>
        </div>
        <button type="button" className="primary action-button" disabled={isGenerating} onClick={onGenerate}>
          <Wand2 size={18} />
          {isGenerating ? 'Generating...' : 'Generate 10-20 songs'}
        </button>
      </header>

      <section className="workspace-grid">
        <aside className="panel">
          <div className="panel-title">
            <Settings2 size={18} />
            <h2>Channel</h2>
          </div>
          <label>Profile</label>
          <select value={selectedChannelId} onChange={event => selectChannel(event.target.value)}>
            {channels.map(channel => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            ))}
          </select>

          <label>Quick add</label>
          <div className="inline">
            <input
              value={quickChannelName}
              onChange={event => setQuickChannelName(event.target.value)}
              placeholder="New channel name"
            />
            <button type="button" className="icon-button" title="Add channel" onClick={addQuickChannel}>
              <Plus size={18} />
            </button>
          </div>

          <div className="profile-summary">
            <b>{selectedChannel.englishName || selectedChannel.name}</b>
            <span>{selectedChannel.promise}</span>
          </div>
        </aside>

        <section className="panel profile-editor">
          <div className="panel-header">
            <div className="panel-title">
              <Sparkles size={18} />
              <h2>Channel Profile Editor</h2>
            </div>
            <div className="button-row">
              <button type="button" onClick={startNewProfile}>
                <Plus size={16} />
                New
              </button>
              <button type="button" onClick={saveEditorProfile}>
                <Save size={16} />
                Save
              </button>
              <button type="button" disabled={!isSelectedCustom} onClick={deleteSelectedCustomChannel}>
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>

          <div className="form-grid three">
            <div>
              <label>Name</label>
              <input value={editorChannel.name} onChange={event => updateEditorField('name', event.target.value)} />
            </div>
            <div>
              <label>English name</label>
              <input value={editorChannel.englishName || ''} onChange={event => updateEditorField('englishName', event.target.value)} />
            </div>
            <div>
              <label>Market</label>
              <select value={editorChannel.market} onChange={event => updateEditorField('market', event.target.value as Market)}>
                {marketOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label>Primary language</label>
              <select value={editorChannel.primaryLanguage} onChange={event => updateEditorField('primaryLanguage', event.target.value as LyricLanguage)}>
                {languageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label>Generation pack</label>
              <select value={editorChannel.audience} onChange={event => updateEditorField('audience', event.target.value as AgeGroup)}>
                {generationPacks.map(pack => <option key={pack.id} value={pack.id}>{pack.label}</option>)}
              </select>
            </div>
            <div>
              <label>Default vocal</label>
              <input value={editorChannel.defaultVocal} onChange={event => updateEditorField('defaultVocal', event.target.value)} />
            </div>
          </div>

          <div className="form-grid two">
            <div>
              <label>Channel promise</label>
              <textarea value={editorChannel.promise} onChange={event => updateEditorField('promise', event.target.value)} />
            </div>
            <div>
              <label>Visual identity</label>
              <textarea value={editorChannel.visualIdentity} onChange={event => updateEditorField('visualIdentity', event.target.value)} />
            </div>
          </div>

          <div className="form-grid two">
            <div>
              <label>Preferred genre ids</label>
              <textarea value={formatList(editorChannel.preferredGenres)} onChange={event => updateEditorList('preferredGenres', event.target.value)} />
            </div>
            <div>
              <label>Preferred mood ids</label>
              <textarea value={formatList(editorChannel.preferredMoods)} onChange={event => updateEditorList('preferredMoods', event.target.value)} />
            </div>
            <div>
              <label>Forbidden cliches</label>
              <textarea value={formatList(editorChannel.forbiddenCliches)} onChange={event => updateEditorList('forbiddenCliches', event.target.value)} />
            </div>
            <div>
              <label>SEO keywords</label>
              <textarea value={formatList(editorChannel.seoKeywords)} onChange={event => updateEditorList('seoKeywords', event.target.value)} />
            </div>
          </div>
        </section>
      </section>

      <section className="workspace-grid lower">
        <section className="panel">
          <div className="panel-title">
            <Wand2 size={18} />
            <h2>Generation Setup</h2>
          </div>
          <div className="form-grid four">
            <div>
              <label>Project title</label>
              <input value={opts.projectTitle} onChange={event => setOpts({ ...opts, projectTitle: event.target.value })} />
            </div>
            <div>
              <label>Songs</label>
              <input type="number" min={10} max={20} value={opts.songCount} onChange={event => setOpts({ ...opts, songCount: clampSongCount(Number(event.target.value)) })} />
            </div>
            <div>
              <label>Lyrics language</label>
              <select value={opts.lyricLanguage} onChange={event => setOpts({ ...opts, lyricLanguage: event.target.value as LyricLanguage })}>
                {languageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label>Season pack</label>
              <select value={opts.seasonId} onChange={event => setOpts({ ...opts, seasonId: event.target.value })}>
                {seasonPacks.map(season => <option key={season.id} value={season.id}>{season.label}</option>)}
              </select>
            </div>
            <div>
              <label>Generation pack</label>
              <select value={opts.audience} onChange={event => setOpts({ ...opts, audience: event.target.value as AgeGroup })}>
                {generationPacks.map(pack => <option key={pack.id} value={pack.id}>{pack.label}</option>)}
              </select>
            </div>
            <div>
              <label>Money chords</label>
              <select value={opts.moneyChordMode} onChange={event => setOpts({ ...opts, moneyChordMode: event.target.value as GenerationOptions['moneyChordMode'] })}>
                <option value="default">Default I-V-vi-IV</option>
                <option value="emotional">Emotional Lift</option>
                <option value="jazzColor">Jazz Color</option>
                <option value="cityPop">City Pop</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label>Length control</label>
              <select value={opts.durationTarget} onChange={event => setOpts({ ...opts, durationTarget: event.target.value as GenerationOptions['durationTarget'] })}>
                <option value="under3m30">3:10-3:35</option>
                <option value="under4m">Under 4:00</option>
                <option value="playlistShort">2:50-3:20</option>
              </select>
            </div>
            <div>
              <label>Lyric depth</label>
              <select value={opts.lyricDepth} onChange={event => setOpts({ ...opts, lyricDepth: event.target.value as GenerationOptions['lyricDepth'] })}>
                <option value="commercial">Commercial</option>
                <option value="simple">Simple</option>
                <option value="literary">Literary</option>
                <option value="poetic">Poetic</option>
              </select>
            </div>
          </div>

          {selectedGenerationPack && <p className="supporting">{selectedGenerationPack.audienceNote}</p>}

          <div className="option-block">
            <h3>Genre packs</h3>
            <div className="chips">
              {genrePacks.map(genre => (
                <button
                  type="button"
                  key={genre.id}
                  className={opts.genreIds.includes(genre.id) ? 'chip active' : 'chip'}
                  onClick={() => toggleArray('genreIds', genre.id)}
                >
                  {genre.label}
                </button>
              ))}
            </div>
          </div>

          <div className="option-block">
            <h3>Mood packs</h3>
            <div className="chips">
              {moodPacks.map(mood => (
                <button
                  type="button"
                  key={mood.id}
                  className={opts.moodIds.includes(mood.id) ? 'chip active' : 'chip'}
                  onClick={() => toggleArray('moodIds', mood.id)}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid two">
            <div>
              <label>Vocal tone</label>
              <input value={opts.vocalTone} onChange={event => setOpts({ ...opts, vocalTone: event.target.value })} />
            </div>
            <div>
              <label>Avoid words / risk terms</label>
              <input value={opts.avoidWords} onChange={event => setOpts({ ...opts, avoidWords: event.target.value })} placeholder="artist names, song titles, risky imitation phrases" />
            </div>
          </div>

          <label>Custom concept</label>
          <textarea value={opts.customConcept} onChange={event => setOpts({ ...opts, customConcept: event.target.value })} placeholder="Playlist angle, listener situation, upload theme, or thumbnail direction" />

          {error && <p className="error">{error}</p>}
        </section>

        <aside className="panel">
          <div className="panel-title">
            <ShieldAlert size={18} />
            <h2>AI Provider</h2>
          </div>
          <label>Provider</label>
          <select value={provider.provider} onChange={event => setProvider({ ...provider, provider: event.target.value as ProviderSettings['provider'] })}>
            <option value="local">Local Template</option>
            <option value="openai">OpenAI via proxy</option>
            <option value="anthropic">Claude via proxy</option>
          </select>
          <label>Model</label>
          <input
            value={provider.model || ''}
            onChange={event => setProvider({ ...provider, model: event.target.value })}
            placeholder={provider.provider === 'anthropic' ? 'claude-3-5-sonnet-latest' : 'gpt-4.1-mini'}
            disabled={provider.provider === 'local'}
          />
          <label>Proxy endpoint</label>
          <input
            value={provider.proxyEndpoint || '/api/generate'}
            onChange={event => setProvider({ ...provider, proxyEndpoint: event.target.value })}
            disabled={provider.provider === 'local'}
          />
          <label>Temperature {provider.temperature.toFixed(1)}</label>
          <input type="range" min="0.2" max="1.2" step="0.1" value={provider.temperature} onChange={event => setProvider({ ...provider, temperature: Number(event.target.value) })} />
          <p className="supporting">Browser API keys are disabled. The proxy reads server-side environment variables only.</p>
          <button type="button" className="primary full-width action-button" disabled={isGenerating} onClick={onGenerate}>
            <Wand2 size={18} />
            {isGenerating ? 'Generating...' : 'Generate pack'}
          </button>
        </aside>
      </section>

      {blueprint && (
        <section className="panel results">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Generated Pack</p>
              <h2>{blueprint.projectTitle}</h2>
              <p className="supporting">{blueprint.oneLineConcept}</p>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => downloadText('suno-pack.md', exportMarkdown(blueprint), 'text/markdown;charset=utf-8')}>
                <Download size={16} />
                MD
              </button>
              <button type="button" onClick={() => downloadText('suno-pack.json', exportJson(blueprint), 'application/json;charset=utf-8')}>
                <Download size={16} />
                JSON
              </button>
              <button type="button" onClick={() => downloadText('suno-pack.csv', exportCsv(blueprint), 'text/csv;charset=utf-8')}>
                <Download size={16} />
                CSV
              </button>
            </div>
          </div>

          <div className="signature-grid">
            <div><b>Sonic</b><span>{blueprint.sonicSignature}</span></div>
            <div><b>Vocal</b><span>{blueprint.vocalSignature}</span></div>
            <div><b>Visual</b><span>{blueprint.visualRules.join(' / ')}</span></div>
          </div>

          {blueprint.songs.map(song => (
            <article className="song" key={song.trackNo}>
              <div className="song-head">
                <div>
                  <h3>{song.trackNo}. {song.title}</h3>
                  <p>{song.listenerSituation} / {song.emotionArc}</p>
                </div>
                <span className="score">{song.qualityScore}/100</span>
              </div>

              {song.warnings.length > 0 && (
                <div className="warning">
                  <ShieldAlert size={16} />
                  <span>{song.warnings.join(' / ')}</span>
                </div>
              )}

              <div className="result-grid">
                <section className="copy-block">
                  <div className="copy-head">
                    <h4>Style Prompt</h4>
                    <button type="button" onClick={() => void copyText(song.stylePrompt)}>
                      <Copy size={15} />
                      Copy
                    </button>
                  </div>
                  <pre>{song.stylePrompt}</pre>
                </section>

                <section className="copy-block">
                  <div className="copy-head">
                    <h4>Lyrics</h4>
                    <button type="button" onClick={() => void copyText(song.lyrics)}>
                      <Copy size={15} />
                      Copy
                    </button>
                  </div>
                  <pre>{song.lyrics}</pre>
                </section>

                <section className="copy-block metadata">
                  <div className="copy-head">
                    <h4>YouTube</h4>
                    <button type="button" onClick={() => void copyText(JSON.stringify(song.youtube, null, 2))}>
                      <Copy size={15} />
                      Copy all
                    </button>
                  </div>
                  <div className="metadata-row">
                    <b>Title</b>
                    <button type="button" onClick={() => void copyText(song.youtube.title)}><Copy size={14} />Copy</button>
                    <span>{song.youtube.title}</span>
                  </div>
                  <div className="metadata-row">
                    <b>Description</b>
                    <button type="button" onClick={() => void copyText(song.youtube.description)}><Copy size={14} />Copy</button>
                    <span>{song.youtube.description}</span>
                  </div>
                  <div className="metadata-row">
                    <b>Tags</b>
                    <button type="button" onClick={() => void copyText(song.youtube.tags.join(', '))}><Copy size={14} />Copy</button>
                    <span>{song.youtube.tags.join(', ')}</span>
                  </div>
                  <div className="metadata-row">
                    <b>Thumbnail</b>
                    <button type="button" onClick={() => void copyText(song.youtube.thumbnailText)}><Copy size={14} />Copy</button>
                    <span>{song.youtube.thumbnailText}</span>
                  </div>
                </section>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
