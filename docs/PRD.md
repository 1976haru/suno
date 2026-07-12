# Suno Weaver Studio v2 PRD

## Goal

Create a reusable Suno prompt and lyric generation studio that supports many playlist channels, not only the current senior Korea/Japan channels.

## Core requirements

### 1. Custom channel system

The user can create channel profiles by concept. Presets are included for:

- 굿모닝 추억라디오 / Good Morning Memory Radio
- 朝の昭和喫茶 / Morning Showa Café

Future profiles can target kids, study, sleep, travel, workout, romance, city-pop, lo-fi, or other concepts.

### 2. Batch song-set generation

The generator must create a coherent 10–20 song set from one concept. Consistency rules:

- Same channel vocal identity
- Same genre family
- Same emotional promise
- Same season/visual palette
- Distinct title, hook, listener situation, and thumbnail phrase per song

### 3. AI provider options

- Local mode works without API.
- OpenAI/ChatGPT API is optional.
- Claude/Anthropic API is optional.
- Provider code must stay isolated in `src/providers`.
- API keys must never be committed.

### 4. Creative controls

User can select:

- Channel
- Market
- Lyric language
- Audience generation/age group
- Season
- Genre packs
- Mood packs
- Vocal tone
- Money chord mode
- Duration target
- Avoid words

### 5. Money chord engine

Default must include:

- I-V-vi-IV
- vi-IV-I-V
- Emotional chorus lift
- Radio-friendly melody
- Easy sing-along hook

### 6. Quality checker

The generator checks:

- Money chord phrase exists
- Length-control phrase exists
- Required Suno lyric tags exist
- Lyrics are not too long
- No direct famous-artist imitation prompts

## Current limitations

- Browser-direct API calls are for local testing only.
- Public deployment should use a backend/serverless proxy.
- No direct Suno upload automation is included.
