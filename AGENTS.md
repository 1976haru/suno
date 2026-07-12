# Codex / Claude Code Instructions

## Project purpose

Build and improve `Suno Weaver Studio`, a modular generator for Suno style prompts and lyrics.

The app must support:

- Custom channel profiles, not only the current two senior channels.
- 10–20 song batch generation from one concept.
- OpenAI/ChatGPT and Claude provider options.
- Local fallback generation without API.
- Money chord presets enabled by default.
- Export to Markdown, JSON, and CSV.

## Important design rules

1. Keep provider code isolated under `src/providers`.
2. Keep data presets under `src/data`.
3. Keep generation logic under `src/core`.
4. Never commit API keys.
5. Do not prompt for famous artist imitation or copyrighted song cloning.
6. Preserve the Suno copy workflow: `Style Prompt` and `Lyrics` must be separate.
7. Add future features in modules rather than large one-off files.

## Next recommended tasks

- Add localStorage persistence for custom channels.
- Add a full channel profile editor.
- Add serverless API proxy for OpenAI/Claude.
- Add more genre packs and audience presets.
- Add playlist calendar and YouTube metadata generator.
