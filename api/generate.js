function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body;
}

function cleanJsonText(text) {
  return String(text || '')
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

async function callOpenAI({ model, temperature, system, user }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4.1-mini',
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.8,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user, null, 2) }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI upstream failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  return JSON.parse(cleanJsonText(data.choices?.[0]?.message?.content || '{}'));
}

async function callAnthropic({ model, temperature, system, user }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-latest',
      max_tokens: 12000,
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.8,
      system,
      messages: [
        {
          role: 'user',
          content: `Return JSON only.\n${JSON.stringify(user, null, 2)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic upstream failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const text = data.content?.map(part => part.text || '').join('\n') || '{}';
  return JSON.parse(cleanJsonText(text));
}

export default async function handler(req, res) {
  res.setHeader?.('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed.');
    return;
  }

  try {
    const body = parseBody(req);
    const provider = body.provider;

    if (!body.system || !body.user) {
      sendError(res, 400, 'Missing system or user payload.');
      return;
    }

    const blueprint = provider === 'openai'
      ? await callOpenAI(body)
      : provider === 'anthropic'
        ? await callAnthropic(body)
        : null;

    if (!blueprint) {
      sendError(res, 400, 'Unsupported provider.');
      return;
    }

    res.status(200).json({ blueprint });
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : String(error));
  }
}
