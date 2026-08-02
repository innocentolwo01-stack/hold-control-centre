'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';

import { ImageUpload } from '@/components/image-upload';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Partner = {
  id: string;
  name: string;
  app_display_name?: string;
  slug: string;
  status: string;
  contact_name?: string;
  contact_email?: string;
  website_url?: string;
  notes?: string;
  short_description?: string;
  brand_colour?: string;
  secondary_colour?: string;
  logo_url?: string;
  square_logo_url?: string;
  banner_image_url?: string;
  hero_image_url?: string;
  created_at?: string;
};

type Form = {
  name: string;
  app_display_name: string;
  slug: string;
  status: string;
  contact_name: string;
  contact_email: string;
  website_url: string;
  notes: string;
  short_description: string;
  brand_colour: string;
  secondary_colour: string;
  logo_url: string;
  square_logo_url: string;
  banner_image_url: string;
  hero_image_url: string;
};

type SortColumn = 'created_at' | 'name' | 'status' | 'contact_name';
type SortDirection = 'asc' | 'desc';

const blank: Form = {
  name: '',
  app_display_name: '',
  slug: '',
  status: 'draft',
  contact_name: '',
  contact_email: '',
  website_url: '',
  notes: '',
  short_description: '',
  brand_colour: '#18b7ad',
  secondary_colour: '#10242b',
  logo_url: '',
  square_logo_url: '',
  banner_image_url: '',
  hero_image_url: '',
};

const PAGE_SIZES = [10, 25, 50, 100];

export default function PartnersPage() {
  const [rows, setRows] = useState<Partner[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [contactFilter, setContactFilter] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page) {
    setLoading(true);
    setError('');

    const from = (nextPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('partners')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    const cleanedSearch = search.trim().replace(/[%(),]/g, '');
    if (cleanedSearch) {
      query = query.or(
        [
          `name.ilike.%${cleanedSearch}%`,
          `app_display_name.ilike.%${cleanedSearch}%`,
          `slug.ilike.%${cleanedSearch}%`,
          `contact_name.ilike.%${cleanedSearch}%`,
          `contact_email.ilike.%${cleanedSearch}%`,
        ].join(','),
      );
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const cleanedContact = contactFilter.trim().replace(/[%(),]/g, '');
    if (cleanedContact) {
      query = query.or(
        `contact_name.ilike.%${cleanedContact}%,contact_email.ilike.%${cleanedContact}%`,
      );
    }

    const { data, count, error: loadError } = await query
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (loadError) {
      setError(loadError.message);
      setRows([]);
      setTotal(0);
    } else {
      setRows((data as Partner[]) ?? []);
      setTotal(count ?? 0);
      setPage(nextPage);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, sortColumn, sortDirection]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
      void load(totalPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const activeFilters = useMemo(
    () =>
      Boolean(search.trim() || contactFilter.trim() || status !== 'all'),
    [contactFilter, search, status],
  );

  function clearFilters() {
    setSearch('');
    setStatus('all');
    setContactFilter('');
    setPage(1);
    setTimeout(() => void load(1), 0);
  }

  function launch(partner?: Partner) {
    setEditing(partner ?? null);
    setForm(
      partner
        ? {
            name: partner.name,
            app_display_name: partner.app_display_name ?? '',
            slug: partner.slug,
            status: partner.status,
            contact_name: partner.contact_name ?? '',
            contact_email: partner.contact_email ?? '',
            website_url: partner.website_url ?? '',
            notes: partner.notes ?? '',
            short_description: partner.short_description ?? '',
            brand_colour: partner.brand_colour ?? '#18b7ad',
            secondary_colour: partner.secondary_colour ?? '#10242b',
            logo_url: partner.logo_url ?? '',
            square_logo_url: partner.square_logo_url ?? '',
            banner_image_url: partner.banner_image_url ?? '',
            hero_image_url: partner.hero_image_url ?? '',
          }
        : blank,
    );
    setError('');
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const payload = {
      ...form,
      app_display_name: form.app_display_name || null,
      slug: form.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      website_url: form.website_url || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      short_description: form.short_description || null,
      logo_url: form.logo_url || null,
      square_logo_url: form.square_logo_url || null,
      banner_image_url: form.banner_image_url || null,
      hero_image_url: form.hero_image_url || null,
    };

    const request = editing
      ? supabase.from('partners').update(payload).eq('id', editing.id)
      : supabase.from('partners').insert(payload);

    const { error: saveError } = await request;

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setOpen(false);
    await load(page);
  }

  return (
    <>
      <PageHeader
        title="Brand partners"
        description="Manage partner identity, artwork, contact details and app presentation."
        actions={
          <Button onClick={() => launch()}>
            <Plus size={16} /> Add partner
          </Button>
        }
      />

      <Card>
        <form
          className="toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            void load(1);
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, slug, contact or email"
          />

          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
            <option value="archived">Archived</option>
          </Select>

          <Input
            value={contactFilter}
            onChange={(event) => setContactFilter(event.target.value)}
            placeholder="Filter contact column"
          />

          <Select
            value={sortColumn}
            onChange={(event) => setSortColumn(event.target.value as SortColumn)}
            aria-label="Sort column"
          >
            <option value="created_at">Created date</option>
            <option value="name">Partner name</option>
            <option value="status">Status</option>
            <option value="contact_name">Contact name</option>
          </Select>

          <Select
            value={sortDirection}
            onChange={(event) =>
              setSortDirection(event.target.value as SortDirection)
            }
            aria-label="Sort direction"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>

          <Button type="submit" disabled={loading}>
            <Search size={16} /> Apply
          </Button>

          {activeFilters ? (
            <Button
              type="button"
              className="secondary"
              onClick={clearFilters}
              disabled={loading}
            >
              <X size={16} /> Clear
            </Button>
          ) : null}
        </form>

        {error ? <p className="error">{error}</p> : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            margin: '12px 0 16px',
            flexWrap: 'wrap',
          }}
        >
          <span>
            {loading
              ? 'Loading partners…'
              : `${total.toLocaleString('en-GB')} partner${total === 1 ? '' : 's'}`}
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Rows per page
            <Select
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {!loading && rows.length === 0 ? (
          <EmptyState
            title="No partners found"
            body={
              activeFilters
                ? 'Clear or adjust the filters and try again.'
                : 'Create the first brand partner and attach rewards or campaigns.'
            }
          />
        ) : (
          <div className="partner-grid">
            {rows.map((row) => (
              <article className="partner-card" key={row.id}>
                <div
                  className="partner-card-banner"
                  style={{
                    backgroundImage: row.banner_image_url
                      ? `url(${row.banner_image_url})`
                      : undefined,
                    backgroundColor: row.brand_colour || '#18b7ad',
                  }}
                />

                <div className="partner-card-body">
                  <div
                    className="partner-card-logo"
                    style={{
                      backgroundImage:
                        row.square_logo_url || row.logo_url
                          ? `url(${row.square_logo_url || row.logo_url})`
                          : undefined,
                    }}
                  >
                    {!row.square_logo_url && !row.logo_url
                      ? row.name.slice(0, 1).toUpperCase()
                      : null}
                  </div>

                  <div className="partner-card-title">
                    <strong>{row.app_display_name || row.name}</strong>
                    <Badge
                      tone={
                        row.status === 'active'
                          ? 'good'
                          : row.status === 'paused'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {titleCase(row.status)}
                    </Badge>
                  </div>

                  <p>
                    {row.short_description ||
                      'No brand description has been added yet.'}
                  </p>

                  <div className="partner-card-meta">
                    <span>{row.contact_name || 'No contact'}</span>
                    <span>{formatDate(row.created_at)}</span>
                  </div>

                  <Button className="secondary" onClick={() => launch(row)}>
                    Edit partner
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            marginTop: 18,
            flexWrap: 'wrap',
          }}
        >
          <span>
            Page {page} of {totalPages}
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              className="secondary"
              onClick={() => void load(Math.max(1, page - 1))}
              disabled={loading || page <= 1}
            >
              <ChevronLeft size={16} /> Previous
            </Button>

            <Button
              type="button"
              className="secondary"
              onClick={() => void load(Math.min(totalPages, page + 1))}
              disabled={loading || page >= totalPages}
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {open ? (
        <Modal
          title={editing ? 'Edit brand partner' : 'Add brand partner'}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Legal / account name">
                <Input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </Field>

              <Field label="App display name">
                <Input
                  value={form.app_display_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      app_display_name: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Slug">
                <Input
                  required
                  value={form.slug}
                  onChange={(event) =>
                    setForm({ ...form, slug: event.target.value })
                  }
                />
              </Field>

              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="ended">Ended</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>

              <Field label="Short brand description">
                <Textarea
                  value={form.short_description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      short_description: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Internal notes">
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                />
              </Field>

              <Field label="Website">
                <Input
                  type="url"
                  value={form.website_url}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      website_url: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Contact name">
                <Input
                  value={form.contact_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      contact_name: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Contact email">
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      contact_email: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Primary colour">
                <Input
                  type="color"
                  value={form.brand_colour}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      brand_colour: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Secondary colour">
                <Input
                  type="color"
                  value={form.secondary_colour}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      secondary_colour: event.target.value,
                    })
                  }
                />
              </Field>
            </div>

            <div className="media-form-grid">
              <ImageUpload
                label="Brand logo"
                value={form.logo_url}
                onChange={(url) => setForm({ ...form, logo_url: url })}
                pathPrefix={`partners/${form.slug || 'new'}/logo`}
                aspect="wide"
                ownerType="partner"
                ownerId={editing?.id}
                assetType="logo"
                hint="Transparent horizontal logo works best."
              />

              <ImageUpload
                label="Square app logo"
                value={form.square_logo_url}
                onChange={(url) =>
                  setForm({ ...form, square_logo_url: url })
                }
                pathPrefix={`partners/${form.slug || 'new'}/square-logo`}
                aspect="square"
                ownerType="partner"
                ownerId={editing?.id}
                assetType="square_logo"
                hint="Used on reward cards and partner lists."
              />

              <ImageUpload
                label="Partner banner"
                value={form.banner_image_url}
                onChange={(url) =>
                  setForm({ ...form, banner_image_url: url })
                }
                pathPrefix={`partners/${form.slug || 'new'}/banner`}
                aspect="wide"
                ownerType="partner"
                ownerId={editing?.id}
                assetType="banner"
                hint="Recommended 1600 × 600 or larger."
              />

              <ImageUpload
                label="Partner hero image"
                value={form.hero_image_url}
                onChange={(url) =>
                  setForm({ ...form, hero_image_url: url })
                }
                pathPrefix={`partners/${form.slug || 'new'}/hero`}
                aspect="portrait"
                ownerType="partner"
                ownerId={editing?.id}
                assetType="hero"
                hint="Lifestyle or product-led campaign artwork."
              />
            </div>

            {error ? <p className="error">{error}</p> : null}

            <div className="form-actions">
              <Button type="submit">Save partner</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
