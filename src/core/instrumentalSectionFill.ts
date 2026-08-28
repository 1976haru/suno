/**
 * 지시문 79 (TASK C-3) — BPM 구간별 섹션 하한을 **로컬 생성 경로에도**
 * 적용한다.
 *
 * 지시문 74 TASK A는 96 BPM 이상에서 총 섹션 수 하한(96-110 → 9,
 * 111-125 → 11, 126+ → 13)을 정하고 세 곳에 배선했다: 슬롯의
 * sectionCountRange(core/batchPreallocation.ts), 브릿지 지시문
 * (core/bridgeInstruction.ts), 채점(core/quality.ts). **로컬 생성 경로만
 * 빠졌다** — core/localGenerator.ts는 구조 템플릿(6~8섹션)이 만든 가사를
 * 그대로 쓴다.
 *
 * 그 결과 로컬 생성물이 자기 채점기에 걸렸다(실측): 96 BPM 이상 246곡 중
 * 230곡(93.5%)이 하한 미달이고, 111~125 BPM 대역은 97곡 **전부** 미달이다
 * (템플릿 최대치가 10섹션인데 하한이 11이라 구조적으로 도달 불가).
 * 전체 408곡의 58.3%가 "이 템포에서는 최소 N개가 필요합니다" 경고와
 * -12점을 받았다 — 사용자가 손쓸 수 있는 것이 하나도 없는 감점이다.
 * core/quality.ts의 그 검사 자기 주석은 "모든 생성 경로(로컬/Batch/브릿지
 * 임포트)가 반드시 통과하는 단일 관문"이라고 로컬을 명시적으로 포함한다.
 *
 * 채우는 방식은 지시문 74가 브릿지 에이전트에게 지시한 것과 **같다**:
 * 보컬 섹션을 쪼개지 않고 **간주 전용 섹션**을 뼈대 주위에 덧붙인다
 * (bridgeInstruction.ts의 "Fill the extra sections with INSTRUMENTAL-only
 * sections, never with more sung verses"). 태그 어휘도 그 지시문이 예시로
 * 든 것(build-up intro / breakdown / instrumental break)에서 가져와 두
 * 경로의 산출물 모양이 갈리지 않게 한다 — 그 예시 중 outro만 쓰지 않는다
 * (§FILL_SECTIONS의 doc comment: 후행 outro는 하류에서 제거된다).
 */
import { minTotalSectionsForBpm } from './bpmLengthControl';
import { parseLyricsSections } from './lyricsAst';

/** 줄 맨 앞의 섹션 태그. 삽입 위치를 찾는 용도로만 쓴다(개수 판정은 parseLyricsSections). */
const SECTION_TAG_AT_LINE_START = /^\[([^\]]+)\]/;

/**
 * 덧붙일 간주 섹션. 앞에서부터 필요한 만큼만 쓴다.
 *  - `head`는 첫 섹션 **앞**에 (빌드업 인트로)
 *  - `mid`는 마지막 섹션 **직전**에 — 브레이크다운·간주
 * 맨 뒤(아웃트로)는 쓰지 않는다: core/songPostProcess.ts가 후행
 * `[end]`/`[outro]` 태그를 의도적으로 제거하므로(그 파일의 자기 경고
 * 문구 참고) 거기 넣으면 그대로 사라진다 — 실측으로 확인했다.
 * 빌드업 인트로는 cold-open 곡(첫 절이 훅)과 부딪힐 수 있어 뒤로 뺀다.
 */
export const FILL_SECTIONS: Array<{ tag: string; place: 'head' | 'mid' }> = [
  { tag: '[instrumental break]', place: 'mid' },
  { tag: '[breakdown]', place: 'mid' },
  { tag: '[instrumental build]', place: 'mid' },
  { tag: '[build-up intro]', place: 'head' },
  { tag: '[instrumental interlude]', place: 'mid' },
  { tag: '[percussion break]', place: 'mid' }
];

/**
 * 섹션 수 판정은 core/lyricsAst.ts의 parseLyricsSections를 그대로 쓴다 —
 * core/quality.ts의 섹션 하한 검사가 쓰는 것과 **같은 함수**여야 "채웠는데
 * 여전히 경고가 나온다"가 생기지 않는다. 실제로 처음엔 자체 정규식을
 * 썼다가 `[verse 1: male vocal]` 같은 듀엣 태그를 보컬 지시 태그로 오인해
 * (`vocal$`) 섹션 수를 과소 집계했다.
 */
export function countLyricSections(lyrics: string): number {
  return parseLyricsSections(lyrics).length;
}

/**
 * 채우기 판정용 섹션 수 — **최종 산출물 기준**으로 센다.
 *
 * core/songPostProcess.ts가 후행 `[end]`/`[outro]` 태그를 의도적으로
 * 제거하므로("it does nothing in Suno and only inflates render length"),
 * 조립 직후의 가사에는 있고 최종 곡에는 없다. 그 차이를 무시하면 채우기가
 * 매번 정확히 1개씩 모자란다 — 실측으로 걸렸다(하한 9에 8섹션, 하한 11에
 * 10섹션이 일관되게 남았다).
 */
function countLyricSectionsAsRendered(lyrics: string): number {
  const sections = parseLyricsSections(lyrics);
  const last = sections[sections.length - 1];
  const lastTag = last ? last.rawTag.trim().toLowerCase() : '';
  return /^(end|outro)$/.test(lastTag) ? sections.length - 1 : sections.length;
}

/**
 * 이 곡의 BPM이 요구하는 하한에 못 미치면 간주 섹션을 덧붙여 채운다.
 * 95 BPM 이하이거나 이미 하한을 채웠으면 **입력을 그대로 돌려준다**
 * (기존 세트의 구조가 한 곡도 바뀌지 않는다 — 지시문 74 §8 "95 BPM 이하
 * 곡의 섹션 구조를 바꾸지 말 것").
 *
 * 가사 텍스트만 다룬다 — 보컬 섹션의 순서·내용·가사 줄은 한 글자도
 * 건드리지 않는다.
 */
export function fillInstrumentalSectionsForBpm(lyrics: string, bpm: number | undefined): string {
  const floor = minTotalSectionsForBpm(Number(bpm ?? 0));
  if (!floor) return lyrics;
  const current = countLyricSectionsAsRendered(lyrics);
  const missing = floor - current;
  if (missing <= 0) return lyrics;

  const lines = lyrics.split('\n');
  // 섹션 마커 줄의 인덱스(보컬 지시 태그 제외).
  const sectionLineIdx = lines
    .map((line, i) => ({ line: line.trim(), i }))
    .filter(({ line }) => SECTION_TAG_AT_LINE_START.test(line))
    .map(({ i }) => i);
  if (!sectionLineIdx.length) return lyrics;

  const chosen = FILL_SECTIONS.slice(0, Math.min(missing, FILL_SECTIONS.length));
  // 후보보다 더 필요하면 instrumental break를 번호를 붙여 반복한다 —
  // 같은 태그를 그대로 두 번 쓰면 Suno가 하나로 합쳐 읽는다.
  while (chosen.length < missing) {
    chosen.push({ tag: `[instrumental break ${chosen.length}]`, place: 'mid' });
  }

  const headInserts = chosen.filter(entry => entry.place === 'head').map(entry => entry.tag);
  const midInserts = chosen.filter(entry => entry.place === 'mid').map(entry => entry.tag);

  const firstSection = sectionLineIdx[0];
  const lastSection = sectionLineIdx[sectionLineIdx.length - 1];

  const out: string[] = [];
  lines.forEach((line, i) => {
    if (i === firstSection && headInserts.length) {
      for (const tag of headInserts) out.push(tag, '');
    }
    if (i === lastSection && midInserts.length) {
      for (const tag of midInserts) out.push(tag, '');
    }
    out.push(line);
  });
  return out.join('\n');
}

/**
 * 이 모듈이 덧붙인 간주 섹션인가. **구조 템플릿의 보컬 뼈대(6~8섹션)와
 * 이 채우기를 구분해야 하는 곳**이 쓴다 — 지시문 74 TASK A가
 * "sectionRangeForBpm(템플릿 보컬 뼈대 범위)은 값·경계 모두 그대로 둔다"고
 * 명시했듯, 여기서 덧붙는 섹션은 뼈대가 아니라 그 위에 얹히는 간주다.
 * 판정 목록을 두 곳에 두지 않기 위해 FILL_SECTIONS에서 직접 만든다.
 */
export function isInstrumentalFillTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (/^instrumental break \d+$/.test(normalized)) return true;
  return FILL_SECTIONS.some(entry => entry.tag.toLowerCase().replace(/^\[|\]$/g, '') === normalized);
}
