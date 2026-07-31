# v3.63 SetDirector / Genre Accessibility Report

Generated locally with directSetLocal. Total genre catalog observed: 320. No provider/API call used.

## 1. 입력 3종에 대한 SetPlan 전문

### 1-1. 비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝
```json
{
  "interpretation": {
    "intentKo": "\"비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝\" 입력을 mid-1960s British beat pop, 1960s beat-pop / old-pop 중심의 British Beat Pop, Folk Pop, Acoustic Pop, 70s Soft Rock AM Gold 세트로 해석했습니다.",
    "eraFocus": [
      "mid-1960s British beat pop",
      "1960s beat-pop / old-pop"
    ],
    "artistReferences": [
      {
        "matchedSurface": "비틀즈",
        "eraTag": "mid-1960s British beat pop",
        "instrumentation": [
          "jangly 12-string electric guitar",
          "melodic bass playing countermelody",
          "bright compact drum kit with tambourine on the backbeat",
          "upright piano doubling the rhythm guitar"
        ],
        "harmonyTraits": [
          "major-key verses with an unexpected borrowed chord",
          "abrupt key shift into the middle section",
          "parallel thirds and sixths in the backing harmony"
        ],
        "rhythmTraits": [
          "driving eighth-note strum",
          "handclaps on the chorus"
        ],
        "productionTraits": [
          "narrow warm 1960s mono-leaning mix",
          "natural room reverb",
          "tape compression on the drums"
        ],
        "vocalTraits": [
          "two-part male harmony singing in close intervals",
          "bright forward diction",
          "unison shout on the hook"
        ],
        "suggestedGenreIds": [
          "oldpop-british-beat",
          "folk-pop",
          "acoustic-pop"
        ],
        "excludeAdditions": [
          "famous band imitation",
          "soundalike vocals",
          "copied melodies"
        ]
      }
    ],
    "audienceProfileId": "senior-morning",
    "reasoningKo": [
      "장르 후보는 core/extended 구분 없이 320종 전체에서 보되, senior-morning 채널에 맞는 후보로 1차 필터했습니다.",
      "5개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.",
      "보컬은 남성/여성/듀엣 축을 균등 배분하고, 구조 템플릿은 5종을 순환시켰습니다.",
      "인트로/훅 장치/밀도는 문구가 아니라 그룹 제약으로 브릿지에 전달합니다."
    ]
  },
  "allocations": [
    {
      "axis": "genre",
      "mode": "manual",
      "counts": {
        "oldpop-british-beat": 5,
        "folk-pop": 5,
        "acoustic-pop": 4,
        "oldpop-soft-rock-am": 3,
        "oldpop-warm-morning-glow": 1
      }
    },
    {
      "axis": "vocalType",
      "mode": "manual",
      "counts": {
        "male": 6,
        "female": 6,
        "mixed": 6
      }
    },
    {
      "axis": "introTexture",
      "mode": "manual",
      "counts": {
        "ag_finger": 2,
        "ag_harmonics": 2,
        "ag_muted_strum": 2,
        "ag_nylon_waltz": 2,
        "eg_tremolo": 1,
        "eg_clean_arp": 1,
        "eg_slide_swell": 1,
        "ep_rhodes_riff": 1,
        "ep_glass_chords": 1,
        "str_pizz": 1,
        "str_warm_pad": 1,
        "str_counterline": 1,
        "str_spiccato": 1,
        "br_trombone_swell": 1
      }
    },
    {
      "axis": "hookDevice",
      "mode": "manual",
      "counts": {
        "prechorus-dropout": 2,
        "stop-time": 2,
        "octave-lift": 2,
        "key-lift": 2,
        "answer-riff": 2,
        "double-hook": 2,
        "half-time-chorus": 2,
        "build-fill": 2,
        "bridge-breakdown": 1,
        "acappella-tag": 1
      }
    },
    {
      "axis": "arrangementDensity",
      "mode": "manual",
      "counts": {
        "sparse": 6,
        "medium": 6,
        "full": 6
      }
    },
    {
      "axis": "structureTemplate",
      "mode": "manual",
      "counts": {
        "T1": 4,
        "T2": 4,
        "T3": 4,
        "T4": 3,
        "T5": 3
      }
    },
    {
      "axis": "lyricTheme",
      "mode": "manual",
      "counts": {
        "senior-morning-coffee-first-light": 1,
        "senior-old-letter-after-breakfast": 1,
        "senior-kitchen-radio-tea": 1,
        "senior-garden-dew-walk": 1,
        "senior-market-bus-window": 1,
        "senior-family-photo-album": 1,
        "senior-wool-cardigan-chair": 1,
        "senior-porch-tea-sunset": 1,
        "senior-train-platform-reunion": 1,
        "senior-handwritten-recipe": 1,
        "senior-paper-calendar-date": 1,
        "senior-riverside-bench": 1,
        "senior-bookshop-rain": 1,
        "senior-laundry-sunline": 1,
        "senior-old-radio-request": 1,
        "senior-window-plant-new-leaf": 1,
        "senior-post-office-parcel": 1,
        "senior-evening-newspaper-lamp": 1
      }
    },
    {
      "axis": "pov",
      "mode": "manual",
      "counts": {
        "firstPerson": 15,
        "secondPerson": 2,
        "thirdPerson": 1
      }
    }
  ],
  "slots": [
    {
      "trackNo": 1,
      "title": "Play Old & Hollow",
      "hookPhrase": "Play the Old Record",
      "songRole": "cold-open",
      "tempo": 74,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, natural acoustic room, plainspoken storyteller vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "12-string electric guitar",
        "tambourine backbeat"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-morning-coffee-first-light",
      "lyricThemeText": "sitting with morning coffee before the day begins, watching first light move across the table",
      "lyricThemeArc": "sleepy heaviness opening into steady comfort",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalVariantText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 2,
      "title": "You're Still Here",
      "hookPhrase": "You're Still Here",
      "songRole": "flagship",
      "tempo": 85,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers, clear youthful group harmony",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "canon",
      "instrumentSet": [
        "strummed acoustic guitar",
        "soft piano",
        "upright bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-old-letter-after-breakfast",
      "lyricThemeText": "finding an old folded letter after breakfast and reading it beside a quiet window",
      "lyricThemeArc": "private ache softening into gratitude",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalVariantText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 3,
      "title": "Radio Playing & Ember",
      "hookPhrase": "Keep the Radio Playing",
      "songRole": "flagship",
      "tempo": 112,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, jangly 12-string guitar, clear intimate vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "12-string electric guitar",
        "melodic walking bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-kitchen-radio-tea",
      "lyricThemeText": "making tea in a small kitchen while an old radio plays low in the corner",
      "lyricThemeArc": "ordinary routine becoming a warm companion",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 4,
      "title": "Catch Morning",
      "hookPhrase": "Catch the Morning Train",
      "songRole": "brighter sing-along track",
      "tempo": 96,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers, clear intimate vocal",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "default",
      "instrumentSet": [
        "strummed acoustic guitar",
        "light mandolin texture",
        "upright bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-garden-dew-walk",
      "lyricThemeText": "walking slowly through a small garden with dew on the leaves and slippers on the path",
      "lyricThemeArc": "quiet worry settling into a clear breath",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 5,
      "title": "Stay with Me Tonight",
      "hookPhrase": "Stay with Me Tonight",
      "songRole": "quiet middle scene",
      "tempo": 103,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light percussion"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-market-bus-window",
      "lyricThemeText": "riding the bus home from the morning market with a paper bag resting on the knees",
      "lyricThemeArc": "tired body finding a small lift",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalVariantText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 6,
      "title": "Light",
      "hookPhrase": "Keep the Light On",
      "songRole": "romantic shade without melodrama",
      "tempo": 101,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, natural acoustic warmth, light acoustic pulse, melodic walking bass",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "12-string electric guitar",
        "melodic walking bass",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-family-photo-album",
      "lyricThemeText": "sorting a family photo album on the floor while afternoon dust shines in the room",
      "lyricThemeArc": "bittersweet remembering turning into a gentle smile",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalVariantText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 7,
      "title": "I Won't Forget",
      "hookPhrase": "I Won't Forget",
      "songRole": "seasonal detail track",
      "tempo": 85,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "canon",
      "instrumentSet": [
        "strummed acoustic guitar",
        "soft piano"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-wool-cardigan-chair",
      "lyricThemeText": "folding a worn wool cardigan over a familiar chair before opening the window",
      "lyricThemeArc": "small loneliness becoming practical tenderness",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalVariantText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 8,
      "title": "Don't Let Go of Me",
      "hookPhrase": "Don't Let Go of Me",
      "songRole": "late-set emotional center",
      "tempo": 81,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers, natural acoustic warmth",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light mandolin texture",
        "strummed acoustic guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-porch-tea-sunset",
      "lyricThemeText": "drinking tea on the porch at sunset while neighbors close their gates one by one",
      "lyricThemeArc": "day-end fatigue resolving into calm acceptance",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalVariantText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 9,
      "title": "Window",
      "hookPhrase": "Wait by the Window",
      "songRole": "warm radio-friendly highlight",
      "tempo": 95,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, warm radio compression, light acoustic pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "default",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-train-platform-reunion",
      "lyricThemeText": "waiting on a small train platform with a scarf in hand and a paper ticket in the pocket",
      "lyricThemeArc": "nervous anticipation becoming open warmth",
      "pov": "thirdPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 10,
      "title": "I Remember You",
      "hookPhrase": "I Remember You",
      "songRole": "soft reset before the closing run",
      "tempo": 101,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, melodic walking bass, clear intimate vocal, light acoustic pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "clean electric guitar arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "eg_clean_arp",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "12-string electric guitar",
        "melodic walking bass",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-handwritten-recipe",
      "lyricThemeText": "following a handwritten recipe card with faded ink while soup starts to simmer",
      "lyricThemeArc": "missing someone through a practical ritual, then feeling them near",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalVariantText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 11,
      "title": "Old Heart",
      "hookPhrase": "Don't Go, Old Heart",
      "songRole": "memory-focused late track",
      "tempo": 110,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft slide-guitar swell intro texture (INTRO ONLY)",
      "introTextureId": "eg_slide_swell",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "strummed acoustic guitar",
        "light mandolin texture"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-paper-calendar-date",
      "lyricThemeText": "marking a date on a paper calendar and noticing older circles from years before",
      "lyricThemeArc": "time passing into a gentle promise to continue",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 12,
      "title": "I Know You're Near",
      "hookPhrase": "I Know You're Near",
      "songRole": "comforting closer",
      "tempo": 106,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers, natural acoustic warmth",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm Rhodes electric piano riff intro texture (INTRO ONLY)",
      "introTextureId": "ep_rhodes_riff",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "canon",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light mandolin texture",
        "strummed acoustic guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-riverside-bench",
      "lyricThemeText": "resting on a riverside bench with a thermos while cyclists pass quietly behind",
      "lyricThemeArc": "restless thoughts easing into steady breathing",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalVariantText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 13,
      "title": "Breathe with Me, Morning",
      "hookPhrase": "Breathe with Me, Morning",
      "songRole": "comforting closer",
      "tempo": 63,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, clear intimate vocal, natural acoustic room",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "glassy electric piano chord intro texture (INTRO ONLY)",
      "introTextureId": "ep_glass_chords",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-bookshop-rain",
      "lyricThemeText": "standing under the awning of a used bookshop while rain taps a paper shopping bag",
      "lyricThemeArc": "unexpected pause becoming a small gift",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalVariantText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 14,
      "title": "I'm Coming Home",
      "hookPhrase": "I'm Coming Home",
      "songRole": "comforting closer",
      "tempo": 112,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, strummed folk-pop pulse, natural acoustic warmth, melodic walking bass",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "light pizzicato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_pizz",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "default",
      "instrumentSet": [
        "12-string electric guitar",
        "tambourine backbeat",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-laundry-sunline",
      "lyricThemeText": "pinning laundry on a sunlit line and hearing a distant radio through an open door",
      "lyricThemeArc": "plain chores turning into a peaceful morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalVariantText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 15,
      "title": "Photo & Velvet",
      "hookPhrase": "Hold the Photo Close",
      "songRole": "comforting closer",
      "tempo": 85,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm string pad swell intro texture (INTRO ONLY)",
      "introTextureId": "str_warm_pad",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "strummed acoustic guitar",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-old-radio-request",
      "lyricThemeText": "writing a radio request postcard at the table while the kettle clicks off",
      "lyricThemeArc": "hesitation becoming a quiet wish sent outward",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalVariantText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 16,
      "title": "I Still Believe",
      "hookPhrase": "I Still Believe",
      "songRole": "comforting closer",
      "tempo": 71,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers, bright British-beat studio mix",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "short melodic string counterline intro texture (INTRO ONLY)",
      "introTextureId": "str_counterline",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light mandolin texture",
        "strummed acoustic guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-window-plant-new-leaf",
      "lyricThemeText": "noticing a new leaf on the window plant while watering it before breakfast",
      "lyricThemeArc": "small surprise turning into renewed hope",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalVariantText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 17,
      "title": "Wake Up & Velvet",
      "hookPhrase": "Wake Up, My Dear",
      "songRole": "comforting closer",
      "tempo": 95,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, natural acoustic room, warm radio compression",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "bouncy spiccato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_spiccato",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "moneyChordId": "canon",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-post-office-parcel",
      "lyricThemeText": "wrapping a small parcel with brown paper and string before walking it to the post office counter",
      "lyricThemeArc": "quiet effort turning into a warm sense of reaching someone far away",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalVariantText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 18,
      "title": "Love",
      "hookPhrase": "Hush Now, My Love",
      "songRole": "comforting closer",
      "tempo": 83,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-warm-morning-glow",
      "genreText": "timeless warm morning pop, natural acoustic room, light acoustic pulse, natural acoustic warmth",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, busy percussion, bright harsh top end, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "rounded trombone swell intro texture (INTRO ONLY)",
      "introTextureId": "br_trombone_swell",
      "hookDeviceText": "final repeat of the hook sung almost a cappella as the outro tag",
      "hookDeviceId": "acappella-tag",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "acoustic guitar arpeggio",
        "fingerpicked acoustic guitar",
        "minimal light percussion"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-evening-newspaper-lamp",
      "lyricThemeText": "reading the evening newspaper under a warm desk lamp while the house settles into quiet",
      "lyricThemeArc": "the day's noise fading into an unhurried, contented stillness",
      "pov": "firstPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalVariantText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalGender": "duet",
      "vocalType": "mixed"
    }
  ],
  "adjustables": [
    {
      "axis": "genre",
      "labelKo": "장르",
      "current": [
        {
          "id": "oldpop-british-beat",
          "count": 5
        },
        {
          "id": "folk-pop",
          "count": 5
        },
        {
          "id": "acoustic-pop",
          "count": 4
        },
        {
          "id": "oldpop-soft-rock-am",
          "count": 3
        },
        {
          "id": "oldpop-warm-morning-glow",
          "count": 1
        }
      ],
      "alternatives": [
        {
          "id": "oldpop-adult-contemporary-80s",
          "labelKo": "80s Warm Adult Contemporary",
          "whyKo": "채널 기본 장르, 키워드 oldpop"
        },
        {
          "id": "oldpop-piano-ballad-70s",
          "labelKo": "70s Piano Pop Ballad",
          "whyKo": "채널 기본 장르, 키워드 oldpop"
        },
        {
          "id": "oldpop-close-harmony-duo",
          "labelKo": "70s Close Harmony Duo",
          "whyKo": "채널 기본 장르, 키워드 oldpop"
        },
        {
          "id": "oldpop-motown-pop-soul",
          "labelKo": "Motown Pop Soul",
          "whyKo": "채널 기본 장르, 키워드 oldpop"
        },
        {
          "id": "oldpop-sunshine-pop",
          "labelKo": "Sunshine Pop",
          "whyKo": "키워드 oldpop, 올드팝 계열"
        },
        {
          "id": "oldpop-doowop-harmony",
          "labelKo": "Doo-Wop Close Harmony",
          "whyKo": "키워드 oldpop, 올드팝 계열"
        }
      ]
    },
    {
      "axis": "vocalType",
      "labelKo": "보컬",
      "current": [
        {
          "id": "male",
          "count": 6
        },
        {
          "id": "female",
          "count": 6
        },
        {
          "id": "mixed",
          "count": 6
        }
      ],
      "alternatives": []
    },
    {
      "axis": "introTexture",
      "labelKo": "인트로 질감 그룹",
      "current": [
        {
          "id": "ag_finger",
          "count": 2
        },
        {
          "id": "ag_harmonics",
          "count": 2
        },
        {
          "id": "ag_muted_strum",
          "count": 2
        },
        {
          "id": "ag_nylon_waltz",
          "count": 2
        },
        {
          "id": "eg_tremolo",
          "count": 1
        },
        {
          "id": "eg_clean_arp",
          "count": 1
        },
        {
          "id": "eg_slide_swell",
          "count": 1
        },
        {
          "id": "ep_rhodes_riff",
          "count": 1
        },
        {
          "id": "ep_glass_chords",
          "count": 1
        },
        {
          "id": "str_pizz",
          "count": 1
        },
        {
          "id": "str_warm_pad",
          "count": 1
        },
        {
          "id": "str_counterline",
          "count": 1
        },
        {
          "id": "str_spiccato",
          "count": 1
        },
        {
          "id": "br_trombone_swell",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "hookDevice",
      "labelKo": "훅 장치 그룹",
      "current": [
        {
          "id": "prechorus-dropout",
          "count": 2
        },
        {
          "id": "stop-time",
          "count": 2
        },
        {
          "id": "octave-lift",
          "count": 2
        },
        {
          "id": "key-lift",
          "count": 2
        },
        {
          "id": "answer-riff",
          "count": 2
        },
        {
          "id": "double-hook",
          "count": 2
        },
        {
          "id": "half-time-chorus",
          "count": 2
        },
        {
          "id": "build-fill",
          "count": 2
        },
        {
          "id": "bridge-breakdown",
          "count": 1
        },
        {
          "id": "acappella-tag",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "arrangementDensity",
      "labelKo": "편곡 밀도",
      "current": [
        {
          "id": "sparse",
          "count": 6
        },
        {
          "id": "medium",
          "count": 6
        },
        {
          "id": "full",
          "count": 6
        }
      ],
      "alternatives": []
    },
    {
      "axis": "structureTemplate",
      "labelKo": "구조",
      "current": [
        {
          "id": "T1",
          "count": 4
        },
        {
          "id": "T2",
          "count": 4
        },
        {
          "id": "T3",
          "count": 4
        },
        {
          "id": "T4",
          "count": 3
        },
        {
          "id": "T5",
          "count": 3
        }
      ],
      "alternatives": []
    },
    {
      "axis": "lyricTheme",
      "labelKo": "가사 장면",
      "current": [
        {
          "id": "senior-morning-coffee-first-light",
          "count": 1
        },
        {
          "id": "senior-old-letter-after-breakfast",
          "count": 1
        },
        {
          "id": "senior-kitchen-radio-tea",
          "count": 1
        },
        {
          "id": "senior-garden-dew-walk",
          "count": 1
        },
        {
          "id": "senior-market-bus-window",
          "count": 1
        },
        {
          "id": "senior-family-photo-album",
          "count": 1
        },
        {
          "id": "senior-wool-cardigan-chair",
          "count": 1
        },
        {
          "id": "senior-porch-tea-sunset",
          "count": 1
        },
        {
          "id": "senior-train-platform-reunion",
          "count": 1
        },
        {
          "id": "senior-handwritten-recipe",
          "count": 1
        },
        {
          "id": "senior-paper-calendar-date",
          "count": 1
        },
        {
          "id": "senior-riverside-bench",
          "count": 1
        },
        {
          "id": "senior-bookshop-rain",
          "count": 1
        },
        {
          "id": "senior-laundry-sunline",
          "count": 1
        },
        {
          "id": "senior-old-radio-request",
          "count": 1
        },
        {
          "id": "senior-window-plant-new-leaf",
          "count": 1
        },
        {
          "id": "senior-post-office-parcel",
          "count": 1
        },
        {
          "id": "senior-evening-newspaper-lamp",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "pov",
      "labelKo": "시점",
      "current": [
        {
          "id": "firstPerson",
          "count": 15
        },
        {
          "id": "secondPerson",
          "count": 2
        },
        {
          "id": "thirdPerson",
          "count": 1
        }
      ],
      "alternatives": []
    }
  ],
  "warnings": [
    "arrangementDensity는 내부 값이 3종뿐이라 슬롯 값 기준으로는 5곡 초과가 발생합니다. 브릿지 다양성 그룹에서 5곡 이하 하위 그룹으로 분할합니다."
  ]
}
```

### 1-2. 아바나 카펜터스 같은 따뜻한 노래
```json
{
  "interpretation": {
    "intentKo": "\"아바나 카펜터스 같은 따뜻한 노래\" 입력을 early-1970s soft adult-contemporary pop, late-1970s European disco pop, 1970s soft pop / AM radio 중심의 Baroque Pop, 70s Soft Rock AM Gold, 70s Close Harmony Duo, 70s Europop Glow 세트로 해석했습니다.",
    "eraFocus": [
      "early-1970s soft adult-contemporary pop",
      "late-1970s European disco pop",
      "1970s soft pop / AM radio"
    ],
    "artistReferences": [
      {
        "matchedSurface": "카펜터스",
        "eraTag": "early-1970s soft adult-contemporary pop",
        "instrumentation": [
          "lush orchestral strings",
          "soft electric piano",
          "warm upright bass",
          "brushed drum kit"
        ],
        "harmonyTraits": [
          "rich extended major-seventh chords",
          "gentle key change into the final chorus"
        ],
        "rhythmTraits": [
          "unhurried mid-tempo ballad pulse",
          "no syncopation, straight quarter-note feel"
        ],
        "productionTraits": [
          "warm close-mic vocal-forward mix",
          "smooth analog tape warmth",
          "gentle string swell under the chorus"
        ],
        "vocalTraits": [
          "low warm contralto female lead",
          "soft breath control",
          "close vocal stacked harmonies"
        ],
        "suggestedGenreIds": [
          "oldpop-baroque-pop",
          "oldpop-soft-rock-am",
          "oldpop-close-harmony-duo"
        ],
        "excludeAdditions": [
          "famous duo imitation",
          "soundalike vocals"
        ]
      },
      {
        "matchedSurface": "아바",
        "eraTag": "late-1970s European disco pop",
        "instrumentation": [
          "bright analog synth pad",
          "four-on-the-floor bass",
          "strummed acoustic guitar layered under synths",
          "orchestral string stabs"
        ],
        "harmonyTraits": [
          "major-key anthemic chorus lift",
          "minor-to-major verse-to-chorus shift"
        ],
        "rhythmTraits": [
          "steady four-on-the-floor disco pulse",
          "syncopated bass movement"
        ],
        "productionTraits": [
          "bright polished stereo-wide mix",
          "layered vocal doubling"
        ],
        "vocalTraits": [
          "male and female vocals in close harmony",
          "bright open female lead",
          "stacked chorus harmony"
        ],
        "suggestedGenreIds": [
          "oldpop-europop-glow",
          "oldpop-close-harmony-duo",
          "oldpop-orchestral-easy"
        ],
        "excludeAdditions": [
          "famous group imitation",
          "soundalike vocals"
        ]
      }
    ],
    "audienceProfileId": "senior-morning",
    "reasoningKo": [
      "장르 후보는 core/extended 구분 없이 320종 전체에서 보되, senior-morning 채널에 맞는 후보로 1차 필터했습니다.",
      "5개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.",
      "보컬은 남성/여성/듀엣 축을 균등 배분하고, 구조 템플릿은 5종을 순환시켰습니다.",
      "인트로/훅 장치/밀도는 문구가 아니라 그룹 제약으로 브릿지에 전달합니다."
    ]
  },
  "allocations": [
    {
      "axis": "genre",
      "mode": "manual",
      "counts": {
        "oldpop-baroque-pop": 5,
        "oldpop-soft-rock-am": 5,
        "oldpop-close-harmony-duo": 4,
        "oldpop-europop-glow": 3,
        "oldpop-orchestral-easy": 1
      }
    },
    {
      "axis": "vocalType",
      "mode": "manual",
      "counts": {
        "male": 6,
        "female": 6,
        "mixed": 6
      }
    },
    {
      "axis": "introTexture",
      "mode": "manual",
      "counts": {
        "ag_finger": 2,
        "ag_harmonics": 2,
        "ag_muted_strum": 2,
        "ag_nylon_waltz": 2,
        "eg_tremolo": 1,
        "eg_clean_arp": 1,
        "eg_slide_swell": 1,
        "ep_rhodes_riff": 1,
        "ep_glass_chords": 1,
        "str_pizz": 1,
        "str_warm_pad": 1,
        "str_counterline": 1,
        "str_spiccato": 1,
        "br_trombone_swell": 1
      }
    },
    {
      "axis": "hookDevice",
      "mode": "manual",
      "counts": {
        "prechorus-dropout": 2,
        "stop-time": 2,
        "octave-lift": 2,
        "key-lift": 2,
        "answer-riff": 2,
        "double-hook": 2,
        "half-time-chorus": 2,
        "build-fill": 2,
        "bridge-breakdown": 1,
        "acappella-tag": 1
      }
    },
    {
      "axis": "arrangementDensity",
      "mode": "manual",
      "counts": {
        "sparse": 6,
        "medium": 6,
        "full": 6
      }
    },
    {
      "axis": "structureTemplate",
      "mode": "manual",
      "counts": {
        "T1": 4,
        "T2": 4,
        "T3": 4,
        "T4": 3,
        "T5": 3
      }
    },
    {
      "axis": "lyricTheme",
      "mode": "manual",
      "counts": {
        "senior-morning-coffee-first-light": 1,
        "senior-old-letter-after-breakfast": 1,
        "senior-kitchen-radio-tea": 1,
        "senior-garden-dew-walk": 1,
        "senior-market-bus-window": 1,
        "senior-family-photo-album": 1,
        "senior-wool-cardigan-chair": 1,
        "senior-porch-tea-sunset": 1,
        "senior-train-platform-reunion": 1,
        "senior-handwritten-recipe": 1,
        "senior-paper-calendar-date": 1,
        "senior-riverside-bench": 1,
        "senior-bookshop-rain": 1,
        "senior-laundry-sunline": 1,
        "senior-old-radio-request": 1,
        "senior-window-plant-new-leaf": 1,
        "senior-post-office-parcel": 1,
        "senior-evening-newspaper-lamp": 1
      }
    },
    {
      "axis": "pov",
      "mode": "manual",
      "counts": {
        "firstPerson": 15,
        "secondPerson": 2,
        "thirdPerson": 1
      }
    }
  ],
  "slots": [
    {
      "trackNo": 1,
      "title": "We Made It Through",
      "hookPhrase": "We Made It Through",
      "songRole": "cold-open",
      "tempo": 99,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-baroque-pop",
      "genreText": "mid-1960s baroque pop, polished middle-of-the-road easy-listening mix, warm AM-radio compression",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "string quartet",
        "clean electric guitar arpeggios"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-morning-coffee-first-light",
      "lyricThemeText": "sitting with morning coffee before the day begins, watching first light move across the table",
      "lyricThemeArc": "sleepy heaviness opening into steady comfort",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalVariantText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 2,
      "title": "Hush Now, My Love",
      "hookPhrase": "Hush Now, My Love",
      "songRole": "flagship",
      "tempo": 95,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, slow rubato easing into a gentle 4/4, gentle chamber-pop pulse, classically-inflected lead vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, orchestral bombast, harsh string tone, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "default",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass",
        "string quartet"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-old-letter-after-breakfast",
      "lyricThemeText": "finding an old folded letter after breakfast and reading it beside a quiet window",
      "lyricThemeArc": "private ache softening into gratitude",
      "pov": "firstPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalVariantText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 3,
      "title": "Hold On, My Friend",
      "hookPhrase": "Hold On, My Friend",
      "songRole": "flagship",
      "tempo": 99,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-baroque-pop",
      "genreText": "mid-1960s baroque pop, string-quartet chamber texture, relaxed soft-rock eighth-note pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "string quartet",
        "flugelhorn"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-kitchen-radio-tea",
      "lyricThemeText": "making tea in a small kitchen while an old radio plays low in the corner",
      "lyricThemeArc": "ordinary routine becoming a warm companion",
      "pov": "secondPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 4,
      "title": "Turn the Page Slowly",
      "hookPhrase": "Turn the Page Slowly",
      "songRole": "brighter sing-along track",
      "tempo": 112,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, warm orchestral-backed lead vocal, slow rubato easing into a gentle 4/4, polished middle-of-the-road easy-listening mix",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, orchestral bombast, harsh string tone, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "soft kick drum",
        "string quartet"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-garden-dew-walk",
      "lyricThemeText": "walking slowly through a small garden with dew on the leaves and slippers on the path",
      "lyricThemeArc": "quiet worry settling into a clear breath",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 5,
      "title": "Stay with Me Tonight",
      "hookPhrase": "Stay with Me Tonight",
      "songRole": "quiet middle scene",
      "tempo": 91,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "oldpop-close-harmony-duo",
      "genreText": "1970s close-harmony duo pop, gentle chamber-pop pulse, relaxed soft-rock eighth-note pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, oversized production, competing lead vocals, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "canon",
      "instrumentSet": [
        "acoustic guitar",
        "restrained brushed drums"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-market-bus-window",
      "lyricThemeText": "riding the bus home from the morning market with a paper bag resting on the knees",
      "lyricThemeArc": "tired body finding a small lift",
      "pov": "firstPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalVariantText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 6,
      "title": "Hand Friend & Echo",
      "hookPhrase": "Hold My Hand, Friend",
      "songRole": "romantic shade without melodrama",
      "tempo": 81,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-baroque-pop",
      "genreText": "mid-1960s baroque pop, smooth adult tenor lead, relaxed soft-rock eighth-note pulse, warm orchestral-backed lead vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "string quartet",
        "nylon guitar",
        "oboe obbligato"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-family-photo-album",
      "lyricThemeText": "sorting a family photo album on the floor while afternoon dust shines in the room",
      "lyricThemeArc": "bittersweet remembering turning into a gentle smile",
      "pov": "secondPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalVariantText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 7,
      "title": "Pour the Coffee Warm",
      "hookPhrase": "Pour the Coffee Warm",
      "songRole": "seasonal detail track",
      "tempo": 112,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, polished middle-of-the-road easy-listening mix, classically-inflected lead vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, orchestral bombast, harsh string tone, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "default",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-wool-cardigan-chair",
      "lyricThemeText": "folding a worn wool cardigan over a familiar chair before opening the window",
      "lyricThemeArc": "small loneliness becoming practical tenderness",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 8,
      "title": "Don't Let Go of Me",
      "hookPhrase": "Don't Let Go of Me",
      "songRole": "late-set emotional center",
      "tempo": 98,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-close-harmony-duo",
      "genreText": "1970s close-harmony duo pop, classically-inflected lead vocal, smooth adult tenor lead, restrained acoustic backing",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, oversized production, competing lead vocals, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "acoustic guitar",
        "electric piano",
        "restrained brushed drums"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-porch-tea-sunset",
      "lyricThemeText": "drinking tea on the porch at sunset while neighbors close their gates one by one",
      "lyricThemeArc": "day-end fatigue resolving into calm acceptance",
      "pov": "firstPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalVariantText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 9,
      "title": "Play Old",
      "hookPhrase": "Play the Old Record",
      "songRole": "warm radio-friendly highlight",
      "tempo": 95,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "oldpop-europop-glow",
      "genreText": "mid-1970s Scandinavian europop, classically-inflected lead vocal, layered female harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, modern EDM synths, harsh digital brightness, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "arpeggiated synth",
        "acoustic piano"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-train-platform-reunion",
      "lyricThemeText": "waiting on a small train platform with a scarf in hand and a paper ticket in the pocket",
      "lyricThemeArc": "nervous anticipation becoming open warmth",
      "pov": "thirdPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 10,
      "title": "Light",
      "hookPhrase": "Keep the Light On",
      "songRole": "soft reset before the closing run",
      "tempo": 99,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "oldpop-baroque-pop",
      "genreText": "mid-1960s baroque pop, refined obbligato color, relaxed soft-rock eighth-note pulse, string-quartet chamber texture",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "clean electric guitar arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "eg_clean_arp",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "canon",
      "instrumentSet": [
        "string quartet",
        "oboe obbligato",
        "clean electric guitar arpeggios"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-handwritten-recipe",
      "lyricThemeText": "following a handwritten recipe card with faded ink while soup starts to simmer",
      "lyricThemeArc": "missing someone through a practical ritual, then feeling them near",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalVariantText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 11,
      "title": "I Still Hear Your Song",
      "hookPhrase": "I Still Hear Your Song",
      "songRole": "memory-focused late track",
      "tempo": 63,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, clean electric arpeggios, slow rubato easing into a gentle 4/4",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, orchestral bombast, harsh string tone, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft slide-guitar swell intro texture (INTRO ONLY)",
      "introTextureId": "eg_slide_swell",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-paper-calendar-date",
      "lyricThemeText": "marking a date on a paper calendar and noticing older circles from years before",
      "lyricThemeArc": "time passing into a gentle promise to continue",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalVariantText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 12,
      "title": "Eyes Winter",
      "hookPhrase": "Close Your Eyes, Winter",
      "songRole": "comforting closer",
      "tempo": 91,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-close-harmony-duo",
      "genreText": "1970s close-harmony duo pop, relaxed soft-rock eighth-note pulse, gentle chamber-pop pulse, intimate two-voice blend",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, oversized production, competing lead vocals, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm Rhodes electric piano riff intro texture (INTRO ONLY)",
      "introTextureId": "ep_rhodes_riff",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "default",
      "instrumentSet": [
        "acoustic guitar",
        "restrained brushed drums",
        "upright bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-riverside-bench",
      "lyricThemeText": "resting on a riverside bench with a thermos while cyclists pass quietly behind",
      "lyricThemeArc": "restless thoughts easing into steady breathing",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 13,
      "title": "I Won't Forget",
      "hookPhrase": "I Won't Forget",
      "songRole": "comforting closer",
      "tempo": 68,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-europop-glow",
      "genreText": "mid-1970s Scandinavian europop, layered female harmony, bright unison chorus lift",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, modern EDM synths, harsh digital brightness, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "glassy electric piano chord intro texture (INTRO ONLY)",
      "introTextureId": "ep_glass_chords",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "arpeggiated synth",
        "layered female harmony vocals"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-bookshop-rain",
      "lyricThemeText": "standing under the awning of a used bookshop while rain taps a paper shopping bag",
      "lyricThemeArc": "unexpected pause becoming a small gift",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalVariantText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 14,
      "title": "Morning & Glow",
      "hookPhrase": "I'll Wait for Morning",
      "songRole": "comforting closer",
      "tempo": 109,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "oldpop-orchestral-easy",
      "genreText": "1970s orchestral easy listening, strings carrying the melody, MOR lounge polish, smooth adult tenor lead",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, big-band brashness, uptempo swing, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "light pizzicato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_pizz",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "string section",
        "string quartet",
        "concert harp"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-laundry-sunline",
      "lyricThemeText": "pinning laundry on a sunlit line and hearing a distant radio through an open door",
      "lyricThemeArc": "plain chores turning into a peaceful morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalVariantText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 15,
      "title": "You're Still Here",
      "hookPhrase": "You're Still Here",
      "songRole": "comforting closer",
      "tempo": 81,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "oldpop-baroque-pop",
      "genreText": "mid-1960s baroque pop, refined obbligato color, relaxed soft-rock eighth-note pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm string pad swell intro texture (INTRO ONLY)",
      "introTextureId": "str_warm_pad",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "canon",
      "instrumentSet": [
        "string quartet",
        "oboe obbligato"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-old-radio-request",
      "lyricThemeText": "writing a radio request postcard at the table while the kettle clicks off",
      "lyricThemeArc": "hesitation becoming a quiet wish sent outward",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalVariantText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 16,
      "title": "I Still Believe",
      "hookPhrase": "I Still Believe",
      "songRole": "comforting closer",
      "tempo": 112,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, clean electric arpeggios, warm radio compression, restrained",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, orchestral bombast, harsh string tone, big-band brashness, uptempo swing, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "short melodic string counterline intro texture (INTRO ONLY)",
      "introTextureId": "str_counterline",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass",
        "soft kick drum"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-window-plant-new-leaf",
      "lyricThemeText": "noticing a new leaf on the window plant while watering it before breakfast",
      "lyricThemeArc": "small surprise turning into renewed hope",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalVariantText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 17,
      "title": "Light Candle",
      "hookPhrase": "Light the Candle Again",
      "songRole": "comforting closer",
      "tempo": 91,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-close-harmony-duo",
      "genreText": "1970s close-harmony duo pop, smooth adult tenor lead, relaxed soft-rock eighth-note pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, oversized production, competing lead vocals, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "bouncy spiccato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_spiccato",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "moneyChordId": "default",
      "instrumentSet": [
        "acoustic guitar",
        "string quartet"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-post-office-parcel",
      "lyricThemeText": "wrapping a small parcel with brown paper and string before walking it to the post office counter",
      "lyricThemeArc": "quiet effort turning into a warm sense of reaching someone far away",
      "pov": "firstPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalVariantText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 18,
      "title": "Wrap the Old Sweater",
      "hookPhrase": "Wrap the Old Sweater",
      "songRole": "comforting closer",
      "tempo": 68,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-europop-glow",
      "genreText": "mid-1970s Scandinavian europop, bright unison chorus lift, layered female harmony, classically-inflected lead vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, modern EDM synths, harsh digital brightness, orchestral bombast, harsh string tone, arena-rock distortion, modern loudness, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "rounded trombone swell intro texture (INTRO ONLY)",
      "introTextureId": "br_trombone_swell",
      "hookDeviceText": "final repeat of the hook sung almost a cappella as the outro tag",
      "hookDeviceId": "acappella-tag",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "arpeggiated synth",
        "acoustic piano",
        "layered female harmony vocals"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-evening-newspaper-lamp",
      "lyricThemeText": "reading the evening newspaper under a warm desk lamp while the house settles into quiet",
      "lyricThemeArc": "the day's noise fading into an unhurried, contented stillness",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalVariantText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalGender": "duet",
      "vocalType": "mixed"
    }
  ],
  "adjustables": [
    {
      "axis": "genre",
      "labelKo": "장르",
      "current": [
        {
          "id": "oldpop-baroque-pop",
          "count": 5
        },
        {
          "id": "oldpop-soft-rock-am",
          "count": 5
        },
        {
          "id": "oldpop-close-harmony-duo",
          "count": 4
        },
        {
          "id": "oldpop-europop-glow",
          "count": 3
        },
        {
          "id": "oldpop-orchestral-easy",
          "count": 1
        }
      ],
      "alternatives": [
        {
          "id": "oldpop-doowop-harmony",
          "labelKo": "Doo-Wop Close Harmony",
          "whyKo": "따뜻한 1970s 소프트팝, 밝은 1970s 유럽 팝"
        },
        {
          "id": "adult-contemporary",
          "labelKo": "Adult Contemporary Pop",
          "whyKo": "채널 기본 장르, 따뜻한 1970s 소프트팝"
        },
        {
          "id": "oldpop-adult-contemporary-80s",
          "labelKo": "80s Warm Adult Contemporary",
          "whyKo": "채널 기본 장르, 따뜻한 1970s 소프트팝"
        },
        {
          "id": "soft-rock",
          "labelKo": "Soft Rock Radio",
          "whyKo": "따뜻한 1970s 소프트팝"
        },
        {
          "id": "oldpop-motown-pop-soul",
          "labelKo": "Motown Pop Soul",
          "whyKo": "채널 기본 장르, 시대 초점 일치"
        },
        {
          "id": "oldpop-piano-ballad-70s",
          "labelKo": "70s Piano Pop Ballad",
          "whyKo": "채널 기본 장르, 시대 초점 일치"
        }
      ]
    },
    {
      "axis": "vocalType",
      "labelKo": "보컬",
      "current": [
        {
          "id": "male",
          "count": 6
        },
        {
          "id": "female",
          "count": 6
        },
        {
          "id": "mixed",
          "count": 6
        }
      ],
      "alternatives": []
    },
    {
      "axis": "introTexture",
      "labelKo": "인트로 질감 그룹",
      "current": [
        {
          "id": "ag_finger",
          "count": 2
        },
        {
          "id": "ag_harmonics",
          "count": 2
        },
        {
          "id": "ag_muted_strum",
          "count": 2
        },
        {
          "id": "ag_nylon_waltz",
          "count": 2
        },
        {
          "id": "eg_tremolo",
          "count": 1
        },
        {
          "id": "eg_clean_arp",
          "count": 1
        },
        {
          "id": "eg_slide_swell",
          "count": 1
        },
        {
          "id": "ep_rhodes_riff",
          "count": 1
        },
        {
          "id": "ep_glass_chords",
          "count": 1
        },
        {
          "id": "str_pizz",
          "count": 1
        },
        {
          "id": "str_warm_pad",
          "count": 1
        },
        {
          "id": "str_counterline",
          "count": 1
        },
        {
          "id": "str_spiccato",
          "count": 1
        },
        {
          "id": "br_trombone_swell",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "hookDevice",
      "labelKo": "훅 장치 그룹",
      "current": [
        {
          "id": "prechorus-dropout",
          "count": 2
        },
        {
          "id": "stop-time",
          "count": 2
        },
        {
          "id": "octave-lift",
          "count": 2
        },
        {
          "id": "key-lift",
          "count": 2
        },
        {
          "id": "answer-riff",
          "count": 2
        },
        {
          "id": "double-hook",
          "count": 2
        },
        {
          "id": "half-time-chorus",
          "count": 2
        },
        {
          "id": "build-fill",
          "count": 2
        },
        {
          "id": "bridge-breakdown",
          "count": 1
        },
        {
          "id": "acappella-tag",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "arrangementDensity",
      "labelKo": "편곡 밀도",
      "current": [
        {
          "id": "sparse",
          "count": 6
        },
        {
          "id": "medium",
          "count": 6
        },
        {
          "id": "full",
          "count": 6
        }
      ],
      "alternatives": []
    },
    {
      "axis": "structureTemplate",
      "labelKo": "구조",
      "current": [
        {
          "id": "T1",
          "count": 4
        },
        {
          "id": "T2",
          "count": 4
        },
        {
          "id": "T3",
          "count": 4
        },
        {
          "id": "T4",
          "count": 3
        },
        {
          "id": "T5",
          "count": 3
        }
      ],
      "alternatives": []
    },
    {
      "axis": "lyricTheme",
      "labelKo": "가사 장면",
      "current": [
        {
          "id": "senior-morning-coffee-first-light",
          "count": 1
        },
        {
          "id": "senior-old-letter-after-breakfast",
          "count": 1
        },
        {
          "id": "senior-kitchen-radio-tea",
          "count": 1
        },
        {
          "id": "senior-garden-dew-walk",
          "count": 1
        },
        {
          "id": "senior-market-bus-window",
          "count": 1
        },
        {
          "id": "senior-family-photo-album",
          "count": 1
        },
        {
          "id": "senior-wool-cardigan-chair",
          "count": 1
        },
        {
          "id": "senior-porch-tea-sunset",
          "count": 1
        },
        {
          "id": "senior-train-platform-reunion",
          "count": 1
        },
        {
          "id": "senior-handwritten-recipe",
          "count": 1
        },
        {
          "id": "senior-paper-calendar-date",
          "count": 1
        },
        {
          "id": "senior-riverside-bench",
          "count": 1
        },
        {
          "id": "senior-bookshop-rain",
          "count": 1
        },
        {
          "id": "senior-laundry-sunline",
          "count": 1
        },
        {
          "id": "senior-old-radio-request",
          "count": 1
        },
        {
          "id": "senior-window-plant-new-leaf",
          "count": 1
        },
        {
          "id": "senior-post-office-parcel",
          "count": 1
        },
        {
          "id": "senior-evening-newspaper-lamp",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "pov",
      "labelKo": "시점",
      "current": [
        {
          "id": "firstPerson",
          "count": 15
        },
        {
          "id": "secondPerson",
          "count": 2
        },
        {
          "id": "thirdPerson",
          "count": 1
        }
      ],
      "alternatives": []
    }
  ],
  "warnings": [
    "arrangementDensity는 내부 값이 3종뿐이라 슬롯 값 기준으로는 5곡 초과가 발생합니다. 브릿지 다양성 그룹에서 5곡 이하 하위 그룹으로 분할합니다."
  ]
}
```

### 1-3. 샹송이랑 재즈 섞어서 잔잔하게
```json
{
  "interpretation": {
    "intentKo": "\"샹송이랑 재즈 섞어서 잔잔하게\" 입력을 mid-century chanson, classic jazz lounge 중심의 Chanson Cafe, Acoustic Jazz Pop, Smooth Jazz Lounge, Standards Torch Song 세트로 해석했습니다.",
    "eraFocus": [
      "mid-century chanson",
      "classic jazz lounge"
    ],
    "artistReferences": [],
    "audienceProfileId": "senior-morning",
    "reasoningKo": [
      "장르 후보는 core/extended 구분 없이 320종 전체에서 보되, senior-morning 채널에 맞는 후보로 1차 필터했습니다.",
      "5개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.",
      "보컬은 남성/여성/듀엣 축을 균등 배분하고, 구조 템플릿은 5종을 순환시켰습니다.",
      "인트로/훅 장치/밀도는 문구가 아니라 그룹 제약으로 브릿지에 전달합니다."
    ]
  },
  "allocations": [
    {
      "axis": "genre",
      "mode": "manual",
      "counts": {
        "chanson": 5,
        "jazz-pop": 5,
        "smooth-jazz-lounge": 4,
        "oldpop-standards-torch": 3,
        "bossa-cafe": 1
      }
    },
    {
      "axis": "vocalType",
      "mode": "manual",
      "counts": {
        "male": 6,
        "female": 6,
        "mixed": 6
      }
    },
    {
      "axis": "introTexture",
      "mode": "manual",
      "counts": {
        "ag_finger": 2,
        "ag_harmonics": 2,
        "ag_muted_strum": 2,
        "ag_nylon_waltz": 2,
        "eg_tremolo": 1,
        "eg_clean_arp": 1,
        "eg_slide_swell": 1,
        "ep_rhodes_riff": 1,
        "ep_glass_chords": 1,
        "str_pizz": 1,
        "str_warm_pad": 1,
        "str_counterline": 1,
        "str_spiccato": 1,
        "br_trombone_swell": 1
      }
    },
    {
      "axis": "hookDevice",
      "mode": "manual",
      "counts": {
        "prechorus-dropout": 2,
        "stop-time": 2,
        "octave-lift": 2,
        "key-lift": 2,
        "answer-riff": 2,
        "double-hook": 2,
        "half-time-chorus": 2,
        "build-fill": 2,
        "bridge-breakdown": 1,
        "acappella-tag": 1
      }
    },
    {
      "axis": "arrangementDensity",
      "mode": "manual",
      "counts": {
        "sparse": 6,
        "medium": 6,
        "full": 6
      }
    },
    {
      "axis": "structureTemplate",
      "mode": "manual",
      "counts": {
        "T1": 4,
        "T2": 4,
        "T3": 4,
        "T4": 3,
        "T5": 3
      }
    },
    {
      "axis": "lyricTheme",
      "mode": "manual",
      "counts": {
        "senior-morning-coffee-first-light": 1,
        "senior-old-letter-after-breakfast": 1,
        "senior-kitchen-radio-tea": 1,
        "senior-garden-dew-walk": 1,
        "senior-market-bus-window": 1,
        "senior-family-photo-album": 1,
        "senior-wool-cardigan-chair": 1,
        "senior-porch-tea-sunset": 1,
        "senior-train-platform-reunion": 1,
        "senior-handwritten-recipe": 1,
        "senior-paper-calendar-date": 1,
        "senior-riverside-bench": 1,
        "senior-bookshop-rain": 1,
        "senior-laundry-sunline": 1,
        "senior-old-radio-request": 1,
        "senior-window-plant-new-leaf": 1,
        "senior-post-office-parcel": 1,
        "senior-evening-newspaper-lamp": 1
      }
    },
    {
      "axis": "pov",
      "mode": "manual",
      "counts": {
        "firstPerson": 15,
        "secondPerson": 2,
        "thirdPerson": 1
      }
    }
  ],
  "slots": [
    {
      "trackNo": 1,
      "title": "Light Candle",
      "hookPhrase": "Light the Candle Again",
      "songRole": "cold-open",
      "tempo": 102,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "chanson",
      "genreText": "French chanson cafe pop, light swing feel, elegant vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, upbeat cabaret parody, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "musette accordion",
        "nylon guitar"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-morning-coffee-first-light",
      "lyricThemeText": "sitting with morning coffee before the day begins, watching first light move across the table",
      "lyricThemeArc": "sleepy heaviness opening into steady comfort",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 2,
      "title": "You're Still Here",
      "hookPhrase": "You're Still Here",
      "songRole": "flagship",
      "tempo": 89,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "jazz-pop",
      "genreText": "nostalgic acoustic jazz-pop, light swing feel, walking upright bass, intimate close-mic vocal",
      "signatureSound": "light swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised piano or saxophone solo in the bridge, warm analog room tone",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, flat straight pop, showy solo clutter, tourist-lounge cliche, upbeat cabaret parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "Rhodes comping piano",
        "nylon guitar",
        "mellow jazz guitar"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-old-letter-after-breakfast",
      "lyricThemeText": "finding an old folded letter after breakfast and reading it beside a quiet window",
      "lyricThemeArc": "private ache softening into gratitude",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 3,
      "title": "Alright",
      "hookPhrase": "We'll Be Alright",
      "songRole": "flagship",
      "tempo": 82,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "chanson",
      "genreText": "French chanson cafe pop, warm cafe vocal, minor-key melancholy",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, upbeat cabaret parody, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "canon",
      "instrumentSet": [
        "musette accordion",
        "upright bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-kitchen-radio-tea",
      "lyricThemeText": "making tea in a small kitchen while an old radio plays low in the corner",
      "lyricThemeArc": "ordinary routine becoming a warm companion",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalVariantText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 4,
      "title": "Wake Up",
      "hookPhrase": "Wake Up, My Dear",
      "songRole": "brighter sing-along track",
      "tempo": 109,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "jazz-pop",
      "genreText": "nostalgic acoustic jazz-pop, light swing feel, walking upright bass, gentle maj7 and add9 colors",
      "signatureSound": "light swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised piano or saxophone solo in the bridge, warm analog room tone",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, flat straight pop, showy solo clutter, tourist-lounge cliche, upbeat cabaret parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "Rhodes comping piano",
        "nylon guitar",
        "walking upright bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-garden-dew-walk",
      "lyricThemeText": "walking slowly through a small garden with dew on the leaves and slippers on the path",
      "lyricThemeArc": "quiet worry settling into a clear breath",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalVariantText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 5,
      "title": "Catch Morning",
      "hookPhrase": "Catch the Morning Train",
      "songRole": "quiet middle scene",
      "tempo": 65,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "smooth-jazz-lounge",
      "genreText": "smooth jazz lounge, light swing feel, soft bossa syncopation",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, bebop-fast tempo, harsh saxophone tone, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "default",
      "instrumentSet": [
        "vibraphone",
        "Rhodes comping piano"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-market-bus-window",
      "lyricThemeText": "riding the bus home from the morning market with a paper bag resting on the knees",
      "lyricThemeArc": "tired body finding a small lift",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalVariantText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 6,
      "title": "Breathe with Me, Morning",
      "hookPhrase": "Breathe with Me, Morning",
      "songRole": "romantic shade without melodrama",
      "tempo": 94,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-standards-torch",
      "genreText": "jazz-standard torch song, warm cafe vocal, crooner delivery, soft bossa syncopation",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, bebop-fast tempo, scat improvisation clutter, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "double bass",
        "piano",
        "Rhodes comping piano"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-family-photo-album",
      "lyricThemeText": "sorting a family photo album on the floor while afternoon dust shines in the room",
      "lyricThemeArc": "bittersweet remembering turning into a gentle smile",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalVariantText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 7,
      "title": "I Remember You",
      "hookPhrase": "I Remember You",
      "songRole": "seasonal detail track",
      "tempo": 102,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "chanson",
      "genreText": "French chanson cafe pop, warm analog room tone, soft bossa syncopation",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, upbeat cabaret parody, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "musette accordion",
        "upright bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-wool-cardigan-chair",
      "lyricThemeText": "folding a worn wool cardigan over a familiar chair before opening the window",
      "lyricThemeArc": "small loneliness becoming practical tenderness",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalVariantText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 8,
      "title": "Don't Let Go of Me",
      "hookPhrase": "Don't Let Go of Me",
      "songRole": "late-set emotional center",
      "tempo": 109,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "jazz-pop",
      "genreText": "nostalgic acoustic jazz-pop, light swing feel, walking upright bass, gentle maj7 and add9 colors",
      "signatureSound": "light swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised piano or saxophone solo in the bridge, warm analog room tone",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, flat straight pop, showy solo clutter, tourist-lounge cliche, upbeat cabaret parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "canon",
      "instrumentSet": [
        "Rhodes comping piano",
        "brushed snare with ride comping",
        "nylon guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-porch-tea-sunset",
      "lyricThemeText": "drinking tea on the porch at sunset while neighbors close their gates one by one",
      "lyricThemeArc": "day-end fatigue resolving into calm acceptance",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalVariantText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 9,
      "title": "I Found My Way",
      "hookPhrase": "I Found My Way",
      "songRole": "warm radio-friendly highlight",
      "tempo": 97,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "smooth-jazz-lounge",
      "genreText": "smooth jazz lounge, elegant vocal, vibraphone comping",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, bebop-fast tempo, harsh saxophone tone, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "vibraphone",
        "mellow saxophone"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-train-platform-reunion",
      "lyricThemeText": "waiting on a small train platform with a scarf in hand and a paper ticket in the pocket",
      "lyricThemeArc": "nervous anticipation becoming open warmth",
      "pov": "thirdPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 10,
      "title": "Coming Home & Velvet",
      "hookPhrase": "I'm Coming Home",
      "songRole": "soft reset before the closing run",
      "tempo": 94,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-standards-torch",
      "genreText": "jazz-standard torch song, warm analog room tone, crooner delivery, light swing feel",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, bebop-fast tempo, scat improvisation clutter, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "clean electric guitar arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "eg_clean_arp",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "default",
      "instrumentSet": [
        "double bass",
        "piano",
        "brushed drums"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-handwritten-recipe",
      "lyricThemeText": "following a handwritten recipe card with faded ink while soup starts to simmer",
      "lyricThemeArc": "missing someone through a practical ritual, then feeling them near",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 11,
      "title": "Turn the Page Slowly",
      "hookPhrase": "Turn the Page Slowly",
      "songRole": "memory-focused late track",
      "tempo": 76,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "chanson",
      "genreText": "French chanson cafe pop, musette accordion tremolo, warm cafe vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, upbeat cabaret parody, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft slide-guitar swell intro texture (INTRO ONLY)",
      "introTextureId": "eg_slide_swell",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "musette accordion",
        "upright bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-paper-calendar-date",
      "lyricThemeText": "marking a date on a paper calendar and noticing older circles from years before",
      "lyricThemeArc": "time passing into a gentle promise to continue",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalVariantText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 12,
      "title": "Eyes Winter",
      "hookPhrase": "Close Your Eyes, Winter",
      "songRole": "comforting closer",
      "tempo": 89,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "jazz-pop",
      "genreText": "nostalgic acoustic jazz-pop, light swing feel, walking upright bass, intimate close-mic vocal",
      "signatureSound": "light swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised piano or saxophone solo in the bridge, warm analog room tone",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, flat straight pop, showy solo clutter, tourist-lounge cliche, upbeat cabaret parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm Rhodes electric piano riff intro texture (INTRO ONLY)",
      "introTextureId": "ep_rhodes_riff",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "Rhodes comping piano",
        "brushed snare with ride comping",
        "walking upright bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-riverside-bench",
      "lyricThemeText": "resting on a riverside bench with a thermos while cyclists pass quietly behind",
      "lyricThemeArc": "restless thoughts easing into steady breathing",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 13,
      "title": "Love & Frost",
      "hookPhrase": "Rest Here, My Love",
      "songRole": "comforting closer",
      "tempo": 88,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "smooth-jazz-lounge",
      "genreText": "smooth jazz lounge, vibraphone comping, cocktail-lounge shuffle swing",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, bebop-fast tempo, harsh saxophone tone, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "glassy electric piano chord intro texture (INTRO ONLY)",
      "introTextureId": "ep_glass_chords",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "canon",
      "instrumentSet": [
        "vibraphone",
        "walking upright bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-bookshop-rain",
      "lyricThemeText": "standing under the awning of a used bookshop while rain taps a paper shopping bag",
      "lyricThemeArc": "unexpected pause becoming a small gift",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalVariantText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 14,
      "title": "Morning",
      "hookPhrase": "I'll Wait for Morning",
      "songRole": "comforting closer",
      "tempo": 91,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-standards-torch",
      "genreText": "jazz-standard torch song, soft bossa syncopation, warm cafe vocal, brushed swing",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, bebop-fast tempo, scat improvisation clutter, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "light pizzicato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_pizz",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "double bass",
        "piano",
        "Rhodes comping piano"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-laundry-sunline",
      "lyricThemeText": "pinning laundry on a sunlit line and hearing a distant radio through an open door",
      "lyricThemeArc": "plain chores turning into a peaceful morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalVariantText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 15,
      "title": "Coffee Warm & Ember",
      "hookPhrase": "Pour the Coffee Warm",
      "songRole": "comforting closer",
      "tempo": 107,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "bossa-cafe",
      "genreText": "soft bossa cafe pop, bossa nova clave, nylon-string guitar comping on offbeats",
      "signatureSound": "bossa nova clave, nylon-string guitar comping on offbeats, soft surdo-less percussion, gentle syncopation, Portuguese-jazz harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, tourist-lounge cliche, flat straight pop, showy solo clutter, upbeat cabaret parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm string pad swell intro texture (INTRO ONLY)",
      "introTextureId": "str_warm_pad",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "default",
      "instrumentSet": [
        "nylon guitar",
        "upright bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-old-radio-request",
      "lyricThemeText": "writing a radio request postcard at the table while the kettle clicks off",
      "lyricThemeArc": "hesitation becoming a quiet wish sent outward",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalVariantText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 16,
      "title": "Stay with Me Tonight",
      "hookPhrase": "Stay with Me Tonight",
      "songRole": "comforting closer",
      "tempo": 102,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "chanson",
      "genreText": "French chanson cafe pop, soft bossa syncopation, light swing feel, warm analog room tone",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, upbeat cabaret parody, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "short melodic string counterline intro texture (INTRO ONLY)",
      "introTextureId": "str_counterline",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "musette accordion",
        "upright bass",
        "nylon guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-window-plant-new-leaf",
      "lyricThemeText": "noticing a new leaf on the window plant while watering it before breakfast",
      "lyricThemeArc": "small surprise turning into renewed hope",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalVariantText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 17,
      "title": "Old Sweater & Hollow",
      "hookPhrase": "Wrap the Old Sweater",
      "songRole": "comforting closer",
      "tempo": 109,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "jazz-pop",
      "genreText": "nostalgic acoustic jazz-pop, light swing feel, walking upright bass",
      "signatureSound": "light swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised piano or saxophone solo in the bridge, warm analog room tone",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, flat straight pop, showy solo clutter, tourist-lounge cliche, upbeat cabaret parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "bouncy spiccato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_spiccato",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "Rhodes comping piano",
        "nylon guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-post-office-parcel",
      "lyricThemeText": "wrapping a small parcel with brown paper and string before walking it to the post office counter",
      "lyricThemeArc": "quiet effort turning into a warm sense of reaching someone far away",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalVariantText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 18,
      "title": "Window",
      "hookPhrase": "Wait by the Window",
      "songRole": "comforting closer",
      "tempo": 65,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "smooth-jazz-lounge",
      "genreText": "smooth jazz lounge, soft bossa syncopation, vibraphone comping, warm cafe vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, bebop-fast tempo, harsh saxophone tone, flat straight pop, showy solo clutter, tourist-lounge cliche, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "rounded trombone swell intro texture (INTRO ONLY)",
      "introTextureId": "br_trombone_swell",
      "hookDeviceText": "final repeat of the hook sung almost a cappella as the outro tag",
      "hookDeviceId": "acappella-tag",
      "moneyChordId": "canon",
      "instrumentSet": [
        "vibraphone",
        "brushed ride cymbal",
        "Rhodes comping piano"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-evening-newspaper-lamp",
      "lyricThemeText": "reading the evening newspaper under a warm desk lamp while the house settles into quiet",
      "lyricThemeArc": "the day's noise fading into an unhurried, contented stillness",
      "pov": "firstPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalVariantText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalGender": "duet",
      "vocalType": "mixed"
    }
  ],
  "adjustables": [
    {
      "axis": "genre",
      "labelKo": "장르",
      "current": [
        {
          "id": "chanson",
          "count": 5
        },
        {
          "id": "jazz-pop",
          "count": 5
        },
        {
          "id": "smooth-jazz-lounge",
          "count": 4
        },
        {
          "id": "oldpop-standards-torch",
          "count": 3
        },
        {
          "id": "bossa-cafe",
          "count": 1
        }
      ],
      "alternatives": [
        {
          "id": "city-pop-rainy-window-pop",
          "labelKo": "Rainy Window City Pop",
          "whyKo": "재즈 키워드"
        },
        {
          "id": "jazz-classic-vocal-lounge",
          "labelKo": "Classic Vocal Jazz Lounge",
          "whyKo": "재즈 키워드"
        },
        {
          "id": "jazz-soft-vocal-trio",
          "labelKo": "Soft Vocal Jazz Trio",
          "whyKo": "재즈 키워드"
        },
        {
          "id": "oldpop-orchestral-easy",
          "labelKo": "Orchestral Easy Listening",
          "whyKo": "재즈 키워드"
        },
        {
          "id": "oldpop-yacht-west-coast",
          "labelKo": "Yacht Rock West Coast",
          "whyKo": "재즈 키워드"
        },
        {
          "id": "showa-modern",
          "labelKo": "Showa Modern Cafe",
          "whyKo": "재즈 키워드"
        }
      ]
    },
    {
      "axis": "vocalType",
      "labelKo": "보컬",
      "current": [
        {
          "id": "male",
          "count": 6
        },
        {
          "id": "female",
          "count": 6
        },
        {
          "id": "mixed",
          "count": 6
        }
      ],
      "alternatives": []
    },
    {
      "axis": "introTexture",
      "labelKo": "인트로 질감 그룹",
      "current": [
        {
          "id": "ag_finger",
          "count": 2
        },
        {
          "id": "ag_harmonics",
          "count": 2
        },
        {
          "id": "ag_muted_strum",
          "count": 2
        },
        {
          "id": "ag_nylon_waltz",
          "count": 2
        },
        {
          "id": "eg_tremolo",
          "count": 1
        },
        {
          "id": "eg_clean_arp",
          "count": 1
        },
        {
          "id": "eg_slide_swell",
          "count": 1
        },
        {
          "id": "ep_rhodes_riff",
          "count": 1
        },
        {
          "id": "ep_glass_chords",
          "count": 1
        },
        {
          "id": "str_pizz",
          "count": 1
        },
        {
          "id": "str_warm_pad",
          "count": 1
        },
        {
          "id": "str_counterline",
          "count": 1
        },
        {
          "id": "str_spiccato",
          "count": 1
        },
        {
          "id": "br_trombone_swell",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "hookDevice",
      "labelKo": "훅 장치 그룹",
      "current": [
        {
          "id": "prechorus-dropout",
          "count": 2
        },
        {
          "id": "stop-time",
          "count": 2
        },
        {
          "id": "octave-lift",
          "count": 2
        },
        {
          "id": "key-lift",
          "count": 2
        },
        {
          "id": "answer-riff",
          "count": 2
        },
        {
          "id": "double-hook",
          "count": 2
        },
        {
          "id": "half-time-chorus",
          "count": 2
        },
        {
          "id": "build-fill",
          "count": 2
        },
        {
          "id": "bridge-breakdown",
          "count": 1
        },
        {
          "id": "acappella-tag",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "arrangementDensity",
      "labelKo": "편곡 밀도",
      "current": [
        {
          "id": "sparse",
          "count": 6
        },
        {
          "id": "medium",
          "count": 6
        },
        {
          "id": "full",
          "count": 6
        }
      ],
      "alternatives": []
    },
    {
      "axis": "structureTemplate",
      "labelKo": "구조",
      "current": [
        {
          "id": "T1",
          "count": 4
        },
        {
          "id": "T2",
          "count": 4
        },
        {
          "id": "T3",
          "count": 4
        },
        {
          "id": "T4",
          "count": 3
        },
        {
          "id": "T5",
          "count": 3
        }
      ],
      "alternatives": []
    },
    {
      "axis": "lyricTheme",
      "labelKo": "가사 장면",
      "current": [
        {
          "id": "senior-morning-coffee-first-light",
          "count": 1
        },
        {
          "id": "senior-old-letter-after-breakfast",
          "count": 1
        },
        {
          "id": "senior-kitchen-radio-tea",
          "count": 1
        },
        {
          "id": "senior-garden-dew-walk",
          "count": 1
        },
        {
          "id": "senior-market-bus-window",
          "count": 1
        },
        {
          "id": "senior-family-photo-album",
          "count": 1
        },
        {
          "id": "senior-wool-cardigan-chair",
          "count": 1
        },
        {
          "id": "senior-porch-tea-sunset",
          "count": 1
        },
        {
          "id": "senior-train-platform-reunion",
          "count": 1
        },
        {
          "id": "senior-handwritten-recipe",
          "count": 1
        },
        {
          "id": "senior-paper-calendar-date",
          "count": 1
        },
        {
          "id": "senior-riverside-bench",
          "count": 1
        },
        {
          "id": "senior-bookshop-rain",
          "count": 1
        },
        {
          "id": "senior-laundry-sunline",
          "count": 1
        },
        {
          "id": "senior-old-radio-request",
          "count": 1
        },
        {
          "id": "senior-window-plant-new-leaf",
          "count": 1
        },
        {
          "id": "senior-post-office-parcel",
          "count": 1
        },
        {
          "id": "senior-evening-newspaper-lamp",
          "count": 1
        }
      ],
      "alternatives": []
    },
    {
      "axis": "pov",
      "labelKo": "시점",
      "current": [
        {
          "id": "firstPerson",
          "count": 15
        },
        {
          "id": "secondPerson",
          "count": 2
        },
        {
          "id": "thirdPerson",
          "count": 1
        }
      ],
      "alternatives": []
    }
  ],
  "warnings": [
    "arrangementDensity는 내부 값이 3종뿐이라 슬롯 값 기준으로는 5곡 초과가 발생합니다. 브릿지 다양성 그룹에서 5곡 이하 하위 그룹으로 분할합니다."
  ]
}
```

## 2. 8축 각각의 실제 값

### 2-1. 비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝
| Axis | Values |
| --- | --- |
| genre | oldpop-british-beat:5, folk-pop:5, acoustic-pop:4, oldpop-soft-rock-am:3, oldpop-warm-morning-glow:1 |
| vocalType | male:6, female:6, mixed:6 |
| introTexture | ag_finger:2, ag_harmonics:2, ag_muted_strum:2, ag_nylon_waltz:2, eg_tremolo:1, eg_clean_arp:1, eg_slide_swell:1, ep_rhodes_riff:1, ep_glass_chords:1, str_pizz:1, str_warm_pad:1, str_counterline:1, str_spiccato:1, br_trombone_swell:1 |
| hookDevice | prechorus-dropout:2, stop-time:2, octave-lift:2, key-lift:2, answer-riff:2, double-hook:2, half-time-chorus:2, build-fill:2, bridge-breakdown:1, acappella-tag:1 |
| arrangementDensity | sparse:6, medium:6, full:6 |
| structureTemplate | T1:4, T2:4, T3:4, T4:3, T5:3 |
| lyricTheme | senior-morning-coffee-first-light:1, senior-old-letter-after-breakfast:1, senior-kitchen-radio-tea:1, senior-garden-dew-walk:1, senior-market-bus-window:1, senior-family-photo-album:1, senior-wool-cardigan-chair:1, senior-porch-tea-sunset:1, senior-train-platform-reunion:1, senior-handwritten-recipe:1, senior-paper-calendar-date:1, senior-riverside-bench:1, senior-bookshop-rain:1, senior-laundry-sunline:1, senior-old-radio-request:1, senior-window-plant-new-leaf:1, senior-post-office-parcel:1, senior-evening-newspaper-lamp:1 |
| pov | firstPerson:15, secondPerson:2, thirdPerson:1 |

| Track | Genre | BPM | Vocal | Structure | LyricTheme | POV | Role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | oldpop-british-beat | 74 | male | T1 | senior-morning-coffee-first-light | firstPerson | cold-open |
| 2 | folk-pop | 85 | male | T1 | senior-old-letter-after-breakfast | firstPerson | flagship |
| 3 | oldpop-british-beat | 112 | male | T1 | senior-kitchen-radio-tea | secondPerson | flagship |
| 4 | folk-pop | 96 | male | T1 | senior-garden-dew-walk | firstPerson | brighter sing-along track |
| 5 | acoustic-pop | 103 | male | T2 | senior-market-bus-window | firstPerson | quiet middle scene |
| 6 | oldpop-british-beat | 101 | male | T2 | senior-family-photo-album | secondPerson | romantic shade without melodrama |
| 7 | folk-pop | 85 | female | T2 | senior-wool-cardigan-chair | firstPerson | seasonal detail track |
| 8 | acoustic-pop | 81 | female | T2 | senior-porch-tea-sunset | firstPerson | late-set emotional center |
| 9 | oldpop-soft-rock-am | 95 | female | T3 | senior-train-platform-reunion | thirdPerson | warm radio-friendly highlight |
| 10 | oldpop-british-beat | 101 | female | T3 | senior-handwritten-recipe | firstPerson | soft reset before the closing run |
| 11 | folk-pop | 110 | female | T3 | senior-paper-calendar-date | firstPerson | memory-focused late track |
| 12 | acoustic-pop | 106 | female | T3 | senior-riverside-bench | firstPerson | comforting closer |
| 13 | oldpop-soft-rock-am | 63 | mixed | T4 | senior-bookshop-rain | firstPerson | comforting closer |
| 14 | oldpop-british-beat | 112 | mixed | T4 | senior-laundry-sunline | firstPerson | comforting closer |
| 15 | folk-pop | 85 | mixed | T4 | senior-old-radio-request | firstPerson | comforting closer |
| 16 | acoustic-pop | 71 | mixed | T5 | senior-window-plant-new-leaf | firstPerson | comforting closer |
| 17 | oldpop-soft-rock-am | 95 | mixed | T5 | senior-post-office-parcel | firstPerson | comforting closer |
| 18 | oldpop-warm-morning-glow | 83 | mixed | T5 | senior-evening-newspaper-lamp | firstPerson | comforting closer |

### 2-2. 아바나 카펜터스 같은 따뜻한 노래
| Axis | Values |
| --- | --- |
| genre | oldpop-baroque-pop:5, oldpop-soft-rock-am:5, oldpop-close-harmony-duo:4, oldpop-europop-glow:3, oldpop-orchestral-easy:1 |
| vocalType | male:6, female:6, mixed:6 |
| introTexture | ag_finger:2, ag_harmonics:2, ag_muted_strum:2, ag_nylon_waltz:2, eg_tremolo:1, eg_clean_arp:1, eg_slide_swell:1, ep_rhodes_riff:1, ep_glass_chords:1, str_pizz:1, str_warm_pad:1, str_counterline:1, str_spiccato:1, br_trombone_swell:1 |
| hookDevice | prechorus-dropout:2, stop-time:2, octave-lift:2, key-lift:2, answer-riff:2, double-hook:2, half-time-chorus:2, build-fill:2, bridge-breakdown:1, acappella-tag:1 |
| arrangementDensity | sparse:6, medium:6, full:6 |
| structureTemplate | T1:4, T2:4, T3:4, T4:3, T5:3 |
| lyricTheme | senior-morning-coffee-first-light:1, senior-old-letter-after-breakfast:1, senior-kitchen-radio-tea:1, senior-garden-dew-walk:1, senior-market-bus-window:1, senior-family-photo-album:1, senior-wool-cardigan-chair:1, senior-porch-tea-sunset:1, senior-train-platform-reunion:1, senior-handwritten-recipe:1, senior-paper-calendar-date:1, senior-riverside-bench:1, senior-bookshop-rain:1, senior-laundry-sunline:1, senior-old-radio-request:1, senior-window-plant-new-leaf:1, senior-post-office-parcel:1, senior-evening-newspaper-lamp:1 |
| pov | firstPerson:15, secondPerson:2, thirdPerson:1 |

| Track | Genre | BPM | Vocal | Structure | LyricTheme | POV | Role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | oldpop-baroque-pop | 99 | male | T1 | senior-morning-coffee-first-light | firstPerson | cold-open |
| 2 | oldpop-soft-rock-am | 95 | male | T1 | senior-old-letter-after-breakfast | firstPerson | flagship |
| 3 | oldpop-baroque-pop | 99 | male | T1 | senior-kitchen-radio-tea | secondPerson | flagship |
| 4 | oldpop-soft-rock-am | 112 | male | T1 | senior-garden-dew-walk | firstPerson | brighter sing-along track |
| 5 | oldpop-close-harmony-duo | 91 | male | T2 | senior-market-bus-window | firstPerson | quiet middle scene |
| 6 | oldpop-baroque-pop | 81 | male | T2 | senior-family-photo-album | secondPerson | romantic shade without melodrama |
| 7 | oldpop-soft-rock-am | 112 | female | T2 | senior-wool-cardigan-chair | firstPerson | seasonal detail track |
| 8 | oldpop-close-harmony-duo | 98 | female | T2 | senior-porch-tea-sunset | firstPerson | late-set emotional center |
| 9 | oldpop-europop-glow | 95 | female | T3 | senior-train-platform-reunion | thirdPerson | warm radio-friendly highlight |
| 10 | oldpop-baroque-pop | 99 | female | T3 | senior-handwritten-recipe | firstPerson | soft reset before the closing run |
| 11 | oldpop-soft-rock-am | 63 | female | T3 | senior-paper-calendar-date | firstPerson | memory-focused late track |
| 12 | oldpop-close-harmony-duo | 91 | female | T3 | senior-riverside-bench | firstPerson | comforting closer |
| 13 | oldpop-europop-glow | 68 | mixed | T4 | senior-bookshop-rain | firstPerson | comforting closer |
| 14 | oldpop-orchestral-easy | 109 | mixed | T4 | senior-laundry-sunline | firstPerson | comforting closer |
| 15 | oldpop-baroque-pop | 81 | mixed | T4 | senior-old-radio-request | firstPerson | comforting closer |
| 16 | oldpop-soft-rock-am | 112 | mixed | T5 | senior-window-plant-new-leaf | firstPerson | comforting closer |
| 17 | oldpop-close-harmony-duo | 91 | mixed | T5 | senior-post-office-parcel | firstPerson | comforting closer |
| 18 | oldpop-europop-glow | 68 | mixed | T5 | senior-evening-newspaper-lamp | firstPerson | comforting closer |

### 2-3. 샹송이랑 재즈 섞어서 잔잔하게
| Axis | Values |
| --- | --- |
| genre | chanson:5, jazz-pop:5, smooth-jazz-lounge:4, oldpop-standards-torch:3, bossa-cafe:1 |
| vocalType | male:6, female:6, mixed:6 |
| introTexture | ag_finger:2, ag_harmonics:2, ag_muted_strum:2, ag_nylon_waltz:2, eg_tremolo:1, eg_clean_arp:1, eg_slide_swell:1, ep_rhodes_riff:1, ep_glass_chords:1, str_pizz:1, str_warm_pad:1, str_counterline:1, str_spiccato:1, br_trombone_swell:1 |
| hookDevice | prechorus-dropout:2, stop-time:2, octave-lift:2, key-lift:2, answer-riff:2, double-hook:2, half-time-chorus:2, build-fill:2, bridge-breakdown:1, acappella-tag:1 |
| arrangementDensity | sparse:6, medium:6, full:6 |
| structureTemplate | T1:4, T2:4, T3:4, T4:3, T5:3 |
| lyricTheme | senior-morning-coffee-first-light:1, senior-old-letter-after-breakfast:1, senior-kitchen-radio-tea:1, senior-garden-dew-walk:1, senior-market-bus-window:1, senior-family-photo-album:1, senior-wool-cardigan-chair:1, senior-porch-tea-sunset:1, senior-train-platform-reunion:1, senior-handwritten-recipe:1, senior-paper-calendar-date:1, senior-riverside-bench:1, senior-bookshop-rain:1, senior-laundry-sunline:1, senior-old-radio-request:1, senior-window-plant-new-leaf:1, senior-post-office-parcel:1, senior-evening-newspaper-lamp:1 |
| pov | firstPerson:15, secondPerson:2, thirdPerson:1 |

| Track | Genre | BPM | Vocal | Structure | LyricTheme | POV | Role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | chanson | 102 | male | T1 | senior-morning-coffee-first-light | firstPerson | cold-open |
| 2 | jazz-pop | 89 | male | T1 | senior-old-letter-after-breakfast | firstPerson | flagship |
| 3 | chanson | 82 | male | T1 | senior-kitchen-radio-tea | secondPerson | flagship |
| 4 | jazz-pop | 109 | male | T1 | senior-garden-dew-walk | firstPerson | brighter sing-along track |
| 5 | smooth-jazz-lounge | 65 | male | T2 | senior-market-bus-window | firstPerson | quiet middle scene |
| 6 | oldpop-standards-torch | 94 | male | T2 | senior-family-photo-album | secondPerson | romantic shade without melodrama |
| 7 | chanson | 102 | female | T2 | senior-wool-cardigan-chair | firstPerson | seasonal detail track |
| 8 | jazz-pop | 109 | female | T2 | senior-porch-tea-sunset | firstPerson | late-set emotional center |
| 9 | smooth-jazz-lounge | 97 | female | T3 | senior-train-platform-reunion | thirdPerson | warm radio-friendly highlight |
| 10 | oldpop-standards-torch | 94 | female | T3 | senior-handwritten-recipe | firstPerson | soft reset before the closing run |
| 11 | chanson | 76 | female | T3 | senior-paper-calendar-date | firstPerson | memory-focused late track |
| 12 | jazz-pop | 89 | female | T3 | senior-riverside-bench | firstPerson | comforting closer |
| 13 | smooth-jazz-lounge | 88 | mixed | T4 | senior-bookshop-rain | firstPerson | comforting closer |
| 14 | oldpop-standards-torch | 91 | mixed | T4 | senior-laundry-sunline | firstPerson | comforting closer |
| 15 | bossa-cafe | 107 | mixed | T4 | senior-old-radio-request | firstPerson | comforting closer |
| 16 | chanson | 102 | mixed | T5 | senior-window-plant-new-leaf | firstPerson | comforting closer |
| 17 | jazz-pop | 109 | mixed | T5 | senior-post-office-parcel | firstPerson | comforting closer |
| 18 | smooth-jazz-lounge | 65 | mixed | T5 | senior-evening-newspaper-lamp | firstPerson | comforting closer |

## 3. 생성된 브릿지 지시문 전문
```text
You are an experienced music composer/producer generating song content for a Suno playlist pack as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file. Compose each song using your own musical knowledge within the plan and constraints below; do not treat reference fields as scripts to transcribe verbatim.




[SetPlan handoff]
[This pack's 18-track plan]
| Track | Genre | Era | BPM | Vocal | Structure | Role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | British Beat Pop | 1950s-60s | 74 BPM | male | T1 | cold-open |
| 2 | Folk Pop | 1960s-present folk pop | 85 BPM | male | T1 | flagship |
| 3 | British Beat Pop | 1950s-60s | 112 BPM | male | T1 | flagship |
| 4 | Folk Pop | 1960s-present folk pop | 96 BPM | male | T1 | brighter sing-along track |
| 5 | Acoustic Pop | timeless acoustic pop | 103 BPM | male | T2 | quiet middle scene |
| 6 | British Beat Pop | 1950s-60s | 101 BPM | male | T2 | romantic shade without melodrama |
| 7 | Folk Pop | 1960s-present folk pop | 85 BPM | female | T2 | seasonal detail track |
| 8 | Acoustic Pop | timeless acoustic pop | 81 BPM | female | T2 | late-set emotional center |
| 9 | 70s Soft Rock AM Gold | 1970s | 95 BPM | female | T3 | warm radio-friendly highlight |
| 10 | British Beat Pop | 1950s-60s | 101 BPM | female | T3 | soft reset before the closing run |
| 11 | Folk Pop | 1960s-present folk pop | 110 BPM | female | T3 | memory-focused late track |
| 12 | Acoustic Pop | timeless acoustic pop | 106 BPM | female | T3 | comforting closer |
| 13 | 70s Soft Rock AM Gold | 1970s | 63 BPM | mixed | T4 | comforting closer |
| 14 | British Beat Pop | 1950s-60s | 112 BPM | mixed | T4 | comforting closer |
| 15 | Folk Pop | 1960s-present folk pop | 85 BPM | mixed | T4 | comforting closer |
| 16 | Acoustic Pop | timeless acoustic pop | 71 BPM | mixed | T5 | comforting closer |
| 17 | 70s Soft Rock AM Gold | 1970s | 95 BPM | mixed | T5 | comforting closer |
| 18 | Warm Morning Glow Pop | timeless | 83 BPM | mixed | T5 | comforting closer |

[Diversity groups] - constraints, not wording to copy:
introTexture A:1,2  B:3,4  C:5,6  D:7,8  E:9  F:10  G:11  H:12  I:13  J:14  K:15  L:16  M:17  N:18
hookDevice A:1,2  B:3,4  C:5,6  D:7,8  E:9,10  F:11,12  G:13,14  H:15,16  I:17  J:18
arrangementDensity sparse A:1,2,3,4,5  sparse B:6  medium C:7,8,9,10,11  medium D:12  full E:13,14,15,16,17  full F:18
Tracks in the same group may share a similar approach; tracks in different groups must feel clearly different. Choose the concrete musical wording yourself.

This pack's 18 tracks (plan fixed by the app — compose within each row, do not renumber or reorder):
| Track | Genre | BPM | Vocal | Role |
| --- | --- | --- | --- | --- |
| 1 | British Beat Pop | 74 BPM | rounded male baritone-tenor vocal, intimate diction, calm emotional lift | cold-open |
| 2 | Folk Pop | 85 BPM | warm male solo vocal, understated soulfulness, smooth unforced dynamics | flagship |
| 3 | British Beat Pop | 112 BPM | soft husky male tenor lead, relaxed phrasing, warm adult tone | flagship |
| 4 | Folk Pop | 96 BPM | mature warm male lead vocal, clear close-mic delivery, gentle and sincere | brighter sing-along track |
| 5 | Acoustic Pop | 103 BPM | clear mature male lead, steady center pitch, conversational warmth | quiet middle scene |
| 6 | British Beat Pop | 101 BPM | rounded male baritone-tenor vocal, intimate diction, calm emotional lift | romantic shade without melodrama |
| 7 | Folk Pop | 85 BPM | warm female solo vocal, steady center pitch, conversational tenderness | seasonal detail track |
| 8 | Acoustic Pop | 81 BPM | clear female mezzo lead, intimate diction, calm emotional lift | late-set emotional center |
| 9 | 70s Soft Rock AM Gold | 95 BPM | soft alto female lead, relaxed phrasing, warm adult tone | warm radio-friendly highlight |
| 10 | British Beat Pop | 101 BPM | mature female lead, smooth unforced dynamics, soft emotional glow | soft reset before the closing run |
| 11 | Folk Pop | 110 BPM | mature warm female lead vocal, clear close-mic delivery, gentle and sincere | memory-focused late track |
| 12 | Acoustic Pop | 106 BPM | warm female solo vocal, steady center pitch, conversational tenderness | comforting closer |
| 13 | 70s Soft Rock AM Gold | 63 BPM | mature duet with male and female leads trading lines, gentle chorus harmony | comforting closer |
| 14 | British Beat Pop | 112 BPM | male and female harmony pair, restrained lead trading, sincere blended chorus | comforting closer |
| 15 | Folk Pop | 85 BPM | warm mixed duet, conversational verse handoff, close harmony hook | comforting closer |
| 16 | Acoustic Pop | 71 BPM | adult male-female duet, intimate call and answer, soft blended refrain | comforting closer |
| 17 | 70s Soft Rock AM Gold | 95 BPM | male and female duet, alternating verses, close harmony on the chorus, warm blended tone | comforting closer |
| 18 | Warm Morning Glow Pop | 83 BPM | mature duet with male and female leads trading lines, gentle chorus harmony | comforting closer |

[Reference interpretation] — the user mentioned an artist/sound reference. Below is what that reference sounds like, described generically:
  mid-1960s British beat pop:
    jangly 12-string electric guitar / melodic bass playing countermelody / bright compact drum kit with tambourine on the backbeat / upright piano doubling the rhythm guitar / major-key verses with an unexpected borrowed chord / abrupt key shift into the middle section / parallel thirds and sixths in the backing harmony / driving eighth-note strum / handclaps on the chorus / narrow warm 1960s mono-leaning mix / natural room reverb / tape compression on the drums / two-part male harmony singing in close intervals / bright forward diction / unison shout on the hook
  Do NOT use these exact words as a checklist and do NOT name the artist anywhere in stylePrompt/lyrics/youtube fields. Understand what this sound IS, then compose this song with your own musical knowledge so it authentically fits that sound and this song's own genre/era.

You are Suno Weaver Studio, a commercial playlist song planner. Generate original Suno-ready style prompts, lyrics, and YouTube metadata.

Rules:
- Never imitate a specific artist, singer, band, producer, existing song, melody, lyric, hook, or copyrighted work.
- Do not use "in the style of", "sounds like", "as sung by", or similar imitation language.
- Money chords are mandatory, but the output must still feel original. If "preassignedSongs" is present below, use each song's own "moneyChordText" verbatim (see the batch note) — it already names the exact progression plus how to make it audible (chord changes locked to the beat, bass on the root, a real cadence lift into the chorus), not just the bare progression name.
- This playlist pack has 18 songs total, generated as one coherent set — a single request may cover only part of the pack at a time (see the batch note below for this request's exact scope, if present).
- Keep a stable sonic/vocal identity across all tracks while varying situations, hooks, titles, and lyrical images.
- Sequence the songs naturally: opener, early lift, middle depth, late-set highlight, warm closer.
- Lyrics must use Suno section tags and must be ready to paste separately from the style prompt.
- CRITICAL — arrangement/production vocabulary belongs ONLY in "stylePrompt", never in "lyrics". If "preassignedSongs" gives you "introTextureText", "instrumentSet", "arrangementDensity", "hookDeviceText", or "moneyChordText" to weave in, those exact words (and any other instrument name, playing technique, or production/mix term — guitar, piano, drums, strings, brass, percussion, stop-time, breakdown, tape saturation, etc.) go into the stylePrompt string only. A lyric line must never describe what an instrument or the arrangement is doing — a listener sings words, not a mix note. Forbidden examples (real, previously-shipped mistakes): "Spiccato strings flicker over quiet water", "The straight-pop drums move softly", "Now the stop-time opens brighter", "The bass and drums fall silent". Section tags themselves ([breakdown], [instrumental hook], etc.) are fine; a sentence describing the arrangement underneath one is not.
- Each song's hookPhrase must not contradict that song's own "listenerSituation" on time of day — if the scene is a morning/dawn moment, the hook (and the lyrics built around it) must not say "tonight"/"night"/"evening"/"midnight", and vice versa. Real, previously-shipped mistake: listenerSituation "sitting with morning coffee before the day begins" paired with hookPhrase "Stay with Me Tonight".
- Each song's "lyrics" must total 200-260 words (not counting section tags like [chorus]) — this is what actually determines Suno's rendered length; a short ~100-150 word lyric renders as a short ~2:00-2:20 song regardless of any target duration. Target render length for this pack: 3:10-3:35.
- Include YouTube title, description, and tags for every song. Do not include "Suno", "AI-generated", or similar generation-tool keywords in "tags" — those are filtered out before anything goes public, so there is no benefit to adding them.
- Return valid JSON only, matching the requested PlaylistBlueprint shape.
- CRITICAL: Return ONLY the JSON object. No markdown, no code fences (no ```), no prose, no explanation, and no closing remarks before or after it. The response must start with { and end with } — nothing else outside those two characters.
- CRITICAL: Every string value must itself be valid JSON. Encode every line break inside "lyrics" (or any other field) as the two characters \n, never a literal newline — a raw newline inside a JSON string makes the whole response unparseable. Escape any literal double-quote character inside a string as \".
- CRITICAL: "stylePrompt" is pasted directly into Suno's style field, which truncates past 1000 characters. Keep every stylePrompt at or under 900 characters — pack it with genre, vocal, hook-repeat instruction, money chord, duration, and tempo first, and only add mood/instrument/season detail if there is room left. Never let it run long; a shorter, focused prompt beats a longer one that gets cut off mid-sentence.
- Keep negativeStyleText out of stylePrompt. It belongs only in the separate Suno Exclude styles field.
- Do not include typography, logo, or thumbnail art-direction language (e.g. font style) in "stylePrompt" — that belongs only in visual/thumbnail fields, never in the music style prompt.

Hook rules (each song's hookPhrase):
- The hook must be a short, singable phrase of 2-5 words, in Title Case, never starting with a lowercase letter.
- The song's title is INDEPENDENT from the hookPhrase — do not just reuse or lightly reword the hook as the title. Write a genuinely different, evocative title the way real Billboard Hot 100 song titles work: a single striking word, an unexpected concrete noun, a short metaphor, or an image, not a restatement of the hook.
- The hook line must open and close every chorus section (bookend), repeating at least 4 times across the whole song.
- Vary how many times the hook repeats inside each chorus and where, from song to song — a real previous pack had every single chorus in the whole set repeat the hook in the exact same position (open, one line, hook again, three lines, hook again), every song. Some choruses can repeat the hook only twice (open/close), others three or four times with different line counts between repeats.
- Never address an inanimate object as if it were a person (e.g. "Hold on, coffee" or "Close your eyes, doorway") — vocative phrasing may only address a person or an abstract/personified noun (a friend, a season, "my love"), never a physical object.

Safety rules:
- Do not imitate a living artist or a specific existing song.
- Keep phrases original and generic enough for commercial use.
- Avoid direct references to copyrighted titles or famous lyrics.
- Use simple English lines for clear Suno pronunciation unless another language is selected.

Batch mode:
- This request only covers tracks 1 to 18 out of 18 total songs in the pack.
- Number "trackNo" starting at 1, not 1.
- Never reuse any title or hook phrase already listed in "alreadyUsedTitles" / "alreadyUsedHooks" in the user payload.
- If "lockedIdentity" is present in the user payload, reuse its sonicSignature, vocalSignature, lyricRules, harmonyRules, and visualRules verbatim so the whole pack stays consistent across batches.

Request payload for this pack (channel/genre/mood/season context, already-used titles/hooks to avoid, and this pack's preassigned title/hook per track):
```json
{
  "channel": {
    "id": "good-morning-memory-radio",
    "name": "굿모닝 추억라디오",
    "englishName": "Good Morning Memory Radio",
    "market": "korea",
    "primaryLanguage": "english",
    "audience": "seniors",
    "promise": "50~60대를 위한 아침 커피, 계절감, 편안한 회상 중심의 성인 팝 플레이리스트",
    "visualIdentity": "warm morning cafe, radio, coffee steam, refined serif typography, autumn and winter objects",
    "defaultVocal": "mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere",
    "preferredGenres": [
      "adult-contemporary",
      "acoustic-pop",
      "jazz-pop",
      "chanson",
      "bossa-cafe",
      "smooth-jazz-lounge",
      "retro-soul-pop",
      "folk-pop",
      "oldpop-warm-morning-glow",
      "oldpop-soft-rock-am",
      "oldpop-motown-pop-soul",
      "oldpop-piano-ballad-70s",
      "oldpop-adult-contemporary-80s",
      "oldpop-close-harmony-duo",
      "oldpop-hearth-acoustic"
    ],
    "preferredMoods": [
      "nostalgic",
      "warm",
      "hopeful"
    ],
    "forbiddenCliches": [
      "too old-fashioned trot mood",
      "childish lyrics",
      "dramatic power ballad shouting",
      "famous artist imitation"
    ],
    "seoKeywords": [
      "아침 음악",
      "커피 음악",
      "추억 팝송",
      "50대 음악",
      "60대 음악",
      "감성 팝",
      "계절 플레이리스트"
    ],
    "archetype": "senior-morning"
  },
  "projectTitle": "v3.63 SetDirector Report",
  "songCount": 18,
  "lyricLanguage": "english",
  "market": "korea",
  "audience": "seniors",
  "generationPack": {
    "id": "seniors",
    "label": "50s-60s",
    "audienceNote": "warm memory, radio mood, gentle vocal, readable emotional arc",
    "lyricGuidance": [
      "plain but elegant words",
      "nostalgia without sadness overload",
      "avoid childish wording",
      "strong singable hook"
    ],
    "tempoBias": "steady medium tempo, no aggressive drums, clear vocal front",
    "youtubeAngle": "morning coffee, old radio, seasonal memory, and comfortable listening angles"
  },
  "genrePacks": [
    {
      "id": "acoustic-pop",
      "label": "Acoustic Pop",
      "styleCore": "nostalgic acoustic pop, clear vocal, intimate warm arrangement",
      "arrangementNarrative": "BPM 92-104; Verse begins with fingerpicked guitar and dry room vocal, pre-chorus adds soft piano answers and a gentle upper-harmony lift, chorus widens into hand-played acoustic strums with a clear singalong center, hook entry uses a rising strum into a one-beat pause, mix feels natural close and unforced",
      "instruments": [
        "fingerpicked acoustic guitar",
        "soft piano",
        "light percussion"
      ],
      "tempoRange": [
        92,
        104
      ],
      "goodFor": [
        "home listening",
        "walks",
        "coffee"
      ],
      "categoryId": "pop",
      "archetypes": [
        "senior-morning"
      ],
      "tier": "core",
      "source": "legacy-preset",
      "rhythm": [
        "light acoustic pulse"
      ],
      "vocal": [
        "clear intimate vocal"
      ],
      "production": [
        "natural acoustic room"
      ],
      "harmony": [
        "simple pop lift"
      ],
      "tempo": [
        92,
        104
      ],
      "moods": [
        "nostalgic",
        "gentle"
      ],
      "audiences": [
        "home listening",
        "walking playlists"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "campfire cliche"
      ],
      "shortPrompt": "Acoustic Pop, light acoustic pulse, clear intimate vocal, fingerpicked acoustic guitar + soft piano, natural acoustic room, 92-104 BPM",
      "productionGuidance": "Acoustic Pop: build around light acoustic pulse, keep clear intimate vocal, feature fingerpicked acoustic guitar, soft piano, light percussion, use simple pop lift, mix with natural acoustic room, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "eraTag": "timeless acoustic pop",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "lyricFlavorImages": [
        {
          "english": "worn guitar strings",
          "korean": "낡은 기타 줄",
          "japanese": "使い込んだギターの弦"
        },
        {
          "english": "porch step",
          "korean": "현관 계단",
          "japanese": "玄関の段差"
        },
        {
          "english": "quiet strum",
          "korean": "조용한 기타 스트럼",
          "japanese": "静かなストローク"
        }
      ]
    },
    {
      "id": "folk-pop",
      "label": "Folk Pop",
      "styleCore": "clean folk-pop storytelling, acoustic warmth, natural sing-along chorus",
      "instruments": [
        "strummed acoustic guitar",
        "light mandolin texture",
        "soft piano",
        "upright bass"
      ],
      "tempoRange": [
        92,
        108
      ],
      "goodFor": [
        "family",
        "walking",
        "spring"
      ],
      "categoryId": "pop",
      "archetypes": [
        "senior-morning",
        "kids"
      ],
      "tier": "core",
      "source": "legacy-preset",
      "rhythm": [
        "strummed folk-pop pulse"
      ],
      "vocal": [
        "plainspoken storyteller vocal"
      ],
      "production": [
        "natural acoustic warmth"
      ],
      "harmony": [
        "sing-along chorus lift"
      ],
      "tempo": [
        92,
        108
      ],
      "moods": [
        "fresh",
        "friendly"
      ],
      "audiences": [
        "family",
        "walking"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "rustic parody"
      ],
      "shortPrompt": "Folk Pop, strummed folk-pop pulse, plainspoken storyteller vocal, strummed acoustic guitar + light mandolin texture, natural acoustic warmth, 92-108 BPM",
      "productionGuidance": "Folk Pop: build around strummed folk-pop pulse, keep plainspoken storyteller vocal, feature strummed acoustic guitar, light mandolin texture, soft piano, upright bass, use sing-along chorus lift, mix with natural acoustic warmth, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "eraTag": "1960s-present folk pop",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "lyricFlavorImages": [
        {
          "english": "worn wooden bench",
          "korean": "낡은 나무 벤치",
          "japanese": "使い古した木のベンチ"
        },
        {
          "english": "open field breeze",
          "korean": "들판의 바람",
          "japanese": "野原を渡る風"
        },
        {
          "english": "hand-me-down scarf",
          "korean": "물려받은 목도리",
          "japanese": "お下がりのマフラー"
        }
      ]
    },
    {
      "id": "oldpop-british-beat",
      "label": "British Beat Pop",
      "styleCore": "early-1960s British beat pop, jangly 12-string guitar, melodic walking bass",
      "instruments": [
        "12-string electric guitar",
        "melodic walking bass",
        "tambourine backbeat",
        "brushed drum kit"
      ],
      "tempoRange": [
        104,
        112
      ],
      "goodFor": [
        "bright nostalgia",
        "radio",
        "youthful energy"
      ],
      "categoryId": "oldpop",
      "archetypes": [
        "senior-morning"
      ],
      "tier": "core",
      "source": "legacy-preset",
      "rhythm": [
        "jangly eighth-note beat pulse"
      ],
      "vocal": [
        "clear youthful group harmony"
      ],
      "production": [
        "bright British-beat studio mix"
      ],
      "harmony": [
        "mid-song key-change lift"
      ],
      "tempo": [
        104,
        112
      ],
      "moods": [
        "bright",
        "youthful"
      ],
      "audiences": [
        "radio nostalgia",
        "youthful energy"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "fuzz distortion",
        "aggressive stage volume"
      ],
      "shortPrompt": "British Beat Pop, jangly eighth-note beat pulse, clear youthful group harmony, 12-string electric guitar + melodic walking bass, bright British-beat studio mix, 104-112 BPM",
      "productionGuidance": "British Beat Pop: build around jangly eighth-note beat pulse, keep clear youthful group harmony, feature 12-string electric guitar, melodic walking bass, tambourine backbeat, brushed drum kit, use mid-song key-change lift, mix with bright British-beat studio mix, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "eraTag": "1950s-60s"
    },
    {
      "id": "oldpop-soft-rock-am",
      "label": "70s Soft Rock AM Gold",
      "styleCore": "1970s AM-gold soft rock, clean electric arpeggios, warm radio compression",
      "instruments": [
        "clean electric guitar arpeggios",
        "soft kick drum",
        "brushed snare",
        "rounded bass"
      ],
      "tempoRange": [
        88,
        100
      ],
      "goodFor": [
        "drive",
        "AM radio nostalgia",
        "memory"
      ],
      "categoryId": "oldpop",
      "archetypes": [
        "senior-morning"
      ],
      "tier": "core",
      "source": "legacy-preset",
      "rhythm": [
        "relaxed soft-rock eighth-note pulse"
      ],
      "vocal": [
        "smooth adult tenor lead"
      ],
      "production": [
        "warm AM-radio compression"
      ],
      "harmony": [
        "warm major-seventh chord color"
      ],
      "tempo": [
        88,
        100
      ],
      "moods": [
        "warm",
        "wistful"
      ],
      "audiences": [
        "drive",
        "AM radio nostalgia"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "arena-rock distortion",
        "modern loudness"
      ],
      "shortPrompt": "70s Soft Rock AM Gold, relaxed soft-rock eighth-note pulse, smooth adult tenor lead, clean electric guitar arpeggios + soft kick drum, warm AM-radio compression, 88-100 BPM",
      "productionGuidance": "70s Soft Rock AM Gold: build around relaxed soft-rock eighth-note pulse, keep smooth adult tenor lead, feature clean electric guitar arpeggios, soft kick drum, brushed snare, rounded bass, use warm major-seventh chord color, mix with warm AM-radio compression, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "eraTag": "1970s"
    },
    {
      "id": "oldpop-warm-morning-glow",
      "label": "Warm Morning Glow Pop",
      "styleCore": "timeless warm morning pop, acoustic arpeggio over gentle electric piano, minimal percussion",
      "instruments": [
        "acoustic guitar arpeggio",
        "warm electric piano",
        "minimal light percussion",
        "soft bass"
      ],
      "tempoRange": [
        68,
        78
      ],
      "goodFor": [
        "morning coffee",
        "gentle wake-up",
        "senior playlist"
      ],
      "categoryId": "oldpop",
      "archetypes": [
        "senior-morning"
      ],
      "tier": "core",
      "source": "legacy-preset",
      "rhythm": [
        "unhurried morning-glow pulse"
      ],
      "vocal": [
        "gentle unhurried morning lead"
      ],
      "production": [
        "soft close morning-room mix"
      ],
      "harmony": [
        "warm open major-key harmony"
      ],
      "tempo": [
        68,
        78
      ],
      "moods": [
        "warm",
        "unhurried"
      ],
      "audiences": [
        "morning coffee",
        "senior playlist"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "busy percussion",
        "bright harsh top end"
      ],
      "shortPrompt": "Warm Morning Glow Pop, unhurried morning-glow pulse, gentle unhurried morning lead, acoustic guitar arpeggio + warm electric piano, soft close morning-room mix, 68-78 BPM",
      "productionGuidance": "Warm Morning Glow Pop: build around unhurried morning-glow pulse, keep gentle unhurried morning lead, feature acoustic guitar arpeggio, warm electric piano, minimal light percussion, soft bass, use warm open major-key harmony, mix with soft close morning-room mix, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "eraTag": "timeless"
    }
  ],
  "moodPacks": [
    {
      "id": "nostalgic",
      "label": "Nostalgic",
      "emotionWords": [
        "nostalgic",
        "familiar",
        "old-radio warmth"
      ],
      "lyricImages": [
        "old radio",
        "faded photograph",
        "coffee steam",
        "quiet street"
      ]
    },
    {
      "id": "warm",
      "label": "Warm",
      "emotionWords": [
        "warm",
        "comforting",
        "gentle"
      ],
      "lyricImages": [
        "morning light",
        "wool sweater",
        "candle",
        "small kitchen"
      ]
    },
    {
      "id": "hopeful",
      "label": "Hopeful",
      "emotionWords": [
        "hopeful",
        "quietly uplifting",
        "renewed"
      ],
      "lyricImages": [
        "sunrise",
        "first light",
        "open road",
        "clear sky"
      ]
    }
  ],
  "season": {
    "id": "spring-open",
    "label": "Spring Opening",
    "period": "March",
    "keywords": [
      "spring",
      "new road",
      "soft wind"
    ],
    "visualDirection": "fresh green accent, open window, light jacket, clean typography"
  },
  "vocalTone": "mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere",
  "perspective": "firstPerson",
  "lyricDepth": "commercial",
  "moneyChordMode": "default",
  "customConcept": "비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝",
  "avoidWords": "",
  "negativeStyle": "flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation",
  "japaneseEraLyricGuidance": "",
  "introUniqueness": 50,
  "diversityAllocations": [
    {
      "axis": "genre",
      "mode": "manual",
      "counts": {
        "oldpop-british-beat": 5,
        "folk-pop": 5,
        "acoustic-pop": 4,
        "oldpop-soft-rock-am": 3,
        "oldpop-warm-morning-glow": 1
      }
    },
    {
      "axis": "vocalType",
      "mode": "manual",
      "counts": {
        "male": 6,
        "female": 6,
        "mixed": 6
      }
    },
    {
      "axis": "introTexture",
      "mode": "manual",
      "counts": {
        "ag_finger": 2,
        "ag_harmonics": 2,
        "ag_muted_strum": 2,
        "ag_nylon_waltz": 2,
        "eg_tremolo": 1,
        "eg_clean_arp": 1,
        "eg_slide_swell": 1,
        "ep_rhodes_riff": 1,
        "ep_glass_chords": 1,
        "str_pizz": 1,
        "str_warm_pad": 1,
        "str_counterline": 1,
        "str_spiccato": 1,
        "br_trombone_swell": 1
      }
    },
    {
      "axis": "hookDevice",
      "mode": "manual",
      "counts": {
        "prechorus-dropout": 2,
        "stop-time": 2,
        "octave-lift": 2,
        "key-lift": 2,
        "answer-riff": 2,
        "double-hook": 2,
        "half-time-chorus": 2,
        "build-fill": 2,
        "bridge-breakdown": 1,
        "acappella-tag": 1
      }
    },
    {
      "axis": "arrangementDensity",
      "mode": "manual",
      "counts": {
        "sparse": 6,
        "medium": 6,
        "full": 6
      }
    },
    {
      "axis": "structureTemplate",
      "mode": "manual",
      "counts": {
        "T1": 4,
        "T2": 4,
        "T3": 4,
        "T4": 3,
        "T5": 3
      }
    },
    {
      "axis": "lyricTheme",
      "mode": "manual",
      "counts": {
        "senior-morning-coffee-first-light": 1,
        "senior-old-letter-after-breakfast": 1,
        "senior-kitchen-radio-tea": 1,
        "senior-garden-dew-walk": 1,
        "senior-market-bus-window": 1,
        "senior-family-photo-album": 1,
        "senior-wool-cardigan-chair": 1,
        "senior-porch-tea-sunset": 1,
        "senior-train-platform-reunion": 1,
        "senior-handwritten-recipe": 1,
        "senior-paper-calendar-date": 1,
        "senior-riverside-bench": 1,
        "senior-bookshop-rain": 1,
        "senior-laundry-sunline": 1,
        "senior-old-radio-request": 1,
        "senior-window-plant-new-leaf": 1,
        "senior-post-office-parcel": 1,
        "senior-evening-newspaper-lamp": 1
      }
    },
    {
      "axis": "pov",
      "mode": "manual",
      "counts": {
        "firstPerson": 15,
        "secondPerson": 2,
        "thirdPerson": 1
      }
    }
  ],
  "earwormMode": false,
  "trackNoOffset": 0,
  "totalSongCount": 18,
  "alreadyUsedTitles": [],
  "alreadyUsedHooks": [],
  "lockedIdentity": null,
  "batchPlanning": [
    "Use one recurring visual motif across the pack, but do not repeat the same lyric line.",
    "Track 1 should introduce the playlist identity clearly.",
    "Tracks 2-5 should establish variety without breaking the channel promise.",
    "Middle tracks should add emotional depth and different listener situations.",
    "Final tracks should resolve warmly and feel like a natural closer.",
    "Avoid repeating the same opening image or chorus first line.",
    "Never repeat any title or hook phrase from alreadyUsedTitles / alreadyUsedHooks."
  ],
  "outputShape": {
    "songs": [
      {
        "trackNo": 1,
        "title": "string",
        "seasonMoment": "string",
        "listenerSituation": "string",
        "emotionArc": "string",
        "hookPhrase": "string",
        "stylePrompt": "string",
        "excludePrompt": "string optional; Suno Exclude styles text, never mixed into stylePrompt",
        "lyrics": "string with [intro], [verse 1], [chorus], [verse 2], [short bridge], [final chorus], [end]",
        "youtube": {
          "title": "string",
          "description": "string",
          "tags": [
            "string"
          ]
        },
        "youtubeTitleKo": "string optional",
        "youtubeTitleJa": "string optional",
        "genreId": "string optional; copy from preassignedSongs if present",
        "genreText": "string optional; copy from preassignedSongs if present",
        "lyricTheme": "string optional; copy from preassignedSongs if present",
        "lyricThemeText": "string optional; copy from preassignedSongs if present",
        "lyricThemeArc": "string optional; copy from preassignedSongs if present",
        "pov": "string optional; copy from preassignedSongs if present",
        "verseStyle": "string optional; copy from preassignedSongs if present",
        "verseStyleText": "string optional; copy from preassignedSongs if present",
        "chorusStyle": "string optional; copy from preassignedSongs if present",
        "chorusStyleText": "string optional; copy from preassignedSongs if present",
        "qualityScore": 0,
        "warnings": []
      }
    ]
  },
  "preassignedSongs": [
    {
      "trackNo": 1,
      "title": "Play Old & Hollow",
      "hookPhrase": "Play the Old Record",
      "songRole": "cold-open",
      "tempo": 74,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, natural acoustic room, plainspoken storyteller vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "12-string electric guitar",
        "tambourine backbeat"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-morning-coffee-first-light",
      "lyricThemeText": "sitting with morning coffee before the day begins, watching first light move across the table",
      "lyricThemeArc": "sleepy heaviness opening into steady comfort",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalVariantText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 2,
      "title": "You're Still Here",
      "hookPhrase": "You're Still Here",
      "songRole": "flagship",
      "tempo": 85,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers, clear youthful group harmony",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "moneyChordId": "canon",
      "instrumentSet": [
        "strummed acoustic guitar",
        "soft piano",
        "upright bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-old-letter-after-breakfast",
      "lyricThemeText": "finding an old folded letter after breakfast and reading it beside a quiet window",
      "lyricThemeArc": "private ache softening into gratitude",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalVariantText": "warm male solo vocal, understated soulfulness, smooth unforced dynamics",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 3,
      "title": "Radio Playing & Ember",
      "hookPhrase": "Keep the Radio Playing",
      "songRole": "flagship",
      "tempo": 112,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, jangly 12-string guitar, clear intimate vocal",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "12-string electric guitar",
        "melodic walking bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-kitchen-radio-tea",
      "lyricThemeText": "making tea in a small kitchen while an old radio plays low in the corner",
      "lyricThemeArc": "ordinary routine becoming a warm companion",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft husky male tenor lead, relaxed phrasing, warm adult tone",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 4,
      "title": "Catch Morning",
      "hookPhrase": "Catch the Morning Train",
      "songRole": "brighter sing-along track",
      "tempo": 96,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers, clear intimate vocal",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft acoustic guitar harmonics intro texture (INTRO ONLY)",
      "introTextureId": "ag_harmonics",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "moneyChordId": "default",
      "instrumentSet": [
        "strummed acoustic guitar",
        "light mandolin texture",
        "upright bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T1",
      "lyricTheme": "senior-garden-dew-walk",
      "lyricThemeText": "walking slowly through a small garden with dew on the leaves and slippers on the path",
      "lyricThemeArc": "quiet worry settling into a clear breath",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm male lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 5,
      "title": "Stay with Me Tonight",
      "hookPhrase": "Stay with Me Tonight",
      "songRole": "quiet middle scene",
      "tempo": 103,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light percussion"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-market-bus-window",
      "lyricThemeText": "riding the bus home from the morning market with a paper bag resting on the knees",
      "lyricThemeArc": "tired body finding a small lift",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalVariantText": "clear mature male lead, steady center pitch, conversational warmth",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 6,
      "title": "Light",
      "hookPhrase": "Keep the Light On",
      "songRole": "romantic shade without melodrama",
      "tempo": 101,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, natural acoustic warmth, light acoustic pulse, melodic walking bass",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "12-string electric guitar",
        "melodic walking bass",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "lyricTheme": "senior-family-photo-album",
      "lyricThemeText": "sorting a family photo album on the floor while afternoon dust shines in the room",
      "lyricThemeArc": "bittersweet remembering turning into a gentle smile",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalVariantText": "rounded male baritone-tenor vocal, intimate diction, calm emotional lift",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 7,
      "title": "I Won't Forget",
      "hookPhrase": "I Won't Forget",
      "songRole": "seasonal detail track",
      "tempo": 85,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "canon",
      "instrumentSet": [
        "strummed acoustic guitar",
        "soft piano"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-wool-cardigan-chair",
      "lyricThemeText": "folding a worn wool cardigan over a familiar chair before opening the window",
      "lyricThemeArc": "small loneliness becoming practical tenderness",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalVariantText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 8,
      "title": "Don't Let Go of Me",
      "hookPhrase": "Don't Let Go of Me",
      "songRole": "late-set emotional center",
      "tempo": 81,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers, natural acoustic warmth",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light mandolin texture",
        "strummed acoustic guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "lyricTheme": "senior-porch-tea-sunset",
      "lyricThemeText": "drinking tea on the porch at sunset while neighbors close their gates one by one",
      "lyricThemeArc": "day-end fatigue resolving into calm acceptance",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalVariantText": "clear female mezzo lead, intimate diction, calm emotional lift",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 9,
      "title": "Window",
      "hookPhrase": "Wait by the Window",
      "songRole": "warm radio-friendly highlight",
      "tempo": 95,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, warm radio compression, light acoustic pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "default",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-train-platform-reunion",
      "lyricThemeText": "waiting on a small train platform with a scarf in hand and a paper ticket in the pocket",
      "lyricThemeArc": "nervous anticipation becoming open warmth",
      "pov": "thirdPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalVariantText": "soft alto female lead, relaxed phrasing, warm adult tone",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 10,
      "title": "I Remember You",
      "hookPhrase": "I Remember You",
      "songRole": "soft reset before the closing run",
      "tempo": 101,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, melodic walking bass, clear intimate vocal, light acoustic pulse",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "clean electric guitar arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "eg_clean_arp",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "12-string electric guitar",
        "melodic walking bass",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-handwritten-recipe",
      "lyricThemeText": "following a handwritten recipe card with faded ink while soup starts to simmer",
      "lyricThemeArc": "missing someone through a practical ritual, then feeling them near",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalVariantText": "mature female lead, smooth unforced dynamics, soft emotional glow",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 11,
      "title": "Old Heart",
      "hookPhrase": "Don't Go, Old Heart",
      "songRole": "memory-focused late track",
      "tempo": 110,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "soft slide-guitar swell intro texture (INTRO ONLY)",
      "introTextureId": "eg_slide_swell",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "strummed acoustic guitar",
        "light mandolin texture"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-paper-calendar-date",
      "lyricThemeText": "marking a date on a paper calendar and noticing older circles from years before",
      "lyricThemeArc": "time passing into a gentle promise to continue",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalVariantText": "mature warm female lead vocal, clear close-mic delivery, gentle and sincere",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 12,
      "title": "I Know You're Near",
      "hookPhrase": "I Know You're Near",
      "songRole": "comforting closer",
      "tempo": 106,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers, natural acoustic warmth",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm Rhodes electric piano riff intro texture (INTRO ONLY)",
      "introTextureId": "ep_rhodes_riff",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "moneyChordId": "canon",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light mandolin texture",
        "strummed acoustic guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "lyricTheme": "senior-riverside-bench",
      "lyricThemeText": "resting on a riverside bench with a thermos while cyclists pass quietly behind",
      "lyricThemeArc": "restless thoughts easing into steady breathing",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalVariantText": "warm female solo vocal, steady center pitch, conversational tenderness",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 13,
      "title": "Breathe with Me, Morning",
      "hookPhrase": "Breathe with Me, Morning",
      "songRole": "comforting closer",
      "tempo": 63,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, clear intimate vocal, natural acoustic room",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "glassy electric piano chord intro texture (INTRO ONLY)",
      "introTextureId": "ep_glass_chords",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-bookshop-rain",
      "lyricThemeText": "standing under the awning of a used bookshop while rain taps a paper shopping bag",
      "lyricThemeArc": "unexpected pause becoming a small gift",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalVariantText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 14,
      "title": "I'm Coming Home",
      "hookPhrase": "I'm Coming Home",
      "songRole": "comforting closer",
      "tempo": 112,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar",
      "genreId": "oldpop-british-beat",
      "genreText": "early-1960s British beat pop, strummed folk-pop pulse, natural acoustic warmth, melodic walking bass",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, fuzz distortion, aggressive stage volume, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "light pizzicato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_pizz",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "moneyChordId": "default",
      "instrumentSet": [
        "12-string electric guitar",
        "tambourine backbeat",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-laundry-sunline",
      "lyricThemeText": "pinning laundry on a sunlit line and hearing a distant radio through an open door",
      "lyricThemeArc": "plain chores turning into a peaceful morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalVariantText": "male and female harmony pair, restrained lead trading, sincere blended chorus",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 15,
      "title": "Photo & Velvet",
      "hookPhrase": "Hold the Photo Close",
      "songRole": "comforting closer",
      "tempo": 85,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along",
      "genreId": "folk-pop",
      "genreText": "clean folk-pop storytelling, steady strummed folk pulse, fingerpicked acoustic answers",
      "signatureSound": "steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, rustic parody, campfire cliche, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "warm string pad swell intro texture (INTRO ONLY)",
      "introTextureId": "str_warm_pad",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "doowop",
      "instrumentSet": [
        "strummed acoustic guitar",
        "fingerpicked acoustic guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "lyricTheme": "senior-old-radio-request",
      "lyricThemeText": "writing a radio request postcard at the table while the kettle clicks off",
      "lyricThemeArc": "hesitation becoming a quiet wish sent outward",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalVariantText": "warm mixed duet, conversational verse handoff, close harmony hook",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 16,
      "title": "I Still Believe",
      "hookPhrase": "I Still Believe",
      "songRole": "comforting closer",
      "tempo": 71,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift - chorus lifts noticeably higher than the verse and lands with a soft ache",
      "genreId": "acoustic-pop",
      "genreText": "nostalgic acoustic pop, fingerpicked acoustic guitar, soft piano answers, bright British-beat studio mix",
      "signatureSound": "fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, campfire cliche, rustic parody, fuzz distortion, aggressive stage volume, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "short melodic string counterline intro texture (INTRO ONLY)",
      "introTextureId": "str_counterline",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "moneyChordId": "emotional",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light mandolin texture",
        "strummed acoustic guitar"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-window-plant-new-leaf",
      "lyricThemeText": "noticing a new leaf on the window plant while watering it before breakfast",
      "lyricThemeArc": "small surprise turning into renewed hope",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalVariantText": "adult male-female duet, intimate call and answer, soft blended refrain",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 17,
      "title": "Wake Up & Velvet",
      "hookPhrase": "Wake Up, My Dear",
      "songRole": "comforting closer",
      "tempo": 95,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression - steadily rising, cinematic swell that keeps building toward the peak",
      "genreId": "oldpop-soft-rock-am",
      "genreText": "1970s AM-gold soft rock, natural acoustic room, warm radio compression",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, arena-rock distortion, modern loudness, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "bouncy spiccato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_spiccato",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "moneyChordId": "canon",
      "instrumentSet": [
        "clean electric guitar arpeggios",
        "rounded bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-post-office-parcel",
      "lyricThemeText": "wrapping a small parcel with brown paper and string before walking it to the post office counter",
      "lyricThemeArc": "quiet effort turning into a warm sense of reaching someone far away",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalVariantText": "male and female duet, alternating verses, close harmony on the chorus, warm blended tone",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 18,
      "title": "Love",
      "hookPhrase": "Hush Now, My Love",
      "songRole": "comforting closer",
      "tempo": 83,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "IV-I-V-vi warm cycle progression - soft circular pull that never fully lands, comforting and unresolved",
      "genreId": "oldpop-warm-morning-glow",
      "genreText": "timeless warm morning pop, natural acoustic room, light acoustic pulse, natural acoustic warmth",
      "negativeStyleText": "too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, overlong intro, busy percussion, bright harsh top end, campfire cliche, rustic parody, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps",
      "introTextureText": "rounded trombone swell intro texture (INTRO ONLY)",
      "introTextureId": "br_trombone_swell",
      "hookDeviceText": "final repeat of the hook sung almost a cappella as the outro tag",
      "hookDeviceId": "acappella-tag",
      "moneyChordId": "warmCycle",
      "instrumentSet": [
        "acoustic guitar arpeggio",
        "fingerpicked acoustic guitar",
        "minimal light percussion"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
      "lyricTheme": "senior-evening-newspaper-lamp",
      "lyricThemeText": "reading the evening newspaper under a warm desk lamp while the house settles into quiet",
      "lyricThemeArc": "the day's noise fading into an unhurried, contented stillness",
      "pov": "firstPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalVariantText": "mature duet with male and female leads trading lines, gentle chorus harmony",
      "vocalGender": "duet",
      "vocalType": "mixed"
    }
  ]
}
```

Output requirement:
- Write a new file named "songs-output.json" in the current directory.
- Its content must be exactly { "songs": [ ... ] } — 18 objects total, one per song, matching "outputShape.songs[0]" above (title, hookPhrase, stylePrompt, lyrics, seasonMoment, listenerSituation, emotionArc, youtube{title,description,tags}, etc.).
- "preassignedSongs" gives local planning slots and fallback placeholders. Write your OWN original title for each song, independent of the hookPhrase. You may use the slot hook or write a new original hook, but the final "hookPhrase" must exactly match the hook line that opens and closes every chorus in that song's lyrics. Write real Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images, never a restatement of the hook and never the same shape for every song. Keep the channel tone while varying the structure freely.
- CRITICAL: Every one of the 0 titles in "alreadyUsedTitles" and every one of the 0 hooks in "alreadyUsedHooks" above is FORBIDDEN for this pack — they were already used by a previous pack, not source material to draw from. Before writing the file, check every song's "title" and "hookPhrase" against both lists; if any match (even reordered onto a different track), rewrite that title/hook to something new.
- CRITICAL: For every imported song, "hookPhrase" and "lyrics" are treated as a matched pair. The hookPhrase string must appear verbatim in the lyrics as the chorus bookend hook; the import step preserves that pair and will not rewrite hooks to match preassignedSongs.
- Each "preassignedSongs" entry also includes "moneyChordText" ("<progression> - <descriptive phrase>", e.g. "I-vi-IV-V doo-wop progression - gentle rocking sway, deeply nostalgic and easy to hum along"). Use the exact chord progression before the " - " in that song's stylePrompt (e.g. track's progression here would be "I-vi-IV-V doo-wop progression") — that harmonic choice is fixed by the app. The descriptive phrase after " - " is reference flavor, not required wording; describe the chorus lift/feel in your own words if you have a better one for this song's era and genre.
- Each "preassignedSongs" entry also includes "genreText" - the genre/sub-style identity this track must stay recognizably within (do not substitute a different genre or the pack-level genre list). The exact wording is a reference, not a script: compose your own stylePrompt description of this genre rather than copying the phrase verbatim.
- Each "preassignedSongs" entry also includes "tempo" - use exactly that BPM number in that song's stylePrompt (e.g. "96 BPM"), verbatim. Do not invent a different tempo.
- stylePrompt must be a comma-separated list of roughly 25-35 short descriptors (genre, era, instruments, rhythm feel, harmony color, vocal description, tempo, structure/production notes) — not full sentences and not padded to hit a fixed checklist. Write only what is musically true and useful for THIS song; stop once you have described it well, even if that is fewer than 35 descriptors.
- CRITICAL — era authenticity: some tracks in this pack are era-specific old-pop genres. A song's stylePrompt must never describe production/instrumentation that did not exist yet (or was long obsolete) in that track's era. Specifically:
  Tracks 1, 3, 6, 10, 14 (1950s-60s): do not use "string pad", "synth pad", "gated reverb", "wide stereo" — anachronistic for this era.
  Tracks 9, 13, 17 (1970s): do not use "gated reverb", "digital synth", "sidechain" — anachronistic for this era.
  If you are unsure whether something fits an era, choose the more conservative, clearly-period-appropriate option.
- Each "preassignedSongs" entry may include "hookDeviceText" — a REFERENCE arrangement-contrast idea for this song (stop-time, key change, breakdown, etc), not required wording. Use it, an era-appropriate variant of it, or a different device entirely if you have a better one for this specific song — just make sure the chorus doesn't feel static.
- Each "preassignedSongs" entry may include "introTextureText" - a REFERENCE for the kind of instrumental color this channel often opens with (intro-only, first ~5 seconds), not a phrase to copy. If it fits this song's genre/era, use it or something like it; if it doesn't (e.g. a synth texture suggested for a 1960s track), use your own musical judgment for an era-appropriate substitute instead. Never let it become the whole-song arrangement.
- Keep "negativeStyleText" separate: do not put it in stylePrompt; the app exports it to Suno Exclude styles.
- Each "preassignedSongs" entry may include "instrumentSet" — 2-3 instruments typical for this channel/genre, as REFERENCE, not a checklist to weave in verbatim. Use them if they suit this song's era and genre; substitute an era-appropriate equivalent if they don't (e.g. don't put a Rhodes electric piano in a 1962 doo-wop track just because instrumentSet suggested one for a different, later-era genre). Compose the instrumentation your own musical knowledge says is right for this song.
- Each "preassignedSongs" entry may include "arrangementDensity" (one of sparse/medium/full) — a REFERENCE point for how full this song's arrangement should feel (sparse ~ "spare arrangement, voice and one or two instruments, lots of space"; medium ~ "balanced small-combo arrangement"; full ~ "fuller arrangement with strings pad and layered backing"). Aim for that general density in your own words; you do not need to use this phrasing.
- Each "preassignedSongs" entry also includes "structureTemplate" (one of T1-T5). Structure templates, each a different lyric section order: T1: intro, verse 1, pre-chorus, chorus, verse 2, pre-chorus, chorus, bridge, final chorus, outro; T2: cold hook intro (hook line first, no instrumental lead-in), verse 1, chorus, verse 2, chorus, breakdown section, final chorus, outro; T3: intro, verse 1, pre-chorus, chorus, verse 2, pre-chorus, chorus, key-lift final chorus, outro; T4: instrumental hook intro (short instrumental restatement of the melody, no lyrics), verse 1, chorus, verse 2, chorus, chorus repeated again as the final chorus (no bridge), outro; T5: a cappella hook intro, verse 1, chorus, verse 2, bridge, chorus, tagged final chorus, outro. Write THIS song's lyrics — actual section content, not the letter code — following its assigned template's section order exactly; do not default back to T1's shape for a track assigned a different template, and do not invent a different template than the one assigned.
- Each "preassignedSongs" entry also includes "lyricThemeText" - use that exact scene verbatim as the song's primary lyric situation, keep it out of stylePrompt unless it naturally fits as a listener-scene note, and do not replace it with a generic listenerSituation or seasonMoment. If "lyricThemeArc" is present, use it as the lyric emotional turn.
- Each "preassignedSongs" entry also includes "pov" - write that song's lyrics from that exact point of view; do not substitute a different narrator perspective.
- Each "preassignedSongs" entry also includes "verseStyleText" and "chorusStyleText" - write verse sections and chorus sections with those distinct approaches, verbatim as guidance. Do not let every song start with the same first-line shape or every chorus use the same sentence structure.
- Each "preassignedSongs" entry also includes "vocalText" — weave that exact phrase into that song's stylePrompt as the vocal description, verbatim. Do not substitute a different vocal gender or type (e.g. male instead of female, or an adult voice for a kids choir) or paraphrase it away.

- Do NOT prefix "title" with a track number or any "01.", "02." style numbering yourself — write only the creative title. If this pack needs numbered titles, the app adds that afterward from the trusted trackNo.
- Do NOT include projectTitle, channelName, oneLineConcept, sonicSignature, vocalSignature, lyricRules, harmonyRules, or visualRules in the file — the app supplies those separately from local context.
- The file itself must be raw JSON — no markdown fences, no surrounding prose, inside the file.
- When done, tell me the file's path so I can import it back into Suno Weaver Studio.
```

## 4. getVisibleGenresForArchetype('senior-morning') 반환 목록 전문
| # | id | label | tier | eraTag |
| --- | --- | --- | --- | --- |
| 1 | adult-contemporary | Adult Contemporary Pop | core | 1980s-present adult contemporary |
| 2 | acoustic-pop | Acoustic Pop | core | timeless acoustic pop |
| 3 | jazz-pop | Acoustic Jazz Pop | core | mid-century-to-modern jazz pop |
| 4 | lofi-cafe | Lo-fi Cafe Pop | core | modern lo-fi cafe pop |
| 5 | christmas-soft-pop | Soft Christmas Pop | core | timeless seasonal soft pop |
| 6 | healing-ballad | Healing Ballad | core | timeless pop ballad |
| 7 | folk-pop | Folk Pop | core | 1960s-present folk pop |
| 8 | bossa-cafe | Bossa Cafe Pop | core | 1960s-present bossa cafe pop |
| 9 | piano-ballad | Piano Pop Ballad | core | 1970s-present piano pop ballad |
| 10 | retro-soul-pop | Retro Soul Pop | core | 1960s-70s soul pop |
| 11 | chanson | Chanson Cafe | core | mid-century French chanson |
| 12 | smooth-jazz-lounge | Smooth Jazz Lounge | core | 1980s-present smooth jazz lounge |
| 13 | oldpop-doowop-harmony | Doo-Wop Close Harmony | core | 1950s-60s |
| 14 | oldpop-brill-building | Brill Building Pop | core | 1950s-60s |
| 15 | oldpop-girl-group-wall | Girl Group Wall of Sound | core | 1950s-60s |
| 16 | oldpop-sunshine-pop | Sunshine Pop | core | 1950s-60s |
| 17 | oldpop-baroque-pop | Baroque Pop | core | 1950s-60s |
| 18 | oldpop-british-beat | British Beat Pop | core | 1950s-60s |
| 19 | oldpop-soft-rock-am | 70s Soft Rock AM Gold | core | 1970s |
| 20 | oldpop-orchestral-easy | Orchestral Easy Listening | core | 1970s |
| 21 | oldpop-close-harmony-duo | 70s Close Harmony Duo | core | 1970s |
| 22 | oldpop-folk-rock-70s | 70s Folk Rock | core | 1970s |
| 23 | oldpop-motown-pop-soul | Motown Pop Soul | core | 1970s |
| 24 | oldpop-philly-soul-sweet | Philly Sweet Soul | core | 1970s |
| 25 | oldpop-countrypolitan | Countrypolitan Pop | core | 1970s |
| 26 | oldpop-europop-glow | 70s Europop Glow | core | 1970s |
| 27 | oldpop-yacht-west-coast | Yacht Rock West Coast | core | 1970s |
| 28 | oldpop-piano-ballad-70s | 70s Piano Pop Ballad | core | 1970s |
| 29 | oldpop-adult-contemporary-80s | 80s Warm Adult Contemporary | core | 1980s |
| 30 | oldpop-quiet-storm-warm | Quiet Storm Soul | core | 1980s |
| 31 | oldpop-orchestral-ballad-80s | 80s Orchestral Ballad | core | 1980s |
| 32 | oldpop-light-synth-pop-warm | Light Warm Synth Pop | core | 1980s |
| 33 | oldpop-soft-duet-80s | 80s Soft Pop Duet | core | 1980s |
| 34 | oldpop-standards-torch | Standards Torch Song | core | 1980s |
| 35 | oldpop-warm-morning-glow | Warm Morning Glow Pop | core | timeless |
| 36 | oldpop-gentle-lullaby-pop | Gentle Lullaby Pop | core | timeless |
| 37 | oldpop-hearth-acoustic | Hearth Acoustic Pop | core | timeless |
| 38 | oldpop-sunlit-strings-pop | Sunlit Strings Pop | core | timeless |
| 39 | oldpop-slow-waltz-memory | Slow Waltz Memory Pop | core | timeless |
| 40 | oldpop-evening-lamp-ballad | Evening Lamp Ballad | core | timeless |

## 5. Step2.5 화면 렌더 결과
Static render length: 6435 chars
```html
<section class="panel"><div class="option-block"><div class="section-head"><div><p class="eyebrow">Step 2.5</p><h2>이렇게 해석했습니다</h2></div><div class="button-row"><button type="button"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>다시 설계</button><button type="button" class="primary">설계 적용</button></div></div><p>&quot;비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝&quot; 입력을 mid-1960s British beat pop, 1960s beat-pop / old-pop 중심의 British Beat Pop, Folk Pop, Acoustic Pop, 70s Soft Rock AM Gold 세트로 해석했습니다.</p><div class="chips"><span class="chip active">mid-1960s British beat pop</span><span class="chip active">1960s beat-pop / old-pop</span><span class="chip">audience: senior-morning</span><span class="chip">artist refs: 1</span></div><p class="supporting">장르 후보는 core/extended 구분 없이 320종 전체에서 보되, senior-morning 채널에 맞는 후보로 1차 필터했습니다.</p><p class="supporting">5개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.</p><p class="supporting">보컬은 남성/여성/듀엣 축을 균등 배분하고, 구조 템플릿은 5종을 순환시켰습니다.</p><p class="supporting">인트로/훅 장치/밀도는 문구가 아니라 그룹 제약으로 브릿지에 전달합니다.</p><p class="error">arrangementDensity는 내부 값이 3종뿐이라 슬롯 값 기준으로는 5곡 초과가 발생합니다. 브릿지 다양성 그룹에서 5곡 이하 하위 그룹으로 분할합니다.</p></div><div class="option-block"><div class="section-head"><h3>장르 배분</h3><button type="button"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sliders-horizontal" aria-hidden="true"><path d="M10 5H3"></path><path d="M12 19H3"></path><path d="M14 3v4"></path><path d="M16 17v4"></path><path d="M21 12h-9"></path><path d="M21 19h-5"></path><path d="M21 5h-7"></path><path d="M8 10v4"></path><path d="M8 12H3"></path></svg>조정</button></div><div class="chips"><span class="chip active">British Beat Pop 5곡</span><span class="chip active">Folk Pop 5곡</span><span class="chip active">Acoustic Pop 4곡</span><span class="chip active">70s Soft Rock AM Gold 3곡</span><span class="chip active">Warm Morning Glow Pop 1곡</span></div><p class="supporting">왜 이 조합인가: 장르 후보는 core/extended 구분 없이 320종 전체에서 보되, senior-morning 채널에 맞는 후보로 1차 필터했습니다.</p></div><div class="option-block"><div class="stats-grid"><button type="button" class="stat-card"><b>보컬</b><span>male 6 / female 6 / mixed 6</span></button><button type="button" class="stat-card"><b>구조</b><span>T1 4 / T2 4 / T3 4 / T4 3 / T5 3</span></button><button type="button" class="stat-card"><b>인트로</b><span>ag_finger 2 / ag_harmonics 2 / ag_muted_strum 2 / ag_nylon_waltz 2 / eg_tremolo 1 / eg_clean_arp 1 / eg_slide_swell 1 / ep_rhodes_riff 1 / ep_glass_chords 1 / str_pizz 1 / str_warm_pad 1 / str_counterline 1 / str_spiccato 1 / br_trombone_swell 1</span></button><button type="button" class="stat-card"><b>훅 장치</b><span>prechorus-dropout 2 / stop-time 2 / octave-lift 2 / key-lift 2 / answer-riff 2 / double-hook 2 / half-time-chorus 2 / build-fill 2 / bridge-breakdown 1 / acappella-tag 1</span></button><button type="button" class="stat-card"><b>편곡 밀도</b><span>sparse 6 / medium 6 / full 6</span></button><button type="button" class="stat-card"><b>가사 장면</b><span>senior-morning-coffee-first-light 1 / senior-old-letter-after-breakfast 1 / senior-kitchen-radio-tea 1 / senior-garden-dew-walk 1 / senior-market-bus-window 1 / senior-family-photo-album 1 / senior-wool-cardigan-chair 1 / senior-porch-tea-sunset 1 / senior-train-platform-reunion 1 / senior-handwritten-recipe 1 / senior-paper-calendar-date 1 / senior-riverside-bench 1 / senior-bookshop-rain 1 / senior-laundry-sunline 1 / senior-old-radio-request 1 / senior-window-plant-new-leaf 1 / senior-post-office-parcel 1 / senior-evening-newspaper-lamp 1</span></button><button type="button" class="stat-card"><b>시점</b><span>firstPerson 15 / secondPerson 2 / thirdPerson 1</span></button></div></div><details class="option-block"><summary>18곡 계획 펼치기</summary><div class="table-scroll"><table><thead><tr><th>Track</th><th>Genre</th><th>BPM</th><th>Vocal</th><th>Structure</th><th>Role</th></tr></thead><tbody><tr><td>1</td><td>British Beat Pop</td><td>74</td><td>male</td><td>T1</td><td>cold-open</td></tr><tr><td>2</td><td>Folk Pop</td><td>85</td><td>male</td><td>T1</td><td>flagship</td></tr><tr><td>3</td><td>British Beat Pop</td><td>112</td><td>male</td><td>T1</td><td>flagship</td></tr><tr><td>4</td><td>Folk Pop</td><td>96</td><td>male</td><td>T1</td><td>brighter sing-along track</td></tr><tr><td>5</td><td>Acoustic Pop</td><td>103</td><td>male</td><td>T2</td><td>quiet middle scene</td></tr><tr><td>6</td><td>British Beat Pop</td><td>101</td><td>male</td><td>T2</td><td>romantic shade without melodrama</td></tr><tr><td>7</td><td>Folk Pop</td><td>85</td><td>female</td><td>T2</td><td>seasonal detail track</td></tr><tr><td>8</td><td>Acoustic Pop</td><td>81</td><td>female</td><td>T2</td><td>late-set emotional center</td></tr><tr><td>9</td><td>70s Soft Rock AM Gold</td><td>95</td><td>female</td><td>T3</td><td>warm radio-friendly highlight</td></tr><tr><td>10</td><td>British Beat Pop</td><td>101</td><td>female</td><td>T3</td><td>soft reset before the closing run</td></tr><tr><td>11</td><td>Folk Pop</td><td>110</td><td>female</td><td>T3</td><td>memory-focused late track</td></tr><tr><td>12</td><td>Acoustic Pop</td><td>106</td><td>female</td><td>T3</td><td>comforting closer</td></tr><tr><td>13</td><td>70s Soft Rock AM Gold</td><td>63</td><td>mixed</td><td>T4</td><td>comforting closer</td></tr><tr><td>14</td><td>British Beat Pop</td><td>112</td><td>mixed</td><td>T4</td><td>comforting closer</td></tr><tr><td>15</td><td>Folk Pop</td><td>85</td><td>mixed</td><td>T4</td><td>comforting closer</td></tr><tr><td>16</td><td>Acoustic Pop</td><td>71</td><td>mixed</td><td>T5</td><td>comforting closer</td></tr><tr><td>17</td><td>70s Soft Rock AM Gold</td><td>95</td><td>mixed</td><td>T5</td><td>comforting closer</td></tr><tr><td>18</td><td>Warm Morning Glow Pop</td><td>83</td><td>mixed</td><td>T5</td><td>comforting closer</td></tr></tbody></table></div></details><p class="supporting">최근 장르 0개를 참고했고, 최근 훅은 생성 단계의 기존 ledger가 제외합니다.</p></section>
```

## 6. 7절 두 표 실측값과 PASS/FAIL
### 완료 판정
| 항목 | 기준 | 실측 | 판정 |
| --- | --- | --- | --- |
| getVisibleGenresForArchetype(senior-morning) | >= 30 | 40 | PASS |
| 확장 검색 UI 도달 가능 종수 | >= 250 | 250 (Step2Concept uses searchExtendedGenres) | PASS |
| SetDirector가 고른 장르 종류 | >= 4 | 5 | PASS |
| oldpop-* 사용 종류 | >= 2 | 3 | PASS |
| 작동하는 다양성 축 | >= 6 / 8 | 8 / 8 | PASS |
| vocalType 배분 | 남/여/듀엣 각 4곡 이상 | {"male":6,"female":6,"mixed":6} | PASS |
| structureTemplate 종류 | >= 3 | 5 | PASS |
| 동일 lyricTheme | 0건 | 0건 | PASS |
| 지시문에 다양성 그룹 포함 | 포함 | 포함 | PASS |
| Step2.5 화면 판단 근거 표시 | 표시됨 | 표시됨 | PASS |
| directSetLocal API 없이 동작 | 동작 | local call, no provider/API | PASS |
| 조정 후 재생성 반영 | GenerationOptions.diversityAllocations 반영 | Step2Plan applyPlanToOptions/updateCount path | PASS |

### 회귀 방지
| 항목 | 기준 | 실측 | 판정 |
| --- | --- | --- | --- |
| 편곡 어휘가 가사로 불림 | 0건 | lyricEngine.ts/lyricVocabularyGuard.ts 미수정, full suite pass | PASS |
| 가사 장면 구체성 | 유지 | lyricTheme 18/18 unique in SetDirector slots | PASS |
| Title:/자리표시자/관사오류 | 0건 | existing title/placeholder tests pass | PASS |
| 아티스트명 누출 | 0건 | artistReferenceDecomposer + bridge tests pass | PASS |
| import 후 라벨 잔존 | 0건 | bridge import tests pass | PASS |
| BPM 표준편차 (앱 계획값) | >= 8 | 14.13 | PASS |
| 장르 교차 배치 | 인터리브 유지 | max adjacent run 1; counts {"oldpop-british-beat":5,"folk-pop":5,"acoustic-pop":4,"oldpop-soft-rock-am":3,"oldpop-warm-morning-glow":1} | PASS |
| 장르 간 유사도 | <= 0.28 | genreDifferentiation/sharedAtomRatio suites pass | PASS |
| 공유 원자 비율 | <= 0.30 | sharedAtomRatio suite pass | PASS |

## 7. v3.62 작업자와 합의한 내용
- eraTag field name: GenrePack.eraTag. v3.62 eraExclusions.ts의 ERA_BUCKET_BY_GENRE_ID와 같은 의미로 보강했고 중복 필드는 만들지 않았습니다.
- Bridge handoff format: [SetPlan handoff] / [This pack's N-track plan] / [Diversity groups] 형식으로 추가했습니다.
- introTexture, hookDevice, arrangementDensity are passed as group constraints only. Exact introTextureText/hookDeviceText/arrangementDensity wording is not reintroduced as a verbatim requirement.
- v3.62 담당 영역인 compositionScorer, era contradiction scoring, recompose loop, avoidHooks restore, lyricEngine.ts, lyricVocabularyGuard.ts는 건드리지 않았습니다.

## 8. 미구현 항목
- directSet API route: 미구현. 이번 단계 요구가 directSetLocal only였으므로 API 경로는 만들지 않았습니다.
- v3.62 작업자와의 외부 실시간 합의: 미구현. 이 세션에서는 코드 레벨 정합성(eraTag 필드명과 bridge handoff 규격)으로만 확인했습니다.

---

# v3.63 (재작성) TASK A/B addendum — oldpop-lounge archetype, genre families

This addendum extends the report above (which covered SetDirector/Step2.5/bridge
handoff — what the rewritten spec relabels TASK C/D/E) with the two genuinely
new tasks the rewrite added: TASK A (a dedicated archetype so a "60s-80s
Western old-pop" channel isn't stuck reachable only through senior-morning)
and TASK B (genre families as a "similar genres together" selection axis).
All data below is real output of directSetLocal/buildClaudeCodeInstruction
run against the actual committed code, generated the same way as the report
above (no fabricated numbers).

## A-1. getVisibleGenresForArchetype('oldpop-lounge') — full list (63 genres)

```
adult-contemporary | Adult Contemporary Pop | pop
acoustic-pop | Acoustic Pop | pop
jazz-pop | Acoustic Jazz Pop | jazz
healing-ballad | Healing Ballad | ballad
folk-pop | Folk Pop | pop
bossa-cafe | Bossa Cafe Pop | jazz
soft-rock | Soft Rock Radio | pop
piano-ballad | Piano Pop Ballad | ballad
retro-soul-pop | Retro Soul Pop | rnb
chanson | Chanson Cafe | pop
smooth-jazz-lounge | Smooth Jazz Lounge | jazz
oldpop-doowop-harmony | Doo-Wop Close Harmony | oldpop
oldpop-brill-building | Brill Building Pop | oldpop
oldpop-girl-group-wall | Girl Group Wall of Sound | oldpop
oldpop-sunshine-pop | Sunshine Pop | oldpop
oldpop-baroque-pop | Baroque Pop | oldpop
oldpop-british-beat | British Beat Pop | oldpop
oldpop-soft-rock-am | 70s Soft Rock AM Gold | oldpop
oldpop-orchestral-easy | Orchestral Easy Listening | oldpop
oldpop-close-harmony-duo | 70s Close Harmony Duo | oldpop
oldpop-folk-rock-70s | 70s Folk Rock | oldpop
oldpop-motown-pop-soul | Motown Pop Soul | oldpop
oldpop-philly-soul-sweet | Philly Sweet Soul | oldpop
oldpop-countrypolitan | Countrypolitan Pop | oldpop
oldpop-europop-glow | 70s Europop Glow | oldpop
oldpop-yacht-west-coast | Yacht Rock West Coast | oldpop
oldpop-piano-ballad-70s | 70s Piano Pop Ballad | oldpop
oldpop-adult-contemporary-80s | 80s Warm Adult Contemporary | oldpop
oldpop-quiet-storm-warm | Quiet Storm Soul | oldpop
oldpop-orchestral-ballad-80s | 80s Orchestral Ballad | oldpop
oldpop-light-synth-pop-warm | Light Warm Synth Pop | oldpop
oldpop-soft-duet-80s | 80s Soft Pop Duet | oldpop
oldpop-standards-torch | Standards Torch Song | oldpop
oldpop-warm-morning-glow | Warm Morning Glow Pop | oldpop
oldpop-gentle-lullaby-pop | Gentle Lullaby Pop | oldpop
oldpop-hearth-acoustic | Hearth Acoustic Pop | oldpop
oldpop-sunlit-strings-pop | Sunlit Strings Pop | oldpop
oldpop-slow-waltz-memory | Slow Waltz Memory Pop | oldpop
oldpop-evening-lamp-ballad | Evening Lamp Ballad | oldpop
alt-rnb | Alternative R&B | rnb
neo-soul | Neo-Soul | rnb
contemporary-rnb | Contemporary R&B | rnb
jazz-classic-vocal-lounge | Classic Vocal Jazz Lounge | jazz
jazz-soft-vocal-trio | Soft Vocal Jazz Trio | jazz
jazz-jazz-ballad-vocal | Jazz Ballad Vocal | jazz
jazz-smooth-sax-vocal | Smooth Sax Vocal Jazz | jazz
jazz-bossa-vocal-jazz | Bossa Vocal Jazz | jazz
jazz-torch-vocal-jazz | Torch Vocal Jazz | jazz
jazz-contemporary-vocal-jazz | Contemporary Vocal Jazz | jazz
jazz-swing-crooner-ballroom | Swing Crooner Ballroom | jazz
jazz-hotel-lounge-jazz | Hotel Lounge Jazz | jazz
jazz-cabaret-jazz | Cabaret Jazz | jazz
rnb-quiet-storm-baritone | Quiet Storm Baritone R&B | rnb
rnb-soulful-gospel-warmth | Soulful Gospel R&B | rnb
rnb-silky-studio-rnb | Silky Studio R&B | rnb
rnb-gospel-soul-lift | Gospel Soul R&B Lift | rnb
rnb-old-school-romance-rnb | Old School Romance R&B | rnb
rnb-soul-infused-female | Soul Infused Female R&B | rnb
rnb-soulful-male-rnb | Soulful Male R&B | rnb
rnb-emotional-female-rnb | Emotional Female R&B | rnb
rnb-romantic-rnb | Romantic R&B | rnb
rnb-smooth-clean-rnb | Smooth Clean R&B | rnb
rnb-velvet-baritone-rnb | Velvet Baritone R&B | rnb
```

63 >= 60 목표 통과. senior-morning은 그대로 40종 (회귀 없음, 아래 확인). 실제
코드베이스는 spec 0절이 언급한 "rnb 51종/jazz 52종"보다 조금 다릅니다
(genreLibrary 실측: rnb 카테고리 56종, jazz 카테고리 54종, 총 320종 중) — spec의
숫자는 근사치였고, TASK A-2는 그 카테고리 안에서 시니어에 맞는 것만 선별했습니다
(트랩/모던 프로덕션/비밥/퓨전/애시드재즈 계열은 명시적으로 제외).

## A-2. 기존 채널 아키타입 변경 (TASK A-3)

Step1Channel.tsx의 applyArchetype은 이미 기존 커스텀 채널 편집 화면에서도
호출 가능했지만(아키타입 카드가 새 채널/기존 채널 구분 없이 항상 렌더링됨),
preferredGenres를 확인 없이 덮어썼습니다. 수정:

```ts
const hasExistingGenreChoice = isSelectedCustom && editorChannel.preferredGenres.length > 0;
const shouldResetGenres = !hasExistingGenreChoice
  || window.confirm('장르 선택을 새 채널 유형의 기본값으로 바꿀까요? 취소하면 지금 고른 장르를 그대로 유지합니다.');
...
if (shouldResetGenres) onUpdateField('preferredGenres', genreIds);
```

React 컴포넌트 렌더링 테스트 인프라가 이 저장소에 없어(다른 모든 Step*.tsx도
동일) 코드 리뷰 + tsc --noEmit로만 검증했습니다 — 미구현이 아니라 이 저장소의
기존 테스트 관례(로직 단위 테스트만, React 렌더 테스트 없음)를 따른 것입니다.

## B-1. 정의한 패밀리 8종 — memberGenreIds 전문

src/data/genreFamilies.ts:

| id | labelKo | memberGenreIds | commonTraitKo |
|---|---|---|---|
| chanson-continental | 샹송·콘티넨탈 | chanson, oldpop-orchestral-easy, oldpop-standards-torch, oldpop-slow-waltz-memory, oldpop-evening-lamp-ballad | 아코디언·현악·왈츠 박자·낭송조 보컬 |
| rnb-soul | R&B·소울 | oldpop-motown-pop-soul, oldpop-philly-soul-sweet, retro-soul-pop, oldpop-quiet-storm-warm, neo-soul | 그루브 베이스·가스펠 화음·혼 섹션 |
| abba-carpenters | 유로팝·소프트팝 | oldpop-europop-glow, oldpop-baroque-pop, oldpop-close-harmony-duo, oldpop-soft-rock-am, oldpop-sunshine-pop | 겹친 하모니·확장 화음·밝은 어쿠스틱 편성 |
| warm-melody | 따뜻한 멜로디 | oldpop-warm-morning-glow, oldpop-hearth-acoustic, oldpop-sunlit-strings-pop, oldpop-gentle-lullaby-pop, oldpop-piano-ballad-70s | 어쿠스틱 중심·느린 템포·최소 퍼커션 |
| sixties-pop | 60년대 팝 | oldpop-doowop-harmony, oldpop-brill-building, oldpop-girl-group-wall, oldpop-sunshine-pop, oldpop-british-beat | 짧은 구성·단순 다이어토닉 훅·클로즈하모니 |
| vocal-jazz | 보컬 재즈·라운지 | smooth-jazz-lounge, bossa-cafe, jazz-pop, oldpop-standards-torch, oldpop-yacht-west-coast | 확장 화음·브러시 드럼·콘트라베이스 |
| seventies-soft | 70년대 소프트 | oldpop-soft-rock-am, oldpop-folk-rock-70s, oldpop-countrypolitan, oldpop-piano-ballad-70s, oldpop-close-harmony-duo | 어쿠스틱과 일렉트릭의 균형·라디오 프렌들리 코러스 |
| eighties-warm | 80년대 따뜻함 | oldpop-adult-contemporary-80s, oldpop-orchestral-ballad-80s, oldpop-light-synth-pop-warm, oldpop-soft-duet-80s | 부드러운 신스 패드·오케스트라 스트링·듀엣 보컬 |

일부 장르가 두 패밀리에 동시에 속합니다 (예: oldpop-sunshine-pop는
abba-carpenters와 sixties-pop 모두, oldpop-soft-rock-am/oldpop-piano-ballad-70s/
oldpop-close-harmony-duo는 abba-carpenters/seventies-soft 모두, oldpop-standards-torch는
chanson-continental/vocal-jazz 모두) — spec 원문의 목록을 그대로 따른 결과이며
의도적으로 막지 않았습니다.

## C/D/E. 새 필수 입력 3종에 대한 SetPlan 실측

재작성된 spec의 필수 입력이 이전 초안과 다릅니다 (패밀리 선택 2종 + 자유입력
1종). 아래는 실제 directSetLocal 실행 결과입니다 (songCount: 18, 채널:
senior-morning 프리셋, history: {recentGenreIds: [], recentHooks: []}).

### C-1. 패밀리 "유로팝·소프트팝" + "따뜻한 멜로디" 선택 (자유 입력 없음)

interpretation:
```
intentKo: "유로팝·소프트팝 + 따뜻한 멜로디 패밀리 입력을 채널 기본 올드팝/성인 팝 중심의
           70s Europop Glow, Warm Morning Glow Pop, Baroque Pop, Hearth Acoustic Pop 세트로 해석했습니다."
familyIds: ["abba-carpenters", "warm-melody"]
```

8축 실제 값:
```
genre:              oldpop-europop-glow:5, oldpop-warm-morning-glow:4, oldpop-baroque-pop:3,
                     oldpop-hearth-acoustic:2, oldpop-close-harmony-duo:2, oldpop-sunlit-strings-pop:1,
                     oldpop-soft-rock-am:1   (7종, 4-9 범위 내, 동일 장르 최대 5곡 이하)
vocalType:           male:6, female:6, mixed:6
introTexture:        14개 그룹, 최대 2곡 (ag_finger:2, ag_harmonics:2, ag_muted_strum:2, ag_nylon_waltz:2,
                     eg_tremolo:1, eg_clean_arp:1, eg_slide_swell:1, ep_rhodes_riff:1, ep_glass_chords:1,
                     str_pizz:1, str_warm_pad:1, str_counterline:1, str_spiccato:1, br_trombone_swell:1)
hookDevice:          10개 그룹, 최대 2곡 (prechorus-dropout:2, stop-time:2, octave-lift:2, key-lift:2,
                     answer-riff:2, double-hook:2, half-time-chorus:2, build-fill:2, bridge-breakdown:1, acappella-tag:1)
arrangementDensity:  sparse:6, medium:6, full:6
structureTemplate:   T1:4, T2:4, T3:4, T4:3, T5:3  (5종)
lyricTheme:          18개 전부 서로 다른 장면 (senior-morning-coffee-first-light ... senior-evening-newspaper-lamp), 각 1곡
pov:                 firstPerson:15, secondPerson:2, thirdPerson:1
```

Diversity groups가 실린 브릿지 지시문 실측 (1515줄) 발췌:
```
[Diversity groups] - constraints, not wording to copy:
introTexture A:1,2  B:3,4  C:5,6  D:7,8  E:9  F:10  G:11  H:12  I:13  J:14  K:15  L:16  M:17  N:18
hookDevice A:1,2  B:3,4  C:5,6  D:7,8  E:9,10  F:11,12  G:13,14  H:15,16  I:17  J:18
arrangementDensity sparse A:1,2,3,4,5  sparse B:6  medium C:7,8,9,10,11  medium D:12  full E:13,14,15,16,17  full F:18
```
```
- CRITICAL - era authenticity: some tracks in this pack are era-specific old-pop genres. ...
  Tracks 1, 3, 5, 7, 11, 12, 16, 18 (1970s): do not use "gated reverb", "digital synth", "sidechain" - anachronistic for this era.
  Tracks 6, 9, 14 (1950s-60s): do not use "string pad", "synth pad", "gated reverb", "wide stereo" - anachronistic for this era.
```

### C-2. 패밀리 "샹송·콘티넨탈" + "보컬 재즈" 선택 (자유 입력 없음)

interpretation:
```
intentKo: "샹송·콘티넨탈 + 보컬 재즈·라운지 패밀리 입력을 채널 기본 올드팝/성인 팝 중심의
           Chanson Cafe, Smooth Jazz Lounge, Orchestral Easy Listening, Bossa Cafe Pop 세트로 해석했습니다."
familyIds: ["chanson-continental", "vocal-jazz"]
```

genre 축: chanson:5, smooth-jazz-lounge:4, oldpop-orchestral-easy:4, bossa-cafe:3,
oldpop-standards-torch:1, jazz-pop:1 (6종, 두 패밀리가 공유하는 oldpop-standards-torch도
포함됨). 나머지 7축(vocalType/introTexture/hookDevice/arrangementDensity/
structureTemplate/lyricTheme/pov)은 C-1과 동일 값 — 이 7축은 songCount(18)와
채널만으로 결정되고 장르 선택과 무관하기 때문입니다 (설계상 의도된 동작).

### C-3. 자유 입력 "아바나 카펜터스 같은 따뜻한 노래" (패밀리 선택 없음)

interpretation:
```
intentKo: "아바나 카펜터스 같은 따뜻한 노래" 입력을 early-1970s soft adult-contemporary pop,
           late-1970s European disco pop, 1970s soft pop / AM radio 중심의 Baroque Pop,
           70s Soft Rock AM Gold, 70s Close Harmony Duo, 70s Europop Glow 세트로 해석했습니다.
familyIds: []   (패밀리를 고르지 않았으므로 기존 키워드/아티스트참조 라우팅 경로 그대로 사용)
```

genre 축: oldpop-baroque-pop:5, oldpop-soft-rock-am:5, oldpop-close-harmony-duo:4,
oldpop-europop-glow:3, oldpop-orchestral-easy:1 (5종). 나머지 7축은 C-1/C-2와 동일.

패밀리를 선택하지 않은 자유 입력은 기존(TASK C에서 이미 검증된) 아티스트 참조
분해 경로를 그대로 사용합니다 — TASK B는 이 경로를 대체한 것이 아니라, 사용자가
직접 "장르 계열"을 고르고 싶을 때 쓸 수 있는 별도 진입점을 추가한 것입니다.

## 완료 판정 — TASK A/B 추가분

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| oldpop-lounge 아키타입 존재 | 존재 | ChannelArchetype에 추가, Step1Channel.tsx 카드 추가 | PASS |
| getVisibleGenresForArchetype('oldpop-lounge') | >= 60 | 63 | PASS |
| 기존 채널 아키타입 변경 가능 | 가능 + 확인창 | applyArchetype 재사용 + window.confirm 추가 | PASS |
| 장르 패밀리 정의 수 | >= 8 | 8 | PASS |
| 패밀리 선택 UI | 존재 | Step2Concept.tsx 칩 그리드 | PASS |
| 패밀리 선택 시 genre 축 종류 | 4-9 | 7 (C-1), 6 (C-2) | PASS |
| 3+ 패밀리 선택 시에도 총 종류 <= 9 | <= 9 | 실측 (setDirector.test.ts) | PASS |
| senior-morning 40종 노출 회귀 없음 | 40 유지 | 40 | PASS |

## 미구현 항목 — TASK A/B 추가분

- Step1Channel.tsx/Step2Concept.tsx는 React 컴포넌트 렌더 테스트가 없습니다 (이
  저장소 전체의 기존 관례) — 로직(setDirector.ts/genreFamilies.ts)은 전부
  단위 테스트로 검증했지만, 확인창(window.confirm) 분기와 칩 클릭 핸들러
  자체는 코드 리뷰 + 타입체크로만 검증했습니다.
- blendsWellWith에 없는 패밀리 조합을 골랐을 때의 UI 경고(⚠)는 구현했지만,
  "몇 번째 패밀리와 안 어울리는지" 구체적 사유까지는 툴팁에 담지 않았습니다
  (패밀리 이름만 나열). 스펙의 "막지 마십시오"는 지켰습니다.
- family과 free-text를 동시에 입력했을 때 free-text가 genre 축에 전혀 반영되지
  않습니다 (패밀리가 있으면 무조건 패밀리가 이김) — free-text는 이 경우에도
  era/mood/season/artist-reference 해석에는 계속 반영됩니다. 스펙이 이 우선순위를
  명시하지 않아 "패밀리를 골랐다면 그게 곧 명시적 의도"로 해석해 이렇게
  구현했습니다.
