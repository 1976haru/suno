import type { ChannelArchetype, GenreLyricFlavorImage, GenrePack } from '../../types';
import type { GenreTier } from './types';

/**
 * TASK H2 (v3.13) — 3-5 short, genre-authentic images per core-tier genre id,
 * covering senior-morning's and showa-cafe's core genre lists (the two real
 * production archetypes). composeLyrics uses exactly one of these per song,
 * in the 'situation' slot only, so genre selection is audible in the lyrics
 * themselves rather than only in the style prompt. Deliberately archetype-
 * neutral (no modern IT vocabulary, nothing that reads as breakup/alcohol
 * imagery) so the handful of genres shared between both archetypes' core
 * lists (jazz-pop, bossa-cafe, lofi-cafe, piano-ballad, christmas-soft-pop)
 * stay safe for either one. Extended-tier genres without an entry here fall
 * back to the pre-v3.13 generic filler pool — this is additive, not a
 * requirement every genre must satisfy.
 */
export const CORE_LYRIC_FLAVOR_IMAGES: Partial<Record<string, GenreLyricFlavorImage[]>> = {
  'adult-contemporary': [
    { english: 'soft radio dial', korean: '부드러운 라디오 다이얼', japanese: 'やわらかなラジオのダイヤル' },
    { english: 'warm coffee cup', korean: '따뜻한 커피잔', japanese: 'あたたかいコーヒーカップ' },
    { english: 'quiet window seat', korean: '조용한 창가 자리', japanese: '静かな窓辺の席' }
  ],
  'acoustic-pop': [
    { english: 'worn guitar strings', korean: '낡은 기타 줄', japanese: '使い込んだギターの弦' },
    { english: 'porch step', korean: '현관 계단', japanese: '玄関の段差' },
    { english: 'quiet strum', korean: '조용한 기타 스트럼', japanese: '静かなストローク' }
  ],
  'jazz-pop': [
    { english: 'candlelight', korean: '촛불빛', japanese: 'キャンドルの灯り' },
    { english: 'brass hush', korean: '금관악기의 낮은 울림', japanese: '金管の静かな響き' },
    { english: 'velvet quiet', korean: '벨벳 같은 고요함', japanese: 'ビロードのような静けさ' }
  ],
  'lofi-cafe': [
    { english: 'rain on the glass', korean: '유리창에 내리는 비', japanese: 'ガラスに降る雨' },
    { english: 'vinyl crackle', korean: '레코드판의 잡음', japanese: 'レコードのノイズ' },
    { english: 'soft headphones', korean: '부드러운 헤드폰', japanese: 'やわらかなヘッドホン' }
  ],
  'healing-ballad': [
    { english: 'soft piano keys', korean: '부드러운 피아노 건반', japanese: 'やわらかなピアノの鍵盤' },
    { english: 'quiet tears drying', korean: '조용히 마르는 눈물', japanese: '静かに乾く涙' },
    { english: 'gentle held breath', korean: '가만히 참은 숨', japanese: 'そっと止めた息' }
  ],
  'piano-ballad': [
    { english: 'ivory keys', korean: '하얀 건반', japanese: '白い鍵盤' },
    { english: 'slow pedal hum', korean: '느린 페달의 울림', japanese: 'ゆっくりとしたペダルの響き' },
    { english: 'single spotlight', korean: '하나의 조명', japanese: '一筋のスポットライト' }
  ],
  'retro-soul-pop': [
    { english: 'warm vinyl groove', korean: '따뜻한 레코드의 홈', japanese: 'あたたかいレコードの溝' },
    { english: 'tape hiss', korean: '테이프의 잡음', japanese: 'テープのヒスノイズ' },
    { english: 'velvet stage light', korean: '벨벳 같은 무대 조명', japanese: 'ビロードのような舞台照明' }
  ],
  'bossa-cafe': [
    { english: 'sunlit patio', korean: '햇살 드는 테라스', japanese: '陽だまりのテラス' },
    { english: 'soft nylon strings', korean: '부드러운 나일론 줄', japanese: 'やわらかなナイロン弦' },
    { english: 'iced glass condensation', korean: '유리잔에 맺힌 물방울', japanese: 'グラスに浮かぶ水滴' }
  ],
  'christmas-soft-pop': [
    { english: 'string of warm lights', korean: '따뜻한 조명 줄', japanese: 'あたたかな灯りの連なり' },
    { english: 'wrapped paper', korean: '포장지', japanese: '包装紙' },
    { english: 'frosted window pane', korean: '서리 낀 창유리', japanese: '霜のついた窓ガラス' }
  ],
  'folk-pop': [
    { english: 'worn wooden bench', korean: '낡은 나무 벤치', japanese: '使い古した木のベンチ' },
    { english: 'open field breeze', korean: '들판의 바람', japanese: '野原を渡る風' },
    { english: 'hand-me-down scarf', korean: '물려받은 목도리', japanese: 'お下がりのマフラー' }
  ],
  'showa-modern': [
    { english: 'rotary phone', korean: '다이얼 전화기', japanese: 'ダイヤル電話' },
    { english: 'neon sign glow', korean: '네온사인 불빛', japanese: 'ネオンサインの灯り' },
    { english: 'jazz record spinning', korean: '돌아가는 재즈 레코드', japanese: '回るジャズレコード' }
  ],
  'city-pop-soft': [
    { english: 'wet city pavement', korean: '젖은 도시 보도', japanese: '濡れた街の舗道' },
    { english: 'neon reflection', korean: '네온 불빛의 반사', japanese: 'ネオンの反射' },
    { english: 'late train window', korean: '늦은 기차 창문', japanese: '終電の窓' }
  ],
  'jazz-classic-vocal-lounge': [
    { english: 'dim lounge light', korean: '어스름한 라운지 조명', japanese: '薄暗いラウンジの灯り' },
    { english: 'brass mute', korean: '약음기를 낀 금관악기', japanese: 'ミュートをつけた金管' },
    { english: 'velvet curtain', korean: '벨벳 커튼', japanese: 'ビロードのカーテン' }
  ],
  'jazz-soft-vocal-trio': [
    { english: 'upright bass hum', korean: '콘트라베이스의 울림', japanese: 'アップライトベースの響き' },
    { english: 'small stage light', korean: '작은 무대 조명', japanese: '小さな舞台照明' },
    { english: 'quiet applause', korean: '조용한 박수', japanese: '静かな拍手' }
  ],
  'city-pop-rainy-window-pop': [
    { english: 'rain-streaked window', korean: '빗물 흐르는 창문', japanese: '雨の伝う窓' },
    { english: 'city lights blur', korean: '흐려진 도시 불빛', japanese: 'にじむ街の灯り' },
    { english: 'wet umbrella', korean: '젖은 우산', japanese: '濡れた傘' }
  ]
};

export interface GenreCategory {
  id: string;
  label: string;
  description: string;
}

export interface StructuredGenrePack extends GenrePack {
  categoryId: string;
  archetypes: ChannelArchetype[];
  tier: GenreTier;
  rhythm: string[];
  vocal: string[];
  production: string[];
  harmony: string[];
  tempo: [number, number];
  moods: string[];
  audiences: string[];
  avoidTraits: string[];
  shortPrompt: string;
  productionGuidance: string;
  source: 'legacy-preset' | 'notion-analysis';
}

interface GenreVariantSeed {
  slug: string;
  label: string;
  tags: string[];
  tempo?: [number, number];
}

interface CategoryBase {
  id: string;
  label: string;
  rhythm: string[];
  instruments: string[];
  vocal: string[];
  production: string[];
  harmony: string[];
  tempo: [number, number];
  moods: string[];
  audiences: string[];
  avoidTraits: string[];
}

const sharedAvoid = [
  'famous artist imitation',
  'copied melody',
  'copyrighted song reference',
  'soundalike vocal',
  'overlong intro'
];

export const genreCategories: GenreCategory[] = [
  { id: 'pop', label: 'Pop and Singer-Songwriter', description: 'Playlist-safe pop, acoustic pop, folk pop, and soft rock presets.' },
  { id: 'jazz', label: 'Jazz', description: 'Swing, trio, vocal jazz, lounge, fusion, bossa, and modern jazz-derived prompts.' },
  { id: 'city-pop', label: 'City Pop', description: 'Retro-modern urban pop, polished bass grooves, clean guitars, synth color, and night-drive moods.' },
  { id: 'rnb', label: 'R&B and Soul', description: 'Modern R&B, neo-soul, quiet storm, slow jam, and bass-forward vocal textures.' },
  { id: 'lofi', label: 'Lo-fi and Study', description: 'Dusty drums, tape grain, warm keys, jazzhop, and focus-friendly cafe textures.' },
  { id: 'ballad', label: 'Ballad', description: 'Piano-led pop ballads, healing ballads, duet ballads, and cinematic emotional builds.' },
  { id: 'seasonal', label: 'Seasonal', description: 'Holiday and seasonal playlist presets.' },
  { id: 'electronic', label: 'Electronic', description: 'Soft synthwave and electronic retro-pop textures.' }
];

export const SENIOR_MORNING_CORE_GENRE_IDS = [
  'adult-contemporary',
  'acoustic-pop',
  'jazz-pop',
  'healing-ballad',
  'piano-ballad',
  'lofi-cafe',
  'retro-soul-pop',
  'bossa-cafe',
  'christmas-soft-pop',
  'folk-pop'
] as const;

export const SHOWA_CAFE_CORE_GENRE_IDS = [
  'showa-modern',
  'city-pop-soft',
  'jazz-pop',
  'bossa-cafe',
  'lofi-cafe',
  'piano-ballad',
  'christmas-soft-pop',
  'jazz-classic-vocal-lounge',
  'jazz-soft-vocal-trio',
  'city-pop-rainy-window-pop'
] as const;

export const CORE_GENRE_IDS_BY_ARCHETYPE: Record<ChannelArchetype, readonly string[]> = {
  'senior-morning': SENIOR_MORNING_CORE_GENRE_IDS,
  'showa-cafe': SHOWA_CAFE_CORE_GENRE_IDS,
  christmas: [],
  'lofi-study': [],
  kids: []
};

const allCoreGenreIds = new Set<string>([
  ...SENIOR_MORNING_CORE_GENRE_IDS,
  ...SHOWA_CAFE_CORE_GENRE_IDS
]);

const quietCafeSignals = [
  'acoustic',
  'ballad',
  'baritone',
  'bossa',
  'cafe',
  'classic',
  'comfort',
  'dinner',
  'healing',
  'intimate',
  'lounge',
  'mellow',
  'minimal',
  'night',
  'piano',
  'rain',
  'retro',
  'slow',
  'soft',
  'trio',
  'vocal',
  'warm'
];

const aggressiveOrWrongChannelSignals = [
  'acid',
  'bebop',
  'big band',
  'boom bap',
  'cabaret',
  'club',
  'disco',
  'experimental',
  'free',
  'funky',
  'hard bop',
  'hiphop',
  'new orleans',
  'nu jazz',
  'rap',
  'scat',
  'trap',
  'uptempo'
];

function textForGenreSignals(input: {
  id: string;
  label: string;
  categoryId?: string;
  aliases?: string[];
  goodFor?: string[];
  moods?: string[];
  audiences?: string[];
}) {
  return [
    input.id,
    input.label,
    input.categoryId,
    ...(input.aliases || []),
    ...(input.goodFor || []),
    ...(input.moods || []),
    ...(input.audiences || [])
  ].join(' ').toLowerCase();
}

function containsAny(haystack: string, needles: string[]) {
  return needles.some(needle => haystack.includes(needle));
}

function inferArchetypes(input: {
  id: string;
  label: string;
  categoryId?: string;
  aliases?: string[];
  goodFor?: string[];
  moods?: string[];
  audiences?: string[];
}): ChannelArchetype[] {
  const text = textForGenreSignals(input);
  const archetypes = new Set<ChannelArchetype>();
  for (const [archetype, ids] of Object.entries(CORE_GENRE_IDS_BY_ARCHETYPE) as [ChannelArchetype, readonly string[]][]) {
    if (ids.includes(input.id)) archetypes.add(archetype);
  }

  const quietEnough = containsAny(text, quietCafeSignals) && !containsAny(text, aggressiveOrWrongChannelSignals);
  if (quietEnough && ['pop', 'jazz', 'city-pop', 'lofi', 'ballad', 'seasonal'].includes(input.categoryId || '')) {
    archetypes.add('senior-morning');
  }
  if (quietEnough && ['jazz', 'city-pop', 'lofi', 'seasonal'].includes(input.categoryId || '')) {
    archetypes.add('showa-cafe');
  }
  if (text.includes('christmas') || text.includes('holiday') || text.includes('winter')) {
    archetypes.add('christmas');
  }
  if ((input.categoryId === 'lofi' || text.includes('study') || text.includes('focus')) && !containsAny(text, ['rap', 'trap'])) {
    archetypes.add('lofi-study');
  }
  if (input.categoryId === 'pop' && containsAny(text, ['family', 'folk', 'bright', 'upbeat'])) {
    archetypes.add('kids');
  }

  return Array.from(archetypes);
}

export function genreTierForId(id: string): GenreTier {
  return allCoreGenreIds.has(id) ? 'core' : 'extended';
}

export function withGenreVisibility<T extends GenrePack>(genre: T): T & { archetypes: ChannelArchetype[]; tier: GenreTier } {
  return {
    ...genre,
    archetypes: genre.archetypes?.length
      ? genre.archetypes
      : inferArchetypes({
        id: genre.id,
        label: genre.label,
        categoryId: genre.categoryId,
        aliases: genre.aliases,
        goodFor: genre.goodFor,
        moods: genre.moods,
        audiences: genre.audiences
      }),
    tier: genre.tier || genreTierForId(genre.id)
  };
}

const categoryBases: Record<string, CategoryBase> = {
  jazz: {
    id: 'jazz',
    label: 'Jazz',
    rhythm: ['relaxed swing pocket', 'brushed kit motion'],
    instruments: ['upright bass', 'brushed drums', 'piano'],
    vocal: ['mature natural vocal or instrumental lead'],
    production: ['warm live-room mix', 'close club ambience'],
    harmony: ['extended jazz chords', 'maj7 and 9th color'],
    tempo: [82, 128],
    moods: ['elegant', 'late-night', 'refined'],
    audiences: ['adult cafe listeners', 'jazz lounge playlists'],
    avoidTraits: ['harsh brass peaks', 'showy solo clutter']
  },
  'city-pop': {
    id: 'city-pop',
    label: 'City Pop',
    rhythm: ['smooth four-on-the-floor-adjacent groove', 'syncopated bass movement'],
    instruments: ['clean electric guitar', 'electric piano', 'analog synth pad', 'round bass'],
    vocal: ['silky adult pop vocal'],
    production: ['polished retro-modern sheen', 'clean stereo mix'],
    harmony: ['jazz-colored pop chords', 'bright chorus lift'],
    tempo: [96, 118],
    moods: ['urban', 'nostalgic', 'night-drive'],
    audiences: ['city pop listeners', 'drive and cafe playlists'],
    avoidTraits: ['thin synthetic drums', 'cartoon retro tone']
  },
  rnb: {
    id: 'rnb',
    label: 'R&B and Soul',
    rhythm: ['laid-back pocket groove', 'soft backbeat'],
    instruments: ['electric piano', 'deep bass', 'minimal drums', 'synth pad'],
    vocal: ['smooth close-mic R&B vocal'],
    production: ['polished low-end focus', 'intimate studio space'],
    harmony: ['lush seventh chords', 'stacked background harmony'],
    tempo: [70, 100],
    moods: ['intimate', 'late-night', 'soulful'],
    audiences: ['R&B playlists', 'night listening'],
    avoidTraits: ['explicit sensuality', 'aggressive trap density']
  },
  lofi: {
    id: 'lofi',
    label: 'Lo-fi and Study',
    rhythm: ['slow head-nod beat', 'soft muted drums'],
    instruments: ['dusty piano', 'warm bass', 'mellow guitar', 'Rhodes'],
    vocal: ['optional soft close vocal'],
    production: ['tape-soft texture', 'subtle vinyl grain'],
    harmony: ['simple jazzy loop harmony', 'soft minor-to-major color'],
    tempo: [72, 94],
    moods: ['cozy', 'rainy', 'focused'],
    audiences: ['study playlists', 'coffee shop background'],
    avoidTraits: ['muddy mix', 'loud crackle', 'busy vocals']
  },
  ballad: {
    id: 'ballad',
    label: 'Ballad',
    rhythm: ['slow steady pulse', 'restrained build'],
    instruments: ['piano', 'soft strings', 'warm bass'],
    vocal: ['emotional close-mic vocal'],
    production: ['clear vocal-front mix', 'gentle cinematic space'],
    harmony: ['emotional money-chord lift', 'subtle suspended chords'],
    tempo: [68, 92],
    moods: ['tender', 'reflective', 'hopeful'],
    audiences: ['ballad listeners', 'comfort playlists'],
    avoidTraits: ['shouting climax', 'melodramatic excess']
  }
};

const tagTraits: Record<string, Partial<Omit<StructuredGenrePack, 'id' | 'label' | 'styleCore' | 'goodFor' | 'categoryId' | 'source' | 'shortPrompt' | 'productionGuidance' | 'aliases'>>> = {
  acoustic: { instruments: ['fingerpicked acoustic guitar'], production: ['natural room detail'], moods: ['organic'] },
  ambient: { production: ['wide ambient tail'], rhythm: ['very sparse pulse'], moods: ['meditative'] },
  analog: { production: ['analog warmth'], instruments: ['vintage synth'], moods: ['retro'] },
  ballad: { rhythm: ['slow ballad pacing'], harmony: ['wide chorus cadence'], moods: ['emotional'] },
  bass: { instruments: ['featured bassline'], production: ['bass-forward balance'], rhythm: ['low-end-led groove'] },
  bossa: { rhythm: ['soft bossa syncopation'], instruments: ['nylon guitar', 'light shaker'], moods: ['breezy'] },
  brass: { instruments: ['muted brass section'], production: ['rounded brass accents'], moods: ['vintage'] },
  bright: { production: ['bright top-end polish'], moods: ['optimistic'] },
  chamber: { instruments: ['light chamber strings'], production: ['small ensemble space'], harmony: ['chamber-pop voicings'] },
  cinematic: { production: ['cinematic room bloom'], instruments: ['soft orchestral swell'], moods: ['sweeping'] },
  crooner: { vocal: ['smooth mature male croon'], moods: ['old-radio romance'] },
  dark: { production: ['shadowed low-mid texture'], harmony: ['minor-key tension'], moods: ['nocturnal'] },
  disco: { rhythm: ['gentle disco pulse'], instruments: ['tight rhythm guitar'], moods: ['danceable'] },
  duet: { vocal: ['male and female duet', 'balanced call-and-response phrasing'], harmony: ['two-part chorus harmony'] },
  dreamy: { production: ['soft reverb haze'], instruments: ['washed synth pad'], moods: ['dreamy'] },
  drums: { rhythm: ['active drum pocket'], production: ['crisp kit detail'] },
  electric: { instruments: ['electric bass', 'electric piano'], production: ['sleek studio tone'] },
  experimental: { rhythm: ['loose exploratory pulse'], harmony: ['open nonstandard voicings'], avoidTraits: ['random noise bursts'] },
  female: { vocal: ['airy female vocal', 'delicate close phrasing'] },
  focus: { moods: ['calm focus'], production: ['low-distraction arrangement'], avoidTraits: ['attention-grabbing fills'] },
  folk: { instruments: ['acoustic guitar'], production: ['hand-played intimacy'], moods: ['plainspoken'] },
  funk: { rhythm: ['syncopated funk pocket'], instruments: ['muted rhythm guitar', 'organ stabs'], moods: ['groovy'] },
  fusion: { rhythm: ['tight fusion groove'], instruments: ['electric bass', 'Rhodes'], harmony: ['advanced jazz-pop harmony'] },
  gospel: { vocal: ['soulful gospel-colored vocal'], instruments: ['organ touches'], harmony: ['uplifting stacked harmony'] },
  guitar: { instruments: ['mellow electric guitar'], production: ['guitar-led warmth'] },
  hiphop: { rhythm: ['laid-back hip-hop beat'], production: ['soft sample-like texture'] },
  instrumental: { vocal: ['no lead vocal'], production: ['instrumental focus'], avoidTraits: ['vocal ad-libs'] },
  intimate: { production: ['close-mic intimacy'], moods: ['personal'] },
  latin: { rhythm: ['light Latin syncopation'], instruments: ['hand percussion'], moods: ['vibrant'] },
  lounge: { production: ['velvet lounge ambience'], moods: ['classy'] },
  male: { vocal: ['warm male vocal', 'low-register emotional delivery'] },
  mellow: { rhythm: ['mellow mid-tempo flow'], production: ['soft transient control'], moods: ['relaxed'] },
  modern: { production: ['current clean mix'], moods: ['modern'] },
  noir: { instruments: ['muted trumpet'], production: ['rainy cinematic ambience'], moods: ['noir'] },
  organ: { instruments: ['warm organ'], harmony: ['soul-jazz chord color'] },
  piano: { instruments: ['piano-led arrangement'], harmony: ['piano chord suspensions'] },
  polished: { production: ['radio-ready polish'], avoidTraits: ['rough demo tone'] },
  rain: { production: ['soft rainy-window ambience'], moods: ['rainy', 'reflective'] },
  rap: { vocal: ['low conversational vocal'], rhythm: ['spoken pocket over groove'], avoidTraits: ['aggressive rap delivery'] },
  retro: { production: ['restrained vintage color'], moods: ['nostalgic'] },
  rhodes: { instruments: ['Rhodes piano'], harmony: ['warm electric-piano voicings'] },
  sax: { instruments: ['mellow saxophone lead'], production: ['rounded reed tone'] },
  seaside: { production: ['open-air coastal brightness'], moods: ['summer breeze'] },
  slow: { rhythm: ['slow tempo restraint'], moods: ['quiet'] },
  soul: { vocal: ['soulful phrasing'], rhythm: ['warm soul groove'], harmony: ['gospel-adjacent passing chords'] },
  spacious: { production: ['wide spacious mix'], harmony: ['open voicings'] },
  strings: { instruments: ['soft strings'], production: ['controlled string swell'] },
  summer: { moods: ['summer nostalgia'], production: ['sunlit mix color'] },
  swing: { rhythm: ['walking swing feel'], instruments: ['ride cymbal detail'] },
  synth: { instruments: ['analog synth pad'], production: ['glossy synth layer'] },
  tape: { production: ['tape flutter softness'], moods: ['faded memory'] },
  trap: { rhythm: ['minimal trap-soul pulse'], instruments: ['sub bass'], production: ['clean 808 low-end'], avoidTraits: ['hard trap aggression'] },
  trio: { instruments: ['piano trio setup'], production: ['small ensemble realism'] },
  trumpet: { instruments: ['muted trumpet'], production: ['breathy brass lead'] },
  upbeat: { rhythm: ['upbeat pop pulse'], moods: ['cheerful'] },
  vocal: { vocal: ['front-and-center vocal'], production: ['clear lyric intelligibility'] },
  waltz: { rhythm: ['graceful 3/4 motion'], moods: ['graceful'] }
};

function seed(slug: string, label: string, tagText: string, tempo?: [number, number]): GenreVariantSeed {
  return { slug, label, tags: tagText.split(/\s+/).filter(Boolean), tempo };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function mergeTraitArrays(base: string[], tags: string[], key: keyof Pick<StructuredGenrePack, 'rhythm' | 'instruments' | 'vocal' | 'production' | 'harmony' | 'moods' | 'audiences' | 'avoidTraits'>) {
  return unique([
    ...base,
    ...tags.flatMap(tag => (tagTraits[tag]?.[key] as string[] | undefined) || [])
  ]).slice(0, 6);
}

function makeShortPrompt(profile: Pick<StructuredGenrePack, 'label' | 'rhythm' | 'instruments' | 'vocal' | 'production' | 'harmony' | 'tempo' | 'moods'>) {
  return [
    profile.label,
    profile.rhythm[0],
    profile.vocal[0],
    profile.instruments.slice(0, 2).join(' + '),
    profile.production[0],
    `${profile.tempo[0]}-${profile.tempo[1]} BPM`
  ].filter(Boolean).join(', ');
}

function makeProductionGuidance(profile: Pick<StructuredGenrePack, 'label' | 'rhythm' | 'instruments' | 'vocal' | 'production' | 'harmony' | 'avoidTraits'>) {
  return `${profile.label}: build around ${profile.rhythm.slice(0, 2).join(' and ')}, keep ${profile.vocal[0]}, feature ${profile.instruments.slice(0, 4).join(', ')}, use ${profile.harmony[0]}, mix with ${profile.production.slice(0, 2).join(' and ')}, avoid ${profile.avoidTraits.slice(0, 3).join(', ')}.`;
}

function makeProfile(categoryId: keyof typeof categoryBases, variant: GenreVariantSeed): StructuredGenrePack {
  const base = categoryBases[categoryId];
  const rhythm = mergeTraitArrays(base.rhythm, variant.tags, 'rhythm');
  const instruments = mergeTraitArrays(base.instruments, variant.tags, 'instruments');
  const vocal = mergeTraitArrays(base.vocal, variant.tags, 'vocal');
  const production = mergeTraitArrays(base.production, variant.tags, 'production');
  const harmony = mergeTraitArrays(base.harmony, variant.tags, 'harmony');
  const moods = mergeTraitArrays(base.moods, variant.tags, 'moods');
  const audiences = mergeTraitArrays(base.audiences, variant.tags, 'audiences');
  const avoidTraits = unique([...sharedAvoid, ...mergeTraitArrays(base.avoidTraits, variant.tags, 'avoidTraits')]).slice(0, 8);
  const tempo = variant.tempo || base.tempo;
  const id = `${categoryId}-${variant.slug}`;
  const shape = { label: variant.label, rhythm, instruments, vocal, production, harmony, tempo, moods, avoidTraits };
  const visibility = withGenreVisibility({
    id,
    label: variant.label,
    styleCore: '',
    instruments,
    tempoRange: tempo,
    goodFor: audiences,
    categoryId,
    aliases: variant.tags,
    moods,
    audiences
  });

  return {
    id,
    label: variant.label,
    categoryId,
    archetypes: visibility.archetypes,
    tier: visibility.tier,
    source: 'notion-analysis',
    aliases: variant.tags,
    rhythm,
    instruments,
    vocal,
    production,
    harmony,
    tempo,
    tempoRange: tempo,
    moods,
    audiences,
    avoidTraits,
    goodFor: audiences,
    shortPrompt: makeShortPrompt(shape),
    styleCore: `${variant.label}, ${rhythm.slice(0, 2).join(', ')}, ${harmony[0]}, ${production[0]}`,
    productionGuidance: makeProductionGuidance(shape)
  };
}

function legacyGenrePack(
  pack: GenrePack,
  categoryId: string,
  structured: Pick<StructuredGenrePack, 'rhythm' | 'vocal' | 'production' | 'harmony' | 'moods' | 'audiences' | 'avoidTraits'>
): StructuredGenrePack {
  const tempo = pack.tempoRange;
  const profile = {
    label: pack.label,
    rhythm: structured.rhythm,
    instruments: pack.instruments,
    vocal: structured.vocal,
    production: structured.production,
    harmony: structured.harmony,
    tempo,
    moods: structured.moods,
    avoidTraits: unique([...sharedAvoid, ...structured.avoidTraits])
  };

  const visibility = withGenreVisibility({
    ...pack,
    categoryId,
    moods: structured.moods,
    audiences: structured.audiences
  });

  return {
    ...pack,
    categoryId,
    archetypes: visibility.archetypes,
    tier: visibility.tier,
    source: 'legacy-preset',
    rhythm: structured.rhythm,
    vocal: structured.vocal,
    production: structured.production,
    harmony: structured.harmony,
    tempo,
    moods: structured.moods,
    audiences: structured.audiences,
    avoidTraits: profile.avoidTraits,
    shortPrompt: makeShortPrompt(profile),
    productionGuidance: makeProductionGuidance(profile)
  };
}

const legacyGenreProfiles: StructuredGenrePack[] = [
  legacyGenrePack({ id: 'adult-contemporary', label: 'Adult Contemporary Pop', styleCore: 'warm adult contemporary pop, radio-friendly, gentle emotional chorus lift', instruments: ['Rhodes piano', 'acoustic guitar', 'light brushed drums', 'smooth bass'], tempoRange: [96, 106], goodFor: ['senior playlist', 'morning coffee', 'year-end'] }, 'pop', { rhythm: ['steady adult pop groove'], vocal: ['mature clear vocal'], production: ['radio-friendly polish'], harmony: ['emotional chorus lift'], moods: ['warm', 'familiar'], audiences: ['senior playlist', 'morning coffee'], avoidTraits: ['power ballad shouting'] }),
  legacyGenrePack({ id: 'acoustic-pop', label: 'Acoustic Pop', styleCore: 'nostalgic acoustic pop, clear vocal, intimate warm arrangement', instruments: ['fingerpicked acoustic guitar', 'soft piano', 'light percussion'], tempoRange: [92, 104], goodFor: ['home listening', 'walks', 'coffee'] }, 'pop', { rhythm: ['light acoustic pulse'], vocal: ['clear intimate vocal'], production: ['natural acoustic room'], harmony: ['simple pop lift'], moods: ['nostalgic', 'gentle'], audiences: ['home listening', 'walking playlists'], avoidTraits: ['campfire cliche'] }),
  legacyGenrePack({ id: 'jazz-pop', label: 'Acoustic Jazz Pop', styleCore: 'nostalgic acoustic jazz-pop, elegant cafe mood, gentle maj7 and add9 colors', instruments: ['Rhodes', 'upright bass', 'brushed drums', 'mellow jazz guitar'], tempoRange: [90, 104], goodFor: ['kissaten', 'night cafe', 'winter'] }, 'jazz', { rhythm: ['soft jazz-pop swing'], vocal: ['warm cafe vocal'], production: ['elegant small-room mix'], harmony: ['maj7 and add9 color'], moods: ['elegant', 'nostalgic'], audiences: ['cafe playlists', 'winter listening'], avoidTraits: ['busy bebop lines'] }),
  legacyGenrePack({ id: 'showa-modern', label: 'Showa Modern Cafe', styleCore: 'showa-modern cafe mood, nostalgic but refined, subtle retro Japanese kissaten warmth', instruments: ['Rhodes', 'mellow jazz guitar', 'upright bass', 'soft strings'], tempoRange: [92, 104], goodFor: ['Japan channel', 'retro cafe', 'autumn'] }, 'jazz', { rhythm: ['restrained cafe swing'], vocal: ['mature soft tenor'], production: ['subtle retro warmth'], harmony: ['jazz-colored cafe chords'], moods: ['refined', 'bittersweet'], audiences: ['Japan channel', 'retro cafe'], avoidTraits: ['cheap retro props'] }),
  legacyGenrePack({ id: 'city-pop-soft', label: 'Soft City Pop', styleCore: 'soft city-pop inspired adult pop, smooth groove, clean late-night city mood', instruments: ['electric piano', 'clean guitar', 'soft synth pad', 'smooth bass'], tempoRange: [98, 114], goodFor: ['Japan', 'night city', 'stylish senior'] }, 'city-pop', { rhythm: ['smooth city-pop groove'], vocal: ['silky adult pop vocal'], production: ['clean late-night polish'], harmony: ['jazzy pop chords'], moods: ['urban', 'nostalgic'], audiences: ['night city playlists', 'Japan channel'], avoidTraits: ['overbright synth brass'] }),
  legacyGenrePack({ id: 'lofi-cafe', label: 'Lo-fi Cafe Pop', styleCore: 'warm lo-fi cafe pop, relaxed groove, soft vinyl texture', instruments: ['lo-fi drums', 'electric piano', 'warm bass', 'soft guitar'], tempoRange: [82, 96], goodFor: ['study', 'coffee', 'background'] }, 'lofi', { rhythm: ['relaxed lo-fi groove'], vocal: ['optional soft vocal'], production: ['soft vinyl texture'], harmony: ['simple jazzy loop'], moods: ['cozy', 'focused'], audiences: ['study', 'coffee'], avoidTraits: ['loud crackle'] }),
  legacyGenrePack({ id: 'christmas-soft-pop', label: 'Soft Christmas Pop', styleCore: 'nostalgic Christmas acoustic pop, warm and not childish, subtle bells only in chorus', instruments: ['Rhodes', 'acoustic guitar', 'light sleigh bells', 'soft bass'], tempoRange: [96, 106], goodFor: ['Christmas', 'winter morning', 'year-end'] }, 'seasonal', { rhythm: ['gentle seasonal pop pulse'], vocal: ['warm clear vocal'], production: ['subtle holiday sparkle'], harmony: ['hopeful chorus lift'], moods: ['year-end warmth', 'nostalgic'], audiences: ['Christmas playlists', 'winter morning'], avoidTraits: ['childish novelty bells'] }),
  legacyGenrePack({ id: 'healing-ballad', label: 'Healing Ballad', styleCore: 'warm healing ballad, restrained emotion, hopeful ending', instruments: ['piano', 'acoustic guitar', 'soft strings', 'brushes'], tempoRange: [84, 98], goodFor: ['comfort', 'senior', 'night'] }, 'ballad', { rhythm: ['slow restrained pulse'], vocal: ['gentle emotional vocal'], production: ['soft comfort mix'], harmony: ['hopeful resolution'], moods: ['healing', 'reflective'], audiences: ['comfort', 'senior'], avoidTraits: ['dramatic belting'] }),
  legacyGenrePack({ id: 'folk-pop', label: 'Folk Pop', styleCore: 'clean folk-pop storytelling, acoustic warmth, natural sing-along chorus', instruments: ['strummed acoustic guitar', 'light mandolin texture', 'soft piano', 'upright bass'], tempoRange: [92, 108], goodFor: ['family', 'walking', 'spring'] }, 'pop', { rhythm: ['strummed folk-pop pulse'], vocal: ['plainspoken storyteller vocal'], production: ['natural acoustic warmth'], harmony: ['sing-along chorus lift'], moods: ['fresh', 'friendly'], audiences: ['family', 'walking'], avoidTraits: ['rustic parody'] }),
  legacyGenrePack({ id: 'bossa-cafe', label: 'Bossa Cafe Pop', styleCore: 'soft bossa cafe pop, relaxed syncopation, elegant warm vocal', instruments: ['nylon guitar', 'Rhodes', 'brush kit', 'upright bass', 'light shaker'], tempoRange: [88, 102], goodFor: ['summer cafe', 'morning', 'Japan and Korea'] }, 'jazz', { rhythm: ['soft bossa syncopation'], vocal: ['elegant warm vocal'], production: ['sunlit cafe mix'], harmony: ['bossa jazz chord color'], moods: ['breezy', 'romantic'], audiences: ['summer cafe', 'morning'], avoidTraits: ['tourist-lounge cliche'] }),
  legacyGenrePack({ id: 'soft-rock', label: 'Soft Rock Radio', styleCore: 'polished soft rock radio arrangement, warm guitars, restrained chorus lift', instruments: ['clean electric guitar', 'acoustic guitar', 'piano', 'steady soft drums'], tempoRange: [96, 112], goodFor: ['drive', 'memory', 'all ages'] }, 'pop', { rhythm: ['steady soft rock pulse'], vocal: ['clear adult vocal'], production: ['polished radio arrangement'], harmony: ['restrained chorus lift'], moods: ['road memory', 'hopeful'], audiences: ['drive', 'all ages'], avoidTraits: ['arena rock excess'] }),
  legacyGenrePack({ id: 'piano-ballad', label: 'Piano Pop Ballad', styleCore: 'piano-led pop ballad, intimate verse, gentle cinematic chorus', instruments: ['felt piano', 'soft strings', 'subtle cymbal swells', 'warm bass'], tempoRange: [78, 92], goodFor: ['night', 'comfort', 'winter'] }, 'ballad', { rhythm: ['slow piano-led pulse'], vocal: ['intimate verse vocal'], production: ['gentle cinematic chorus space'], harmony: ['piano suspended chords'], moods: ['night', 'comfort'], audiences: ['winter', 'night'], avoidTraits: ['oversized climax'] }),
  legacyGenrePack({ id: 'retro-soul-pop', label: 'Retro Soul Pop', styleCore: 'soft retro soul pop, warm groove, hand-played feel, tasteful backing vocals', instruments: ['Wurlitzer', 'muted guitar', 'smooth bass', 'light soul drums'], tempoRange: [88, 104], goodFor: ['radio', 'coffee', 'hopeful mood'] }, 'rnb', { rhythm: ['warm soul-pop groove'], vocal: ['soulful lead with tasteful backing vocals'], production: ['hand-played retro warmth'], harmony: ['soul seventh chords'], moods: ['hopeful', 'warm'], audiences: ['radio', 'coffee'], avoidTraits: ['overdone retro filter'] }),
  legacyGenrePack({ id: 'synthwave-mellow', label: 'Mellow Synthwave Pop', styleCore: 'mellow synthwave pop, nostalgic neon pads, clean modern mix, not aggressive', instruments: ['soft analog synth pad', 'electric piano', 'clean guitar', 'warm electronic drums'], tempoRange: [92, 108], goodFor: ['night drive', 'retro channel', 'twenties'] }, 'electronic', { rhythm: ['mellow electronic pulse'], vocal: ['clean pop vocal'], production: ['nostalgic neon pads', 'modern mix control'], harmony: ['minor-to-major synth-pop lift'], moods: ['night drive', 'retro'], audiences: ['twenties', 'retro channel'], avoidTraits: ['aggressive synthwave edge'] })
];

const jazzVariants = [
  seed('bass-feature-trio', 'Bass Feature Jazz Trio', 'bass trio swing intimate'),
  seed('classic-vocal-lounge', 'Classic Vocal Jazz Lounge', 'male crooner swing retro lounge'),
  seed('soft-vocal-trio', 'Soft Vocal Jazz Trio', 'female vocal trio swing lounge intimate'),
  seed('bebop-sax-drive', 'Bebop Sax Drive', 'sax upbeat drums swing'),
  seed('cool-muted-trumpet', 'Cool Muted Trumpet Jazz', 'trumpet mellow spacious'),
  seed('modal-night-sketch', 'Modal Night Jazz', 'trumpet spacious slow dark'),
  seed('jazz-ballad-vocal', 'Jazz Ballad Vocal', 'male ballad piano intimate slow'),
  seed('smooth-sax-vocal', 'Smooth Sax Vocal Jazz', 'female sax polished mellow'),
  seed('big-band-swing', 'Big Band Swing', 'brass swing upbeat retro'),
  seed('bossa-vocal-jazz', 'Bossa Vocal Jazz', 'bossa female guitar latin'),
  seed('electric-fusion', 'Electric Jazz Fusion', 'fusion electric rhodes drums'),
  seed('late-night-lounge', 'Late Night Jazz Lounge', 'female lounge guitar intimate'),
  seed('rain-noir-jazz', 'Rain Noir Jazz', 'noir trumpet rain dark'),
  seed('organ-soul-jazz', 'Organ Soul Jazz', 'organ soul funk male'),
  seed('hard-bop-club', 'Hard Bop Club Jazz', 'sax drums upbeat swing'),
  seed('minimal-trio', 'Minimal Jazz Trio', 'trio bass piano intimate'),
  seed('torch-vocal-jazz', 'Torch Vocal Jazz', 'female vocal slow lounge'),
  seed('spiritual-open-jazz', 'Spiritual Open Jazz', 'sax spacious latin mellow'),
  seed('spacious-chamber-jazz', 'Spacious Chamber Jazz', 'trumpet spacious piano'),
  seed('gypsy-cafe-swing', 'Gypsy Cafe Swing', 'guitar swing male retro'),
  seed('jazz-waltz-vocal', 'Jazz Waltz Vocal', 'female waltz piano'),
  seed('latin-club-jazz', 'Latin Club Jazz', 'latin trumpet upbeat'),
  seed('samba-jazz-vocal', 'Samba Jazz Vocal', 'latin bossa female guitar'),
  seed('post-bop-urban', 'Post-Bop Urban Jazz', 'sax drums spacious'),
  seed('bass-piano-duo', 'Bass and Piano Duo Jazz', 'bass piano instrumental intimate'),
  seed('baritone-vocal-jazz', 'Baritone Vocal Jazz', 'male crooner piano swing'),
  seed('alto-candlelight-jazz', 'Alto Candlelight Jazz', 'female slow lounge intimate'),
  seed('new-orleans-brass', 'New Orleans Brass Jazz', 'brass upbeat swing'),
  seed('cool-baritone-jazz', 'Cool Baritone Jazz', 'male trumpet mellow'),
  seed('alto-sax-trio', 'Alto Sax Trio Jazz', 'sax trio swing intimate'),
  seed('vibraphone-dream-jazz', 'Vibraphone Dream Jazz', 'female dreamy trio'),
  seed('guitar-trio-dinner', 'Guitar Trio Dinner Jazz', 'guitar trio mellow lounge'),
  seed('flugelhorn-ballad', 'Flugelhorn Ballad Jazz', 'trumpet ballad slow cinematic'),
  seed('duet-conversation-jazz', 'Duet Conversation Jazz', 'duet swing lounge'),
  seed('contemporary-vocal-jazz', 'Contemporary Vocal Jazz', 'female modern spacious polished'),
  seed('double-bass-intro-jazz', 'Double Bass Intro Jazz', 'bass trio swing intimate'),
  seed('brush-ballad-jazz', 'Brush Ballad Jazz', 'female piano slow intimate'),
  seed('free-organic-jazz', 'Free Organic Jazz', 'experimental sax drums spacious'),
  seed('fusion-night-drive', 'Fusion Night Drive Jazz', 'fusion electric rhodes synth'),
  seed('acid-jazz-groove', 'Acid Jazz Groove', 'funk organ drums male'),
  seed('nu-jazz-metropolitan', 'Nu Jazz Metropolitan', 'female hiphop bass modern'),
  seed('lofi-vocal-jazz', 'Lo-fi Vocal Jazz', 'lofi female piano tape'),
  seed('jazz-rap-late-night', 'Jazz Rap Late Night', 'rap hiphop piano bass'),
  seed('swing-crooner-ballroom', 'Swing Crooner Ballroom', 'male crooner brass swing'),
  seed('bebop-vocal-scat', 'Bebop Vocal Scat', 'female vocal upbeat swing'),
  seed('hotel-lounge-jazz', 'Hotel Lounge Jazz', 'male lounge electric polished'),
  seed('mellow-flugelhorn-vocal', 'Mellow Flugelhorn Vocal Jazz', 'male trumpet mellow romantic'),
  seed('jazz-blues-club', 'Jazz Blues Club', 'male soul piano swing'),
  seed('cabaret-jazz', 'Cabaret Jazz', 'female lounge piano theatrical'),
  seed('chamber-vocal-jazz', 'Chamber Vocal Jazz', 'female chamber strings intimate')
];

const cityPopVariants = [
  seed('bright-female-groove', 'Bright Female City Pop', 'female bright bass guitar synth'),
  seed('sunset-male-groove', 'Sunset Male City Pop', 'male mellow bass guitar synth'),
  seed('urban-duet', 'Urban Duet City Pop', 'duet guitar synth romantic'),
  seed('summer-bass-slap', 'Summer Bass City Pop', 'female summer bass bright'),
  seed('mellow-night-drive', 'Mellow Night Drive City Pop', 'male mellow synth night'),
  seed('coastal-disco-pop', 'Coastal Disco City Pop', 'female disco upbeat seaside'),
  seed('metropolitan-smooth', 'Metropolitan Smooth City Pop', 'male polished electric'),
  seed('dreamy-pastel-night', 'Dreamy Pastel City Pop', 'female dreamy guitar synth'),
  seed('yacht-marina-pop', 'Marina Yacht City Pop', 'male mellow seaside polished'),
  seed('bittersweet-summer-pop', 'Bittersweet Summer City Pop', 'female summer synth romantic'),
  seed('funky-rhythm-pop', 'Funky Rhythm City Pop', 'male funk guitar brass'),
  seed('night-skyline-ballad', 'Night Skyline City Pop Ballad', 'female ballad strings electric'),
  seed('analog-camera-pop', 'Analog Camera City Pop', 'male analog synth retro'),
  seed('open-window-summer', 'Open Window Summer City Pop', 'female summer guitar bright'),
  seed('moonlit-avenue-pop', 'Moonlit Avenue City Pop', 'female night synth mellow'),
  seed('clean-arpeggio-groove', 'Clean Arpeggio City Pop', 'male guitar electric polished'),
  seed('romantic-duet-glow', 'Romantic Duet City Pop', 'duet romantic synth guitar'),
  seed('luxury-lounge-pop', 'Luxury Lounge City Pop', 'female lounge electric polished'),
  seed('uptempo-80s-bounce', 'Uptempo City Pop Bounce', 'male upbeat funk synth'),
  seed('airy-disco-pulse', 'Airy Disco City Pop', 'female disco synth bright'),
  seed('sax-night-city', 'Sax Night City Pop', 'female sax electric polished'),
  seed('coastal-twilight-pop', 'Coastal Twilight City Pop', 'male seaside mellow synth'),
  seed('glossy-skyline-pop', 'Glossy Skyline City Pop', 'female synth disco polished'),
  seed('urban-romance-pop', 'Urban Romance City Pop', 'male romantic dreamy'),
  seed('analog-tokyo-night', 'Analog Night City Pop', 'female analog synth night'),
  seed('shopping-district-groove', 'Shopping District City Pop', 'male funk guitar electric'),
  seed('rainy-window-pop', 'Rainy Window City Pop', 'female rain mellow'),
  seed('sea-breeze-duet', 'Sea Breeze Duet City Pop', 'duet seaside guitar synth'),
  seed('stylish-low-register', 'Stylish Low Register City Pop', 'male mellow polished bass'),
  seed('sentimental-summer-ballad', 'Sentimental Summer City Pop Ballad', 'female ballad summer strings'),
  seed('sunset-optimist-pop', 'Sunset Optimist City Pop', 'female guitar synth bright'),
  seed('jazzy-luxury-pop', 'Jazzy Luxury City Pop', 'male polished electric'),
  seed('soft-pastel-pop', 'Soft Pastel City Pop', 'female dreamy mellow'),
  seed('open-road-drive', 'Open Road City Pop Drive', 'male upbeat bright synth'),
  seed('duet-ballad', 'Duet City Pop Ballad', 'duet ballad romantic strings'),
  seed('club-disco-pop', 'Club Disco City Pop', 'female disco funk bright'),
  seed('mature-bass-pop', 'Mature Bass City Pop', 'male bass mellow electric'),
  seed('strings-city-pop', 'Strings City Pop', 'female strings cinematic'),
  seed('playful-guitar-pop', 'Playful Guitar City Pop', 'male upbeat guitar bright'),
  seed('midnight-sax-pop', 'Midnight Sax City Pop', 'female sax night polished'),
  seed('seaside-postcard-pop', 'Seaside Postcard City Pop', 'duet seaside guitar'),
  seed('neon-metropolitan-pop', 'Neon Metropolitan City Pop', 'male synth night bass'),
  seed('heartbreak-rain-pop', 'Heartbreak Rain City Pop', 'female rain romantic'),
  seed('retro-dance-romance', 'Retro Dance Romance City Pop', 'male disco synth retro'),
  seed('luxury-coastal-pop', 'Luxury Coastal City Pop', 'female seaside polished'),
  seed('weekend-drive-pop', 'Weekend Drive City Pop', 'male guitar bass mellow'),
  seed('rooftop-lounge-pop', 'Rooftop Lounge City Pop', 'female lounge rhodes'),
  seed('cinematic-duet-skyline', 'Cinematic Duet City Pop', 'duet cinematic synth'),
  seed('modern-retro-pop', 'Modern Retro City Pop', 'female modern synth guitar'),
  seed('classic-sunlit-pop', 'Classic Sunlit City Pop', 'male retro guitar synth')
];

const rnbVariants = [
  seed('modern-soft-male', 'Modern Soft Male R&B', 'male modern mellow bass'),
  seed('contemporary-airy-female', 'Contemporary Airy R&B', 'female polished intimate'),
  seed('neo-soul-pocket', 'Neo-Soul Pocket', 'female soul rhodes bass'),
  seed('nineties-slow-jam', '90s Slow Jam R&B', 'male slow romantic polished'),
  seed('quiet-storm-baritone', 'Quiet Storm Baritone R&B', 'male slow lounge intimate'),
  seed('alternative-night', 'Alternative Night R&B', 'male dark synth'),
  seed('trap-soul-confession', 'Trap Soul Confession', 'female trap intimate'),
  seed('midnight-slow-jam', 'Midnight Slow Jam', 'male slow electric romantic'),
  seed('soulful-gospel-warmth', 'Soulful Gospel R&B', 'female gospel soul'),
  seed('modern-duet', 'Modern Duet R&B', 'duet synth intimate'),
  seed('silky-studio-rnb', 'Silky Studio R&B', 'female polished mellow'),
  seed('bedroom-rnb', 'Bedroom R&B', 'male intimate dark'),
  seed('neo-soul-groove', 'Neo-Soul Groove', 'female soul rhodes drums'),
  seed('two-thousands-rnb', '2000s R&B Pop', 'male polished bright'),
  seed('intimate-rnb-ballad', 'Intimate R&B Ballad', 'female ballad piano intimate'),
  seed('moody-alt-rnb', 'Moody Alt R&B', 'male dark trap'),
  seed('clean-sensual-rnb', 'Clean Sensual R&B', 'female intimate mellow'),
  seed('baritone-slow-groove', 'Baritone Slow Groove R&B', 'male slow polished'),
  seed('dreamy-night-rnb', 'Dreamy Night R&B', 'female dreamy synth'),
  seed('gospel-soul-lift', 'Gospel Soul R&B Lift', 'male gospel soul organ'),
  seed('old-school-romance-rnb', 'Old School Romance R&B', 'female retro soul'),
  seed('alt-duet-tension', 'Alt Duet R&B Tension', 'duet dark synth'),
  seed('late-night-neo-soul', 'Late Night Neo-Soul', 'male rhodes soul lounge'),
  seed('polished-rnb-pop', 'Polished R&B Pop', 'female polished bright'),
  seed('low-key-rnb', 'Low-Key R&B', 'male mellow intimate'),
  seed('bass-forward-slow-jam', 'Bass Forward Slow Jam', 'female bass slow'),
  seed('confessional-male-rnb', 'Confessional Male R&B', 'male intimate slow'),
  seed('soul-infused-female', 'Soul Infused Female R&B', 'female soul polished'),
  seed('modern-quiet-storm', 'Modern Quiet Storm', 'male slow synth lounge'),
  seed('trap-rnb-night', 'Trap R&B Night', 'female trap dark'),
  seed('soft-duet-rnb', 'Soft Duet R&B', 'duet mellow intimate'),
  seed('atmospheric-rnb', 'Atmospheric R&B', 'male dreamy synth spacious'),
  seed('elegant-neo-soul', 'Elegant Neo-Soul', 'female soul rhodes polished'),
  seed('glossy-nineties-rnb', 'Glossy 90s R&B', 'male polished retro'),
  seed('whisper-alt-rnb', 'Whisper Alt R&B', 'female dark intimate'),
  seed('soulful-male-rnb', 'Soulful Male R&B', 'male soul electric'),
  seed('emotional-female-rnb', 'Emotional Female R&B', 'female intimate polished'),
  seed('minimalist-rnb', 'Minimalist R&B', 'male slow bass'),
  seed('city-night-rnb', 'City Night R&B', 'female night synth polished'),
  seed('neo-soul-duet', 'Neo-Soul Duet', 'duet soul rhodes'),
  seed('heartbreak-rnb', 'Heartbreak R&B', 'male slow dark'),
  seed('romantic-rnb', 'Romantic R&B', 'female romantic electric'),
  seed('moody-baritone-rnb', 'Moody Baritone R&B', 'male dark bass'),
  seed('female-neo-soul-harmony', 'Female Neo-Soul Harmony', 'female soul gospel'),
  seed('smooth-clean-rnb', 'Smooth Clean R&B', 'male polished mellow'),
  seed('airy-alt-rnb', 'Airy Alt R&B', 'female dark synth'),
  seed('gospel-colored-rnb', 'Gospel Colored R&B', 'male gospel organ'),
  seed('luxury-duet-slow-jam', 'Luxury Duet Slow Jam', 'duet slow polished'),
  seed('late-night-confession', 'Late Night Confession R&B', 'female intimate slow'),
  seed('velvet-baritone-rnb', 'Velvet Baritone R&B', 'male bass lounge')
];

const lofiVariants = [
  seed('dusty-study-hop', 'Dusty Study Lo-fi', 'hiphop piano focus tape'),
  seed('rainy-jazzhop', 'Rainy Jazzhop', 'rain bass piano swing'),
  seed('soft-vocal-bedroom', 'Soft Vocal Bedroom Lo-fi', 'female vocal intimate tape'),
  seed('male-chill-reflection', 'Male Chill Lo-fi', 'male guitar mellow'),
  seed('sleepy-instrumental', 'Sleepy Instrumental Lo-fi', 'instrumental rhodes slow focus'),
  seed('lofi-jazz-vocal', 'Lo-fi Jazz Vocal', 'female swing tape'),
  seed('nostalgic-male-lofi', 'Nostalgic Male Lo-fi', 'male tape piano mellow'),
  seed('city-night-lofi', 'City Night Lo-fi', 'female synth dreamy'),
  seed('warm-guitar-loop', 'Warm Guitar Loop Lo-fi', 'instrumental guitar tape'),
  seed('study-beats-piano', 'Piano Study Beats', 'instrumental piano focus'),
  seed('rain-vocal-lofi', 'Rain Vocal Lo-fi', 'female rain rhodes'),
  seed('lofi-soul', 'Lo-fi Soul', 'male soul electric tape'),
  seed('cassette-pop-lofi', 'Cassette Pop Lo-fi', 'female guitar tape'),
  seed('jazz-piano-lofi', 'Jazz Piano Lo-fi', 'instrumental piano swing'),
  seed('dreamy-pop-lofi', 'Dreamy Pop Lo-fi', 'female dreamy synth'),
  seed('mellow-rnb-lofi', 'Mellow R&B Lo-fi', 'male bass rhodes'),
  seed('lofi-folk', 'Lo-fi Folk', 'female folk acoustic'),
  seed('city-rain-baritone', 'City Rain Baritone Lo-fi', 'male rain piano'),
  seed('sleepy-duet-lofi', 'Sleepy Duet Lo-fi', 'duet mellow intimate'),
  seed('minimal-focus-lofi', 'Minimal Focus Lo-fi', 'instrumental focus piano'),
  seed('jazz-bass-lofi', 'Jazz Bass Lo-fi', 'bass piano swing'),
  seed('neon-night-lofi', 'Neon Night Lo-fi', 'female synth night'),
  seed('hazy-guitar-lofi', 'Hazy Guitar Lo-fi', 'male guitar tape'),
  seed('coffee-shop-lofi', 'Coffee Shop Lo-fi', 'instrumental guitar swing'),
  seed('heartbreak-lofi', 'Heartbreak Lo-fi', 'female piano slow'),
  seed('soul-ballad-lofi', 'Soul Ballad Lo-fi', 'male soul slow'),
  seed('vinyl-soft-lofi', 'Vinyl Soft Lo-fi', 'female tape dreamy'),
  seed('minimal-beats-lofi', 'Minimal Beats Lo-fi', 'instrumental rhodes focus'),
  seed('jazz-lounge-lofi', 'Jazz Lounge Lo-fi', 'female lounge swing'),
  seed('soft-pop-lofi', 'Soft Pop Lo-fi', 'male synth mellow'),
  seed('rainy-day-lofi', 'Rainy Day Lo-fi', 'female rain guitar'),
  seed('rooftop-night-lofi', 'Rooftop Night Lo-fi', 'male synth night'),
  seed('instrumental-jazz-lofi', 'Instrumental Jazz Lo-fi', 'instrumental trio swing'),
  seed('late-autumn-lofi', 'Late Autumn Lo-fi', 'female piano tape'),
  seed('mellow-duet-lofi', 'Mellow Duet Lo-fi', 'duet rhodes intimate'),
  seed('late-study-lofi', 'Late Study Lo-fi', 'instrumental focus piano'),
  seed('dream-pop-lofi', 'Dream Pop Lo-fi', 'female dreamy synth'),
  seed('close-confession-lofi', 'Close Confession Lo-fi', 'male intimate piano'),
  seed('soft-jazzy-lofi', 'Soft Jazzy Lo-fi', 'female swing bass'),
  seed('dusk-guitar-lofi', 'Dusk Guitar Lo-fi', 'instrumental guitar tape'),
  seed('moonlight-lofi', 'Moonlight Lo-fi', 'female rhodes slow'),
  seed('boom-bap-lofi', 'Boom Bap Lo-fi', 'male hiphop piano'),
  seed('cozy-soul-lofi', 'Cozy Soul Lo-fi', 'female soul intimate'),
  seed('bass-focus-lofi', 'Bass Focus Lo-fi', 'bass focus piano'),
  seed('faded-memory-lofi', 'Faded Memory Lo-fi', 'male guitar tape'),
  seed('ambient-lofi', 'Ambient Lo-fi', 'instrumental ambient piano'),
  seed('twilight-lofi', 'Twilight Lo-fi', 'female rhodes dreamy'),
  seed('rainy-cafe-lofi', 'Rainy Cafe Lo-fi', 'instrumental rain guitar swing'),
  seed('melancholy-lofi', 'Melancholy Lo-fi', 'male piano slow'),
  seed('bedroom-grain-lofi', 'Bedroom Grain Lo-fi', 'female intimate tape')
];

const balladVariants = [
  seed('emotional-baritone', 'Emotional Baritone Ballad', 'male piano strings slow'),
  seed('airy-korean-ballad', 'Airy Korean Ballad', 'female piano strings slow'),
  seed('romantic-low-register', 'Romantic Low Register Ballad', 'male romantic piano'),
  seed('breakup-husky', 'Hushed Breakup Ballad', 'female piano strings rain'),
  seed('cinematic-duet', 'Cinematic Duet Ballad', 'duet strings cinematic'),
  seed('sparse-piano-male', 'Sparse Piano Male Ballad', 'male piano intimate'),
  seed('sentimental-acoustic', 'Sentimental Acoustic Ballad', 'female acoustic piano'),
  seed('grand-slow-build', 'Grand Slow Build Ballad', 'male strings cinematic'),
  seed('late-night-confession', 'Late Night Confession Ballad', 'female piano intimate'),
  seed('soft-pop-ballad', 'Soft Pop Ballad', 'male guitar piano polished'),
  seed('polished-korean-ballad', 'Polished Korean Ballad', 'female piano strings polished'),
  seed('cinematic-baritone', 'Cinematic Baritone Ballad', 'male piano cinematic'),
  seed('fragile-tender-ballad', 'Fragile Tender Ballad', 'female piano slow'),
  seed('rain-heartbreak-ballad', 'Rain Heartbreak Ballad', 'male rain piano'),
  seed('duet-breakup-ballad', 'Duet Breakup Ballad', 'duet piano strings'),
  seed('acoustic-male-ballad', 'Acoustic Male Ballad', 'male acoustic piano'),
  seed('emotional-piano-female', 'Emotional Female Piano Ballad', 'female piano intimate'),
  seed('dramatic-cinematic-ballad', 'Dramatic Cinematic Ballad', 'male strings cinematic'),
  seed('dim-light-ballad', 'Dim Light Ballad', 'female piano slow'),
  seed('understated-male-ballad', 'Understated Male Ballad', 'male slow intimate'),
  seed('ost-piano-ballad', 'OST Piano Ballad', 'female piano strings cinematic'),
  seed('healing-piano-ballad', 'Healing Piano Ballad', 'male piano hopeful'),
  seed('nostalgic-female-ballad', 'Nostalgic Female Ballad', 'female piano strings'),
  seed('soft-duet-ballad', 'Soft Duet Ballad', 'duet piano romantic'),
  seed('cello-confession-ballad', 'Cello Confession Ballad', 'male piano strings intimate'),
  seed('rainy-day-ballad', 'Rainy Day Ballad', 'female rain piano'),
  seed('classic-pop-ballad', 'Classic Pop Ballad', 'male piano polished'),
  seed('dramatic-female-ballad', 'Dramatic Female Ballad', 'female strings cinematic'),
  seed('lullaby-comfort-ballad', 'Lullaby Comfort Ballad', 'male acoustic piano'),
  seed('piano-strings-delicate', 'Delicate Piano Strings Ballad', 'female piano strings'),
  seed('longing-male-ballad', 'Longing Male Ballad', 'male piano slow'),
  seed('winter-female-ballad', 'Winter Female Ballad', 'female piano slow'),
  seed('romantic-confession-ballad', 'Romantic Confession Ballad', 'male romantic piano'),
  seed('aftermath-ballad', 'Breakup Aftermath Ballad', 'female piano intimate'),
  seed('cinematic-duet-rise', 'Cinematic Duet Rise Ballad', 'duet strings cinematic'),
  seed('acoustic-pop-ballad', 'Acoustic Pop Ballad', 'male acoustic piano'),
  seed('moonlight-ballad', 'Moonlight Ballad', 'female piano slow'),
  seed('power-controlled-ballad', 'Controlled Power Ballad', 'male piano strings'),
  seed('wistful-cello-ballad', 'Wistful Cello Ballad', 'female piano strings'),
  seed('sparse-heartbreak-ballad', 'Sparse Heartbreak Ballad', 'male piano intimate'),
  seed('emotional-ost-ballad', 'Emotional OST Ballad', 'female strings cinematic'),
  seed('soft-healing-ballad', 'Soft Healing Ballad', 'male acoustic piano hopeful'),
  seed('sentimental-duet-ballad', 'Sentimental Duet Ballad', 'duet piano strings'),
  seed('dark-toned-ballad', 'Dark Toned Ballad', 'male dark piano'),
  seed('fragile-whisper-ballad', 'Fragile Whisper Ballad', 'female piano intimate'),
  seed('reflective-falsetto-ballad', 'Reflective Falsetto Ballad', 'male piano slow'),
  seed('elegant-female-ballad', 'Elegant Female Ballad', 'female piano polished'),
  seed('midnight-male-ballad', 'Midnight Male Ballad', 'male piano intimate'),
  seed('acoustic-duet-ballad', 'Acoustic Duet Ballad', 'duet acoustic piano'),
  seed('finale-ballad', 'Finale Ballad', 'female strings cinematic')
];

export const notionDerivedGenrePacks: StructuredGenrePack[] = [
  ...jazzVariants.map(variant => makeProfile('jazz', variant)),
  ...cityPopVariants.map(variant => makeProfile('city-pop', variant)),
  ...rnbVariants.map(variant => makeProfile('rnb', variant)),
  ...lofiVariants.map(variant => makeProfile('lofi', variant)),
  ...balladVariants.map(variant => makeProfile('ballad', variant))
];

export const genreLibrary: StructuredGenrePack[] = [...legacyGenreProfiles, ...notionDerivedGenrePacks].map(genre =>
  CORE_LYRIC_FLAVOR_IMAGES[genre.id] ? { ...genre, lyricFlavorImages: CORE_LYRIC_FLAVOR_IMAGES[genre.id] } : genre
);
export const genrePacks: GenrePack[] = genreLibrary;
export const importedGenreCount = notionDerivedGenrePacks.length;
export const totalGenreCount = genreLibrary.length;

export function getGenreById(id: string) {
  return genreLibrary.find(genre => genre.id === id);
}

export function getGenresByCategory(categoryId: string) {
  return genreLibrary.filter(genre => genre.categoryId === categoryId);
}

export function getCoreGenreIdsForArchetype(archetype: ChannelArchetype = 'senior-morning') {
  const ids = CORE_GENRE_IDS_BY_ARCHETYPE[archetype] || [];
  return ids.length ? [...ids] : [...SENIOR_MORNING_CORE_GENRE_IDS];
}

export function getCoreGenresForArchetype(archetype: ChannelArchetype = 'senior-morning') {
  const ids = getCoreGenreIdsForArchetype(archetype);
  return ids.map(id => getGenreById(id)).filter(Boolean) as StructuredGenrePack[];
}

export function getDefaultGenreIdsForArchetype(archetype: ChannelArchetype = 'senior-morning') {
  return getCoreGenreIdsForArchetype(archetype).slice(0, 3);
}

export function isCoreGenreForArchetype(genre: GenrePack, archetype: ChannelArchetype = 'senior-morning') {
  return genre.tier === 'core' && getCoreGenreIdsForArchetype(archetype).includes(genre.id);
}

export function getVisibleGenresForArchetype(
  archetype: ChannelArchetype = 'senior-morning',
  selectedIds: string[] = [],
  recentIds: string[] = []
) {
  const visibleIds = new Set([...getCoreGenreIdsForArchetype(archetype), ...selectedIds, ...recentIds]);
  return genreLibrary.filter(genre => visibleIds.has(genre.id));
}

export function searchExtendedGenres(query: string, categoryId = 'all') {
  const normalized = query.trim().toLowerCase();
  return genreLibrary.filter(genre => {
    if (genre.tier !== 'extended') return false;
    if (categoryId !== 'all' && genre.categoryId !== categoryId) return false;
    if (!normalized) return true;
    const haystack = [
      genre.label,
      genre.styleCore,
      genre.shortPrompt,
      genre.productionGuidance,
      ...(genre.aliases || []),
      ...(genre.instruments || []),
      ...(genre.moods || []),
      ...(genre.audiences || [])
    ].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}

export function searchHiddenGenresForArchetype(
  archetype: ChannelArchetype = 'senior-morning',
  query: string,
  categoryId = 'all'
) {
  const normalized = query.trim().toLowerCase();
  const coreIds = new Set(getCoreGenreIdsForArchetype(archetype));
  return genreLibrary.filter(genre => {
    if (coreIds.has(genre.id)) return false;
    if (categoryId !== 'all' && genre.categoryId !== categoryId) return false;
    if (!normalized) return true;
    const haystack = [
      genre.label,
      genre.styleCore,
      genre.shortPrompt,
      genre.productionGuidance,
      ...(genre.aliases || []),
      ...(genre.instruments || []),
      ...(genre.moods || []),
      ...(genre.audiences || [])
    ].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}

const genrePlainDescriptionsKo: Record<string, string> = {
  'adult-contemporary': '따뜻한 성인 팝. 라디오에서 흘러나오는 편안한 느낌.',
  'acoustic-pop': '기타와 피아노가 중심인 담백한 팝. 아침이나 산책에 잘 맞습니다.',
  'jazz-pop': '카페에 어울리는 부드러운 재즈 감성의 팝.',
  'showa-modern': '오래된 찻집처럼 차분하고 세련된 복고 감성.',
  'city-pop-soft': '밤거리보다 조용한 실내에 가까운 부드러운 시티팝.',
  'lofi-cafe': '편안한 카페 배경처럼 낮게 깔리는 포근한 질감.',
  'christmas-soft-pop': '아이들 캐럴보다 성숙한 12월용 따뜻한 팝.',
  'healing-ballad': '감정을 크게 터뜨리지 않고 위로해 주는 발라드.',
  'folk-pop': '일상 이야기가 잘 들리는 소박하고 친근한 팝.',
  'bossa-cafe': '여름 카페처럼 가볍고 우아한 휴식감.',
  'soft-rock': '운전이나 추억 장면에 어울리는 부드러운 라디오 록.',
  'piano-ballad': '피아노가 중심이 되는 조용하고 감정적인 팝 발라드.',
  'retro-soul-pop': '손으로 연주한 듯한 따뜻한 리듬과 성숙한 온기.',
  'synthwave-mellow': '강하지 않은 복고 신스 무드. 밤 드라이브에 가깝습니다.',
  'jazz-classic-vocal-lounge': '조용한 라운지에서 들리는 성숙한 보컬 재즈.',
  'jazz-soft-vocal-trio': '작은 연주 공간처럼 부드럽고 절제된 재즈.',
  'city-pop-rainy-window-pop': '비 오는 창가에 어울리는 차분한 시티팝 색감.'
};

export function describeGenreForUserKo(genre: GenrePack) {
  if (genrePlainDescriptionsKo[genre.id]) return genrePlainDescriptionsKo[genre.id];
  const mood = genre.moods?.[0] || genre.goodFor?.[0] || '편안한 분위기';
  const setting = genre.audiences?.[0] || genre.goodFor?.[1] || '플레이리스트';
  return `${genre.label}의 색깔을 가볍게 더합니다. ${mood} 느낌의 ${setting}에 어울립니다.`;
}

export function compactGenreTechnicalLine(genre: GenrePack) {
  const tempo = genre.tempo || genre.tempoRange;
  const instruments = genre.instruments.slice(0, 2).join(', ');
  return `${tempo[0]}-${tempo[1]} BPM · ${instruments} 중심`;
}
