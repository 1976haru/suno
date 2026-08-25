# Genre Library QA Report

## Scope

- Source reviewed: local private Notion genre prompt export under `private_import`/`pirvate_import`.
- Raw import folders are ignored and must not be committed.
- Long source prompts were not copied into app data. Genre traits were rewritten as structured fields and compact original wording.

## Library Summary

- Existing preset ids preserved: 14
- Notion-derived structured genres added: 250
- Total app genre count: 264
- Maximum generated Style Prompt length observed in full per-genre local QA: 900 characters
- Source-derived top-level categories: Jazz, City Pop, R&B and Soul, Lo-fi and Study, Ballad

## Rewrite Rules Applied

- Removed any instruction pattern that asks for artist, band, song, melody, or vocal imitation.
- Kept common genre names and instrumentation terms, but rewrote prompt text into new short clauses.
- Separated detailed production guidance from Suno copy prompt text.
- Excluded visual identity, typography, thumbnail, logo, and image-layout wording from `Style Prompt`.
- Compressed hook guidance to: `short repeated chorus hook, identical melody, 3-4 clear returns`.

## Structured Fields

Every structured genre includes:

- `categoryId`
- `rhythm`
- `instruments`
- `vocal`
- `production`
- `harmony`
- `tempo`
- `moods`
- `audiences`
- `avoidTraits`
- `shortPrompt`
- `productionGuidance`

## Automated QA

Covered by `tests/genreLibrary.test.ts`:

- New genre count and total genre count
- Legacy genre id compatibility
- Required structured fields
- Visual/thumbnail/typography exclusion from Suno-facing genre text
- Imitation and famous-artist term exclusion from Suno-facing genre text
- Per-genre local generation under the 900-character copy limit
- Exact duplicate clause prevention
- Hook instruction compression
- Main plus two secondary genre selection limit

## Validation Commands

Run before release:

```bash
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

Latest validation:

- `npm.cmd run typecheck`: pass
- `npm.cmd run test`: pass, 21 files / 246 tests
- `npm.cmd run build`: pass
