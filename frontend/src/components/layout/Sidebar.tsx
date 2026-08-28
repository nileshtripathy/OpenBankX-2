import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Landmark, ArrowLeftRight, History, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bank', label: 'Bank Accounts', icon: Landmark },
  { to: '/swap', label: 'Swap & Exchange', icon: ArrowLeftRight },
  { to: '/transactions', label: 'Transactions', icon: History },
];

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
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground',
                isActive && 'bg-surface-2 text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}

        {role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground',
                isActive && 'bg-surface-2 text-foreground'
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
