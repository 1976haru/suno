/**
 * TASK v4.6 (TASK A) — real listening feedback (18-song average 72.2/100,
 * "옛날 향수나 이게 70년대 노래이네라는 느낌이 없어") traced to zero era-signature
 * descriptors (close harmony/two-part harmony/handclap/oboe-flugelhorn all
 * 0/18) because the concept text ("70년대 올드팝") named no artist, so
 * artistReferenceDecomposer.ts's decomposeArtistReferences() returned []
 * and every song fell back to genre-name-only prose. A prior diagnosis
 * blamed the genre selection itself (soul-family under-represented); this
 * task's own §0-4 retraction is explicit that the genre choice (folk-rock/
 * soft-rock/europop) was correct — Korean listeners' own "7080 팝송" canon
 * is folk-rock/soft-rock/europop, not soul. The actual gap is that none of
 * those genres' style prompts carried the CANONICAL sound of that
 * sub-genre's own real recordings, independent of whether an artist name
 * was ever typed in.
 *
 * An EraCanonPalette is that canonical sound, hand-curated per sub-genre
 * cluster, used as a fallback source of style-prompt atoms when no artist
 * reference exists for a song (core/eraCanonPalettePlan.ts). `koreanReferenceNote`
 * is strictly an internal authoring aid — never read by any prompt-building
 * code — see this task's own explicit "koreanReferenceNote를 프롬프트에 넣지
 *마십시오" ban; artist/band names never appear in style prompts regardless
 * of source (enforced the same way artist-reference atoms already are, via
 * artistReferenceDecomposer.ts's findArtistReferenceLeaks guard).
 */
export interface EraCanonPalette {
  id: string;
  labelKo: string;
  /** Which era/genre cluster this applies to — descriptive only, not matched against anything. */
  eraTag: string;
  fitsGenreIds: string[];
  /** This cluster's canonical sound. 2-3 are drawn per song — see eraCanonPalettePlan.ts's rotatingEraPaletteAtoms. */
  instrumentation: string[];
  harmonyTraits: string[];
  vocalTraits: string[];
  productionTraits: string[];
  /** Authoring reference only. Never read by prompt-building code, never surfaced to the user or the LLM. */
  koreanReferenceNote: string;
}

export const ERA_CANON_PALETTES: EraCanonPalette[] = [
  {
    id: 'canon-folk-duo',
    labelKo: '포크 듀오 하모니',
    eraTag: '1970s folk duo',
    // TASK v4.6 (§1-3) — spec text also listed 'acoustic-pop' here. Dropped:
    // real testing (tests/stress-v314.test.ts's own exhaustive moneyChord x
    // vocal x core-genre cross-product) found that genre specifically sits
    // on a promptBudget.ts trim cliff where adding ANY extra atom (1-4
    // tested) collapses several vocal-preset pairs to byte-identical output
    // — see this task's own final report for the reproduction. 'acoustic-pop'
    // is also senior-morning's own general-purpose acoustic genre (used far
    // beyond 70s-nostalgic contexts), unlike the other two oldpop-* ids here,
    // so scoping the palette away from it is arguably more correct too, not
    // just safer.
    fitsGenreIds: ['oldpop-folk-rock-70s', 'oldpop-close-harmony-duo'],
    instrumentation: [
      'fingerpicked steel-string acoustic guitar',
      '12-string acoustic doubling the melody',
      'upright bass with minimal drums',
      'subtle string arrangement entering late'
    ],
    harmonyTraits: [
      'two voices moving in parallel thirds throughout',
      'modal folk chord voicings with suspended fourths',
      'verse melody that steps rather than leaps'
    ],
    vocalTraits: [
      'two-part male close harmony sung as one blended voice',
      'clear unforced diction with no vibrato',
      'the harmony line stays above the melody'
    ],
    productionTraits: [
      'narrow warm stereo image',
      'close dry vocal with a short natural room tail',
      'tape compression on the acoustic guitars'
    ],
    koreanReferenceNote: '사이먼과 가펑클 계열. 한국 라디오 7080 대표'
  },
  {
    id: 'canon-soft-pop-duo',
    labelKo: '소프트팝 · 어덜트 컨템포러리',
    eraTag: '1970s soft pop / adult contemporary',
    fitsGenreIds: ['oldpop-soft-rock-am', 'oldpop-baroque-pop', 'oldpop-adult-contemporary-80s'],
    instrumentation: [
      'warm electric piano as the harmonic bed',
      'oboe or flugelhorn answering the vocal line',
      'multi-tracked choral backing vocals',
      'restrained brushed drum kit'
    ],
    harmonyTraits: [
      'lush chords with added sixths and ninths',
      'chromatic inner voice movement',
      'key change lifting the final chorus'
    ],
    vocalTraits: [
      'low warm contralto lead sitting close to the mic',
      'unhurried legato phrasing',
      'thick stacked harmony choir behind the lead'
    ],
    productionTraits: [
      'dense but soft orchestral bed',
      'almost no reverb on the lead vocal',
      'smooth compressed studio mix'
    ],
    koreanReferenceNote: '카펜터스 계열'
  },
  {
    id: 'canon-europop-glow',
    labelKo: '유로팝 · 스칸디나비안 팝',
    eraTag: '1970s europop',
    fitsGenreIds: ['oldpop-europop-glow', 'oldpop-orchestral-easy'],
    instrumentation: [
      'bright acoustic piano doubling the vocal line',
      'arpeggiated synth over acoustic rhythm guitar',
      'orchestral string stabs on the chorus',
      'clean electric guitar answering the vocal'
    ],
    harmonyTraits: [
      'minor-key verse opening into a major chorus',
      'stacked unison-to-thirds female harmony on the hook',
      'strong descending bass under the chorus'
    ],
    vocalTraits: [
      'two female voices in tight unison splitting into thirds',
      'clear forward diction',
      'strong sustained notes on the chorus'
    ],
    productionTraits: [
      'bright wide studio mix',
      'layered double-tracked lead vocal',
      'plate reverb on the chorus only'
    ],
    koreanReferenceNote: '아바 계열'
  },
  {
    id: 'canon-british-beat',
    labelKo: '영국 비트팝',
    eraTag: '1960s British beat',
    fitsGenreIds: ['oldpop-british-beat', 'oldpop-sunshine-pop'],
    instrumentation: [
      'jangly 12-string electric guitar',
      'melodic bass playing its own countermelody',
      'tambourine on the backbeat',
      'upright piano doubling the rhythm guitar'
    ],
    harmonyTraits: [
      'major-key verse with one unexpected borrowed chord',
      'abrupt key shift into the middle section',
      'parallel thirds and sixths in the backing harmony'
    ],
    vocalTraits: [
      'two-part male harmony in close intervals',
      'bright forward diction',
      'unison shout on the hook'
    ],
    productionTraits: [
      'narrow warm mono-leaning mix',
      'natural room reverb',
      'tape compression on the drums'
    ],
    koreanReferenceNote: '비틀즈 계열'
  },
  {
    id: 'canon-country-folk',
    labelKo: '컨트리 포크 · 싱어송라이터',
    eraTag: '1970s country folk',
    fitsGenreIds: ['oldpop-countrypolitan', 'oldpop-folk-rock-70s'],
    instrumentation: [
      'strummed acoustic guitar with a capo',
      'pedal steel sliding under the chorus',
      'banjo or dobro fill between lines',
      'simple brushed drums'
    ],
    harmonyTraits: [
      'plain major-key progression built on I-IV-V',
      'one modal borrowed chord in the bridge'
    ],
    vocalTraits: [
      'warm mid-range male lead with a slight rasp',
      'conversational phrasing close to speech',
      'group harmony joining only on the chorus'
    ],
    productionTraits: [
      'dry natural room',
      'wide acoustic guitars, centred vocal'
    ],
    koreanReferenceNote: '존 덴버·이글스 계열'
  },
  {
    id: 'canon-crooner-standard',
    labelKo: '크루너 · 스탠더드',
    eraTag: '1960s-70s crooner standard',
    fitsGenreIds: ['oldpop-standards-torch', 'oldpop-orchestral-easy', 'smooth-jazz-lounge'],
    instrumentation: [
      'full string section carrying the melody',
      'muted trumpet or alto sax obbligato',
      'brushed drums with upright bass',
      'piano comping in the background'
    ],
    harmonyTraits: [
      'jazz standard harmony with extended chords',
      'descending chromatic bass line'
    ],
    vocalTraits: [
      'rich baritone with pronounced vibrato on held notes',
      'behind-the-beat phrasing',
      'dramatic dynamic swell into the final chorus'
    ],
    productionTraits: [
      'wide orchestral hall ambience',
      'vocal forward over the strings'
    ],
    koreanReferenceNote: '톰 존스·엥겔베르트 계열'
  },
  {
    id: 'canon-soft-rock-band',
    labelKo: '소프트록 밴드',
    eraTag: '1970s soft rock band',
    fitsGenreIds: ['oldpop-soft-rock-am', 'oldpop-yacht-west-coast'],
    instrumentation: [
      'clean electric guitar arpeggios',
      'electric piano pads',
      'melodic bass line',
      'tight harmony vocals on the chorus'
    ],
    harmonyTraits: [
      'seventh chords and gentle key centres',
      'pre-chorus that lifts before resolving'
    ],
    vocalTraits: [
      'smooth mid-range male lead',
      'three-part harmony on the hook'
    ],
    productionTraits: [
      'warm AM-radio compression',
      'balanced stereo with guitars panned'
    ],
    koreanReferenceNote: '이글스·아메리카·브레드 계열'
  }
];

export function eraCanonPalettesForGenreId(genreId: string | undefined): EraCanonPalette[] {
  if (!genreId) return [];
  return ERA_CANON_PALETTES.filter(palette => palette.fitsGenreIds.includes(genreId));
}
