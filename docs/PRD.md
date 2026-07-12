# Product Requirements Document

## Goal

Create a reusable Suno prompt and lyric generation studio that can support many playlist channels, not only the current senior Korea/Japan channels.

## Core users

- Creator building YouTube playlist channels with AI music.
- Creator testing several channel concepts and seasonal music packages.
- Creator using Claude Code or Codex to iterate on the generator.

## Requirements

### Channel system

- User can create, edit, duplicate, and delete channel profiles.
- Profile fields: name, market, language, audience, emotional promise, visual identity, forbidden clichés, preferred instruments, default vocal.
- Presets are provided for `굿모닝 추억라디오` and `朝の昭和喫茶`.

### Song set generation

- Generate 10–20 songs from a single concept.
- All songs must share a coherent voice, sonic palette, tempo range, lyrical worldview, and visual direction.
- Each song should still have a distinct title, situation, hook, and seasonal keyword.

### Provider system

- Local generator should work without API.
- OpenAI/ChatGPT and Claude are optional providers.
- Provider adapters must be replaceable and isolated.
- Never commit API keys.

### Quality system

- Check duration-control phrases.
- Check money chord inclusion.
- Check target audience and season alignment.
- Check lyric structure for Suno.
- Check channel consistency.

### Export

- Export Markdown for copying.
- Export JSON for future automation.
- Export CSV for spreadsheet planning.

## Non-goals v2

- Direct upload to Suno.
- YouTube upload automation.
- Copyright similarity detection beyond simple prompt warnings.
