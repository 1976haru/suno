import type { AgentEvaluation, GenerationOptions, PlaylistBlueprint, ProviderSettings, SongEvaluation } from '../types';
import { assertLyricDiversity, computeDiversityScore, type DiversityWarning } from '../core/lyricEngine';

const EVAL_BATCH_SIZE = 6;

export function isEvaluationAvailable(settings: ProviderSettings) {
  return settings.provider !== 'local';
}

async function callJsonProxy(settings: ProviderSettings, payload: { system: string; user: unknown; batchSize?: number }): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.keyStorageMode === 'local' && settings.apiKey) headers['X-User-Api-Key'] = settings.apiKey;

  const response = await fetch(settings.proxyEndpoint || '/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: settings.provider,
      model: settings.model,
      temperature: Math.min(settings.temperature, 0.6),
      batchSize: payload.batchSize ?? EVAL_BATCH_SIZE,
      system: payload.system,
      user: payload.user
    })
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(detail.error || `평가 요청이 실패했습니다 (${response.status}).`);
  }

  const data = await response.json();
  return (data.blueprint ?? data) as Record<string, unknown>;
}

function songEvalSystemPrompt() {
  return `당신은 상업 플레이리스트 채널을 위한 한국어 곡 평가 에이전트입니다. 아래 곡들을 평가하고 반드시 한국어로 결과를 작성하세요.

평가 기준 (각 0-10점):
- hookStrength: 후렴이 기억에 남는가
- lyricOriginality: 진부한 표현이 아닌 독창적인 가사인가
- promptFitness: Suno가 의도대로 해석할 수 있는 프롬프트인가
- audienceFit: 지정된 타겟 청중에게 맞는가
- seasonFit: 시즌 컨셉에 맞는가
- safety: 저작권/모방 리스크가 없는가

각 곡에 대해 total(0-100, 6개 점수를 100점 만점으로 환산한 합), verdict('pass'|'revise'|'reject'), issues(구체적 지적, 한국어 문장), suggestions(그대로 적용 가능한 구체적 개선 문장, 한국어)를 작성하세요. verdict가 'reject'인 곡에는 rewrittenHook(대체 후렴 제안)을 포함하세요.

JSON만 반환하세요. 다른 설명은 절대 붙이지 마세요. 형식:
{"songs":[{"trackNo":1,"scores":{"hookStrength":0,"lyricOriginality":0,"promptFitness":0,"audienceFit":0,"seasonFit":0,"safety":0},"total":0,"verdict":"pass","issues":[],"suggestions":[],"rewrittenHook":""}]}`;
}

function songEvalUserPayload(songs: PlaylistBlueprint['songs'], opts: GenerationOptions) {
  return {
    channel: { name: opts.channel.name, audience: opts.audience, promise: opts.channel.promise },
    lyricLanguage: opts.lyricLanguage,
    seasonId: opts.seasonId,
    songs: songs.map(song => ({
      trackNo: song.trackNo,
      title: song.title,
      hookPhrase: song.hookPhrase,
      stylePrompt: song.stylePrompt,
      lyrics: song.lyrics,
      youtubeTitle: song.youtube.title
    }))
  };
}

function packEvalSystemPrompt() {
  return `당신은 플레이리스트 팩 전체의 구성을 평가하는 한국어 에이전트입니다. 반드시 한국어로 답하세요.

diversityScore는 이미 코드로 계산되어 제공됩니다. 이 수치를 그대로 참고하여 코멘트만 작성하고, 직접 다시 계산하지 마세요.

다음을 0-100으로 평가하세요:
- coherenceScore: 채널의 사운드/보컬/무드 톤이 전체 트랙에서 일관되는가
- sequencingScore: 오프너-초반 상승-중반 깊이-후반 하이라이트-클로저 흐름이 자연스러운가

duplicateWarnings에는 제공된 similarPairs를 근거로 "3번과 9번 후렴이 거의 같다"처럼 구체적인 트랙 번호를 포함해 지적하세요. similarPairs가 비어 있으면 duplicateWarnings도 비워두세요. summary는 3-5문장의 한국어 총평입니다.

JSON만 반환하세요. 형식: {"coherenceScore":0,"sequencingScore":0,"duplicateWarnings":[],"summary":""}`;
}

function firstLyricLines(lyrics: string, count: number) {
  return lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.startsWith('Title:'))
    .slice(0, count);
}

function packEvalUserPayload(blueprint: PlaylistBlueprint, diversityScore: number, similarPairs: DiversityWarning[]) {
  return {
    projectTitle: blueprint.projectTitle,
    oneLineConcept: blueprint.oneLineConcept,
    sonicSignature: blueprint.sonicSignature,
    vocalSignature: blueprint.vocalSignature,
    diversityScore,
    similarPairs: similarPairs.map(pair => ({ trackA: pair.trackA, trackB: pair.trackB, similarityPercent: Math.round(pair.similarity * 100) })),
    tracks: blueprint.songs.map(song => ({
      trackNo: song.trackNo,
      title: song.title,
      hookPhrase: song.hookPhrase,
      firstFourLines: firstLyricLines(song.lyrics, 4)
    }))
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function evaluatePack(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  settings: ProviderSettings,
  onProgress?: (done: number, total: number) => void
): Promise<AgentEvaluation> {
  if (!isEvaluationAvailable(settings)) {
    throw new Error('평가 기능은 Claude 또는 ChatGPT API 설정이 필요합니다.');
  }

  const diversityScore = computeDiversityScore(blueprint.songs);
  const similarPairs = assertLyricDiversity(blueprint.songs);

  const batches = chunk(blueprint.songs, EVAL_BATCH_SIZE);
  const songs: SongEvaluation[] = [];
  let done = 0;
  for (const batch of batches) {
    const result = await callJsonProxy(settings, {
      system: songEvalSystemPrompt(),
      user: songEvalUserPayload(batch, opts),
      batchSize: batch.length
    });
    songs.push(...((result.songs as SongEvaluation[]) || []));
    done += batch.length;
    onProgress?.(done, blueprint.songs.length);
  }

  const packResult = await callJsonProxy(settings, {
    system: packEvalSystemPrompt(),
    user: packEvalUserPayload(blueprint, diversityScore, similarPairs),
    batchSize: 4
  });

  return {
    evaluatedAt: new Date().toISOString(),
    model: settings.model || (settings.provider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-4.1-mini'),
    packLevel: {
      diversityScore,
      coherenceScore: Number(packResult.coherenceScore) || 0,
      sequencingScore: Number(packResult.sequencingScore) || 0,
      duplicateWarnings: (packResult.duplicateWarnings as string[]) || [],
      summary: (packResult.summary as string) || ''
    },
    songs: songs.sort((a, b) => a.trackNo - b.trackNo)
  };
}
