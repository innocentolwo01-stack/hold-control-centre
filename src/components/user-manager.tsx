'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, ShieldCheck, UserRound } from 'lucide-react';

import { BulkActionBar, LifecycleTabs, deletedBulkActions, userBulkActions, type LifecycleView } from '@/components/bulk-management';
import { ExportSelectedButton, LayoutSearchBar, SelectionCheckbox, usePersistedLayout } from '@/components/collection-controls';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type UserRecord = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  username?: string | null;
  profile_role?: string | null;
  age_band?: string | null;
  account_status?: string | null;
  plan?: string | null;
  auth_provider?: string | null;
  auth_created_at?: string | null;
  last_sign_in_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

function group(row: UserRecord): Exclude<LifecycleView, 'all'> {
  if (row.deleted_at) return 'deleted';
  if (row.account_status === 'active') return 'active';
  if (row.account_status === 'suspended') return 'draft';
  return 'archived';
}

function tone(status?: string | null): 'good' | 'warn' | 'neutral' | 'info' {
  if (status === 'active') return 'good';
  if (status === 'suspended') return 'warn';
  if (status === 'closed') return 'neutral';
  return 'info';
}

export function UserManager() {
  const [rows, setRows] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<LifecycleView>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { layout, update: setLayout, hydrate } = usePersistedLayout('hold-control-centre-users-layout', 'list');

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('admin_list_users');
    if (loadError) {
      setError(loadError.message.replaceAll('_', ' '));
      setRows([]);
    } else {
      setRows((data as UserRecord[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    hydrate();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo<Record<LifecycleView, number>>(() => {
    const result: Record<LifecycleView, number> = { all: 0, active: 0, draft: 0, archived: 0, deleted: 0 };
    rows.forEach((row) => {
      const current = group(row);
      result[current] += 1;
      if (current !== 'deleted') result.all += 1;
    });
    return result;
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const current = group(row);
      const matchesView = view === 'all' ? current !== 'deleted' : current === view;
      const haystack = `${row.display_name ?? ''} ${row.username ?? ''} ${row.email ?? ''} ${row.account_status ?? ''} ${row.plan ?? ''} ${row.profile_role ?? ''}`.toLowerCase();
      return matchesView && (!term || haystack.includes(term));
    });
  }, [rows, search, view]);

  const visibleIds = visible.map((row) => row.id);
  const selectedIds = Array.from(selected);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedRows = rows.filter((row) => selected.has(row.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <>
      <PageHeader title="Users" description="Search, review and manage Hold accounts, subscriptions and access status." />
      <Card className="catalogue-manager-card">
        <LifecycleTabs value={view} onChange={(next) => { setView(next); setSelected(new Set()); }} counts={counts} />
        <LayoutSearchBar
          layout={layout}
          onLayout={setLayout}
          search={search}
          onSearch={setSearch}
          placeholder="Search name, username, email, plan or status"
          extra={<ExportSelectedButton rows={selectedRows as Array<Record<string, unknown>>} filename="hold-users.csv" />}
        />
        <BulkActionBar
          entityType="user"
          noun="user"
          selectedIds={selectedIds}
          visibleCount={visibleIds.length}
          allVisibleSelected={allVisibleSelected}
          actions={view === 'deleted' ? deletedBulkActions : userBulkActions}
          onToggleAll={toggleAll}
          onClear={() => setSelected(new Set())}
          onComplete={load}
        />
        {error ? <p className="error">{error}</p> : null}
        {loading ? <div className="bulk-loading">Loading users…</div> : visible.length === 0 ? (
          <EmptyState title="No users found" body="Change the filters or search terms to see other accounts." />
        ) : layout === 'tiles' ? (
          <div className="management-tile-grid">
            {visible.map((row) => (
              <article key={row.id} className={`management-tile ${selected.has(row.id) ? 'selected' : ''}`}>
                <SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={row.display_name || row.email || 'user'} />
                <div className="management-tile-icon"><UserRound size={23} /></div>
                <div className="management-tile-title"><h3>{row.display_name || row.username || 'Unnamed user'}</h3><Badge tone={tone(row.account_status)}>{titleCase(row.account_status || 'unknown')}</Badge></div>
                <p>{row.email || 'No email address available'}</p>
                <div className="management-data-grid">
                  <span><small>Plan</small><strong>{titleCase(row.plan || 'free')}</strong></span>
                  <span><small>Role</small><strong>{titleCase(row.profile_role || 'member')}</strong></span>
                  <span><small>Provider</small><strong>{titleCase(row.auth_provider || 'email')}</strong></span>
                  <span><small>Last sign-in</small><strong>{formatDate(row.last_sign_in_at)}</strong></span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-wrap management-list"><table><thead><tr><th className="selection-cell">Select</th><th>User</th><th>Status</th><th>Plan</th><th>Role</th><th>Provider</th><th>Created</th><th>Last sign-in</th></tr></thead><tbody>
            {visible.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}>
              <td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td>
              <td><strong className="record-title">{row.display_name || row.username || 'Unnamed user'}</strong><span className="record-subtitle"><Mail size={12} /> {row.email || 'No email'}</span></td>
              <td><Badge tone={tone(row.account_status)}>{titleCase(row.account_status || 'unknown')}</Badge></td>
              <td>{titleCase(row.plan || 'free')}</td><td>{titleCase(row.profile_role || 'member')}</td><td>{titleCase(row.auth_provider || 'email')}</td>
              <td>{formatDate(row.auth_created_at)}</td><td>{formatDate(row.last_sign_in_at)}</td>
            </tr>)}
          </tbody></table></div>
        )}
        <div className="collection-footnote"><ShieldCheck size={15} /> Permanent deletion is restricted and administrator accounts are protected.</div>
      </Card>
    </>
  );
}
