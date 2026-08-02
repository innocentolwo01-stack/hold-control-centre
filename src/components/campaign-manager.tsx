'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarRange, Plus } from 'lucide-react';

import { BulkActionBar, LifecycleTabs, contentBulkActions, deletedBulkActions, type LifecycleView } from '@/components/bulk-management';
import { ExportSelectedButton, LayoutSearchBar, SelectionCheckbox, usePersistedLayout } from '@/components/collection-controls';
import { ImageUpload } from '@/components/image-upload';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Partner = { id: string; name: string };
type Reward = { id: string; name: string; status: string; offer_type?: string | null };
type CampaignReward = { campaign_id: string; reward_id: string; placement: string; display_order: number; active: boolean };
type Campaign = {
  id: string; partner_id?: string | null; name: string; slug: string; campaign_type: string; short_description?: string | null;
  description?: string | null; terms?: string | null; status: string; starts_at?: string | null; ends_at?: string | null;
  hero_image_url?: string | null; mobile_banner_url?: string | null; thumbnail_url?: string | null; background_colour?: string | null;
  text_colour?: string | null; badge_text?: string | null; cta_label?: string | null; cta_url?: string | null; app_section: string;
  display_order: number; minimum_plan: string; target_countries?: string[] | null; target_age_bands?: string[] | null;
  target_profile_types?: string[] | null; created_at?: string | null; deleted_at?: string | null;
};

type Form = {
  partner_id: string; name: string; slug: string; campaign_type: string; short_description: string; description: string; terms: string;
  status: string; starts_at: string; ends_at: string; hero_image_url: string; mobile_banner_url: string; thumbnail_url: string;
  background_colour: string; text_colour: string; badge_text: string; cta_label: string; cta_url: string; app_section: string;
  display_order: string; minimum_plan: string; target_countries: string; target_age_bands: string; target_profile_types: string;
};

type Assignment = { selected: boolean; placement: string; displayOrder: string };

const blank: Form = {
  partner_id: '', name: '', slug: '', campaign_type: 'featured', short_description: '', description: '', terms: '', status: 'draft',
  starts_at: '', ends_at: '', hero_image_url: '', mobile_banner_url: '', thumbnail_url: '', background_colour: '#18b7ad',
  text_colour: '#ffffff', badge_text: '', cta_label: 'View rewards', cta_url: '', app_section: 'featured', display_order: '0',
  minimum_plan: 'free', target_countries: 'GB', target_age_bands: '', target_profile_types: '',
};

function localDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
function split(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function group(row: Campaign): Exclude<LifecycleView, 'all'> {
  if (row.deleted_at) return 'deleted';
  if (row.status === 'active') return 'active';
  if (row.status === 'draft' || row.status === 'scheduled') return 'draft';
  return 'archived';
}
function tone(status: string): 'good' | 'warn' | 'neutral' | 'info' {
  if (status === 'active') return 'good';
  if (status === 'scheduled' || status === 'paused') return 'warn';
  if (status === 'archived' || status === 'ended') return 'neutral';
  return 'info';
}

export function CampaignManager() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [links, setLinks] = useState<CampaignReward[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<LifecycleView>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { layout, update: setLayout, hydrate } = usePersistedLayout('hold-control-centre-campaigns-layout');

  async function load() {
    setLoading(true);
    const [campaignResult, partnerResult, rewardResult, linkResult] = await Promise.all([
      supabase.from('campaigns').select('*').order('display_order').order('created_at', { ascending: false }),
      supabase.from('partners').select('id,name').is('deleted_at', null).order('name'),
      supabase.from('rewards').select('id,name,status,offer_type').is('deleted_at', null).order('name'),
      supabase.from('campaign_rewards').select('*'),
    ]);
    if (campaignResult.error) { setError(campaignResult.error.message); setRows([]); } else { setRows((campaignResult.data as Campaign[]) ?? []); setError(''); }
    if (!partnerResult.error) setPartners((partnerResult.data as Partner[]) ?? []);
    if (!rewardResult.error) setRewards((rewardResult.data as Reward[]) ?? []);
    if (!linkResult.error) setLinks((linkResult.data as CampaignReward[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { hydrate(); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function launch(row?: Campaign) {
    setEditing(row ?? null);
    setForm(row ? {
      partner_id: row.partner_id ?? '', name: row.name, slug: row.slug, campaign_type: row.campaign_type,
      short_description: row.short_description ?? '', description: row.description ?? '', terms: row.terms ?? '', status: row.status,
      starts_at: localDateTime(row.starts_at), ends_at: localDateTime(row.ends_at), hero_image_url: row.hero_image_url ?? '',
      mobile_banner_url: row.mobile_banner_url ?? '', thumbnail_url: row.thumbnail_url ?? '', background_colour: row.background_colour ?? '#18b7ad',
      text_colour: row.text_colour ?? '#ffffff', badge_text: row.badge_text ?? '', cta_label: row.cta_label ?? 'View rewards',
      cta_url: row.cta_url ?? '', app_section: row.app_section, display_order: String(row.display_order), minimum_plan: row.minimum_plan,
      target_countries: (row.target_countries ?? []).join(', '), target_age_bands: (row.target_age_bands ?? []).join(', '),
      target_profile_types: (row.target_profile_types ?? []).join(', '),
    } : blank);
    const existing = new Map(links.filter((link) => link.campaign_id === row?.id).map((link) => [link.reward_id, link]));
    setAssignments(Object.fromEntries(rewards.map((reward) => {
      const link = existing.get(reward.id);
      return [reward.id, { selected: Boolean(link), placement: link?.placement ?? 'carousel', displayOrder: String(link?.display_order ?? 0) }];
    })));
    setError(''); setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = {
      partner_id: form.partner_id || null, name: form.name,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      campaign_type: form.campaign_type, short_description: form.short_description || null, description: form.description || null,
      terms: form.terms || null, status: form.status, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null, hero_image_url: form.hero_image_url || null,
      mobile_banner_url: form.mobile_banner_url || null, thumbnail_url: form.thumbnail_url || null,
      background_colour: form.background_colour, text_colour: form.text_colour, badge_text: form.badge_text || null,
      cta_label: form.cta_label || null, cta_url: form.cta_url || null, app_section: form.app_section,
      display_order: Number(form.display_order), minimum_plan: form.minimum_plan,
      target_countries: split(form.target_countries).map((value) => value.toUpperCase()), target_age_bands: split(form.target_age_bands),
      target_profile_types: split(form.target_profile_types), updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from('campaigns').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('campaigns').insert(payload).select('id').single();
    if (result.error || !result.data) { setError(result.error?.message ?? 'Campaign could not be saved.'); return; }
    const campaignId = result.data.id as string;
    const selectedLinks = Object.entries(assignments).filter(([, value]) => value.selected).map(([rewardId, value]) => ({
      campaign_id: campaignId, reward_id: rewardId, placement: value.placement, display_order: Number(value.displayOrder), active: true,
    }));
    const deleteResult = await supabase.from('campaign_rewards').delete().eq('campaign_id', campaignId);
    if (deleteResult.error) { setError(deleteResult.error.message); return; }
    if (selectedLinks.length) {
      const linkResult = await supabase.from('campaign_rewards').insert(selectedLinks);
      if (linkResult.error) { setError(linkResult.error.message); return; }
    }
    setOpen(false); await load();
  }

  const partnerNames = useMemo(() => new Map(partners.map((row) => [row.id, row.name])), [partners]);
  const linkedCounts = useMemo(() => { const map = new Map<string, number>(); links.forEach((link) => map.set(link.campaign_id, (map.get(link.campaign_id) ?? 0) + 1)); return map; }, [links]);
  const counts = useMemo<Record<LifecycleView, number>>(() => {
    const result: Record<LifecycleView, number> = { all: 0, active: 0, draft: 0, archived: 0, deleted: 0 };
    rows.forEach((row) => { const current = group(row); result[current] += 1; if (current !== 'deleted') result.all += 1; }); return result;
  }, [rows]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const current = group(row); const matchesView = view === 'all' ? current !== 'deleted' : current === view;
      const partner = row.partner_id ? partnerNames.get(row.partner_id) ?? '' : 'multi-brand';
      return matchesView && (!term || `${row.name} ${row.short_description ?? ''} ${row.campaign_type} ${row.status} ${partner}`.toLowerCase().includes(term));
    });
  }, [partnerNames, rows, search, view]);
  const ids = visible.map((row) => row.id); const selectedIds = Array.from(selected); const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const selectedRows = rows.filter((row) => selected.has(row.id));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAll() { setSelected((current) => { const next = new Set(current); if (allSelected) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id)); return next; }); }

  return <>
    <PageHeader title="Campaigns" description="Build, schedule and bulk-manage seasonal collections, brand takeovers and targeted promotions." actions={<Button onClick={() => launch()}><Plus size={16} /> New campaign</Button>} />
    <Card className="catalogue-manager-card">
      <LifecycleTabs value={view} onChange={(next) => { setView(next); setSelected(new Set()); }} counts={counts} />
      <LayoutSearchBar layout={layout} onLayout={setLayout} search={search} onSearch={setSearch} placeholder="Search campaigns, partner, type or status" extra={<ExportSelectedButton rows={selectedRows as Array<Record<string, unknown>>} filename="hold-campaigns.csv" />} />
      <BulkActionBar entityType="campaign" noun="campaign" selectedIds={selectedIds} visibleCount={ids.length} allVisibleSelected={allSelected} actions={view === 'deleted' ? deletedBulkActions : contentBulkActions} onToggleAll={toggleAll} onClear={() => setSelected(new Set())} onComplete={load} />
      {error ? <p className="error">{error}</p> : null}
      {loading ? <div className="bulk-loading">Loading campaigns…</div> : visible.length === 0 ? <EmptyState title="No campaigns found" body="Create a campaign or change the current filters." /> : layout === 'tiles' ? (
        <div className="campaign-grid management-tile-grid">
          {visible.map((row) => <article className={`campaign-card management-selectable ${selected.has(row.id) ? 'selected' : ''}`} key={row.id} style={{ backgroundColor: row.background_colour || '#18b7ad', color: row.text_colour || '#fff' }}>
            <SelectionCheckbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} label={row.name} />
            <div className="campaign-card-art" style={{ backgroundImage: row.mobile_banner_url || row.hero_image_url ? `url(${row.mobile_banner_url || row.hero_image_url})` : undefined }}>{row.badge_text ? <span className="campaign-badge">{row.badge_text}</span> : null}</div>
            <div className="campaign-card-body"><div className="campaign-card-title"><h3>{row.name}</h3><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></div>
              <p>{row.short_description || row.description || 'No campaign description added.'}</p>
              <div className="campaign-meta"><span>{row.partner_id ? partnerNames.get(row.partner_id) ?? 'Partner' : 'Multi-brand'}</span><span>{linkedCounts.get(row.id) ?? 0} rewards</span></div>
              <div className="campaign-meta"><span>{formatDate(row.starts_at)}</span><span>{formatDate(row.ends_at)}</span></div>
              <Button className="secondary" onClick={() => launch(row)}>Edit campaign</Button>
            </div>
          </article>)}
        </div>
      ) : (
        <div className="table-wrap management-list"><table><thead><tr><th className="selection-cell">Select</th><th>Campaign</th><th>Status</th><th>Partner</th><th>Rewards</th><th>Schedule</th><th>Plan</th><th>Actions</th></tr></thead><tbody>
          {visible.map((row) => <tr key={row.id} className={selected.has(row.id) ? 'selected-row' : ''}><td className="selection-cell"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td>
            <td><div className="catalogue-list-record"><div className="catalogue-list-thumbnail" style={{ backgroundImage: row.thumbnail_url || row.mobile_banner_url ? `url(${row.thumbnail_url || row.mobile_banner_url})` : undefined }} /><div><strong>{row.name}</strong><span>{row.short_description || titleCase(row.campaign_type)}</span></div></div></td>
            <td><Badge tone={tone(row.status)}>{titleCase(row.status)}</Badge></td><td>{row.partner_id ? partnerNames.get(row.partner_id) ?? 'Partner' : 'Multi-brand'}</td><td>{linkedCounts.get(row.id) ?? 0}</td>
            <td>{formatDate(row.starts_at)}<span className="record-subtitle">to {formatDate(row.ends_at)}</span></td><td>{titleCase(row.minimum_plan)}</td><td><Button className="secondary" onClick={() => launch(row)}>Edit</Button></td>
          </tr>)}
        </tbody></table></div>
      )}
    </Card>

    {open ? <Modal title={editing ? 'Edit campaign' : 'New campaign'} onClose={() => setOpen(false)}><form onSubmit={save}>
      <div className="form-section-title"><h3>Campaign identity</h3><p>Artwork and copy shown in banners, carousels and landing pages.</p></div>
      <div className="form-grid">
        <Field label="Campaign name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Slug"><Input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Field>
        <Field label="Partner"><Select value={form.partner_id} onChange={(event) => setForm({ ...form, partner_id: event.target.value })}><option value="">Multi-brand / Hold campaign</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</Select></Field>
        <Field label="Campaign type"><Select value={form.campaign_type} onChange={(event) => setForm({ ...form, campaign_type: event.target.value })}><option value="featured">Featured</option><option value="seasonal">Seasonal</option><option value="partner">Partner</option><option value="launch">Launch</option><option value="retention">Retention</option><option value="acquisition">Acquisition</option><option value="family">Family</option><option value="student">Student</option><option value="location">Location</option><option value="other">Other</option></Select></Field>
        <Field label="Short description"><Textarea value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} /></Field>
        <Field label="Full description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <Field label="Campaign terms"><Textarea value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></Field>
        <Field label="Badge text"><Input value={form.badge_text} onChange={(event) => setForm({ ...form, badge_text: event.target.value })} /></Field>
        <Field label="CTA label"><Input value={form.cta_label} onChange={(event) => setForm({ ...form, cta_label: event.target.value })} /></Field>
        <Field label="CTA URL"><Input value={form.cta_url} onChange={(event) => setForm({ ...form, cta_url: event.target.value })} /></Field>
      </div>
      <div className="media-form-grid">
        <ImageUpload label="Campaign hero" value={form.hero_image_url} onChange={(url) => setForm({ ...form, hero_image_url: url })} pathPrefix={`campaigns/${form.slug || 'new'}/hero`} aspect="wide" ownerType="campaign" ownerId={editing?.id} assetType="hero" hint="Wide landing-page artwork." />
        <ImageUpload label="Mobile banner" value={form.mobile_banner_url} onChange={(url) => setForm({ ...form, mobile_banner_url: url })} pathPrefix={`campaigns/${form.slug || 'new'}/mobile-banner`} aspect="wide" ownerType="campaign" ownerId={editing?.id} assetType="banner" hint="Recommended 1600 × 900 or larger." />
        <ImageUpload label="Campaign thumbnail" value={form.thumbnail_url} onChange={(url) => setForm({ ...form, thumbnail_url: url })} pathPrefix={`campaigns/${form.slug || 'new'}/thumbnail`} aspect="square" ownerType="campaign" ownerId={editing?.id} assetType="thumbnail" hint="Used in compact lists." />
      </div>
      <div className="form-section-title"><h3>Schedule and audience</h3><p>Choose when, where and for whom the campaign appears.</p></div>
      <div className="form-grid">
        <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option><option value="archived">Archived</option></Select></Field>
        <Field label="App section"><Select value={form.app_section} onChange={(event) => setForm({ ...form, app_section: event.target.value })}><option value="featured">Featured</option><option value="products_of_week">Products of the Week</option><option value="food_drink">Food & Drink</option><option value="family">Family</option><option value="coupons">Coupons</option><option value="seasonal">Seasonal</option></Select></Field>
        <Field label="Starts at"><Input type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></Field>
        <Field label="Ends at"><Input type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></Field>
        <Field label="Minimum plan"><Select value={form.minimum_plan} onChange={(event) => setForm({ ...form, minimum_plan: event.target.value })}><option value="free">Free</option><option value="plus">Plus</option><option value="premium">Premium</option><option value="family">Family</option></Select></Field>
        <Field label="Display order"><Input type="number" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: event.target.value })} /></Field>
        <Field label="Countries"><Input value={form.target_countries} onChange={(event) => setForm({ ...form, target_countries: event.target.value })} placeholder="GB, UG" /></Field>
        <Field label="Age bands"><Input value={form.target_age_bands} onChange={(event) => setForm({ ...form, target_age_bands: event.target.value })} /></Field>
        <Field label="Profile types"><Input value={form.target_profile_types} onChange={(event) => setForm({ ...form, target_profile_types: event.target.value })} /></Field>
        <Field label="Background colour"><Input type="color" value={form.background_colour} onChange={(event) => setForm({ ...form, background_colour: event.target.value })} /></Field>
        <Field label="Text colour"><Input type="color" value={form.text_colour} onChange={(event) => setForm({ ...form, text_colour: event.target.value })} /></Field>
      </div>
      <div className="form-section-title"><h3>Campaign rewards</h3><p>Select the offers included in this campaign.</p></div>
      <div className="assignment-list">
        {rewards.map((reward) => { const assignment = assignments[reward.id] ?? { selected: false, placement: 'carousel', displayOrder: '0' }; return <div className="assignment-row" key={reward.id}>
          <label><input type="checkbox" checked={assignment.selected} onChange={(event) => setAssignments({ ...assignments, [reward.id]: { ...assignment, selected: event.target.checked } })} /><span><strong>{reward.name}</strong><small>{titleCase(reward.offer_type || 'reward')} · {titleCase(reward.status)}</small></span></label>
          <Select value={assignment.placement} onChange={(event) => setAssignments({ ...assignments, [reward.id]: { ...assignment, placement: event.target.value } })} disabled={!assignment.selected}><option value="carousel">Carousel</option><option value="hero">Hero</option><option value="grid">Grid</option></Select>
          <Input type="number" value={assignment.displayOrder} onChange={(event) => setAssignments({ ...assignments, [reward.id]: { ...assignment, displayOrder: event.target.value } })} disabled={!assignment.selected} />
        </div>; })}
      </div>
      {error ? <p className="error">{error}</p> : null}<div className="form-actions"><Button type="submit">Save campaign</Button></div>
    </form></Modal> : null}
  </>;
}
