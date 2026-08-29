import { Loader2, Check, Landmark, Wallet, History, PiggyBank } from 'lucide-react';
import type { ToolCall } from '@/hooks/useAiChat';

const TOOL_META: Record<string, { label: string; icon: typeof Landmark }> = {
  get_bank_accounts: { label: 'Checking your bank accounts', icon: Landmark },
  get_balance_summary: { label: 'Totaling your balances', icon: PiggyBank },
  get_vault_balance: { label: 'Checking your vault balance', icon: Wallet },
  get_recent_transactions: { label: 'Pulling recent transactions', icon: History },
};

/**
 * Tool calls are rendered like a small ledger receipt line - monospace,
 * quiet, checkmark on completion - rather than a loud "thinking" bubble.
 * It's a deliberate echo of the rest of the app's data-first aesthetic:
 * this is the assistant showing its work, not performing personality.
 */
export function ToolCallChip({ call }: { call: ToolCall }) {
  const meta = TOOL_META[call.tool] ?? { label: call.tool, icon: Landmark };
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-muted">
      {call.status === 'running' ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-signal" />
      ) : (
        <Check className="h-3.5 w-3.5 shrink-0 text-signal" />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{meta.label}</span>
    </div>
  );
}
