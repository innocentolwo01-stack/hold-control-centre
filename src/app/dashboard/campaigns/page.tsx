'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ImageUpload } from '@/components/image-upload';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';

type Partner = { id: string; name: string };
type Reward = { id: string; name: string; status: string; partner_id?: string; image_url?: string; thumbnail_url?: string };
type Campaign = {
  id: string; partner_id?: string; name: string; slug: string; campaign_type: string; short_description?: string;
  description?: string; terms?: string; status: string; starts_at?: string; ends_at?: string; hero_image_url?: string;
  mobile_banner_url?: string; thumbnail_url?: string; background_colour?: string; text_colour?: string; badge_text?: string;
  cta_label?: string; cta_url?: string; app_section: string; display_order: number; minimum_plan: string;
  target_countries?: string[]; target_age_bands?: string[]; target_profile_types?: string[]; created_at?: string;
};
type CampaignReward = { campaign_id: string; reward_id: string; placement: string; display_order: number; active: boolean };

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

function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [links, setLinks] = useState<CampaignReward[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [campaignResult, partnerResult, rewardResult, linkResult] = await Promise.all([
      supabase.from('campaigns').select('*').order('display_order').order('created_at', { ascending: false }),
      supabase.from('partners').select('id,name').order('name'),
      supabase.from('rewards').select('id,name,status,partner_id,image_url,thumbnail_url').order('name'),
      supabase.from('campaign_rewards').select('*'),
    ]);
    if (campaignResult.error) setError(campaignResult.error.message); else setCampaigns((campaignResult.data as Campaign[]) ?? []);
    if (!partnerResult.error) setPartners((partnerResult.data as Partner[]) ?? []);
    if (!rewardResult.error) setRewards((rewardResult.data as Reward[]) ?? []);
    if (!linkResult.error) setLinks((linkResult.data as CampaignReward[]) ?? []);
  }
  useEffect(() => { void load(); }, []);

  function launch(campaign?: Campaign) {
    setEditing(campaign ?? null);
    setForm(campaign ? {
      partner_id: campaign.partner_id ?? '', name: campaign.name, slug: campaign.slug, campaign_type: campaign.campaign_type,
      short_description: campaign.short_description ?? '', description: campaign.description ?? '', terms: campaign.terms ?? '',
      status: campaign.status, starts_at: localDateTime(campaign.starts_at), ends_at: localDateTime(campaign.ends_at),
      hero_image_url: campaign.hero_image_url ?? '', mobile_banner_url: campaign.mobile_banner_url ?? '', thumbnail_url: campaign.thumbnail_url ?? '',
      background_colour: campaign.background_colour ?? '#18b7ad', text_colour: campaign.text_colour ?? '#ffffff',
      badge_text: campaign.badge_text ?? '', cta_label: campaign.cta_label ?? 'View rewards', cta_url: campaign.cta_url ?? '',
      app_section: campaign.app_section, display_order: String(campaign.display_order), minimum_plan: campaign.minimum_plan,
      target_countries: (campaign.target_countries ?? []).join(', '), target_age_bands: (campaign.target_age_bands ?? []).join(', '),
      target_profile_types: (campaign.target_profile_types ?? []).join(', '),
    } : blank);

    const existing = new Map(links.filter((link) => link.campaign_id === campaign?.id).map((link) => [link.reward_id, link]));
    setAssignments(Object.fromEntries(rewards.map((reward) => {
      const link = existing.get(reward.id);
      return [reward.id, { selected: Boolean(link), placement: link?.placement ?? 'carousel', displayOrder: String(link?.display_order ?? 0) }];
    })));
    setError('');
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const payload = {
      partner_id: form.partner_id || null,
      name: form.name,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      campaign_type: form.campaign_type,
      short_description: form.short_description || null,
      description: form.description || null,
      terms: form.terms || null,
      status: form.status,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      hero_image_url: form.hero_image_url || null,
      mobile_banner_url: form.mobile_banner_url || null,
      thumbnail_url: form.thumbnail_url || null,
      background_colour: form.background_colour,
      text_colour: form.text_colour,
      badge_text: form.badge_text || null,
      cta_label: form.cta_label || null,
      cta_url: form.cta_url || null,
      app_section: form.app_section,
      display_order: Number(form.display_order),
      minimum_plan: form.minimum_plan,
      target_countries: splitList(form.target_countries).map((country) => country.toUpperCase()),
      target_age_bands: splitList(form.target_age_bands),
      target_profile_types: splitList(form.target_profile_types),
      updated_at: new Date().toISOString(),
    };

    const result = editing
      ? await supabase.from('campaigns').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('campaigns').insert(payload).select('id').single();
    if (result.error || !result.data) { setError(result.error?.message ?? 'Campaign could not be saved.'); return; }

    const campaignId = result.data.id as string;
    const selected = Object.entries(assignments)
      .filter(([, assignment]) => assignment.selected)
      .map(([rewardId, assignment]) => ({
        campaign_id: campaignId,
        reward_id: rewardId,
        placement: assignment.placement,
        display_order: Number(assignment.displayOrder),
        active: true,
      }));

    const { error: deleteError } = await supabase.from('campaign_rewards').delete().eq('campaign_id', campaignId);
    if (deleteError) { setError(deleteError.message); return; }
    if (selected.length > 0) {
      const { error: linkError } = await supabase.from('campaign_rewards').insert(selected);
      if (linkError) { setError(linkError.message); return; }
    }

    setOpen(false);
    await load();
  }

  const partnerName = useMemo(() => new Map(partners.map((partner) => [partner.id, partner.name])), [partners]);
  const linkedCount = useMemo(() => {
    const counts = new Map<string, number>();
    links.forEach((link) => counts.set(link.campaign_id, (counts.get(link.campaign_id) ?? 0) + 1));
    return counts;
  }, [links]);

  return <>
    <PageHeader title="Campaigns" description="Build seasonal collections, product-of-the-week carousels, brand takeovers and targeted reward promotions." actions={<Button onClick={() => launch()}><Plus size={16} /> New campaign</Button>} />
    <Card>
      {campaigns.length === 0 ? <EmptyState title="No campaigns yet" body="Create a campaign to group rewards, upload campaign artwork and schedule when it appears in the app." /> : (
        <div className="campaign-grid">
          {campaigns.map((campaign) => (
            <article className="campaign-card" key={campaign.id} style={{ backgroundColor: campaign.background_colour || '#18b7ad', color: campaign.text_colour || '#fff' }}>
              <div className="campaign-card-art" style={{ backgroundImage: campaign.mobile_banner_url || campaign.hero_image_url ? `url(${campaign.mobile_banner_url || campaign.hero_image_url})` : undefined }}>
                {campaign.badge_text ? <span className="campaign-badge">{campaign.badge_text}</span> : null}
              </div>
              <div className="campaign-card-body">
                <div className="campaign-card-title"><h3>{campaign.name}</h3><Badge tone={campaign.status === 'active' ? 'good' : campaign.status === 'scheduled' ? 'info' : campaign.status === 'paused' ? 'warn' : 'neutral'}>{titleCase(campaign.status)}</Badge></div>
                <p>{campaign.short_description || campaign.description || 'No campaign description added.'}</p>
                <div className="campaign-meta"><span>{campaign.partner_id ? partnerName.get(campaign.partner_id) ?? 'Partner' : 'Multi-brand'}</span><span>{linkedCount.get(campaign.id) ?? 0} rewards</span></div>
                <div className="campaign-meta"><span>{formatDate(campaign.starts_at)}</span><span>{formatDate(campaign.ends_at)}</span></div>
                <Button className="secondary" onClick={() => launch(campaign)}>Edit campaign</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
    </Card>

    {open ? <Modal title={editing ? 'Edit campaign' : 'New campaign'} onClose={() => setOpen(false)}><form onSubmit={save}>
      <div className="form-section-title"><h3>Campaign identity</h3><p>Artwork and copy shown in banners, carousels and landing pages.</p></div>
      <div className="form-grid">
        <Field label="Campaign name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Slug"><Input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Field>
        <Field label="Partner"><Select value={form.partner_id} onChange={(event) => setForm({ ...form, partner_id: event.target.value })}><option value="">Multi-brand / Hold campaign</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</Select></Field>
        <Field label="Campaign type"><Select value={form.campaign_type} onChange={(event) => setForm({ ...form, campaign_type: event.target.value })}><option value="featured">Featured</option><option value="seasonal">Seasonal</option><option value="partner">Partner campaign</option><option value="launch">Launch</option><option value="retention">Retention</option><option value="acquisition">Acquisition</option><option value="family">Family</option><option value="student">Student</option><option value="location">Location</option><option value="other">Other</option></Select></Field>
        <Field label="Short description"><Textarea value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} /></Field>
        <Field label="Full description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <Field label="Campaign terms"><Textarea value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></Field>
        <Field label="Badge text"><Input value={form.badge_text} onChange={(event) => setForm({ ...form, badge_text: event.target.value })} placeholder="Halloween rewards" /></Field>
        <Field label="CTA label"><Input value={form.cta_label} onChange={(event) => setForm({ ...form, cta_label: event.target.value })} /></Field>
        <Field label="CTA URL"><Input value={form.cta_url} onChange={(event) => setForm({ ...form, cta_url: event.target.value })} placeholder="hold://rewards/campaign/..." /></Field>
      </div>
      <div className="media-form-grid">
        <ImageUpload label="Campaign hero" value={form.hero_image_url} onChange={(url) => setForm({ ...form, hero_image_url: url })} pathPrefix={`campaigns/${form.slug || 'new'}/hero`} aspect="wide" ownerType="campaign" ownerId={editing?.id} assetType="hero" hint="Wide landing-page artwork." />
        <ImageUpload label="Mobile banner" value={form.mobile_banner_url} onChange={(url) => setForm({ ...form, mobile_banner_url: url })} pathPrefix={`campaigns/${form.slug || 'new'}/mobile-banner`} aspect="wide" ownerType="campaign" ownerId={editing?.id} assetType="banner" hint="Recommended 1600 × 900 or larger." />
        <ImageUpload label="Campaign thumbnail" value={form.thumbnail_url} onChange={(url) => setForm({ ...form, thumbnail_url: url })} pathPrefix={`campaigns/${form.slug || 'new'}/thumbnail`} aspect="square" ownerType="campaign" ownerId={editing?.id} assetType="thumbnail" hint="Used in compact campaign lists." />
      </div>

      <div className="form-section-title"><h3>Schedule and audience</h3><p>Choose when and where the campaign is shown.</p></div>
      <div className="form-grid">
        <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option><option value="archived">Archived</option></Select></Field>
        <Field label="App section"><Select value={form.app_section} onChange={(event) => setForm({ ...form, app_section: event.target.value })}><option value="featured">Featured</option><option value="products_of_week">Products of the Week</option><option value="food_drink">Food & Drink</option><option value="family">Family</option><option value="coupons">Coupons</option><option value="seasonal">Seasonal</option></Select></Field>
        <Field label="Starts at"><Input type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></Field>
        <Field label="Ends at"><Input type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></Field>
        <Field label="Minimum plan"><Select value={form.minimum_plan} onChange={(event) => setForm({ ...form, minimum_plan: event.target.value })}><option value="free">Free</option><option value="plus">Plus</option><option value="premium">Premium</option><option value="family">Family</option></Select></Field>
        <Field label="Display order"><Input type="number" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: event.target.value })} /></Field>
        <Field label="Target countries" hint="Comma-separated ISO codes, for example GB, UG"><Input value={form.target_countries} onChange={(event) => setForm({ ...form, target_countries: event.target.value })} /></Field>
        <Field label="Target age bands" hint="For example under-13, 13-17, 18-plus"><Input value={form.target_age_bands} onChange={(event) => setForm({ ...form, target_age_bands: event.target.value })} /></Field>
        <Field label="Target profile types" hint="For example adult, teen, child"><Input value={form.target_profile_types} onChange={(event) => setForm({ ...form, target_profile_types: event.target.value })} /></Field>
        <Field label="Background colour"><Input type="color" value={form.background_colour} onChange={(event) => setForm({ ...form, background_colour: event.target.value })} /></Field>
        <Field label="Text colour"><Input type="color" value={form.text_colour} onChange={(event) => setForm({ ...form, text_colour: event.target.value })} /></Field>
      </div>

      <div className="form-section-title"><h3>Campaign rewards</h3><p>Select the offers included and choose their placement inside this campaign.</p></div>
      <div className="campaign-reward-picker">
        {rewards.length === 0 ? <p className="muted">Create rewards before linking them to a campaign.</p> : rewards.map((reward) => {
          const assignment = assignments[reward.id] ?? { selected: false, placement: 'carousel', displayOrder: '0' };
          return (
            <div className={`campaign-reward-row ${assignment.selected ? 'selected' : ''}`} key={reward.id}>
              <label className="campaign-reward-check"><input type="checkbox" checked={assignment.selected} onChange={(event) => setAssignments({ ...assignments, [reward.id]: { ...assignment, selected: event.target.checked } })} /><span>{reward.name}</span><Badge tone={reward.status === 'active' ? 'good' : 'neutral'}>{titleCase(reward.status)}</Badge></label>
              <Select disabled={!assignment.selected} value={assignment.placement} onChange={(event) => setAssignments({ ...assignments, [reward.id]: { ...assignment, placement: event.target.value } })}><option value="hero">Hero</option><option value="carousel">Carousel</option><option value="grid">Grid</option><option value="products_of_week">Products of the Week</option><option value="featured">Featured</option><option value="category">Category</option><option value="notification">Notification</option></Select>
              <Input disabled={!assignment.selected} type="number" value={assignment.displayOrder} onChange={(event) => setAssignments({ ...assignments, [reward.id]: { ...assignment, displayOrder: event.target.value } })} aria-label={`${reward.name} order`} />
            </div>
          );
        })}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="form-actions"><Button type="submit"><CalendarRange size={16} /> Save campaign</Button></div>
    </form></Modal> : null}
  </>;
}
