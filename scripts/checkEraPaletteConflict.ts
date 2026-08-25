/**
 * 지시문 74 (TASK B-2) — 팔레트↔exclude 모순 전수 대조.
 *
 * 실측 근거(§2.2): `canon-showa-kayokyoku`가 시대 고유 악기로 지정한
 * `clavinet`·`wah electric guitar`가, 같은 워크스페이스에서 생성된 곡의
 * exclude 텍스트에 "funk clavinet groove"·"wah guitar accents"로 들어가
 * 정면으로 충돌했다. 팔레트가 뽑아도 exclude가 지우므로 그 팔레트의 실질
 * 원자 풀은 11개가 아니라 9개였다.
 *
 * 이 스크립트는 data/eraCanonPalettes.ts의 각 팔레트 원자를, 그 팔레트가
 * 담당하는(fitsGenreIds) 장르마다 아래 네 곳의 배제 어휘와 대조한다.
 *   1. data/eraExclusions.ts — ERA_FORBIDDEN_DESCRIPTORS[그 장르의 시대]
 *   2. genreLibrary — 그 장르 자신의 avoidTraits
 *   3. data/genreForbiddenDescriptors.ts — 그 장르에 걸린 forbiddenPhrases
 *   4. data/channelSoundFloor.ts — 그 장르를 소유한 워크스페이스의 forbiddenAtoms
 *
 * 정적 표만으로는 §2.2가 지목한 그 쌍을 잡을 수 없다는 것이 이 검사의 첫
 * 실측 결과다: clavinet/wah를 금지한 "funk clavinet groove"·"wah guitar
 * accents"는 위 네 곳 어디에도 없고, 브릿지 에이전트가 곡을 쓸 때 직접
 * 작성한 excludePrompt 문구다(지시문의 excludePrompt 규약이 요구하는
 * "이 곡 자신의 장르/편곡 고유 위험" 항목). 그래서 --pack 모드를 함께
 * 둔다 — 실제 산출물의 excludePrompt를 그 곡의 팔레트 원자와 대조한다.
 *
 * advisory 전용이다 — 항상 exit 0. 생성을 차단하지 않는다(§8 "새 검사로
 * 생성을 차단하지 말 것"). 판단이 애매한 쌍은 스스로 고치지 않고 그대로
 * 출력만 한다(§2.4-B2 "판단이 애매한 쌍은 건드리지 말고 보고할 것").
 *
 * Usage:
 *   npx tsx scripts/checkEraPaletteConflict.ts [--json]
 *   npx tsx scripts/checkEraPaletteConflict.ts --pack <path-to-pack.json> [--json]
 */
import { ERA_CANON_PALETTES, type EraCanonPalette } from '../src/data/eraCanonPalettes';
import { ERA_FORBIDDEN_DESCRIPTORS, eraBucketForGenreId } from '../src/data/eraExclusions';
import { GENRE_FORBIDDEN_DESCRIPTORS } from '../src/data/genreForbiddenDescriptors';
import { CHANNEL_SOUND_FLOORS } from '../src/data/channelSoundFloor';
import { allowedWorkspacesForGenre } from '../src/data/genreWorkspaceOwnership';
import { getGenreById } from '../src/data/genreLibrary';
import { eraCanonPalettesForGenreId, partialPaletteForGenreId } from '../src/data/eraCanonPalettes';
import * as fs from 'node:fs';

type PaletteAtomField = 'instrumentation' | 'harmonyTraits' | 'vocalTraits' | 'productionTraits';
const ATOM_FIELDS: PaletteAtomField[] = ['instrumentation', 'harmonyTraits', 'vocalTraits', 'productionTraits'];

interface Conflict {
  paletteId: string;
  field: PaletteAtomField;
  atom: string;
  genreId: string;
  source: string;
  excludePhrase: string;
  /** 'contains' = exclude 문구가 팔레트 원자를 통째로 품고 있다(가장 확실한 모순). 'inside' = 팔레트 원자가 exclude 문구를 품고 있다. */
  direction: 'contains' | 'inside';
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** 토큰 경계를 지켜 부분 문자열을 찾는다 — 'bass'가 'bassoon'에 걸리지 않게. */
function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const h = ` ${normalize(haystack)} `;
  const n = ` ${normalize(needle)} `;
  return h.includes(n);
}

/**
 * 한 단어짜리 배제 문구는 노이즈가 너무 크다(예: 'energetic'). 팔레트 원자와
 * 대조할 때는 2단어 이상만 양방향으로 보고, 1단어는 "exclude가 원자를 통째로
 * 품는" 방향만 본다 — 그쪽은 실제로 그 악기/기법 자체를 금지하는 경우다.
 */
function conflictsBetween(atom: string, excludePhrase: string): Conflict['direction'] | undefined {
  const atomWords = normalize(atom).split(' ').filter(Boolean);
  const exWords = normalize(excludePhrase).split(' ').filter(Boolean);
  if (!atomWords.length || !exWords.length) return undefined;
  if (containsPhrase(excludePhrase, atom)) return 'contains';
  if (exWords.length >= 2 && containsPhrase(atom, excludePhrase)) return 'inside';
  return undefined;
}

interface ExcludeSource {
  source: string;
  phrases: readonly string[];
}

function excludeSourcesForGenre(genreId: string): ExcludeSource[] {
  const sources: ExcludeSource[] = [];

  const bucket = eraBucketForGenreId(genreId);
  const eraTerms = bucket ? ERA_FORBIDDEN_DESCRIPTORS[bucket] : undefined;
  if (eraTerms?.length) sources.push({ source: `eraExclusions:${bucket}`, phrases: eraTerms });

  const genre = getGenreById(genreId);
  if (genre?.avoidTraits?.length) sources.push({ source: 'genreLibrary:avoidTraits', phrases: genre.avoidTraits });

  for (const rule of GENRE_FORBIDDEN_DESCRIPTORS) {
    if (rule.genreIds.includes(genreId) && rule.forbiddenPhrases.length) {
      sources.push({ source: 'genreForbiddenDescriptors', phrases: rule.forbiddenPhrases });
    }
  }

  for (const workspaceId of allowedWorkspacesForGenre(genreId)) {
    for (const floor of CHANNEL_SOUND_FLOORS) {
      if (floor.workspaceId !== workspaceId) continue;
      if (floor.forbiddenAtoms?.length) sources.push({ source: `channelSoundFloor:${workspaceId}`, phrases: floor.forbiddenAtoms });
    }
  }

  return sources;
}

function conflictsForPalette(palette: EraCanonPalette): Conflict[] {
  const found: Conflict[] = [];
  for (const genreId of palette.fitsGenreIds) {
    const sources = excludeSourcesForGenre(genreId);
    for (const field of ATOM_FIELDS) {
      for (const atom of palette[field]) {
        for (const { source, phrases } of sources) {
          for (const excludePhrase of phrases) {
            const direction = conflictsBetween(atom, excludePhrase);
            if (direction) found.push({ paletteId: palette.id, field, atom, genreId, source, excludePhrase, direction });
          }
        }
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// --pack 모드 — 실제 산출물의 excludePrompt vs 그 곡의 팔레트 원자.
// 정적 표(위)가 0쌍이어도 여기서는 걸릴 수 있다: 브릿지 경로에서는 곡별
// excludePrompt를 에이전트가 직접 쓰기 때문이다(§2.2의 실측 쌍이 그 경우).
// ---------------------------------------------------------------------------
interface PackConflict extends Conflict {
  trackNo: number;
  title: string;
}

function packConflicts(packPath: string): PackConflict[] {
  const raw = JSON.parse(fs.readFileSync(packPath, 'utf-8')) as { songs?: unknown[] } | unknown[];
  const songs = (Array.isArray(raw) ? raw : raw.songs ?? []) as {
    trackNo?: number; title?: string; genreId?: string; excludePrompt?: string;
  }[];
  const found: PackConflict[] = [];
  for (const [index, song] of songs.entries()) {
    const genreId = song.genreId;
    if (!genreId || !song.excludePrompt) continue;
    const palettes = eraCanonPalettesForGenreId(genreId);
    const partial = palettes.length ? [] : [partialPaletteForGenreId(genreId)].filter(Boolean) as EraCanonPalette[];
    const clauses = song.excludePrompt.split(',').map(clause => clause.trim()).filter(Boolean);
    for (const palette of [...palettes, ...partial]) {
      for (const field of ATOM_FIELDS) {
        for (const atom of palette[field]) {
          for (const clause of clauses) {
            const direction = conflictsBetween(atom, clause);
            if (direction) {
              found.push({
                paletteId: palette.id, field, atom, genreId,
                source: 'pack:excludePrompt', excludePhrase: clause, direction,
                trackNo: song.trackNo ?? index + 1, title: song.title ?? ''
              });
            }
          }
        }
      }
    }
  }
  return found;
}

const packArgIndex = process.argv.indexOf('--pack');
if (packArgIndex >= 0) {
  const packPath = process.argv[packArgIndex + 1];
  if (!packPath) {
    console.error('Usage: npx tsx scripts/checkEraPaletteConflict.ts --pack <path-to-pack.json>');
    process.exit(0);
  }
  const found = packConflicts(packPath);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ pack: packPath, conflictCount: found.length, conflicts: found }, null, 2));
  } else {
    console.log(`[check:era-palette-conflict --pack] ${packPath}`);
    if (!found.length) {
      console.log('  이 팩의 excludePrompt는 자기 팔레트 원자와 충돌하지 않는다 (0쌍).');
    } else {
      console.log(`  모순 ${found.length}쌍:`);
      for (const c of found) {
        console.log(`   - #${c.trackNo} ${c.title} — ${c.paletteId}.${c.field} "${c.atom}"`);
        console.log(`       vs excludePrompt "${c.excludePhrase}" (${c.genreId})`);
      }
    }
  }
  process.exit(0);
}

const conflicts = ERA_CANON_PALETTES.flatMap(conflictsForPalette);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ conflictCount: conflicts.length, conflicts }, null, 2));
} else {
  console.log('[check:era-palette-conflict] 팔레트↔exclude 모순 대조 (advisory — 항상 exit 0)');
  console.log(`  팔레트 ${ERA_CANON_PALETTES.length}종 · 원자 ${ERA_CANON_PALETTES.reduce((sum, p) => sum + ATOM_FIELDS.reduce((s, f) => s + p[f].length, 0), 0)}개 대조`);
  if (!conflicts.length) {
    console.log('  모순 0쌍.');
  } else {
    console.log(`  모순 ${conflicts.length}쌍:`);
    for (const c of conflicts) {
      const arrow = c.direction === 'contains' ? 'exclude가 원자를 품음' : '원자가 exclude를 품음';
      console.log(`   - ${c.paletteId}.${c.field} "${c.atom}"`);
      console.log(`       vs ${c.source} "${c.excludePhrase}" (${c.genreId}, ${arrow})`);
    }
    console.log('');
    console.log('  해결은 exclude 쪽을 좁히는 방향으로 한다 — 팔레트는 그 시대의 정본 사운드이므로 우선한다(지시문 74 §2.4-B2).');
  }
}

process.exit(0);
