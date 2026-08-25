[Generated 2026-08-25T00:55:47.545Z — bridge instruction schema v3.64]

You are an experienced music composer/producer generating song content for a Suno playlist pack as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file. Compose each song using your own musical knowledge within the plan and constraints below; do not treat reference fields as scripts to transcribe verbatim.

[이 세트가 하려는 것]

  컨셉    딥 하우스
  청취자  Melodic and organic deep house for a night drive that never quite wants to end
  목표    12곡을 이어 들었을 때 이 컨셉이 실제로 느껴지게

  이 세트는 다음 중 하나를 이루면 성공입니다
    한 곡이라도 다시 듣고 싶게 만든다
    12곡이 하나의 시간대·분위기로 들린다
    어느 한 곡이 특별히 기억에 남는다

  아래의 재료와 제약은 그것을 돕기 위한 것입니다.
  제약을 지키는 것 자체가 목표가 아닙니다.


[각 곡에 하나씩]

  이 곡에서 다른 11곡과 다르게 시도한 것을 한 줄로 적으십시오. 필드명은 "distinctChoice"입니다.

  예시
    후렴을 한 번만 부른다
    마지막에 반주가 사라지고 목소리만 남는다
    질문으로 끝난다
    1절과 2절의 화자가 다르다
    같은 문장이 절마다 조금씩 바뀐다
    후렴 전에 한 박자 쉰다
    2절이 1절보다 짧다

  같은 시도를 두 곡 이상에 쓰지 마십시오.

[세트 전체의 완성도 — 제안, 강제 아님]

  대비를 만드십시오 — 12곡이 전부 좋으면 무엇이 좋은지 알 수 없습니다.
    가장 조용한 곡 1곡 · 가장 밝은 곡 1곡 · 가장 짧은 곡 1곡 · 가장 특이한 곡 1곡(탐색 슬롯)

  1번과 4번 트랙은 담백하게 만들어, 2~3번(대표곡)이 상대적으로 돋보이게 하십시오.

  마지막 트랙은 완전히 끝내지 말고 여운을 남기며, 1번 트랙의 요소를 살짝 반영하십시오 (플레이리스트는 반복 재생됩니다).




[SetPlan handoff]
[This pack's 12-track plan]
| Track | Genre | Era | BPM | Vocal | Structure | Intro | Scene frame | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | alt-rnb | - | 68 BPM | mixed | T1 | no [intro] tag at all — singing starts immediately | commute-transit | cold-open |
| 2 | Garage Swing House | 2010s-2020s garage swing house | 122 BPM | male | T2 | short [intro] line allowed | solitary-room | flagship |
| 3 | Organic Deep House | 2010s-2020s organic deep house | 111 BPM | female | T5 | short [intro] line allowed | night-drive | flagship |
| 4 | Melodic Deep House | 2010s-2020s melodic deep house | 119 BPM | mixed | T2 | no [intro] tag at all — singing starts immediately | two-people-talk | steady heartfelt build |
| 5 | alt-rnb | - | 76 BPM | female | T4 | instrumental (no lyric line under [intro]) | threshold-decision | brighter sing-along track |
| 6 | Organic Deep House | 2010s-2020s organic deep house | 116 BPM | mixed | T4 | instrumental (no lyric line under [intro]) | crowd-alone | late-set emotional center |
| 7 | Garage Swing House | 2010s-2020s garage swing house | 127 BPM | male | T2 | short [intro] line allowed | city lights at night | big emotional high point |
| 8 | Melodic Deep House | 2010s-2020s melodic deep house | 119 BPM | male | T2 | no [intro] tag at all — singing starts immediately | reunion-passing | gentle wind-down moment |
| 9 | alt-rnb | - | 77 BPM | female | T3 | instrumental (no lyric line under [intro]) | after-party | quiet middle scene |
| 10 | Organic Deep House | 2010s-2020s organic deep house | 109 BPM | mixed | T4 | instrumental (no lyric line under [intro]) | daylight-city | comforting closer |
| 11 | Garage Swing House | 2010s-2020s garage swing house | 127 BPM | male | T1 | instrumental (no lyric line under [intro]) | screen-memory | soft reset before the closing run |
| 12 | Melodic Deep House | 2010s-2020s melodic deep house | 114 BPM | female | T4 | short [intro] line allowed | night-city-move | warm goodnight track |

Follow each track's "Intro" column exactly: "instrumental" tracks must have NO lyric line under [intro] (an instrumental cue there is fine, e.g. "[intro]" with nothing sung until the next tag); "no [intro] tag at all" tracks should skip the [intro] tag entirely and start singing right away; "short [intro] line allowed" tracks may have a brief sung line there.

Scene frames used in this pack: commute-transit (1); solitary-room (2); night-drive (3); two-people-talk (4); threshold-decision (5); crowd-alone (6); city lights at night (7); reunion-passing (8); after-party (9); daylight-city (10); screen-memory (11); night-city-move (12). Each track's own scene/lyricThemeText is the specific detail — write a genuinely different kind of moment per frame, not the same "alone, looking at something" scene with the object swapped out.
Scene mix across this pack - motion: 이동 중(도보) 3, stillness 2, traveling by car, a drive 2, 이동 중(자전거) 1 | cast: alone 11, two people 1. Keep this mix - do not flatten every track without an explicit motion/cast axis into the same quiet-alone shape either.

[Diversity groups] - constraints, not wording to copy:
introTexture A:1  B:2,11  C:3  D:4  E:5,10  F:6,9  G:7  H:8,12
hookDevice A:1,10  B:2,12  C:3  D:4  E:5  F:6  G:7  H:8  I:9  J:11
arrangementDensity medium A:1,4,7,8,9  sparse B:2,3,10,12  full C:5,6,11
Tracks in the same group may share a similar approach; tracks in different groups must feel clearly different. Choose the concrete musical wording yourself.

[Lyric scenes] - write THIS scene into each track's actual verses/chorus, in your own words (never quote the description verbatim as a lyric line). Do NOT default to a quiet, solitary "watching something alone" scene for these tracks even if that is this app's usual mood elsewhere in the pack - if a scene names motion (dancing, driving, traveling) or more than one person present, the lyrics must show that motion/energy/company, not replace it with stillness or solitude.
  Track 1: walking the same six blocks home with earbuds in, timing footsteps to a half-remembered beat
    emotional turn: aimless wandering resolving into a steady, grounded rhythm
    cast: alone / motion: 이동 중(도보)
  Track 2: sitting at a small bedroom studio desk past midnight, one lamp on, headphones half off one ear
    emotional turn: scattered self-doubt narrowing into focused, patient work
    cast: alone / motion: stillness
  Track 3: pulling up to a neon-lit drive-through at 3am, ordering just to have somewhere to be for five minutes
    emotional turn: aimless drifting turning into small, self-aware amusement
    cast: alone / motion: traveling by car, a drive
  Track 4: sliding into a diner booth with an old friend at midnight, catching up over cold fries and refilled coffee
    emotional turn: initial distance warming into familiar, easy comfort
    cast: two people
  Track 5: standing at a doorway deciding, for the last time, whether to turn back or keep walking
    emotional turn: aching hesitation hardening into clear-eyed release
    cast: alone
  Track 6: standing near the back of a small show, arms crossed, watching the set instead of losing themselves in it
    emotional turn: guarded distance loosening into quiet appreciation
    cast: alone
  Track 7: standing at a crosswalk under a neon sign, waiting for the light with a hundred strangers moving around
    emotional turn: restless impatience settling into observant calm
    cast: alone / motion: stillness
  Track 8: driving past the old block where everything started, every corner holding a different memory
    emotional turn: wistful nostalgia settling into grounded gratitude
    cast: alone / motion: traveling by car, a drive
  Track 9: walking home from a late DJ set with the bassline still echoing faintly in the ears
    emotional turn: electric exhilaration settling into a slow, satisfied glow
    cast: alone / motion: 이동 중(도보)
  Track 10: grabbing coffee from a corner cart before work, city just waking up around a still-quiet sidewalk
    emotional turn: sleepy sluggishness lifting into a small, hopeful start
    cast: alone / motion: 이동 중(도보)
  Track 11: replaying an old voice memo from a friend who moved away, hearing a laugh that time has softened
    emotional turn: quiet longing warming into grateful remembrance
    cast: alone
  Track 12: biking home late through empty streets, the whole city briefly feeling like it belongs to no one else
    emotional turn: wired late-night energy settling into free, weightless ease
    cast: alone / motion: 이동 중(자전거)

[Vocabulary per track] - REFERENCE word lists matched to each track's own scene, not a checklist. Do NOT just list these words in a row or force all of them in - write natural, singable lyrics in your own words that happen to live in this same vocabulary world. A lyric that reads like a word list stitched together is worse than one that uses none of these words but still captures the scene. Where an "avoid" list is given, steer away from those words for this specific track (they belong to a different mood this scene isn't).
  Track 1: subway car, earbuds, night bus, river road, ride, scroll, drive, dim, tired, restless | avoid: radio, curtain, kettle
  Track 2: studio apartment, takeout container, lamp, laptop screen, sit, watch, scroll back, small, quiet, alone | avoid: radio, curtain, kettle
  Track 3: subway car, earbuds, night bus, river road, ride, scroll, drive, dim, tired, restless | avoid: radio, curtain, kettle
  Track 4: late-night table, shared glass, crosswalk, crowded street, confess, catch up, text, warm, awkward, honest
  Track 5: resignation email, packed bag, cursor, doorway, hesitate, decide, pack, uncertain, determined, nervous
  Track 6: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 7: marquee, streetlight, taxi, window display, walk, glance, meet, electric, late, glittering | avoid: quiet, still
  Track 8: late-night table, shared glass, crosswalk, crowded street, confess, catch up, text, warm, awkward, honest
  Track 9: after-party lights, turning season, rooftop night, celebrate, turn the page, bright, warm, renewed
  Track 10: crowded street, daylight skyline, circle of friends, walk past, gather, support, confident, bright, easy
  Track 11: studio apartment, takeout container, lamp, laptop screen, sit, watch, scroll back, small, quiet, alone | avoid: radio, curtain, kettle
  Track 12: tour bus window, formation line, city skyline, crew, sync, ride, move together, united, in motion, wide-eyed

[Killing points] - each track's one designed peak moment, an idea to realize in your own words, never a phrase to quote verbatim. This should be the loudest, fullest, most energetic point of the ENTIRE song — clearly audible as a lift, not a small nudge — and the section right before it should stay noticeably more restrained (thinner arrangement, lower energy) so the peak has something real to rise from, instead of the whole song sitting at one constant level. Build this through arrangement fullness and dynamics, never through belting or harsh top end — the audience's vocal-register/production exclusions elsewhere in this instruction still apply in full at the peak. Critically, this moment must also be NAMED as a concrete, specific clause in the stylePrompt text itself (your own wording for the actual technique — an octave lift, a key/half-step modulation, a stripped-then-full swell, a sustained note into the chorus, etc.) — realizing the dynamic without ever describing it in the prompt text does not satisfy this. A track not listed here has no designed peak moment — keep it comfortably at its usual level throughout, do not invent one.
  Track 2 (pre-chorus): rising synth filter sweep into the chorus
  Track 3 (bridge): drums thin to just the kick for two bars
  Track 4 (bridge): the groove shifts into a half-time feel for the bridge
  Track 5 (pre-chorus): a stuttered vocal chop punctuates the pre-chorus
  Track 6 (final-chorus): sidechain pump under the final chorus
  Track 7 (pre-chorus): rising synth arpeggio builds into the final chorus
  Track 8 (pre-chorus): pre-chorus opens up and lifts into the hook
  Track 9 (final-chorus): short vocal hook tag right after the chorus
  Track 10 (mid-instrumental): a brief full stop right before the beat drops back in
  Track 11 (bridge): arrangement thins out then re-enters full for the last chorus





CRITICAL — tempo: use each track's own "BPM" value from the table above exactly, in every song's stylePrompt. Do not average, round toward a comfortable middle, or otherwise smooth tempos across tracks — the spread between tracks is intentional.

This pack's 12 tracks (plan fixed by the app — compose within each row, do not renumber or reorder):
| Track | Genre | BPM | Vocal | Role | Length target |
| --- | --- | --- | --- | --- | --- |
| 1 | alt-rnb | 68 BPM | call and answer, wide octave harmony, chamber ambience, male and female duet, rasping ad-lib stack on the bridge | cold-open | 5-6 sections, 157-219 words, max 1 instrumental section |
| 2 | Garage Swing House | 122 BPM | male low warm baritone, gentle swung phrasing, soft husky grain, chamber ambience, husky ache on the closing line, staccato pulse breaking the legato line | flagship | 11-13 sections, 181-243 words, max 5 instrumental sections |
| 3 | Organic Deep House | 111 BPM | female low warm contralto, bright forward delivery, velvety low resonance, chamber ambience, controlled vibrato on the closing note | flagship | 11-13 sections, 178-241 words, max 5 instrumental sections |
| 4 | Melodic Deep House | 119 BPM | trading lines mid-phrase, loose lines meeting hook, warm natural room, male and female duet, vibrato taper on the sustained hook | steady heartfelt build | 11-13 sections, 180-243 words, max 5 instrumental sections |
| 5 | alt-rnb | 76 BPM | female mid clear alto, light rhythmic phrasing, slight smoky depth, dry and forward, breathy pocket phrasing behind the beat | brighter sing-along track | 5-6 sections, 172-234 words, max 1 instrumental section |
| 6 | Organic Deep House | 116 BPM | unison splitting to thirds, tight unison with light detune, narrow mono-leaning room, male and female duet, legato ache opening into the bridge | late-set emotional center | 11-13 sections, 183-246 words, max 6 instrumental sections |
| 7 | Garage Swing House | 127 BPM | male mid baritone-tenor lead, storytelling spoken-edge delivery, slight nasal brightness, soft plate ambience, vibrato hush on the final held note | big emotional high point | 13-15 sections, 182-244 words, max 7 instrumental sections |
| 8 | Melodic Deep House | 119 BPM | male falsetto-leaning tenor, earnest forward delivery, smoky low resonance, tape slap echo, nasal ache breaking on the peak line, breathy ad-lib on the final line | gentle wind-down moment | 11-13 sections, 180-243 words, max 5 instrumental sections |
| 9 | alt-rnb | 77 BPM | female clear mezzo lead, tender confiding delivery, faint vibrato shimmer, warm natural room, nasal-edged ad-lib stack on the outro | quiet middle scene | 5-6 sections, 169-231 words, max 1 instrumental section |
| 10 | Organic Deep House | 109 BPM | alternating verses into joined chorus, close third harmony, chamber ambience, male and female duet, croon softening into the final verse, rasp breaking through the emotional peak | comforting closer | 9-11 sections, 182-245 words, max 4 instrumental sections |
| 11 | Garage Swing House | 127 BPM | male bright tenor lead, legato sustained lines, warm woody midrange, intimate close-mic, breathy vibrato easing into the chorus | soft reset before the closing run | 13-15 sections, 180-242 words, max 6 instrumental sections |
| 12 | Melodic Deep House | 114 BPM | female narrow intimate lead, restrained understated reading, clean bell tone, narrow mono-leaning room, head-voice lift on the emotional peak | warm goodnight track | 11-13 sections, 183-246 words, max 6 instrumental sections |

[This set's vocal composition]
  Track 1: Male-Female Duet
  Track 2: Male Solo
  Track 3: Female Solo
  Track 4: Male-Female Duet
  Track 5: Female Solo
  Track 6: Male-Female Duet
  Track 7: Male Solo
  Track 8: Male Solo
  Track 9: Female Solo
  Track 10: Male-Female Duet
  Track 11: Male Solo
  Track 12: Female Solo

[Duet track rule — REQUIRED for every track marked "Male-Female Duet" above]
Mark who sings each section directly in that song's own lyrics section tags — e.g.:
  [Verse 1: Male Vocal]
  [Verse 2: Female Vocal]
  [Pre-Chorus: Female Vocal]
  [Chorus: Male and Female Duet]
  [Bridge: Male and Female Call and Response]
  [Final Chorus: Male and Female Duet Harmony]
Without this per-section tag, Suno renders the whole song in a single voice regardless of what the style prompt says. Verses must alternate between the two singers.

[Solo/group tracks]
Do NOT add any per-section vocal-assignment tag (e.g. ": Male Vocal", ": Female Vocal") to a track NOT marked "Male-Female Duet" above — only duet tracks get them. Adding one to a solo/group track confuses Suno.

You are Haru Studio, a commercial playlist song planner. Generate original Suno-ready style prompts, lyrics, and YouTube metadata.

Rules:
- Never imitate a specific artist, singer, band, producer, existing song, melody, lyric, hook, or copyrighted work.
- Do not use "in the style of", "sounds like", "as sung by", or similar imitation language.
- Money chords are mandatory, but the output must still feel original. If "preassignedSongs" is present below, use each song's own "moneyChordText" verbatim (see the batch note) — it already names the exact progression plus how to make it audible (chord changes locked to the beat, bass on the root, a real cadence lift into the chorus), not just the bare progression name.
- This playlist pack has 12 songs total, generated as one coherent set — a single request may cover only part of the pack at a time (see the batch note below for this request's exact scope, if present).
- Keep a stable sonic/vocal identity across all tracks while varying situations, hooks, titles, and lyrical images.
- Sequence the songs naturally: opener, early lift, middle depth, late-set highlight, warm closer.
- Lyrics must use Suno section tags and must be ready to paste separately from the style prompt.
- CRITICAL — do NOT add an "[end]" or "[outro]" tag (or any closing/fade-out tag) after the final chorus. Neither does anything in Suno — they only add a section that inflates the song's render length past its target duration. The final chorus (or that structure template's own tagged final-chorus marker) is the LAST thing in "lyrics"; nothing follows it. Real, previously-shipped mistake: every song in a real pack ended with a trailing "[end]" tag despite this exact instruction being given.
- CRITICAL — arrangement/production vocabulary belongs ONLY in "stylePrompt", never in "lyrics". If "preassignedSongs" gives you "introTextureText", "instrumentSet", "arrangementDensity", "hookDeviceText", or "moneyChordText" to weave in, those exact words (and any other instrument name, playing technique, or production/mix term — guitar, piano, drums, strings, brass, percussion, stop-time, breakdown, tape saturation, etc.) go into the stylePrompt string only. A lyric line must never describe what an instrument or the arrangement is doing — a listener sings words, not a mix note. Forbidden examples (real, previously-shipped mistakes): "Spiccato strings flicker over quiet water", "The straight-pop drums move softly", "Now the stop-time opens brighter", "The bass and drums fall silent". Section tags themselves ([breakdown], [instrumental hook], etc.) are fine; a sentence describing the arrangement underneath one is not.
- Each song's hookPhrase must not contradict that song's own "listenerSituation" on time of day — if the scene is a morning/dawn moment, the hook (and the lyrics built around it) must not say "tonight"/"night"/"evening"/"midnight", and vice versa. Real, previously-shipped mistake: listenerSituation "sitting with morning coffee before the day begins" paired with hookPhrase "Stay with Me Tonight".
- Each song's "lyrics" must total 200-240 words (not counting section tags like [chorus]) — this is what actually determines Suno's rendered length; a short lyric renders noticeably shorter than target regardless of any target duration. Target render length for this pack: 3:10-3:35.
- Give each section room to breathe rather than compressing it to hit the word count with fewer, shorter sections: a verse should run 5-6 lines, a pre-chorus or bridge 2-4 lines, a chorus 3-4 lines including its repeated hook line. A 2-3 line verse undercuts both the word-count floor above and the target render length even when the section TAGS match the assigned structure template.
- Every song should include at least one genuinely wordless instrumental moment somewhere — either an instrumental intro before the first vocal line (when this song's plan calls for one, see "Intro" below) or, for a song whose intro is vocal, a short 4-8 bar instrumental break/solo before the final chorus with no lyric line under it. This costs a few seconds of render time without adding a single word of lyric content, and real listening measured most of a pack coming back with no instrumental section at all despite being planned.
- Include this exact phrase as one of stylePrompt's own descriptor clauses in EVERY song, verbatim: "short intro, 3:10-3:35, full arrangement, not a short cut". Every song in this pack carries the identical phrase — that is intentional and required, not a "shared/redundant atom" to trim, vary, or omit; this is the one clause allowed to repeat identically across every song in the pack.
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
- The hook line appears exactly ONCE in every earlier chorus-type section (not open-and-close both) — vary whether it's the first line, second line, or last line of that chorus block, from song to song. Only the FINAL chorus bookends: the hook opens AND closes it (2 occurrences there only). This gives roughly 4 hook occurrences total across the whole song (earlier choruses x1 each + final chorus x2) — do not exceed this by bookending every chorus like the final one; a real previous pack over-repeated the hook by doing exactly that (open, one line, hook again, three lines, hook again — every single chorus, every song), which read as repetitive on close listening.
- CRITICAL: Every one of those hook occurrences inside "lyrics" must match "hookPhrase" EXACTLY, character for character, including its Title Case — do not lowercase or otherwise reword the hook when it's sung. (Sentence-case display for pasting into Suno is handled separately by the app at copy time — the stored "lyrics" field must keep the verbatim match so the app's own quality checks can find it.)
- Never address an inanimate object as if it were a person (e.g. "Hold on, coffee" or "Close your eyes, doorway") — vocative phrasing may only address a person or an abstract/personified noun (a friend, a season, "my love"), never a physical object.

Safety rules:
- Do not imitate a living artist or a specific existing song.
- Keep phrases original and generic enough for commercial use.
- Avoid direct references to copyrighted titles or famous lyrics.
- Use simple English lines for clear Suno pronunciation unless another language is selected.

Batch mode:
- This request only covers tracks 1 to 12 out of 12 total songs in the pack.
- Number "trackNo" starting at 1, not 1.
- Never reuse any title or hook phrase already listed in "alreadyUsedTitles" / "alreadyUsedHooks" in the user payload.
- If "lockedIdentity" is present in the user payload, reuse its sonicSignature, vocalSignature, lyricRules, harmonyRules, and visualRules verbatim so the whole pack stays consistent across batches.

Request payload for this pack (channel/genre/mood/season context, already-used titles/hooks to avoid, and this pack's preassigned title/hook per track):
```json
{
  "channel": {
    "id": "after-hours-deep-house",
    "name": "After Hours Deep House",
    "englishName": "After Hours Deep House",
    "market": "global",
    "primaryLanguage": "english",
    "audience": "twenties",
    "promise": "Melodic and organic deep house for a night drive that never quite wants to end",
    "visualIdentity": "neon skyline reflected on wet asphalt, wide-format night photography, minimal sans-serif typography",
    "defaultVocal": "clear English vocal hook riding the drop, breathy layered ad-libs, understated delivery",
    "preferredGenres": [
      "en-deep-house-melodic",
      "en-deep-house-organic",
      "en-house-garage-swing",
      "alt-rnb"
    ],
    "preferredMoods": [
      "intimate",
      "energetic"
    ],
    "forbiddenCliches": [
      "specific DJ or producer imitation",
      "named artist vocal timbre",
      "signature hook of an existing song",
      "aggressive festival EDM drop",
      "drug-use imagery",
      "explicit club-hookup narrative"
    ],
    "seoKeywords": [
      "deep house playlist",
      "melodic deep house mix",
      "night drive house music",
      "organic deep house",
      "garage house playlist",
      "late night deep house"
    ],
    "archetype": "en-chillhop"
  },
  "projectTitle": "Test Pack",
  "songCount": 12,
  "lyricLanguage": "english",
  "market": "global",
  "audience": "twenties",
  "generationPack": {
    "id": "twenties",
    "label": "20s",
    "audienceNote": "city life, workday reset, new relationships, late-night reflection",
    "lyricGuidance": [
      "conversational verses",
      "modern emotional detail",
      "compact hook",
      "playlist-friendly English works well"
    ],
    "tempoBias": "medium groove, lofi or city-pop accents allowed",
    "youtubeAngle": "cafe, work, night drive, study, and chill playlist angles"
  },
  "genrePacks": [
    {
      "id": "en-deep-house-melodic",
      "label": "Melodic Deep House",
      "styleCore": "melodic deep house, warm rolling four-on-the-floor groove, emotive analog synth lead, clear English vocal hook riding the chorus",
      "instruments": [
        "four-on-the-floor electronic kick",
        "warm rolling sub bass",
        "emotive analog synth lead",
        "plucked chord stab",
        "filtered hi-hat groove"
      ],
      "tempoRange": [
        112,
        122
      ],
      "goodFor": [
        "멜로딕 딥하우스",
        "night drive",
        "festival sunset set"
      ],
      "archetypes": [
        "en-chillhop"
      ],
      "tier": "core",
      "eraTag": "2010s-2020s melodic deep house",
      "categoryId": "electronic",
      "source": "legacy-preset",
      "rhythm": [
        "rolling four-on-the-floor deep-house groove",
        "syncopated off-beat hi-hat pattern"
      ],
      "vocal": [
        "clear English vocal hook carrying the drop",
        "layered vocal-chop answering the lead"
      ],
      "production": [
        "warm analog-modeled synth mix",
        "wide stereo pad bed"
      ],
      "harmony": [
        "emotive minor-to-major chord lift",
        "suspended pad vamp under the hook"
      ],
      "tempo": [
        112,
        122
      ],
      "moods": [
        "uplifting",
        "emotive",
        "nocturnal"
      ],
      "audiences": [
        "멜로딕 딥하우스",
        "나이트 드라이브"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "aggressive festival EDM drop",
        "bright major-key pop hook",
        "trap hi-hat rolls"
      ],
      "shortPrompt": "Melodic Deep House, rolling four-on-the-floor deep-house groove, clear English vocal hook carrying the drop, four-on-the-floor electronic kick + warm rolling sub bass, warm analog-modeled synth mix, 112-122 BPM",
      "productionGuidance": "Melodic Deep House: build around rolling four-on-the-floor deep-house groove and syncopated off-beat hi-hat pattern, keep clear English vocal hook carrying the drop, feature four-on-the-floor electronic kick, warm rolling sub bass, emotive analog synth lead, plucked chord stab, use emotive minor-to-major chord lift, mix with warm analog-modeled synth mix and wide stereo pad bed, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "four-on-the-floor electronic kick, warm rolling sub bass, emotive analog synth lead, melodic deep house"
    },
    {
      "id": "en-deep-house-organic",
      "label": "Organic Deep House",
      "styleCore": "organic deep house, acoustic-textured hand percussion, warm live-style bass groove, soft instrumental focus with sparse vocal texture",
      "instruments": [
        "organic hand-percussion layer",
        "warm live-style bass groove",
        "soft Rhodes chord stab",
        "filtered analog pad",
        "brushed shaker loop"
      ],
      "tempoRange": [
        108,
        118
      ],
      "goodFor": [
        "오가닉 딥하우스",
        "sunset terrace",
        "late afternoon lounge"
      ],
      "archetypes": [
        "en-chillhop"
      ],
      "tier": "core",
      "eraTag": "2010s-2020s organic deep house",
      "categoryId": "electronic",
      "source": "legacy-preset",
      "rhythm": [
        "organic hand-percussion deep-house groove",
        "loose swung hi-hat pattern"
      ],
      "vocal": [
        "sparse breathy vocal texture used as a color, not a lead",
        "wordless vocal-sample chop"
      ],
      "production": [
        "warm acoustic-electronic hybrid mix",
        "natural room ambience on the percussion"
      ],
      "harmony": [
        "warm modal chord loop",
        "soft major seventh color"
      ],
      "tempo": [
        108,
        118
      ],
      "moods": [
        "warm",
        "organic",
        "relaxed"
      ],
      "audiences": [
        "오가닉 딥하우스",
        "선셋 라운지"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "aggressive EDM drop",
        "harsh digital synth stab",
        "busy trap hi-hat rolls"
      ],
      "shortPrompt": "Organic Deep House, organic hand-percussion deep-house groove, sparse breathy vocal texture used as a color, not a lead, organic hand-percussion layer + warm live-style bass groove, warm acoustic-electronic hybrid mix, 108-118 BPM",
      "productionGuidance": "Organic Deep House: build around organic hand-percussion deep-house groove and loose swung hi-hat pattern, keep sparse breathy vocal texture used as a color, not a lead, feature organic hand-percussion layer, warm live-style bass groove, soft Rhodes chord stab, filtered analog pad, use warm modal chord loop, mix with warm acoustic-electronic hybrid mix and natural room ambience on the percussion, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "organic hand-percussion layer, warm live-style bass groove, soft Rhodes chord stab, organic deep house"
    },
    {
      "id": "en-house-garage-swing",
      "label": "Garage Swing House",
      "styleCore": "garage swing house, swung UK-garage-flavored shuffle groove, bright chopped vocal-sample hook, bouncy sub bass",
      "instruments": [
        "swung garage-house drum shuffle",
        "bouncy sub bass",
        "chopped vocal-sample stab",
        "bright piano chord stab",
        "filtered string swell"
      ],
      "tempoRange": [
        118,
        128
      ],
      "goodFor": [
        "개러지 스윙 하우스",
        "weekend dance mood",
        "club warm-up set"
      ],
      "archetypes": [
        "en-chillhop"
      ],
      "tier": "core",
      "eraTag": "2010s-2020s garage swing house",
      "categoryId": "electronic",
      "source": "legacy-preset",
      "rhythm": [
        "swung UK-garage-flavored shuffle groove",
        "bouncy syncopated bassline pocket"
      ],
      "vocal": [
        "bright chopped vocal-sample hook",
        "call-and-response vocal stab"
      ],
      "production": [
        "crisp club-ready mix",
        "bright filtered top end"
      ],
      "harmony": [
        "bright major chord stab loop",
        "syncopated piano chord vamp"
      ],
      "tempo": [
        118,
        128
      ],
      "moods": [
        "bouncy",
        "bright",
        "energetic"
      ],
      "audiences": [
        "개러지 스윙 하우스",
        "위켄드 댄스"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "aggressive dubstep bass wobble",
        "slow ballad pacing",
        "vintage tape saturation"
      ],
      "shortPrompt": "Garage Swing House, swung UK-garage-flavored shuffle groove, bright chopped vocal-sample hook, swung garage-house drum shuffle + bouncy sub bass, crisp club-ready mix, 118-128 BPM",
      "productionGuidance": "Garage Swing House: build around swung UK-garage-flavored shuffle groove and bouncy syncopated bassline pocket, keep bright chopped vocal-sample hook, feature swung garage-house drum shuffle, bouncy sub bass, chopped vocal-sample stab, bright piano chord stab, use bright major chord stab loop, mix with crisp club-ready mix and bright filtered top end, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "swung garage-house drum shuffle, bouncy sub bass, chopped vocal-sample stab, garage swing house"
    }
  ],
  "moodPacks": [
    {
      "id": "energetic",
      "label": "Energetic",
      "emotionWords": [
        "energetic",
        "electric",
        "high-voltage"
      ],
      "lyricImages": [
        "pounding bass",
        "strobe light",
        "packed floor",
        "racing pulse"
      ]
    },
    {
      "id": "intimate",
      "label": "Intimate",
      "emotionWords": [
        "intimate",
        "close",
        "hushed"
      ],
      "lyricImages": [
        "low light",
        "close whisper",
        "quiet room",
        "held hand"
      ]
    }
  ],
  "season": {
    "id": "new-year",
    "label": "New Year Reset",
    "period": "January",
    "keywords": [
      "new year",
      "first morning",
      "fresh calendar"
    ],
    "visualDirection": "clean white desk, warm sunlight, simple calendar, no party clutter"
  },
  "vocalTone": "clear English vocal hook riding the drop, breathy layered ad-libs, understated delivery",
  "perspective": "firstPerson",
  "lyricDepth": "commercial",
  "moneyChordMode": "default",
  "customConcept": "딥 하우스",
  "avoidWords": "",
  "negativeStyle": "flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative",
  "japaneseEraLyricGuidance": "",
  "introUniqueness": 50,
  "diversityAllocations": [],
  "earwormMode": false,
  "trackNoOffset": 0,
  "totalSongCount": 12,
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
        "title": "string — English",
        "seasonMoment": "string",
        "listenerSituation": "string",
        "emotionArc": "string",
        "distinctChoice": {
          "ruleId": "string — one of the ruleId values listed in the [각 곡에 하나씩] guidance below for this workspace",
          "descriptionKo": "string — one Korean sentence: what THIS song does differently from the rest of the set",
          "params": "object optional — only when the chosen rule requires it (see guidance below for which ones)"
        },
        "hookPhrase": "string",
        "stylePrompt": "string",
        "excludePrompt": "string; Suno Exclude styles text, never mixed into stylePrompt. Target 750-850 chars, hard cap 900 — comma-separated phrases, no duplicate singular/plural pairs (\"copied melody\" and \"copied melodies\" together), no phrase that is just a shorter version of another phrase already in the list (e.g. do not include both \"sub bass\" and \"heavy sub bass\"). CRITICAL — this must be DIFFERENT per song, not one shared blob copy-pasted across the set: the safety/copyright/channel-hard-exclusion items are the same for every song in this pack, but everything beyond those must reflect what could ACTUALLY go wrong for THIS song specifically — its own genre, tempo, vocal, and arrangement. Do not name a production risk that arrangement could never produce (an acoustic ballad excluding \"trap hi-hats\" or \"aggressive EDM drops\" is a tell that this list wasn't actually written for this song). Priority when trimming to fit: (1) copyright/artist-imitation safety terms, (2) this channel/audience's own hard exclusions, (3) era-consistency terms, (4) this song's own genre/arrangement-specific risks — cut from (4) first, but never cut it to zero; a list with nothing but tier 1-3 items on every song is itself the collision this instruction exists to prevent. CRITICAL — never exclude an instrument, playing technique, or production texture that is part of THIS track's own era/genre signature, not even qualified (\"crowded clavinet comping\", \"funk clavinet groove\", \"wah guitar accents\" all read to Suno as \"no clavinet\" / \"no wah guitar\"). Real measured mistake: a 1970s kayokyoku pack excluded exactly the two instruments that era is built on, so the era-defining sound was cancelled by the song's own exclude list. If the risk you mean is that the part gets too busy, say that as a positive arrangement clause in the stylePrompt instead (e.g. \"sparse clavinet comping under the vocal\") and leave the instrument out of the exclude list entirely.",
        "lyrics": "string with section tags following the assigned structureTemplate's exact order (see the structure-template legend below) — the final section (e.g. final chorus) is the LAST thing in the string; do not add a trailing [end] or [outro] tag after it",
        "youtube": {
          "title": "string",
          "description": "string",
          "tags": [
            "string"
          ]
        },
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
        "effectiveVocalPresetId": "string optional; copy from preassignedSongs if present",
        "vocalPresetSource": "'plan' | 'tone-match' | 'auto' optional; copy from preassignedSongs if present",
        "qualityScore": 0,
        "warnings": []
      }
    ]
  },
  "preassignedSongs": [
    {
      "trackNo": 1,
      "title": "I Know You're Near",
      "hookPhrase": "I Know You're Near",
      "songRole": "cold-open",
      "tempo": 68,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        157,
        219
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "alt-rnb",
      "genreText": "alternative R&B, filtered synth pad, minimal R&B drums",
      "signatureSound": "filtered synth pad, minimal R&B drums, deep sub bass, BPM 68-86; Verse stays close and weightless over a slow 16th-note pocket",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, bright EDM supersaw, hard autotune lead, busy acoustic cafe strumming, bright major-key pop hook, harsh digital synth stab",
      "introTextureText": "glockenspiel-like bell synth intro texture (INTRO ONLY)",
      "introTextureId": "syn_bell_glock",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "chorusContrastPlanId": "strings-swell",
      "chorusContrastText": "Verse: verse stays intimate — guitar, upright bass, soft kick / Chorus: string section swells in, backing harmony stacks, fuller low end",
      "chorusContrastScore": 55,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "jazzColor"
        },
        {
          "section": "Chorus",
          "chordId": "royalRoad"
        }
      ],
      "moneyChordSectionText": "Verse: ii-V-I turnaround, maj7 add9 color / Chorus: IV-V-iii-vi royal road progression",
      "openingLoudnessText": "full arrangement from the first bar",
      "arcPhase": "opening",
      "intensity": 2,
      "peakStrength": "none",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "68 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "alt-rnb",
        "en-deep-house-melodic",
        "en-deep-house-organic"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "filtered synth pad",
        "minimal R&B drums"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T1",
      "introMode": "vocal-immediate",
      "lyricTheme": "enchillhop-walking-block-earbuds-in",
      "lyricThemeText": "walking the same six blocks home with earbuds in, timing footsteps to a half-remembered beat",
      "lyricThemeArc": "aimless wandering resolving into a steady, grounded rhythm",
      "lyricFrameId": "commute-transit",
      "lyricThemeMotionKo": "이동 중(도보)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-commute-drive",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "call and answer, wide octave harmony, chamber ambience, male and female duet, rasping ad-lib stack on the bridge",
      "vocalVariantText": "call and answer, wide octave harmony, chamber ambience, male and female duet, rasping ad-lib stack on the bridge",
      "vocalTechniqueText": "rasping ad-lib stack on the bridge",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 2,
      "title": "Breathe with Me, Morning",
      "hookPhrase": "Breathe with Me, Morning",
      "songRole": "flagship",
      "tempo": 122,
      "sectionCountRange": [
        11,
        13
      ],
      "wordCountRange": [
        181,
        243
      ],
      "maxInstrumentalSections": 5,
      "estimatedLengthSec": 190,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift",
      "genreId": "en-house-garage-swing",
      "genreText": "garage swing house, swung garage-house drum shuffle, bouncy sub bass, bright chopped vocal-sample hook",
      "signatureSound": "swung garage-house drum shuffle, bouncy sub bass, chopped vocal-sample stab, garage swing house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, aggressive dubstep bass wobble, slow ballad pacing, bright major-key pop hook, harsh digital synth stab",
      "eraPaletteText": "phrase clipped short so the groove carries the gap, sixteen-bar build and drop shaping the whole track, dry tight club low end with the kick and sub locked together",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "chorusContrastPlanId": "unison-doubling",
      "chorusContrastText": "Verse: verse carried by piano and soft brushes / Chorus: chorus doubles the lead vocal in unison, adds tambourine and organ pad",
      "chorusContrastScore": 49,
      "openingLoudnessText": "no quiet fade-in — already at full level from the start",
      "killingPointText": "rising synth filter sweep into the chorus",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-07",
      "eraTag": "2010s-2020s garage swing house",
      "arcPhase": "opening",
      "intensity": 2,
      "peakStrength": "subtle",
      "perceivedEnergy": 4,
      "perceivedEnergyReasonKo": "122 BPM + bouncy + warm baritone → 높음",
      "moneyChordId": "emotional",
      "effectiveMoneyChordId": "emotional",
      "effectiveGenreIds": [
        "en-house-garage-swing",
        "en-deep-house-melodic",
        "en-deep-house-organic"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "swung garage-house drum shuffle",
        "bouncy sub bass",
        "four-on-the-floor electronic kick"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "introMode": "vocal-after-texture",
      "lyricTheme": "enchillhop-bedroom-studio-setup",
      "lyricThemeText": "sitting at a small bedroom studio desk past midnight, one lamp on, headphones half off one ear",
      "lyricThemeArc": "scattered self-doubt narrowing into focused, patient work",
      "lyricFrameId": "solitary-room",
      "lyricThemeMotionKo": "정적",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-solitary-room",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "male low warm baritone, gentle swung phrasing, soft husky grain, chamber ambience, husky ache on the closing line, staccato pulse breaking the legato line",
      "vocalVariantText": "male low warm baritone, gentle swung phrasing, soft husky grain, chamber ambience, husky ache on the closing line, staccato pulse breaking the legato line",
      "vocalTechniqueText": "husky ache on the closing line, staccato pulse breaking the legato line",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 3,
      "title": "Stay with Me Tonight",
      "hookPhrase": "Stay with Me Tonight",
      "songRole": "flagship",
      "tempo": 111,
      "sectionCountRange": [
        11,
        13
      ],
      "wordCountRange": [
        178,
        241
      ],
      "maxInstrumentalSections": 5,
      "estimatedLengthSec": 190,
      "emotionArc": "quiet contentment resting undisturbed throughout",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "en-deep-house-organic",
      "genreText": "organic deep house, organic hand-percussion layer, warm live-style bass groove",
      "signatureSound": "organic hand-percussion layer, warm live-style bass groove, soft Rhodes chord stab, organic deep house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, harsh digital synth stab, busy trap hi-hat rolls, bright major-key pop hook, aggressive dubstep bass wobble, slow ballad pacing",
      "eraPaletteText": "filtered analog pad opening across eight bars, long filter sweeps doing the arranging instead of new parts, dry tight club low end with the kick and sub locked together",
      "introTextureText": "warm Rhodes riff intro texture (INTRO ONLY)",
      "introTextureId": "ep_rhodes_riff",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "chorusContrastPlanId": "full-band-swell",
      "chorusContrastText": "Verse: sparse verse — guitar and voice only / Chorus: full band enters — bass, drums, string pad, doubled vocal",
      "chorusContrastScore": 68,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "jazzColor"
        },
        {
          "section": "Chorus",
          "chordId": "royalRoad"
        }
      ],
      "moneyChordSectionText": "Verse: ii-V-I turnaround, maj7 add9 color / Chorus: IV-V-iii-vi royal road progression",
      "openingLoudnessText": "opening is as loud and full as the chorus",
      "killingPointText": "drums thin to just the kick for two bars",
      "killingPointPlacement": "bridge",
      "killingPointId": "KP-KR2030-08",
      "eraTag": "2010s-2020s organic deep house",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "111 BPM + breathy → 중간",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "en-deep-house-organic",
        "en-deep-house-melodic",
        "en-house-garage-swing"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "organic hand-percussion layer",
        "warm live-style bass groove"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T5",
      "introMode": "vocal-after-texture",
      "lyricTheme": "enchillhop-drive-through-neon-order",
      "lyricThemeText": "pulling up to a neon-lit drive-through at 3am, ordering just to have somewhere to be for five minutes",
      "lyricThemeArc": "aimless drifting turning into small, self-aware amusement",
      "lyricFrameId": "night-drive",
      "lyricThemeMotionKo": "이동 중(드라이브)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-commute-drive",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "female low warm contralto, bright forward delivery, velvety low resonance, chamber ambience, controlled vibrato on the closing note",
      "vocalVariantText": "female low warm contralto, bright forward delivery, velvety low resonance, chamber ambience, controlled vibrato on the closing note",
      "vocalTechniqueText": "controlled vibrato on the closing note",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 4,
      "title": "Wait by the Window",
      "hookPhrase": "Wait by the Window",
      "songRole": "steady heartfelt build",
      "tempo": 119,
      "sectionCountRange": [
        11,
        13
      ],
      "wordCountRange": [
        180,
        243
      ],
      "maxInstrumentalSections": 5,
      "estimatedLengthSec": 191,
      "emotionArc": "steady peace held gently, start to end",
      "moneyChordText": "vi-IV-I-V movement, maj7 color",
      "genreId": "en-deep-house-melodic",
      "genreText": "melodic deep house, four-on-the-floor electronic kick, warm rolling sub bass, layered vocal-chop answering the lead",
      "signatureSound": "four-on-the-floor electronic kick, warm rolling sub bass, emotive analog synth lead, melodic deep house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, bright major-key pop hook, harsh digital synth stab, busy trap hi-hat rolls, aggressive dubstep bass wobble, slow ballad pacing",
      "eraPaletteText": "phrase clipped short so the groove carries the gap, sixteen-bar build and drop shaping the whole track, dry tight club low end with the kick and sub locked together",
      "introTextureText": "soft synth arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "syn_soft_arp",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "chorusContrastPlanId": "harmony-lift",
      "chorusContrastText": "Verse: acoustic guitar + bass + light drums / Chorus: + piano + vocal harmony + firmer snare + wider stereo",
      "chorusContrastScore": 56,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "cityPop"
        },
        {
          "section": "Chorus",
          "chordId": "jazzColor"
        },
        {
          "section": "Bridge",
          "chordId": "marusa"
        }
      ],
      "moneyChordSectionText": "Verse: vi-IV-I-V movement, maj7 color / Chorus: ii-V-I turnaround, maj7 add9 color / Bridge: IVM7-III7-vi-I7 marusa progression",
      "killingPointText": "the groove shifts into a half-time feel for the bridge",
      "killingPointPlacement": "bridge",
      "killingPointId": "KP-KR2030-09",
      "eraTag": "2010s-2020s melodic deep house",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 4,
      "perceivedEnergyReasonKo": "119 BPM + four-on-the-floor → 높음",
      "moneyChordId": "cityPop",
      "effectiveMoneyChordId": "cityPop",
      "effectiveGenreIds": [
        "en-deep-house-melodic",
        "en-deep-house-organic",
        "en-house-garage-swing"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "four-on-the-floor electronic kick",
        "warm rolling sub bass",
        "organic hand-percussion layer"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "introMode": "vocal-immediate",
      "lyricTheme": "enchillhop-diner-booth-catch-up",
      "lyricThemeText": "sliding into a diner booth with an old friend at midnight, catching up over cold fries and refilled coffee",
      "lyricThemeArc": "initial distance warming into familiar, easy comfort",
      "lyricFrameId": "two-people-talk",
      "lyricThemeCastKo": "둘",
      "vocabularyBankId": "kr2030-two-people",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "trading lines mid-phrase, loose lines meeting hook, warm natural room, male and female duet, vibrato taper on the sustained hook",
      "vocalVariantText": "trading lines mid-phrase, loose lines meeting hook, warm natural room, male and female duet, vibrato taper on the sustained hook",
      "vocalTechniqueText": "vibrato taper on the sustained hook",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 5,
      "title": "While",
      "hookPhrase": "Stay a While, Darling",
      "songRole": "brighter sing-along track",
      "tempo": 76,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        172,
        234
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "bittersweet reflection to gentle lift",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "alt-rnb",
      "genreText": "alternative R&B, filtered synth pad, minimal R&B drums",
      "signatureSound": "filtered synth pad, minimal R&B drums, deep sub bass, BPM 68-86; Verse stays close and weightless over a slow 16th-note pocket",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, bright EDM supersaw, hard autotune lead, busy acoustic cafe strumming, bright major-key pop hook, harsh digital synth stab",
      "introTextureText": "rap-delivery lead-in before the beat fully lands intro texture (INTRO ONLY)",
      "introTextureId": "kpop_rap_lead_in",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "chorusContrastPlanId": "gentle-second-voice",
      "chorusContrastText": "Verse: verse — acoustic guitar and voice / Chorus: chorus adds only a second vocal harmony line, everything else holds steady",
      "chorusContrastScore": 46,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "jazzColor"
        },
        {
          "section": "Chorus",
          "chordId": "royalRoad"
        }
      ],
      "moneyChordSectionText": "Verse: ii-V-I turnaround, maj7 add9 color / Chorus: IV-V-iii-vi royal road progression",
      "killingPointText": "a stuttered vocal chop punctuates the pre-chorus",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-10",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "76 BPM + alto → 낮음",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "alt-rnb",
        "en-deep-house-melodic",
        "en-deep-house-organic"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "filtered synth pad",
        "minimal R&B drums"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-walking-away-for-good",
      "lyricThemeText": "standing at a doorway deciding, for the last time, whether to turn back or keep walking",
      "lyricThemeArc": "aching hesitation hardening into clear-eyed release",
      "lyricFrameId": "threshold-decision",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-threshold",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "female mid clear alto, light rhythmic phrasing, slight smoky depth, dry and forward, breathy pocket phrasing behind the beat",
      "vocalVariantText": "female mid clear alto, light rhythmic phrasing, slight smoky depth, dry and forward, breathy pocket phrasing behind the beat",
      "vocalTechniqueText": "breathy pocket phrasing behind the beat",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 6,
      "title": "Where Did the Summer Go",
      "hookPhrase": "I Still Wait for You",
      "songRole": "late-set emotional center",
      "tempo": 116,
      "sectionCountRange": [
        11,
        13
      ],
      "wordCountRange": [
        183,
        246
      ],
      "maxInstrumentalSections": 6,
      "estimatedLengthSec": 190,
      "emotionArc": "quiet longing swelling into overwhelming feeling",
      "moneyChordText": "vi-IV-I-V movement, maj7 color",
      "genreId": "en-deep-house-organic",
      "genreText": "organic deep house, organic hand-percussion layer, warm live-style bass groove",
      "signatureSound": "organic hand-percussion layer, warm live-style bass groove, soft Rhodes chord stab, organic deep house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, harsh digital synth stab, busy trap hi-hat rolls, bright major-key pop hook, aggressive dubstep bass wobble, slow ballad pacing",
      "eraPaletteText": "minor-to-major lift arriving only at the drop, dry tight club low end with the kick and sub locked together, sixteen-bar build and drop shaping the whole track",
      "introTextureText": "bright synth pluck intro texture (INTRO ONLY)",
      "introTextureId": "syn_bright_pluck",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "chorusContrastPlanId": "strings-swell",
      "chorusContrastText": "Verse: verse stays intimate — guitar, upright bass, soft kick / Chorus: string section swells in, backing harmony stacks, fuller low end",
      "chorusContrastScore": 55,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "cityPop"
        },
        {
          "section": "Chorus",
          "chordId": "marusa"
        }
      ],
      "moneyChordSectionText": "Verse: vi-IV-I-V movement, maj7 color / Chorus: IVM7-III7-vi-I7 marusa progression",
      "killingPointText": "sidechain pump under the final chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-KR2030-12",
      "eraTag": "2010s-2020s organic deep house",
      "arcPhase": "peak",
      "intensity": 5,
      "peakStrength": "strong",
      "perceivedEnergy": 4,
      "perceivedEnergyReasonKo": "116 BPM + breathy → 높음",
      "moneyChordId": "cityPop",
      "effectiveMoneyChordId": "cityPop",
      "effectiveGenreIds": [
        "en-deep-house-organic",
        "en-deep-house-melodic",
        "en-house-garage-swing"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "organic hand-percussion layer",
        "filtered analog pad"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-show-not-dancing-watching",
      "lyricThemeText": "standing near the back of a small show, arms crossed, watching the set instead of losing themselves in it",
      "lyricThemeArc": "guarded distance loosening into quiet appreciation",
      "lyricFrameId": "crowd-alone",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "unison splitting to thirds, tight unison with light detune, narrow mono-leaning room, male and female duet, legato ache opening into the bridge",
      "vocalVariantText": "unison splitting to thirds, tight unison with light detune, narrow mono-leaning room, male and female duet, legato ache opening into the bridge",
      "vocalTechniqueText": "legato ache opening into the bridge",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 7,
      "title": "Coming",
      "hookPhrase": "I'm Coming Home",
      "songRole": "big emotional high point",
      "tempo": 127,
      "sectionCountRange": [
        13,
        15
      ],
      "wordCountRange": [
        182,
        244
      ],
      "maxInstrumentalSections": 7,
      "estimatedLengthSec": 190,
      "emotionArc": "held-back yearning bursting into radiant relief",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift",
      "genreId": "en-house-garage-swing",
      "genreText": "garage swing house, swung garage-house drum shuffle, bouncy sub bass, bouncy sub bass",
      "signatureSound": "swung garage-house drum shuffle, bouncy sub bass, chopped vocal-sample stab, garage swing house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, aggressive dubstep bass wobble, slow ballad pacing, bright major-key pop hook, harsh digital synth stab",
      "eraPaletteText": "plucked chord stab landing on the off-beat, long filter sweeps doing the arranging instead of new parts, sixteen-bar build and drop shaping the whole track",
      "introTextureText": "clean electric guitar arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "eg_clean_arp",
      "hookDeviceText": "final repeat of the hook sung almost a cappella as the outro tag",
      "hookDeviceId": "acappella-tag",
      "chorusContrastPlanId": "call-response-texture",
      "chorusContrastText": "Verse: verse — lead vocal alone over a light rhythm section / Chorus: backing vocals answer each line, a percussion layer widens the groove",
      "chorusContrastScore": 53,
      "killingPointText": "rising synth arpeggio builds into the final chorus",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-11",
      "eraTag": "2010s-2020s garage swing house",
      "arcPhase": "peak",
      "intensity": 5,
      "peakStrength": "strong",
      "perceivedEnergy": 5,
      "perceivedEnergyReasonKo": "127 BPM + bouncy + bright → 높음",
      "moneyChordId": "emotional",
      "effectiveMoneyChordId": "emotional",
      "effectiveGenreIds": [
        "en-house-garage-swing",
        "en-deep-house-melodic",
        "en-deep-house-organic"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "swung garage-house drum shuffle",
        "bright piano chord stab",
        "bouncy sub bass"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "introMode": "vocal-after-texture",
      "lyricTheme": "enchillhop-crosswalk-waiting-neon",
      "lyricThemeText": "standing at a crosswalk under a neon sign, waiting for the light with a hundred strangers moving around",
      "lyricThemeArc": "restless impatience settling into observant calm",
      "lyricFrameId": "city-lights",
      "lyricThemeMotionKo": "정적",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "city-night",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "male mid baritone-tenor lead, storytelling spoken-edge delivery, slight nasal brightness, soft plate ambience, vibrato hush on the final held note",
      "vocalVariantText": "male mid baritone-tenor lead, storytelling spoken-edge delivery, slight nasal brightness, soft plate ambience, vibrato hush on the final held note",
      "vocalTechniqueText": "vibrato hush on the final held note",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 8,
      "title": "Catch",
      "hookPhrase": "Catch the Morning Train",
      "songRole": "gentle wind-down moment",
      "tempo": 119,
      "sectionCountRange": [
        11,
        13
      ],
      "wordCountRange": [
        180,
        243
      ],
      "maxInstrumentalSections": 5,
      "estimatedLengthSec": 191,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "en-deep-house-melodic",
      "genreText": "melodic deep house, four-on-the-floor electronic kick, warm rolling sub bass, wide stereo pad bed",
      "signatureSound": "four-on-the-floor electronic kick, warm rolling sub bass, emotive analog synth lead, melodic deep house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, bright major-key pop hook, harsh digital synth stab, busy trap hi-hat rolls, aggressive dubstep bass wobble, slow ballad pacing",
      "eraPaletteText": "plucked chord stab landing on the off-beat, long filter sweeps doing the arranging instead of new parts, sixteen-bar build and drop shaping the whole track",
      "introTextureText": "small chime-step synth intro texture (INTRO ONLY)",
      "introTextureId": "syn_chime_steps",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "chorusContrastPlanId": "unison-doubling",
      "chorusContrastText": "Verse: verse carried by piano and soft brushes / Chorus: chorus doubles the lead vocal in unison, adds tambourine and organ pad",
      "chorusContrastScore": 49,
      "killingPointText": "pre-chorus opens up and lifts into the hook",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-01",
      "eraTag": "2010s-2020s melodic deep house",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 4,
      "perceivedEnergyReasonKo": "119 BPM + four-on-the-floor + breathy → 높음",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "en-deep-house-melodic",
        "en-deep-house-organic",
        "en-house-garage-swing"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "four-on-the-floor electronic kick",
        "warm rolling sub bass",
        "emotive analog synth lead"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "introMode": "vocal-immediate",
      "lyricTheme": "enchillhop-passing-the-old-block",
      "lyricThemeText": "driving past the old block where everything started, every corner holding a different memory",
      "lyricThemeArc": "wistful nostalgia settling into grounded gratitude",
      "lyricFrameId": "reunion-passing",
      "lyricThemeMotionKo": "이동 중(드라이브)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-two-people",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "male falsetto-leaning tenor, earnest forward delivery, smoky low resonance, tape slap echo, nasal ache breaking on the peak line, breathy ad-lib on the final line",
      "vocalVariantText": "male falsetto-leaning tenor, earnest forward delivery, smoky low resonance, tape slap echo, nasal ache breaking on the peak line, breathy ad-lib on the final line",
      "vocalTechniqueText": "nasal ache breaking on the peak line, breathy ad-lib on the final line",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 9,
      "title": "Hand Friend & Static",
      "hookPhrase": "Hold My Hand, Friend",
      "songRole": "quiet middle scene",
      "tempo": 77,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        169,
        231
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift",
      "genreId": "alt-rnb",
      "genreText": "alternative R&B, filtered synth pad, minimal R&B drums",
      "signatureSound": "filtered synth pad, minimal R&B drums, deep sub bass, BPM 68-86; Verse stays close and weightless over a slow 16th-note pocket",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, bright EDM supersaw, hard autotune lead, busy acoustic cafe strumming, bright major-key pop hook, harsh digital synth stab",
      "introTextureText": "bright synth pluck intro texture (INTRO ONLY)",
      "introTextureId": "syn_bright_pluck",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "chorusContrastPlanId": "full-band-swell",
      "chorusContrastText": "Verse: sparse verse — guitar and voice only / Chorus: full band enters — bass, drums, string pad, doubled vocal",
      "chorusContrastScore": 68,
      "killingPointText": "short vocal hook tag right after the chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-KR2030-02",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "77 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "emotional",
      "effectiveMoneyChordId": "emotional",
      "effectiveGenreIds": [
        "alt-rnb",
        "en-deep-house-melodic",
        "en-deep-house-organic"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "filtered synth pad",
        "minimal R&B drums"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-walking-home-from-a-set",
      "lyricThemeText": "walking home from a late DJ set with the bassline still echoing faintly in the ears",
      "lyricThemeArc": "electric exhilaration settling into a slow, satisfied glow",
      "lyricFrameId": "after-party",
      "lyricThemeMotionKo": "이동 중(도보)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kridol-f-season",
      "pov": "secondPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "female clear mezzo lead, tender confiding delivery, faint vibrato shimmer, warm natural room, nasal-edged ad-lib stack on the outro",
      "vocalVariantText": "female clear mezzo lead, tender confiding delivery, faint vibrato shimmer, warm natural room, nasal-edged ad-lib stack on the outro",
      "vocalTechniqueText": "nasal-edged ad-lib stack on the outro",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 10,
      "title": "Save the Old Letter",
      "hookPhrase": "Save the Old Letter",
      "songRole": "comforting closer",
      "tempo": 109,
      "sectionCountRange": [
        9,
        11
      ],
      "wordCountRange": [
        182,
        245
      ],
      "maxInstrumentalSections": 4,
      "estimatedLengthSec": 191,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-IV progression",
      "genreId": "en-deep-house-organic",
      "genreText": "organic deep house, organic hand-percussion layer, warm live-style bass groove",
      "signatureSound": "organic hand-percussion layer, warm live-style bass groove, soft Rhodes chord stab, organic deep house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, harsh digital synth stab, busy trap hi-hat rolls, bright major-key pop hook, aggressive dubstep bass wobble, slow ballad pacing",
      "eraPaletteText": "phrase clipped short so the groove carries the gap, sixteen-bar build and drop shaping the whole track, long filter sweeps doing the arranging instead of new parts",
      "introTextureText": "rap-delivery lead-in before the beat fully lands intro texture (INTRO ONLY)",
      "introTextureId": "kpop_rap_lead_in",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
      "chorusContrastPlanId": "gentle-second-voice",
      "chorusContrastText": "Verse: verse — acoustic guitar and voice / Chorus: chorus adds only a second vocal harmony line, everything else holds steady",
      "chorusContrastScore": 46,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "default"
        },
        {
          "section": "Chorus",
          "chordId": "popStandard"
        },
        {
          "section": "Bridge",
          "chordId": "doowop"
        }
      ],
      "moneyChordSectionText": "Verse: I-V-vi-IV progression / Chorus: I-vi-ii-V progression / Bridge: I-vi-IV-V doo-wop progression",
      "killingPointText": "a brief full stop right before the beat drops back in",
      "killingPointPlacement": "mid-instrumental",
      "killingPointId": "KP-KR2030-04",
      "eraTag": "2010s-2020s organic deep house",
      "arcPhase": "closing",
      "intensity": 1,
      "peakStrength": "subtle",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "109 BPM + breathy → 중간",
      "moneyChordId": "default",
      "effectiveMoneyChordId": "default",
      "effectiveGenreIds": [
        "en-deep-house-organic",
        "en-deep-house-melodic",
        "en-house-garage-swing"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "organic hand-percussion layer",
        "soft Rhodes chord stab"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-morning-coffee-run-before-work",
      "lyricThemeText": "grabbing coffee from a corner cart before work, city just waking up around a still-quiet sidewalk",
      "lyricThemeArc": "sleepy sluggishness lifting into a small, hopeful start",
      "lyricFrameId": "daylight-city",
      "lyricThemeMotionKo": "이동 중(도보)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kridol-f-social",
      "pov": "secondPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "alternating verses into joined chorus, close third harmony, chamber ambience, male and female duet, croon softening into the final verse, rasp breaking through the emotional peak",
      "vocalVariantText": "alternating verses into joined chorus, close third harmony, chamber ambience, male and female duet, croon softening into the final verse, rasp breaking through the emotional peak",
      "vocalTechniqueText": "croon softening into the final verse, rasp breaking through the emotional peak",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 11,
      "title": "Photo & Static",
      "hookPhrase": "Hold the Photo Close",
      "songRole": "soft reset before the closing run",
      "tempo": 127,
      "sectionCountRange": [
        13,
        15
      ],
      "wordCountRange": [
        180,
        242
      ],
      "maxInstrumentalSections": 6,
      "estimatedLengthSec": 190,
      "emotionArc": "joyful moment fading into tender wistfulness",
      "moneyChordText": "vi-IV-I-V movement, maj7 color",
      "genreId": "en-house-garage-swing",
      "genreText": "garage swing house, swung garage-house drum shuffle, bouncy sub bass, warm analog-modeled synth mix",
      "signatureSound": "swung garage-house drum shuffle, bouncy sub bass, chopped vocal-sample stab, garage swing house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, aggressive dubstep bass wobble, slow ballad pacing, bright major-key pop hook, harsh digital synth stab",
      "eraPaletteText": "minor-to-major lift arriving only at the drop, dry tight club low end with the kick and sub locked together, long filter sweeps doing the arranging instead of new parts",
      "introTextureText": "muted acoustic strum intro texture (INTRO ONLY)",
      "introTextureId": "ag_muted_strum",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "chorusContrastPlanId": "harmony-lift",
      "chorusContrastText": "Verse: acoustic guitar + bass + light drums / Chorus: + piano + vocal harmony + firmer snare + wider stereo",
      "chorusContrastScore": 56,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "cityPop"
        },
        {
          "section": "Chorus",
          "chordId": "default"
        }
      ],
      "moneyChordSectionText": "Verse: vi-IV-I-V movement, maj7 color / Chorus: I-V-vi-IV progression",
      "killingPointText": "arrangement thins out then re-enters full for the last chorus",
      "killingPointPlacement": "bridge",
      "killingPointId": "KP-KR2030-03",
      "eraTag": "2010s-2020s garage swing house",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 5,
      "perceivedEnergyReasonKo": "127 BPM + bouncy + legato sustained → 높음",
      "moneyChordId": "cityPop",
      "effectiveMoneyChordId": "cityPop",
      "effectiveGenreIds": [
        "en-house-garage-swing",
        "en-deep-house-melodic",
        "en-deep-house-organic"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "swung garage-house drum shuffle",
        "bright piano chord stab",
        "bouncy sub bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T1",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-rewatching-a-voice-memo",
      "lyricThemeText": "replaying an old voice memo from a friend who moved away, hearing a laugh that time has softened",
      "lyricThemeArc": "quiet longing warming into grateful remembrance",
      "lyricFrameId": "screen-memory",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-solitary-room",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "male bright tenor lead, legato sustained lines, warm woody midrange, intimate close-mic, breathy vibrato easing into the chorus",
      "vocalVariantText": "male bright tenor lead, legato sustained lines, warm woody midrange, intimate close-mic, breathy vibrato easing into the chorus",
      "vocalTechniqueText": "breathy vibrato easing into the chorus",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 12,
      "title": "We Made It Through",
      "hookPhrase": "We Made It Through",
      "songRole": "warm goodnight track",
      "tempo": 114,
      "sectionCountRange": [
        11,
        13
      ],
      "wordCountRange": [
        183,
        246
      ],
      "maxInstrumentalSections": 6,
      "estimatedLengthSec": 191,
      "emotionArc": "old regret to peaceful closure",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression",
      "genreId": "en-deep-house-melodic",
      "genreText": "melodic deep house, four-on-the-floor electronic kick, warm rolling sub bass, crisp club-ready mix",
      "signatureSound": "four-on-the-floor electronic kick, warm rolling sub bass, emotive analog synth lead, melodic deep house",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific DJ or producer imitation, named artist vocal timbre, signature hook of an existing song, aggressive festival EDM drop, drug-use imagery, explicit club-hookup narrative, overlong intro, bright major-key pop hook, harsh digital synth stab, busy trap hi-hat rolls, aggressive dubstep bass wobble, slow ballad pacing",
      "eraPaletteText": "minor-to-major lift arriving only at the drop, dry tight club low end with the kick and sub locked together, long filter sweeps doing the arranging instead of new parts",
      "introTextureText": "small chime-step synth intro texture (INTRO ONLY)",
      "introTextureId": "syn_chime_steps",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "chorusContrastPlanId": "call-response-texture",
      "chorusContrastText": "Verse: verse — lead vocal alone over a light rhythm section / Chorus: backing vocals answer each line, a percussion layer widens the groove",
      "chorusContrastScore": 53,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "canon"
        },
        {
          "section": "Chorus",
          "chordId": "default"
        }
      ],
      "moneyChordSectionText": "Verse: I-V-vi-iii-IV-I-IV-V progression / Chorus: I-V-vi-IV progression",
      "eraTag": "2010s-2020s melodic deep house",
      "arcPhase": "closing",
      "intensity": 1,
      "peakStrength": "none",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "114 BPM + four-on-the-floor + intimate → 중간",
      "moneyChordId": "canon",
      "effectiveMoneyChordId": "canon",
      "effectiveGenreIds": [
        "en-deep-house-melodic",
        "en-deep-house-organic",
        "en-house-garage-swing"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "four-on-the-floor electronic kick",
        "warm rolling sub bass",
        "plucked chord stab"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T4",
      "introMode": "vocal-after-texture",
      "lyricTheme": "enchillhop-biking-home-late-empty-streets",
      "lyricThemeText": "biking home late through empty streets, the whole city briefly feeling like it belongs to no one else",
      "lyricThemeArc": "wired late-night energy settling into free, weightless ease",
      "lyricFrameId": "night-city-move",
      "lyricThemeMotionKo": "이동 중(자전거)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kridol-m-crew-road",
      "pov": "thirdPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "female narrow intimate lead, restrained understated reading, clean bell tone, narrow mono-leaning room, head-voice lift on the emotional peak",
      "vocalVariantText": "female narrow intimate lead, restrained understated reading, clean bell tone, narrow mono-leaning room, head-voice lift on the emotional peak",
      "vocalTechniqueText": "head-voice lift on the emotional peak",
      "vocalGender": "female",
      "vocalType": "female"
    }
  ],
  "alreadyUsedScenes": [],
  "alreadyUsedLyricLines": [],
  "alreadyUsedOpenings": [],
  "meta": {
    "setName": "20260825_AfterHoursDeepHouse_딥하우스",
    "generatedAt": "2026-08-25T00:55:47.544Z",
    "channelId": "after-hours-deep-house",
    "channelLabel": "After Hours Deep House",
    "conceptLabel": "딥 하우스",
    "songCount": 12,
    "lyricLanguage": "english",
    "bridgeVersion": "0.0.0-dev"
  }
}
```

Output requirement:
- Write a new file named "lyrics/20260825_AfterHoursDeepHouse_딥하우스.json" in the current directory.
- If the "lyrics" folder doesn't exist yet, create it first.
- Never overwrite an existing file. If "lyrics/20260825_AfterHoursDeepHouse_딥하우스.json" already exists, append "_02" (then "_03", etc.) before the .json extension and write there instead.
- Its content must be exactly { "songs": [ ... ] } — 12 objects total, one per song, matching "outputShape.songs[0]" above (title, hookPhrase, stylePrompt, lyrics, seasonMoment, listenerSituation, emotionArc, youtube{title,description,tags}, etc.).
- Optional (recommended): also add a top-level "meta" field alongside "songs" — { "meta": { ... }, "songs": [ ... ] } — copying "meta" from the request payload above verbatim. Do not invent or recompute any of its values yourself.
- "preassignedSongs" gives local planning slots and fallback placeholders. You may use the slot hook or write a new original hook, but the final "hookPhrase" must exactly match the hook line that opens and closes every chorus in that song's lyrics. For the TITLE, use a genuine MIX of shapes across this pack, not one formula repeated on every song: for at least a third of the songs, the title should simply BE the hook line itself (or a near-verbatim variant of it) — this is the single most common title shape in real pop songs of this kind, especially older-pop eras, and titles that never match their own hook read as artificial. For the rest, write independent Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images. [스타일 경향] There's a real tendency to fall into the same "[adjective] [noun]" image-pair shape for every song regardless of which approach you pick — worth watching for and varying against (a short phrase, a question, a name being addressed, a single word), as much as whether the title matches the hook.

- CRITICAL: For every imported song, "hookPhrase" and "lyrics" are treated as a matched pair. The hookPhrase string must appear verbatim in the lyrics as the chorus bookend hook; the import step preserves that pair and will not rewrite hooks to match preassignedSongs.
- Each "preassignedSongs" entry also includes "moneyChordText" ("<progression> - <descriptive phrase>", e.g. "ii-V-I turnaround, maj7 add9 color"). Use the exact chord progression before the " - " in that song's stylePrompt (e.g. track's progression here would be "ii-V-I turnaround, maj7 add9 color") — that harmonic choice is fixed by the app. The descriptive phrase after " - " is reference flavor, not required wording; describe the chorus lift/feel in your own words if you have a better one for this song's era and genre.
- Some "preassignedSongs" entries additionally include "moneyChordSectionText" — this song uses MULTIPLE chord progressions, one per section (e.g. "Verse: I-vi-IV-V doo-wop progression / Chorus: I-V-vi-IV progression"). When present, weave it into that song's stylePrompt VERBATIM as its own comma-separated clauses, one per section, and use THAT instead of the single "moneyChordText" progression for this song. Keep each "Section:" label exactly as given and do not merge sections together — the label is what tells this app it is a section-scoped harmony change, not a contradictory whole-song harmony declaration.
- Each "preassignedSongs" entry also includes "genreText" - the genre/sub-style identity this track must stay recognizably within (do not substitute a different genre or the pack-level genre list). The exact wording is a reference, not a script: compose your own stylePrompt description of this genre rather than copying the phrase verbatim.
- CRITICAL — word order: every stylePrompt MUST OPEN with this track's genre identity, before era, scene, mood, or BPM. The first phrase a listener-facing generator reads must name the genre; era and scene come after it, not before.
  GOOD: "Doo-Wop Close Harmony, 1950s-60s, 68 BPM, ..."
  BAD:  "late-1950s memory through a doo-wop lens, 68 BPM, ..."
  Rewording the genre in your own words is fine (per the line above) — moving it out of first position is not.
- CRITICAL — stylePrompt element order: write each stylePrompt in roughly this order — (1) this track's genre identity, (2-3) TWO short era-production clauses — how a record like this was actually CAPTURED, not what it sounds like emotionally: the room, the tape/console character, the stereo width, the compression, the noise floor. Exactly TWO, and about 45 characters TOTAL — roughly three or four words each. Measured: three front capture clauses, or one long one, pushes the first instrument to 101-114 characters and the genre stops reading. Any FURTHER capture detail this track needs goes right after the instrument block (around position 7-9), not at the very end — that is still far earlier than the back of the prompt, and it keeps the instruments where they belong. (4-6) THREE TO FIVE instruments/rhythm elements from THIS genre (these are what make the genre audibly recognizable — a listener hears the genre through them, not through the genre label alone), (7) the money-chord progression, (8) the lead vocal description, (9) everything else — arrangement density, intro handling, opening-loudness, killing point, and the BPM. The first genre-defining instrument must still appear within roughly the first 100 characters; if your two production clauses are pushing it past that, shorten them rather than moving them. BPM goes near the END: it is a number, so it never competes with the descriptive words for attention, and putting it second wastes the highest-weighted position in the prompt on something that reads the same wherever it sits. Do not repeat a descriptor that already appears elsewhere in the same prompt — a repeated word buys nothing and costs a slot. The one exception is the mandatory duration phrase, which always stays verbatim: because it already contains "full arrangement", describe this song's density some other way (e.g. "layered strings behind the chorus", "spare and voice-forward") rather than saying "full arrangement" twice.
  GOOD: "1970s Japanese kayokyoku, narrow stereo image, analog tape saturation, live brass section, sweeping strings, brushed drums, warm bass, I-vi-IV-V doo-wop progression, mature lead vocal sung to a live band take, timing drifting by a hair, ... , 69 BPM"
  BAD:  "1970s Japanese kayokyoku, 69 BPM, mature elegant female mezzo-soprano lead, tender confiding delivery, soft breathy grain, stepwise three-note hook, no intro tag, ... , analog tape warmth, spring plate ambience, narrow stereo" (the three clauses that actually place this in 1970s Japan sit at positions 16-18, behind six clauses of timbre a present-day singer would satisfy just as well — this is the exact shape a real measured pack came back in)
- Each "preassignedSongs" entry also includes "tempo" - use exactly that BPM number in that song's stylePrompt (e.g. "96 BPM"), verbatim. Do not invent a different tempo.
CRITICAL — length: each track's "Length target" column above gives that track's own section count, word count, and maximum instrumental-only-section count (counting the intro if it has no lyrics) — these already account for that track's own tempo (a slower BPM gets a SHORTER structure, and a faster BPM needs MORE sections, so the clock-time length still lands in the pack's target range). These are hard limits, not suggestions: going over the word/section count is a failure condition for that track, the same as missing its hookPhrase or tempo. Do not add an extra instrumental break, extended outro, or additional section beyond what that count allows just because the tempo feels slow, and do not pad a slow track's lyrics past its word ceiling because it "feels short on the page" — a short lyric at a slow tempo is correct, not unfinished; a slow track staying within its own target is what keeps it from running long.

[Slow-tempo tracks — read before writing these]
- Track 1 is slow — 68 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 157-219 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 157-219 words already fills the pack's target song length.
- Track 5 is slow — 76 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 172-234 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 172-234 words already fills the pack's target song length.
- Track 9 is slow — 77 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 169-231 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 169-231 words already fills the pack's target song length.

[Fast-tempo tracks — section floor, read before writing these]
At these tempos every bar is short, so the SAME section count that fills 3:20 at 77 BPM only fills about 1:58 at 114 BPM. This is a real measurement, not an estimate: a 114 BPM track carrying the most lyrics in its whole pack still came back at 1:58 because it had 7 sections. Writing "3:10-3:35" into the stylePrompt does not fix it — Suno follows the section structure of the lyrics, so the section count below is what actually sets the length.
Fill the extra sections with INSTRUMENTAL-only sections, never with more sung verses — that is what the larger "max instrumental sections" number on these tracks is for. Splitting the same words across more vocal sections makes every section thin; a build-up intro, a breakdown, an instrumental break, or an outro adds real clock time without diluting the writing.
- Track 2 — 122 BPM: MUST have at least 11 sections (target 11-13). Its assigned structure template (T2) is the VOCAL SPINE only; wrap 4 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 3 — 111 BPM: MUST have at least 11 sections (target 11-13). Its assigned structure template (T5) is the VOCAL SPINE only; wrap 4 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 4 — 119 BPM: MUST have at least 11 sections (target 11-13). Its assigned structure template (T2) is the VOCAL SPINE only; wrap 4 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 6 — 116 BPM: MUST have at least 11 sections (target 11-13). Its assigned structure template (T4) is the VOCAL SPINE only; wrap 5 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 7 — 127 BPM: MUST have at least 13 sections (target 13-15). Its assigned structure template (T2) is the VOCAL SPINE only; wrap 6 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 8 — 119 BPM: MUST have at least 11 sections (target 11-13). Its assigned structure template (T2) is the VOCAL SPINE only; wrap 4 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 10 — 109 BPM: MUST have at least 9 sections (target 9-11). Its assigned structure template (T4) is the VOCAL SPINE only; wrap 3 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 11 — 127 BPM: MUST have at least 13 sections (target 13-15). Its assigned structure template (T1) is the VOCAL SPINE only; wrap 5 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 12 — 114 BPM: MUST have at least 11 sections (target 11-13). Its assigned structure template (T4) is the VOCAL SPINE only; wrap 5 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
A club-tempo shape that reaches the floor naturally, for reference rather than transcription: build-up intro, verse, pre-chorus, chorus/drop, breakdown, verse, chorus, instrumental break, bridge, final chorus, outro. Long instrumental stretches are idiomatic at these tempos — adding them makes the track MORE genre-true, not padded. For a genre whose vocal is defined as a minimal spoken-word stab rather than a full lyric lead, lean further still toward instrumental sections.
- stylePrompt must be a comma-separated list of roughly 25-35 short descriptors (genre, era, instruments, rhythm feel, harmony color, vocal description, tempo, structure/production notes) — not full sentences and not padded to hit a fixed checklist. Write only what is musically true and useful for THIS song; stop once you have described it well, even if that is fewer than 35 descriptors.
- Each "preassignedSongs" entry may include "hookDeviceText" — a REFERENCE arrangement-contrast idea for this song (stop-time, key change, breakdown, etc), not required wording. Use it, an era-appropriate variant of it, or a different device entirely if you have a better one for this specific song — just make sure the chorus doesn't feel static.
- Each "preassignedSongs" entry may include "chorusContrastText" — a REFERENCE arrangement-density idea for how the chorus should sound fuller than the verse (added harmony, added instruments, wider stereo, etc), not required wording. This is about ARRANGEMENT, never a key change/modulation — that stays governed separately by killingPointText where present. Use it, a variant of it, or your own arrangement-contrast idea if you have a better one for this song's era and genre — just make sure the chorus reads as denser/fuller than the verse.



- Each of tracks 1-3's "preassignedSongs" entry may include "openingLoudnessText" — this track's opening must play at FULL playback level from the very first bar, not a quiet fade-in or a hushed intro that builds up. Weave that idea (in your own words, or close to the given phrase) into this track's stylePrompt alongside its opening-hook descriptor. This is about mix LEVEL, not emotional intensity — a lyrically quiet/reflective opening still needs to render at full volume; do not apply this phrase to any track beyond 1-3, which would flatten the pack's own back-half dynamic build. Like introTextureText, this belongs late in the stylePrompt (position 9, per the CRITICAL element-order rule above), never as an opening clause.
- Each "preassignedSongs" entry may include "introTextureText" - a REFERENCE for the kind of instrumental color this channel often opens with (intro-only, first ~5 seconds), not a phrase to copy. If it fits this song's genre/era, use it or something like it; if it doesn't (e.g. a synth texture suggested for a 1960s track), use your own musical judgment for an era-appropriate substitute instead. Never let it become the whole-song arrangement. Place this descriptor late in the stylePrompt (position 9, per the CRITICAL element-order rule above) — it is production detail, not genre identity, so it should never be one of the opening clauses.
- Each "preassignedSongs" entry may include "eraPaletteText" — how records in THIS track's own era and sub-genre actually sounded: the instruments played, the harmony habits, the way the voice was recorded, and the production of the room and tape. It is reference material, not a phrase to transcribe — write your own wording for the same sound. Two things about it are not optional. (1) At least TWO of this track's stylePrompt clauses must be era-production clauses (how it was recorded and mixed: the room, the tape/console character, the stereo width, the compression, the noise floor) — production is what separates a modern recording of an old song from a recording of that era, and a prompt that names the genre and the instruments but not the production reads as a present-day cover. (2) Do not contradict it: if it says the stereo image is narrow, do not also ask for a wide modern mix.
- Keep "negativeStyleText" separate: do not put it in stylePrompt; the app exports it to Suno Exclude styles.
- Each "preassignedSongs" entry may include "instrumentSet" — instruments drawn from this track's own genre (the same genre named in "genreText"), meant to fill position 3 of the CRITICAL element-order rule above. Use them by default. Only substitute an individual instrument when it is genuinely anachronistic for this song's specific era (e.g. don't put a Rhodes electric piano in a 1962 doo-wop track just because instrumentSet suggested one meant for a different, later-era genre) — a single era-inappropriate item gets swapped for an era-appropriate equivalent, not the whole set replaced with your own unrelated instrumentation.
- [가사 표현] Ground metaphors in a concrete object and a real sense (sight/sound/touch/smell), never two abstract nouns linked to each other. Bad: "coin of common sense", "laughter lifting flame" (abstract idea + abstract idea). Good: "like a copper coin in light", "laughter rising all around" (a real object/sensation carrying the feeling).
- Each "preassignedSongs" entry may include "arrangementDensity" (one of sparse/medium/full) — a REFERENCE point for how full this song's arrangement should feel (sparse ~ "spare, voice-forward arrangement, lots of space"; medium ~ "moderate arrangement, a few instruments at a time"; full ~ "full layered arrangement with strings"). Aim for that general density in your own words; you do not need to use this phrasing.
- Each "preassignedSongs" entry also includes "structureTemplate" (one of T1-T5). Structure templates, each a different lyric section order: T1: intro, verse 1, pre-chorus, chorus, verse 2, chorus, bridge, final chorus (8 sections — this is the last one, no trailing outro/end tag); T2: cold hook intro (hook line first, no instrumental lead-in), verse 1, chorus, verse 2, chorus, breakdown section, final chorus (7 sections — no trailing outro/end tag); T3: intro, verse 1, pre-chorus, chorus, verse 2, chorus, key-lift final chorus (7 sections, pre-chorus used only once — no trailing outro/end tag); T4: instrumental hook intro (short instrumental restatement of the melody, no lyrics), verse 1, chorus, verse 2, chorus, chorus repeated a third time as the final chorus (no bridge, no pre-chorus) (6 sections — no trailing outro/end tag); T5: a cappella hook intro, verse 1, chorus, verse 2, bridge, chorus, tagged final chorus (7 sections — no trailing outro/end tag). Write THIS song's lyrics — actual section content, not the letter code — following its assigned template's section order exactly; do not default back to T1's shape for a track assigned a different template, and do not invent a different template than the one assigned.
- Each "preassignedSongs" entry also includes "lyricThemeText" (and, for some tracks, "lyricThemeArc") - see the "[Lyric scenes]" section below for the full scene per track. This is not just a "listenerSituation" field to fill in: the actual sung verses/chorus of that song must depict this specific scene and its stated motion/energy, not a generic scene of your own choosing. Do not quote lyricThemeText verbatim as lyrics; write it out as a real scene in your own words. If "lyricThemeArc" is present, use it as the lyric emotional turn.
- Each "preassignedSongs" entry also includes "pov" - write that song's lyrics from that exact point of view; do not substitute a different narrator perspective.
- Each "preassignedSongs" entry also includes "verseStyleText" and "chorusStyleText" - write verse sections and chorus sections with those distinct approaches, verbatim as guidance. [스타일 경향] There's a real tendency for every song to start with the same first-line shape or every chorus to lean on the same sentence structure — worth watching for and varying against.
- Each "preassignedSongs" entry also includes "vocalText" — this track's vocal identity. It may contain several comma-separated descriptive clauses (register/gender, delivery, timbre, mic proximity, era technique) built for per-song differentiation across the pack. Select 2-3 of those clauses for the stylePrompt's vocal description — always keep the first clause (gender/register identity; never substitute a different vocal gender or type, e.g. male instead of female, or an adult voice for a kids choir) plus 1-2 more that read best for this song. Do not weave in every clause verbatim (that reads as an overloaded, generic vocal description) and do not paraphrase the gender/type away.
- Each "preassignedSongs" entry with a "vocalTechniqueText" field (e.g. "rasping ad-lib stack on the bridge") carries this track's assigned singing TECHNIQUE — how the voice is sung (melisma, scat, falsetto lift, behind-the-beat phrasing...), not its timbre/register. The app picked this phrase to avoid repeating the same technique across this pack's songs. Use this exact technique phrase in the vocal slot of the stylePrompt, alongside (not replacing) the register/timbre clauses you select from "vocalText". Do not substitute a different technique and do not paraphrase it away.


[마지막으로, 이것만은 피하십시오]

  안전 (절대 완화하지 않음)
    - 실제 아티스트·밴드·프로듀서·곡·멜로디·가사를 모방하거나 이름을 언급하지 마십시오. "in the style of X"류 표현도 금지입니다.

  품질 (항상 지킴 — 과거 실측 실패에서 나온 규칙입니다)
    - 이미 사용한 제목·훅: "alreadyUsedTitles"의 0개, "alreadyUsedHooks"의 0개는 전부 금지입니다 — 참고 자료가 아니라 이전 팩에서 이미 쓴 것들입니다. 파일을 쓰기 전에 모든 곡의 title/hookPhrase를 두 목록과 대조하십시오 (트랙 번호를 바꿔 재배치해도 안 됩니다).
    - 악기·편곡·프로덕션 용어(guitar, strings, drums, piano, horns, reverb, stop-time 등)는 stylePrompt에만 씁니다. 가사 문장의 주어나 행위자로 쓰지 마십시오("the guitar keeps walking" 금지). 사람이 그 악기와 상호작용하는 묘사는 괜찮습니다("I still play my father's guitar").
    - negativeStyleText는 Suno의 별도 "Exclude styles" 필드용입니다 — stylePrompt 본문에 섞지 마십시오.

- Do NOT prefix "title" with a track number or any "01.", "02." style numbering yourself — write only the creative title. If this pack needs numbered titles, the app adds that afterward from the trusted trackNo.
- Do NOT include projectTitle, channelName, oneLineConcept, sonicSignature, vocalSignature, lyricRules, harmonyRules, or visualRules in the file — the app supplies those separately from local context.
- The file itself must be raw JSON — no markdown fences, no surrounding prose, inside the file.
- When done, tell me the file's path so I can import it back into Haru Studio.