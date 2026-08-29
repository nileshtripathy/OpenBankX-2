import { useAuthStore } from '@/store/auth.store';

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: unknown }
  | { type: 'done'; stepCount: number }
  | { type: 'error'; message: string };

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Streams a chat turn from POST /api/ai/chat. Browser EventSource only
 * supports GET, and this endpoint needs a JSON body (the message + history),
 * so this parses the same `data: {...}\n\n` SSE framing manually off a
 * plain `fetch` response body reader instead.
 */
export async function* streamChat(
  message: string,
  history: ChatHistoryMessage[],
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const accessToken = useAuthStore.getState().accessToken;
  const apiUrl = import.meta.env.VITE_API_URL as string;

  const res = await fetch(`${apiUrl}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed with status ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? ''; // last (possibly incomplete) frame stays in the buffer

    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue; // comment/heartbeat lines (": ping") have no "data:" prefix
      try {
        yield JSON.parse(line.slice('data: '.length)) as AgentEvent;
      } catch {
        // malformed frame - skip rather than crash the whole stream
      }
    }
  }
}
