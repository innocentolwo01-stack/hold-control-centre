'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ImageUpload } from '@/components/image-upload';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { titleCase } from '@/lib/format';

type Partner = { id: string; name: string };
type Reward = {
  id: string; partner_id?: string; name: string; slug: string; category: string; points_cost: number;
  redemption_method: string; barcode_format?: string; status: string; cooldown_hours: number; display_seconds: number;
  featured: boolean; sponsored?: boolean; minimum_plan: string; description?: string; short_description?: string;
  subtitle?: string; terms?: string; image_url?: string; thumbnail_url?: string; hero_image_url?: string;
  badge_text?: string; cta_label?: string; availability_text?: string; background_colour?: string; text_colour?: string;
  display_order?: number; app_section?: string;
};

type Form = {
  partner_id: string; name: string; slug: string; category: string; points_cost: string; redemption_method: string;
  barcode_format: string; status: string; cooldown_hours: string; display_seconds: string; featured: boolean; sponsored: boolean;
  minimum_plan: string; description: string; short_description: string; subtitle: string; terms: string; image_url: string;
  thumbnail_url: string; hero_image_url: string; badge_text: string; cta_label: string; availability_text: string;
  background_colour: string; text_colour: string; display_order: string; app_section: string;
};

const blank: Form = {
  partner_id: '', name: '', slug: '', category: 'other', points_cost: '0', redemption_method: 'hold_token', barcode_format: 'qr',
  status: 'draft', cooldown_hours: '24', display_seconds: '25', featured: false, sponsored: false, minimum_plan: 'free',
  description: '', short_description: '', subtitle: '', terms: '', image_url: '', thumbnail_url: '', hero_image_url: '',
  badge_text: '', cta_label: 'Redeem', availability_text: 'Available', background_colour: '#ffffff', text_colour: '#13212a',
  display_order: '0', app_section: 'featured',
};

export default function RewardsPage() {
  const [rows, setRows] = useState<Reward[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [rewardResult, partnerResult] = await Promise.all([
      supabase.from('rewards').select('*').order('display_order').order('created_at', { ascending: false }),
      supabase.from('partners').select('id,name').order('name'),
    ]);
    if (rewardResult.error) setError(rewardResult.error.message); else setRows((rewardResult.data as Reward[]) ?? []);
    if (!partnerResult.error) setPartners((partnerResult.data as Partner[]) ?? []);
  }
  useEffect(() => { void load(); }, []);

  function launch(reward?: Reward) {
    setEditing(reward ?? null);
    setForm(reward ? {
      partner_id: reward.partner_id ?? '', name: reward.name, slug: reward.slug, category: reward.category,
      points_cost: String(reward.points_cost), redemption_method: reward.redemption_method, barcode_format: reward.barcode_format ?? 'qr',
      status: reward.status, cooldown_hours: String(reward.cooldown_hours), display_seconds: String(reward.display_seconds),
      featured: reward.featured, sponsored: reward.sponsored ?? false, minimum_plan: reward.minimum_plan,
      description: reward.description ?? '', short_description: reward.short_description ?? '', subtitle: reward.subtitle ?? '',
      terms: reward.terms ?? '', image_url: reward.image_url ?? '', thumbnail_url: reward.thumbnail_url ?? '',
      hero_image_url: reward.hero_image_url ?? '', badge_text: reward.badge_text ?? '', cta_label: reward.cta_label ?? 'Redeem',
      availability_text: reward.availability_text ?? 'Available', background_colour: reward.background_colour ?? '#ffffff',
      text_colour: reward.text_colour ?? '#13212a', display_order: String(reward.display_order ?? 0), app_section: reward.app_section ?? 'featured',
    } : blank);
    setError('');
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      partner_id: form.partner_id || null,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      points_cost: Number(form.points_cost), cooldown_hours: Number(form.cooldown_hours), display_seconds: Number(form.display_seconds),
      display_order: Number(form.display_order), image_url: form.image_url || null, thumbnail_url: form.thumbnail_url || null,
      hero_image_url: form.hero_image_url || null, short_description: form.short_description || null, subtitle: form.subtitle || null,
      badge_text: form.badge_text || null, availability_text: form.availability_text || null,
    };
    const query = editing ? supabase.from('rewards').update(payload).eq('id', editing.id) : supabase.from('rewards').insert(payload);
    const { error: saveError } = await query;
    if (saveError) { setError(saveError.message); return; }
    setOpen(false);
    await load();
  }

  const partnerName = useMemo(() => new Map(partners.map((partner) => [partner.id, partner.name])), [partners]);

  return <>
    <PageHeader title="Rewards catalogue" description="Create retail-quality reward cards with branded artwork, copy, merchandising placement and redemption rules." actions={<Button onClick={() => launch()}><Plus size={16} /> New reward</Button>} />
    <Card>
      {rows.length === 0 ? <EmptyState title="No rewards yet" body="Create the first reward, upload its card artwork and choose its redemption method." /> : (
        <div className="reward-admin-grid">
          {rows.map((row) => (
            <article className="reward-admin-card" key={row.id} style={{ backgroundColor: row.background_colour || '#fff', color: row.text_colour || '#13212a' }}>
              <div className="reward-admin-image" style={{ backgroundImage: row.image_url || row.thumbnail_url ? `url(${row.image_url || row.thumbnail_url})` : undefined }}>
                {row.badge_text ? <span className="reward-card-badge">{row.badge_text}</span> : null}
                {row.sponsored ? <span className="reward-card-sponsored">Partner</span> : null}
              </div>
              <div className="reward-admin-body">
                <div className="reward-card-status"><span>{row.availability_text || `${row.points_cost} points`}</span><Badge tone={row.status === 'active' ? 'good' : row.status === 'paused' ? 'warn' : 'neutral'}>{titleCase(row.status)}</Badge></div>
                <h3>{row.name}</h3>
                <p>{row.short_description || row.description || 'Add a short customer-facing description.'}</p>
                <small>{row.partner_id ? partnerName.get(row.partner_id) ?? 'Unknown partner' : 'Hold'}</small>
                <div className="reward-admin-footer"><strong>{row.points_cost} points</strong><Button className="secondary" onClick={() => launch(row)}>Edit</Button></div>
              </div>
            </article>
          ))}
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
    </Card>

    {open ? <Modal title={editing ? 'Edit reward' : 'New reward'} onClose={() => setOpen(false)}><form onSubmit={save}>
      <div className="form-section-title"><h3>Customer-facing content</h3><p>This is what appears on reward cards and the reward detail screen.</p></div>
      <div className="form-grid">
        <Field label="Reward title"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Slug"><Input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Field>
        <Field label="Subtitle"><Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} placeholder="Free regular popcorn at Vue" /></Field>
        <Field label="Short card description"><Textarea value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} /></Field>
        <Field label="Full description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <Field label="Terms and conditions"><Textarea value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></Field>
        <Field label="Card badge"><Input value={form.badge_text} onChange={(event) => setForm({ ...form, badge_text: event.target.value })} placeholder="Product of the week" /></Field>
        <Field label="Availability label"><Input value={form.availability_text} onChange={(event) => setForm({ ...form, availability_text: event.target.value })} placeholder="Available" /></Field>
        <Field label="CTA label"><Input value={form.cta_label} onChange={(event) => setForm({ ...form, cta_label: event.target.value })} /></Field>
        <Field label="Partner"><Select value={form.partner_id} onChange={(event) => setForm({ ...form, partner_id: event.target.value })}><option value="">Hold / no partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</Select></Field>
      </div>

      <div className="media-form-grid">
        <ImageUpload label="Reward card artwork" value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} pathPrefix={`rewards/${form.slug || 'new'}/card`} aspect="portrait" ownerType="reward" ownerId={editing?.id} assetType="card" hint="Recommended portrait ratio 4:5, at least 1000 × 1250." />
        <ImageUpload label="Thumbnail" value={form.thumbnail_url} onChange={(url) => setForm({ ...form, thumbnail_url: url })} pathPrefix={`rewards/${form.slug || 'new'}/thumbnail`} aspect="square" ownerType="reward" ownerId={editing?.id} assetType="thumbnail" hint="Used in compact lists and notifications." />
        <ImageUpload label="Reward hero artwork" value={form.hero_image_url} onChange={(url) => setForm({ ...form, hero_image_url: url })} pathPrefix={`rewards/${form.slug || 'new'}/hero`} aspect="wide" ownerType="reward" ownerId={editing?.id} assetType="hero" hint="Used on the reward detail screen." />
      </div>

      <div className="form-section-title"><h3>Merchandising and targeting</h3><p>Controls where the offer appears and who can access it.</p></div>
      <div className="form-grid">
        <Field label="Category"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Food & Drink" /></Field>
        <Field label="App section"><Select value={form.app_section} onChange={(event) => setForm({ ...form, app_section: event.target.value })}><option value="featured">Featured</option><option value="products_of_week">Products of the Week</option><option value="food_drink">Food & Drink</option><option value="family">Family</option><option value="coupons">Coupons</option><option value="other">Other</option></Select></Field>
        <Field label="Display order"><Input type="number" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: event.target.value })} /></Field>
        <Field label="Minimum plan"><Select value={form.minimum_plan} onChange={(event) => setForm({ ...form, minimum_plan: event.target.value })}><option value="free">Free</option><option value="plus">Plus</option><option value="premium">Premium</option><option value="family">Family</option></Select></Field>
        <Field label="Featured"><Select value={form.featured ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, featured: event.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></Select></Field>
        <Field label="Sponsored / partner offer"><Select value={form.sponsored ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, sponsored: event.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></Select></Field>
        <Field label="Card background"><Input type="color" value={form.background_colour} onChange={(event) => setForm({ ...form, background_colour: event.target.value })} /></Field>
        <Field label="Card text colour"><Input type="color" value={form.text_colour} onChange={(event) => setForm({ ...form, text_colour: event.target.value })} /></Field>
      </div>

      <div className="form-section-title"><h3>Redemption rules</h3><p>Controls the points cost, temporary barcode and partner validation method.</p></div>
      <div className="form-grid">
        <Field label="Points cost"><Input type="number" min="0" value={form.points_cost} onChange={(event) => setForm({ ...form, points_cost: event.target.value })} /></Field>
        <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option><option value="archived">Archived</option></Select></Field>
        <Field label="Redemption method"><Select value={form.redemption_method} onChange={(event) => setForm({ ...form, redemption_method: event.target.value })}><option value="hold_token">Hold one-time token</option><option value="unique_code_pool">Unique partner code pool</option><option value="partner_api">Partner API voucher</option><option value="shared_barcode">Shared partner barcode</option><option value="external_link">External link</option><option value="manual_confirmation">Manual confirmation</option></Select></Field>
        <Field label="Barcode format"><Select value={form.barcode_format} onChange={(event) => setForm({ ...form, barcode_format: event.target.value })}><option value="qr">QR</option><option value="code128">Code 128</option><option value="ean13">EAN-13</option><option value="upca">UPC-A</option><option value="data_matrix">Data Matrix</option></Select></Field>
        <Field label="Display seconds"><Input type="number" min="5" max="300" value={form.display_seconds} onChange={(event) => setForm({ ...form, display_seconds: event.target.value })} /></Field>
        <Field label="Cooldown hours"><Input type="number" min="0" value={form.cooldown_hours} onChange={(event) => setForm({ ...form, cooldown_hours: event.target.value })} /></Field>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="form-actions"><Button type="submit">Save reward</Button></div>
    </form></Modal> : null}
  </>;
}
