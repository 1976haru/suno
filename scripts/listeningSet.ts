/**
 * TASK G2 §8 — 청취 검증용 선곡 세트 생성. §8-4 "G2가 고치지 않습니다": 이 스크립트는
 * 하루가 수노에 직접 넣어 들을 수 있는 형태로 곡을 뽑아 출력만 합니다.
 *
 * 다섯 워크스페이스에서 각 6곡(§8-1): 최우선 장르 3종(getDefaultGenreIdsForArchetype)에서
 * 2곡씩, 아크 구간(SongIdea.arcPhase)이 서로 다른 곡으로. 동요는 가능한 만큼 연령 계층
 * (T1/T2/T3, kidsLyricThemes의 scene 텍스트로 역매칭 — ageTier 필드 자체는 아직 실제
 * 생성 파이프라인에 배선되지 않았음, A3 인계 사항) 이 섞이도록 시도한다.
 *
 * Usage: npx tsx scripts/listeningSet.ts  (또는 npm run listening-set)
 */
import { workspaceDefinitions } from '../src/data/workspaces';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { getGenreById, getDefaultGenreIdsForArchetype } from '../src/data/genreLibrary';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { kidsLyricThemes } from '../src/data/lyricThemes';
import { isKidsArchetype } from '../src/utils/channelArchetype';
import type { ChannelPreset, GenerationOptions, SongIdea } from '../src/types';

const SONG_COUNT = 18;

function buildOptions(channel: ChannelPreset): GenerationOptions {
  const presetMoods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  return {
    channel,
    projectTitle: 'G2 Listening Set',
    songCount: SONG_COUNT,
    lyricLanguage: channel.primaryLanguage ?? 'english',
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: presetMoods.length ? channel.preferredMoods : moodPacks.map(m => m.id).slice(0, 1),
    seasonId: seasonPacks.some(s => s.id === 'christmas') ? 'christmas' : seasonPacks[0].id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: '',
    personaMode: false
  };
}

function ageTierFor(song: SongIdea): string {
  const theme = kidsLyricThemes.find(t => t.scene === song.listenerSituation);
  return theme?.ageTier ?? '알 수 없음(테마 역매칭 실패)';
}

/** §8-1 선정 기준 — 최우선 장르 3종에서 2곡씩, 아크 구간이 서로 다르게. */
function pickSix(songs: SongIdea[], priorityGenreIds: string[], kids: boolean): SongIdea[] {
  const picked: SongIdea[] = [];
  const usedArcPhases = new Set<string>();

  for (const genreId of priorityGenreIds) {
    const candidates = songs.filter(s => s.genreId === genreId && !picked.includes(s));
    if (!candidates.length) continue;
    // 1곡째: 아직 안 쓴 아크 구간 우선
    const first = candidates.find(s => !usedArcPhases.has(s.arcPhase ?? '')) ?? candidates[0];
    picked.push(first);
    usedArcPhases.add(first.arcPhase ?? '');
    // 2곡째: 1곡째와 다른 아크 구간 우선, 동요는 다른 연령 계층 우선
    const remaining = candidates.filter(s => s !== first);
    const second =
      remaining.find(s => (s.arcPhase ?? '') !== (first.arcPhase ?? '') && (!kids || ageTierFor(s) !== ageTierFor(first))) ??
      remaining.find(s => (s.arcPhase ?? '') !== (first.arcPhase ?? '')) ??
      remaining[0];
    if (second) {
      picked.push(second);
      usedArcPhases.add(second.arcPhase ?? '');
    }
  }

  // 최우선 3종만으로 6곡을 못 채우면(장르당 1곡 이하 등) 남은 곡에서 보충.
  if (picked.length < 6) {
    for (const song of songs) {
      if (picked.length >= 6) break;
      if (!picked.includes(song)) picked.push(song);
    }
  }
  return picked.slice(0, 6);
}

const CHECKLIST_TEXT = `
[워크스페이스 안]
- [ ] 장르가 서로 다르게 들리는가
- [ ] 다른 장르인데도 각자의 개성이 있는가
- [ ] 킬링포인트가 실제로 들리는가

[워크스페이스 사이]
- [ ] 한국 2030과 일본 2030이 다르게 들리는가
      (한국 = 베이스·드럼 중심, 짧은 후렴 / 일본 = 기타·피아노 중심, 사비에서 크게 열림)
- [ ] 한국 동요와 일본 동요가 다르게 들리는가
      (한국 = 교육 문장이 또렷하게 들림 / 일본 = 의성어와 동작이 들림)
- [ ] 시니어와 2030이 다르게 들리는가

[동요 전용]
- [ ] 연령대에 맞게 들리는가 (2세용과 6세용이 구별되는가)
- [ ] 놀라거나 자극적인 부분이 없는가
- [ ] 곡 길이가 적당한가 (조사 자료 2분)
- [ ] 따라 부를 수 있는가
`.trim();

function main() {
  console.log('# TASK G2 §8 — 청취 검증 선곡 세트 (다섯 워크스페이스 × 6곡 = 최대 30곡)\n');
  console.log('아래 각 곡의 "제목"과 "스타일 프롬프트"를 수노 입력창에, "가사"를 가사창에 그대로 붙여넣으면 됩니다.\n');

  let grandTotal = 0;
  for (const workspace of workspaceDefinitions) {
    const presets = channelPresets.filter(p => workspace.archetypeIds.includes(p.archetype));
    const preset = presets[0];
    if (!preset) {
      console.log(`\n## ${workspace.labelKo} (${workspace.id}) — 채널 프리셋 없음, 건너뜀\n`);
      continue;
    }
    const kids = isKidsArchetype(preset.archetype);
    const genres = preset.preferredGenres.map(id => getGenreById(id) ?? genrePacks.find(g => g.id === id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const moods = moodPacks.filter(m => preset.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === 'christmas') ?? seasonPacks[0];
    const opts = buildOptions(preset);
    const blueprint = generateLocalBlueprint(opts, genres, moods.length ? moods : moodPacks, season, { usedTitles: [], usedHooks: [] });

    const priorityGenreIds = getDefaultGenreIdsForArchetype(preset.archetype);
    const picks = pickSix(blueprint.songs, priorityGenreIds, kids);

    console.log(`\n## ${workspace.labelKo} (${workspace.id}) — ${preset.id} — ${picks.length}곡\n`);
    console.log(`최우선 장르 3종: ${priorityGenreIds.join(', ')}\n`);

    for (const song of picks) {
      grandTotal += 1;
      console.log(`### ${song.trackNo}. ${song.title}`);
      console.log(`- 장르: ${song.genreId} | 아크 구간: ${song.arcPhase ?? '(없음)'} | 예상 BPM: ${song.bpm ?? '(없음)'}${kids ? ` | 연령 계층(역매칭): ${ageTierFor(song)}` : ''}`);
      console.log('\n**스타일 프롬프트**');
      console.log('```text');
      console.log(song.stylePrompt);
      console.log('```');
      console.log('\n**가사**');
      console.log('```text');
      console.log(song.lyrics);
      console.log('```\n');
    }
  }

  console.log(`\n## 판정 체크리스트 (§8-2)\n`);
  console.log(CHECKLIST_TEXT);
  console.log(`\n---\n총 ${grandTotal}곡 선정. 코드 작업은 여기까지이고, 판정은 청취입니다.`);
}

main();
