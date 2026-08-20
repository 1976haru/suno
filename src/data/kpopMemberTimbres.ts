import type { KpopMemberSlot, KpopPartRole } from '../types';

/**
 * 지시문 52 (TASK A-2) — 하루: "부르는 사람들이 다 다른 음색·창법으로
 * 부르잖아. 그런 다양성을 원하는 거야." core/kpopPartPlan.ts's buildRoster가
 * 만드는 멤버 로스터는 memberId·role·gender만 있고 음색이 없었다(지시문
 * 37이 만든 구조, §1-1 실측). 이 파일은 그 role별로 "이 멤버가 어떻게
 * 부르는가"를 고른다 — 26종 보컬 프리셋(곡 전체 톤, data/vocalPresets.ts)
 * 과는 다른 층이다. 여기서 고른 timbreId는 그 안에서 "곡 안 멤버 간 대비"
 * 만 표현한다.
 *
 * 지시문 52 (TASK D 판단) — 지시문 35(멈블 랩 채널)는 이 코드베이스 어디에도
 * 실제 데이터 파일로 존재하지 않는다(rap-* 장르 0종, `data/rapVocalDelivery.ts`
 * 미생성 — core/bridgeInstruction.ts 1582줄의 언급은 존재하지 않는 파일을
 * 가리키는 죽은 참조였다). 지시문 35 자체(새 랩 채널/워크스페이스 신설)는
 * "다른 워크스페이스에 멤버 음색을 적용하지 말 것"(§하지 말 것)과 이
 * 지시문의 적용 범위(kr-idol-male·kr-idol-female) 밖이므로 넣지 않는다.
 * 대신 main-rapper/lead-rapper 후보에 랩 딜리버리 어휘(트리플렛 플로우·
 * 낮고 거친 플로우 등, §A-2/§B-2가 요구하는 최소 어휘)를 이 파일 안에 직접
 * 둔다 — kr-idol 전용 최소 구현. TASK B-2("main-rapper와 lead-rapper가
 * 같은 곡에 있으면 서로 다른 플로우를 쓴다")가 바로 이 role별 분리로
 * 충족된다 — 별도 랩 스타일 데이터를 새로 만들지 않는다.
 */
export interface KpopMemberTimbre {
  id: string;
  /** 영어 음색/창법 묘사 — lyric tag·stylePrompt에 그대로 얹힌다. */
  text: string;
}

const MAIN_VOCAL_TIMBRES: KpopMemberTimbre[] = [
  { id: 'power-belt', text: 'powerful belting, thick chest voice, wide open vibrato' },
  { id: 'thick-chest', text: 'thick chest-voice tone, driving lower-mid weight' },
  { id: 'wide-vibrato', text: 'broad expressive vibrato, sustained high-note control' },
  { id: 'stable-soft', text: 'stable soft-grain tenor, smooth even delivery' },
  { id: 'restrained-high', text: 'restrained high register, controlled head-tone shimmer' }
];

const LEAD_VOCAL_TIMBRES: KpopMemberTimbre[] = [
  { id: 'clear-thin', text: 'clear thin tone, bright forward projection' },
  { id: 'bright-head', text: 'bright head-voice lift, airy upper register' },
  { id: 'light-falsetto', text: 'light falsetto lean, delicate breath-edge' }
];

const SUB_VOCAL_TIMBRES: KpopMemberTimbre[] = [
  { id: 'soft-mid', text: 'soft midrange warmth, gentle rounded tone' },
  { id: 'breathy', text: 'breathy textured tone, close intimate mic presence' },
  { id: 'warm-low', text: 'warm low register, mellow husky undertone' }
];

/** §B-2 "main-rapper는 낮고 거친 플로우·강한 어택". */
const MAIN_RAPPER_TIMBRES: KpopMemberTimbre[] = [
  { id: 'low-gritty-flow', text: 'low gritty rap flow, rough rasped edge' },
  { id: 'heavy-bass-attack', text: 'heavy bass-register attack, blunt percussive delivery' },
  { id: 'strong-attack', text: 'strong hard-attack cadence, clipped consonant emphasis' }
];

/** §B-2 "lead-rapper는 빠른 트리플렛·높은 톤 랩". */
const LEAD_RAPPER_TIMBRES: KpopMemberTimbre[] = [
  { id: 'fast-triplet', text: 'fast triplet flow, tight rhythmic bounce' },
  { id: 'rhythmic-delivery', text: 'syncopated rhythmic delivery, playful pocket timing' },
  { id: 'high-tone-rap', text: 'high-toned rap lean, bright nasal edge' }
];

const AD_LIB_TIMBRES: KpopMemberTimbre[] = [
  { id: 'high-adlib', text: 'high ad-lib runs, sparkling upper-register punctuation' },
  { id: 'scat', text: 'scat-style vocal runs, loose rhythmic syllables' },
  { id: 'backing-stack', text: 'layered backing-stack harmony, blended supportive texture' }
];

export const KPOP_MEMBER_TIMBRES_BY_ROLE: Partial<Record<KpopPartRole, KpopMemberTimbre[]>> = {
  'main-vocal': MAIN_VOCAL_TIMBRES,
  'lead-vocal': LEAD_VOCAL_TIMBRES,
  'sub-vocal': SUB_VOCAL_TIMBRES,
  'main-rapper': MAIN_RAPPER_TIMBRES,
  'lead-rapper': LEAD_RAPPER_TIMBRES,
  'ad-lib': AD_LIB_TIMBRES
};

const ALL_KPOP_MEMBER_TIMBRES: KpopMemberTimbre[] = [
  ...MAIN_VOCAL_TIMBRES, ...LEAD_VOCAL_TIMBRES, ...SUB_VOCAL_TIMBRES,
  ...MAIN_RAPPER_TIMBRES, ...LEAD_RAPPER_TIMBRES, ...AD_LIB_TIMBRES
];

/**
 * 지시문 52 (TASK A-3) — "멤버 4~6명의 timbreId가 서로 달라야 한다... 같은
 * 역할이 두 명이면(예: duet 게스트) 그 역할 후보 안에서 다른 음색을 고른다."
 * role별 후보에서 우선 고르고, 그 role의 후보가 이미 이 곡에서 소진됐으면
 * (예: memberCount=7일 때 sub-vocal 3명) 전체 팔레트에서 아직 안 쓰인
 * 것으로 넘어간다 — 멤버 수(최대 7)가 전체 팔레트(20종)보다 항상 작으므로
 * 실패하지 않는다.
 */
export function assignMemberTimbres(roster: KpopMemberSlot[], rng: () => number): void {
  const used = new Set<string>();
  for (const member of roster) {
    const roleCandidates = (KPOP_MEMBER_TIMBRES_BY_ROLE[member.role] ?? ALL_KPOP_MEMBER_TIMBRES).filter(t => !used.has(t.id));
    const pool = roleCandidates.length > 0 ? roleCandidates : ALL_KPOP_MEMBER_TIMBRES.filter(t => !used.has(t.id));
    const candidates = pool.length > 0 ? pool : ALL_KPOP_MEMBER_TIMBRES;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    member.timbreId = pick.id;
    member.timbreText = pick.text;
    used.add(pick.id);
  }
}
