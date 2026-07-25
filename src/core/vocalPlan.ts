import type { GenerationOptions, LyricLanguage } from '../types';
import { shuffle } from './lyricEngine';

/**
 * TASK v3.38 Part B2 — per-song vocal-type quota for the 'kids' channel
 * archetype, mirroring core/moneyChordPlan.ts's activation pattern: only
 * ever engages for the 'kids' archetype (no other channel has a vocalQuota
 * concept), so every other channel's per-song vocal atom is completely
 * unaffected — see localGenerator.ts's wiring.
 */
export function usesVocalQuota(opts: Pick<GenerationOptions, 'channel'>): boolean {
  return opts.channel.archetype === 'kids';
}

export type VocalType = 'male' | 'female' | 'mixed';

export interface VocalQuota {
  male: number;
  female: number;
  mixed: number;
}

/** TASK v3.38 Part B2 — the 6/6/6-of-18 default; scaleVocalQuota below applies this as a ratio at any songCount, not a literal must-equal-18 requirement. */
export const DEFAULT_KIDS_VOCAL_QUOTA: VocalQuota = { male: 6, female: 6, mixed: 6 };

/** TASK v3.38 Part B (language follow-up) — the 3 lyricLanguages the kids channel supports. Any other LyricLanguage value (e.g. 'bilingual', which the kids channel UI doesn't offer) falls back to 'korean' via vocalDictionLanguage below. */
export type KidsVocalLanguage = 'korean' | 'japanese' | 'english';

/**
 * TASK v3.39 — real listening feedback: the pre-v3.39 wording ("young male
 * voice", "adult lead") consistently rendered as adult-sounding vocals, not
 * a children's channel identity. Suno tends to avoid literal "child singer"
 * requests, so these lean on childlike/youthful/kindergarten-age descriptors
 * instead of naming an age directly. Phrased positively (no "not an adult"
 * style negation, and no literal "adult" wording at all) since a generative
 * model is more reliable steered by what a voice IS than by what it isn't.
 */
const VOCAL_DESCRIPTIONS: Record<VocalType, string> = {
  male: 'bright childlike boy voice, playful and youthful, kindergarten-age tone',
  female: 'bright childlike girl voice, sweet and clear, kindergarten-age tone',
  mixed: "children's choir of childlike, youthful voices singing together, cheerful call-and-response group singalong"
};

/** TASK v3.38 Part B (language follow-up) — "언어별 보컬 묘사도 해당 언어 발음에 맞게 조정 (예: japanese -> clear Japanese diction, bright and friendly)"; appended to every vocal type's base description below. */
const VOCAL_DICTION_CLAUSE: Record<KidsVocalLanguage, string> = {
  korean: 'clear Korean diction, bright and friendly',
  japanese: 'clear Japanese diction, bright and friendly',
  english: 'clear English diction, bright and friendly'
};

export function vocalDictionLanguage(language: LyricLanguage): KidsVocalLanguage {
  if (language === 'japanese' || language === 'english') return language;
  return 'korean';
}

export function vocalDescriptionFor(type: VocalType, language: LyricLanguage = 'korean'): string {
  return `${VOCAL_DESCRIPTIONS[type]}, ${VOCAL_DICTION_CLAUSE[vocalDictionLanguage(language)]}`;
}

/**
 * TASK v3.39 Part H — a real showa-cafe channel selected a male vocal preset
 * but a Codex-bridge-generated song came back with a female vocal because
 * nothing in the pipeline actually enforced the choice (see
 * batchPreallocation.ts's reconcileWithPreassignedSlot for where this is
 * used). Word-boundary-only so "female" never false-positives as containing
 * "male", and "woman"/"women" are matched as their own words rather than via
 * a "man" substring for the same reason.
 */
export function detectVocalGender(text: string): 'male' | 'female' | null {
  const hasFemale = /\b(female|girl|woman|women)\b/i.test(text);
  const hasMale = /\b(male|boy|man|men)\b/i.test(text);
  if (hasFemale && !hasMale) return 'female';
  if (hasMale && !hasFemale) return 'male';
  return null;
}

/**
 * TASK v3.39 Part H — the decisive fix: rather than trust a remote model/
 * coding agent to weave "vocalText" into its stylePrompt correctly (the
 * verbatim instruction in claudeCodeBridge.ts/promptComposer.ts still asks
 * for that, but agent compliance isn't guaranteed), this forcibly corrects
 * the gender of the final stylePrompt whenever it's detectably wrong or
 * missing. A no-op when vocalText has no detectable gender (e.g. a children's
 * choir/mixed description) — there's nothing to enforce in that case.
 */
export function enforceVocalTextInStylePrompt(stylePrompt: string, vocalText: string | undefined): { text: string; changed: boolean } {
  if (!vocalText) return { text: stylePrompt, changed: false };
  const target = detectVocalGender(vocalText);
  if (!target) return { text: stylePrompt, changed: false };
  if (detectVocalGender(stylePrompt) === target) return { text: stylePrompt, changed: false };

  const opposite = target === 'male' ? '(?:female|girl|woman|women)' : '(?:male|boy|man|men)';
  const cleaned = stylePrompt
    .replace(new RegExp(`\\b${opposite}\\b`, 'gi'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^[,\s]+/, '')
    .replace(/,\s*$/, '')
    .trim();
  const text = cleaned ? `${vocalText}, ${cleaned}` : vocalText;
  return { text, changed: true };
}

/**
 * TASK v3.39 Part H — the strongest lever Suno actually reads for vocal
 * gender is a lyric meta tag, not prose in the style field (see the H spec's
 * "가사 메타 태그 부재" finding: 0 uses of [male vocal]-style tags in real
 * output). Returns null when there's nothing enforceable to tag (mixed/
 * unspecified gender outside the kids choir case).
 */
export function resolveVocalMetaTag(vocalType: VocalType | undefined, vocalText: string | undefined): string | null {
  if (vocalType === 'mixed') return "[children's choir]";
  if (vocalType === 'male') return '[male vocal]';
  if (vocalType === 'female') return '[female vocal]';
  const gender = vocalText ? detectVocalGender(vocalText) : null;
  return gender === 'male' ? '[male vocal]' : gender === 'female' ? '[female vocal]' : null;
}

const VOCAL_META_TAG_PATTERN = /^\s*\[(male vocal|female vocal|children'?s choir)\]/i;

/** Prepends `tag` to `lyrics` unless a vocal meta tag is already present at the top (never double-tags). */
export function ensureVocalMetaTag(lyrics: string, tag: string | null): string {
  if (!tag || VOCAL_META_TAG_PATTERN.test(lyrics)) return lyrics;
  return `${tag}\n${lyrics}`;
}

const VOCAL_TYPES: VocalType[] = ['male', 'female', 'mixed'];

/**
 * TASK v3.38 Part B2 — scales the quota's proportions to the actual
 * songCount (largest-remainder method, so the three counts always sum to
 * exactly songCount even when songCount isn't a multiple of the quota's
 * total). This is what makes "쿼터는 UI에서 조정 가능(18곡 외 다른 곡수에도
 * 비율 적용)" work: a 6/6/6 quota at songCount=9 becomes 3/3/3, not a
 * literal slice of the 18-song default.
 */
export function scaleVocalQuota(quota: VocalQuota, songCount: number): VocalQuota {
  const total = quota.male + quota.female + quota.mixed;
  if (total <= 0 || songCount <= 0) return { male: 0, female: 0, mixed: Math.max(0, songCount) };

  const raw: Record<VocalType, number> = {
    male: (quota.male / total) * songCount,
    female: (quota.female / total) * songCount,
    mixed: (quota.mixed / total) * songCount
  };
  const floors: Record<VocalType, number> = {
    male: Math.floor(raw.male),
    female: Math.floor(raw.female),
    mixed: Math.floor(raw.mixed)
  };
  let remainder = songCount - (floors.male + floors.female + floors.mixed);
  const byRemainderDesc = VOCAL_TYPES.slice().sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));

  const result = { ...floors };
  let i = 0;
  while (remainder > 0) {
    result[byRemainderDesc[i % byRemainderDesc.length]] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

/**
 * TASK v3.38 Part B2 — deterministic (seeded) per-trackNo vocal-type plan.
 * Builds a flat pool from the scaled quota, shuffles it, then repairs any
 * run of 4+ consecutive same-type entries by swapping forward to the next
 * differing type (or, failing that, backward past the run) — "같은 타입 4곡
 * 연속 금지" from the spec.
 */
export function buildVocalPlan(quota: VocalQuota, songCount: number, seed: number): VocalType[] {
  const counts = scaleVocalQuota(quota, songCount);
  const pool: VocalType[] = [
    ...Array<VocalType>(counts.male).fill('male'),
    ...Array<VocalType>(counts.female).fill('female'),
    ...Array<VocalType>(counts.mixed).fill('mixed')
  ];
  const plan = shuffle(pool, seed);

  for (let i = 3; i < plan.length; i++) {
    const runsFour = plan[i] === plan[i - 1] && plan[i] === plan[i - 2] && plan[i] === plan[i - 3];
    if (!runsFour) continue;
    let swapIndex = -1;
    for (let j = i + 1; j < plan.length; j++) {
      if (plan[j] !== plan[i]) { swapIndex = j; break; }
    }
    if (swapIndex === -1) {
      for (let j = 0; j < i - 3; j++) {
        if (plan[j] !== plan[i]) { swapIndex = j; break; }
      }
    }
    if (swapIndex !== -1) {
      const tmp = plan[i];
      plan[i] = plan[swapIndex];
      plan[swapIndex] = tmp;
    }
  }
  return plan;
}
