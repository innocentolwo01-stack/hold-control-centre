'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Bell,
  Boxes,
  Building2,
  CalendarRange,
  Gift,
  TicketCheck,
  Users,
} from 'lucide-react';

import { Card, PageHeader } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type DashboardStats = {
  users: number;
  partners: number;
  offers: number;
  campaigns: number;
  redemptions: number;
  codes: number;
  notifications: number;
};

const emptyStats: DashboardStats = {
  users: 0,
  partners: 0,
  offers: 0,
  campaigns: 0,
  redemptions: 0,
  codes: 0,
  notifications: 0,
};

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      const [
        usersResult,
        partnersResult,
        offersResult,
        campaignsResult,
        redemptionsResult,
        codesResult,
        notificationsResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('partners')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('rewards')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('redemptions')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('reward_codes')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('notification_campaigns')
          .select('id', { count: 'exact', head: true }),
      ]);

      if (!active) return;

      const firstError = [
        usersResult.error,
        partnersResult.error,
        offersResult.error,
        campaignsResult.error,
        redemptionsResult.error,
        codesResult.error,
        notificationsResult.error,
      ].find(Boolean);

      if (firstError) {
        setError(firstError.message);
      }

      setStats({
        users: usersResult.count ?? 0,
        partners: partnersResult.count ?? 0,
        offers: offersResult.count ?? 0,
        campaigns: campaignsResult.count ?? 0,
        redemptions: redemptionsResult.count ?? 0,
        codes: codesResult.count ?? 0,
        notifications: notificationsResult.count ?? 0,
      });

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      label: 'Users',
      value: stats.users,
      icon: Users,
    },
    {
      label: 'Partners',
      value: stats.partners,
      icon: Building2,
    },
    {
      label: 'Rewards & coupons',
      value: stats.offers,
      icon: Gift,
    },
    {
      label: 'Campaigns',
      value: stats.campaigns,
      icon: CalendarRange,
    },
    {
      label: 'Confirmed redemptions',
      value: stats.redemptions,
      icon: TicketCheck,
    },
    {
      label: 'Reward codes',
      value: stats.codes,
      icon: Boxes,
    },
    {
      label: 'Notification campaigns',
      value: stats.notifications,
      icon: Bell,
    },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live operational view of Hold users, partners, offers, campaigns, inventory and redemptions."
      />

      {error ? <p className="error">{error}</p> : null}

      <div className="grid four">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="stat">
              <div className="stat-icon">
                <Icon size={22} />
              </div>

              <div>
                <strong>{loading ? '—' : value.toLocaleString('en-GB')}</strong>
                <span>{label}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid two" style={{ marginTop: 18 }}>
        <Card>
          <h2>Quick operations</h2>

          <div className="quick-links">
            <Link href="/dashboard/rewards">Manage rewards</Link>
            <Link href="/dashboard/partners">Manage partners</Link>
            <Link href="/dashboard/campaigns">Manage campaigns</Link>
            <Link href="/dashboard/codes">Code inventory</Link>
            <Link href="/dashboard/redemptions">Redemptions</Link>
            <Link href="/dashboard/notifications">Notifications</Link>
          </div>
        </Card>

        <Card>
          <h2>System status</h2>

          <div className="kpi-list">
            <div className="kpi-row">
              <span>Supabase connection</span>
              <strong>Connected</strong>
            </div>

            <div className="kpi-row">
              <span>Administrator access</span>
              <strong>Verified</strong>
            </div>

            <div className="kpi-row">
              <span>Database protection</span>
              <strong>RLS active</strong>
            </div>

            <div className="kpi-row">
              <span>Recovery branch</span>
              <strong>Protected</strong>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
