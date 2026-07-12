# Suno Weaver Studio v2

Suno Weaver Studio is an extensible prompt, lyrics, and YouTube metadata generator for playlist channels. It supports reusable channel profiles, 10-20 song batch generation, local template generation, and serverless-proxied OpenAI or Claude generation.

## Current Features

- Custom channel profiles saved to `localStorage`
- Full channel profile editor for market, language, audience, voice, visual identity, SEO terms, and safety rules
- Expanded genre packs, generation packs, mood packs, and season packs
- Consistent 10-20 song batch generation with recurring motifs and per-track variation
- Separate copy workflow for Suno `Style Prompt` and `Lyrics`
- YouTube title, description, tags, and thumbnail text for each song
- Automatic warnings for copyright-risk wording, famous artist references, and singer imitation prompts
- Export to Markdown, JSON, and CSV

## Install

```bash
npm install
npm run dev
```

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd run dev
```

## API Provider Notes

Browser-direct API keys are disabled. OpenAI and Claude requests go through the serverless route at `api/generate.js`.

Set server-side environment variables in your hosting provider:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

Supported modes:

1. `local` - no external API. Uses deterministic templates.
2. `openai` - sends generation payload to `/api/generate`, which calls OpenAI server-side.
3. `anthropic` - sends generation payload to `/api/generate`, which calls Anthropic server-side.

For local-only Vite development, use `local` mode unless you run a compatible serverless dev environment for `/api/generate`.

## Main Workflow

1. Build or select a channel profile.
2. Save custom profiles to browser storage.
3. Select audience, market, season, genre, and mood palette.
4. Generate a 10-20 song blueprint.
5. Copy Suno-ready `Style Prompt` and `Lyrics` separately.
6. Copy YouTube metadata per song.
7. Review safety warnings and export the pack.

## Default Channels

- Korean: 굿모닝 추억 라디오 / Good Morning Memory Radio
- Japanese: 모닝 쇼와 카페 / Morning Showa Cafe

These are presets only. Add, duplicate, or replace them for future channels.
