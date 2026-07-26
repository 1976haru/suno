const ARTIST_OR_IMITATION_PATTERN = /\b(in the style of|sounds like|sound like|as sung by|voice like|clone of|copy of|cover of|similar to|like adele|like beyonce|like bruno mars|like taylor swift|like the weeknd|like yoasobi|like utada)\b|\b(adele|beyonce|bts|bruno mars|ed sheeran|iu|newjeans|queen|taylor swift|the beatles|the weeknd|utada|yoasobi|ado)\b|아이유|뉴진스|방탄|요아소비|우타다|아도|비틀즈|테일러\s*스위프트|위켄드/i;

const MOOD_MAPPINGS: Array<[RegExp, string]> = [
  [/비|rain/i, 'rainy atmosphere'],
  [/새벽|dawn|predawn/i, 'predawn quiet'],
  [/밤|야간|night|midnight/i, 'late-night mood'],
  [/드라이브|drive/i, 'night-drive motion'],
  [/도시|시티|city|urban/i, 'urban neon color'],
  [/나른|느슨|laid[- ]?back|lazy/i, 'laid-back phrasing'],
  [/몽환|dream/i, 'dreamy spacious pads'],
  [/우울|쓸쓸|melancholy|sad/i, 'restrained melancholy'],
  [/청량|상쾌|fresh/i, 'fresh bright air'],
  [/여성|여자|female/i, 'soft female vocal color'],
  [/남성|남자|male/i, 'mellow male vocal color'],
  [/속삭|whisper/i, 'whisper-close vocal intimacy'],
  [/로파이|lofi|lo-fi/i, 'soft lo-fi grain'],
  [/알앤비|r&b|rnb/i, 'smooth R&B pocket'],
  [/랩|rap/i, 'relaxed rap flow'],
  [/시티팝|city\s*pop/i, 'modern city-pop gloss'],
  [/디스코|disco/i, 'bright disco-pop lift'],
  [/그루브|groove/i, 'steady pocket groove']
];

function normalizeInput(input: string | undefined | null): string {
  return (input || '').replace(/\s+/g, ' ').trim();
}

export function referenceMoodSafetyIssues(input: string | undefined | null): string[] {
  const text = normalizeInput(input);
  if (!text) return [];
  return ARTIST_OR_IMITATION_PATTERN.test(text)
    ? ['Reference mood cannot include artist names, song names, soundalike wording, or imitation requests.']
    : [];
}

export function buildReferenceMoodStyleClause(input: string | undefined | null): string | undefined {
  const text = normalizeInput(input);
  if (!text || referenceMoodSafetyIssues(text).length) return undefined;

  const clauses: string[] = [];
  for (const [pattern, clause] of MOOD_MAPPINGS) {
    if (pattern.test(text) && !clauses.includes(clause)) clauses.push(clause);
  }

  const fallback = /^[\x00-\x7F]+$/.test(text)
    ? text.replace(/[;{}[\]"`]/g, '').slice(0, 120)
    : 'user-described contemporary mood';
  const body = clauses.length ? clauses.slice(0, 5).join(', ') : fallback;
  return `reference mood translated from user input: ${body}`;
}
