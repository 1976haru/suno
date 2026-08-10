# Getting Started — 클론부터 첫 세트 생성까지

이 문서는 이 저장소를 처음 받아서 첫 곡 세트를 만들어내기까지의 전체 절차를 다룹니다. 이미 익숙하다면 [`README.md`](../README.md)의 요약만 봐도 충분합니다.

## 0. 사전 준비

- [Node.js](https://nodejs.org/) 18 이상 (권장: 20+), npm 포함
- Git
- (선택) Claude(Anthropic)·OpenAI API 키 — 없어도 **local 모드**로 바로 곡을 만들 수 있습니다. API 키는 더 다양한/고품질 결과가 필요할 때만 있으면 됩니다.

## 1. 클론

```bash
git clone https://github.com/1976haru/suno.git suno-current
cd suno-current
```

어느 브랜치로 클론할지는 무엇을 하려는지에 따라 다릅니다 — README의 [브랜치 구조](../README.md#브랜치-구조) 참고:

- **안정적인 지점만 필요하다면**: 기본으로 클론되는 `main`을 그대로 씁니다.
- **최신 진행 중인 작업까지 보고 싶다면**:
  ```bash
  git checkout feat/notion-genre-library
  ```

## 2. 실행

### 2-a. Windows에서 가장 쉬운 방법 — `start-studio.bat`

탐색기에서 `start-studio.bat`을 더블클릭하세요. 처음 실행하면:

1. Claude API 키를 물어봅니다 — `sk-ant-`로 시작하는 키를 붙여넣거나, 그냥 Enter를 눌러 건너뛰면 **local 모드**로 실행됩니다.
2. Gemini/Qwen 키(썸네일·이미지 생성용, 완전히 선택 사항)도 같은 방식으로 물어봅니다.
3. `feat/notion-genre-library` 브랜치로 전환 → `git pull` → `npm install` → 브라우저가 자동으로 열립니다.

입력한 키는 레포 루트의 `.anthropic_key`/`.gemini_key`/`.qwen_key` 파일에 저장되어 다음부터 자동으로 쓰입니다. 이 파일들은 `.gitignore`에 있어 **절대 커밋되지 않습니다** — 저장소를 다른 사람과 공유해도 키가 함께 넘어가지 않습니다.

검은 콘솔 창을 열어두세요 — 여기에 생성 중 진단 로그(`[GEN DIAG]`, `[GEN USAGE]`)가 찍힙니다. 창을 닫으면 서버가 멈춥니다.

### 2-b. 수동 실행 (Windows/Mac/Linux 공통)

```bash
npm install
npm run dev
```

브라우저에서 콘솔에 뜨는 주소(기본 `http://127.0.0.1:5200`)를 엽니다. PowerShell이 `npm.ps1` 실행을 막으면 `npm.cmd run dev`를 대신 쓰세요.

API 키를 서버 환경변수로 주고 싶다면(개인 사용이 아니라 배포/공유 목적이라면) 레포 루트에 `.env`를 만들고:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

자세한 키 관리 방식(서버 환경변수 vs 브라우저 BYOK)은 [`README.md`의 API Key Setup](../README.md#api-key-setup)을 참고하세요.

## 3. 첫 세트 생성

앱을 열면 **워크스페이스 선택 화면**이 먼저 나옵니다(시니어 올드팝 / 한국·일본 20~30대 / 한국·일본 동요 / 한국 남녀 아이돌 K-pop — 7개 모두 선택 가능). 처음이라면 실측 검증이 끝난 **시니어 올드팝(senior-oldpop)**을 고르는 걸 권장합니다 — 다른 워크스페이스는 아직 advisory 상태의 미검증 품질 관문으로 동작합니다(자세한 내용은 [`README.md`의 워크스페이스 상태](../README.md#현재-상태-2026-08-10-기준) 참고).

워크스페이스를 고르면 5단계 마법사가 시작됩니다:

1. **① 채널** — 미리 등록된 채널 프리셋 중 하나를 고르거나(예: "굿모닝 추억라디오"), 필요하면 직접 만듭니다. 처음이라면 프리셋을 그대로 쓰세요.
2. **② 컨셉** — 장르·분위기·시즌·머니코드(코드 진행)·가사 깊이를 고릅니다. 컨셉을 자유 문장으로 입력할 수도 있습니다(예: "60년대 추억이 느껴지는 올드팝").
3. **③ 설계안** — "이렇게 해석했습니다" 미리보기 화면입니다. 실제로 생성하기 전에 장르/BPM/보컬 배분과 품질 관문(빨강=blocking, 노랑=advisory) 결과를 보여줍니다. blocking 항목이 있으면 여기서 컨셉이나 설정을 조정하세요.
4. **④ 생성** — 곡 수(1~30, 기본 12~18 권장)를 정하고 프로바이더를 고릅니다:
   - **local** — API 키 없이 즉시 생성(결정론적 템플릿 조합). 첫 시도로 가장 빠릅니다.
   - **anthropic** / **openai** — 실제 LLM 호출. 위에서 키를 설정했다면 바로 쓸 수 있습니다.
   - **Claude Code 브릿지** — API 비용 없이, 정액제 코딩 에이전트(Claude Code 등)에게 복사해 붙여넣을 지시문을 생성합니다. 12~18곡 단위가 한 번에 안전한 분량입니다(자세한 내용은 [`README.md`의 경로별 적정 규모](../README.md#경로별-적정-규모-실측-기반) 참고).
   생성 버튼을 누르면 진행 상황이 표시됩니다.
5. **⑤ 결과** — 곡마다 스타일 프롬프트 / 가사 / YouTube 메타데이터 탭을 확인합니다. 필요하면 AI 평가 에이전트로 채점하고, 탈락한 트랙만 재생성할 수 있습니다. 마음에 들면 팩을 저장(자동 저장됨, IndexedDB)하거나 Markdown/JSON/CSV로 내보냅니다.

이제 스타일 프롬프트와 가사를 Suno(또는 사용 중인 음악 생성 서비스)에 붙여넣으면 됩니다.

## 4. 다음 단계

- **저장된 팩 확인/재사용**: 사이드바의 라이브러리에서 이전에 저장한 팩을 열람·수정·재생성할 수 있습니다.
- **여러 세트를 한 번에**: ④ 생성 단계에서 "멀티 세트" 모드를 켜면 여러 채널×세트를 한 번에 계획할 수 있습니다.
- **직접 감사(audit)하기**: 저장한 팩 JSON 파일 하나를 CLI로 품질 감사하려면
  ```bash
  npm run audit -- --pack <파일 경로>
  ```
- **코드를 바꿔가며 테스트**: [`README.md`의 Testing 섹션](../README.md#testing) 참고 — `npm run test`, `npm run typecheck`, `npm run lint` 등.

## 문제 해결

| 증상 | 원인/해결 |
|---|---|
| `npm.ps1`을 PowerShell이 실행 차단 | `npm.cmd run dev`처럼 `.cmd` 확장자를 명시하거나, `start-studio.bat`을 대신 쓰세요. |
| Claude Code 브릿지로 한 번에 많은 곡(예: 180곡)을 요청하면 응답이 중간에 끊김 | 한 번의 안전한 요청은 12~18곡입니다 — [`README.md`의 경로별 적정 규모](../README.md#경로별-적정-규모-실측-기반) 참고. |
| `npm install`이 Windows에서 `EPERM`으로 실패 | 실행 중인 dev 서버나 vitest 워커가 파일을 잠그고 있을 수 있습니다. 콘솔 창들을 닫고 다시 시도하거나, `npm install`(`npm ci` 대신)을 쓰세요 — 기존 `node_modules`를 지우지 않고 갱신만 합니다. |
| API 키를 넣었는데도 local 모드로만 생성됨 | ④ 생성 단계에서 프로바이더가 "local"로 선택돼 있는지 확인하세요 — 키가 있어도 프로바이더를 anthropic/openai로 직접 바꿔야 합니다. |
