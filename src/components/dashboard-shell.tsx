'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Bell, Boxes, Building2, CalendarRange, CircleDollarSign, Gift, LayoutDashboard,
  LogOut, ScanLine, Settings, ShieldCheck, TicketCheck, Users, Webhook,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ReactNode } from 'react';

const items = [
  ['Overview', '/dashboard', LayoutDashboard],
  ['Users', '/dashboard/users', Users],
  ['Partners', '/dashboard/partners', Building2],
  ['Rewards', '/dashboard/rewards', Gift],
  ['Campaigns', '/dashboard/campaigns', CalendarRange],
  ['Code inventory', '/dashboard/codes', Boxes],
  ['Integrations', '/dashboard/integrations', Webhook],
  ['Redemptions', '/dashboard/redemptions', TicketCheck],
  ['Notifications', '/dashboard/notifications', Bell],
  ['Merchant scanner', '/dashboard/scanner', ScanLine],
  ['Settings', '/dashboard/settings', Settings],
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><span /><span /></div>
          <div><strong>Hold</strong><small>Control Centre</small></div>
        </div>
        <nav>
          {items.map(([label, href, Icon]) => {
            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? 'active' : ''}>
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="security-chip"><ShieldCheck size={16} /> RLS protected</div>
          <button onClick={() => void supabase.auth.signOut().then(() => router.replace('/login'))}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <main className="content-area">
        <header className="topbar">
          <div><Activity size={18} /> Live Supabase connection</div>
          <div className="topbar-right"><CircleDollarSign size={17} /> Rewards operations</div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
    </div>
  );
}
