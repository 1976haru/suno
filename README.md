# Suno Weaver Studio (haru-studio)

Suno Weaver Studio is a prompt, lyrics, and YouTube metadata generator for playlist channels. It supports reusable channel profiles, 1-80 song batch generation, local template generation, an LLM evaluation agent, saved-pack storage, and serverless-proxied OpenAI or Claude generation.

빠르게 처음부터 따라 하려면 [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md)를 보세요(클론 → API 키 → 첫 세트 생성). 그 외에 [`docs/MIGRATION.md`](docs/MIGRATION.md) (v2 이후 변경점), [`docs/STRESS_TEST_REPORT.md`](docs/STRESS_TEST_REPORT.md) (`npm run test:stress` 실행마다 갱신되는 자동 스트레스 테스트 결과)도 참고하세요.

## 현재 상태 (2026-08-10 기준)

- **버전**: `package.json`의 `version`이 유일한 진실입니다 — 현재 **0.21.0**. 과거엔 "0.NN.0의 NN = 완료된 지시문 번호" 규칙이었으나(`docs/CHANGELOG.md` 참고) 이후 일부 지시문이 버전을 올리지 않아 더 이상 정확히 대응하지 않습니다. `git log`가 실제 최신 작업의 진실입니다(현재 최신 완료: 지시문 37).
- **브랜치**: 아래 [브랜치 구조](#브랜치-구조) 참고.
- **워크플로 단계**: 워크스페이스 선택 → 5단계(①채널 → ②컨셉 → ③설계안 → ④생성 → ⑤결과)
- **기능 상태** (`src/data/featureFlags.ts` 참고):
  - `production`: 세트 생성 / 품질관문(설계·생성) / Claude Code 브릿지 / SRT 자막 내보내기 / standalone 진행 모드 / 워크스페이스 전환
  - `experimental`: 음원 분석 / 음원 편집 / 숏폼 하이라이트 / 음원 아카이브 / 평가 학습 / 이미지 생성
- **워크스페이스 상태** (`src/data/workspaces/index.ts`의 `ready` 필드 + `src/data/distinctChoicePolicy.ts`의 `verified` 필드 기준 — 실제 게이팅에 쓰이는 값):

  | 워크스페이스 | id | 사용 가능(`ready`) | 품질 실측(`verified`) |
  |---|---|---|---|
  | 시니어 올드팝 | `senior-oldpop` | ✅ | ✅ 실측 검증됨 (54곡·3세트) |
  | 한국 20~30대 | `kr-2030` | ✅ | ⚠ 미검증 — 측정 18곡(1세트), 승격 조건(≥18곡) 충족했으나 자동 승격 아님(하루 승인 대기) |
  | 일본 20~30대 | `jp-2030` | ✅ | ⚠ 미검증 — 측정 0곡 |
  | 한국 동요 | `kr-kids` | ✅ | ⚠ 미검증 — 측정 18곡(1세트), 승격 조건 충족(승인 대기) |
  | 일본 동요 | `jp-kids` | ✅ | ⚠ 미검증 — 측정 0곡 |
  | 한국 남자 아이돌(K-pop) | `kr-idol-male` | ✅ | ⚠ 미검증 — 측정 0곡 |
  | 한국 여자 아이돌(K-pop) | `kr-idol-female` | ✅ | ⚠ 미검증 — 측정 0곡 |

  "사용 가능"은 워크스페이스를 선택하고 세트를 생성할 수 있다는 뜻입니다(전부 예). "품질 실측"은 하루가 실제로 들어보고 채점 임계값을 확정했는지 여부입니다 — 미검증 워크스페이스의 각종 품질 관문(distinctChoice 규칙 이행률, setArcAdherence 등)은 전부 **advisory**로만 동작하고 세트 생성을 막지 않습니다. 최신 실측 수치는 `npm run check:coverage`로 직접 확인하세요.

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

## 실행 방법

### Windows — `start-studio.bat` (권장, 비개발자용)

레포 루트의 `start-studio.bat`을 더블클릭하면:

1. Claude/Gemini/Qwen API 키를 물어보고(선택 사항 — 비워두면 로컬 전용 모드), `.anthropic_key`/`.gemini_key`/`.qwen_key` 파일에 저장합니다. **이 파일들은 `.gitignore`에 등록되어 있어 커밋되지 않습니다** — 저장소에는 스크립트만 있고 키는 절대 들어가지 않습니다.
2. `feat/notion-genre-library` 브랜치로 전환하고 `git pull`합니다.
3. `npm install` 후 `npm run dev -- --open`으로 브라우저를 엽니다.

두 번째 실행부터는 저장된 키를 자동으로 읽어 바로 실행됩니다. 창을 닫으면 서버가 멈춥니다.

### 수동 실행 (모든 OS)

```bash
npm install
npm run dev
```

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd run dev
```

처음부터 첫 세트 생성까지 전체 절차는 [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md)를 참고하세요.

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

워크스페이스를 먼저 고른 뒤(위 [워크스페이스 상태](#현재-상태-2026-08-10-기준) 표 참고), 5단계를 거칩니다:

1. **① 채널** — build or select a channel profile.
2. **② 컨셉** — pick genre, mood, season, money chords, and lyric depth.
3. **③ 설계안** — "이렇게 해석했습니다" 미리보기: 실제 생성 전에 장르/BPM/보컬 등 다양성 배분과 품질 관문(blocking/advisory) 결과를 확인하고 필요시 조정합니다.
4. **④ 생성** — choose song count (1-30) and generate.
5. **⑤ 결과** — review each song (style prompt / lyrics / YouTube tabs), run the AI evaluation agent, retry rejected tracks, and save or export the pack.

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

각 워크스페이스(위 표)마다 여러 개의 채널 프리셋이 미리 등록되어 있습니다(`src/data/presets.ts`) — 예: 시니어 올드팝의 "굿모닝 추억라디오"/"朝の昭和喫茶", K-pop의 "낮의 도시를 걷는 K-POP" 등. 프리셋은 시작점일 뿐이며 앱 안에서 자유롭게 추가·복제·수정할 수 있습니다.

## 브랜치 구조

```
main                        ← 배포/안정 기준점. 주기적으로 feat/notion-genre-library를 머지해 따라잡음
  └─ feat/notion-genre-library   ← 진행 중인 통합 브랜치. 완료된 지시문 작업이 여기로 머지됨
       └─ feat/instruction-N     ← 지시문 N 하나를 위한 작업 브랜치. feat/notion-genre-library에서
                                    분기하고, 완료되면 다시 feat/notion-genre-library로 머지·삭제
```

- **`main`**: 가장 안정적인 기준점. 새로 클론한다면 여기서 시작하세요(`start-studio.bat`은 계속 개발이 이어지는 `feat/notion-genre-library`를 기본으로 씁니다 — 최신 미검증 작업까지 보고 싶다면 그쪽을 쓰고, 안정적인 지점만 원하면 `main`으로 바꿔 쓰세요).
- **`feat/notion-genre-library`**: 지시문 작업이 실제로 쌓이는 곳. `main`보다 앞서 있을 수 있습니다.
- **`feat/instruction-N`**: 지시문(하루가 번호를 매겨 순차적으로 지시하는 작업 단위) 하나에 대응하는 임시 작업 브랜치. 완료 후 `feat/notion-genre-library`에 머지되면 보존할 이유가 없는 한 삭제됩니다.

각 지시문의 완료 판정·수치·"하지 말 것" 목록 등 작업 이력은 `docs/CHANGELOG.md`와 각 지시문 커밋 메시지(`git log`)에서 확인할 수 있습니다.

## Testing

```bash
npm run typecheck
npm run test          # unit + stress tests
npm run test:stress   # stress tests only, verbose, regenerates docs/STRESS_TEST_REPORT.md
npm run lint          # eslint, 0 warnings 허용
npm run audit -- --pack <path>   # 저장된 팩 JSON 하나를 감사(품질 관문 실측)
```

작업 전 상태를 빠르게 점검하려면 `npm run check:gates`(장르 회전/시대 계약), `npm run check:coverage`(워크스페이스별 실측 곡 수), `npm run check:reachability`(죽은 코드 없음) 등 `check:*` 스크립트도 참고하세요 — 전체 목록은 `package.json`의 `scripts`.
