# Codex / Claude Code Instructions

## Project Purpose

Build and improve `Suno Weaver Studio`, a v3 modular workbench for Suno-ready style prompts, lyrics, playlist packs, YouTube metadata, thumbnail specs, and optional AI-assisted refinement.

The app must support:

- Custom channel profiles with persisted local management.
- Single-song drafts and large playlist batches up to the current app limit.
- OpenAI/ChatGPT, Claude, Batch API, hybrid, and local fallback generation paths.
- Money chord presets enabled by default.
- Separate Suno copy fields for `Style Prompt` and `Lyrics`.
- Export to Markdown, JSON, and CSV.
- Structured genre, mood, season, vocal, hook, thumbnail, and avoid-word data modules.
- Persona preparation workflows through reusable sound signatures and local prompt recomposition.

## v3 Architecture Rules

1. Keep provider code isolated under `src/providers`.
2. Keep data presets and imported-derived catalogs under `src/data`.
3. Keep generation, quality, prompt budgeting, cost, cache, hook, thumbnail, Persona sound-signature, and ledger logic under `src/core`.
4. Keep React UI composition under `src/components` and orchestration hooks under `src/hooks`.
5. Keep serverless proxy code under `api`.
6. Add future features in modules rather than large one-off files.
7. Preserve backwards compatibility for `GenrePack`, saved packs, and channel profile data whenever possible.

## Safety And Rights Rules

1. Never commit API keys, local secrets, or provider credentials.
2. Never commit `private_import/`, `pirvate_import/`, or other raw third-party/source import dumps.
3. Do not copy long source prompts verbatim into production data. Analyze traits and rewrite original prompt text.
4. Do not prompt for famous artist imitation, band imitation, soundalike vocals, copyrighted song cloning, copied melodies, or cover/derivative requests.
5. Strip visual identity, typography, thumbnail, and layout language from Suno `Style Prompt`; keep it only in visual/thumbnail fields.
6. Keep `Style Prompt` and `Lyrics` separate throughout UI, exports, and generated data.
7. Keep Suno copy prompts within the current copy budget and use priority-based compression rather than mid-sentence truncation.
8. Do not add an in-app Suno Persona selector. The app should provide signature material and Make Persona workflow guidance only.
9. Persona mode must recompose prompts locally, keep lyrics unchanged, and avoid API calls.

## 테스트 실행 규칙 (v3.66 TASK A)

- 작업 중에는 `npm run test:fast` 만 실행하십시오 (프롬프트 조립·가사 생성·장르/다양성 배분·채점·브릿지 핸드오프 영역, 실측 약 5초/50파일).
- `npm test` (전체 131개 파일)는 푸시 직전 한 번만 실행하십시오.
- 수정마다 전체 스위트를 돌리지 마십시오.
- `test:fast`에 포함되지 않은 파일(썸네일, 이미지 스튜디오, 설정, 스토리지, 배치 잡, 내보내기 등 안정화된 영역)을 수정했다면 그 영역에 한해 개별 파일을 지정해 실행하고, 최종 확인은 `npm test`로 하십시오.

## Current Recommended Tasks

- Expand structured genre library coverage while preserving existing preset ids.
- Keep genre-library QA tests current for length, safety, duplicate terms, and backwards compatibility.
- Improve channel archetype and hook-bank coverage for newly added genre/audience combinations.
- Add tests around Persona sound signatures, persona-mode prompt compression, and saved Persona reuse.
- Harden provider proxy validation, retry behavior, and user-facing error messages.
- Add richer playlist planning tools only as separate modules with tests.
