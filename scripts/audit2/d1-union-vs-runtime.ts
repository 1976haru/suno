/** 타입 union을 손으로 복제한 런타임 화이트리스트 전수 대조 (감사 전용 · 읽기만 한다) */
import * as fs from 'fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const quoted = (s: string) => [...s.matchAll(/'([^']+)'/g)].map(m => m[1]);

function unionOf(file: string, name: string): string[] | null {
  const t = read(file);
  const m = t.match(new RegExp(`export type ${name}\\s*=\\s*([^;]+);`));
  return m ? quoted(m[1]) : null;
}

function listOf(file: string, name: string): string[] | null {
  const t = read(file);
  const i = t.indexOf(`const ${name}`);
  if (i < 0) return null;
  const eq = t.indexOf('=', i);
  const open = t.indexOf('[', eq);
  const close = t.indexOf(']', open);
  if (open < 0 || close < 0) return null;
  return quoted(t.slice(open, close));
}

const T = 'src/types.ts';
const CASES: Array<[string, string, string, string]> = [
  ['Market', T, 'VALID_MARKETS', 'src/utils/channelProfile.ts'],
  ['LyricLanguage', T, 'VALID_LYRIC_LANGUAGES', 'src/utils/channelProfile.ts'],
  ['LyricLanguage', T, 'VALID_LYRIC_LANGUAGES', 'src/core/bridgeImport.ts'],
  ['LyricLanguage', T, 'VALID_LYRIC_LANGUAGES', 'src/core/historyBackfill.ts'],
  ['AgeGroup', T, 'VALID_AGE_GROUPS', 'src/utils/channelProfile.ts'],
  ['ChannelArchetype', T, 'VALID_ARCHETYPES', 'src/utils/channelProfile.ts'],
  ['KidsAgeTierId', T, 'VALID_KIDS_AGE_TIER_IDS', 'src/utils/channelProfile.ts'],
  ['SongRating', 'src/core/ratingLedger.ts', 'VALID_RATINGS', 'src/core/viewerRatingsImport.ts'],
];

let bad = 0;
for (const [typeName, typeFile, constName, constFile] of CASES) {
  const u = unionOf(typeFile, typeName);
  const l = listOf(constFile, constName);
  if (!u || !l) { console.log(`? ${typeName} / ${constName}@${constFile} — 파싱 실패 (union=${!!u}, list=${!!l})`); bad++; continue; }
  const missing = u.filter(x => !l.includes(x));
  const extra = l.filter(x => !u.includes(x));
  const ok = !missing.length && !extra.length;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'XX '} ${typeName}(${u.length}) vs ${constName}@${constFile}(${l.length})${ok ? '' : `  union에만=[${missing.join(',')}]  런타임에만=[${extra.join(',')}]`}`);
}
console.log(`\n문제 ${bad}건`);
