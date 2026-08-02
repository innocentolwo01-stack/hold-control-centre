'use client';

import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, LoaderCircle, Plus, Search } from 'lucide-react';

import { BulkActionBar, LifecycleTabs, contentBulkActions, deletedBulkActions, type LifecycleView } from '@/components/bulk-management';
import { ImageUpload } from '@/components/image-upload';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type CatalogueKind = 'reward' | 'coupon';
type LayoutMode = 'tiles' | 'list';
type Partner = { id: string; name: string };

type RewardRecord = {
  id: string;
  partner_id?: string | null;
  name: string;
  slug: string;
  category: string;
  points_cost: number;
  redemption_method: string;
  barcode_format?: string | null;
  status: string;
  cooldown_hours: number;
  display_seconds: number;
  featured: boolean;
  sponsored?: boolean | null;
  minimum_plan: string;
  description?: string | null;
  short_description?: string | null;
  subtitle?: string | null;
  terms?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  hero_image_url?: string | null;
  badge_text?: string | null;
  cta_label?: string | null;
  availability_text?: string | null;
  background_colour?: string | null;
  text_colour?: string | null;
  display_order?: number | null;
  app_section?: string | null;
  offer_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type Form = {
  partner_id: string;
  name: string;
  slug: string;
  category: string;
  points_cost: string;
  redemption_method: string;
  barcode_format: string;
  status: string;
  cooldown_hours: string;
  display_seconds: string;
  featured: boolean;
  sponsored: boolean;
  minimum_plan: string;
  description: string;
  short_description: string;
  subtitle: string;
  terms: string;
  image_url: string;
  thumbnail_url: string;
  hero_image_url: string;
  badge_text: string;
  cta_label: string;
  availability_text: string;
  background_colour: string;
  text_colour: string;
  display_order: string;
  app_section: string;
};

function blankForm(kind: CatalogueKind): Form {
  const coupon = kind === 'coupon';
  return {
    partner_id: '',
    name: '',
    slug: '',
    category: coupon ? 'coupons' : 'other',
    points_cost: '0',
    redemption_method: coupon ? 'unique_code_pool' : 'hold_token',
    barcode_format: 'qr',
    status: 'draft',
    cooldown_hours: '24',
    display_seconds: '25',
    featured: false,
    sponsored: false,
    minimum_plan: 'free',
    description: '',
    short_description: '',
    subtitle: '',
    terms: '',
    image_url: '',
    thumbnail_url: '',
    hero_image_url: '',
    badge_text: '',
    cta_label: coupon ? 'Get coupon' : 'Redeem',
    availability_text: 'Available',
    background_colour: '#ffffff',
    text_colour: '#13212a',
    display_order: '0',
    app_section: coupon ? 'coupons' : 'featured',
  };
}

function lifecycleGroup(row: RewardRecord): Exclude<LifecycleView, 'all'> {
  if (row.deleted_at) return 'deleted';
  if (row.status === 'active') return 'active';
  if (row.status === 'draft') return 'draft';
  return 'archived';
}

function statusTone(status: string): 'good' | 'warn' | 'neutral' | 'info' {
  if (status === 'active') return 'good';
  if (status === 'paused' || status === 'scheduled') return 'warn';
  if (status === 'ended' || status === 'archived') return 'neutral';
  return 'info';
}

function isKind(row: RewardRecord, kind: CatalogueKind) {
  return kind === 'coupon' ? row.offer_type === 'coupon' : row.offer_type !== 'coupon';
}

function formFromRecord(row: RewardRecord): Form {
  return {
    partner_id: row.partner_id ?? '',
    name: row.name,
    slug: row.slug,
    category: row.category,
    points_cost: String(row.points_cost),
    redemption_method: row.redemption_method,
    barcode_format: row.barcode_format ?? 'qr',
    status: row.status,
    cooldown_hours: String(row.cooldown_hours),
    display_seconds: String(row.display_seconds),
    featured: row.featured,
    sponsored: row.sponsored ?? false,
    minimum_plan: row.minimum_plan,
    description: row.description ?? '',
    short_description: row.short_description ?? '',
    subtitle: row.subtitle ?? '',
    terms: row.terms ?? '',
    image_url: row.image_url ?? '',
    thumbnail_url: row.thumbnail_url ?? '',
    hero_image_url: row.hero_image_url ?? '',
    badge_text: row.badge_text ?? '',
    cta_label: row.cta_label ?? 'Redeem',
    availability_text: row.availability_text ?? 'Available',
    background_colour: row.background_colour ?? '#ffffff',
    text_colour: row.text_colour ?? '#13212a',
    display_order: String(row.display_order ?? 0),
    app_section: row.app_section ?? 'featured',
  };
}

export function RewardCatalogueManager({ kind }: { kind: CatalogueKind }) {
  const plural = kind === 'coupon' ? 'Coupons' : 'Rewards';
  const singular = kind === 'coupon' ? 'coupon' : 'reward';
  const storageKey = `hold-control-centre-${kind}-layout`;

  const [rows, setRows] = useState<RewardRecord[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState<Form>(() => blankForm(kind));
  const [editing, setEditing] = useState<RewardRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<LayoutMode>('tiles');
  const [view, setView] = useState<LifecycleView>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'tiles' || saved === 'list') setLayout(saved);
  }, [storageKey]);

  function changeLayout(next: LayoutMode) {
    setLayout(next);
    window.localStorage.setItem(storageKey, next);
  }

  async function load() {
    setLoading(true);
    setError('');

    const [rewardResult, partnerResult] = await Promise.all([
      supabase.from('rewards').select('*').order('display_order').order('created_at', { ascending: false }),
      supabase.from('partners').select('id,name').order('name'),
    ]);

    if (rewardResult.error) {
      setError(rewardResult.error.message);
      setRows([]);
    } else {
      setRows((((rewardResult.data as RewardRecord[]) ?? []).filter((row) => isKind(row, kind))));
    }

    if (!partnerResult.error) setPartners((partnerResult.data as Partner[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    setSelected(new Set());
    setView('all');
    setSearch('');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function launch(record?: RewardRecord) {
    setEditing(record ?? null);
    setForm(record ? formFromRecord(record) : blankForm(kind));
    setError('');
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const payload = {
      ...form,
      offer_type: kind,
      partner_id: form.partner_id || null,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      points_cost: Number(form.points_cost),
      cooldown_hours: Number(form.cooldown_hours),
      display_seconds: Number(form.display_seconds),
      display_order: Number(form.display_order),
      image_url: form.image_url || null,
      thumbnail_url: form.thumbnail_url || null,
      hero_image_url: form.hero_image_url || null,
      short_description: form.short_description || null,
      subtitle: form.subtitle || null,
      badge_text: form.badge_text || null,
      availability_text: form.availability_text || null,
    };

    const query = editing
      ? supabase.from('rewards').update(payload).eq('id', editing.id)
      : supabase.from('rewards').insert(payload);
    const { error: saveError } = await query;

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setOpen(false);
    await load();
  }

  const partnerName = useMemo(() => new Map(partners.map((partner) => [partner.id, partner.name])), [partners]);

  const counts = useMemo<Record<LifecycleView, number>>(() => {
    const result: Record<LifecycleView, number> = { all: 0, active: 0, draft: 0, archived: 0, deleted: 0 };
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
      const partner = row.partner_id ? partnerName.get(row.partner_id) ?? '' : 'Hold';
      const haystack = `${row.name} ${row.short_description ?? ''} ${row.description ?? ''} ${partner} ${row.status} ${row.category}`.toLowerCase();
      return matchesView && (!term || haystack.includes(term));
    });
  }, [partnerName, rows, search, view]);

  const visibleIds = visibleRows.map((row) => row.id);
  const selectedIds = Array.from(selected);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const actions = view === 'deleted' ? deletedBulkActions : contentBulkActions;

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
        title={`${plural} catalogue`}
        description={kind === 'coupon'
          ? 'Create and manage online coupon offers, codes, artwork, targeting and redemption rules.'
          : 'Create retail-quality reward cards with branded artwork, copy, merchandising placement and redemption rules.'}
        actions={(
          <div className="catalogue-header-actions">
            <div className="catalogue-view-toggle" role="group" aria-label={`${plural} layout`}>
              <button
                type="button"
                className={layout === 'tiles' ? 'active' : ''}
                aria-pressed={layout === 'tiles'}
                onClick={() => changeLayout('tiles')}
              >
                <LayoutGrid size={16} /> Tiles
              </button>
              <button
                type="button"
                className={layout === 'list' ? 'active' : ''}
                aria-pressed={layout === 'list'}
                onClick={() => changeLayout('list')}
              >
                <List size={16} /> List
              </button>
            </div>
            <Button onClick={() => launch()}><Plus size={16} /> New {singular}</Button>
          </div>
        )}
      />

      <Card className="catalogue-manager-card">
        <LifecycleTabs value={view} onChange={changeView} counts={counts} />

        <div className="catalogue-toolbar">
          <div className="catalogue-search">
            <Search size={17} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${plural.toLowerCase()}`}
            />
          </div>
          <span>{visibleRows.length} shown</span>
        </div>

        <BulkActionBar
          entityType={kind}
          noun={singular}
          selectedIds={selectedIds}
          visibleCount={visibleRows.length}
          allVisibleSelected={allVisibleSelected}
          actions={actions}
          onToggleAll={toggleAll}
          onClear={() => setSelected(new Set())}
          onComplete={load}
        />

        {loading ? (
          <div className="bulk-loading"><LoaderCircle className="spin-icon" size={26} /> Loading {plural.toLowerCase()}…</div>
        ) : error && !open ? (
          <p className="error">{error}</p>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={`No ${plural.toLowerCase()} found`}
            body={`Create the first ${singular}, or change the status tab and search filters.`}
          />
        ) : layout === 'tiles' ? (
          <div className="reward-admin-grid catalogue-tile-grid">
            {visibleRows.map((row) => (
              <article
                className={`reward-admin-card catalogue-selectable-card${selected.has(row.id) ? ' selected' : ''}`}
                key={row.id}
                style={{ backgroundColor: row.background_colour || '#fff', color: row.text_colour || '#13212a' }}
              >
                <label className="catalogue-card-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Select ${row.name}`}
                  />
                  <span>Select</span>
                </label>
                <div
                  className="reward-admin-image"
                  style={{ backgroundImage: row.image_url || row.thumbnail_url ? `url(${row.image_url || row.thumbnail_url})` : undefined }}
                >
                  {row.badge_text ? <span className="reward-card-badge">{row.badge_text}</span> : null}
                  {row.sponsored ? <span className="reward-card-sponsored">Partner</span> : null}
                </div>
                <div className="reward-admin-body">
                  <div className="reward-card-status">
                    <span>{row.availability_text || `${row.points_cost} points`}</span>
                    <Badge tone={statusTone(row.status)}>{row.deleted_at ? 'Deleted' : titleCase(row.status)}</Badge>
                  </div>
                  <h3>{row.name}</h3>
                  <p>{row.short_description || row.description || `Add a short customer-facing ${singular} description.`}</p>
                  <small>{row.partner_id ? partnerName.get(row.partner_id) ?? 'Unknown partner' : 'Hold'}</small>
                  <div className="catalogue-card-meta">
                    <span>{titleCase(row.category)}</span>
                    <span>{formatDate(row.deleted_at || row.updated_at || row.created_at)}</span>
                  </div>
                  <div className="reward-admin-footer">
                    <strong>{row.points_cost} points</strong>
                    <Button className="secondary" onClick={() => launch(row)}>Edit</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-wrap catalogue-list-wrap">
            <table>
              <thead>
                <tr>
                  <th className="selection-cell">Select</th>
                  <th>{singular === 'coupon' ? 'Coupon' : 'Reward'}</th>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>Points</th>
                  <th>Category</th>
                  <th>Updated</th>
                  <th>Action</th>
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
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    <td>
                      <div className="catalogue-list-record">
                        <div
                          className="catalogue-list-thumbnail"
                          style={{ backgroundImage: row.thumbnail_url || row.image_url ? `url(${row.thumbnail_url || row.image_url})` : undefined }}
                        />
                        <div>
                          <strong>{row.name}</strong>
                          <span>{row.short_description || row.subtitle || row.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td>{row.partner_id ? partnerName.get(row.partner_id) ?? 'Unknown partner' : 'Hold'}</td>
                    <td><Badge tone={statusTone(row.status)}>{row.deleted_at ? 'Deleted' : titleCase(row.status)}</Badge></td>
                    <td>{row.points_cost}</td>
                    <td>{titleCase(row.category)}</td>
                    <td>{formatDate(row.deleted_at || row.updated_at || row.created_at)}</td>
                    <td><Button className="secondary" onClick={() => launch(row)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open ? (
        <Modal title={editing ? `Edit ${singular}` : `New ${singular}`} onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <div className="form-section-title">
              <h3>Customer-facing content</h3>
              <p>This appears on the card and detail screen in the app.</p>
            </div>
            <div className="form-grid">
              <Field label={`${titleCase(singular)} title`}><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Slug"><Input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Field>
              <Field label="Subtitle"><Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></Field>
              <Field label="Short card description"><Textarea value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} /></Field>
              <Field label="Full description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
              <Field label="Terms and conditions"><Textarea value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></Field>
              <Field label="Card badge"><Input value={form.badge_text} onChange={(event) => setForm({ ...form, badge_text: event.target.value })} /></Field>
              <Field label="Availability label"><Input value={form.availability_text} onChange={(event) => setForm({ ...form, availability_text: event.target.value })} /></Field>
              <Field label="CTA label"><Input value={form.cta_label} onChange={(event) => setForm({ ...form, cta_label: event.target.value })} /></Field>
              <Field label="Partner">
                <Select value={form.partner_id} onChange={(event) => setForm({ ...form, partner_id: event.target.value })}>
                  <option value="">Hold / no partner</option>
                  {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
                </Select>
              </Field>
            </div>

            <div className="media-form-grid">
              <ImageUpload label={`${titleCase(singular)} card artwork`} value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} pathPrefix={`${kind}s/${form.slug || 'new'}/card`} aspect="portrait" ownerType="reward" ownerId={editing?.id} assetType="card" hint="Recommended portrait ratio 4:5, at least 1000 × 1250." />
              <ImageUpload label="Thumbnail" value={form.thumbnail_url} onChange={(url) => setForm({ ...form, thumbnail_url: url })} pathPrefix={`${kind}s/${form.slug || 'new'}/thumbnail`} aspect="square" ownerType="reward" ownerId={editing?.id} assetType="thumbnail" hint="Used in compact lists and notifications." />
              <ImageUpload label={`${titleCase(singular)} hero artwork`} value={form.hero_image_url} onChange={(url) => setForm({ ...form, hero_image_url: url })} pathPrefix={`${kind}s/${form.slug || 'new'}/hero`} aspect="wide" ownerType="reward" ownerId={editing?.id} assetType="hero" hint="Used on the detail screen." />
            </div>

            <div className="form-section-title">
              <h3>Merchandising and targeting</h3>
              <p>Controls where the offer appears and who can access it.</p>
            </div>
            <div className="form-grid">
              <Field label="Category"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
              <Field label="App section">
                <Select value={form.app_section} onChange={(event) => setForm({ ...form, app_section: event.target.value })}>
                  <option value="featured">Featured</option>
                  <option value="products_of_week">Products of the Week</option>
                  <option value="food_drink">Food & Drink</option>
                  <option value="family">Family</option>
                  <option value="coupons">Coupons</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Display order"><Input type="number" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: event.target.value })} /></Field>
              <Field label="Minimum plan">
                <Select value={form.minimum_plan} onChange={(event) => setForm({ ...form, minimum_plan: event.target.value })}>
                  <option value="free">Free</option><option value="plus">Plus</option><option value="premium">Premium</option><option value="family">Family</option>
                </Select>
              </Field>
              <Field label="Featured"><Select value={form.featured ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, featured: event.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></Select></Field>
              <Field label="Sponsored / partner offer"><Select value={form.sponsored ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, sponsored: event.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></Select></Field>
              <Field label="Card background"><Input type="color" value={form.background_colour} onChange={(event) => setForm({ ...form, background_colour: event.target.value })} /></Field>
              <Field label="Card text colour"><Input type="color" value={form.text_colour} onChange={(event) => setForm({ ...form, text_colour: event.target.value })} /></Field>
            </div>

            <div className="form-section-title">
              <h3>Redemption rules</h3>
              <p>Controls the points cost, temporary barcode and validation method.</p>
            </div>
            <div className="form-grid">
              <Field label="Points cost"><Input type="number" min="0" value={form.points_cost} onChange={(event) => setForm({ ...form, points_cost: event.target.value })} /></Field>
              <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option><option value="archived">Archived</option></Select></Field>
              <Field label="Redemption method">
                <Select value={form.redemption_method} onChange={(event) => setForm({ ...form, redemption_method: event.target.value })}>
                  <option value="hold_token">Hold one-time token</option>
                  <option value="unique_code_pool">Unique partner code pool</option>
                  <option value="partner_api">Partner API voucher</option>
                  <option value="shared_barcode">Shared partner barcode</option>
                  <option value="external_link">External link</option>
                  <option value="manual_confirmation">Manual confirmation</option>
                </Select>
              </Field>
              <Field label="Barcode format"><Select value={form.barcode_format} onChange={(event) => setForm({ ...form, barcode_format: event.target.value })}><option value="qr">QR</option><option value="code128">Code 128</option><option value="ean13">EAN-13</option><option value="upca">UPC-A</option><option value="data_matrix">Data Matrix</option></Select></Field>
              <Field label="Display seconds"><Input type="number" min="5" max="300" value={form.display_seconds} onChange={(event) => setForm({ ...form, display_seconds: event.target.value })} /></Field>
              <Field label="Cooldown hours"><Input type="number" min="0" value={form.cooldown_hours} onChange={(event) => setForm({ ...form, cooldown_hours: event.target.value })} /></Field>
            </div>

            {error ? <p className="error">{error}</p> : null}
            <div className="form-actions"><Button type="submit">Save {singular}</Button></div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
