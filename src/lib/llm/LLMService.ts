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
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export async function streamChat(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  if (config.provider === 'anthropic') {
    await streamAnthropic(config, messages, systemPrompt, callbacks, signal);
  } else {
    await streamOpenAI(config, messages, systemPrompt, callbacks, signal);
  }
}

async function streamAnthropic(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  { onToken, onDone, onError }: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
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
    onError(`Anthropic API error ${response.status}: ${err}`);
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

async function streamOpenAI(
  config: LLMConfig,
  messages: LLMMessage[],
  systemPrompt: string,
  { onToken, onDone, onError }: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
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
    onError(`OpenAI API error ${response.status}: ${err}`);
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
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) onToken(delta);
        } catch {
          // ignore parse errors
        }
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return;
    onError(e.message);
  }

  onDone();
}
