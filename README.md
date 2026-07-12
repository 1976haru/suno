# Suno Weaver Studio v2

Suno Weaver Studio is an extensible prompt and lyric generator for playlist channels. It is designed for the current Korean/Japanese senior playlist project, but the architecture supports new channels, markets, age groups, seasons, genres, moods, and AI providers.

## What changed in v2

- Custom channel builder: create any channel profile, not only the current two channels.
- Batch concept engine: generate a consistent 10–20 song set from one channel concept.
- Rich creative controls: market, language, audience, generation, season, mood, genre, tempo, vocal, narrative style, visual direction.
- Money chord engine enabled by default: I-V-vi-IV, vi-IV-I-V, I-vi-IV-V, ii-V-I color options.
- Optional AI provider adapters: local template mode, OpenAI-compatible ChatGPT API, Anthropic Claude API.
- Modular folder structure for future GitHub/Codex/Claude Code work.
- Export to Markdown, JSON, and CSV.

## Install

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## API provider notes

The app includes provider adapters under `src/providers/`.

For serious use, put API calls behind your own backend/serverless endpoint. Browser-direct API keys are convenient for local testing but should not be used on a public site. The UI stores keys only in local browser state for the current session by default.

Supported modes:

1. `local` — no external API. Uses deterministic templates.
2. `openai` — ChatGPT/OpenAI-compatible message generation.
3. `anthropic` — Claude Messages API style generation.

## Main workflow

1. Build or select a channel profile.
2. Select audience, market, season, genre, and mood palette.
3. Generate a 10–20 song blueprint.
4. Generate Suno-ready `Style Prompt` and `Lyrics` per song.
5. Run the checklist/quality score.
6. Export results.

## Current default channels

- Korean: 굿모닝 추억라디오 / Good Morning Memory Radio
- Japanese: 朝の昭和喫茶 / Morning Showa Café

These are presets only. Add, duplicate, or replace them for future channels.
