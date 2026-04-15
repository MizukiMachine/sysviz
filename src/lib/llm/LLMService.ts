export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export interface LLMConfig {
  provider: 'gemini' | 'glm';
  apiKey: string;
  model: string;
  baseUrl: string;
}

const GLM_URL = '/api/glm';

export async function streamChat(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  if (config.provider === 'gemini') {
    await streamGemini(config, messages, systemPrompt, callbacks, signal);
  } else {
    await streamGLM(config, messages, systemPrompt, callbacks, signal);
  }
}

async function streamGemini(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  { onToken, onDone, onError }: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${config.baseUrl}/models/${config.model}:streamGenerateContent?key=${config.apiKey}&alt=sse`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 4096 },
      }),
      signal,
    });
  } catch (e: any) {
    if (e.name === 'AbortError') return;
    onError(`Network error: ${e.message}`);
    return;
  }

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    onError(`Gemini API error ${response.status}: ${err}`);
    return;
  }

  if (!response.body) {
    onError('Empty response body from API');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onToken(text);
        } catch {
          // ignore parse errors for non-JSON lines
        }
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return;
    onError(e.message);
  }

  onDone();
}

async function streamGLM(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  { onToken, onDone, onError }: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl || GLM_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
      signal,
    });
  } catch (e: any) {
    if (e.name === 'AbortError') return;
    onError(`Network error: ${e.message}`);
    return;
  }

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    onError(`GLM API error ${response.status}: ${err}`);
    return;
  }

  if (!response.body) {
    onError('Empty response body from API');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            onToken(parsed.delta.text);
          }
        } catch {
          // ignore parse errors for non-JSON lines
        }
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return;
    onError(e.message);
  }

  onDone();
}
