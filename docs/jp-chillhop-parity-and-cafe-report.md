# JP CHILI Parity And Cafe CHILI Report

## Scope

Instruction 80 audited `en-chillhop` and `jp-chillhop` by code and test, then added the separate `jp-cafe-chillhop` workspace, profile, story-mode contract, bridge metadata, and regression coverage.

## EN vs JP CHILI 감사

| 기능축 | en-chillhop | jp-chillhop | 상태(shared/equivalent/missing/intended difference) | 근거 | 조치 |
| --- | --- | --- | --- | --- | --- |
| workspace/UI | `en-chillhop`, 5 channel cards | `jp-chillhop`, 1 channel card | intended difference | JP CHILI is a single official story workspace; EN keeps 5 use-case profiles | preserved one JP profile and added cafe as a separate workspace, not another broad JP profile |
| channel profile | 5 profiles, `defaultLyricLanguage=english` | 1 profile, `defaultLyricLanguage=japanese` | intended difference | measured profile counts 5 vs 1; profile id `jp-chili-lab-story` | documented as intended; no fallback profile added |
| genre/sound | 15 core genres, 12 preferred union, sound floor | 15 core genres, 15 preferred union, sound floor | equivalent | `CORE_GENRE_IDS_BY_ARCHETYPE['jp-chillhop']` equals EN core list | no genre definition duplication; cafe uses a bounded 11-id subset |
| vocal | 19 vocal presets, vocal floor | 19 vocal presets, vocal floor | equivalent | `suitablePresetsForArchetype` returns 19 for both | widened Japanese chillhop equivalent lookup so cafe also reuses the same validated floor |
| lyrics/story | 70 lyric themes | before: 15 lyric themes; after: 75 | missing -> equivalent | pre-audit found JP 0-pack readiness 3/5 because lyric themes were below the readiness floor | added 60 original JP relationship themes, keeping broad relationship scope outside cafe |
| music architecture | 6 money-chord rotations, 10 intro textures, 12 killing points, 60 hook terms | 6 money-chord rotations, 10 intro textures, 12 killing points, 66 hook terms | equivalent | measured pools meet or exceed EN on the same axes | retained shared architecture and JP hook vocabulary |
| official bridge path | EN bridge instruction/import metadata works through shared path | JP story bridge path plus metadata | shared | `buildClaudeCodeInstruction` + `importSongsJson` tests exercise the official bridge route | extended story metadata without breaking old meta-less output |

### Measured Delta

| archetype | profiles | preferredGenreUnion | coreGenres | lyricThemes | moneyChords | vocals | intro | killingPoints | hookVocabulary | 0-pack readiness | 1-pack readiness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| en-chillhop | 5 | 12 | 15 | 70 | 6 | 19 | 10 | 12 | 60 | 4/5 | 5/5 |
| jp-chillhop before | 1 | 15 | 15 | 15 | 6 | 19 | 10 | 12 | 66 | 3/5 | 4/5 |
| jp-chillhop after | 1 | 15 | 15 | 75 | 6 | 19 | 10 | 12 | 66 | 4/5 | 5/5 |

## Japan Cafe CHILI LAB

| axis | measured result |
| --- | --- |
| WorkspaceId | `jp-cafe-chillhop` |
| ChannelArchetype | `jp-cafe-chillhop` |
| Channel profile | `jp-cafe-chili-lab` / `日本 Café CHILI LAB` / Japan / Japanese / twenties |
| Genre core | 11 shared chillhop/deep-house/lounge/R&B ids, no duplicated genre definitions |
| Lyric themes | 100 cafe-scoped themes, 100 with cafe metadata (`region/city/cafeLocation/cafeType/cafeSeason/cafeTimeOfDay/cafeWeather/storyBeat`) |
| Money chords | 6 rotations, signature `jazzColor` |
| Vocal presets | 19, inherited through Japanese chillhop equivalence |
| Hook/intro/killing point | 60 hook terms, 12 intro textures, 12 killing points |
| Audience profile | dedicated `jp-cafe-chillhop` |
| Sound/vocal floors | `jp-cafe-chillhop-floor`, `jp-cafe-chillhop-vocal-floor` |
| Readiness | 0-pack 4/5, 1-pack 5/5 |

## Cafe Story Mode

| mode | label | contract |
| --- | --- | --- |
| couple | `ふたりのCAFÉ STORY` | 15 songs = 6 male / 6 female / 3 mixed; mixed below half; all five acts represented 3 tracks each |
| male | `彼のCAFÉ STORY` | Japanese, first-person fixed, same-story-comparison, all 15 male vocals |
| female | `彼女のCAFÉ STORY` | Japanese, first-person fixed, same-story-comparison, all 15 female vocals |

The bridge instruction now includes workspace id, native Japanese requirement, cafe setting fields, source summary, Cafe Story Mode, `storyPov`, vocal hard lock, 5-act cafe roles, title/hook dedupe, cafe sound policy, and famous-artist/soundalike bans. Import preserves additive metadata: `workspaceId`, `storyPov`, `cafeStoryMode`, `storySourceTitle`, `storySourceSummary`, `cafeLocation`, `cafeType`, `season`, `storyArc`, and `storySpeaker`, while old meta-less outputs still import through the option-derived metadata fallback.

## Verification Notes

Primary regression coverage: `tests/jpChillhopParityAndCafe.test.ts`.

Covered assertions:
- EN/JP CHILI parity across workspace, profile, genre/sound, vocal, lyric/story, music architecture, and bridge path.
- JP CHILI repaired readiness: 0-pack 4/5, 1-pack 5/5.
- Cafe workspace registration, dedicated profile/audience/sound/vocal floors, 100 cafe themes, 11 genre subset, money chords, hook/intro/killing pools.
- All three Cafe Story Modes save/restore through `GenerationOptions`.
- Couple/Male/Female bridge instructions and imported metadata.
- 15-song 5-act split, vocal quotas, Japanese gate, zero Korean contamination, zero English lyric fallback, zero duplicate title/hook warnings, and old output compatibility.
