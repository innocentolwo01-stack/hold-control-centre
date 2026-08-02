'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Search } from 'lucide-react';

import {
  BulkActionBar,
  LifecycleTabs,
  contentBulkActions,
  deletedBulkActions,
  userBulkActions,
  type LifecycleView,
} from '@/components/bulk-management';
import { Badge, Card, EmptyState, Input, PageHeader } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type EntityType = 'user' | 'partner' | 'reward' | 'coupon' | 'campaign';

type AdminRow = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  status: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

const entityLabels: Record<EntityType, string> = {
  user: 'Users',
  partner: 'Partners',
  reward: 'Rewards',
  coupon: 'Coupons',
  campaign: 'Campaigns',
};

function initialEntity(): EntityType {
  if (typeof window === 'undefined') return 'user';
  const requested = new URLSearchParams(window.location.search).get('entity');
  return requested && requested in entityLabels ? (requested as EntityType) : 'user';
}

function lifecycleGroup(row: AdminRow): Exclude<LifecycleView, 'all'> {
  if (row.deletedAt) return 'deleted';
  if (row.status === 'active') return 'active';
  if (row.status === 'draft') return 'draft';
  return 'archived';
}

function statusTone(status: string) {
  if (status === 'active') return 'good';
  if (status === 'suspended' || status === 'paused' || status === 'scheduled') return 'warn';
  if (status === 'closed' || status === 'ended' || status === 'archived') return 'neutral';
  return 'info';
}

export default function BulkManagementPage() {
  const [entity, setEntity] = useState<EntityType>('user');
  const [view, setView] = useState<LifecycleView>('all');
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setEntity(initialEntity());
  }, []);

  async function load() {
    setLoading(true);
    setError('');

    if (entity === 'user') {
      const { data, error: loadError } = await supabase.rpc('admin_list_users');
      if (loadError) {
        setError(loadError.message);
        setRows([]);
      } else {
        const userRows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          title: String(row.display_name || row.email || 'Focus user'),
          subtitle: String(row.email || row.username || 'No email available'),
          detail: `${titleCase(String(row.plan || 'free'))} plan · ${titleCase(String(row.profile_role || 'adult'))}`,
          status: String(row.account_status || 'active'),
          updatedAt: row.updated_at ? String(row.updated_at) : null,
          deletedAt: row.deleted_at ? String(row.deleted_at) : null,
        }));
        setRows(userRows);
      }
      setLoading(false);
      return;
    }

    const table = entity === 'campaign' ? 'campaigns' : entity === 'partner' ? 'partners' : 'rewards';
    let query = supabase.from(table).select('*').order('created_at', { ascending: false });

    if (entity === 'coupon') query = query.eq('offer_type', 'coupon');
    if (entity === 'reward') query = query.neq('offer_type', 'coupon');

    const { data, error: loadError } = await query;

    if (loadError) {
      setError(loadError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const title = String(row.app_display_name || row.name || 'Untitled');
      const partnerText = row.partner_id ? `Partner ${String(row.partner_id).slice(0, 8)}` : 'Hold managed';
      const detail = entity === 'partner'
        ? String(row.contact_email || row.website_url || 'No commercial contact')
        : entity === 'campaign'
          ? `${titleCase(String(row.campaign_type || 'campaign'))} · ${titleCase(String(row.minimum_plan || 'free'))}`
          : `${Number(row.points_cost || 0)} points · ${titleCase(String(row.redemption_method || 'manual'))}`;

      return {
        id: String(row.id),
        title,
        subtitle: entity === 'partner' ? String(row.short_description || partnerText) : String(row.short_description || row.description || partnerText),
        detail,
        status: String(row.status || 'draft'),
        updatedAt: row.updated_at ? String(row.updated_at) : row.created_at ? String(row.created_at) : null,
        deletedAt: row.deleted_at ? String(row.deleted_at) : null,
      } satisfies AdminRow;
    });

    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => {
    setSelected(new Set());
    setView('all');
    setSearch('');
    void load();
    // load is intentionally tied to the selected entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const counts = useMemo<Record<LifecycleView, number>>(() => {
    const result: Record<LifecycleView, number> = {
      all: 0,
      active: 0,
      draft: 0,
      archived: 0,
      deleted: 0,
    };

    rows.forEach((row) => {
      const group = lifecycleGroup(row);
      result[group] += 1;
      if (group !== 'deleted') result.all += 1;
    });

    return result;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const group = lifecycleGroup(row);
      const matchesView = view === 'all' ? group !== 'deleted' : group === view;
      const matchesSearch = !term || `${row.title} ${row.subtitle} ${row.detail} ${row.status}`.toLowerCase().includes(term);
      return matchesView && matchesSearch;
    });
  }, [rows, search, view]);

  const visibleIds = visibleRows.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedIds = Array.from(selected);
  const actions = view === 'deleted'
    ? deletedBulkActions
    : entity === 'user'
      ? userBulkActions
      : contentBulkActions;

  function changeEntity(next: EntityType) {
    setEntity(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('entity', next);
      window.history.replaceState({}, '', url);
    }
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  function changeView(next: LifecycleView) {
    setView(next);
    setSelected(new Set());
  }

  return (
    <>
      <PageHeader
        title="Bulk management"
        description="Select records across users, partners, rewards, coupons and campaigns, then activate, publish, draft, archive, delete, restore or permanently delete them in one controlled operation."
      />

      <Card className="bulk-manager-card">
        <div className="entity-tabs" role="tablist" aria-label="Management area">
          {(Object.keys(entityLabels) as EntityType[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={entity === item}
              className={entity === item ? 'active' : ''}
              onClick={() => changeEntity(item)}
            >
              {entityLabels[item]}
            </button>
          ))}
        </div>

        <LifecycleTabs value={view} onChange={changeView} counts={counts} />

        <div className="bulk-search-row">
          <div className="bulk-search">
            <Search size={17} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${entityLabels[entity].toLowerCase()}`}
            />
          </div>
          <span>{visibleRows.length} shown</span>
        </div>

        <BulkActionBar
          entityType={entity}
          noun={entity === 'user' ? 'user' : entity}
          selectedIds={selectedIds}
          visibleCount={visibleRows.length}
          allVisibleSelected={allVisibleSelected}
          actions={actions}
          onToggleAll={toggleAll}
          onClear={() => setSelected(new Set())}
          onComplete={load}
        />

        {loading ? (
          <div className="bulk-loading"><LoaderCircle className="spin-icon" size={26} /> Loading records…</div>
        ) : error ? (
          <p className="error">{error}</p>
        ) : visibleRows.length === 0 ? (
          <EmptyState title="No matching records" body="Change the status tab or search term to see other records." />
        ) : (
          <div className="table-wrap bulk-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="selection-cell">Select</th>
                  <th>Record</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}>
                    <td className="selection-cell">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.title}`}
                      />
                    </td>
                    <td>
                      <strong className="record-title">{row.title}</strong>
                      <span className="record-subtitle">{row.subtitle}</span>
                    </td>
                    <td>
                      <Badge tone={statusTone(row.status)}>{row.deletedAt ? 'Deleted' : titleCase(row.status)}</Badge>
                    </td>
                    <td>{row.detail}</td>
                    <td>{formatDate(row.deletedAt || row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
