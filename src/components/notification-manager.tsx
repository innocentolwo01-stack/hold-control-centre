'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bell, Plus, Send, Users } from 'lucide-react';

import { ExportSelectedButton, LayoutSearchBar, OperationalBulkBar, SelectionCheckbox, usePersistedLayout, type OperationalAction } from '@/components/collection-controls';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Notification = { id: string; name: string; title: string; body: string; audience_filter?: Record<string, unknown>; data_payload?: Record<string, unknown>; status: string; scheduled_at?: string | null; sent_at?: string | null; total_targeted: number; total_sent: number; total_failed: number; created_at: string; updated_at: string };
type Form = { name: string; title: string; body: string; status: string; scheduled_at: string; audience_filter: string; data_payload: string };
const blank: Form = { name: '', title: '', body: '', status: 'draft', scheduled_at: '', audience_filter: '{}', data_payload: '{}' };
const actions: OperationalAction[] = [
  { value: 'draft', label: 'Move to draft', description: 'Return eligible campaigns to draft and clear their schedule.' },
  { value: 'cancel', label: 'Cancel', description: 'Cancel selected draft, scheduled or failed campaigns.', requiresReason: true, danger: true },
  { value: 'delete', label: 'Delete', description: 'Delete only draft, cancelled or failed notification campaigns.', requiresReason: true, danger: true },
];
function tone(status: string): 'good' | 'warn' | 'neutral' | 'info' { if (status === 'sent') return 'good'; if (status === 'scheduled' || status === 'sending') return 'warn'; if (status === 'cancelled' || status === 'failed') return 'neutral'; return 'info'; }
function toLocal(value?: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

export function NotificationManager() {
  const [rows, setRows] = useState<Notification[]>([]); const [form, setForm] = useState<Form>(blank); const [editing, setEditing] = useState<Notification | null>(null); const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [selected, setSelected] = useState<Set<string>>(new Set());
  const { layout, update: setLayout, hydrate } = usePersistedLayout('hold-control-centre-notifications-layout');
  async function load() { setLoading(true); const { data, error: loadError } = await supabase.from('notification_campaigns').select('*').order('created_at', { ascending: false }); if (loadError) { setError(loadError.message); setRows([]); } else { setRows((data as Notification[]) ?? []); setError(''); } setLoading(false); }
  useEffect(() => { hydrate(); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function launch(row?: Notification) { setEditing(row ?? null); setForm(row ? { name: row.name, title: row.title, body: row.body, status: row.status, scheduled_at: toLocal(row.scheduled_at), audience_filter: JSON.stringify(row.audience_filter ?? {}, null, 2), data_payload: JSON.stringify(row.data_payload ?? {}, null, 2) } : blank); setOpen(true); setError(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); let audience: Record<string, unknown>; let payload: Record<string, unknown>; try { audience = JSON.parse(form.audience_filter || '{}') as Record<string, unknown>; payload = JSON.parse(form.data_payload || '{}') as Record<string, unknown>; } catch { setError('Audience filter and data payload must be valid JSON.'); return; }
    const scheduled = form.status === 'scheduled' && form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null;
    const record = { name: form.name, title: form.title, body: form.body, status: form.status, scheduled_at: scheduled, audience_filter: audience, data_payload: payload, updated_at: new Date().toISOString() };
    const result = editing ? await supabase.from('notification_campaigns').update(record).eq('id', editing.id) : await supabase.from('notification_campaigns').insert(record);
    if (result.error) { setError(result.error.message); return; } setOpen(false); await load();
  }
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.status))).sort(), [rows]);
  const visible = useMemo(() => { const term = search.trim().toLowerCase(); return rows.filter((row) => (status === 'all' || row.status === status) && (!term || `${row.name} ${row.title} ${row.body} ${row.status}`.toLowerCase().includes(term))); }, [rows, search, status]);
  const ids = visible.map((row) => row.id); const selectedIds = Array.from(selected); const selectedRows = rows.filter((row) => selected.has(row.id));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  const totalSent = rows.reduce((sum, row) => sum + row.total_sent, 0); const totalFailed = rows.reduce((sum, row) => sum + row.total_failed, 0);

  return <>
    <PageHeader title="Notifications" description="Create, schedule and manage push-notification campaigns and their delivery performance." actions={<Button onClick={() => launch()}><Plus size={16} /> New notification</Button>} />
    <div className="grid three summary-strip"><Card><div className="stat"><div className="stat-icon"><Bell size={21} /></div><div><strong>{rows.length}</strong><span>Campaigns</span></div></div></Card><Card><div className="stat"><div className="stat-icon"><Send size={21} /></div><div><strong>{totalSent.toLocaleString('en-GB')}</strong><span>Messages sent</span></div></div></Card><Card><div className="stat"><div className="stat-icon"><Users size={21} /></div><div><strong>{totalFailed.toLocaleString('en-GB')}</strong><span>Delivery failures</span></div></div></Card></div>
    <Card className="catalogue-manager-card section-gap">
      <LayoutSearchBar layout={layout} onLayout={setLayout} search={search} onSearch={setSearch} placeholder="Search notification name, title, body or status" extra={<><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</Select><ExportSelectedButton rows={selectedRows as Array<Record<string, unknown>>} filename="hold-notifications.csv" /></>} />
      <OperationalBulkBar entityType="notification" noun="notification" selectedIds={selectedIds} visibleIds={ids} actions={actions} onClear={() => setSelected(new Set())} onSelectVisible={(next) => setSelected(new Set(next))} onComplete={load} />
      {error ? <p className="error">{error}</p> : null}
      {loading ? <div className="bulk-loading">Loading notifications…</div> : visible.length === 0 ? <EmptyState title="No notification campaigns found" body="Create a campaign or change the filters." /> : layout === 'tiles' ? <div className="management-tile-grid">{visible.map((row) => <article key={row.id} className={`management-tile ${selected.has(row.id) ? 'selected' : ''}`}><SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={row.name} /><div className="management-tile-icon"><Bell size={23} /></div><div className="management-tile-title"><h3>{row.name}</h3><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></div><div className="notification-preview"><strong>{row.title}</strong><p>{row.body}</p></div><div className="management-data-grid"><span><small>Targeted</small><strong>{row.total_targeted.toLocaleString('en-GB')}</strong></span><span><small>Sent</small><strong>{row.total_sent.toLocaleString('en-GB')}</strong></span><span><small>Failed</small><strong>{row.total_failed.toLocaleString('en-GB')}</strong></span><span><small>Scheduled</small><strong>{formatDate(row.scheduled_at)}</strong></span></div><Button className="secondary" onClick={() => launch(row)} disabled={row.status === 'sending' || row.status === 'sent'}>Edit campaign</Button></article>)}</div> : <div className="table-wrap management-list"><table><thead><tr><th className="selection-cell">Select</th><th>Campaign</th><th>Status</th><th>Notification</th><th>Scheduled</th><th>Targeted</th><th>Sent</th><th>Failed</th><th>Actions</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}><td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td><strong>{row.name}</strong><span className="record-subtitle">Created {formatDate(row.created_at)}</span></td><td><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></td><td><strong>{row.title}</strong><span className="record-subtitle">{row.body}</span></td><td>{formatDate(row.scheduled_at)}</td><td>{row.total_targeted.toLocaleString('en-GB')}</td><td>{row.total_sent.toLocaleString('en-GB')}</td><td>{row.total_failed.toLocaleString('en-GB')}</td><td><Button className="secondary" onClick={() => launch(row)} disabled={row.status === 'sending' || row.status === 'sent'}>Edit</Button></td></tr>)}</tbody></table></div>}
      <div className="collection-footnote">Scheduling changes the campaign record. Actual delivery still depends on the configured push delivery worker.</div>
    </Card>
    {open ? <Modal title={editing ? 'Edit notification campaign' : 'New notification campaign'} onClose={() => setOpen(false)}><form onSubmit={save}><div className="form-grid">
      <Field label="Internal campaign name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="Push title"><Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
      <Field label="Push body"><Textarea required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field>
      <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></Select></Field>
      <Field label="Scheduled at"><Input type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} disabled={form.status !== 'scheduled'} /></Field>
      <Field label="Audience filter JSON" hint='Example: {"plan":["premium","family"]}'><Textarea value={form.audience_filter} onChange={(event) => setForm({ ...form, audience_filter: event.target.value })} /></Field>
      <Field label="Data payload JSON" hint='Deep-link and app metadata only.'><Textarea value={form.data_payload} onChange={(event) => setForm({ ...form, data_payload: event.target.value })} /></Field>
    </div>{error ? <p className="error">{error}</p> : null}<div className="form-actions"><Button type="submit">Save notification</Button></div></form></Modal> : null}
  </>;
}
