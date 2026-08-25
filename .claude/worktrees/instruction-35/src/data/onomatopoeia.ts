/**
 * TASK F1 §5 — the workspace's own core deliverable: a dedicated
 * onomatopoeia/mimetic-word (擬音語・擬態語) data structure. §0-2 measured
 * jp-kids-song's 18-song baseline had 0/18 titles carrying any of the
 * research material's 12 example onomatopoeia — this file is what E1's
 * educationConcept is for kr-kids (§4-3: deliberately NOT reused here,
 * onomatopoeia is jp-kids's own axis).
 *
 * §5-3 — the research material's 12 examples are a starting point, not the
 * full set: 18 songs sharing only 12 words would repeat constantly. Built
 * 26 (exceeds the ≥24 floor), 6-8 per category (exceeds the ≥4 floor),
 * strictly within the 4 categories the doc names (motion/eat/vehicle/
 * emotion) — no 5th category added, per §12 item 6's explicit prohibition.
 */
import type { KidsAgeTierId } from './kidsVocabularyWhitelist';

export type OnomatopoeiaCategory = 'motion' | 'eat' | 'vehicle' | 'emotion';

export interface OnomatopoeiaEntry {
  id: string;
  word: string;
  category: OnomatopoeiaCategory;
  /** Korean explanation for 하루 — never surfaces in generated output. */
  motionKo: string;
  /** English description that DOES surface, in the style prompt (§5-5 — never the raw Japanese word itself). */
  motionEn: string;
  ageTiers: KidsAgeTierId[];
  /** 手遊び body-movement cue, connects to D2's KidsMotionCueRule positions. Optional — only set where a concrete physical gesture applies. */
  bodyMovement?: string;
}

const ALL_TIERS: KidsAgeTierId[] = ['kids-t1', 'kids-t2', 'kids-t3'];

export const ONOMATOPOEIA_ENTRIES: OnomatopoeiaEntry[] = [
  // ===== motion (8) =====
  { id: 'motion-jump', word: 'ぴょんぴょん', category: 'motion', motionKo: '뛰기', motionEn: 'playful jumping-motion rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'both hands hop up and down like little jumps' },
  { id: 'motion-spin', word: 'くるくる', category: 'motion', motionKo: '돌기', motionEn: 'gentle spinning-motion rhythm cue', ageTiers: ['kids-t2', 'kids-t3'], bodyMovement: 'one finger traces a small circle in the air' },
  { id: 'motion-clap', word: 'ぱちぱち', category: 'motion', motionKo: '박수', motionEn: 'light clapping rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'two light claps on the beat' },
  { id: 'motion-scrub', word: 'ごしごし', category: 'motion', motionKo: '문지르기', motionEn: 'scrubbing-motion rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'both palms rub together side to side' },
  { id: 'motion-wipe', word: 'しゅっしゅっ', category: 'motion', motionKo: '닦기', motionEn: 'wiping-motion rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'one hand wipes side to side in the air' },
  { id: 'motion-wave', word: 'ふりふり', category: 'motion', motionKo: '흔들기', motionEn: 'gentle waving-motion rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'fingers wiggle and wave at chest height' },
  { id: 'motion-stomp', word: 'どんどん', category: 'motion', motionKo: '발구르기', motionEn: 'light stomping-motion rhythm cue', ageTiers: ['kids-t2', 'kids-t3'], bodyMovement: 'both feet stomp softly in place' },
  { id: 'motion-tiptoe', word: 'そろそろ', category: 'motion', motionKo: '살금살금 걷기', motionEn: 'soft tiptoeing-motion rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'fingers "tiptoe" softly across the other palm' },

  // ===== eat (6) =====
  { id: 'eat-chew', word: 'もぐもぐ', category: 'eat', motionKo: '씹기', motionEn: 'playful chewing-motion rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'cheeks puff gently like chewing' },
  { id: 'eat-bite', word: 'ぱくぱく', category: 'eat', motionKo: '베어 물기', motionEn: 'playful biting-motion rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'both hands open and close like a mouth' },
  { id: 'eat-slurp', word: 'ずるずる', category: 'eat', motionKo: '후루룩 먹기', motionEn: 'playful slurping-motion rhythm cue', ageTiers: ['kids-t2', 'kids-t3'] },
  { id: 'eat-crunch', word: 'ぽりぽり', category: 'eat', motionKo: '아삭아삭 먹기', motionEn: 'light crunching-motion rhythm cue', ageTiers: ['kids-t2', 'kids-t3'] },
  { id: 'eat-lick', word: 'ぺろぺろ', category: 'eat', motionKo: '핥기', motionEn: 'playful licking-motion rhythm cue', ageTiers: ALL_TIERS },
  { id: 'eat-sizzle', word: 'じゅうじゅう', category: 'eat', motionKo: '지글지글 굽기', motionEn: 'cheerful sizzling-cooking rhythm cue', ageTiers: ['kids-t2', 'kids-t3'] },

  // ===== vehicle (6) =====
  { id: 'vehicle-car', word: 'ぶーぶー', category: 'vehicle', motionKo: '자동차', motionEn: 'playful car-engine rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'both hands mime holding a steering wheel' },
  { id: 'vehicle-train', word: 'がたんごとん', category: 'vehicle', motionKo: '기차', motionEn: 'playful train-clatter rhythm cue', ageTiers: ALL_TIERS, bodyMovement: 'arms pump gently like a train’s wheels' },
  { id: 'vehicle-bus', word: 'ぶんぶん', category: 'vehicle', motionKo: '붕붕 달리기', motionEn: 'cheerful buzzing-drive rhythm cue', ageTiers: ALL_TIERS },
  { id: 'vehicle-boat', word: 'ぷかぷか', category: 'vehicle', motionKo: '둥실둥실 뜨기', motionEn: 'gentle floating-boat rhythm cue', ageTiers: ALL_TIERS },
  { id: 'vehicle-plane', word: 'ぶーん', category: 'vehicle', motionKo: '비행기', motionEn: 'soft airplane-flying rhythm cue', ageTiers: ['kids-t2', 'kids-t3'], bodyMovement: 'both arms stretch out like wings' },
  { id: 'vehicle-bike', word: 'しゅーしゅー', category: 'vehicle', motionKo: '자전거', motionEn: 'light bicycle-gliding rhythm cue', ageTiers: ['kids-t2', 'kids-t3'] },

  // ===== emotion (6) — §5-2's own caution: どきどき is T3-only and positive-context only. =====
  { id: 'emotion-excited', word: 'わくわく', category: 'emotion', motionKo: '설렘', motionEn: 'bright excited-anticipation mood cue', ageTiers: ['kids-t2', 'kids-t3'] },
  { id: 'emotion-nervous', word: 'どきどき', category: 'emotion', motionKo: '두근거림', motionEn: 'gentle happy-heartbeat mood cue', ageTiers: ['kids-t3'] },
  { id: 'emotion-smile', word: 'にこにこ', category: 'emotion', motionKo: '미소', motionEn: 'warm smiling mood cue', ageTiers: ALL_TIERS, bodyMovement: 'both hands frame a big smile' },
  { id: 'emotion-happy', word: 'るんるん', category: 'emotion', motionKo: '신나는 발걸음', motionEn: 'light skipping-happiness mood cue', ageTiers: ALL_TIERS },
  { id: 'emotion-sleepy', word: 'すやすや', category: 'emotion', motionKo: '새근새근 잠들기', motionEn: 'soft peaceful-sleep mood cue', ageTiers: ALL_TIERS },
  { id: 'emotion-proud', word: 'えへん', category: 'emotion', motionKo: '으쓱하기', motionEn: 'playful proud-puff mood cue', ageTiers: ['kids-t2', 'kids-t3'] }
];

export function onomatopoeiaById(id: string): OnomatopoeiaEntry | undefined {
  return ONOMATOPOEIA_ENTRIES.find(entry => entry.id === id);
}

export function onomatopoeiaForCategory(category: OnomatopoeiaCategory): OnomatopoeiaEntry[] {
  return ONOMATOPOEIA_ENTRIES.filter(entry => entry.category === category);
}

export function onomatopoeiaForTier(tierId: KidsAgeTierId): OnomatopoeiaEntry[] {
  return ONOMATOPOEIA_ENTRIES.filter(entry => entry.ageTiers.includes(tierId));
}

/**
 * TASK F1 §5-4 — title-hook patterns, so the doc's own かにダンス /
 * たこやきなんぼマンボ / ブンブンにじいろカー examples become measurable
 * choices instead of prose. Used by hookBanks/jpKids.ts to keep the 3
 * patterns roughly balanced across an 18-song set (§10 item 20: no pattern
 * over 12/18).
 */
export type JpKidsTitlePattern = 'onomatopoeia-object' | 'object-motion' | 'object-onomatopoeia-rhythm';
