function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    if (data && typeof data.error === 'string') return data.error;
  } catch {
    // response body wasn't JSON; fall through to a generic status message
  }
  if (response.status === 401) return 'API 키가 올바르지 않습니다.';
  if (response.status === 429) return '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.';
  if (response.status >= 500) return '서버 오류입니다. 곡 수를 줄여보세요.';
  return `요청이 실패했습니다 (${response.status}).`;
}

export interface CallGenerateProxyOptions {
  retries?: number;
  baseDelayMs?: number;
}

/**
 * POSTs to the /api/generate proxy with exponential-backoff retry on 429
 * (rate limit), and always throws a Korean-readable Error on failure
 * instead of surfacing raw response bodies.
 */
export async function callGenerateProxy(
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  options: CallGenerateProxyOptions = {}
): Promise<Record<string, unknown>> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (response.ok) return response.json();

    if (response.status === 429 && attempt < retries) {
      await sleep(baseDelayMs * 2 ** attempt);
      continue;
    }

    throw new Error(await parseErrorMessage(response));
  }

  throw new Error('요청이 실패했습니다.');
}
