'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock3, Gift, Medal, RefreshCw, TicketCheck, Users } from 'lucide-react';

import { Badge, Button, Card, EmptyState, PageHeader, Select } from '@/components/ui';
import { titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type MetricMap = {
  total_users: number; active_users: number; new_users: number; focus_sessions: number; focus_minutes: number; points_earned: number;
  redemptions: number; points_spent: number; active_subscriptions: number; active_partners: number; active_rewards: number; active_coupons: number;
  active_campaigns: number; available_codes: number;
};
type Daily = { date: string; new_users: number; sessions: number; focus_minutes: number; redemptions: number };
type Breakdown = { name: string; value: number };
type TopReward = { id: string; name: string; redemptions: number; points_spent: number };
type Snapshot = { period_days: number; generated_at: string; metrics: MetricMap; daily: Daily[]; plans: Breakdown[]; session_categories: Breakdown[]; top_rewards: TopReward[]; code_inventory: Breakdown[] };
const emptyMetrics: MetricMap = { total_users: 0, active_users: 0, new_users: 0, focus_sessions: 0, focus_minutes: 0, points_earned: 0, redemptions: 0, points_spent: 0, active_subscriptions: 0, active_partners: 0, active_rewards: 0, active_coupons: 0, active_campaigns: 0, available_codes: 0 };
function formatNumber(value: number) { return Number(value || 0).toLocaleString('en-GB'); }

function BreakdownBars({ rows, empty }: { rows: Breakdown[]; empty: string }) {
  const max = Math.max(...rows.map((row) => Number(row.value)), 1);
  if (!rows.length) return <EmptyState title={empty} body="There is not enough activity in this period to display a breakdown." />;
  return <div className="breakdown-bars">{rows.map((row) => <div className="breakdown-row" key={row.name}><div><strong>{titleCase(row.name)}</strong><span>{formatNumber(row.value)}</span></div><div className="breakdown-track"><span style={{ width: `${Math.max(4, (Number(row.value) / max) * 100)}%` }} /></div></div>)}</div>;
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30); const [data, setData] = useState<Snapshot | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  async function load(nextDays = days) { setLoading(true); setError(''); const { data: result, error: rpcError } = await supabase.rpc('admin_analytics_snapshot', { p_days: nextDays }); if (rpcError) { setError(rpcError.message.replaceAll('_', ' ')); setData(null); } else setData(result as Snapshot); setLoading(false); }
  useEffect(() => { void load(days); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);
  const metrics = data?.metrics ?? emptyMetrics; const daily = data?.daily ?? [];
  const maxSessions = useMemo(() => Math.max(...daily.map((row) => Number(row.sessions)), 1), [daily]);
  const cards = [
    { label: 'Total users', value: metrics.total_users, detail: `${formatNumber(metrics.active_users)} active`, icon: Users },
    { label: `New users · ${days}d`, value: metrics.new_users, detail: `${formatNumber(metrics.active_subscriptions)} paid subscriptions`, icon: Users },
    { label: 'Focus sessions', value: metrics.focus_sessions, detail: `${formatNumber(metrics.focus_minutes)} focused minutes`, icon: Clock3 },
    { label: 'Redemptions', value: metrics.redemptions, detail: `${formatNumber(metrics.points_spent)} points spent`, icon: TicketCheck },
    { label: 'Active offers', value: metrics.active_rewards + metrics.active_coupons, detail: `${formatNumber(metrics.active_rewards)} rewards · ${formatNumber(metrics.active_coupons)} coupons`, icon: Gift },
    { label: 'Active partners', value: metrics.active_partners, detail: `${formatNumber(metrics.active_campaigns)} active campaigns`, icon: Medal },
    { label: 'Available codes', value: metrics.available_codes, detail: 'Ready for allocation', icon: BarChart3 },
  ];

  return <>
    <PageHeader title="Analytics" description="Live product, focus, subscription, reward and redemption performance from the Hold database." actions={<div className="analytics-actions"><Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option></Select><Button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</Button></div>} />
    {error ? <p className="error">{error}</p> : null}
    {loading ? <Card><div className="bulk-loading">Loading analytics…</div></Card> : <>
      <div className="analytics-kpis">{cards.map(({ label, value, detail, icon: Icon }) => <Card key={label}><div className="analytics-kpi"><span><Icon size={20} /></span><div><small>{label}</small><strong>{formatNumber(value)}</strong><p>{detail}</p></div></div></Card>)}</div>
      <div className="grid two section-gap">
        <Card><div className="section-heading"><div><h2>Daily activity</h2><p>Focus sessions recorded during the selected period.</p></div><Badge tone="info">{days} days</Badge></div>{daily.length ? <div className="daily-chart" aria-label="Daily focus sessions chart">{daily.map((row) => <div className="daily-column" key={row.date} title={`${row.date}: ${row.sessions} sessions, ${row.focus_minutes} minutes`}><div className="daily-bar"><span style={{ height: `${Math.max(row.sessions ? 8 : 1, (Number(row.sessions) / maxSessions) * 100)}%` }} /></div><small>{new Date(`${row.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</small></div>)}</div> : <EmptyState title="No daily activity" body="Focus sessions will appear here as users complete them." />}</Card>
        <Card><div className="section-heading"><div><h2>Focus categories</h2><p>Most common categories selected for focus sessions.</p></div><Clock3 size={20} /></div><BreakdownBars rows={data?.session_categories ?? []} empty="No category data" /></Card>
      </div>
      <div className="grid three section-gap">
        <Card><div className="section-heading"><div><h2>Paid plans</h2><p>Active subscription distribution.</p></div><Users size={20} /></div><BreakdownBars rows={data?.plans ?? []} empty="No paid plans" /></Card>
        <Card><div className="section-heading"><div><h2>Code inventory</h2><p>Current code status distribution.</p></div><BarChart3 size={20} /></div><BreakdownBars rows={data?.code_inventory ?? []} empty="No codes loaded" /></Card>
        <Card><div className="section-heading"><div><h2>Marketplace health</h2><p>Current published catalogue footprint.</p></div><Gift size={20} /></div><div className="kpi-list"><div className="kpi-row"><span>Active rewards</span><strong>{formatNumber(metrics.active_rewards)}</strong></div><div className="kpi-row"><span>Active coupons</span><strong>{formatNumber(metrics.active_coupons)}</strong></div><div className="kpi-row"><span>Active campaigns</span><strong>{formatNumber(metrics.active_campaigns)}</strong></div><div className="kpi-row"><span>Points earned</span><strong>{formatNumber(metrics.points_earned)}</strong></div></div></Card>
      </div>
      <Card className="section-gap"><div className="section-heading"><div><h2>Top redeemed rewards</h2><p>Rewards generating the most confirmed redemptions during the selected period.</p></div><Medal size={20} /></div>{(data?.top_rewards ?? []).length === 0 ? <EmptyState title="No reward redemptions" body="Confirmed redemptions will appear here." /> : <div className="table-wrap"><table><thead><tr><th>Rank</th><th>Reward</th><th>Redemptions</th><th>Points spent</th></tr></thead><tbody>{data?.top_rewards.map((row, index) => <tr key={row.id}><td>#{index + 1}</td><td><strong>{row.name}</strong></td><td>{formatNumber(row.redemptions)}</td><td>{formatNumber(row.points_spent)}</td></tr>)}</tbody></table></div>}</Card>
      <p className="analytics-generated">Generated {data?.generated_at ? new Date(data.generated_at).toLocaleString('en-GB') : '—'}.</p>
    </>}
  </>;
}
