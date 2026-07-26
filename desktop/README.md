# Suno Weaver Desktop Media Pipeline

This folder adds a hardened Electron shell for local media work while keeping the existing browser app unchanged.

## What it does

- Selects 1-100 local MP3/WAV/M4A/AAC/FLAC/OGG files through the operating-system file picker.
- Sorts numbered filenames naturally and probes their real durations.
- Requires an exact song-count match before rendering, preventing accidental title/audio misalignment.
- Normalizes mixed sample rates and channel layouts to 48 kHz stereo before concatenation.
- Renders 720p or 1080p H.264/AAC MP4 with contain/cover image modes.
- Generates YouTube chapter text from real durations.
- Supports real FFmpeg process cancellation and removes stale temporary jobs safely.

## Security model

- The renderer never receives arbitrary local paths. File dialogs return opaque, short-lived file IDs.
- No generic `store:get` / `store:set` IPC exists, and no API key is stored by the Electron shell.
- Navigation and popup windows are blocked; context isolation, sandboxing, web security, and CSP are enabled.
- Only approved image/audio extensions and bounded file sizes are accepted.
- Temporary cleanup only removes 32-character job directories older than 24 hours inside the dedicated HotAIMusic temp root.

## Development

Run the web app at port 5200 from the repository root:

```bash
npm install
npm run dev
```

Then in another terminal:

```bash
cd desktop
npm install
npm run dev
```

For a built local app, build the repository root first and then run `npm start` in this folder. A production installer configuration is intentionally not included yet; provider API routing and release signing should be finalized before distributing an executable.

## Tests

```bash
node --test tests/mediaCore.test.cjs
```

The root GitHub Actions workflow runs this dependency-free test file in addition to the existing TypeScript/Vitest/build checks.
