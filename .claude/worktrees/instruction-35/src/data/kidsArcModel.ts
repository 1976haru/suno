/**
 * DEPRECATED / UNUSED — verified via full-repo grep on 2026-08-06: zero
 * real imports of any export from this file anywhere in src/ or tests/
 * (the only hits for `KidsArcZone`/`KIDS_ARC_ZONES`/`ARC_MODEL_KIDS_ID`/
 * `KIDS_ARC_MODEL`/`kidsArcZoneDefinition` are this file itself, docs/
 * d2-report.md, and core/arcModels.ts's own doc comment describing —
 * not consuming — this file). No test file exists for it either
 * (no tests/kidsArcModel.test.ts or equivalent), so there is nothing
 * currently depending on or exercising this code.
 *
 * It was superseded by core/arcModels.ts's buildRepetitionCyclePlan
 * (v5.11), which is the real, wired-in builder for the 'repetition-cycle'
 * ArcModelId this file's own original comment below was angling toward.
 * The two are NOT the same shape — arcModels.ts groups an 18-song pack
 * into 4-5 named bundles (familiar/learning/moving/calm/closing) sized by
 * age tier, whereas this file defines 5 fixed zones (activate/learn/play/
 * settle/sleep) with per-zone intensity ranges — but they address the same
 * underlying gap (a kids-appropriate replacement for the adult five-phase
 * opening/rising/peak/easing/closing curve), and arcModels.ts's own top
 * comment already flags this file as "a separate, still-fully-unwired
 * candidate from an earlier task... a future task can decide whether to
 * merge or retire kidsArcModel.ts." This comment is that flag, restated
 * here for anyone landing on this file directly instead of arcModels.ts.
 *
 * Removal plan (not executed here — deletion is a human call, not this
 * task's): safe to delete once a maintainer re-confirms zero real call
 * sites (repeat the grep above) and decides arcModels.ts's bundle model
 * fully covers what this file was for. If a future task instead wants
 * this file's specific activate/learn/play/settle/sleep zone shape (e.g.
 * as a genuinely orthogonal SONG-INTERNAL energy arc, distinct from
 * arcModels.ts's pack-level bundling), wire it in explicitly and remove
 * this deprecation notice rather than leaving both an unwired "maybe
 * someday" file and a wired one describing the same problem space.
 *
 * --- Original TASK D2 §7 comment below, kept for context ---
 *
 * TASK D2 §7 — an alternative, kids-specific arc model, defined as DATA
 * ONLY and not wired into generation anywhere (§7-2: "결정 전까지는 모델
 * 정의만 만들고 배선하지 마십시오" — core/arcPlan.ts, which every archetype
 * including kids currently shares, is completely untouched by this file).
 *
 * §0-2 measured kids songs using the exact same 5-phase EMOTIONAL arc as
 * senior-oldpop (opening/rising/peak/easing/closing, intensity 1-5) — a
 * narrative arc that assumes a listener hears all 18 songs in sequence.
 * §7-2 raises whether a kids playlist is actually consumed that way, or
 * picked by situation instead (율동 시간/잠들기 전/식사 중) — in which case
 * FUNCTIONAL zones fit the research material's own genre breakdown
 * (율동송/교육송/역할놀이/수면 동요) better than an emotional narrative does.
 *
 * D2's own recommendation is to REPLACE the emotional arc with this model
 * for kids workspaces — see docs/d2-report.md §11-4[A] for the decision
 * this was put to the user as (kept vs replaced). Either way, wiring an
 * arcModelId branch into arcPlan.ts is A3's job (§2-2), not D2's.
 */
export type KidsArcZone = 'activate' | 'learn' | 'play' | 'settle' | 'sleep';

export const KIDS_ARC_ZONES: KidsArcZone[] = ['activate', 'learn', 'play', 'settle', 'sleep'];

export const ARC_MODEL_KIDS_ID = 'ARC-MODEL-kids';

export interface KidsArcZoneDefinition {
  zone: KidsArcZone;
  labelKo: string;
  /** §7-3 — narrower than senior's 1-5: "급격한 다이내믹 금지" means kids intensity shouldn't swing the full range. `sleep` is the one explicit exception allowed down to 1. */
  intensityRange: [number, number];
}

export const KIDS_ARC_MODEL: { id: string; zones: KidsArcZoneDefinition[] } = {
  id: ARC_MODEL_KIDS_ID,
  zones: [
    { zone: 'activate', labelKo: '율동·점프 — 높은 에너지', intensityRange: [3, 4] },
    { zone: 'learn', labelKo: '숫자·색깔·생활습관 — 중간', intensityRange: [2, 3] },
    { zone: 'play', labelKo: '역할놀이·이야기 — 중간', intensityRange: [2, 3] },
    { zone: 'settle', labelKo: '진정 — 낮음', intensityRange: [2, 2] },
    // §7-3's explicit exception — every other zone stays within the 2-4 "no abrupt dynamics" band.
    { zone: 'sleep', labelKo: '자장가 — 가장 낮음 (예외적으로 1 허용)', intensityRange: [1, 2] }
  ]
};

export function kidsArcZoneDefinition(zone: KidsArcZone): KidsArcZoneDefinition {
  const found = KIDS_ARC_MODEL.zones.find(z => z.zone === zone);
  if (!found) throw new Error(`unknown kids arc zone: ${zone}`);
  return found;
}
