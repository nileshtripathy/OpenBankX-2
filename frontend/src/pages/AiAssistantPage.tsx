import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { useAiChat } from '@/hooks/useAiChat';

const SUGGESTIONS = [
  "What's my total balance across everything?",
  'How much ETH do I have in my vault?',
  'Do swaps have a fee?',
  'Is my bank data encrypted?',
];

export default function AiAssistantPage() {
  const { messages, send, stop, isSending } = useAiChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    if (!input.trim() || isSending) return;
    send(input);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Sparkles className="h-5 w-5 text-signal" />
          AI Assistant
        </h1>
        <p className="text-sm text-muted">
          Ask about your balances, transactions, or how OpenBankX works - grounded in your real
          account data, not guesses.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="ambient-glow flex-1 overflow-y-auto rounded-lg border border-border bg-bg/40 p-5"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-signal/15 text-signal">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">Ask me anything about your money</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                I can check your real bank and vault balances, list recent transactions, or
                explain how deposits, swaps, and security work on OpenBankX.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-signal/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about your balances, a recent transaction, or how something works..."
          rows={1}
          className="flex max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
        {isSending ? (
          <Button variant="outline" size="icon" onClick={stop} title="Stop">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="signal" size="icon" onClick={submit} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
