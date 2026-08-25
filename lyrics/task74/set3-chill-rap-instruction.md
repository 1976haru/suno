[Generated 2026-08-25T00:55:47.582Z — bridge instruction schema v3.64]

You are an experienced music composer/producer generating song content for a Suno playlist pack as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file. Compose each song using your own musical knowledge within the plan and constraints below; do not treat reference fields as scripts to transcribe verbatim.

[이 세트가 하려는 것]

  컨셉    옥상에서 듣는 칠 랩
  청취자  Chill rap, mellow boom-bap, and jazz rap for a rooftop-at-dusk headphone session
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
| 1 | Trap-Soul | - | 64 BPM | male | T1 | no [intro] tag at all — singing starts immediately | crowd-alone | cold-open |
| 2 | Mellow Boom-Bap | - | 84 BPM | mixed | T4 | instrumental (no lyric line under [intro]) | reunion-passing | flagship |
| 3 | Lo-fi Hip-Hop Study | - | 76 BPM | female | T2 | short [intro] line allowed | after-party | flagship |
| 4 | Chill Rap | - | 78 BPM | male | T5 | no [intro] tag at all — singing starts immediately | screen-memory | brighter sing-along track |
| 5 | Jazz Rap | - | 87 BPM | female | T2 | short [intro] line allowed | daylight-city | easy singalong verse |
| 6 | Trap-Soul | - | 80 BPM | mixed | T4 | instrumental (no lyric line under [intro]) | night-city-move | romantic shade without melodrama |
| 7 | Mellow Boom-Bap | - | 89 BPM | male | T5 | no [intro] tag at all — singing starts immediately | commute-transit | passionate turning point |
| 8 | Lo-fi Hip-Hop Study | - | 82 BPM | mixed | T4 | instrumental (no lyric line under [intro]) | solitary-room | quiet middle scene |
| 9 | Chill Rap | - | 78 BPM | male | T5 | short [intro] line allowed | night-drive | tender reflective pause |
| 10 | Jazz Rap | - | 97 BPM | female | T4 | instrumental (no lyric line under [intro]) | two-people-talk | soft reset before the closing run |
| 11 | Trap-Soul | - | 64 BPM | female | T4 | instrumental (no lyric line under [intro]) | threshold-decision | peaceful farewell moment |
| 12 | Mellow Boom-Bap | - | 78 BPM | male | T4 | short [intro] line allowed | city lights at night | warm goodnight track |

Follow each track's "Intro" column exactly: "instrumental" tracks must have NO lyric line under [intro] (an instrumental cue there is fine, e.g. "[intro]" with nothing sung until the next tag); "no [intro] tag at all" tracks should skip the [intro] tag entirely and start singing right away; "short [intro] line allowed" tracks may have a brief sung line there.

Scene frames used in this pack: crowd-alone (1); reunion-passing (2); after-party (3); screen-memory (4); daylight-city (5); night-city-move (6); commute-transit (7); solitary-room (8); night-drive (9); two-people-talk (10); threshold-decision (11); city lights at night (12). Each track's own scene/lyricThemeText is the specific detail — write a genuinely different kind of moment per frame, not the same "alone, looking at something" scene with the object swapped out.
Scene mix across this pack - motion: traveling by car, a drive 2, 이동 중(도보) 3, 이동 중(자전거) 1, stillness 2 | cast: alone 11, two people 1. Keep this mix - do not flatten every track without an explicit motion/cast axis into the same quiet-alone shape either.

[Diversity groups] - constraints, not wording to copy:
introTexture A:1,10  B:2  C:3  D:4,11  E:5  F:6,9  G:7,12  H:8
hookDevice A:1,11  B:2,12  C:3  D:4  E:5  F:6  G:7  H:8  I:9  J:10
arrangementDensity medium A:1,4,6,8,9  sparse B:2,3,11,12  full C:5,7,10
Tracks in the same group may share a similar approach; tracks in different groups must feel clearly different. Choose the concrete musical wording yourself.

[Lyric scenes] - write THIS scene into each track's actual verses/chorus, in your own words (never quote the description verbatim as a lyric line). Do NOT default to a quiet, solitary "watching something alone" scene for these tracks even if that is this app's usual mood elsewhere in the pack - if a scene names motion (dancing, driving, traveling) or more than one person present, the lyrics must show that motion/energy/company, not replace it with stillness or solitude.
  Track 1: standing near the back of a small show, arms crossed, watching the set instead of losing themselves in it
    emotional turn: guarded distance loosening into quiet appreciation
    cast: alone
  Track 2: driving past the old block where everything started, every corner holding a different memory
    emotional turn: wistful nostalgia settling into grounded gratitude
    cast: alone / motion: traveling by car, a drive
  Track 3: walking home from a late DJ set with the bassline still echoing faintly in the ears
    emotional turn: electric exhilaration settling into a slow, satisfied glow
    cast: alone / motion: 이동 중(도보)
  Track 4: replaying an old voice memo from a friend who moved away, hearing a laugh that time has softened
    emotional turn: quiet longing warming into grateful remembrance
    cast: alone
  Track 5: wandering a Saturday farmers market with nowhere to be, sunlight cutting through the stalls
    emotional turn: low-grade weekday tension unwinding into easy weekend calm
    cast: alone / motion: 이동 중(도보)
  Track 6: biking home late through empty streets, the whole city briefly feeling like it belongs to no one else
    emotional turn: wired late-night energy settling into free, weightless ease
    cast: alone / motion: 이동 중(자전거)
  Track 7: walking the same six blocks home with earbuds in, timing footsteps to a half-remembered beat
    emotional turn: aimless wandering resolving into a steady, grounded rhythm
    cast: alone / motion: 이동 중(도보)
  Track 8: sitting at a small bedroom studio desk past midnight, one lamp on, headphones half off one ear
    emotional turn: scattered self-doubt narrowing into focused, patient work
    cast: alone / motion: stillness
  Track 9: pulling up to a neon-lit drive-through at 3am, ordering just to have somewhere to be for five minutes
    emotional turn: aimless drifting turning into small, self-aware amusement
    cast: alone / motion: traveling by car, a drive
  Track 10: sliding into a diner booth with an old friend at midnight, catching up over cold fries and refilled coffee
    emotional turn: initial distance warming into familiar, easy comfort
    cast: two people
  Track 11: standing at a doorway deciding, for the last time, whether to turn back or keep walking
    emotional turn: aching hesitation hardening into clear-eyed release
    cast: alone
  Track 12: standing at a crosswalk under a neon sign, waiting for the light with a hundred strangers moving around
    emotional turn: restless impatience settling into observant calm
    cast: alone / motion: stillness

[Vocabulary per track] - REFERENCE word lists matched to each track's own scene, not a checklist. Do NOT just list these words in a row or force all of them in - write natural, singable lyrics in your own words that happen to live in this same vocabulary world. A lyric that reads like a word list stitched together is worse than one that uses none of these words but still captures the scene. Where an "avoid" list is given, steer away from those words for this specific track (they belong to a different mood this scene isn't).
  Track 1: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 2: late-night table, shared glass, crosswalk, crowded street, confess, catch up, text, warm, awkward, honest
  Track 3: after-party lights, turning season, rooftop night, celebrate, turn the page, bright, warm, renewed
  Track 4: studio apartment, takeout container, lamp, laptop screen, sit, watch, scroll back, small, quiet, alone | avoid: radio, curtain, kettle
  Track 5: crowded street, daylight skyline, circle of friends, walk past, gather, support, confident, bright, easy
  Track 6: tour bus window, formation line, city skyline, crew, sync, ride, move together, united, in motion, wide-eyed
  Track 7: subway car, earbuds, night bus, river road, ride, scroll, drive, dim, tired, restless | avoid: radio, curtain, kettle
  Track 8: studio apartment, takeout container, lamp, laptop screen, sit, watch, scroll back, small, quiet, alone | avoid: radio, curtain, kettle
  Track 9: subway car, earbuds, night bus, river road, ride, scroll, drive, dim, tired, restless | avoid: radio, curtain, kettle
  Track 10: late-night table, shared glass, crosswalk, crowded street, confess, catch up, text, warm, awkward, honest
  Track 11: resignation email, packed bag, cursor, doorway, hesitate, decide, pack, uncertain, determined, nervous
  Track 12: marquee, streetlight, taxi, window display, walk, glance, meet, electric, late, glittering | avoid: quiet, still

[Killing points] - each track's one designed peak moment, an idea to realize in your own words, never a phrase to quote verbatim. This should be the loudest, fullest, most energetic point of the ENTIRE song — clearly audible as a lift, not a small nudge — and the section right before it should stay noticeably more restrained (thinner arrangement, lower energy) so the peak has something real to rise from, instead of the whole song sitting at one constant level. Build this through arrangement fullness and dynamics, never through belting or harsh top end — the audience's vocal-register/production exclusions elsewhere in this instruction still apply in full at the peak. Critically, this moment must also be NAMED as a concrete, specific clause in the stylePrompt text itself (your own wording for the actual technique — an octave lift, a key/half-step modulation, a stripped-then-full swell, a sustained note into the chorus, etc.) — realizing the dynamic without ever describing it in the prompt text does not satisfy this. A track not listed here has no designed peak moment — keep it comfortably at its usual level throughout, do not invent one.
  Track 2 (pre-chorus): a stuttered vocal chop punctuates the pre-chorus
  Track 3 (pre-chorus): rising synth arpeggio builds into the final chorus
  Track 4 (final-chorus): sidechain pump under the final chorus
  Track 5 (pre-chorus): pre-chorus opens up and lifts into the hook
  Track 6 (final-chorus): short vocal hook tag right after the chorus
  Track 7 (bridge): arrangement thins out then re-enters full for the last chorus
  Track 8 (mid-instrumental): a brief full stop right before the beat drops back in
  Track 9 (final-chorus): a second vocal layer stacks in on the final chorus
  Track 10 (final-chorus): backing vocal ad-lib answers the hook
  Track 11 (pre-chorus): rising synth filter sweep into the chorus





CRITICAL — tempo: use each track's own "BPM" value from the table above exactly, in every song's stylePrompt. Do not average, round toward a comfortable middle, or otherwise smooth tempos across tracks — the spread between tracks is intentional.

This pack's 12 tracks (plan fixed by the app — compose within each row, do not renumber or reorder):
| Track | Genre | BPM | Vocal | Role | Length target |
| --- | --- | --- | --- | --- | --- |
| 1 | Trap-Soul | 64 BPM | male falsetto-leaning tenor, storytelling spoken-edge delivery, airy breath-forward tone, narrow mono-leaning room, airy head-voice glide into the chorus, nasal-edged ad-lib stack on the outro | cold-open | 5-6 sections, 154-216 words, max 1 instrumental section |
| 2 | Mellow Boom-Bap | 84 BPM | call and answer, close third harmony, chamber ambience, male and female duet, triplet flow behind the beat | flagship | 5-6 sections, 175-237 words, max 1 instrumental section |
| 3 | Lo-fi Hip-Hop Study | 76 BPM | female bright soprano lead, light rhythmic phrasing, clean bell tone, chamber ambience, husky murmured ad-lib on the outro, breathy close-mic half-whispered phrasing | flagship | 5-6 sections, 165-228 words, max 1 instrumental section |
| 4 | Chill Rap | 78 BPM | male male head-voice lead, clipped rhythmic phrasing, soft husky grain, dry and forward, melodic sing-rap flow bending into the hook | brighter sing-along track | 5-6 sections, 166-229 words, max 1 instrumental section |
| 5 | Jazz Rap | 87 BPM | female soft head-voice lead, restrained understated reading, warm rounded midrange, intimate close-mic, bebop-inflected scat syllables on the break | easy singalong verse | 6-7 sections, 170-233 words, max 2 instrumental sections |
| 6 | Trap-Soul | 80 BPM | alternating verses into joined chorus, tight unison with light detune, dry and forward, male and female duet, soft falsetto ad-libs in the bridge | romantic shade without melodrama | 5-6 sections, 173-236 words, max 1 instrumental section |
| 7 | Mellow Boom-Bap | 89 BPM | male low warm baritone, legato sustained lines, slight nasal brightness, tape slap echo, clipped staccato rap delivery | passionate turning point | 6-7 sections, 171-234 words, max 2 instrumental sections |
| 8 | Lo-fi Hip-Hop Study | 82 BPM | narration answered wordlessly, loose lines meeting hook, narrow mono-leaning room, male and female duet, breathy sigh trailing the final line | quiet middle scene | 5-6 sections, 174-237 words, max 1 instrumental section |
| 9 | Chill Rap | 78 BPM | male relaxed mid-range lead, gentle swung phrasing, warm woody midrange, chamber ambience, dragged-vowel laid-back drawl | tender reflective pause | 5-6 sections, 166-229 words, max 1 instrumental section |
| 10 | Jazz Rap | 97 BPM | female narrow intimate lead, bright forward delivery, slight smoky depth, warm natural room, sharp staccato scat over the changes | soft reset before the closing run | 9-11 sections, 179-242 words, max 4 instrumental sections |
| 11 | Trap-Soul | 64 BPM | female low warm contralto, tender confiding delivery, velvety low resonance, dry and forward, breathy falsetto ad-lib on the hook | peaceful farewell moment | 5-6 sections, 165-228 words, max 1 instrumental section |
| 12 | Mellow Boom-Bap | 78 BPM | male narrow crooner tone, conversational unhurried phrasing, smoky low resonance, soft plate ambience, swallowed-consonant husky rap cadence | warm goodnight track | 5-6 sections, 172-235 words, max 1 instrumental section |

[This set's vocal composition]
  Track 1: Male Solo
  Track 2: Male-Female Duet
  Track 3: Female Solo
  Track 4: Male Solo
  Track 5: Female Solo
  Track 6: Male-Female Duet
  Track 7: Male Solo
  Track 8: Male-Female Duet
  Track 9: Male Solo
  Track 10: Female Solo
  Track 11: Female Solo
  Track 12: Male Solo

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
    "id": "headphones-down-low",
    "name": "Headphones, Down Low",
    "englishName": "Headphones, Down Low",
    "market": "global",
    "primaryLanguage": "english",
    "audience": "twenties",
    "promise": "Chill rap, mellow boom-bap, and jazz rap for a rooftop-at-dusk headphone session",
    "visualIdentity": "muted rooftop skyline at dusk, warm streetlight glow, grainy film texture, lowercase sans-serif typography",
    "defaultVocal": "calm conversational male rap flow, laid-back drawl, soft melodic hook",
    "preferredGenres": [
      "chill-rap",
      "boom-bap-mellow",
      "jazz-rap",
      "lofi-hiphop-study",
      "trap-soul"
    ],
    "preferredMoods": [
      "calm-focus",
      "nostalgic"
    ],
    "forbiddenCliches": [
      "specific rapper imitation",
      "named artist flow biting",
      "signature hook of an existing song",
      "aggressive battle-rap delivery",
      "gunshot or violence imagery",
      "explicit drug-dealing narrative"
    ],
    "seoKeywords": [
      "chill rap playlist",
      "lofi hip-hop beats",
      "mellow boom bap",
      "jazz rap chill",
      "headphone rap songs",
      "rooftop rap playlist"
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
      "id": "trap-soul",
      "label": "Trap-Soul",
      "styleCore": "trap-soul, 808 slides, tight hi-hat rolls, dark synth pad, doubled vocal shadows, sparse nocturnal drums",
      "arrangementNarrative": "BPM 62-82; Verse is sparse with dark pads, 808 slides, and clipped hi-hat rolls under doubled vocal shadows, pre-chorus cuts the kick for two bars while the pad rises, chorus drops into a heavier sub-bass hook with tight ad-lib echoes, hook entry uses a breathy vocal gap before the 808 returns, mix is dark, modern, and bass-forward",
      "instruments": [
        "808 slide bass",
        "tight hi-hat rolls",
        "dark synth pad",
        "minimal snare",
        "doubled vocal ad-libs"
      ],
      "tempoRange": [
        62,
        82
      ],
      "goodFor": [
        "Chill Hours",
        "late-night drive",
        "dark R&B playlist"
      ],
      "archetypes": [
        "modern-chill"
      ],
      "tier": "core",
      "categoryId": "rnb",
      "source": "legacy-preset",
      "rhythm": [
        "sparse trap-soul pulse",
        "slow rolling hi-hat grid"
      ],
      "vocal": [
        "doubled intimate vocal with ad-lib shadows"
      ],
      "production": [
        "dark pad ambience",
        "clean 808 low end",
        "wide vocal delay throws"
      ],
      "harmony": [
        "minor-key R&B movement",
        "suspended dark pad harmony"
      ],
      "tempo": [
        62,
        82
      ],
      "moods": [
        "dark",
        "late-night",
        "brooding"
      ],
      "audiences": [
        "modern R&B listeners",
        "night-drive playlists"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "aggressive drill energy",
        "festival EDM drop",
        "overly bright pop-rock guitars"
      ],
      "shortPrompt": "Trap-Soul, sparse trap-soul pulse, doubled intimate vocal with ad-lib shadows, 808 slide bass + tight hi-hat rolls, dark pad ambience, 62-82 BPM",
      "productionGuidance": "Trap-Soul: build around sparse trap-soul pulse and slow rolling hi-hat grid, keep doubled intimate vocal with ad-lib shadows, feature 808 slide bass, tight hi-hat rolls, dark synth pad, minimal snare, use minor-key R&B movement, mix with dark pad ambience and clean 808 low end, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "808 slide bass, tight hi-hat rolls, dark synth pad, BPM 62-82; Verse is sparse with dark pads"
    },
    {
      "id": "chill-rap",
      "label": "Chill Rap",
      "styleCore": "chill rap, relaxed conversational flow, lofi drums, jazz sample texture, mellow sub bass, soft melodic hook",
      "arrangementNarrative": "BPM 70-85; Verse keeps an unhurried conversational flow over lofi drums and a soft sample-texture loop, pre-chorus lets a sung response or humming pad widen the space, chorus stays melodic and easy rather than aggressive, hook entry uses a one-bar drum mute with a vinyl-stop feel, mix is relaxed, dusty, and vocal-forward",
      "instruments": [
        "lofi drum kit",
        "jazz sample texture",
        "mellow sub bass",
        "soft electric piano loop",
        "melodic hook vocal"
      ],
      "tempoRange": [
        70,
        85
      ],
      "goodFor": [
        "Chill Hours",
        "study rap",
        "rainy commute playlist"
      ],
      "archetypes": [
        "modern-chill",
        "city-night"
      ],
      "tier": "core",
      "categoryId": "hiphop",
      "source": "legacy-preset",
      "rhythm": [
        "relaxed rap pocket",
        "loose lofi drum swing"
      ],
      "vocal": [
        "calm conversational rap flow with melodic hook"
      ],
      "production": [
        "dusty sample texture",
        "soft vinyl grain",
        "vocal-forward low volume mix"
      ],
      "harmony": [
        "simple jazzy loop harmony",
        "warm minor seventh color"
      ],
      "tempo": [
        70,
        85
      ],
      "moods": [
        "relaxed",
        "focused",
        "rainy"
      ],
      "audiences": [
        "chill rap listeners",
        "study and commute playlists"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "aggressive battle-rap delivery",
        "bright EDM synths",
        "heavy club trap drop"
      ],
      "shortPrompt": "Chill Rap, relaxed rap pocket, calm conversational rap flow with melodic hook, lofi drum kit + jazz sample texture, dusty sample texture, 70-85 BPM",
      "productionGuidance": "Chill Rap: build around relaxed rap pocket and loose lofi drum swing, keep calm conversational rap flow with melodic hook, feature lofi drum kit, jazz sample texture, mellow sub bass, soft electric piano loop, use simple jazzy loop harmony, mix with dusty sample texture and soft vinyl grain, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "lofi drum kit, jazz sample texture, mellow sub bass, BPM 70-85; Verse keeps an unhurried conversational flow over lofi drums and a soft sample-texture loop"
    },
    {
      "id": "lofi-hiphop-study",
      "label": "Lo-fi Hip-Hop Study",
      "styleCore": "lo-fi hip-hop study beat, vinyl noise, loose swing, short dusty loop, mellow keys, low-distraction vocal optional",
      "instruments": [
        "dusty piano loop",
        "vinyl crackle",
        "loose swing drums",
        "warm bass",
        "soft Rhodes"
      ],
      "tempoRange": [
        72,
        88
      ],
      "goodFor": [
        "Chill Hours",
        "study playlist",
        "focus background"
      ],
      "archetypes": [
        "modern-chill"
      ],
      "tier": "core",
      "categoryId": "lofi",
      "source": "legacy-preset",
      "rhythm": [
        "loose head-nod swing",
        "short loop-based beat"
      ],
      "vocal": [
        "optional soft hook vocal kept low"
      ],
      "production": [
        "vinyl noise",
        "tape-soft transients",
        "dusty loop texture"
      ],
      "harmony": [
        "short jazzy two-chord loop",
        "warm key color"
      ],
      "tempo": [
        72,
        88
      ],
      "moods": [
        "focused",
        "cozy",
        "rainy"
      ],
      "audiences": [
        "study playlists",
        "lo-fi hip-hop listeners"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "busy rap verses",
        "loud vinyl crackle",
        "bright EDM synths"
      ],
      "shortPrompt": "Lo-fi Hip-Hop Study, loose head-nod swing, optional soft hook vocal kept low, dusty piano loop + vinyl crackle, vinyl noise, 72-88 BPM",
      "productionGuidance": "Lo-fi Hip-Hop Study: build around loose head-nod swing and short loop-based beat, keep optional soft hook vocal kept low, feature dusty piano loop, vinyl crackle, loose swing drums, warm bass, use short jazzy two-chord loop, mix with vinyl noise and tape-soft transients, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "dusty piano loop, vinyl crackle, loose swing drums, lo-fi hip-hop study beat"
    },
    {
      "id": "boom-bap-mellow",
      "label": "Mellow Boom-Bap",
      "styleCore": "mellow boom-bap, dusty drums, filtered bass, soul sample color, relaxed pocket, warm hook vocal",
      "instruments": [
        "dusty boom-bap drums",
        "filtered bass",
        "soul sample texture",
        "Rhodes chop",
        "warm hook vocal"
      ],
      "tempoRange": [
        78,
        92
      ],
      "goodFor": [
        "Chill Hours",
        "mellow rap set",
        "evening walk playlist"
      ],
      "archetypes": [
        "modern-chill"
      ],
      "tier": "core",
      "categoryId": "hiphop",
      "source": "legacy-preset",
      "rhythm": [
        "mellow boom-bap backbeat",
        "lazy head-nod pocket"
      ],
      "vocal": [
        "relaxed low-pressure rap or sung hook"
      ],
      "production": [
        "dusty drum breaks",
        "filtered bass warmth",
        "sample-like soul color"
      ],
      "harmony": [
        "minor soul loop harmony",
        "warm dominant chord touch"
      ],
      "tempo": [
        78,
        92
      ],
      "moods": [
        "mellow",
        "nostalgic",
        "streetlight"
      ],
      "audiences": [
        "mellow rap listeners",
        "night walk playlists"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "hard battle-rap tone",
        "glossy EDM drums",
        "overcrowded percussion"
      ],
      "shortPrompt": "Mellow Boom-Bap, mellow boom-bap backbeat, relaxed low-pressure rap or sung hook, dusty boom-bap drums + filtered bass, dusty drum breaks, 78-92 BPM",
      "productionGuidance": "Mellow Boom-Bap: build around mellow boom-bap backbeat and lazy head-nod pocket, keep relaxed low-pressure rap or sung hook, feature dusty boom-bap drums, filtered bass, soul sample texture, Rhodes chop, use minor soul loop harmony, mix with dusty drum breaks and filtered bass warmth, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "dusty boom-bap drums, filtered bass, soul sample texture, mellow boom-bap"
    },
    {
      "id": "jazz-rap",
      "label": "Jazz Rap",
      "styleCore": "jazz rap, walking bass, brush drums, horn stabs, relaxed spoken flow, smoky room texture",
      "instruments": [
        "walking upright bass",
        "brush drums",
        "muted horn stabs",
        "jazz piano loop",
        "spoken rap vocal"
      ],
      "tempoRange": [
        82,
        98
      ],
      "goodFor": [
        "Chill Hours",
        "late jazz rap",
        "study and night cafe"
      ],
      "archetypes": [
        "modern-chill"
      ],
      "tier": "core",
      "categoryId": "hiphop",
      "source": "legacy-preset",
      "rhythm": [
        "laid-back jazz-rap swing",
        "brush-drum hip-hop pocket"
      ],
      "vocal": [
        "relaxed articulate rap flow"
      ],
      "production": [
        "smoky room texture",
        "sample-like jazz warmth",
        "rounded low end"
      ],
      "harmony": [
        "jazz turnaround loops",
        "minor seventh horn color"
      ],
      "tempo": [
        82,
        98
      ],
      "moods": [
        "smoky",
        "thoughtful",
        "late-night"
      ],
      "audiences": [
        "jazz rap listeners",
        "night study playlists"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "fast technical rap display",
        "busy bebop solo clutter",
        "trap hi-hat rolls"
      ],
      "shortPrompt": "Jazz Rap, laid-back jazz-rap swing, relaxed articulate rap flow, walking upright bass + brush drums, smoky room texture, 82-98 BPM",
      "productionGuidance": "Jazz Rap: build around laid-back jazz-rap swing and brush-drum hip-hop pocket, keep relaxed articulate rap flow, feature walking upright bass, brush drums, muted horn stabs, jazz piano loop, use jazz turnaround loops, mix with smoky room texture and sample-like jazz warmth, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "walking upright bass, brush drums, muted horn stabs, jazz rap"
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
      "id": "calm-focus",
      "label": "Calm Focus",
      "emotionWords": [
        "calm",
        "steady",
        "light concentration"
      ],
      "lyricImages": [
        "open notebook",
        "quiet desk",
        "window light",
        "slow clock"
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
  "vocalTone": "calm conversational male rap flow, laid-back drawl, soft melodic hook",
  "perspective": "firstPerson",
  "lyricDepth": "commercial",
  "moneyChordMode": "default",
  "customConcept": "옥상에서 듣는 칠 랩",
  "avoidWords": "",
  "negativeStyle": "flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative",
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
      "title": "Forget",
      "hookPhrase": "I Won't Forget",
      "songRole": "cold-open",
      "tempo": 64,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        154,
        216
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "trap-soul",
      "genreText": "808 slides, 808 slide bass, tight hi-hat rolls",
      "signatureSound": "808 slide bass, tight hi-hat rolls, dark synth pad, BPM 62-82; Verse is sparse with dark pads",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, aggressive drill energy, festival EDM drop, overly bright pop-rock guitars, bright EDM synths, heavy club trap drop, busy rap verses",
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
          "chordId": "jazzColor"
        },
        {
          "section": "Chorus",
          "chordId": "cityPop"
        },
        {
          "section": "Bridge",
          "chordId": "royalRoad"
        }
      ],
      "moneyChordSectionText": "Verse: ii-V-I turnaround, maj7 add9 color / Chorus: vi-IV-I-V movement, maj7 color / Bridge: IV-V-iii-vi royal road progression",
      "openingLoudnessText": "full arrangement from the first bar",
      "arcPhase": "opening",
      "intensity": 2,
      "peakStrength": "none",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "64 BPM + intimate → 낮음",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "trap-soul",
        "chill-rap",
        "lofi-hiphop-study"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "808 slide bass",
        "dark synth pad"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T1",
      "introMode": "vocal-immediate",
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
      "vocalText": "male falsetto-leaning tenor, storytelling spoken-edge delivery, airy breath-forward tone, narrow mono-leaning room, airy head-voice glide into the chorus, nasal-edged ad-lib stack on the outro",
      "vocalVariantText": "male falsetto-leaning tenor, storytelling spoken-edge delivery, airy breath-forward tone, narrow mono-leaning room, airy head-voice glide into the chorus, nasal-edged ad-lib stack on the outro",
      "vocalTechniqueText": "airy head-voice glide into the chorus, nasal-edged ad-lib stack on the outro",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 2,
      "title": "Stay with Me Tonight",
      "hookPhrase": "Stay with Me Tonight",
      "songRole": "flagship",
      "tempo": 84,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        175,
        237
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "quiet contentment resting undisturbed throughout",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift",
      "genreId": "boom-bap-mellow",
      "genreText": "dusty drums, dusty boom-bap drums, filtered bass, doubled intimate vocal with ad-lib shadows",
      "signatureSound": "dusty boom-bap drums, filtered bass, soul sample texture, mellow boom-bap",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, hard battle-rap tone, glossy EDM drums, overcrowded percussion, aggressive drill energy, festival EDM drop, bright EDM synths",
      "eraPaletteText": "jazz turnaround repeating under the whole verse, drums compressed until the room between hits pumps, sampler-era band-limited top end, nothing sparkling above it",
      "introTextureText": "rap-delivery lead-in before the beat fully lands intro texture (INTRO ONLY)",
      "introTextureId": "kpop_rap_lead_in",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "chorusContrastPlanId": "gentle-second-voice",
      "chorusContrastText": "Verse: verse — acoustic guitar and voice / Chorus: chorus adds only a second vocal harmony line, everything else holds steady",
      "chorusContrastScore": 46,
      "openingLoudnessText": "no quiet fade-in — already at full level from the start",
      "killingPointText": "a stuttered vocal chop punctuates the pre-chorus",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-10",
      "arcPhase": "opening",
      "intensity": 2,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "84 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "emotional",
      "effectiveMoneyChordId": "emotional",
      "effectiveGenreIds": [
        "boom-bap-mellow",
        "trap-soul",
        "chill-rap"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "dusty boom-bap drums",
        "soul sample texture",
        "filtered bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-passing-the-old-block",
      "lyricThemeText": "driving past the old block where everything started, every corner holding a different memory",
      "lyricThemeArc": "wistful nostalgia settling into grounded gratitude",
      "lyricFrameId": "reunion-passing",
      "lyricThemeMotionKo": "이동 중(드라이브)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-two-people",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "call and answer, close third harmony, chamber ambience, male and female duet, triplet flow behind the beat",
      "vocalVariantText": "call and answer, close third harmony, chamber ambience, male and female duet, triplet flow behind the beat",
      "vocalTechniqueText": "triplet flow behind the beat",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 3,
      "title": "Turn",
      "hookPhrase": "Turn the Page Slowly",
      "songRole": "flagship",
      "tempo": 76,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        165,
        228
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "lofi-hiphop-study",
      "genreText": "lo-fi hip-hop study beat, dusty piano loop, vinyl crackle",
      "signatureSound": "dusty piano loop, vinyl crackle, loose swing drums, lo-fi hip-hop study beat",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, busy rap verses, loud vinyl crackle, bright EDM synths, aggressive drill energy, festival EDM drop, overly bright pop-rock guitars",
      "eraPaletteText": "recorded in one pass with the loop running underneath, vocal mixed close and low, sitting inside the beat rather than on top, drums compressed until the room between hits pumps",
      "introTextureText": "clean electric guitar arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "eg_clean_arp",
      "hookDeviceText": "final repeat of the hook sung almost a cappella as the outro tag",
      "hookDeviceId": "acappella-tag",
      "chorusContrastPlanId": "call-response-texture",
      "chorusContrastText": "Verse: verse — lead vocal alone over a light rhythm section / Chorus: backing vocals answer each line, a percussion layer widens the groove",
      "chorusContrastScore": 53,
      "openingLoudnessText": "opening is as loud and full as the chorus",
      "killingPointText": "rising synth arpeggio builds into the final chorus",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-11",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "76 BPM + bright soprano → 낮음",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "lofi-hiphop-study",
        "trap-soul",
        "chill-rap"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "dusty piano loop",
        "loose swing drums"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "introMode": "vocal-after-texture",
      "lyricTheme": "enchillhop-walking-home-from-a-set",
      "lyricThemeText": "walking home from a late DJ set with the bassline still echoing faintly in the ears",
      "lyricThemeArc": "electric exhilaration settling into a slow, satisfied glow",
      "lyricFrameId": "after-party",
      "lyricThemeMotionKo": "이동 중(도보)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kridol-f-season",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "female bright soprano lead, light rhythmic phrasing, clean bell tone, chamber ambience, husky murmured ad-lib on the outro, breathy close-mic half-whispered phrasing",
      "vocalVariantText": "female bright soprano lead, light rhythmic phrasing, clean bell tone, chamber ambience, husky murmured ad-lib on the outro, breathy close-mic half-whispered phrasing",
      "vocalTechniqueText": "husky murmured ad-lib on the outro, breathy close-mic half-whispered phrasing",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 4,
      "title": "I Still Believe",
      "hookPhrase": "I Still Believe",
      "songRole": "brighter sing-along track",
      "tempo": 78,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        166,
        229
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "vi-IV-I-V movement, maj7 color",
      "genreId": "chill-rap",
      "genreText": "chill rap, lofi drum kit, jazz sample texture, mellow sub bass",
      "signatureSound": "lofi drum kit, jazz sample texture, mellow sub bass, BPM 70-85; Verse keeps an unhurried conversational flow over lofi drums and a soft sample-texture loop",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, bright EDM synths, heavy club trap drop, aggressive drill energy, festival EDM drop, overly bright pop-rock guitars, busy rap verses",
      "eraPaletteText": "conversational flow sitting slightly behind the beat, vocal mixed close and low, sitting inside the beat rather than on top, drums compressed until the room between hits pumps",
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
          "chordId": "default"
        }
      ],
      "moneyChordSectionText": "Verse: vi-IV-I-V movement, maj7 color / Chorus: I-V-vi-IV progression",
      "killingPointText": "sidechain pump under the final chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-KR2030-12",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "78 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "cityPop",
      "effectiveMoneyChordId": "cityPop",
      "effectiveGenreIds": [
        "chill-rap",
        "trap-soul",
        "lofi-hiphop-study"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "lofi drum kit",
        "jazz sample texture",
        "soft electric piano loop"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T5",
      "introMode": "vocal-immediate",
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
      "vocalText": "male male head-voice lead, clipped rhythmic phrasing, soft husky grain, dry and forward, melodic sing-rap flow bending into the hook",
      "vocalVariantText": "male male head-voice lead, clipped rhythmic phrasing, soft husky grain, dry and forward, melodic sing-rap flow bending into the hook",
      "vocalTechniqueText": "melodic sing-rap flow bending into the hook",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 5,
      "title": "Light the Evening Star",
      "hookPhrase": "Light the Evening Star",
      "songRole": "easy singalong verse",
      "tempo": 87,
      "sectionCountRange": [
        6,
        7
      ],
      "wordCountRange": [
        170,
        233
      ],
      "maxInstrumentalSections": 2,
      "estimatedLengthSec": 190,
      "emotionArc": "steady peace held gently, start to end",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "jazz-rap",
      "genreText": "jazz rap, walking upright bass, brush drums",
      "signatureSound": "walking upright bass, brush drums, muted horn stabs, jazz rap",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, fast technical rap display, busy bebop solo clutter, trap hi-hat rolls, aggressive drill energy, festival EDM drop, bright EDM synths",
      "eraPaletteText": "recorded in one pass with the loop running underneath, vocal mixed close and low, sitting inside the beat rather than on top, drums compressed until the room between hits pumps",
      "introTextureText": "small chime-step synth intro texture (INTRO ONLY)",
      "introTextureId": "syn_chime_steps",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "chorusContrastPlanId": "unison-doubling",
      "chorusContrastText": "Verse: verse carried by piano and soft brushes / Chorus: chorus doubles the lead vocal in unison, adds tambourine and organ pad",
      "chorusContrastScore": 49,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "jazzColor"
        },
        {
          "section": "Chorus",
          "chordId": "royalRoad"
        },
        {
          "section": "Bridge",
          "chordId": "cityPop"
        }
      ],
      "moneyChordSectionText": "Verse: ii-V-I turnaround, maj7 add9 color / Chorus: IV-V-iii-vi royal road progression / Bridge: vi-IV-I-V movement, maj7 color",
      "killingPointText": "pre-chorus opens up and lifts into the hook",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-01",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "87 BPM + intimate + horn stab → 중간",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "jazz-rap",
        "trap-soul",
        "chill-rap"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "walking upright bass",
        "brush drums"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T2",
      "introMode": "vocal-after-texture",
      "lyricTheme": "enchillhop-saturday-farmers-market",
      "lyricThemeText": "wandering a Saturday farmers market with nowhere to be, sunlight cutting through the stalls",
      "lyricThemeArc": "low-grade weekday tension unwinding into easy weekend calm",
      "lyricFrameId": "daylight-city",
      "lyricThemeMotionKo": "이동 중(도보)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kridol-f-social",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "female soft head-voice lead, restrained understated reading, warm rounded midrange, intimate close-mic, bebop-inflected scat syllables on the break",
      "vocalVariantText": "female soft head-voice lead, restrained understated reading, warm rounded midrange, intimate close-mic, bebop-inflected scat syllables on the break",
      "vocalTechniqueText": "bebop-inflected scat syllables on the break",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 6,
      "title": "Window",
      "hookPhrase": "Wait by the Window",
      "songRole": "romantic shade without melodrama",
      "tempo": 80,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        173,
        236
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "warm reunion feeling lifting into brighter delight",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift",
      "genreId": "trap-soul",
      "genreText": "808 slides, 808 slide bass, tight hi-hat rolls, dusty sample texture",
      "signatureSound": "808 slide bass, tight hi-hat rolls, dark synth pad, BPM 62-82; Verse is sparse with dark pads",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, aggressive drill energy, festival EDM drop, overly bright pop-rock guitars, bright EDM synths, heavy club trap drop, busy rap verses",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "chorusContrastPlanId": "full-band-swell",
      "chorusContrastText": "Verse: sparse verse — guitar and voice only / Chorus: full band enters — bass, drums, string pad, doubled vocal",
      "chorusContrastScore": 68,
      "killingPointText": "short vocal hook tag right after the chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-KR2030-02",
      "arcPhase": "peak",
      "intensity": 5,
      "peakStrength": "strong",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "80 BPM + intimate → 낮음",
      "moneyChordId": "emotional",
      "effectiveMoneyChordId": "emotional",
      "effectiveGenreIds": [
        "trap-soul",
        "chill-rap",
        "lofi-hiphop-study"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "808 slide bass",
        "tight hi-hat rolls",
        "lofi drum kit"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-biking-home-late-empty-streets",
      "lyricThemeText": "biking home late through empty streets, the whole city briefly feeling like it belongs to no one else",
      "lyricThemeArc": "wired late-night energy settling into free, weightless ease",
      "lyricFrameId": "night-city-move",
      "lyricThemeMotionKo": "이동 중(자전거)",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kridol-m-crew-road",
      "pov": "secondPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "alternating verses into joined chorus, tight unison with light detune, dry and forward, male and female duet, soft falsetto ad-libs in the bridge",
      "vocalVariantText": "alternating verses into joined chorus, tight unison with light detune, dry and forward, male and female duet, soft falsetto ad-libs in the bridge",
      "vocalTechniqueText": "soft falsetto ad-libs in the bridge",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 7,
      "title": "Morning & Velvet",
      "hookPhrase": "Breathe with Me, Morning",
      "songRole": "passionate turning point",
      "tempo": 89,
      "sectionCountRange": [
        6,
        7
      ],
      "wordCountRange": [
        171,
        234
      ],
      "maxInstrumentalSections": 2,
      "estimatedLengthSec": 190,
      "emotionArc": "joyful memory blooming into bigger joy",
      "moneyChordText": "vi-IV-I-V movement, maj7 color",
      "genreId": "boom-bap-mellow",
      "genreText": "dusty drums, dusty boom-bap drums, filtered bass",
      "signatureSound": "dusty boom-bap drums, filtered bass, soul sample texture, mellow boom-bap",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, hard battle-rap tone, glossy EDM drums, overcrowded percussion, aggressive drill energy, festival EDM drop, bright EDM synths",
      "eraPaletteText": "filtered upright bass sitting under the beat, sampler-era band-limited top end, nothing sparkling above it, drums compressed until the room between hits pumps",
      "introTextureText": "glassy electric piano chord intro texture (INTRO ONLY)",
      "introTextureId": "ep_glass_chords",
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
          "chordId": "marusa"
        }
      ],
      "moneyChordSectionText": "Verse: vi-IV-I-V movement, maj7 color / Chorus: IVM7-III7-vi-I7 marusa progression",
      "killingPointText": "arrangement thins out then re-enters full for the last chorus",
      "killingPointPlacement": "bridge",
      "killingPointId": "KP-KR2030-03",
      "arcPhase": "peak",
      "intensity": 5,
      "peakStrength": "strong",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "89 BPM + legato sustained → 중간",
      "moneyChordId": "cityPop",
      "effectiveMoneyChordId": "cityPop",
      "effectiveGenreIds": [
        "boom-bap-mellow",
        "trap-soul",
        "chill-rap"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "dusty boom-bap drums",
        "soul sample texture"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T5",
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
      "vocalText": "male low warm baritone, legato sustained lines, slight nasal brightness, tape slap echo, clipped staccato rap delivery",
      "vocalVariantText": "male low warm baritone, legato sustained lines, slight nasal brightness, tape slap echo, clipped staccato rap delivery",
      "vocalTechniqueText": "clipped staccato rap delivery",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 8,
      "title": "While Darling & Frost",
      "hookPhrase": "Stay a While, Darling",
      "songRole": "quiet middle scene",
      "tempo": 82,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        174,
        237
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 191,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "ii-V-I turnaround, maj7 add9 color",
      "genreId": "lofi-hiphop-study",
      "genreText": "lo-fi hip-hop study beat, dusty piano loop, vinyl crackle, optional soft hook vocal kept low",
      "signatureSound": "dusty piano loop, vinyl crackle, loose swing drums, lo-fi hip-hop study beat",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, busy rap verses, loud vinyl crackle, bright EDM synths, aggressive drill energy, festival EDM drop, overly bright pop-rock guitars",
      "eraPaletteText": "jazz turnaround repeating under the whole verse, drums compressed until the room between hits pumps, vocal mixed close and low, sitting inside the beat rather than on top",
      "introTextureText": "glockenspiel-like bell synth intro texture (INTRO ONLY)",
      "introTextureId": "syn_bell_glock",
      "hookDeviceText": "a short instrumental riff answers the vocal hook after each chorus line, call and response",
      "hookDeviceId": "answer-riff",
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
      "killingPointText": "a brief full stop right before the beat drops back in",
      "killingPointPlacement": "mid-instrumental",
      "killingPointId": "KP-KR2030-04",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "82 BPM + breathy → 낮음",
      "moneyChordId": "jazzColor",
      "effectiveMoneyChordId": "jazzColor",
      "effectiveGenreIds": [
        "lofi-hiphop-study",
        "trap-soul",
        "chill-rap"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "dusty piano loop",
        "warm bass",
        "loose swing drums"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-bedroom-studio-setup",
      "lyricThemeText": "sitting at a small bedroom studio desk past midnight, one lamp on, headphones half off one ear",
      "lyricThemeArc": "scattered self-doubt narrowing into focused, patient work",
      "lyricFrameId": "solitary-room",
      "lyricThemeMotionKo": "정적",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "kr2030-solitary-room",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "narration answered wordlessly, loose lines meeting hook, narrow mono-leaning room, male and female duet, breathy sigh trailing the final line",
      "vocalVariantText": "narration answered wordlessly, loose lines meeting hook, narrow mono-leaning room, male and female duet, breathy sigh trailing the final line",
      "vocalTechniqueText": "breathy sigh trailing the final line",
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 9,
      "title": "Rest Here, My Love",
      "hookPhrase": "Rest Here, My Love",
      "songRole": "tender reflective pause",
      "tempo": 78,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        166,
        229
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "bright laughter softening into a quiet farewell",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift",
      "genreId": "chill-rap",
      "genreText": "chill rap, lofi drum kit, jazz sample texture",
      "signatureSound": "lofi drum kit, jazz sample texture, mellow sub bass, BPM 70-85; Verse keeps an unhurried conversational flow over lofi drums and a soft sample-texture loop",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, bright EDM synths, heavy club trap drop, aggressive drill energy, festival EDM drop, overly bright pop-rock guitars, busy rap verses",
      "eraPaletteText": "jazz turnaround repeating under the whole verse, drums compressed until the room between hits pumps, vocal mixed close and low, sitting inside the beat rather than on top",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "chorusContrastPlanId": "call-response-texture",
      "chorusContrastText": "Verse: verse — lead vocal alone over a light rhythm section / Chorus: backing vocals answer each line, a percussion layer widens the groove",
      "chorusContrastScore": 53,
      "killingPointText": "a second vocal layer stacks in on the final chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-KR2030-05",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "78 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "emotional",
      "effectiveMoneyChordId": "emotional",
      "effectiveGenreIds": [
        "chill-rap",
        "trap-soul",
        "lofi-hiphop-study"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "lofi drum kit",
        "mellow sub bass"
      ],
      "arrangementDensity": "medium",
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
      "vocalText": "male relaxed mid-range lead, gentle swung phrasing, warm woody midrange, chamber ambience, dragged-vowel laid-back drawl",
      "vocalVariantText": "male relaxed mid-range lead, gentle swung phrasing, warm woody midrange, chamber ambience, dragged-vowel laid-back drawl",
      "vocalTechniqueText": "dragged-vowel laid-back drawl",
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 10,
      "title": "Where Are You Tonight",
      "hookPhrase": "We Made It Through",
      "songRole": "soft reset before the closing run",
      "tempo": 97,
      "sectionCountRange": [
        9,
        11
      ],
      "wordCountRange": [
        179,
        242
      ],
      "maxInstrumentalSections": 4,
      "estimatedLengthSec": 191,
      "emotionArc": "bright laughter softening into a quiet farewell",
      "moneyChordText": "vi-IV-I-V movement, maj7 color",
      "genreId": "jazz-rap",
      "genreText": "jazz rap, walking upright bass, brush drums, relaxed rap pocket",
      "signatureSound": "walking upright bass, brush drums, muted horn stabs, jazz rap",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, fast technical rap display, busy bebop solo clutter, trap hi-hat rolls, aggressive drill energy, festival EDM drop, bright EDM synths",
      "eraPaletteText": "jazz turnaround repeating under the whole verse, drums compressed until the room between hits pumps, vocal mixed close and low, sitting inside the beat rather than on top",
      "introTextureText": "soft synth arpeggio intro texture (INTRO ONLY)",
      "introTextureId": "syn_soft_arp",
      "hookDeviceText": "drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat",
      "hookDeviceId": "prechorus-dropout",
      "chorusContrastPlanId": "strings-swell",
      "chorusContrastText": "Verse: verse stays intimate — guitar, upright bass, soft kick / Chorus: string section swells in, backing harmony stacks, fuller low end",
      "chorusContrastScore": 55,
      "killingPointText": "backing vocal ad-lib answers the hook",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-KR2030-06",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "97 BPM + intimate + horn stab → 중간",
      "moneyChordId": "cityPop",
      "effectiveMoneyChordId": "cityPop",
      "effectiveGenreIds": [
        "jazz-rap",
        "trap-soul",
        "chill-rap"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "walking upright bass",
        "jazz piano loop",
        "muted horn stabs"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "introMode": "instrumental",
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
      "vocalText": "female narrow intimate lead, bright forward delivery, slight smoky depth, warm natural room, sharp staccato scat over the changes",
      "vocalVariantText": "female narrow intimate lead, bright forward delivery, slight smoky depth, warm natural room, sharp staccato scat over the changes",
      "vocalTechniqueText": "sharp staccato scat over the changes",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 11,
      "title": "Light Candle & Velvet",
      "hookPhrase": "Light the Candle Again",
      "songRole": "peaceful farewell moment",
      "tempo": 64,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        165,
        228
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 191,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "I-V-vi-IV progression",
      "genreId": "trap-soul",
      "genreText": "808 slides, 808 slide bass, tight hi-hat rolls",
      "signatureSound": "808 slide bass, tight hi-hat rolls, dark synth pad, BPM 62-82; Verse is sparse with dark pads",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, aggressive drill energy, festival EDM drop, overly bright pop-rock guitars, bright EDM synths, heavy club trap drop, busy rap verses",
      "introTextureText": "bright synth pluck intro texture (INTRO ONLY)",
      "introTextureId": "syn_bright_pluck",
      "hookDeviceText": "final chorus modulates up a semitone for a lift",
      "hookDeviceId": "key-lift",
      "chorusContrastPlanId": "unison-doubling",
      "chorusContrastText": "Verse: verse carried by piano and soft brushes / Chorus: chorus doubles the lead vocal in unison, adds tambourine and organ pad",
      "chorusContrastScore": 49,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "default"
        },
        {
          "section": "Chorus",
          "chordId": "popStandard"
        }
      ],
      "moneyChordSectionText": "Verse: I-V-vi-IV progression / Chorus: I-vi-ii-V progression",
      "killingPointText": "rising synth filter sweep into the chorus",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-KR2030-07",
      "arcPhase": "closing",
      "intensity": 1,
      "peakStrength": "subtle",
      "perceivedEnergy": 1,
      "perceivedEnergyReasonKo": "64 BPM + breathy → 낮음",
      "moneyChordId": "default",
      "effectiveMoneyChordId": "default",
      "effectiveGenreIds": [
        "trap-soul",
        "chill-rap",
        "lofi-hiphop-study"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "808 slide bass",
        "minimal snare"
      ],
      "arrangementDensity": "sparse",
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
      "vocalText": "female low warm contralto, tender confiding delivery, velvety low resonance, dry and forward, breathy falsetto ad-lib on the hook",
      "vocalVariantText": "female low warm contralto, tender confiding delivery, velvety low resonance, dry and forward, breathy falsetto ad-lib on the hook",
      "vocalTechniqueText": "breathy falsetto ad-lib on the hook",
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 12,
      "title": "I'll Wait for Morning",
      "hookPhrase": "I'll Wait for Morning",
      "songRole": "warm goodnight track",
      "tempo": 78,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        172,
        235
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 190,
      "emotionArc": "quiet contentment resting undisturbed throughout",
      "moneyChordText": "I-V-vi-iii-IV-I-IV-V progression",
      "genreId": "boom-bap-mellow",
      "genreText": "dusty drums, dusty boom-bap drums, filtered bass, dusty drum breaks",
      "signatureSound": "dusty boom-bap drums, filtered bass, soul sample texture, mellow boom-bap",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, vintage tape saturation, 1970s AM-radio compression, nostalgic senior-radio announcer tone, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, specific rapper imitation, named artist flow biting, signature hook of an existing song, aggressive battle-rap delivery, gunshot or violence imagery, explicit drug-dealing narrative, overlong intro, hard battle-rap tone, glossy EDM drums, overcrowded percussion, aggressive drill energy, festival EDM drop, bright EDM synths",
      "eraPaletteText": "phrases ending early and leaving the loop exposed, vocal mixed close and low, sitting inside the beat rather than on top, drums compressed until the room between hits pumps",
      "introTextureText": "glassy electric piano chord intro texture (INTRO ONLY)",
      "introTextureId": "ep_glass_chords",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "chorusContrastPlanId": "full-band-swell",
      "chorusContrastText": "Verse: sparse verse — guitar and voice only / Chorus: full band enters — bass, drums, string pad, doubled vocal",
      "chorusContrastScore": 68,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "canon"
        },
        {
          "section": "Chorus",
          "chordId": "popStandard"
        },
        {
          "section": "Bridge",
          "chordId": "default"
        }
      ],
      "moneyChordSectionText": "Verse: I-V-vi-iii-IV-I-IV-V progression / Chorus: I-vi-ii-V progression / Bridge: I-V-vi-IV progression",
      "arcPhase": "closing",
      "intensity": 1,
      "peakStrength": "none",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "78 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "canon",
      "effectiveMoneyChordId": "canon",
      "effectiveGenreIds": [
        "boom-bap-mellow",
        "trap-soul",
        "chill-rap"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "dusty boom-bap drums",
        "808 slide bass",
        "soul sample texture"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T4",
      "introMode": "vocal-after-texture",
      "lyricTheme": "enchillhop-crosswalk-waiting-neon",
      "lyricThemeText": "standing at a crosswalk under a neon sign, waiting for the light with a hundred strangers moving around",
      "lyricThemeArc": "restless impatience settling into observant calm",
      "lyricFrameId": "city-lights",
      "lyricThemeMotionKo": "정적",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "city-night",
      "pov": "thirdPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "male narrow crooner tone, conversational unhurried phrasing, smoky low resonance, soft plate ambience, swallowed-consonant husky rap cadence",
      "vocalVariantText": "male narrow crooner tone, conversational unhurried phrasing, smoky low resonance, soft plate ambience, swallowed-consonant husky rap cadence",
      "vocalTechniqueText": "swallowed-consonant husky rap cadence",
      "vocalGender": "male",
      "vocalType": "male"
    }
  ],
  "alreadyUsedScenes": [],
  "alreadyUsedLyricLines": [],
  "alreadyUsedOpenings": [],
  "meta": {
    "setName": "20260825_HeadphonesDownLow_옥상에서듣는칠랩",
    "generatedAt": "2026-08-25T00:55:47.582Z",
    "channelId": "headphones-down-low",
    "channelLabel": "Headphones, Down Low",
    "conceptLabel": "옥상에서 듣는 칠 랩",
    "songCount": 12,
    "lyricLanguage": "english",
    "bridgeVersion": "0.0.0-dev"
  }
}
```

Output requirement:
- Write a new file named "lyrics/20260825_HeadphonesDownLow_옥상에서듣는칠랩.json" in the current directory.
- If the "lyrics" folder doesn't exist yet, create it first.
- Never overwrite an existing file. If "lyrics/20260825_HeadphonesDownLow_옥상에서듣는칠랩.json" already exists, append "_02" (then "_03", etc.) before the .json extension and write there instead.
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
- Track 1 is slow — 64 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 154-216 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 154-216 words already fills the pack's target song length.
- Track 3 is slow — 76 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 165-228 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 165-228 words already fills the pack's target song length.
- Track 4 is slow — 78 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 166-229 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 166-229 words already fills the pack's target song length.
- Track 9 is slow — 78 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 166-229 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 166-229 words already fills the pack's target song length.
- Track 11 is slow — 64 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 165-228 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 165-228 words already fills the pack's target song length.
- Track 12 is slow — 78 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 172-235 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 172-235 words already fills the pack's target song length.

[Fast-tempo tracks — section floor, read before writing these]
At these tempos every bar is short, so the SAME section count that fills 3:20 at 77 BPM only fills about 1:58 at 114 BPM. This is a real measurement, not an estimate: a 114 BPM track carrying the most lyrics in its whole pack still came back at 1:58 because it had 7 sections. Writing "3:10-3:35" into the stylePrompt does not fix it — Suno follows the section structure of the lyrics, so the section count below is what actually sets the length.
Fill the extra sections with INSTRUMENTAL-only sections, never with more sung verses — that is what the larger "max instrumental sections" number on these tracks is for. Splitting the same words across more vocal sections makes every section thin; a build-up intro, a breakdown, an instrumental break, or an outro adds real clock time without diluting the writing.
- Track 10 — 97 BPM: MUST have at least 9 sections (target 9-11). Its assigned structure template (T4) is the VOCAL SPINE only; wrap 3 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
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
- Each "preassignedSongs" entry with a "vocalTechniqueText" field (e.g. "airy head-voice glide into the chorus, nasal-edged ad-lib stack on the outro") carries this track's assigned singing TECHNIQUE — how the voice is sung (melisma, scat, falsetto lift, behind-the-beat phrasing...), not its timbre/register. The app picked this phrase to avoid repeating the same technique across this pack's songs. Use this exact technique phrase in the vocal slot of the stylePrompt, alongside (not replacing) the register/timbre clauses you select from "vocalText". Do not substitute a different technique and do not paraphrase it away.


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