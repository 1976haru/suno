# Suno Weaver Studio v3

Suno Weaver Studio is a prompt, lyrics, and YouTube metadata generator for playlist channels. It supports reusable channel profiles, 1-30 song batch generation, local template generation, an LLM evaluation agent, saved-pack storage, and serverless-proxied OpenAI or Claude generation.

See [`docs/MIGRATION.md`](docs/MIGRATION.md) for what changed since v2, and [`docs/STRESS_TEST_REPORT.md`](docs/STRESS_TEST_REPORT.md) for the current automated stress-test results (regenerated on every `npm run test:stress` run).

## Current Features

- 4-step guided workflow (채널 → 컨셉 → 생성 → 결과) with Korean UX copy throughout
- Custom channel profiles saved to `localStorage`
- 1-30 song batch generation with a combinatorial, seeded lyric engine — no repeated titles or hooks within a pack, and cross-song lyric-line similarity is checked automatically
- 8 money chord presets (including custom, canon, showaModern, winterBallad) with a live style-prompt preview
- Saved-pack library backed by IndexedDB, with autosave, rename, delete, and full backup export/import
- Optional LLM evaluation agent (song- and pack-level scoring, Korean output) with a one-click retry for rejected tracks
- Export to Markdown, JSON, CSV, or a single song as `.txt`
- Automatic rule-based warnings for copyright-risk wording, famous artist references, and singer imitation prompts
- Local dev proxy for `/api/generate` (`vite.config.ts`), so OpenAI/Claude modes can be tested with `npm run dev` alone

## Install

```bash
npm install
npm run dev
```

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd run dev
```

## API Key Setup

Open the app and click **⚙️ 설정** (Settings). There are two ways to provide an API key:

| Mode | Where the key lives | When to use it |
|---|---|---|
| **서버 환경변수 사용 (기본값, 권장)** | Your hosting provider's environment variables | Deploying for yourself or sharing with others |
| **이 브라우저에 저장 (로컬 전용)** | This browser's IndexedDB | Solo local use only |

### Server mode (recommended)

Set these on your hosting provider (Vercel, etc.) or in a local `.env` for `npm run dev`:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

`api/generate.js` reads these server-side; the browser never sees them.

### ⚠️ BYOK (로컬 저장) mode — security note

If you choose "이 브라우저에 저장" in Settings, the key is written to this browser's IndexedDB and sent with each request as an `X-User-Api-Key` header. **This means the key is retrievable by anything with access to that browser profile.**

- **Do not use BYOK mode on a shared or public computer.**
- The key is never logged to the console or embedded in error messages (verified by `tests/stress.test.ts`'s S14 case).
- Use **모든 데이터 삭제** in Settings to wipe a stored key before handing off a machine.

Supported provider modes:

1. **local** — no external API, deterministic local templates.
2. **openai** — sends the generation payload to `/api/generate`, which calls OpenAI server-side (or with your BYOK key).
3. **anthropic** — same, for Claude.

### 🔴 Before deploying publicly (e.g. to Vercel)

Running locally for yourself, none of this is urgent — skip it. **Before anyone else can reach the deployed URL, set these up first:**

| Env var | Purpose | Default if unset |
|---|---|---|
| `ALLOWED_ORIGINS` | Comma-separated allowlist of origins allowed to call `/api/generate` and `/api/batch` (e.g. `https://your-app.vercel.app`). Requests from any other Origin get `403 Origin not allowed`. | Unset = allow any origin (assumes local/dev use — **do not leave unset on a public deploy**, or anyone who finds the URL can spend your server-side API key). |
| `ACCESS_TOKEN` | A secret you choose. When set, server-key mode (no BYOK header) requires the request to carry a matching `X-Access-Token` header, or it gets `401`. Enter the same value in the app's Settings → "접근 토큰" field so your own client keeps working. BYOK requests are unaffected either way (they spend the caller's own key). | Unset = server-key mode has no access control beyond the IP rate limit below. |

**Rate limiting is in-memory, not persistent.** `checkRateLimit()` in `api/generate.js` / `api/batch.js` keeps its counters in a plain `Map` in the function's memory — on Vercel (and most serverless platforms) that memory is per-instance and gets reset whenever the platform spins up a new instance, so the limit is a soft speed bump, not a hard guarantee. If you need a real limit under real traffic, put a persistent store (e.g. Upstash Redis) behind `checkRateLimit()` — this isn't wired up here, since adding a dependency wasn't in scope for this pass.

## Main Workflow

1. **① 채널** — build or select a channel profile.
2. **② 컨셉** — pick genre, mood, season, money chords, and lyric depth.
3. **③ 생성** — choose song count (1-30) and generate.
4. **④ 결과** — review each song (style prompt / lyrics / YouTube tabs), run the AI evaluation agent, retry rejected tracks, and save or export the pack.

## 경로별 적정 규모 (실측 기반)

주 180곡(2채널 x 5세트 x 18곡) 규모를 어떤 경로로 만들지 고를 때 참고하세요. 실측: 곡당 출력
약 625토큰 — 180곡을 한 번에 요청하면 약 112,600 토큰으로 어떤 LLM의 단일 응답 출력 상한
(32K~64K)도 넘어서 응답이 중간에 끊깁니다(Claude Code 브릿지로 180곡 요청 시 실제로 12곡에서
끊긴 사례 확인). 12~18곡이 한 번의 안전한 요청 분량입니다.

| 경로 | 1회 요청 규모 | 180곡 진행 방식 | 비용 |
|---|---|---|---|
| Claude Code 브릿지 (복붙) | 12~18곡 (권장 세트당 18곡) | 세트별 지시문 10개를 순서대로 복사·실행·가져오기 | API 비용 $0 (정액제 코딩 에이전트 사용) |
| Batch API | 180곡 한 번에 가능 (서버가 자동으로 청크 분할) | 멀티세트 모드에서 1회 제출 | 약 $3 (4,200원) |
| 실시간 API | 180곡 가능하나 청크 수가 많아짐 | 멀티세트 모드에서 1회 제출 | Batch 대비 약 2배, 시간도 더 걸림 |

**추천**: 주 180곡을 정기적으로 만든다면 Batch API(멀티세트 모드에서 한 번에 제출, 서버가
자동으로 세트/청크를 나눔)를 쓰세요. API 비용을 0으로 만들고 싶다면 Claude Code 브릿지를
세트당 하나씩(180곡 기준 10회) 반복하세요 — Step3의 "멀티 세트" 모드를 켜면 브릿지 지시문이
세트별로 자동 분리되어 리스트로 표시되고, 세트마다 [복사]/완료 체크로 진행 상황을 추적할 수
있습니다.

## Default Channels

- Korean: 굿모닝 추억라디오 / Good Morning Memory Radio
- Japanese: 朝の昭和喫茶 / Morning Showa Café

These are presets only. Add, duplicate, or replace them for future channels.

## Testing

```bash
npm run typecheck
npm run test          # unit + stress tests
npm run test:stress   # stress tests only, verbose, regenerates docs/STRESS_TEST_REPORT.md
```
