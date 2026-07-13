# Thumbnail Reference Audit

Date: 2026-07-14

## Scope

- Requested source path: `private_import/thumbnail_refs`
- Audited source path: `pirvate_import/thumbnail_refs`
- Reason: the requested `private_import/thumbnail_refs` path was not present; the repository contains the thumbnail reference set under the typo path `pirvate_import/thumbnail_refs`.
- Handling: source files were read only. No original image was modified, moved, displayed in the app, copied into `src`, or used as a generative-image reference.
- Git rule: `.gitignore` contains both `private_import/` and `pirvate_import/`; `git ls-files private_import pirvate_import` returns no tracked files.

## File Inventory

| Metric | Result |
| --- | ---: |
| ZIP files under audited thumbnail path | 0 |
| Image files | 205 |
| Unique SHA-256 images | 92 |
| Exact duplicate groups | 92 |
| Files contained in duplicate groups | 205 |
| Identical perceptual-hash groups | 92 |
| Additional near-duplicate pHash groups at Hamming distance <= 4 | 0 |

## Folder Statistics

The canonical English folders contain 92 unique images. Korean extracted folders duplicate those same images, giving 205 total image files.

| Canonical folder | Category | Files | Unique SHA-256 | Approx. size | Main dimensions / ratio |
| --- | --- | ---: | ---: | ---: | --- |
| `cafe` | refined-cafe | 21 | 21 | 29.81 MB | mostly about 1300x675, ratio 1.92-1.93 |
| `summer_green` | summer-green | 21 | 21 | 22.12 MB | mix of about 1300x680 and 294x160, ratio 1.8-1.93 |
| `lofi_room` | midcentury-lofi-room | 8 | 8 | 10.85 MB | about 1300x670, ratio 1.92-1.94 |
| `daily_happiness` | daily-happiness | 5 | 5 | 7.13 MB | about 1296-1301x674-682, ratio 1.91-1.93 |
| `cinemaitc_scene` | cinematic-human-moment | 37 | 37 | 4.74 MB | mostly 292-299x158-168 plus one 1300x669, ratio 1.79-1.85 |

Duplicate folder groups:

| Duplicate source folders | Files per copy | Duplicate relationship |
| --- | ---: | --- |
| Korean cafe folders | 21 | exact duplicates of `cafe` |
| Korean summer green folder | 21 | exact duplicate of `summer_green` |
| Korean lofi room folder | 8 | exact duplicate of `lofi_room` |
| Korean daily happiness folder | 5 | exact duplicate of `daily_happiness` |
| Korean cinematic scene folder | 37 | exact duplicate of `cinemaitc_scene` |

## Hash Samples

These samples identify audit inputs without preserving visual content.

| Category | Sample file | Dimensions | SHA-256 prefix | pHash |
| --- | --- | --- | --- | --- |
| refined-cafe | `GOMCAM 20250530_1438230485.png` | 1296x725 | `66366913c3475424` | `95817f6c48bf6a09` |
| refined-cafe | `GOMCAM 20250530_1438480005.png` | 1299x675 | `1b5ae3f3a919d28d` | `b7d9489d3e878134` |
| summer-green | `GOMCAM 20250530_1500500423.png` | 1304x681 | `fefac1012fb409cd` | `8f3178949f88633e` |
| summer-green | `GOMCAM 20250530_1501280810.png` | 1299x673 | `9968c8fd6d064baf` | `fc9cc18b0323676d` |
| midcentury-lofi-room | `GOMCAM 20250530_1440110306.png` | 1304x671 | `690e4813895b250e` | `d7cb68f696192382` |
| daily-happiness | `GOMCAM 20250530_1500110236.png` | 1296x679 | `1303c135014f828c` | `91947a5508a2fe77` |
| cinematic-human-moment | `GOMCAM 20250530_1502160825.png` | 1300x669 | `b737a86c556c2735` | `8b9cd8a344b83dc7` |
| cinematic-human-moment | `GOMCAM 20250530_1527060451.png` | 293x162 | `698e17502f477127` | `c91a2df7865ab261` |

## Abstracted Category Notes

Only general visual characteristics were retained. No source pixels, exact layouts, people poses, text, creator names, channel names, movie names, actor names, or character names were transcribed into the app.

### refined-cafe

| Element | Abstracted trait |
| --- | --- |
| subject types | cups, warm drinks, small table still life, notebook, vase, dessert plate |
| setting types | quiet cafe interior, window nook, tea room, home-cafe table |
| composition | object cluster on one third, broad negative space, tabletop leading lines |
| text safe zone | left, right, or top uncluttered area |
| lighting | warm window light, amber lamp mix, rainy glow, soft morning side light |
| color palette | ivory, walnut, brass, deep green, cream, coffee brown |
| camera perspective | 50mm still life, high tabletop, low side table edge, wide cafe corner |
| props | ceramic cup, linen napkin, small vase, calendar, generic radio, unbranded record sleeve |
| people policy | no people preferred; only tiny anonymous background silhouette if needed |
| forbidden elements | visible labels, readable menus, logos, watermarks, identifiable faces, creator-style imitation |

### summer-green

| Element | Abstracted trait |
| --- | --- |
| subject types | leaves, open window, iced drink, curtain, garden table, book |
| setting types | veranda, garden table, park edge, terrace cafe, kitchen window |
| composition | foliage edge frame, dappled foreground, low table subject, clean title field |
| text safe zone | left, right, or top clear space |
| lighting | bright daylight, filtered leaves, post-rain overcast, golden summer backlight |
| color palette | leaf green, white, lemon cream, mint, pale wood, sky blue |
| camera perspective | 35mm through leaves, inside-to-outside window view, high table view, garden low angle |
| props | iced tea, book, linen cloth, fruit bowl, glass pitcher, potted plant |
| people policy | no identifiable person; distant small silhouette only |
| forbidden elements | brand logos, readable signage, landmarks, copied pose, watermark |

### midcentury-lofi-room

| Element | Abstracted trait |
| --- | --- |
| subject types | lamp, books, low table, lounge chair, record player, quiet desk |
| setting types | midcentury-inspired living room, study, apartment listening corner, shelf wall |
| composition | lamp/table side anchor, window rectangle, furniture leading lines, open wall area |
| text safe zone | left, right, or top clear wall/window area |
| lighting | warm lamp vs cool evening window, dim study light, rainy reflection, dusty afternoon light |
| color palette | teak, mustard, olive, cream, smoky blue, amber, walnut |
| camera perspective | wide doorway view, eye-level table view, sofa-height low view, top-down desk view |
| props | table lamp, plain record player, books without readable titles, generic headphones, blanket |
| people policy | empty room or distant faceless silhouette outside focal area |
| forbidden elements | readable album art, device brands, identifiable people, close-up face, watermark |

### daily-happiness

| Element | Abstracted trait |
| --- | --- |
| subject types | breakfast tray, folded laundry, bouquet, doorway, sofa blanket, blank card |
| setting types | kitchen, living room, entryway, balcony, bedside table, home desk |
| composition | object low in frame, doorway frame, diagonal sunlight, simple room crop |
| text safe zone | left, right, or top clean wall/floor/background |
| lighting | gentle morning sun, soft afternoon window, golden home light, bright overcast |
| color palette | warm white, honey wood, soft yellow, pale green, peach, sage |
| camera perspective | home documentary eye level, high table view, floor-level sunlight angle |
| props | breakfast plate, mug, towel, bouquet, blank card, houseplant, tray |
| people policy | no identifiable person; only partial distant silhouette with hidden face if needed |
| forbidden elements | readable handwriting, family portrait faces, brand packaging, celebrity likeness, logo, watermark |

### cinematic-human-moment

| Element | Abstracted trait |
| --- | --- |
| subject types | distant anonymous silhouette, empty bench, corridor, platform, rainy street object |
| setting types | rainy street, station platform, hallway, city window, bus stop, plaza |
| composition | wide frame, leading lines, open wall or sky, environment dominates, figure under 20% |
| text safe zone | left, right, or top environmental negative space |
| lighting | misty backlight, blue-hour city light, wet-ground reflections, dim corridor spill |
| color palette | blue gray, amber, asphalt gray, teal, navy, mist gray |
| camera perspective | wide 24mm establishing shot, distant telephoto, low wet-ground angle, corridor eye level |
| props | umbrella silhouette, wet pavement, bench, window glow, plain coat, streetlamp |
| people policy | human figure must be distant, anonymous, face-hidden, and under 20% of frame |
| forbidden elements | film-still recreation, actor likeness, character costume, face close-up, same pose reproduction, studio logo |

## Implementation Linkage

- Abstracted archetypes are implemented under `src/data/thumbnailArchetypes/`.
- Prompt assembly and A/B/C variation are implemented in `src/core/thumbnailPromptComposer.ts`.
- Safety guardrails are implemented in `src/core/thumbnailSafety.ts`.
- The UI exposes archetype, season, time, people mode, text-safe-zone controls, and copyable A/B/C prompts without rendering source images.
