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
  apiKey?: string;
  model: string;
  baseUrl: string;
}

const GLM_URL = '/api/glm';

function buildHeaders(config: LLMConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey;
  }
  return headers;
}

async function generateGLM(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${config.baseUrl || GLM_URL}/v1/messages`, {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    throw new Error(`GLM API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
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
      headers: buildHeaders(config),
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

export async function generateChat(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  return generateGLM(config, messages, systemPrompt, signal);
}

export async function streamChat(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return streamGLM(config, messages, systemPrompt, callbacks, signal);
}
