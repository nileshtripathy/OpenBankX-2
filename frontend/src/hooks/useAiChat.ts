import { useCallback, useRef, useState } from 'react';
import { streamChat, type ChatHistoryMessage } from '@/lib/aiChat';

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  result?: unknown;
  status: 'running' | 'done';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls: ToolCall[];
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

const uid = () => Math.random().toString(36).slice(2);

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const history: ChatHistoryMessage[] = messages
        .filter((m) => m.status === 'done')
        .map((m) => ({ role: m.role, content: m.text }));

      const userMessage: ChatMessage = {
        id: uid(),
        role: 'user',
        text: trimmed,
        toolCalls: [],
        status: 'done',
      };
      const assistantId = uid();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        toolCalls: [],
        status: 'streaming',
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsSending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const update = (fn: (m: ChatMessage) => ChatMessage) => {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
      };

      try {
        for await (const event of streamChat(trimmed, history, controller.signal)) {
          if (event.type === 'text') {
            update((m) => ({ ...m, text: m.text + event.delta }));
          } else if (event.type === 'tool_start') {
            update((m) => ({
              ...m,
              toolCalls: [...m.toolCalls, { tool: event.tool, input: event.input, status: 'running' }],
            }));
          } else if (event.type === 'tool_result') {
            update((m) => ({
              ...m,
              toolCalls: m.toolCalls.map((tc) =>
                tc.tool === event.tool && tc.status === 'running'
                  ? { ...tc, status: 'done', result: event.result }
                  : tc
              ),
            }));
          } else if (event.type === 'error') {
            update((m) => ({ ...m, status: 'error', error: event.message }));
          } else if (event.type === 'done') {
            update((m) => ({ ...m, status: 'done' }));
          }
        }
      } catch (err) {
        update((m) => ({
          ...m,
          status: 'error',
          error: err instanceof Error ? err.message : 'The assistant is unavailable right now.',
        }));
      } finally {
        setIsSending(false);
        abortRef.current = null;
      }
    },
    [messages, isSending]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, send, stop, isSending };
}
