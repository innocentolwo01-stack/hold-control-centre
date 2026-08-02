'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ScanLine, ShieldCheck, UserPlus } from 'lucide-react';

import { ExportSelectedButton, LayoutSearchBar, OperationalBulkBar, SelectionCheckbox, usePersistedLayout, type OperationalAction } from '@/components/collection-controls';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type User = { id: string; email?: string | null; display_name?: string | null; username?: string | null };
type Partner = { id: string; name: string };
type Location = { id: string; partner_id: string; name?: string | null; label?: string | null; address?: string | null; city?: string | null };
type Staff = { id: string; user_id: string; partner_id: string; location_id?: string | null; role: string; active: boolean; created_at: string; updated_at: string };
type StaffForm = { user_id: string; partner_id: string; location_id: string; role: string; active: boolean };
const blank: StaffForm = { user_id: '', partner_id: '', location_id: '', role: 'scanner', active: true };
const actions: OperationalAction[] = [
  { value: 'activate', label: 'Activate', description: 'Enable selected merchant staff assignments.' },
  { value: 'deactivate', label: 'Deactivate', description: 'Disable selected merchant staff assignments.' },
  { value: 'delete', label: 'Delete', description: 'Delete only staff assignments that have already been deactivated.', requiresReason: true, danger: true },
];

type ScanResult = { redemption_id?: string; session_id?: string; status?: string; reward_id?: string; points_spent?: number; [key: string]: unknown };

export function ScannerManager() {
  const [token, setToken] = useState(''); const [reference, setReference] = useState(''); const [scanLocation, setScanLocation] = useState(''); const [rotating, setRotating] = useState(true); const [scanWorking, setScanWorking] = useState(false); const [scanError, setScanError] = useState(''); const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]); const [users, setUsers] = useState<User[]>([]); const [partners, setPartners] = useState<Partner[]>([]); const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState<StaffForm>(blank); const [editing, setEditing] = useState<Staff | null>(null); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [selected, setSelected] = useState<Set<string>>(new Set());
  const { layout, update: setLayout, hydrate } = usePersistedLayout('hold-control-centre-scanner-staff-layout', 'list');

  async function load() {
    setLoading(true); const [staffResult, userResult, partnerResult, locationResult] = await Promise.all([
      supabase.from('merchant_staff').select('*').order('created_at', { ascending: false }), supabase.rpc('admin_list_users'),
      supabase.from('partners').select('id,name').is('deleted_at', null).order('name'), supabase.from('partner_locations').select('*').order('created_at', { ascending: false }),
    ]); const first = staffResult.error || userResult.error || partnerResult.error || locationResult.error; if (first) setError(first.message); else setError('');
    setStaff((staffResult.data as Staff[]) ?? []); setUsers((userResult.data as User[]) ?? []); setPartners((partnerResult.data as Partner[]) ?? []); setLocations((locationResult.data as Location[]) ?? []); setLoading(false);
  }
  useEffect(() => { hydrate(); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  async function redeem(event: FormEvent) {
    event.preventDefault(); setScanWorking(true); setScanError(''); setScanResult(null);
    const { data, error: rpcError } = await supabase.rpc('admin_redeem_scanned_token', { p_token_hash: token.trim(), p_merchant_location_id: scanLocation || null, p_merchant_reference: reference.trim() || null, p_rotating: rotating });
    setScanWorking(false); if (rpcError) { setScanError(rpcError.message.replaceAll('_', ' ')); return; } setScanResult((data as ScanResult) ?? {}); setToken('');
  }
  function launch(row?: Staff) { setEditing(row ?? null); setForm(row ? { user_id: row.user_id, partner_id: row.partner_id, location_id: row.location_id ?? '', role: row.role, active: row.active } : blank); setOpen(true); setError(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); const payload = { user_id: form.user_id, partner_id: form.partner_id, location_id: form.location_id || null, role: form.role, active: form.active, updated_at: new Date().toISOString() };
    const result = editing ? await supabase.from('merchant_staff').update(payload).eq('id', editing.id) : await supabase.from('merchant_staff').insert(payload); if (result.error) { setError(result.error.message); return; } setOpen(false); await load();
  }
  const userNames = useMemo(() => new Map(users.map((row) => [row.id, row.display_name || row.username || row.email || row.id])), [users]); const partnerNames = useMemo(() => new Map(partners.map((row) => [row.id, row.name])), [partners]);
  const locationNames = useMemo(() => new Map(locations.map((row) => [row.id, row.name || row.label || [row.address, row.city].filter(Boolean).join(', ') || row.id])), [locations]);
  const visible = useMemo(() => { const term = search.trim().toLowerCase(); return staff.filter((row) => !term || `${userNames.get(row.user_id) ?? ''} ${partnerNames.get(row.partner_id) ?? ''} ${locationNames.get(row.location_id ?? '') ?? ''} ${row.role} ${row.active ? 'active' : 'inactive'}`.toLowerCase().includes(term)); }, [locationNames, partnerNames, search, staff, userNames]);
  const ids = visible.map((row) => row.id); const selectedIds = Array.from(selected); const selectedRows = staff.filter((row) => selected.has(row.id));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  const partnerLocations = locations.filter((row) => !form.partner_id || row.partner_id === form.partner_id);

  return <>
    <PageHeader title="Merchant scanner" description="Validate secure Hold redemption tokens and manage authorised merchant scanner staff." />
    <div className="grid two scanner-layout">
      <Card className="scanner-card"><div className="section-heading"><div><h2>Redeem token</h2><p>Paste or scan the token hash shown in the customer’s live redemption screen.</p></div><ScanLine size={24} /></div><form onSubmit={redeem} className="scanner-form">
        <Field label="Redemption token"><Input required autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste scanned token" /></Field>
        <Field label="Merchant location"><Select value={scanLocation} onChange={(event) => setScanLocation(event.target.value)}><option value="">No location / administrator scan</option>{locations.map((row) => <option value={row.id} key={row.id}>{partnerNames.get(row.partner_id) || 'Partner'} — {locationNames.get(row.id)}</option>)}</Select></Field>
        <Field label="Merchant reference"><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Till, receipt or transaction reference" /></Field>
        <label className="toggle-row"><input type="checkbox" checked={rotating} onChange={(event) => setRotating(event.target.checked)} /><span><strong>Rotating token</strong><small>Use the 25-second rotating token flow. Turn off only for legacy static tokens.</small></span></label>
        {scanError ? <p className="error">{scanError}</p> : null}<Button type="submit" disabled={scanWorking || !token.trim()}><ScanLine size={16} /> {scanWorking ? 'Validating…' : 'Validate and redeem'}</Button>
      </form></Card>
      <Card className="scanner-result-card">{scanResult ? <div className="scan-success"><CheckCircle2 size={48} /><h2>Redemption confirmed</h2><p>The token was accepted and the redemption was recorded.</p><pre>{JSON.stringify(scanResult, null, 2)}</pre></div> : <div className="scanner-empty"><ShieldCheck size={48} /><h2>Secure validation</h2><p>Every successful scan is processed by the protected redemption function and written to the audit log.</p></div>}</Card>
    </div>
    <Card className="catalogue-manager-card section-gap">
      <div className="section-heading"><div><h2>Merchant scanner staff</h2><p>Assign scanner, manager or partner-admin access to saved Hold users.</p></div><Button onClick={() => launch()}><UserPlus size={16} /> Add staff</Button></div>
      <LayoutSearchBar layout={layout} onLayout={setLayout} search={search} onSearch={setSearch} placeholder="Search user, partner, location or role" extra={<ExportSelectedButton rows={selectedRows as Array<Record<string, unknown>>} filename="hold-merchant-staff.csv" />} />
      <OperationalBulkBar entityType="merchant_staff" noun="staff assignment" selectedIds={selectedIds} visibleIds={ids} actions={actions} onClear={() => setSelected(new Set())} onSelectVisible={(next) => setSelected(new Set(next))} onComplete={load} />
      {error ? <p className="error">{error}</p> : null}{loading ? <div className="bulk-loading">Loading merchant staff…</div> : visible.length === 0 ? <EmptyState title="No merchant staff found" body="Add a scanner assignment or change the search." /> : layout === 'tiles' ? <div className="management-tile-grid">{visible.map((row) => <article key={row.id} className={`management-tile ${selected.has(row.id) ? 'selected' : ''}`}><SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={userNames.get(row.user_id) || 'staff'} /><div className="management-tile-icon"><ScanLine size={23} /></div><div className="management-tile-title"><h3>{userNames.get(row.user_id) || row.user_id}</h3><Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge></div><p>{partnerNames.get(row.partner_id) || 'Unknown partner'} · {titleCase(row.role)}</p><div className="management-data-grid"><span><small>Location</small><strong>{row.location_id ? locationNames.get(row.location_id) || 'Unknown' : 'All locations'}</strong></span><span><small>Created</small><strong>{formatDate(row.created_at)}</strong></span></div><Button className="secondary" onClick={() => launch(row)}>Edit assignment</Button></article>)}</div> : <div className="table-wrap management-list"><table><thead><tr><th className="selection-cell">Select</th><th>User</th><th>Status</th><th>Partner</th><th>Location</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}><td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td><strong>{userNames.get(row.user_id) || row.user_id}</strong></td><td><Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge></td><td>{partnerNames.get(row.partner_id) || 'Unknown'}</td><td>{row.location_id ? locationNames.get(row.location_id) || 'Unknown' : 'All locations'}</td><td>{titleCase(row.role)}</td><td>{formatDate(row.created_at)}</td><td><Button className="secondary" onClick={() => launch(row)}>Edit</Button></td></tr>)}</tbody></table></div>}
    </Card>
    {open ? <Modal title={editing ? 'Edit merchant staff' : 'Add merchant staff'} onClose={() => setOpen(false)}><form onSubmit={save}><div className="form-grid">
      <Field label="Hold user"><Select required value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}><option value="">Choose user</option>{users.map((row) => <option key={row.id} value={row.id}>{row.display_name || row.username || row.email || row.id}</option>)}</Select></Field>
      <Field label="Partner"><Select required value={form.partner_id} onChange={(event) => setForm({ ...form, partner_id: event.target.value, location_id: '' })}><option value="">Choose partner</option>{partners.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field>
      <Field label="Location"><Select value={form.location_id} onChange={(event) => setForm({ ...form, location_id: event.target.value })}><option value="">All partner locations</option>{partnerLocations.map((row) => <option key={row.id} value={row.id}>{locationNames.get(row.id)}</option>)}</Select></Field>
      <Field label="Role"><Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="scanner">Scanner</option><option value="manager">Manager</option><option value="partner_admin">Partner admin</option></Select></Field>
      <Field label="Active"><Select value={form.active ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, active: event.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></Select></Field>
    </div>{error ? <p className="error">{error}</p> : null}<div className="form-actions"><Button type="submit">Save assignment</Button></div></form></Modal> : null}
  </>;
}
