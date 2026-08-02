'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Boxes, Fingerprint, PackagePlus } from 'lucide-react';

import { ExportSelectedButton, LayoutSearchBar, OperationalBulkBar, SelectionCheckbox, usePersistedLayout, type OperationalAction } from '@/components/collection-controls';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Tab = 'batches' | 'codes';
type Reward = { id: string; name: string };
type Batch = { id: string; reward_id: string; name: string; source_type: string; external_reference?: string | null; total_codes: number; status: string; expires_at?: string | null; created_at?: string | null; updated_at?: string | null };
type Code = { id: string; batch_id: string; code_fingerprint: string; status: string; reserved_at?: string | null; issued_at?: string | null; confirmed_redeemed_at?: string | null; assigned_profile_id?: string | null; created_at?: string | null; updated_at?: string | null };

type BatchForm = { reward_id: string; name: string; source_type: string; external_reference: string; status: string; expires_at: string };
const blank: BatchForm = { reward_id: '', name: '', source_type: 'manual', external_reference: '', status: 'active', expires_at: '' };
const batchActions: OperationalAction[] = [
  { value: 'activate', label: 'Activate', description: 'Make the selected code batches available for allocation.' },
  { value: 'pause', label: 'Pause', description: 'Stop new codes being allocated from these batches.' },
  { value: 'void', label: 'Void', description: 'Void the batches and all unused codes inside them.', requiresReason: true, danger: true },
  { value: 'delete', label: 'Delete empty batches', description: 'Delete selected batches only when they are void and contain no codes.', requiresReason: true, danger: true },
];
const codeActions: OperationalAction[] = [
  { value: 'activate', label: 'Reactivate unused', description: 'Return eligible inactive and unassigned codes to Available.' },
  { value: 'reject', label: 'Reject', description: 'Mark eligible codes as rejected.', requiresReason: true, danger: true },
  { value: 'void', label: 'Void', description: 'Void eligible unused codes so they cannot be allocated.', requiresReason: true, danger: true },
  { value: 'delete', label: 'Delete unused', description: 'Permanently delete only unused and unassigned codes.', requiresReason: true, danger: true },
];
function tone(status: string): 'good' | 'warn' | 'neutral' | 'info' {
  if (status === 'active' || status === 'available') return 'good';
  if (status === 'paused' || status === 'reserved' || status === 'issued') return 'warn';
  if (status === 'void' || status === 'rejected' || status === 'expired_unconfirmed') return 'neutral';
  return 'info';
}
function toLocal(value?: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

export function CodeInventoryManager() {
  const [tab, setTab] = useState<Tab>('batches');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [form, setForm] = useState<BatchForm>(blank);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { layout, update: setLayout, hydrate } = usePersistedLayout('hold-control-centre-codes-layout', 'list');

  async function load() {
    setLoading(true);
    const [batchResult, codeResult, rewardResult] = await Promise.all([
      supabase.from('reward_code_batches').select('*').order('created_at', { ascending: false }),
      supabase.from('reward_codes').select('id,batch_id,code_fingerprint,status,reserved_at,issued_at,confirmed_redeemed_at,assigned_profile_id,created_at,updated_at').order('created_at', { ascending: false }),
      supabase.from('rewards').select('id,name').order('name'),
    ]);
    const first = batchResult.error || codeResult.error || rewardResult.error;
    if (first) setError(first.message); else setError('');
    setBatches((batchResult.data as Batch[]) ?? []); setCodes((codeResult.data as Code[]) ?? []); setRewards((rewardResult.data as Reward[]) ?? []); setLoading(false);
  }
  useEffect(() => { hydrate(); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function launch(row?: Batch) {
    setEditing(row ?? null);
    setForm(row ? { reward_id: row.reward_id, name: row.name, source_type: row.source_type, external_reference: row.external_reference ?? '', status: row.status, expires_at: toLocal(row.expires_at) } : blank);
    setOpen(true); setError('');
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = { reward_id: form.reward_id, name: form.name, source_type: form.source_type, external_reference: form.external_reference || null, status: form.status, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null, updated_at: new Date().toISOString() };
    const result = editing ? await supabase.from('reward_code_batches').update(payload).eq('id', editing.id) : await supabase.from('reward_code_batches').insert(payload);
    if (result.error) { setError(result.error.message); return; } setOpen(false); await load();
  }

  const rewardNames = useMemo(() => new Map(rewards.map((row) => [row.id, row.name])), [rewards]);
  const batchNames = useMemo(() => new Map(batches.map((row) => [row.id, row.name])), [batches]);
  const batchCodeCounts = useMemo(() => { const map = new Map<string, number>(); codes.forEach((row) => map.set(row.batch_id, (map.get(row.batch_id) ?? 0) + 1)); return map; }, [codes]);
  const statuses = useMemo(() => Array.from(new Set((tab === 'batches' ? batches : codes).map((row) => row.status))).sort(), [batches, codes, tab]);
  const visibleBatches = useMemo(() => { const term = search.trim().toLowerCase(); return batches.filter((row) => (status === 'all' || row.status === status) && (!term || `${row.name} ${rewardNames.get(row.reward_id) ?? ''} ${row.source_type} ${row.status} ${row.external_reference ?? ''}`.toLowerCase().includes(term))); }, [batches, rewardNames, search, status]);
  const visibleCodes = useMemo(() => { const term = search.trim().toLowerCase(); return codes.filter((row) => (status === 'all' || row.status === status) && (!term || `${row.code_fingerprint} ${batchNames.get(row.batch_id) ?? ''} ${row.status} ${row.assigned_profile_id ?? ''}`.toLowerCase().includes(term))); }, [batchNames, codes, search, status]);
  const visibleRows = tab === 'batches' ? visibleBatches : visibleCodes;
  const ids = visibleRows.map((row) => row.id); const selectedIds = Array.from(selected); const selectedRows = visibleRows.filter((row) => selected.has(row.id));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  return <>
    <PageHeader title="Code inventory" description="Manage secure voucher batches and code lifecycle without exposing redeemable code values." actions={tab === 'batches' ? <Button onClick={() => launch()}><PackagePlus size={16} /> New batch</Button> : undefined} />
    <Card className="catalogue-manager-card">
      <div className="entity-tabs"><button type="button" className={tab === 'batches' ? 'active' : ''} onClick={() => { setTab('batches'); setSelected(new Set()); setStatus('all'); }}>Batches <strong>{batches.length}</strong></button><button type="button" className={tab === 'codes' ? 'active' : ''} onClick={() => { setTab('codes'); setSelected(new Set()); setStatus('all'); }}>Codes <strong>{codes.length}</strong></button></div>
      <LayoutSearchBar layout={layout} onLayout={setLayout} search={search} onSearch={setSearch} placeholder={`Search ${tab}`} extra={<><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((value) => <option value={value} key={value}>{titleCase(value)}</option>)}</Select><ExportSelectedButton rows={selectedRows as Array<Record<string, unknown>>} filename={`hold-${tab}.csv`} /></>} />
      <OperationalBulkBar entityType={tab === 'batches' ? 'code_batch' : 'reward_code'} noun={tab === 'batches' ? 'batch' : 'code'} selectedIds={selectedIds} visibleIds={ids} actions={tab === 'batches' ? batchActions : codeActions} onClear={() => setSelected(new Set())} onSelectVisible={(next) => setSelected(new Set(next))} onComplete={load} />
      {error ? <p className="error">{error}</p> : null}
      {loading ? <div className="bulk-loading">Loading code inventory…</div> : visibleRows.length === 0 ? <EmptyState title={`No ${tab} found`} body="Change the filters or create a new code batch." /> : layout === 'tiles' ? (
        <div className="management-tile-grid">
          {tab === 'batches' ? visibleBatches.map((row) => <article className={`management-tile ${selected.has(row.id) ? 'selected' : ''}`} key={row.id}><SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={row.name} /><div className="management-tile-icon"><Boxes size={23} /></div><div className="management-tile-title"><h3>{row.name}</h3><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></div><p>{rewardNames.get(row.reward_id) || 'Unknown reward'}</p><div className="management-data-grid"><span><small>Codes</small><strong>{batchCodeCounts.get(row.id) ?? row.total_codes}</strong></span><span><small>Source</small><strong>{titleCase(row.source_type)}</strong></span><span><small>Expires</small><strong>{formatDate(row.expires_at)}</strong></span><span><small>Created</small><strong>{formatDate(row.created_at)}</strong></span></div><Button className="secondary" onClick={() => launch(row)}>Edit batch</Button></article>) : visibleCodes.map((row) => <article className={`management-tile ${selected.has(row.id) ? 'selected' : ''}`} key={row.id}><SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={row.code_fingerprint} /><div className="management-tile-icon"><Fingerprint size={23} /></div><div className="management-tile-title"><h3>{row.code_fingerprint}</h3><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></div><p>{batchNames.get(row.batch_id) || 'Unknown batch'}</p><div className="management-data-grid"><span><small>Reserved</small><strong>{formatDate(row.reserved_at)}</strong></span><span><small>Issued</small><strong>{formatDate(row.issued_at)}</strong></span><span><small>Redeemed</small><strong>{formatDate(row.confirmed_redeemed_at)}</strong></span><span><small>Assigned</small><strong>{row.assigned_profile_id ? 'Yes' : 'No'}</strong></span></div></article>)}
        </div>
      ) : (
        <div className="table-wrap management-list"><table><thead><tr><th className="selection-cell">Select</th>{tab === 'batches' ? <><th>Batch</th><th>Status</th><th>Reward</th><th>Codes</th><th>Source</th><th>Expiry</th><th>Actions</th></> : <><th>Fingerprint</th><th>Status</th><th>Batch</th><th>Assigned</th><th>Reserved</th><th>Issued</th><th>Redeemed</th></>}</tr></thead><tbody>
          {tab === 'batches' ? visibleBatches.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}><td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td><strong>{row.name}</strong><span className="record-subtitle">{row.external_reference || row.id}</span></td><td><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></td><td>{rewardNames.get(row.reward_id) || 'Unknown'}</td><td>{batchCodeCounts.get(row.id) ?? row.total_codes}</td><td>{titleCase(row.source_type)}</td><td>{formatDate(row.expires_at)}</td><td><Button className="secondary" onClick={() => launch(row)}>Edit</Button></td></tr>) : visibleCodes.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}><td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td><strong>{row.code_fingerprint}</strong><span className="record-subtitle">Encrypted value hidden</span></td><td><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></td><td>{batchNames.get(row.batch_id) || 'Unknown'}</td><td>{row.assigned_profile_id ? 'Yes' : 'No'}</td><td>{formatDate(row.reserved_at)}</td><td>{formatDate(row.issued_at)}</td><td>{formatDate(row.confirmed_redeemed_at)}</td></tr>)}
        </tbody></table></div>
      )}
      <div className="collection-footnote">Redeemable code ciphertext is never displayed or exported from the Control Centre.</div>
    </Card>
    {open ? <Modal title={editing ? 'Edit code batch' : 'New code batch'} onClose={() => setOpen(false)}><form onSubmit={save}><div className="form-grid">
      <Field label="Reward"><Select required value={form.reward_id} onChange={(event) => setForm({ ...form, reward_id: event.target.value })}><option value="">Choose reward</option>{rewards.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}</Select></Field>
      <Field label="Batch name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="Source type"><Select value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value })}><option value="manual">Manual</option><option value="csv">CSV</option><option value="api">API</option><option value="generated">Generated</option></Select></Field>
      <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="paused">Paused</option><option value="exhausted">Exhausted</option><option value="void">Void</option></Select></Field>
      <Field label="External reference"><Input value={form.external_reference} onChange={(event) => setForm({ ...form, external_reference: event.target.value })} /></Field>
      <Field label="Expires at"><Input type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></Field>
    </div>{error ? <p className="error">{error}</p> : null}<div className="form-actions"><Button type="submit">Save batch</Button></div></form></Modal> : null}
  </>;
}
