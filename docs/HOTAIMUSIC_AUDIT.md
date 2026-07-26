# HotAIMusic Benchmark Audit and Hardening

## Scope

Audit date: 2026-07-26

Compared the uploaded HotAIMusic Electron distribution with Suno Weaver Studio v3.6. The reference app was unpacked from `app.asar`, its Electron main/preload code and bundled renderer were inspected, and its FFmpeg concatenation design was reproduced with generated media.

## Overall assessment

- Suno Weaver Studio remains stronger in channel profiles, prompt/lyric generation, duplicate prevention, evaluation, saved packs, thumbnail strategy, exports, and video operations.
- HotAIMusic is stronger after generation: remote audio task polling, MP3 download, local FFmpeg rendering, real-duration timelines, and edit-package output.
- Before this change, the GitHub repository did not contain the HotAIMusic-style local audio/video pipeline. The benchmark instruction therefore improved planning and generation quality but did not complete the end-to-end workflow.

## Reference-app findings

### Correctly implemented

- Windows filename sanitizing and an ASCII temporary workspace.
- Real FFprobe duration checks.
- 20-track still-image MP4 output.
- Recovery checks after some Suno task failures.
- Timeline text based on cumulative track duration.

### High-risk gaps found

1. API keys are written through generic Electron Store IPC and are not protected with OS credential encryption.
2. The renderer can request arbitrary URL downloads and arbitrary local-file reads through broad IPC handlers.
3. MP3 downloads buffer the complete response in memory and have no size or content-type ceiling.
4. Suno polling has no total deadline; caught network failures are silently ignored and can poll forever.
5. UI cancellation stops the JavaScript loop but does not terminate an active FFmpeg process.
6. Render progress uses one global event with no job identifier, so concurrent jobs can mix progress.
7. Temporary startup cleanup removes every child of the configured temp root, rather than only known stale job folders.
8. Audio inputs are concatenated without explicitly normalizing sample rate, sample format, and channel layout.
9. The “CapCut ZIP” is an edit-material archive, not a real CapCut project.
10. The packaged app has no automated test command or regression suite.

## Implemented hardening

- Added a separate Electron desktop layer rather than putting filesystem access into the browser app.
- File dialogs return opaque approved-file IDs instead of exposing arbitrary path-based IPC.
- Added strict extension, file-count, size, duration, and duplicate-selection validation.
- Added 48 kHz stereo normalization for every audio input before concat.
- Added 720p/1080p and contain/cover rendering choices.
- Added job-scoped progress, one-render-at-a-time control, real FFmpeg process cancellation, 13-hour hard timeout, and safe stale-job cleanup.
- Added exact pack/audio count validation to prevent metadata being paired with the wrong track.
- Added real-duration YouTube chapter export.
- Added CSP, navigation denial, popup denial, context isolation, sandboxing, and web security.
- Added 10 automated desktop-core tests, including 10,000 randomized Unicode filename cases and the 100-track filter boundary.

## Stress tests executed

| Scenario | Result | Notes |
|---|---|---|
| Existing generator stress suite review | PASS with coverage gap | 1-30 songs, 50 repeated generations, edge inputs, API mock failure/retry are covered; IndexedDB bulk load remains manual. |
| 20 mixed audio files | PASS | MP3/WAV/FLAC, 32/44.1/48 kHz, mono/stereo, Korean paths; output was H.264 1920x1080 + AAC 48 kHz stereo. |
| 100-track concat boundary | PASS | Completed with generated short media; validates filter-label uniqueness and practical command size. |
| Unicode filename fuzzing | PASS | 10,000 randomized cases; no Windows-invalid characters or trailing dots/spaces remained. |
| Job-ID collision test | PASS | 10,000 generated IDs, zero duplicates. |
| SSRF-style URL validation | PASS | HTTP, localhost, loopback, private IPv4/IPv6, credentials, and non-standard ports rejected. |
| Unsupported file types | PASS | Executables and SVG rejected; intended audio/image formats accepted. |
| Corrupt/missing media | PASS by design | Selection/probe fails before render and returns a user-facing error. |
| Actual Windows installer/signing | NOT RUN | Linux audit environment cannot execute the uploaded Windows Electron binary. |
| Live Gemini/Suno paid API calls | NOT RUN | No user API keys were used and no paid requests were made. |

## Remaining work before public distribution

- Add a signed Windows installer and verify FFmpeg unpacking in the final package.
- Decide how packaged desktop builds reach `/api/generate` and `/api/batch` (trusted hosted app origin or a local authenticated proxy).
- Add persisted render-job recovery if resuming an interrupted encode is required; current implementation safely cancels/cleans rather than resuming FFmpeg mid-file.
- Add a streaming edit-package exporter if archives much larger than several hundred megabytes are required.
- Perform a real Windows 11 test with Korean user/profile paths, sleep/resume, low disk space, antivirus scanning, and abrupt power loss.
