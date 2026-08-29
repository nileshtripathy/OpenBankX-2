import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  History,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

// Each item carries which "rail" of the app it belongs to - the active
// indicator picks up that color, so the sidebar itself encodes the
// fiat/crypto/assistant distinction that runs through the whole app,
// rather than a single generic "active" color for every page.
const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, rail: 'fiat' as const },
  { to: '/bank', label: 'Bank Accounts', icon: Landmark, rail: 'fiat' as const },
  { to: '/swap', label: 'Swap & Exchange', icon: ArrowLeftRight, rail: 'crypto' as const },
  { to: '/transactions', label: 'Transactions', icon: History, rail: 'crypto' as const },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles, rail: 'signal' as const },
];

const railText = { fiat: 'text-fiat', crypto: 'text-crypto', signal: 'text-signal' };
const railBorder = { fiat: 'border-fiat', crypto: 'border-crypto', signal: 'border-signal' };

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="h-2.5 w-2.5 rounded-full bg-fiat" />
        <div className="h-2.5 w-2.5 rounded-full bg-crypto -ml-1" />
        <span className="font-display text-base font-semibold tracking-tight">OpenBankX</span>
      </div>
      <div className="rail-divider mx-5" />
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ to, label, icon: Icon, rail }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground',
                isActive && cn('bg-surface-2 text-foreground', railBorder[rail])
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4', isActive && railText[rail])} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        {role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground',
                isActive && 'border-foreground bg-surface-2 text-foreground'
              )
            }
          >
            <ShieldCheck className="h-4 w-4" />
            Admin
          </NavLink>
        )}
      </nav>
      <div className="p-4 text-xs text-muted">
        <span className="font-mono">v1.0.0</span> · Fiat &amp; crypto, one ledger
      </div>
    </aside>
  );
}
