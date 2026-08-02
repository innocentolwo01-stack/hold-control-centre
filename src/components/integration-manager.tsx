'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, Plus, Webhook } from 'lucide-react';

import { ExportSelectedButton, LayoutSearchBar, OperationalBulkBar, SelectionCheckbox, usePersistedLayout, type OperationalAction } from '@/components/collection-controls';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Partner = { id: string; name: string };
type Integration = { id: string; partner_id: string; name: string; integration_type: string; environment: string; base_url?: string | null; auth_type?: string | null; vault_secret_name?: string | null; config?: Record<string, unknown>; status: string; last_success_at?: string | null; last_error_at?: string | null; last_error?: string | null; created_at?: string | null; updated_at?: string | null };
type Event = { id: number; integration_id?: string | null; direction: string; event_type: string; request_id?: string | null; status: string; error?: string | null; created_at: string; completed_at?: string | null };
type Form = { partner_id: string; name: string; integration_type: string; environment: string; base_url: string; auth_type: string; vault_secret_name: string; status: string; config: string };
const blank: Form = { partner_id: '', name: '', integration_type: 'rest', environment: 'sandbox', base_url: '', auth_type: 'none', vault_secret_name: '', status: 'disconnected', config: '{}' };
const actions: OperationalAction[] = [
  { value: 'enable', label: 'Enable', description: 'Return the selected integrations to a disconnected, ready-to-configure state.' },
  { value: 'disable', label: 'Disable', description: 'Stop the selected integrations from normal operation.' },
  { value: 'reset', label: 'Reset health', description: 'Clear the last error and reset the selected integrations to disconnected.' },
  { value: 'delete', label: 'Delete', description: 'Delete only integrations that are disabled or disconnected.', requiresReason: true, danger: true },
];
function tone(status: string): 'good' | 'warn' | 'neutral' | 'info' { if (status === 'connected' || status === 'success') return 'good'; if (status === 'degraded' || status === 'processing') return 'warn'; if (status === 'disabled' || status === 'failed') return 'neutral'; return 'info'; }

export function IntegrationManager() {
  const [rows, setRows] = useState<Integration[]>([]); const [events, setEvents] = useState<Event[]>([]); const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState<Form>(blank); const [editing, setEditing] = useState<Integration | null>(null); const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set()); const { layout, update: setLayout, hydrate } = usePersistedLayout('hold-control-centre-integrations-layout');

  async function load() {
    setLoading(true);
    const [integrationResult, eventResult, partnerResult] = await Promise.all([
      supabase.from('partner_integrations').select('*').order('created_at', { ascending: false }),
      supabase.from('integration_events').select('id,integration_id,direction,event_type,request_id,status,error,created_at,completed_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('partners').select('id,name').is('deleted_at', null).order('name'),
    ]);
    const first = integrationResult.error || eventResult.error || partnerResult.error; if (first) setError(first.message); else setError('');
    setRows((integrationResult.data as Integration[]) ?? []); setEvents((eventResult.data as Event[]) ?? []); setPartners((partnerResult.data as Partner[]) ?? []); setLoading(false);
  }
  useEffect(() => { hydrate(); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function launch(row?: Integration) { setEditing(row ?? null); setForm(row ? { partner_id: row.partner_id, name: row.name, integration_type: row.integration_type, environment: row.environment, base_url: row.base_url ?? '', auth_type: row.auth_type ?? 'none', vault_secret_name: row.vault_secret_name ?? '', status: row.status, config: JSON.stringify(row.config ?? {}, null, 2) } : blank); setError(''); setOpen(true); }
  async function save(event: FormEvent) {
    event.preventDefault(); let config: Record<string, unknown> = {}; try { config = JSON.parse(form.config || '{}') as Record<string, unknown>; } catch { setError('Configuration must be valid JSON.'); return; }
    const payload = { partner_id: form.partner_id, name: form.name, integration_type: form.integration_type, environment: form.environment, base_url: form.base_url || null, auth_type: form.auth_type, vault_secret_name: form.vault_secret_name || null, status: form.status, config, updated_at: new Date().toISOString() };
    const result = editing ? await supabase.from('partner_integrations').update(payload).eq('id', editing.id) : await supabase.from('partner_integrations').insert(payload);
    if (result.error) { setError(result.error.message); return; } setOpen(false); await load();
  }
  const partnerNames = useMemo(() => new Map(partners.map((row) => [row.id, row.name])), [partners]);
  const eventCounts = useMemo(() => { const map = new Map<string, number>(); events.forEach((row) => { if (row.integration_id) map.set(row.integration_id, (map.get(row.integration_id) ?? 0) + 1); }); return map; }, [events]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.status))).sort(), [rows]);
  const visible = useMemo(() => { const term = search.trim().toLowerCase(); return rows.filter((row) => (status === 'all' || row.status === status) && (!term || `${row.name} ${partnerNames.get(row.partner_id) ?? ''} ${row.integration_type} ${row.environment} ${row.status} ${row.base_url ?? ''} ${row.last_error ?? ''}`.toLowerCase().includes(term))); }, [partnerNames, rows, search, status]);
  const ids = visible.map((row) => row.id); const selectedIds = Array.from(selected); const selectedRows = rows.filter((row) => selected.has(row.id));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  return <>
    <PageHeader title="Integrations" description="Configure partner connections, inspect health and manage integration lifecycle without exposing credentials." actions={<Button onClick={() => launch()}><Plus size={16} /> New integration</Button>} />
    <Card className="catalogue-manager-card">
      <LayoutSearchBar layout={layout} onLayout={setLayout} search={search} onSearch={setSearch} placeholder="Search integration, partner, type or error" extra={<><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</Select><ExportSelectedButton rows={selectedRows as Array<Record<string, unknown>>} filename="hold-integrations.csv" /></>} />
      <OperationalBulkBar entityType="integration" noun="integration" selectedIds={selectedIds} visibleIds={ids} actions={actions} onClear={() => setSelected(new Set())} onSelectVisible={(next) => setSelected(new Set(next))} onComplete={load} />
      {error ? <p className="error">{error}</p> : null}
      {loading ? <div className="bulk-loading">Loading integrations…</div> : visible.length === 0 ? <EmptyState title="No integrations found" body="Create a partner integration or change the filters." /> : layout === 'tiles' ? <div className="management-tile-grid">{visible.map((row) => <article key={row.id} className={`management-tile ${selected.has(row.id) ? 'selected' : ''}`}><SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={row.name} /><div className="management-tile-icon"><Webhook size={23} /></div><div className="management-tile-title"><h3>{row.name}</h3><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></div><p>{partnerNames.get(row.partner_id) || 'Unknown partner'} · {titleCase(row.integration_type)} · {titleCase(row.environment)}</p><div className="management-data-grid"><span><small>Auth</small><strong>{titleCase(row.auth_type || 'none')}</strong></span><span><small>Events</small><strong>{eventCounts.get(row.id) ?? 0}</strong></span><span><small>Last success</small><strong>{formatDate(row.last_success_at)}</strong></span><span><small>Last error</small><strong>{formatDate(row.last_error_at)}</strong></span></div>{row.last_error ? <p className="record-alert">{row.last_error}</p> : null}<Button className="secondary" onClick={() => launch(row)}>Edit integration</Button></article>)}</div> : <div className="table-wrap management-list"><table><thead><tr><th className="selection-cell">Select</th><th>Integration</th><th>Status</th><th>Partner</th><th>Type</th><th>Environment</th><th>Last success</th><th>Last error</th><th>Actions</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}><td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td><strong>{row.name}</strong><span className="record-subtitle">{row.base_url || 'No base URL'}</span></td><td><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></td><td>{partnerNames.get(row.partner_id) || 'Unknown'}</td><td>{titleCase(row.integration_type)}</td><td>{titleCase(row.environment)}</td><td>{formatDate(row.last_success_at)}</td><td>{row.last_error ? <span title={row.last_error}>{formatDate(row.last_error_at)}</span> : '—'}</td><td><Button className="secondary" onClick={() => launch(row)}>Edit</Button></td></tr>)}</tbody></table></div>}
    </Card>
    <Card className="section-gap"><div className="section-heading"><div><h2>Recent integration events</h2><p>Latest inbound and outbound activity across configured connections.</p></div><Activity size={20} /></div>{events.length === 0 ? <EmptyState title="No integration events" body="Events will appear here after partner traffic begins." /> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>Integration</th><th>Direction</th><th>Event</th><th>Status</th><th>Request</th><th>Error</th></tr></thead><tbody>{events.map((row) => <tr key={row.id}><td>{formatDate(row.created_at)}</td><td>{row.integration_id ? rows.find((item) => item.id === row.integration_id)?.name || row.integration_id : 'System'}</td><td>{titleCase(row.direction)}</td><td>{titleCase(row.event_type)}</td><td><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></td><td>{row.request_id || '—'}</td><td>{row.error || '—'}</td></tr>)}</tbody></table></div>}</Card>
    {open ? <Modal title={editing ? 'Edit integration' : 'New integration'} onClose={() => setOpen(false)}><form onSubmit={save}><div className="form-grid">
      <Field label="Partner"><Select required value={form.partner_id} onChange={(event) => setForm({ ...form, partner_id: event.target.value })}><option value="">Choose partner</option>{partners.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field>
      <Field label="Name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="Integration type"><Select value={form.integration_type} onChange={(event) => setForm({ ...form, integration_type: event.target.value })}><option value="rest">REST</option><option value="graphql">GraphQL</option><option value="webhook">Webhook</option><option value="sftp">SFTP</option><option value="csv">CSV</option><option value="manual">Manual</option><option value="hold_scanner">Hold scanner</option></Select></Field>
      <Field label="Environment"><Select value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value })}><option value="sandbox">Sandbox</option><option value="production">Production</option></Select></Field>
      <Field label="Base URL"><Input type="url" value={form.base_url} onChange={(event) => setForm({ ...form, base_url: event.target.value })} /></Field>
      <Field label="Authentication"><Select value={form.auth_type} onChange={(event) => setForm({ ...form, auth_type: event.target.value })}><option value="none">None</option><option value="api_key">API key</option><option value="bearer">Bearer</option><option value="basic">Basic</option><option value="oauth2">OAuth 2</option><option value="hmac">HMAC</option></Select></Field>
      <Field label="Vault secret name" hint="Reference only. Never paste credentials into this form."><Input value={form.vault_secret_name} onChange={(event) => setForm({ ...form, vault_secret_name: event.target.value })} /></Field>
      <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="disconnected">Disconnected</option><option value="connected">Connected</option><option value="degraded">Degraded</option><option value="disabled">Disabled</option></Select></Field>
      <Field label="Configuration JSON"><Textarea value={form.config} onChange={(event) => setForm({ ...form, config: event.target.value })} /></Field>
    </div>{error ? <p className="error">{error}</p> : null}<div className="form-actions"><Button type="submit">Save integration</Button></div></form></Modal> : null}
  </>;
}
