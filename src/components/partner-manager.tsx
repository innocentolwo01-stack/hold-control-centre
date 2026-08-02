'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, ExternalLink, Mail, Plus } from 'lucide-react';

import { BulkActionBar, LifecycleTabs, contentBulkActions, deletedBulkActions, type LifecycleView } from '@/components/bulk-management';
import { ExportSelectedButton, LayoutSearchBar, SelectionCheckbox, usePersistedLayout } from '@/components/collection-controls';
import { ImageUpload } from '@/components/image-upload';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Partner = {
  id: string;
  name: string;
  app_display_name?: string | null;
  slug: string;
  status: string;
  contact_name?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
  notes?: string | null;
  short_description?: string | null;
  brand_colour?: string | null;
  secondary_colour?: string | null;
  logo_url?: string | null;
  square_logo_url?: string | null;
  banner_image_url?: string | null;
  hero_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type Form = {
  name: string; app_display_name: string; slug: string; status: string; contact_name: string; contact_email: string;
  website_url: string; notes: string; short_description: string; brand_colour: string; secondary_colour: string;
  logo_url: string; square_logo_url: string; banner_image_url: string; hero_image_url: string;
};

const blank: Form = {
  name: '', app_display_name: '', slug: '', status: 'draft', contact_name: '', contact_email: '', website_url: '',
  notes: '', short_description: '', brand_colour: '#18b7ad', secondary_colour: '#10242b', logo_url: '',
  square_logo_url: '', banner_image_url: '', hero_image_url: '',
};

function group(row: Partner): Exclude<LifecycleView, 'all'> {
  if (row.deleted_at) return 'deleted';
  if (row.status === 'active') return 'active';
  if (row.status === 'draft') return 'draft';
  return 'archived';
}

function tone(status: string): 'good' | 'warn' | 'neutral' | 'info' {
  if (status === 'active') return 'good';
  if (status === 'paused') return 'warn';
  if (status === 'archived' || status === 'ended') return 'neutral';
  return 'info';
}

function toForm(row: Partner): Form {
  return {
    name: row.name, app_display_name: row.app_display_name ?? '', slug: row.slug, status: row.status,
    contact_name: row.contact_name ?? '', contact_email: row.contact_email ?? '', website_url: row.website_url ?? '',
    notes: row.notes ?? '', short_description: row.short_description ?? '', brand_colour: row.brand_colour ?? '#18b7ad',
    secondary_colour: row.secondary_colour ?? '#10242b', logo_url: row.logo_url ?? '', square_logo_url: row.square_logo_url ?? '',
    banner_image_url: row.banner_image_url ?? '', hero_image_url: row.hero_image_url ?? '',
  };
}

export function PartnerManager() {
  const [rows, setRows] = useState<Partner[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<LifecycleView>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { layout, update: setLayout, hydrate } = usePersistedLayout('hold-control-centre-partners-layout');

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase.from('partners').select('*').order('created_at', { ascending: false });
    if (loadError) { setError(loadError.message); setRows([]); } else { setRows((data as Partner[]) ?? []); setError(''); }
    setLoading(false);
  }

  useEffect(() => { hydrate(); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function launch(row?: Partner) {
    setEditing(row ?? null);
    setForm(row ? toForm(row) : blank);
    setError('');
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      app_display_name: form.app_display_name || null,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      website_url: form.website_url || null, contact_name: form.contact_name || null, contact_email: form.contact_email || null,
      short_description: form.short_description || null, logo_url: form.logo_url || null, square_logo_url: form.square_logo_url || null,
      banner_image_url: form.banner_image_url || null, hero_image_url: form.hero_image_url || null,
    };
    const result = editing ? await supabase.from('partners').update(payload).eq('id', editing.id) : await supabase.from('partners').insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setOpen(false); await load();
  }

  const counts = useMemo<Record<LifecycleView, number>>(() => {
    const result: Record<LifecycleView, number> = { all: 0, active: 0, draft: 0, archived: 0, deleted: 0 };
    rows.forEach((row) => { const current = group(row); result[current] += 1; if (current !== 'deleted') result.all += 1; });
    return result;
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const current = group(row);
      const matchesView = view === 'all' ? current !== 'deleted' : current === view;
      const haystack = `${row.name} ${row.app_display_name ?? ''} ${row.contact_name ?? ''} ${row.contact_email ?? ''} ${row.short_description ?? ''} ${row.status}`.toLowerCase();
      return matchesView && (!term || haystack.includes(term));
    });
  }, [rows, search, view]);

  const ids = visible.map((row) => row.id);
  const selectedIds = Array.from(selected);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const selectedRows = rows.filter((row) => selected.has(row.id));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAll() { setSelected((current) => { const next = new Set(current); if (allSelected) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id)); return next; }); }

  return <>
    <PageHeader title="Brand partners" description="Manage partner identities, contacts, artwork, lifecycle and app presentation." actions={<Button onClick={() => launch()}><Plus size={16} /> Add partner</Button>} />
    <Card className="catalogue-manager-card">
      <LifecycleTabs value={view} onChange={(next) => { setView(next); setSelected(new Set()); }} counts={counts} />
      <LayoutSearchBar layout={layout} onLayout={setLayout} search={search} onSearch={setSearch} placeholder="Search partners, contacts or status" extra={<ExportSelectedButton rows={selectedRows as Array<Record<string, unknown>>} filename="hold-partners.csv" />} />
      <BulkActionBar entityType="partner" noun="partner" selectedIds={selectedIds} visibleCount={ids.length} allVisibleSelected={allSelected} actions={view === 'deleted' ? deletedBulkActions : contentBulkActions} onToggleAll={toggleAll} onClear={() => setSelected(new Set())} onComplete={load} />
      {error ? <p className="error">{error}</p> : null}
      {loading ? <div className="bulk-loading">Loading partners…</div> : visible.length === 0 ? <EmptyState title="No partners found" body="Create a partner or change the current filters." /> : layout === 'tiles' ? (
        <div className="partner-grid management-tile-grid">
          {visible.map((row) => <article className={`partner-card management-selectable ${selected.has(row.id) ? 'selected' : ''}`} key={row.id}>
            <SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={row.name} />
            <div className="partner-card-banner" style={{ backgroundImage: row.banner_image_url ? `url(${row.banner_image_url})` : undefined, backgroundColor: row.brand_colour || '#18b7ad' }} />
            <div className="partner-card-body">
              <div className="partner-card-logo" style={{ backgroundImage: row.square_logo_url || row.logo_url ? `url(${row.square_logo_url || row.logo_url})` : undefined }}>{!row.square_logo_url && !row.logo_url ? row.name.slice(0, 1).toUpperCase() : null}</div>
              <div className="partner-card-title"><strong>{row.app_display_name || row.name}</strong><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></div>
              <p>{row.short_description || 'No brand description has been added yet.'}</p>
              <div className="partner-card-meta"><span>{row.contact_name || 'No contact'}</span><span>{formatDate(row.created_at)}</span></div>
              <Button className="secondary" onClick={() => launch(row)}>Edit partner</Button>
            </div>
          </article>)}
        </div>
      ) : (
        <div className="table-wrap management-list"><table><thead><tr><th className="selection-cell">Select</th><th>Partner</th><th>Status</th><th>Contact</th><th>Website</th><th>Created</th><th>Actions</th></tr></thead><tbody>
          {visible.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}>
            <td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td>
            <td><div className="catalogue-list-record"><div className="catalogue-list-thumbnail" style={{ backgroundImage: row.square_logo_url || row.logo_url ? `url(${row.square_logo_url || row.logo_url})` : undefined }} /><div><strong>{row.app_display_name || row.name}</strong><span>{row.short_description || row.slug}</span></div></div></td>
            <td><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></td>
            <td><strong>{row.contact_name || '—'}</strong><span className="record-subtitle"><Mail size={12} /> {row.contact_email || 'No email'}</span></td>
            <td>{row.website_url ? <a href={row.website_url} target="_blank" rel="noreferrer" className="inline-link">Visit <ExternalLink size={13} /></a> : '—'}</td>
            <td>{formatDate(row.created_at)}</td><td><Button className="secondary" onClick={() => launch(row)}>Edit</Button></td>
          </tr>)}
        </tbody></table></div>
      )}
    </Card>

    {open ? <Modal title={editing ? 'Edit brand partner' : 'Add brand partner'} onClose={() => setOpen(false)}><form onSubmit={save}>
      <div className="form-grid">
        <Field label="Legal / account name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="App display name"><Input value={form.app_display_name} onChange={(event) => setForm({ ...form, app_display_name: event.target.value })} /></Field>
        <Field label="Slug"><Input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Field>
        <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option><option value="archived">Archived</option></Select></Field>
        <Field label="Short brand description"><Textarea value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} /></Field>
        <Field label="Internal notes"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        <Field label="Website"><Input type="url" value={form.website_url} onChange={(event) => setForm({ ...form, website_url: event.target.value })} /></Field>
        <Field label="Contact name"><Input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></Field>
        <Field label="Contact email"><Input type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} /></Field>
        <Field label="Primary colour"><Input type="color" value={form.brand_colour} onChange={(event) => setForm({ ...form, brand_colour: event.target.value })} /></Field>
        <Field label="Secondary colour"><Input type="color" value={form.secondary_colour} onChange={(event) => setForm({ ...form, secondary_colour: event.target.value })} /></Field>
      </div>
      <div className="media-form-grid">
        <ImageUpload label="Brand logo" value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} pathPrefix={`partners/${form.slug || 'new'}/logo`} aspect="wide" ownerType="partner" ownerId={editing?.id} assetType="logo" hint="Transparent horizontal logo works best." />
        <ImageUpload label="Square app logo" value={form.square_logo_url} onChange={(url) => setForm({ ...form, square_logo_url: url })} pathPrefix={`partners/${form.slug || 'new'}/square-logo`} aspect="square" ownerType="partner" ownerId={editing?.id} assetType="square_logo" hint="Used on reward cards and partner lists." />
        <ImageUpload label="Partner banner" value={form.banner_image_url} onChange={(url) => setForm({ ...form, banner_image_url: url })} pathPrefix={`partners/${form.slug || 'new'}/banner`} aspect="wide" ownerType="partner" ownerId={editing?.id} assetType="banner" hint="Recommended 1600 × 600 or larger." />
        <ImageUpload label="Partner hero image" value={form.hero_image_url} onChange={(url) => setForm({ ...form, hero_image_url: url })} pathPrefix={`partners/${form.slug || 'new'}/hero`} aspect="portrait" ownerType="partner" ownerId={editing?.id} assetType="hero" hint="Lifestyle or product-led campaign artwork." />
      </div>
      {error ? <p className="error">{error}</p> : null}<div className="form-actions"><Button type="submit">Save partner</Button></div>
    </form></Modal> : null}
  </>;
}
