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
  /**
   * TASK v4.7 (팔레트 커버리지 확장) — never write "male"/"female" (or any
   * literal gender word) here, even to describe a genre's own typical
   * arrangement (e.g. "two-part male harmony"). A real audit run caught
   * this: canon-british-beat's own vocalTraits happened to say "male"
   * while a song's actual assigned vocalType was female, and
   * core/vocalPlan.ts's detectVocalGender() treats "both words present" as
   * ambiguous (returns null) rather than picking one — the song's real,
   * assigned gender silently stopped being detectable in its own style
   * prompt. Describe the ARRANGEMENT (harmony shape, register, delivery)
   * without naming a gender; the actual vocalType-driven gender text is
   * added separately elsewhere in the prompt.
   *
   * TASK v4.9 (TASK B, §2-3) — this ban extends past the literal words
   * "male"/"female": core/vocalPlan.ts's MALE_VOICE_TERMS/FEMALE_VOICE_TERMS
   * also match tenor/baritone (male) and soprano/mezzo/contralto/alto
   * (female) — 'lead tenor answered by...', 'rich baritone with...', and
   * 'low warm contralto lead...' all slipped past the v4.7 audit above
   * (which only grepped for the literal words) and only surfaced once TASK
   * B's own vocalPreference weighting made female-typed songs land on
   * doo-wop-girlgroup-family genres often enough to hit the "tenor" one in
   * practice (real regression: fullAudit.ts's "여성 곡의 female 명시"
   * 100%->67%). Avoid the whole MALE_VOICE_TERMS/FEMALE_VOICE_TERMS
   * vocabulary here, not just "male"/"female" themselves.
   */
  vocalTraits: string[];
  productionTraits: string[];
  /**
   * v4.16 (TASK C) — real listening: tambourine appeared in 8/18 songs
   * (44%) because it's the British-beat palette's own signature instrument
   * and that palette's genres got selected often; a senior set that
   * percussion-forward can't read as calm regardless of tempo/arrangement
   * fixes. 'brushed' (soft, spacious — folk-duo/soft-pop-duo/country-folk/
   * crooner-standard/piano-orchestral-ballad/warm-gentle-acoustic/
   * quiet-storm-synth), 'light' (some rhythmic presence, not driving —
   * soft-rock-band/europop-glow/doowop-girlgroup/showa-kayokyoku), 'driving'
   * (tambourine-forward backbeat energy, kept deliberately rare —
   * british-beat/motown-soul/soulful-rnb). §3-3's own target: brushed >=10
   * songs, light 4-6, driving <=4 across an 18-song set — this field only
   * TAGS each palette's own character; it doesn't itself enforce that set-
   * level distribution (no genre-selection code changed — see this task's
   * own explicit "팔레트를 바꾸지 마십시오. 타악 성향만 추가하는 것입니다"),
   * verified instead by real measurement (docs/v416-report.md).
   */
  percussionStyle: 'brushed' | 'light' | 'driving';
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
    // TASK v4.7 (팔레트 커버리지 확장) — japanese-folk-70s added: its own
    // genreLibrary styleCore ("1970s Japanese folk, acoustic guitar
    // centered, modest live ensemble, close-mic vocal, dry room intimacy")
    // is the same fingerpicked-acoustic-duo character as the other two ids
    // here, just Japanese rather than English-language.
    fitsGenreIds: ['oldpop-folk-rock-70s', 'oldpop-close-harmony-duo', 'japanese-folk-70s'],
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
      'two-part close harmony sung as one blended voice',
      'clear unforced diction with no vibrato',
      'the harmony line stays above the melody'
    ],
    productionTraits: [
      'narrow warm stereo image',
      'close dry vocal with a short natural room tail',
      'tape compression on the acoustic guitars',
      // v4.16 (TASK C, §3-4) — no explicit percussion phrase existed here before.
      'brushed drums with soft rim work'
    ],
    percussionStyle: 'brushed',
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
      'low warm lead sitting close to the mic',
      'unhurried legato phrasing',
      'thick stacked harmony choir behind the lead'
    ],
    productionTraits: [
      'dense but soft orchestral bed',
      'almost no reverb on the lead vocal',
      'smooth compressed studio mix'
    ],
    percussionStyle: 'brushed',
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
      'stacked unison-to-thirds harmony on the hook',
      'strong descending bass under the chorus'
    ],
    vocalTraits: [
      'two voices in tight unison splitting into thirds',
      'clear forward diction',
      'strong sustained notes on the chorus'
    ],
    productionTraits: [
      'bright wide studio mix',
      'layered double-tracked lead vocal',
      'plate reverb on the chorus only',
      // v4.16 (TASK C, §3-4) — no explicit percussion phrase existed here before.
      'shaker and light hi-hat'
    ],
    percussionStyle: 'light',
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
      'two-part harmony in close intervals',
      'bright forward diction',
      'unison shout on the hook'
    ],
    productionTraits: [
      'narrow warm mono-leaning mix',
      'natural room reverb',
      'tape compression on the drums',
      // v4.16 (TASK C, §3-4) — reinforces this palette's driving character.
      'crisp snare backbeat'
    ],
    percussionStyle: 'driving',
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
      'warm mid-range lead with a slight rasp',
      'conversational phrasing close to speech',
      'group harmony joining only on the chorus'
    ],
    productionTraits: [
      'dry natural room',
      'wide acoustic guitars, centred vocal'
    ],
    percussionStyle: 'brushed',
    koreanReferenceNote: '존 덴버·이글스 계열'
  },
  {
    id: 'canon-crooner-standard',
    labelKo: '크루너 · 스탠더드',
    eraTag: '1960s-70s crooner standard',
    // TASK v4.7 (팔레트 커버리지 확장) — the 10 jazz-*-vocal/lounge ids added
    // here are all vocal-jazz/lounge/crooner in character by genreLibrary's
    // own OLDPOP_LOUNGE_CORE_GENRE_IDS comment ("Vocal jazz / standards /
    // bossa / lounge — not bebop/fusion/acid-jazz/jazz-rap"), matching this
    // palette's own strings/muted-trumpet/brushed-drums/piano instrumentation
    // directly — not a stretch fit like the R&B/soul cluster below needed.
    fitsGenreIds: [
      'oldpop-standards-torch', 'oldpop-orchestral-easy', 'smooth-jazz-lounge',
      'jazz-classic-vocal-lounge', 'jazz-soft-vocal-trio', 'jazz-jazz-ballad-vocal', 'jazz-smooth-sax-vocal',
      'jazz-torch-vocal-jazz', 'jazz-swing-crooner-ballroom', 'jazz-cabaret-jazz', 'jazz-hotel-lounge-jazz',
      'jazz-contemporary-vocal-jazz', 'jazz-pop',
      // 지시문 20 (TASK A) — real gap found while wiring senior-morning's
      // preferredGenres: jazz-brush-ballad-jazz shares this exact palette's
      // instrumentation (brushed drums, extended jazz chords, warm live-room
      // mix) and its own styleCore template is identical to
      // jazz-classic-vocal-lounge/jazz-swing-crooner-ballroom just above,
      // but it was never added to any palette's fitsGenreIds — same class
      // of gap the showa-seventies incident already caught once.
      'jazz-brush-ballad-jazz',
      // 지시문 21 (TASK B) — oldpop-night-chanson은 oldpop-standards-torch와
      // 같은 "인티메이트 멜랑콜릭 남성 보컬" 크루너 캐릭터를 공유해 추가.
      'oldpop-night-chanson',
      // 지시문 21 (TASK A) — oldpop-italian-canzone도 "풀 스트링 섹션·
      // 오페라풍 남성 리드"라는 이 팔레트의 핵심 정체성과 직접 일치해 추가.
      'oldpop-italian-canzone'
    ],
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
      'rich resonant tone with pronounced vibrato on held notes',
      'behind-the-beat phrasing',
      'dramatic dynamic swell into the final chorus'
    ],
    productionTraits: [
      'wide orchestral hall ambience',
      'vocal forward over the strings'
    ],
    percussionStyle: 'brushed',
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
      'smooth mid-range lead',
      'three-part harmony on the hook'
    ],
    productionTraits: [
      'warm AM-radio compression',
      'balanced stereo with guitars panned',
      // v4.16 (TASK C, §3-4) — no explicit percussion phrase existed here before.
      'light kit with soft snare'
    ],
    percussionStyle: 'light',
    koreanReferenceNote: '이글스·아메리카·브레드 계열'
  },
  // TASK v4.7 (팔레트 커버리지 확장) — 7 new palettes below close the gap this
  // task's own v4.7 report flagged: the original 7 palettes covered only
  // ~15 of the 72 genres senior-morning/showa-cafe/oldpop-lounge/showa-70s
  // actually draw from. Each new palette's fitsGenreIds/wording is checked
  // against that genre's own real genreLibrary/index.ts styleCore/instruments
  // text (not invented from scratch) — see this task's own investigation
  // notes for exact citations. alt-rnb/contemporary-rnb are deliberately
  // NOT covered anywhere (their own styleCore explicitly says "filtered
  // synth pads"/"deep sub bass"/"sub-bass warmth" — directly contradicting
  // channelSoundFloor's forbiddenAtoms; every other oldpop-lounge R&B id
  // uses a shared, warmer "laid-back pocket groove, soft backbeat, lush
  // seventh chords" styleCore with no such conflict).
  {
    id: 'canon-motown-soul',
    labelKo: '모타운·필리 소울',
    eraTag: '1960s-70s Motown / Philadelphia soul',
    fitsGenreIds: ['oldpop-motown-pop-soul', 'oldpop-philly-soul-sweet'],
    instrumentation: [
      'tambourine on all four beats',
      'melodic electric bass',
      'horn section stabs',
      'sweeping string section'
    ],
    harmonyTraits: [
      'gospel-tinged pop-soul chord color',
      'sweet extended soul-pop chords'
    ],
    vocalTraits: [
      'soulful lead answered by gospel-toned backing vocals',
      'velvet-toned romantic delivery on the chorus'
    ],
    productionTraits: [
      'tight punchy soul-pop mix',
      'velvet orchestral soul warmth',
      // v4.16 (TASK C, §3-4) — reinforces this palette's driving character.
      'crisp snare backbeat'
    ],
    percussionStyle: 'driving',
    koreanReferenceNote: '모타운·필리 소울 계열 (스티비 원더, 슈프림스, 델포닉스 등)'
  },
  {
    id: 'canon-doowop-girlgroup',
    labelKo: '두왑·걸그룹 월오브사운드',
    eraTag: '1950s-60s doo-wop / girl-group',
    // 지시문 21 (TASK B) — 두왑 분화 2종(느린 발라드형·경쾌한 업템포형)은
    // oldpop-doowop-harmony와 같은 I-vi-IV-V 두왑 화성·클로즈하모니
    // 정체성을 그대로 공유하는 형제 장르라 이 palette에 추가.
    fitsGenreIds: ['oldpop-doowop-harmony', 'oldpop-brill-building', 'oldpop-girl-group-wall', 'oldpop-doowop-ballad', 'oldpop-doowop-uptempo'],
    instrumentation: [
      'upright bass on the downbeat',
      'brushed snare',
      'close-harmony backing vocals',
      'layered hand percussion'
    ],
    harmonyTraits: [
      'I-vi-IV-V doo-wop turnaround',
      'simple diatonic I-IV-V hook',
      'bright major-key call and response'
    ],
    vocalTraits: [
      'lead voice answered by four-part close harmony',
      'unison lead answered by a backing chorus, kept forward in the mix',
      'nonsense-syllable backing vocal figures under the lead'
    ],
    productionTraits: [
      'narrow warm mono-leaning mix',
      'layered wall-of-sound reverb that never buries the lead',
      'bright compact single-era studio mix',
      // v4.16 (TASK C, §3-4) — reinforces this palette's light (not driving) character.
      'shaker and light hi-hat'
    ],
    percussionStyle: 'light',
    koreanReferenceNote: '두왑·걸그룹 월오브사운드 계열 (플래터스, 로네츠 등)'
  },
  {
    id: 'canon-piano-orchestral-ballad',
    labelKo: '피아노·오케스트라 발라드',
    eraTag: '1970s-80s piano / orchestral ballad',
    // 지시문 21 (TASK A) — oldpop-six-eight-slow-ballad(6/8 슬로우 발라드)
    // 추가. 피아노 중심에 후렴에서 스트링이 들어오는 편성이 이 팔레트의
    // 기존 5개 장르와 직접 일치해 새 팔레트를 만들지 않고 여기 편입.
    fitsGenreIds: ['oldpop-piano-ballad-70s', 'oldpop-orchestral-ballad-80s', 'oldpop-sunlit-strings-pop', 'piano-ballad', 'healing-ballad', 'oldpop-six-eight-slow-ballad'],
    // TASK v4.7 — this palette covers 5 genres; every axis needs enough
    // distinct phrases that genreId-salted selection (eraCanonPalettePlan.ts's
    // rotatingEraPaletteAtoms) can actually land 5 different genres on 5
    // different phrases instead of the small pool forcing pigeonhole
    // collisions (tests/oldpopGenreFamily.test.ts caught exactly this at the
    // old 2-item pool size).
    instrumentation: [
      'grand piano',
      'string section entering at the chorus',
      'restrained brushed drums',
      'soft timpani swell',
      'soft harp glissando',
      'muted cello countermelody'
    ],
    harmonyTraits: [
      'cinematic piano-ballad chord movement',
      'late key-change ballad lift',
      'suspended fourth resolving into the hook',
      'gentle diminished passing chord before the final lift',
      'major-seventh verse color opening into a simpler chorus',
      'slow descending bass line under a held chord'
    ],
    vocalTraits: [
      'emotive piano-ballad lead vocal',
      'powerful-but-controlled delivery building to the final chorus',
      'restrained verse phrasing opening into a fuller chorus',
      'held final note with a slow, controlled vibrato',
      'quiet opening verse, full-voiced by the last chorus',
      'unhurried rubato phrasing across the bar line'
    ],
    productionTraits: [
      'intimate piano-forward room tone widening at the chorus',
      'expansive orchestral ballad mix',
      'warm room reverb with the piano close and present',
      'strings held back until the last chorus for contrast',
      'wide hall ambience opening only at the climax',
      'close piano mic blending into a fuller room by the chorus'
    ],
    percussionStyle: 'brushed',
    koreanReferenceNote: '70~80년대 피아노·오케스트라 발라드 계열'
  },
  {
    id: 'canon-warm-gentle-acoustic',
    labelKo: '시대 불문 따뜻한 어쿠스틱',
    eraTag: 'timeless warm acoustic',
    fitsGenreIds: ['oldpop-warm-morning-glow', 'oldpop-gentle-lullaby-pop', 'oldpop-hearth-acoustic', 'oldpop-slow-waltz-memory', 'oldpop-evening-lamp-ballad'],
    // TASK v4.7 — same 5-genre pool-size reasoning as canon-piano-orchestral
    // -ballad above.
    instrumentation: [
      'acoustic guitar arpeggio',
      'warm electric piano',
      'minimal light percussion',
      'soft upright bass',
      'light fingerstyle nylon guitar',
      'soft celesta touches'
    ],
    harmonyTraits: [
      'warm open major-key harmony',
      'reflective minor-to-major waltz progression',
      'simple plagal IV-I resolution',
      'gentle suspended-second color on the verse',
      'unhurried I-IV-V movement with no surprises',
      'soft parallel-sixths harmony under the hook'
    ],
    vocalTraits: [
      'gentle unhurried lead vocal',
      'close warm delivery, no belting',
      'plainspoken conversational delivery',
      'soft falling phrase endings',
      'whispered intimacy on the final line',
      'warm mid-register delivery, never straining'
    ],
    productionTraits: [
      'soft close room mix',
      'minimal reverb, intimate and dry',
      'natural unprocessed room tone',
      'gentle tape-like warmth with no hard edges',
      'quiet room tone with almost no processing',
      'close-mic warmth, nothing pushed too bright',
      // v4.16 (TASK C, §3-4) — no explicit percussion phrase existed here before.
      'minimal percussion, brushes only'
    ],
    percussionStyle: 'brushed',
    koreanReferenceNote: '시대 불문 따뜻한 어쿠스틱 계열'
  },
  {
    id: 'canon-quiet-storm-synth',
    labelKo: '콰이어트스톰·라이트 신스팝',
    eraTag: '1980s quiet storm / light synth pop',
    // TASK v4.7 — 'analog synth pad'/'arpeggiator' here, never 'digital
    // synth pad': channelSoundFloor.forbiddenAtoms bans the latter
    // specifically, and v4.7's own §1-4 explicitly allows 80s-analog synth
    // texture under productionEraTags — this palette is exactly that case.
    fitsGenreIds: ['oldpop-quiet-storm-warm', 'oldpop-light-synth-pop-warm', 'oldpop-soft-duet-80s'],
    instrumentation: [
      'fretless bass',
      'alto saxophone',
      'analog synth pad',
      'soft brushed drums'
    ],
    harmonyTraits: [
      'smooth minor-seventh quiet-storm chords',
      'bright-but-soft synth-pop chords',
      'gentle suspended chord before the chorus resolves'
    ],
    vocalTraits: [
      'low close-mic quiet-storm lead',
      'alternating verse leads trading the melody',
      'soft breathy delivery, never belted'
    ],
    productionTraits: [
      'intimate late-night close mix',
      'warm analog-leaning hybrid mix',
      'soft-focus room tone with a gentle low-end warmth',
      // TASK v4.7 — this palette also serves the lofi-cafe partial fallback
      // (PARTIAL_PALETTE_FALLBACK), so a 4th productionTraits phrase keeps
      // that extra consumer from tightening the pool further.
      'unhurried close-mic intimacy'
    ],
    // v4.16 (TASK C) — not named in the spec's own §3-2 table; classified
    // 'brushed' by the same reasoning as the other 6 (already carries "soft
    // brushed drums" in its own instrumentation above, calm quiet-storm
    // register).
    percussionStyle: 'brushed',
    koreanReferenceNote: '80년대 콰이어트스톰·라이트 신스팝 계열'
  },
  {
    id: 'canon-showa-kayokyoku',
    labelKo: '일본 70년대 가요쿄쿠',
    eraTag: '1970s Japanese kayokyoku / new music / showa groove',
    fitsGenreIds: ['kayokyoku-70s', 'new-music-70s', 'showa-groove-70s'],
    instrumentation: [
      'live brass section',
      'sweeping strings',
      'clavinet',
      'wah electric guitar'
    ],
    harmonyTraits: [
      'graceful minor-to-major chorus cadence',
      'sophisticated add9 and maj7 colors'
    ],
    vocalTraits: [
      'mature Japanese lead vocal',
      'lyrical adult delivery'
    ],
    productionTraits: [
      'analog tape saturation, spring and plate reverb',
      'narrow stereo image',
      // v4.16 (TASK C, §3-4) — no explicit percussion phrase existed here before.
      'light kit with soft snare'
    ],
    // v4.16 (TASK C) — not named in the spec's own §3-2 table; classified
    // 'light' (groove-oriented per its own eraTag, but no tambourine/driving
    // backbeat character in its instrumentation — brass/strings/clavinet/wah
    // guitar, not percussion-forward).
    percussionStyle: 'light',
    koreanReferenceNote: '1970년대 일본 가요쿄쿠·뉴뮤직·쇼와 그루브 계열'
  },
  {
    id: 'canon-soulful-rnb',
    labelKo: '따뜻한 소울·R&B',
    eraTag: 'warm vintage-leaning soul / R&B',
    // TASK v4.7 — every id here shares genreLibrary's own generic "laid-back
    // pocket groove, soft backbeat, lush seventh chords, polished low-end
    // focus" styleCore (the Notion-derived rnb-*-rnb ids) or an explicitly
    // warm/hand-played one (neo-soul, retro-soul-pop) — none of them mention
    // digital synths or sub bass, unlike alt-rnb/contemporary-rnb (excluded).
    fitsGenreIds: [
      'retro-soul-pop', 'neo-soul',
      'rnb-old-school-romance-rnb', 'rnb-soulful-gospel-warmth', 'rnb-gospel-soul-lift',
      'rnb-quiet-storm-baritone', 'rnb-velvet-baritone-rnb', 'rnb-silky-studio-rnb',
      'rnb-soulful-male-rnb', 'rnb-soul-infused-female', 'rnb-romantic-rnb',
      'rnb-emotional-female-rnb', 'rnb-smooth-clean-rnb'
    ],
    instrumentation: [
      'Rhodes electric piano',
      'live hand-played drum groove',
      'warm round bass',
      'close stacked backing harmonies'
    ],
    harmonyTraits: [
      'lush seventh chords',
      'smooth ii-V soul movement'
    ],
    vocalTraits: [
      'warm laid-back lead vocal',
      'close stacked harmony answering the lead'
    ],
    productionTraits: [
      'polished low-end focus',
      'soft backbeat, hand-played pocket',
      // v4.16 (TASK C, §3-4) — reinforces this palette's driving character
      // WITHOUT adding a 3rd tambourine source (§3-4's own "탬버린은
      // driving 에만 두십시오" is about which INSTRUMENT carries the
      // signature, not that every driving palette must use it — british-beat/
      // motown-soul already carry it; keeping tambourine to just those two
      // keeps its real-set appearance count naturally low, per §3-3's own
      // "최대 4곡").
      'crisp snare backbeat'
    ],
    percussionStyle: 'driving',
    koreanReferenceNote: '따뜻한 빈티지 성향 소울·R&B 계열'
  },
  // 지시문 21 (TASK B) — oldpop-rainy-ballad-blues 전용 신규 palette.
  // 기존 14개 palette 전부 검토했으나 클린 할로우바디 기타·트레몰로 바·
  // 스프링 리버브 조합에 들어맞는 것이 없었다(canon-soft-rock-band는
  // 밴드 편성이라 성격 다름, canon-crooner-standard는 현악/피아노 중심이라
  // 성격 다름) — 억지로 끼워 맞추지 않고 새 palette를 만든다.
  {
    id: 'canon-tremolo-blues-ballad',
    labelKo: '트레몰로 발라드 블루스',
    eraTag: '1960s-70s ballad blues',
    fitsGenreIds: ['oldpop-rainy-ballad-blues'],
    instrumentation: [
      'clean hollow-body electric guitar',
      'spring reverb tank',
      'upright bass',
      'brushed drums'
    ],
    harmonyTraits: [
      'dark minor chord-melody guitar line',
      'slow blues turnaround resolving into the tonic'
    ],
    vocalTraits: [
      'restrained sung baritone lead',
      'no ad-lib or wordless filler between phrases'
    ],
    productionTraits: [
      'subtle tremolo bar warble',
      'spring reverb wash on the guitar',
      'dark minor instrumental intro before the vocal enters'
    ],
    percussionStyle: 'brushed',
    koreanReferenceNote: '빗속 발라드 블루스 — 강사 원문의 "no humming/ooh/aah/mmm" 정체성 그대로'
  },
  // ---------------------------------------------------------------------
  // 지시문 74 (TASK B-5) — en-chillhop 워크스페이스용 신설 2종.
  //
  // 실측 근거(§2.3-4): 기존 15개 팔레트의 fitsGenreIds를 전수 확인한 결과
  // chill-rap / boom-bap-mellow / jazz-rap / en-deep-house-* 어느 것도
  // 포함되지 않았다. PARTIAL_PALETTE_FALLBACK에도 없어 이 워크스페이스는
  // 시대/장르 고유색 원자를 0개 받고 있었다(실측: 위 12개 장르 전부 full
  // 0종 · partial 없음).
  //
  // 원자 문구는 각 장르 자신의 genreLibrary 레코드(styleCore/instruments/
  // rhythm/production/harmony)에서 이미 확정된 성격을 팔레트 어휘로 옮긴
  // 것이며, 실존 아티스트·밴드·트랙명은 어느 필드에도 쓰지 않았다(§8).
  // vocalTraits에는 성별 단어와 MALE_VOICE_TERMS/FEMALE_VOICE_TERMS 어휘
  // (tenor/baritone/soprano/mezzo/contralto/alto 포함)를 쓰지 않는다 —
  // 이 인터페이스 자신의 vocalTraits 주석에 기록된 실측 사고 이력 참고.
  // ---------------------------------------------------------------------
  {
    id: 'canon-chill-rap-boombap',
    labelKo: '칠랩·멜로우 붐뱁',
    eraTag: 'sample-era mellow hip-hop / jazz rap',
    fitsGenreIds: ['chill-rap', 'boom-bap-mellow', 'jazz-rap', 'lofi-hiphop-study'],
    instrumentation: [
      'dusty sampled drum break with a soft kick',
      'filtered upright bass sitting under the beat',
      'electric piano loop chopped from a longer phrase',
      'muted horn stab answering the phrase ends'
    ],
    harmonyTraits: [
      'four-bar minor seventh loop that never fully resolves',
      'jazz turnaround repeating under the whole verse',
      'one borrowed dominant chord marking the hook'
    ],
    vocalTraits: [
      'conversational flow sitting slightly behind the beat',
      'sung hook doubled an octave apart over the same loop',
      'phrases ending early and leaving the loop exposed'
    ],
    productionTraits: [
      'sampler-era band-limited top end, nothing sparkling above it',
      'drums compressed until the room between hits pumps',
      'vocal mixed close and low, sitting inside the beat rather than on top'
    ],
    // 붐뱁/재즈랩의 타악은 강한 백비트가 아니라 브러시·먼지 낀 드럼 브레이크
    // 성격이다(장르 레코드의 'brush drums' / 'lazy head-nod pocket').
    percussionStyle: 'brushed',
    koreanReferenceNote: '샘플 기반 멜로우 힙합·재즈랩 계열 — 느슨한 포켓과 먼지 낀 드럼 질감'
  },
  {
    id: 'canon-deep-house-club',
    labelKo: '딥하우스 클럽',
    eraTag: 'warm analog-leaning deep house / UK garage swing',
    fitsGenreIds: [
      'en-deep-house-melodic', 'en-deep-house-organic', 'en-deep-house-vocal-anthem',
      'en-deep-house-soulful', 'en-deep-house-tech-groove', 'en-house-garage-swing'
    ],
    instrumentation: [
      'four-on-the-floor kick with a long rolling sub under it',
      'filtered analog pad opening across eight bars',
      'plucked chord stab landing on the off-beat',
      'hand percussion layered against the closed hi-hat'
    ],
    harmonyTraits: [
      'two-chord vamp held for the whole groove',
      'minor-to-major lift arriving only at the drop',
      'suspended pad chord resolving late over the bassline'
    ],
    vocalTraits: [
      'hook phrase repeated as a chopped sample rather than sung through',
      'breathy texture used as another layer in the groove',
      'spoken stab placed percussively on the off-beat'
    ],
    productionTraits: [
      'long filter sweeps doing the arranging instead of new parts',
      'dry tight club low end with the kick and sub locked together',
      'sixteen-bar build and drop shaping the whole track'
    ],
    // 포 온 더 플로어 — 이 팔레트만 driving이다.
    percussionStyle: 'driving',
    koreanReferenceNote: '따뜻한 아날로그 계열 딥하우스·UK 개러지 스윙 — 필터 스윕과 롱 빌드 중심'
  }
];

export function eraCanonPalettesForGenreId(genreId: string | undefined): EraCanonPalette[] {
  if (!genreId) return [];
  return ERA_CANON_PALETTES.filter(palette => palette.fitsGenreIds.includes(genreId));
}

/**
 * TASK v4.7 (TASK B, §2-3) — "그 장르에 맞는 팔레트가 있는지 먼저 확인, 없으면
 * 가장 가까운 팔레트를 부분 적용" — genre ids named explicitly in the spec
 * (chanson, bossa-cafe) that sit outside every palette's own fitsGenreIds
 * but are close enough in production character to borrow just that
 * palette's productionTraits (not the full instrumentation/harmony/vocal
 * set — those would actively misdescribe a chanson/bossa arrangement).
 * core/eraCanonPalettePlan.ts checks this only after a direct
 * eraCanonPalettesForGenreId match fails.
 */
export const PARTIAL_PALETTE_FALLBACK: Record<string, string> = {
  chanson: 'canon-crooner-standard',
  'bossa-cafe': 'canon-soft-rock-band',
  // TASK v4.7 (팔레트 커버리지 확장) — same reasoning as chanson/bossa-cafe
  // above: these genres are close enough in production character to borrow
  // one nearby palette's productionTraits, but different enough in their
  // own defining instrumentation (acoustic-pop's own genre, for instance,
  // spans many different arrangements) that a FULL palette match would
  // misdescribe them.
  'acoustic-pop': 'canon-warm-gentle-acoustic',
  'adult-contemporary': 'canon-soft-pop-duo',
  'folk-pop': 'canon-folk-duo',
  'soft-rock': 'canon-soft-rock-band',
  // TASK v4.7 — mapped to quiet-storm-synth (not crooner-standard, which
  // jazz-pop/several jazz-* ids already fully occupy) specifically so a
  // narrow jazz-pop + lofi-cafe + bossa-cafe genre mix still reaches 2+
  // distinct palettes instead of collapsing both onto the same one.
  'lofi-cafe': 'canon-quiet-storm-synth',
  'city-pop-soft': 'canon-europop-glow',
  'city-pop-rainy-window-pop': 'canon-europop-glow',
  'showa-modern': 'canon-quiet-storm-synth',
  'christmas-soft-pop': 'canon-warm-gentle-acoustic',
  'jazz-bossa-vocal-jazz': 'canon-soft-rock-band'
};

export function partialPaletteForGenreId(genreId: string | undefined): EraCanonPalette | undefined {
  if (!genreId) return undefined;
  const paletteId = PARTIAL_PALETTE_FALLBACK[genreId];
  if (!paletteId) return undefined;
  return ERA_CANON_PALETTES.find(palette => palette.id === paletteId);
}
