[Generated 2026-08-25T00:55:47.572Z — bridge instruction schema v3.64]

You are an experienced music composer/producer generating song content for a Suno playlist pack as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file. Compose each song using your own musical knowledge within the plan and constraints below; do not treat reference fields as scripts to transcribe verbatim.

[이 세트가 하려는 것]

  컨셉    오래된 라디오에서 흘러나오던 저녁
  청취자  1970年代の日本歌謡、フォーク、ニューミュージック感性を軸にした日本語プレイリスト
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

  세트 전체를 느슨하게 잇는 이야기 하나를 둘 수 있습니다 (강제 아님, 제안일 뿐입니다).
    예: 같은 계절의 하루 (아침 → 밤), 또는 같은 인물의 젊은 날과 지금, 또는 같은 장소의 다른 시간

  대비를 만드십시오 — 12곡이 전부 좋으면 무엇이 좋은지 알 수 없습니다.
    가장 조용한 곡 1곡 · 가장 밝은 곡 1곡 · 가장 짧은 곡 1곡 · 가장 특이한 곡 1곡(탐색 슬롯)

  1번과 4번 트랙은 담백하게 만들어, 2~3번(대표곡)이 상대적으로 돋보이게 하십시오.

  마지막 트랙은 완전히 끝내지 말고 여운을 남기며, 1번 트랙의 요소를 살짝 반영하십시오 (플레이리스트는 반복 재생됩니다).




[SetPlan handoff]
[This pack's 12-track plan]
| Track | Genre | Era | BPM | Vocal | Structure | Intro | Scene frame | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1970s New Music | 1970s | 63 BPM | female | T1 | no [intro] tag at all — singing starts immediately | screen-memory | cold-open |
| 2 | 1970s Japanese Folk | 1970s | 76 BPM | mixed | T4 | instrumental (no lyric line under [intro]) | crowd-alone | flagship |
| 3 | 1970s New Music | 1970s | 82 BPM | male | T4 | instrumental (no lyric line under [intro]) | school-memory | flagship |
| 4 | 1970s Showa Groove | 1970s | 96 BPM | female | T2 | short [intro] line allowed | festival-crowd | seasonal detail track |
| 5 | 1970s Japanese Folk | 1970s | 76 BPM | male | T4 | instrumental (no lyric line under [intro]) | seasonal-marker | easy singalong verse |
| 6 | 1970s New Music | 1970s | 82 BPM | female | T4 | instrumental (no lyric line under [intro]) | parallel-world | big emotional high point |
| 7 | 1970s Showa Groove | 1970s | 96 BPM | mixed | T2 | short [intro] line allowed | inner-monologue | romantic shade without melodrama |
| 8 | 1970s Japanese Folk | 1970s | 88 BPM | male | T3 | instrumental (no lyric line under [intro]) | narrative-arc | soft reset before the closing run |
| 9 | 1970s New Music | 1970s | 94 BPM | female | T2 | no [intro] tag at all — singing starts immediately | self-affirmation | tender reflective pause |
| 10 | 1970s Showa Groove | 1970s | 63 BPM | male | T4 | short [intro] line allowed | stage-declaration | memory-focused late track |
| 11 | 1970s Japanese Folk | 1970s | 88 BPM | male | T2 | short [intro] line allowed | turning-point | final quiet reflection |
| 12 | 1970s New Music | 1970s | 63 BPM | female | T4 | no [intro] tag at all — singing starts immediately | crew-together | comforting closer |

Follow each track's "Intro" column exactly: "instrumental" tracks must have NO lyric line under [intro] (an instrumental cue there is fine, e.g. "[intro]" with nothing sung until the next tag); "no [intro] tag at all" tracks should skip the [intro] tag entirely and start singing right away; "short [intro] line allowed" tracks may have a brief sung line there.

Scene frames used in this pack: screen-memory (1); crowd-alone (2); school-memory (3); festival-crowd (4); seasonal-marker (5); parallel-world (6); inner-monologue (7); narrative-arc (8); self-affirmation (9); stage-declaration (10); turning-point (11); crew-together (12). Each track's own scene/lyricThemeText is the specific detail — write a genuinely different kind of moment per frame, not the same "alone, looking at something" scene with the object swapped out.
Scene mix across this pack - cast: alone 6, a group 5, two people 1. Keep this mix - do not flatten every track without an explicit motion/cast axis into the same quiet-alone shape either.

[Diversity groups] - constraints, not wording to copy:
introTexture A:1  B:2  C:3,11  D:4  E:5,9  F:6,12  G:7  H:8,10
hookDevice A:1,8  B:2,9  C:3,10  D:4,11  E:5,12  F:6  G:7
arrangementDensity medium A:1,4,6,8,9  sparse B:2,3,11,12  full C:5,7,10
Tracks in the same group may share a similar approach; tracks in different groups must feel clearly different. Choose the concrete musical wording yourself.

[Lyric scenes] - write THIS scene into each track's actual verses/chorus, in your own words (never quote the description verbatim as a lyric line). Do NOT default to a quiet, solitary "watching something alone" scene for these tracks even if that is this app's usual mood elsewhere in the pack - if a scene names motion (dancing, driving, traveling) or more than one person present, the lyrics must show that motion/energy/company, not replace it with stillness or solitude.
  Track 1: opening an old personal web diary and a downloaded mp3 playlist saved from teenage years, a private photo mood board nobody else ever saw
    emotional turn: surprised nostalgia softening into fond amusement
    cast: alone
  Track 2: standing at the edge of a crowded party with a drink going warm, watching everyone else move
    emotional turn: isolated self-consciousness easing into comfortable detachment
    cast: alone
  Track 3: standing in a school gymnasium during a graduation ceremony, classmates crying and laughing at the same time, the future suddenly feeling real
    emotional turn: bittersweet farewell opening into hopeful resolve
    cast: a group
  Track 4: walking through a summer festival crowd in a yukata, fireworks bursting overhead, losing a friend in the crowd for just a second
    emotional turn: excited anticipation building into pure joy
    cast: a group
  Track 5: walking alone down a path lined with turning autumn leaves after a long week, breath visible in the cool evening air
    emotional turn: tired numbness easing into calm clarity
    cast: alone
  Track 6: trying to call out to someone who is already walking away across a crowded platform, the words never quite reaching
    emotional turn: helpless longing tightening into determined resolve
    cast: two people
  Track 7: standing in front of a mirror rehearsing words that need to be said to someone tomorrow, voice barely above a whisper
    emotional turn: nervous hesitation firming into quiet courage
    cast: alone
  Track 8: standing backstage moments before stepping into the spotlight, heart pounding, deciding to give everything this one time
    emotional turn: nervous fear transforming into fierce determination
    cast: alone
  Track 9: tripping over the words during a class presentation and laughing it off with classmates instead of shrinking away
    emotional turn: embarrassed panic dissolving into shared laughter and relief
    cast: a group
  Track 10: standing in the wings on debut night, hearing the crowd for the very first time and feeling the ground shift underfoot
    emotional turn: overwhelming nerves crystallizing into pure resolve
    cast: a group
  Track 11: pushing through the final chorus of a brutal dance break, body exhausted but the voice getting louder instead of weaker
    emotional turn: physical limit turning into a surge of defiant strength
    cast: alone
  Track 12: standing together backstage after a hard-won win, realizing no one handed this path to them, they built it themselves
    emotional turn: quiet disbelief settling into shared pride
    cast: a group

[Vocabulary per track] - REFERENCE word lists matched to each track's own scene, not a checklist. Do NOT just list these words in a row or force all of them in - write natural, singable lyrics in your own words that happen to live in this same vocabulary world. A lyric that reads like a word list stitched together is worse than one that uses none of these words but still captures the scene. Where an "avoid" list is given, steer away from those words for this specific track (they belong to a different mood this scene isn't).
  Track 1: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 2: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 3: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 4: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 5: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 6: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 7: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 8: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 9: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 10: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 11: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still
  Track 12: window, cup, kettle, letter, sit, watch, fold, quiet, soft, still

[Killing points] - each track's one designed peak moment, an idea to realize in your own words, never a phrase to quote verbatim. This should be the loudest, fullest, most energetic point of the ENTIRE song — clearly audible as a lift, not a small nudge — and the section right before it should stay noticeably more restrained (thinner arrangement, lower energy) so the peak has something real to rise from, instead of the whole song sitting at one constant level. Build this through arrangement fullness and dynamics, never through belting or harsh top end — the audience's vocal-register/production exclusions elsewhere in this instruction still apply in full at the peak. Critically, this moment must also be NAMED as a concrete, specific clause in the stylePrompt text itself (your own wording for the actual technique — an octave lift, a key/half-step modulation, a stripped-then-full swell, a sustained note into the chorus, etc.) — realizing the dynamic without ever describing it in the prompt text does not satisfy this. A track not listed here has no designed peak moment — keep it comfortably at its usual level throughout, do not invent one.
  Track 2 (final-chorus): minor verse opening into a major final chorus
  Track 3 (bridge): instruments drop out in the bridge
  Track 4 (final-chorus): three-part harmony on the last chorus
  Track 5 (bridge): vocal scat trades phrases with the piano
  Track 6 (final-chorus): group sings the title hook in tight unison
  Track 7 (pre-chorus): nonsense-syllable vocal unison on the hook
  Track 8 (final-chorus): gospel-style melisma run on the final phrase
  Track 9 (final-chorus): full ensemble unison on the final hook
  Track 10 (outro): hook repeated almost a cappella as the outro
  Track 11 (final-chorus): sustained lead note into the final chorus





CRITICAL — tempo: use each track's own "BPM" value from the table above exactly, in every song's stylePrompt. Do not average, round toward a comfortable middle, or otherwise smooth tempos across tracks — the spread between tracks is intentional.

This pack's 12 tracks (plan fixed by the app — compose within each row, do not renumber or reorder):
| Track | Genre | BPM | Vocal | Role | Length target |
| --- | --- | --- | --- | --- | --- |
| 1 | 1970s New Music | 63 BPM | female narrow intimate lead, tender confiding delivery, velvety low resonance, tape slap echo, enka-inflected bend on long tones, melismatic slide into the chorus | cold-open | 5-6 sections, 178-203 words, max 1 instrumental section |
| 2 | 1970s Japanese Folk | 76 BPM | call and answer, wide octave harmony, chamber ambience, male and female duet, nasal folk-toned phrasing on the hook, husky plainspoken phrasing on the verse | flagship | 5-6 sections, 197-222 words, max 1 instrumental section |
| 3 | 1970s New Music | 82 BPM | male mid baritone-tenor lead, earnest forward delivery, worn weathered edge, soft plate ambience, quivering vibrato on the sustained note, plaintive held-note vibrato on the hook | flagship | 5-6 sections, 199-224 words, max 1 instrumental section |
| 4 | 1970s Showa Groove | 96 BPM | female full chest alto, light rhythmic phrasing, faint vibrato shimmer, warm natural room, plainspoken storyteller phrasing | seasonal detail track | 9-11 sections, 199-224 words, max 3 instrumental sections |
| 5 | 1970s Japanese Folk | 76 BPM | male low warm baritone, clipped rhythmic phrasing, warm woody midrange, dry and forward, legato phrasing unhurried through the bridge | easy singalong verse | 5-6 sections, 197-222 words, max 1 instrumental section |
| 6 | 1970s New Music | 82 BPM | female clear mezzo lead, bright forward delivery, clean bell tone, chamber ambience, vibrato held into the final syllable | big emotional high point | 5-6 sections, 199-224 words, max 1 instrumental section |
| 7 | 1970s Showa Groove | 96 BPM | unison splitting to thirds, close third harmony, warm natural room, male and female duet, soulful rasp on the emotional peak | romantic shade without melodrama | 9-11 sections, 199-224 words, max 3 instrumental sections |
| 8 | 1970s Japanese Folk | 88 BPM | male chest-to-falsetto shifting lead, restrained understated reading, slight nasal brightness, chamber ambience, breathy conversational delivery throughout, gentle vibrato on the sustained hook | soft reset before the closing run | 6-7 sections, 199-224 words, max 2 instrumental sections |
| 9 | 1970s New Music | 94 BPM | female low warm contralto, gentle swung phrasing, warm rounded midrange, tape slap echo, legato line easing into the chorus | tender reflective pause | 6-7 sections, 198-223 words, max 2 instrumental sections |
| 10 | 1970s Showa Groove | 63 BPM | male thin bright tenor, legato sustained lines, clean rounded tone, narrow mono-leaning room, kobushi-style vocal ornament on sustained notes | memory-focused late track | 5-6 sections, 189-214 words, max 1 instrumental section |
| 11 | 1970s Japanese Folk | 88 BPM | male bright tenor lead, storytelling spoken-edge delivery, soft husky grain, intimate close-mic, restrained delivery never oversung | final quiet reflection | 6-7 sections, 196-221 words, max 2 instrumental sections |
| 12 | 1970s New Music | 63 BPM | female mid clear alto, conversational unhurried phrasing, soft breathy grain, soft plate ambience, melismatic slide into the chorus | comforting closer | 5-6 sections, 189-214 words, max 1 instrumental section |

[This set's vocal composition]
  Track 1: Female Solo
  Track 2: Male-Female Duet
  Track 3: Male Solo
  Track 4: Female Solo
  Track 5: Male Solo
  Track 6: Female Solo
  Track 7: Male-Female Duet
  Track 8: Male Solo
  Track 9: Female Solo
  Track 10: Male Solo
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
- Each song's "lyrics" must total 215-230 words (not counting section tags like [chorus]) — this is what actually determines Suno's rendered length; a short lyric renders noticeably shorter than target regardless of any target duration. Target render length for this pack: 3:10-3:35.
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
- For 1970s Japanese lyrics, keep scenes in night trains, ports, umbrellas, kissaten, handwritten letters, station farewells, alley street lamps, and seasonal windows. Use slightly literary Japanese with a balanced kanji/hiragana texture. Do not mention modern phones, apps, SNS, streaming, selfies, QR codes, or internet slang.
- Record factual human lyric edits when provided; never claim that a song is eligible for collecting-society registration.

Batch mode:
- This request only covers tracks 1 to 12 out of 12 total songs in the pack.
- Number "trackNo" starting at 1, not 1.
- Never reuse any title or hook phrase already listed in "alreadyUsedTitles" / "alreadyUsedHooks" in the user payload.
- If "lockedIdentity" is present in the user payload, reuse its sonicSignature, vocalSignature, lyricRules, harmonyRules, and visualRules verbatim so the whole pack stays consistent across batches.

Request payload for this pack (channel/genre/mood/season context, already-used titles/hooks to avoid, and this pack's preassigned title/hook per track):
```json
{
  "channel": {
    "id": "showa-seventies",
    "name": "昭和セブンティーズ",
    "englishName": "Showa Seventies",
    "market": "japan",
    "primaryLanguage": "japanese",
    "audience": "seniors",
    "promise": "1970年代の日本歌謡、フォーク、ニューミュージック感性を軸にした日本語プレイリスト",
    "visualIdentity": "1970s Showa film grain, warm color temperature, kissaten paper textures, station lights, restrained Japanese retro typography",
    "defaultVocal": "mature Japanese male tenor, intimate close-mic delivery, restrained vibrato, warm analog presence",
    "preferredGenres": [
      "kayokyoku-70s",
      "japanese-folk-70s",
      "new-music-70s",
      "showa-groove-70s"
    ],
    "preferredMoods": [
      "nostalgic",
      "elegant",
      "bittersweet"
    ],
    "forbiddenCliches": [
      "modern EDM synths",
      "trap hi-hats",
      "hard autotune",
      "sidechain pumping",
      "ultra-wide modern mix",
      "famous artist imitation",
      "enka-like melodrama"
    ],
    "seoKeywords": [
      "昭和歌謡",
      "70年代 日本の歌",
      "昭和 フォーク",
      "ニューミュージック",
      "懐かしい日本語曲",
      "昭和プレイリスト"
    ],
    "archetype": "showa-70s"
  },
  "projectTitle": "Test Pack",
  "songCount": 12,
  "lyricLanguage": "english",
  "market": "japan",
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
      "id": "kayokyoku-70s",
      "label": "1970s Kayokyoku",
      "styleCore": "1970s Japanese kayokyoku, live brass section, sweeping strings, wet spring and plate reverb, analog tape saturation, narrow stereo image, soft top-end rolloff",
      "arrangementNarrative": "BPM 78-94; Verse begins with close Japanese vocal over brushed kit and electric piano, pre-chorus opens live strings and a brass answer phrase, chorus lifts with a graceful kayokyoku cadence, hook entry uses a short drum-bass dropout before the downbeat, mix keeps analog tape saturation, spring reverb, and narrow stereo warmth",
      "instruments": [
        "electric piano",
        "live brass section",
        "live strings",
        "brushed drums",
        "round electric bass"
      ],
      "tempoRange": [
        78,
        94
      ],
      "goodFor": [
        "Showa seventies channel",
        "Japanese senior playlist",
        "station farewell scenes"
      ],
      "archetypes": [
        "showa-70s"
      ],
      "tier": "core",
      "categoryId": "japanese-era",
      "source": "legacy-preset",
      "rhythm": [
        "restrained kayokyoku ballad pulse",
        "brass stabs marking each chorus entrance",
        "brushed drums holding an unhurried pulse"
      ],
      "vocal": [
        "mature Japanese lead vocal",
        "kobushi-style vocal ornament on sustained notes",
        "vibrato held into the final syllable of each line"
      ],
      "production": [
        "analog tape saturation",
        "spring and plate reverb",
        "narrow stereo image"
      ],
      "harmony": [
        "graceful minor-to-major chorus cadence",
        "sweeping string countermelody under the chorus",
        "suspended fourth resolving into the tonic at the hook"
      ],
      "tempo": [
        78,
        94
      ],
      "moods": [
        "nostalgic",
        "cinematic"
      ],
      "audiences": [
        "Japanese seniors",
        "Showa playlist listeners"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "modern EDM synths",
        "trap hi-hats",
        "hard autotune"
      ],
      "shortPrompt": "1970s Kayokyoku, restrained kayokyoku ballad pulse, mature Japanese lead vocal, electric piano + live brass section, analog tape saturation, 78-94 BPM",
      "productionGuidance": "1970s Kayokyoku: build around restrained kayokyoku ballad pulse and brass stabs marking each chorus entrance, keep mature Japanese lead vocal, feature electric piano, live brass section, live strings, brushed drums, use graceful minor-to-major chorus cadence, mix with analog tape saturation and spring and plate reverb, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "electric piano, live brass section, live strings, BPM 78-94; Verse begins with close Japanese vocal over brushed kit and electric piano"
    },
    {
      "id": "japanese-folk-70s",
      "label": "1970s Japanese Folk",
      "styleCore": "1970s Japanese folk, acoustic guitar centered, modest live ensemble, close-mic vocal, dry room intimacy, analog tape softness, no modern polish",
      "instruments": [
        "fingerpicked acoustic guitar",
        "light upright piano",
        "soft hand percussion",
        "simple bass"
      ],
      "tempoRange": [
        82,
        100
      ],
      "goodFor": [
        "Showa seventies channel",
        "handwritten letter scenes",
        "night train scenes"
      ],
      "archetypes": [
        "showa-70s"
      ],
      "tier": "core",
      "categoryId": "japanese-era",
      "source": "legacy-preset",
      "rhythm": [
        "plain acoustic folk pulse",
        "fingerpicked guitar carrying the pulse alone",
        "light hand percussion entering only at the chorus"
      ],
      "vocal": [
        "unforced close Japanese vocal",
        "plainspoken delivery close to speech",
        "unaccompanied vocal opening before the guitar enters"
      ],
      "production": [
        "close-mic intimacy",
        "soft analog tape hiss",
        "small room realism"
      ],
      "harmony": [
        "simple folk-pop movement",
        "open-string folk chord voicings",
        "gentle modal touch under an otherwise diatonic verse"
      ],
      "tempo": [
        82,
        100
      ],
      "moods": [
        "plainspoken",
        "wistful"
      ],
      "audiences": [
        "Japanese folk listeners",
        "Showa playlist listeners"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "stadium folk-rock excess",
        "modern bedroom-pop haze",
        "hard autotune"
      ],
      "shortPrompt": "1970s Japanese Folk, plain acoustic folk pulse, unforced close Japanese vocal, fingerpicked acoustic guitar + light upright piano, close-mic intimacy, 82-100 BPM",
      "productionGuidance": "1970s Japanese Folk: build around plain acoustic folk pulse and fingerpicked guitar carrying the pulse alone, keep unforced close Japanese vocal, feature fingerpicked acoustic guitar, light upright piano, soft hand percussion, simple bass, use simple folk-pop movement, mix with close-mic intimacy and soft analog tape hiss, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "fingerpicked acoustic guitar, light upright piano, soft hand percussion, 1970s Japanese folk"
    },
    {
      "id": "new-music-70s",
      "label": "1970s New Music",
      "styleCore": "1970s Japanese new music, acoustic guitar plus live band, sophisticated chords, lyrical adult pop, analog tape warmth, live rhythm section, soft top-end rolloff",
      "arrangementNarrative": "BPM 86-102; Verse stays plainspoken with acoustic guitar and piano, pre-chorus adds band drums and a bass climb, chorus turns wider with refined add9 color without modern gloss, hook entry uses an upward guitar strum into a one-beat breath, mix feels live, close-mic, and lightly tape-worn",
      "instruments": [
        "acoustic guitar",
        "upright piano",
        "clean electric guitar",
        "live drums",
        "warm bass"
      ],
      "tempoRange": [
        86,
        102
      ],
      "goodFor": [
        "Showa seventies channel",
        "window seasons",
        "radio memory scenes"
      ],
      "archetypes": [
        "showa-70s"
      ],
      "tier": "core",
      "categoryId": "japanese-era",
      "source": "legacy-preset",
      "rhythm": [
        "hand-played singer-songwriter band pulse",
        "live rhythm section holding a steady unhurried groove",
        "clean electric guitar answering the vocal between phrases"
      ],
      "vocal": [
        "lyrical adult Japanese vocal",
        "conversational verse phrasing opening into a fuller chorus",
        "restrained vibrato, never oversung"
      ],
      "production": [
        "live band warmth",
        "analog tape color",
        "restrained stereo width"
      ],
      "harmony": [
        "sophisticated add9 and maj7 colors",
        "gentle ii-V movement into the chorus",
        "chromatic passing chord coloring the bridge"
      ],
      "tempo": [
        86,
        102
      ],
      "moods": [
        "lyrical",
        "refined"
      ],
      "audiences": [
        "Japanese new-music listeners",
        "Showa playlist listeners"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "ultra-wide modern mix",
        "sidechain pumping",
        "trap hi-hats"
      ],
      "shortPrompt": "1970s New Music, hand-played singer-songwriter band pulse, lyrical adult Japanese vocal, acoustic guitar + upright piano, live band warmth, 86-102 BPM",
      "productionGuidance": "1970s New Music: build around hand-played singer-songwriter band pulse and live rhythm section holding a steady unhurried groove, keep lyrical adult Japanese vocal, feature acoustic guitar, upright piano, clean electric guitar, live drums, use sophisticated add9 and maj7 colors, mix with live band warmth and analog tape color, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "acoustic guitar, upright piano, clean electric guitar, BPM 86-102; Verse stays plainspoken with acoustic guitar and piano"
    },
    {
      "id": "showa-groove-70s",
      "label": "1970s Showa Groove",
      "styleCore": "1970s funk and soul influenced Japanese kayokyoku, clavinet, wah guitar, brass stabs, live bass pocket, tape saturation, spring reverb, narrow stereo",
      "instruments": [
        "clavinet",
        "wah electric guitar",
        "brass stabs",
        "live bass",
        "tight drum kit"
      ],
      "tempoRange": [
        96,
        114
      ],
      "goodFor": [
        "Showa seventies channel",
        "neon alley scenes",
        "danceable retro sets"
      ],
      "archetypes": [
        "showa-70s"
      ],
      "tier": "core",
      "categoryId": "japanese-era",
      "source": "legacy-preset",
      "rhythm": [
        "syncopated live funk-soul pocket",
        "clavinet comping driving the groove",
        "wah guitar accents on the offbeat"
      ],
      "vocal": [
        "confident Japanese pop vocal",
        "soulful rasp on emotional phrase peaks",
        "call-and-response with the brass stabs"
      ],
      "production": [
        "tape-saturated live groove",
        "spring reverb",
        "narrow vintage stereo"
      ],
      "harmony": [
        "soul-colored dominant and minor seventh chords",
        "one-chord vamp under the verse",
        "brass-stab punctuation resolving into the chorus"
      ],
      "tempo": [
        96,
        114
      ],
      "moods": [
        "groovy",
        "retro-cinematic"
      ],
      "audiences": [
        "Showa groove listeners",
        "retro Japanese playlists"
      ],
      "avoidTraits": [
        "famous artist imitation",
        "copied melody",
        "copyrighted song reference",
        "soundalike vocal",
        "overlong intro",
        "modern EDM synths",
        "trap hi-hats",
        "sidechain pumping"
      ],
      "shortPrompt": "1970s Showa Groove, syncopated live funk-soul pocket, confident Japanese pop vocal, clavinet + wah electric guitar, tape-saturated live groove, 96-114 BPM",
      "productionGuidance": "1970s Showa Groove: build around syncopated live funk-soul pocket and clavinet comping driving the groove, keep confident Japanese pop vocal, feature clavinet, wah electric guitar, brass stabs, live bass, use soul-colored dominant and minor seventh chords, mix with tape-saturated live groove and spring reverb, avoid famous artist imitation, copied melody, copyrighted song reference.",
      "signatureSound": "clavinet, wah electric guitar, brass stabs, 1970s funk and soul influenced Japanese kayokyoku"
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
      "id": "bittersweet",
      "label": "Bittersweet",
      "emotionWords": [
        "bittersweet",
        "lonely but hopeful",
        "restrained"
      ],
      "lyricImages": [
        "empty chair",
        "late train",
        "rain on glass",
        "old letter"
      ]
    },
    {
      "id": "elegant",
      "label": "Elegant",
      "emotionWords": [
        "elegant",
        "reserved",
        "polished"
      ],
      "lyricImages": [
        "porcelain cup",
        "old record",
        "tailored coat",
        "quiet lobby"
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
  "vocalTone": "mature Japanese male tenor, intimate close-mic delivery, restrained vibrato, warm analog presence",
  "perspective": "firstPerson",
  "lyricDepth": "commercial",
  "moneyChordMode": "default",
  "customConcept": "오래된 라디오에서 흘러나오던 저녁",
  "avoidWords": "",
  "negativeStyle": "flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, excessive reverb washing out the vocal, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, trap hi-hats, hard autotune, sidechain pumping, ultra-wide modern mix, famous artist imitation, enka-like melodrama",
  "japaneseEraLyricGuidance": "For 1970s Japanese lyrics, keep scenes in night trains, ports, umbrellas, kissaten, handwritten letters, station farewells, alley street lamps, and seasonal windows. Use slightly literary Japanese with a balanced kanji/hiragana texture. Do not mention modern phones, apps, SNS, streaming, selfies, QR codes, or internet slang.",
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
        "titleLocalized": "string — a natural, idiomatic Japanese song title reinterpreting this song's scene/emotion, NOT a translation of \"title\"'s words. See the [제목] guidance below.",
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
      "title": "Wait in Smoke, Old Heart",
      "hookPhrase": "Wait in Smoke, Old Heart",
      "songRole": "cold-open",
      "tempo": 63,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        178,
        203
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 195,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "IVmaj7-iii7-vi7 movement",
      "genreId": "new-music-70s",
      "genreText": "1970s Japanese new music, acoustic guitar, upright piano",
      "signatureSound": "acoustic guitar, upright piano, clean electric guitar, BPM 86-102; Verse stays plainspoken with acoustic guitar and piano",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "dynamics left uncompressed so the climax actually rises, light kit with soft snare, narrow stereo image",
      "introTextureText": "muted trumpet answering phrase intro texture (INTRO ONLY)",
      "introTextureId": "br_muted_trumpet",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "chorusContrastPlanId": "unison-doubling",
      "chorusContrastText": "Verse: verse carried by piano and soft brushes / Chorus: chorus doubles the lead vocal in unison, adds tambourine and organ pad",
      "chorusContrastScore": 49,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "showaModern"
        },
        {
          "section": "Chorus",
          "chordId": "marusa"
        },
        {
          "section": "Bridge",
          "chordId": "doowop"
        }
      ],
      "moneyChordSectionText": "Verse: IVmaj7-iii7-vi7 movement / Chorus: IVM7-III7-vi-I7 marusa progression / Bridge: I-vi-IV-V doo-wop progression",
      "openingLoudnessText": "opening is as loud and full as the chorus",
      "arcPhase": "opening",
      "intensity": 2,
      "peakStrength": "none",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "63 BPM + intimate → 낮음",
      "moneyChordId": "showaModern",
      "effectiveMoneyChordId": "showaModern",
      "effectiveGenreIds": [
        "new-music-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "acoustic guitar",
        "clean electric guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T1",
      "introMode": "vocal-immediate",
      "lyricTheme": "kr2030-old-digital-diary-nostalgia",
      "lyricThemeText": "opening an old personal web diary and a downloaded mp3 playlist saved from teenage years, a private photo mood board nobody else ever saw",
      "lyricThemeArc": "surprised nostalgia softening into fond amusement",
      "lyricFrameId": "screen-memory",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "female narrow intimate lead, tender confiding delivery, velvety low resonance, tape slap echo, enka-inflected bend on long tones, melismatic slide into the chorus",
      "vocalVariantText": "female narrow intimate lead, tender confiding delivery, velvety low resonance, tape slap echo, enka-inflected bend on long tones, melismatic slide into the chorus",
      "vocalTechniqueText": "enka-inflected bend on long tones, melismatic slide into the chorus",
      "conceptText": "old-radio warmth, tape softness, softly glowing radio, piano-led opening",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 2,
      "title": "Keep the Streetlamp Tonight",
      "hookPhrase": "Keep the Streetlamp Tonight",
      "songRole": "flagship",
      "tempo": 76,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        197,
        222
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 196,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "IV-V-iii-vi royal road progression",
      "genreId": "japanese-folk-70s",
      "genreText": "1970s Japanese folk, fingerpicked acoustic guitar, light upright piano, no modern polish",
      "signatureSound": "fingerpicked acoustic guitar, light upright piano, soft hand percussion, 1970s Japanese folk",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "breaths and pick noise left in rather than edited out, close dry vocal with a short natural room tail, tape compression on the acoustic guitars",
      "introTextureText": "rounded trombone swell intro texture (INTRO ONLY)",
      "introTextureId": "br_trombone_swell",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "chorusContrastPlanId": "full-band-swell",
      "chorusContrastText": "Verse: sparse verse — guitar and voice only / Chorus: full band enters — bass, drums, string pad, doubled vocal",
      "chorusContrastScore": 68,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "royalRoad"
        },
        {
          "section": "Chorus",
          "chordId": "komuro"
        }
      ],
      "moneyChordSectionText": "Verse: IV-V-iii-vi royal road progression / Chorus: vi-IV-V-I komuro-cycle progression",
      "openingLoudnessText": "full arrangement from the first bar",
      "killingPointText": "minor verse opening into a major final chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-07",
      "arcPhase": "opening",
      "intensity": 2,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "76 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "royalRoad",
      "effectiveMoneyChordId": "royalRoad",
      "effectiveGenreIds": [
        "japanese-folk-70s",
        "kayokyoku-70s",
        "new-music-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "soft hand percussion",
        "simple bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "enchillhop-party-edge-not-dancing",
      "lyricThemeText": "standing at the edge of a crowded party with a drink going warm, watching everyone else move",
      "lyricThemeArc": "isolated self-consciousness easing into comfortable detachment",
      "lyricFrameId": "crowd-alone",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "call and answer, wide octave harmony, chamber ambience, male and female duet, nasal folk-toned phrasing on the hook, husky plainspoken phrasing on the verse",
      "vocalVariantText": "call and answer, wide octave harmony, chamber ambience, male and female duet, nasal folk-toned phrasing on the hook, husky plainspoken phrasing on the verse",
      "vocalTechniqueText": "nasal folk-toned phrasing on the hook, husky plainspoken phrasing on the verse",
      "conceptText": "tape softness, familiar melody turns, faded photograph, guitar-led opening",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 3,
      "title": "Hold the Neon Sign Close",
      "hookPhrase": "Hold the Neon Sign Close",
      "songRole": "flagship",
      "tempo": 82,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        199,
        224
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 195,
      "emotionArc": "soft nostalgia to renewed hope",
      "moneyChordText": "IVmaj7-iii7-vi7 movement",
      "genreId": "new-music-70s",
      "genreText": "1970s Japanese new music, acoustic guitar, upright piano",
      "signatureSound": "acoustic guitar, upright piano, clean electric guitar, BPM 86-102; Verse stays plainspoken with acoustic guitar and piano",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "graceful minor-to-major chorus cadence, narrow stereo image, analog tape saturation, spring and plate reverb",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "chorusContrastPlanId": "harmony-lift",
      "chorusContrastText": "Verse: acoustic guitar + bass + light drums / Chorus: + piano + vocal harmony + firmer snare + wider stereo",
      "chorusContrastScore": 56,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "showaModern"
        },
        {
          "section": "Chorus",
          "chordId": "marusa"
        }
      ],
      "moneyChordSectionText": "Verse: IVmaj7-iii7-vi7 movement / Chorus: IVM7-III7-vi-I7 marusa progression",
      "openingLoudnessText": "no quiet fade-in — already at full level from the start",
      "killingPointText": "instruments drop out in the bridge",
      "killingPointPlacement": "bridge",
      "killingPointId": "KP-04",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "82 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "showaModern",
      "effectiveMoneyChordId": "showaModern",
      "effectiveGenreIds": [
        "new-music-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "acoustic guitar",
        "clean electric guitar"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "jp2030-graduation-farewell",
      "lyricThemeText": "standing in a school gymnasium during a graduation ceremony, classmates crying and laughing at the same time, the future suddenly feeling real",
      "lyricThemeArc": "bittersweet farewell opening into hopeful resolve",
      "lyricFrameId": "school-memory",
      "lyricThemeCastKo": "여럿",
      "vocabularyBankId": "quiet-morning",
      "pov": "secondPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "male mid baritone-tenor lead, earnest forward delivery, worn weathered edge, soft plate ambience, quivering vibrato on the sustained note, plaintive held-note vibrato on the hook",
      "vocalVariantText": "male mid baritone-tenor lead, earnest forward delivery, worn weathered edge, soft plate ambience, quivering vibrato on the sustained note, plaintive held-note vibrato on the hook",
      "vocalTechniqueText": "quivering vibrato on the sustained note, plaintive held-note vibrato on the hook",
      "conceptText": "familiar melody turns, intimate room tone, familiar voice through static, bass-first verse pocket",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 4,
      "title": "Where Did the Summer Go",
      "hookPhrase": "I Keep Holding You",
      "songRole": "seasonal detail track",
      "tempo": 96,
      "sectionCountRange": [
        9,
        11
      ],
      "wordCountRange": [
        199,
        224
      ],
      "maxInstrumentalSections": 3,
      "estimatedLengthSec": 196,
      "emotionArc": "lonely memory to warm acceptance",
      "moneyChordText": "IVM7-III7-vi-I7 marusa progression",
      "genreId": "showa-groove-70s",
      "genreText": "1970s funk and soul influenced Japanese kayokyoku, clavinet, wah electric guitar, wah guitar accents on the offbeat",
      "signatureSound": "clavinet, wah electric guitar, brass stabs, 1970s funk and soul influenced Japanese kayokyoku",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "graceful minor-to-major chorus cadence, narrow stereo image, analog tape saturation, spring and plate reverb",
      "introTextureText": "nylon-string acoustic waltz intro texture (INTRO ONLY)",
      "introTextureId": "ag_nylon_waltz",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "chorusContrastPlanId": "gentle-second-voice",
      "chorusContrastText": "Verse: verse — acoustic guitar and voice / Chorus: chorus adds only a second vocal harmony line, everything else holds steady",
      "chorusContrastScore": 46,
      "killingPointText": "three-part harmony on the last chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-02",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "96 BPM + driving + alto → 중간",
      "moneyChordId": "marusa",
      "effectiveMoneyChordId": "marusa",
      "effectiveGenreIds": [
        "showa-groove-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "clavinet",
        "brass stabs",
        "wah electric guitar"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "introMode": "vocal-after-texture",
      "lyricTheme": "jp2030-summer-festival-crowd",
      "lyricThemeText": "walking through a summer festival crowd in a yukata, fireworks bursting overhead, losing a friend in the crowd for just a second",
      "lyricThemeArc": "excited anticipation building into pure joy",
      "lyricFrameId": "festival-crowd",
      "lyricThemeCastKo": "여럿",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "female full chest alto, light rhythmic phrasing, faint vibrato shimmer, warm natural room, plainspoken storyteller phrasing",
      "vocalVariantText": "female full chest alto, light rhythmic phrasing, faint vibrato shimmer, warm natural room, plainspoken storyteller phrasing",
      "vocalTechniqueText": "plainspoken storyteller phrasing",
      "conceptText": "intimate room tone, old-radio warmth, softly glowing radio, breathing space before the chorus",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 5,
      "title": "Will You Wait for Me",
      "hookPhrase": "I Keep Circling Us",
      "songRole": "easy singalong verse",
      "tempo": 76,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        197,
        222
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 196,
      "emotionArc": "steady peace held gently, start to end",
      "moneyChordText": "IVmaj7-iii7-vi7 movement",
      "genreId": "japanese-folk-70s",
      "genreText": "1970s Japanese folk, fingerpicked acoustic guitar, light upright piano",
      "signatureSound": "fingerpicked acoustic guitar, light upright piano, soft hand percussion, 1970s Japanese folk",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "two-part close harmony sung as one blended voice, narrow warm stereo image, close dry vocal with a short natural room tail",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "chorusContrastPlanId": "call-response-texture",
      "chorusContrastText": "Verse: verse — lead vocal alone over a light rhythm section / Chorus: backing vocals answer each line, a percussion layer widens the groove",
      "chorusContrastScore": 53,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "showaModern"
        },
        {
          "section": "Chorus",
          "chordId": "royalRoad"
        }
      ],
      "moneyChordSectionText": "Verse: IVmaj7-iii7-vi7 movement / Chorus: IV-V-iii-vi royal road progression",
      "killingPointText": "vocal scat trades phrases with the piano",
      "killingPointPlacement": "bridge",
      "killingPointId": "KP-23",
      "arcPhase": "rising",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "76 BPM + warm baritone → 중간",
      "moneyChordId": "showaModern",
      "effectiveMoneyChordId": "showaModern",
      "effectiveGenreIds": [
        "japanese-folk-70s",
        "kayokyoku-70s",
        "new-music-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "light upright piano"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "jp2030-autumn-leaves-solo-walk",
      "lyricThemeText": "walking alone down a path lined with turning autumn leaves after a long week, breath visible in the cool evening air",
      "lyricThemeArc": "tired numbness easing into calm clarity",
      "lyricFrameId": "seasonal-marker",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "male low warm baritone, clipped rhythmic phrasing, warm woody midrange, dry and forward, legato phrasing unhurried through the bridge",
      "vocalVariantText": "male low warm baritone, clipped rhythmic phrasing, warm woody midrange, dry and forward, legato phrasing unhurried through the bridge",
      "vocalTechniqueText": "legato phrasing unhurried through the bridge",
      "conceptText": "old-radio warmth, tape softness, faded photograph, answering instrumental phrase",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 6,
      "title": "I Still Trace Us",
      "hookPhrase": "I Still Trace Us",
      "songRole": "big emotional high point",
      "tempo": 82,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        199,
        224
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 195,
      "emotionArc": "held-back yearning bursting into radiant relief",
      "moneyChordText": "IV-V-iii-vi royal road progression",
      "genreId": "new-music-70s",
      "genreText": "1970s Japanese new music, acoustic guitar, upright piano, live band warmth",
      "signatureSound": "acoustic guitar, upright piano, clean electric guitar, BPM 86-102; Verse stays plainspoken with acoustic guitar and piano",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "sophisticated add9 and maj7 colors, narrow stereo image, light kit with soft snare",
      "introTextureText": "soft slide-guitar swell intro texture (INTRO ONLY)",
      "introTextureId": "eg_slide_swell",
      "hookDeviceText": "one-bar drum fill and rising swell leading into the chorus",
      "hookDeviceId": "build-fill",
      "chorusContrastPlanId": "strings-swell",
      "chorusContrastText": "Verse: verse stays intimate — guitar, upright bass, soft kick / Chorus: string section swells in, backing harmony stacks, fuller low end",
      "chorusContrastScore": 55,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "royalRoad"
        },
        {
          "section": "Chorus",
          "chordId": "showaModern"
        }
      ],
      "moneyChordSectionText": "Verse: IV-V-iii-vi royal road progression / Chorus: IVmaj7-iii7-vi7 movement",
      "killingPointText": "group sings the title hook in tight unison",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-20",
      "arcPhase": "peak",
      "intensity": 5,
      "peakStrength": "strong",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "82 BPM (어휘 매치 없음, 템포 중심 판정) → 낮음",
      "moneyChordId": "royalRoad",
      "effectiveMoneyChordId": "royalRoad",
      "effectiveGenreIds": [
        "new-music-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "acoustic guitar",
        "clean electric guitar",
        "electric piano"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T4",
      "introMode": "instrumental",
      "lyricTheme": "jp2030-unreachable-voice",
      "lyricThemeText": "trying to call out to someone who is already walking away across a crowded platform, the words never quite reaching",
      "lyricThemeArc": "helpless longing tightening into determined resolve",
      "lyricFrameId": "parallel-world",
      "lyricThemeCastKo": "둘",
      "vocabularyBankId": "quiet-morning",
      "pov": "secondPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "female clear mezzo lead, bright forward delivery, clean bell tone, chamber ambience, vibrato held into the final syllable",
      "vocalVariantText": "female clear mezzo lead, bright forward delivery, clean bell tone, chamber ambience, vibrato held into the final syllable",
      "vocalTechniqueText": "vibrato held into the final syllable",
      "conceptText": "tape softness, familiar melody turns, familiar voice through static, layered harmony arrival",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 7,
      "title": "Film",
      "hookPhrase": "Keep the Film Reel Close",
      "songRole": "romantic shade without melodrama",
      "tempo": 96,
      "sectionCountRange": [
        9,
        11
      ],
      "wordCountRange": [
        199,
        224
      ],
      "maxInstrumentalSections": 3,
      "estimatedLengthSec": 196,
      "emotionArc": "joyful memory blooming into bigger joy",
      "moneyChordText": "IVM7-III7-vi-I7 marusa progression",
      "genreId": "showa-groove-70s",
      "genreText": "1970s funk and soul influenced Japanese kayokyoku, clavinet, wah electric guitar",
      "signatureSound": "clavinet, wah electric guitar, brass stabs, 1970s funk and soul influenced Japanese kayokyoku",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "sophisticated add9 and maj7 colors, narrow stereo image, light kit with soft snare",
      "introTextureText": "soft Wurlitzer chord chop intro texture (INTRO ONLY)",
      "introTextureId": "ep_wurli_chop",
      "hookDeviceText": "final repeat of the hook sung almost a cappella as the outro tag",
      "hookDeviceId": "acappella-tag",
      "chorusContrastPlanId": "unison-doubling",
      "chorusContrastText": "Verse: verse carried by piano and soft brushes / Chorus: chorus doubles the lead vocal in unison, adds tambourine and organ pad",
      "chorusContrastScore": 49,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "marusa"
        },
        {
          "section": "Chorus",
          "chordId": "komuro"
        }
      ],
      "moneyChordSectionText": "Verse: IVM7-III7-vi-I7 marusa progression / Chorus: vi-IV-V-I komuro-cycle progression",
      "killingPointText": "nonsense-syllable vocal unison on the hook",
      "killingPointPlacement": "pre-chorus",
      "killingPointId": "KP-17",
      "arcPhase": "peak",
      "intensity": 5,
      "peakStrength": "strong",
      "perceivedEnergy": 4,
      "perceivedEnergyReasonKo": "96 BPM + driving + narrow → 높음",
      "moneyChordId": "marusa",
      "effectiveMoneyChordId": "marusa",
      "effectiveGenreIds": [
        "showa-groove-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "clavinet",
        "live bass"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T2",
      "introMode": "vocal-after-texture",
      "lyricTheme": "jp2030-confession-to-the-mirror",
      "lyricThemeText": "standing in front of a mirror rehearsing words that need to be said to someone tomorrow, voice barely above a whisper",
      "lyricThemeArc": "nervous hesitation firming into quiet courage",
      "lyricFrameId": "inner-monologue",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "unison splitting to thirds, close third harmony, warm natural room, male and female duet, soulful rasp on the emotional peak",
      "vocalVariantText": "unison splitting to thirds, close third harmony, warm natural room, male and female duet, soulful rasp on the emotional peak",
      "vocalTechniqueText": "soulful rasp on the emotional peak",
      "conceptText": "familiar melody turns, intimate room tone, softly glowing radio, brushed pulse under the verse",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "duet",
      "vocalType": "mixed"
    },
    {
      "trackNo": 8,
      "title": "Drift in Smoke, Winter",
      "hookPhrase": "Drift in Smoke, Winter",
      "songRole": "soft reset before the closing run",
      "tempo": 88,
      "sectionCountRange": [
        6,
        7
      ],
      "wordCountRange": [
        199,
        224
      ],
      "maxInstrumentalSections": 2,
      "estimatedLengthSec": 196,
      "emotionArc": "bright laughter softening into a quiet farewell",
      "moneyChordText": "IVmaj7-iii7-vi7 movement",
      "genreId": "japanese-folk-70s",
      "genreText": "1970s Japanese folk, fingerpicked acoustic guitar, light upright piano, light hand percussion entering only at the chorus",
      "signatureSound": "fingerpicked acoustic guitar, light upright piano, soft hand percussion, 1970s Japanese folk",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "clear unforced diction with no vibrato, brushed drums with soft rim work, narrow warm stereo image",
      "introTextureText": "light pizzicato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_pizz",
      "hookDeviceText": "final chorus vocal jumps up an octave, brighter and more open than the earlier choruses",
      "hookDeviceId": "octave-lift",
      "chorusContrastPlanId": "full-band-swell",
      "chorusContrastText": "Verse: sparse verse — guitar and voice only / Chorus: full band enters — bass, drums, string pad, doubled vocal",
      "chorusContrastScore": 68,
      "killingPointText": "gospel-style melisma run on the final phrase",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-14",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "88 BPM + breathy → 낮음",
      "moneyChordId": "showaModern",
      "effectiveMoneyChordId": "showaModern",
      "effectiveGenreIds": [
        "japanese-folk-70s",
        "kayokyoku-70s",
        "new-music-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "soft hand percussion",
        "light upright piano"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T3",
      "introMode": "instrumental",
      "lyricTheme": "jp2030-determined-stage-entrance",
      "lyricThemeText": "standing backstage moments before stepping into the spotlight, heart pounding, deciding to give everything this one time",
      "lyricThemeArc": "nervous fear transforming into fierce determination",
      "lyricFrameId": "narrative-arc",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "image",
      "verseStyleText": "verse lines focus on sensory images, objects, light, weather, and small gestures",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "male chest-to-falsetto shifting lead, restrained understated reading, slight nasal brightness, chamber ambience, breathy conversational delivery throughout, gentle vibrato on the sustained hook",
      "vocalVariantText": "male chest-to-falsetto shifting lead, restrained understated reading, slight nasal brightness, chamber ambience, breathy conversational delivery throughout, gentle vibrato on the sustained hook",
      "vocalTechniqueText": "breathy conversational delivery throughout, gentle vibrato on the sustained hook",
      "conceptText": "intimate room tone, old-radio warmth, faded photograph, rhythmic lift after the second line",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 9,
      "title": "Fade",
      "hookPhrase": "Fade with Me, Winter",
      "songRole": "tender reflective pause",
      "tempo": 94,
      "sectionCountRange": [
        6,
        7
      ],
      "wordCountRange": [
        198,
        223
      ],
      "maxInstrumentalSections": 2,
      "estimatedLengthSec": 195,
      "emotionArc": "joyful moment fading into tender wistfulness",
      "moneyChordText": "IV-V-iii-vi royal road progression",
      "genreId": "new-music-70s",
      "genreText": "1970s Japanese new music, acoustic guitar, upright piano",
      "signatureSound": "acoustic guitar, upright piano, clean electric guitar, BPM 86-102; Verse stays plainspoken with acoustic guitar and piano",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "graceful minor-to-major chorus cadence, narrow stereo image, analog tape saturation, spring and plate reverb",
      "introTextureText": "gentle tremolo electric guitar intro texture (INTRO ONLY)",
      "introTextureId": "eg_tremolo",
      "hookDeviceText": "chorus shifts into a half-time feel for weight, verses stay in normal time",
      "hookDeviceId": "half-time-chorus",
      "chorusContrastPlanId": "harmony-lift",
      "chorusContrastText": "Verse: acoustic guitar + bass + light drums / Chorus: + piano + vocal harmony + firmer snare + wider stereo",
      "chorusContrastScore": 56,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "royalRoad"
        },
        {
          "section": "Chorus",
          "chordId": "komuro"
        },
        {
          "section": "Bridge",
          "chordId": "marusa"
        }
      ],
      "moneyChordSectionText": "Verse: IV-V-iii-vi royal road progression / Chorus: vi-IV-V-I komuro-cycle progression / Bridge: IVM7-III7-vi-I7 marusa progression",
      "killingPointText": "full ensemble unison on the final hook",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-11",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 3,
      "perceivedEnergyReasonKo": "94 BPM (어휘 매치 없음, 템포 중심 판정) → 중간",
      "moneyChordId": "royalRoad",
      "effectiveMoneyChordId": "royalRoad",
      "effectiveGenreIds": [
        "new-music-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "acoustic guitar",
        "upright piano"
      ],
      "arrangementDensity": "medium",
      "structureTemplate": "T2",
      "introMode": "vocal-immediate",
      "lyricTheme": "jp2030-okay-to-mess-up",
      "lyricThemeText": "tripping over the words during a class presentation and laughing it off with classmates instead of shrinking away",
      "lyricThemeArc": "embarrassed panic dissolving into shared laughter and relief",
      "lyricFrameId": "self-affirmation",
      "lyricThemeCastKo": "여럿",
      "vocabularyBankId": "quiet-morning",
      "pov": "secondPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "female low warm contralto, gentle swung phrasing, warm rounded midrange, tape slap echo, legato line easing into the chorus",
      "vocalVariantText": "female low warm contralto, gentle swung phrasing, warm rounded midrange, tape slap echo, legato line easing into the chorus",
      "vocalTechniqueText": "legato line easing into the chorus",
      "conceptText": "old-radio warmth, tape softness, familiar voice through static, small harmony on the final hook",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "female",
      "vocalType": "female"
    },
    {
      "trackNo": 10,
      "title": "Save the Film Reel Near",
      "hookPhrase": "Save the Film Reel Near",
      "songRole": "memory-focused late track",
      "tempo": 63,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        189,
        214
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 195,
      "emotionArc": "bright laughter softening into a quiet farewell",
      "moneyChordText": "IVM7-III7-vi-I7 marusa progression",
      "genreId": "showa-groove-70s",
      "genreText": "1970s funk and soul influenced Japanese kayokyoku, clavinet, wah electric guitar, live bass pocket",
      "signatureSound": "clavinet, wah electric guitar, brass stabs, 1970s funk and soul influenced Japanese kayokyoku",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "graceful minor-to-major chorus cadence, narrow stereo image, analog tape saturation, spring and plate reverb",
      "introTextureText": "light pizzicato strings intro texture (INTRO ONLY)",
      "introTextureId": "str_pizz",
      "hookDeviceText": "bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus",
      "hookDeviceId": "bridge-breakdown",
      "chorusContrastPlanId": "gentle-second-voice",
      "chorusContrastText": "Verse: verse — acoustic guitar and voice / Chorus: chorus adds only a second vocal harmony line, everything else holds steady",
      "chorusContrastScore": 46,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "marusa"
        },
        {
          "section": "Chorus",
          "chordId": "royalRoad"
        }
      ],
      "moneyChordSectionText": "Verse: IVM7-III7-vi-I7 marusa progression / Chorus: IV-V-iii-vi royal road progression",
      "killingPointText": "hook repeated almost a cappella as the outro",
      "killingPointPlacement": "outro",
      "killingPointId": "KP-08",
      "arcPhase": "easing",
      "intensity": 3,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "63 BPM + driving + legato sustained → 낮음",
      "moneyChordId": "marusa",
      "effectiveMoneyChordId": "marusa",
      "effectiveGenreIds": [
        "showa-groove-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "clavinet",
        "electric piano",
        "brass stabs"
      ],
      "arrangementDensity": "full",
      "structureTemplate": "T4",
      "introMode": "vocal-after-texture",
      "lyricTheme": "kridol-debut-day-nerves",
      "lyricThemeText": "standing in the wings on debut night, hearing the crowd for the very first time and feeling the ground shift underfoot",
      "lyricThemeArc": "overwhelming nerves crystallizing into pure resolve",
      "lyricFrameId": "stage-declaration",
      "lyricThemeCastKo": "여럿",
      "vocabularyBankId": "quiet-morning",
      "pov": "firstPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "narrative",
      "chorusStyleText": "chorus lines unfold as plain scene narration with concrete actions and time movement",
      "vocalText": "male thin bright tenor, legato sustained lines, clean rounded tone, narrow mono-leaning room, kobushi-style vocal ornament on sustained notes",
      "vocalVariantText": "male thin bright tenor, legato sustained lines, clean rounded tone, narrow mono-leaning room, kobushi-style vocal ornament on sustained notes",
      "vocalTechniqueText": "kobushi-style vocal ornament on sustained notes",
      "conceptText": "tape softness, familiar melody turns, softly glowing radio, acoustic texture in the middle eight",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 11,
      "title": "Turn",
      "hookPhrase": "Turn Back Time, Old Heart",
      "songRole": "final quiet reflection",
      "tempo": 88,
      "sectionCountRange": [
        6,
        7
      ],
      "wordCountRange": [
        196,
        221
      ],
      "maxInstrumentalSections": 2,
      "estimatedLengthSec": 196,
      "emotionArc": "small sadness to steady comfort",
      "moneyChordText": "I-vi-IV-V doo-wop progression",
      "genreId": "japanese-folk-70s",
      "genreText": "1970s Japanese folk, fingerpicked acoustic guitar, light upright piano",
      "signatureSound": "fingerpicked acoustic guitar, light upright piano, soft hand percussion, 1970s Japanese folk",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "the harmony line stays above the melody, tape compression on the acoustic guitars, brushed drums with soft rim work",
      "introTextureText": "fingerpicked acoustic guitar intro texture (INTRO ONLY)",
      "introTextureId": "ag_finger",
      "hookDeviceText": "stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes",
      "hookDeviceId": "stop-time",
      "chorusContrastPlanId": "call-response-texture",
      "chorusContrastText": "Verse: verse — lead vocal alone over a light rhythm section / Chorus: backing vocals answer each line, a percussion layer widens the groove",
      "chorusContrastScore": 53,
      "moneyChordSectionMap": [
        {
          "section": "Verse",
          "chordId": "doowop"
        },
        {
          "section": "Chorus",
          "chordId": "default"
        }
      ],
      "moneyChordSectionText": "Verse: I-vi-IV-V doo-wop progression / Chorus: I-V-vi-IV progression",
      "killingPointText": "sustained lead note into the final chorus",
      "killingPointPlacement": "final-chorus",
      "killingPointId": "KP-05",
      "arcPhase": "closing",
      "intensity": 1,
      "peakStrength": "subtle",
      "perceivedEnergy": 2,
      "perceivedEnergyReasonKo": "88 BPM + intimate → 낮음",
      "moneyChordId": "doowop",
      "effectiveMoneyChordId": "doowop",
      "effectiveGenreIds": [
        "japanese-folk-70s",
        "kayokyoku-70s",
        "new-music-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "fingerpicked acoustic guitar",
        "simple bass"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T2",
      "introMode": "vocal-after-texture",
      "lyricTheme": "kridol-limit-break",
      "lyricThemeText": "pushing through the final chorus of a brutal dance break, body exhausted but the voice getting louder instead of weaker",
      "lyricThemeArc": "physical limit turning into a surge of defiant strength",
      "lyricFrameId": "turning-point",
      "lyricThemeCastKo": "혼자",
      "vocabularyBankId": "quiet-morning",
      "pov": "secondPerson",
      "verseStyle": "narrative",
      "verseStyleText": "verse lines unfold as plain scene narration with concrete actions and time movement",
      "chorusStyle": "image",
      "chorusStyleText": "chorus lines focus on sensory images, objects, light, weather, and small gestures",
      "vocalText": "male bright tenor lead, storytelling spoken-edge delivery, soft husky grain, intimate close-mic, restrained delivery never oversung",
      "vocalVariantText": "male bright tenor lead, storytelling spoken-edge delivery, soft husky grain, intimate close-mic, restrained delivery never oversung",
      "vocalTechniqueText": "restrained delivery never oversung",
      "conceptText": "familiar melody turns, intimate room tone, faded photograph, low-register opening before the lift",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "male",
      "vocalType": "male"
    },
    {
      "trackNo": 12,
      "title": "Whatever Happened to Us",
      "hookPhrase": "I Still Rewind Snow",
      "songRole": "comforting closer",
      "tempo": 63,
      "sectionCountRange": [
        5,
        6
      ],
      "wordCountRange": [
        189,
        214
      ],
      "maxInstrumentalSections": 1,
      "estimatedLengthSec": 195,
      "emotionArc": "quiet longing to calm gratitude",
      "moneyChordText": "I-V-vi-IV verses, vi-IV-I-V chorus lift",
      "genreId": "new-music-70s",
      "genreText": "1970s Japanese new music, acoustic guitar, upright piano, live band warmth",
      "signatureSound": "acoustic guitar, upright piano, clean electric guitar, BPM 86-102; Verse stays plainspoken with acoustic guitar and piano",
      "negativeStyleText": "famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, modern EDM synths, hard autotune, sidechain pumping, ultra-wide modern mix",
      "eraPaletteText": "sophisticated add9 and maj7 colors, narrow stereo image, light kit with soft snare",
      "introTextureText": "soft slide-guitar swell intro texture (INTRO ONLY)",
      "introTextureId": "eg_slide_swell",
      "hookDeviceText": "hook line double-tracked with a harmony a third above, wider on every repeat",
      "hookDeviceId": "double-hook",
      "chorusContrastPlanId": "strings-swell",
      "chorusContrastText": "Verse: verse stays intimate — guitar, upright bass, soft kick / Chorus: string section swells in, backing harmony stacks, fuller low end",
      "chorusContrastScore": 55,
      "arcPhase": "closing",
      "intensity": 1,
      "peakStrength": "none",
      "perceivedEnergy": 1,
      "perceivedEnergyReasonKo": "63 BPM + alto → 낮음",
      "moneyChordId": "emotional",
      "effectiveMoneyChordId": "emotional",
      "effectiveGenreIds": [
        "new-music-70s",
        "kayokyoku-70s",
        "japanese-folk-70s"
      ],
      "vocalPresetSource": "auto",
      "instrumentSet": [
        "acoustic guitar",
        "upright piano",
        "clean electric guitar"
      ],
      "arrangementDensity": "sparse",
      "structureTemplate": "T4",
      "introMode": "vocal-immediate",
      "lyricTheme": "kridol-our-own-path",
      "lyricThemeText": "standing together backstage after a hard-won win, realizing no one handed this path to them, they built it themselves",
      "lyricThemeArc": "quiet disbelief settling into shared pride",
      "lyricFrameId": "crew-together",
      "lyricThemeCastKo": "여럿",
      "vocabularyBankId": "quiet-morning",
      "pov": "thirdPerson",
      "verseStyle": "dialogue",
      "verseStyleText": "verse lines use direct address or short conversational fragments without becoming spoken-word",
      "chorusStyle": "hookRepeat",
      "chorusStyleText": "chorus lines use compact repeated hook callbacks and simple answer phrases",
      "vocalText": "female mid clear alto, conversational unhurried phrasing, soft breathy grain, soft plate ambience, melismatic slide into the chorus",
      "vocalVariantText": "female mid clear alto, conversational unhurried phrasing, soft breathy grain, soft plate ambience, melismatic slide into the chorus",
      "vocalTechniqueText": "melismatic slide into the chorus",
      "conceptText": "intimate room tone, old-radio warmth, familiar voice through static, open cymbal color at the chorus",
      "conceptLyricImages": [
        "softly glowing radio",
        "faded photograph",
        "familiar voice through static"
      ],
      "vocalGender": "female",
      "vocalType": "female"
    }
  ],
  "alreadyUsedScenes": [],
  "alreadyUsedLyricLines": [],
  "alreadyUsedOpenings": [],
  "meta": {
    "setName": "20260825_昭和セブンティーズ_오래된라디오에서흘러나오던저녁",
    "generatedAt": "2026-08-25T00:55:47.572Z",
    "channelId": "showa-seventies",
    "channelLabel": "昭和セブンティーズ",
    "conceptLabel": "오래된 라디오에서 흘러나오던 저녁",
    "songCount": 12,
    "lyricLanguage": "english",
    "bridgeVersion": "0.0.0-dev"
  }
}
```

Output requirement:
- Write a new file named "lyrics/20260825_昭和セブンティーズ_오래된라디오에서흘러나오던저녁.json" in the current directory.
- If the "lyrics" folder doesn't exist yet, create it first.
- Never overwrite an existing file. If "lyrics/20260825_昭和セブンティーズ_오래된라디오에서흘러나오던저녁.json" already exists, append "_02" (then "_03", etc.) before the .json extension and write there instead.
- Its content must be exactly { "songs": [ ... ] } — 12 objects total, one per song, matching "outputShape.songs[0]" above (title, hookPhrase, stylePrompt, lyrics, seasonMoment, listenerSituation, emotionArc, youtube{title,description,tags}, etc.).
- Optional (recommended): also add a top-level "meta" field alongside "songs" — { "meta": { ... }, "songs": [ ... ] } — copying "meta" from the request payload above verbatim. Do not invent or recompute any of its values yourself.
- "preassignedSongs" gives local planning slots and fallback placeholders. You may use the slot hook or write a new original hook, but the final "hookPhrase" must exactly match the hook line that opens and closes every chorus in that song's lyrics. For the TITLE, use a genuine MIX of shapes across this pack, not one formula repeated on every song: for at least a third of the songs, the title should simply BE the hook line itself (or a near-verbatim variant of it) — this is the single most common title shape in real pop songs of this kind, especially older-pop eras, and titles that never match their own hook read as artificial. For the rest, write independent Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images. [스타일 경향] There's a real tendency to fall into the same "[adjective] [noun]" image-pair shape for every song regardless of which approach you pick — worth watching for and varying against (a short phrase, a question, a name being addressed, a single word), as much as whether the title matches the hook.
[제목] Title localization:
  - Along with the English "title", write a "titleLocalized" field: a natural, idiomatic Japanese song title.
  - DO NOT translate the English title's words. Read this song's "listenerSituation" and "emotionArc" and re-express that scene/feeling as its own original Japanese title — the kind a native speaker would actually give this song, not a rendering of the English one.
  - Reference the tone of Showa-era (昭和) Japanese song titles — quiet, image-based, never a loanword transliteration.
  - Keep it to roughly 3-12 characters (a short phrase, not a sentence) — long titles get truncated in thumbnails and lists.
  - Never write it as a katakana phonetic transliteration of the English words (e.g. writing "Blue Cup" as "ブルーカップ") — that is not localization.
  - Example: "title": "Blue Cup", "titleLocalized": "식어가는 찻잔" (NOT "파란 컵" — that is a literal translation, not a reinterpretation).
  - This titleLocalized value is for on-screen display only; it is never pasted into Suno's own title field (which stays the plain English "title" — no parentheses).
  - CRITICAL: "titleLocalized" must also be unique across every song in this pack, the same requirement as the English "title" — two songs never share the same titleLocalized even if their scenes/emotionArcs are similar. If "title" differs between two songs, "titleLocalized" must differ too.
- CRITICAL: For every imported song, "hookPhrase" and "lyrics" are treated as a matched pair. The hookPhrase string must appear verbatim in the lyrics as the chorus bookend hook; the import step preserves that pair and will not rewrite hooks to match preassignedSongs.
- Each "preassignedSongs" entry also includes "moneyChordText" ("<progression> - <descriptive phrase>", e.g. "IVmaj7-iii7-vi7 movement"). Use the exact chord progression before the " - " in that song's stylePrompt (e.g. track's progression here would be "IVmaj7-iii7-vi7 movement") — that harmonic choice is fixed by the app. The descriptive phrase after " - " is reference flavor, not required wording; describe the chorus lift/feel in your own words if you have a better one for this song's era and genre.
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
- Track 1 is slow — 63 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 178-203 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 178-203 words already fills the pack's target song length.
- Track 2 is slow — 76 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 197-222 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 197-222 words already fills the pack's target song length.
- Track 5 is slow — 76 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 197-222 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 197-222 words already fills the pack's target song length.
- Track 10 is slow — 63 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 189-214 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 189-214 words already fills the pack's target song length.
- Track 12 is slow — 63 BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at 5-6 sections and 189-214 words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, 189-214 words already fills the pack's target song length.

[Fast-tempo tracks — section floor, read before writing these]
At these tempos every bar is short, so the SAME section count that fills 3:20 at 77 BPM only fills about 1:58 at 114 BPM. This is a real measurement, not an estimate: a 114 BPM track carrying the most lyrics in its whole pack still came back at 1:58 because it had 7 sections. Writing "3:10-3:35" into the stylePrompt does not fix it — Suno follows the section structure of the lyrics, so the section count below is what actually sets the length.
Fill the extra sections with INSTRUMENTAL-only sections, never with more sung verses — that is what the larger "max instrumental sections" number on these tracks is for. Splitting the same words across more vocal sections makes every section thin; a build-up intro, a breakdown, an instrumental break, or an outro adds real clock time without diluting the writing.
- Track 4 — 96 BPM: MUST have at least 9 sections (target 9-11). Its assigned structure template (T2) is the VOCAL SPINE only; wrap 2 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
- Track 7 — 96 BPM: MUST have at least 9 sections (target 9-11). Its assigned structure template (T2) is the VOCAL SPINE only; wrap 2 or more instrumental-only sections around that spine to reach the floor, keeping the template's own section order intact.
A club-tempo shape that reaches the floor naturally, for reference rather than transcription: build-up intro, verse, pre-chorus, chorus/drop, breakdown, verse, chorus, instrumental break, bridge, final chorus, outro. Long instrumental stretches are idiomatic at these tempos — adding them makes the track MORE genre-true, not padded. For a genre whose vocal is defined as a minimal spoken-word stab rather than a full lyric lead, lean further still toward instrumental sections.
- stylePrompt must be a comma-separated list of roughly 25-35 short descriptors (genre, era, instruments, rhythm feel, harmony color, vocal description, tempo, structure/production notes) — not full sentences and not padded to hit a fixed checklist. Write only what is musically true and useful for THIS song; stop once you have described it well, even if that is fewer than 35 descriptors.
- CRITICAL — era authenticity: some tracks in this pack are era-specific old-pop genres. A song's stylePrompt must never describe production/instrumentation that did not exist yet (or was long obsolete) in that track's era. Specifically:
  Tracks 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 (1970s): do not use "gated reverb", "digital synth", "sidechain" — anachronistic for this era.
  If you are unsure whether something fits an era, choose the more conservative, clearly-period-appropriate option.
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
- Each "preassignedSongs" entry with a "vocalTechniqueText" field (e.g. "enka-inflected bend on long tones, melismatic slide into the chorus") carries this track's assigned singing TECHNIQUE — how the voice is sung (melisma, scat, falsetto lift, behind-the-beat phrasing...), not its timbre/register. The app picked this phrase to avoid repeating the same technique across this pack's songs. Use this exact technique phrase in the vocal slot of the stylePrompt, alongside (not replacing) the register/timbre clauses you select from "vocalText". Do not substitute a different technique and do not paraphrase it away.
- Each "preassignedSongs" entry also includes "conceptText" and optional "conceptLyricImages". Weave the concept into the song's genre/sound description and use the images in the lyrics.

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