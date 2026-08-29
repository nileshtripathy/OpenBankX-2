import { AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChatMessage as ChatMessageType } from '@/hooks/useAiChat';
import { ToolCallChip } from './ToolCallChip';

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-lg rounded-tr-sm bg-surface-2 px-4 py-2.5 text-sm text-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal/15 text-signal">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="flex max-w-[80%] flex-col gap-2">
        {message.toolCalls.map((call, i) => (
          <ToolCallChip key={`${call.tool}-${i}`} call={call} />
        ))}

        {message.text && (
          <div className="rounded-lg rounded-tl-sm bg-surface px-4 py-2.5 text-sm leading-relaxed text-foreground">
            {message.text}
            {message.status === 'streaming' && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-signal/70 align-middle" />
            )}
          </div>
        )}

        {message.status === 'error' && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger'
            )}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
