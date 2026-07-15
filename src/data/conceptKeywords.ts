/**
 * TASK H1 (v3.10) — local (no-API) keyword sceenario -> genre/mood/season
 * mapping for the concept agent (core/conceptAgent.ts). Every pattern list
 * covers Korean, English, and Japanese synonyms for the same everyday
 * scenario, since users describe songs in whichever language they think in.
 *
 * Weights point at genre/mood/season ids from src/data/presets.ts. A genre
 * id that isn't in the requesting channel's core tier for its archetype is
 * simply ignored at scoring time (see conceptAgent.ts) — these rules are
 * shared across archetypes on purpose, so a single rule set doesn't need a
 * per-archetype copy.
 */

export interface KeywordRule {
  id: string;
  patterns: RegExp[];
  genreWeights?: Record<string, number>;
  moodWeights?: Record<string, number>;
  seasonWeights?: Record<string, number>;
}

export const CONCEPT_KEYWORD_RULES: KeywordRule[] = [
  {
    id: 'winter',
    patterns: [/겨울/, /눈(?!치)/, /winter/i, /\bsnow/i, /冬/, /雪/],
    seasonWeights: { 'early-winter': 3, 'first-snow': 2, 'late-winter': 1 }
  },
  {
    id: 'christmas',
    patterns: [/크리스마스/, /성탄/, /christmas/i, /クリスマス/],
    seasonWeights: { christmas: 4 },
    genreWeights: { 'christmas-soft-pop': 2 }
  },
  {
    id: 'year-end',
    patterns: [/연말/, /한해가\s*저물/, /year[- ]?end/i, /年末/],
    seasonWeights: { 'year-end': 3 }
  },
  {
    id: 'autumn',
    patterns: [/가을/, /낙엽/, /단풍/, /쓸쓸/, /autumn/i, /\bfall\b/i, /秋/, /紅葉/],
    seasonWeights: { 'early-autumn': 2, 'maple-autumn': 3, 'autumn-rain': 1 },
    moodWeights: { bittersweet: 2 }
  },
  {
    id: 'spring',
    patterns: [/봄/, /벚꽃/, /spring/i, /cherry\s*blossom/i, /春/, /桜/],
    seasonWeights: { 'spring-open': 2, 'cherry-blossom': 3 },
    moodWeights: { hopeful: 1 }
  },
  {
    id: 'summer',
    patterns: [/여름/, /장마/, /summer/i, /rainy\s*season/i, /夏/, /梅雨/],
    seasonWeights: { 'summer-night': 2, 'rainy-season': 2 }
  },
  {
    id: 'new-year',
    patterns: [/새해/, /신년/, /new\s*year/i, /新年/],
    seasonWeights: { 'new-year': 3 }
  },
  {
    id: 'nostalgic-familiar',
    patterns: [
      /어디선가\s*들어본/, /들어본\s*적/, /익숙한/, /옛날\s*노래/, /그리(움|워)/, /보고\s*싶/, /옛\s*친구/,
      /heard\s*(it\s*)?before/i, /familiar/i, /nostalgi/i, /miss(ing)?\s*(you|someone)/i, /old\s*friend/i,
      /どこかで聞いた/, /聞き覚え/, /懐かし/, /会いたい/
    ],
    moodWeights: { nostalgic: 3, hopeful: 1 },
    genreWeights: { 'adult-contemporary': 2, 'retro-soul-pop': 1 }
  },
  {
    id: 'cafe',
    patterns: [/카페/, /커피/, /창가/, /찻집/, /\bcafe\b/i, /coffee/i, /window\s*seat/i, /カフェ/, /コーヒー/, /喫茶店/, /窓辺/],
    genreWeights: { 'lofi-cafe': 3, 'bossa-cafe': 2, 'jazz-pop': 1 }
  },
  {
    id: 'alone-drive-walk',
    patterns: [/혼자/, /운전/, /드라이브/, /산책/, /\balone\b/i, /driving/i, /\bdrive\b/i, /walk(ing)?/i, /一人/, /運転/, /ドライブ/, /散歩/],
    moodWeights: { 'calm-focus': 2, warm: 1 }
  },
  {
    id: 'comfort-healing',
    patterns: [
      /위로/, /힘들\s*때/, /지칠\s*때/, /토닥/, /괜찮다고/,
      /comfort/i, /when\s*(i'?m\s*)?tired/i, /hard\s*time/i, /healing/i,
      /癒し/, /疲れた/, /大丈夫/
    ],
    moodWeights: { warm: 2, bittersweet: 1 },
    genreWeights: { 'healing-ballad': 3, 'piano-ballad': 2 }
  },
  {
    id: 'bright-upbeat',
    patterns: [/밝은/, /경쾌한/, /기분\s*좋은/, /신나는/, /bright/i, /upbeat/i, /cheerful/i, /明るい/, /軽快/],
    moodWeights: { hopeful: 2, warm: 1 },
    genreWeights: { 'folk-pop': 2, 'acoustic-pop': 2, 'city-pop-soft': 1 }
  },
  {
    id: 'rain',
    patterns: [/비\s*오는/, /빗소리/, /rain(y)?/i, /雨/],
    seasonWeights: { 'rainy-season': 2, 'autumn-rain': 2 },
    moodWeights: { 'rainy-comfort': 3 }
  },
  {
    id: 'romantic',
    patterns: [/설레(는|임)/, /사랑/, /romantic/i, /love\s*song/i, /恋/, /愛/],
    moodWeights: { romantic: 3 }
  }
];

export function matchConceptRules(freeText: string): KeywordRule[] {
  const text = freeText.trim();
  if (!text) return [];
  return CONCEPT_KEYWORD_RULES.filter(rule => rule.patterns.some(pattern => pattern.test(text)));
}
