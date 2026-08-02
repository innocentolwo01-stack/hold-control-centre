'use client';

import {
  Building2,
  Gift,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  Tags,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

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
import { supabase } from '@/lib/supabase';

type Market = {
  country_code: string;
  country_name: string;
  flag_emoji: string;
  currency_code: string;
  status: string;
  rewards_enabled: boolean;
};

type Partner = {
  id: string;
  name: string;
  app_display_name?: string | null;
  slug: string;
  status: string;
  short_description?: string | null;
  website_url?: string | null;
  market_scope: 'global' | 'country';
  target_country_codes: string[];
  metadata?: Record<string, unknown>;
};

type Offer = {
  id: string;
  partner_id?: string | null;
  name: string;
  slug: string;
  offer_type: 'reward' | 'coupon';
  description?: string | null;
  short_description?: string | null;
  terms?: string | null;
  image_url?: string | null;
  category: string;
  points_cost: number;
  redemption_method: string;
  status: string;
  minimum_plan: string;
  featured: boolean;
  badge_text?: string | null;
  cta_label?: string | null;
  location_mode: string;
  target_country_codes: string[];
  location_label?: string | null;
  metadata: Record<string, unknown>;
  created_at?: string;
};

type OfferForm = {
  id: string;
  partnerId: string;
  name: string;
  slug: string;
  offerType: 'reward' | 'coupon';
  shortDescription: string;
  description: string;
  terms: string;
  category: string;
  pointsCost: string;
  redemptionMethod: string;
  status: string;
  minimumPlan: string;
  featured: boolean;
  badgeText: string;
  ctaLabel: string;
  imageUrl: string;
  externalUrl: string;
  marketScope: 'global' | 'country';
  countryCodes: string[];
};

type PartnerForm = {
  id: string;
  name: string;
  appDisplayName: string;
  slug: string;
  status: string;
  shortDescription: string;
  websiteUrl: string;
  marketScope: 'global' | 'country';
  countryCodes: string[];
};

const blankOffer: OfferForm = {
  id: '',
  partnerId: '',
  name: '',
  slug: '',
  offerType: 'reward',
  shortDescription: '',
  description: '',
  terms: '',
  category: 'Other',
  pointsCost: '100',
  redemptionMethod: 'hold_token',
  status: 'draft',
  minimumPlan: 'free',
  featured: false,
  badgeText: '',
  ctaLabel: 'Redeem',
  imageUrl: '',
  externalUrl: '',
  marketScope: 'country',
  countryCodes: [],
};

const blankPartner: PartnerForm = {
  id: '',
  name: '',
  appDisplayName: '',
  slug: '',
  status: 'draft',
  shortDescription: '',
  websiteUrl: '',
  marketScope: 'country',
  countryCodes: [],
};

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function marketMatches(
  scope: 'global' | 'country' | string,
  countryCodes: string[] | null | undefined,
  selected: string,
  includeGlobal: boolean,
) {
  if (selected === 'all') return true;

  if (selected === 'global') {
    return scope === 'global';
  }

  if (scope === 'global') {
    return includeGlobal;
  }

  return (countryCodes ?? []).includes(selected);
}

function marketLabel(
  scope: string,
  countryCodes: string[],
  markets: Market[],
) {
  if (scope === 'global') return '🌍 Global';

  return countryCodes
    .map((code) => {
      const market = markets.find(
        (item) => item.country_code === code,
      );

      return market
        ? `${market.flag_emoji} ${market.country_name}`
        : code;
    })
    .join(', ');
}

function normaliseSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function statusTone(status: string) {
  if (status === 'active') return 'good';
  if (status === 'paused') return 'warn';
  return 'neutral';
}

export default function MarketCataloguePage() {
  const [mode, setMode] =
    useState<'offers' | 'partners'>('offers');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [partners, setPartners] =
    useState<Partner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  const [countryFilter, setCountryFilter] =
    useState('all');
  const [includeGlobal, setIncludeGlobal] =
    useState(true);
  const [offerTypeFilter, setOfferTypeFilter] =
    useState('all');
  const [search, setSearch] = useState('');

  const [offerForm, setOfferForm] =
    useState<OfferForm>(blankOffer);
  const [partnerForm, setPartnerForm] =
    useState<PartnerForm>(blankPartner);
  const [offerModalOpen, setOfferModalOpen] =
    useState(false);
  const [partnerModalOpen, setPartnerModalOpen] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    const [
      marketResult,
      partnerResult,
      offerResult,
    ] = await Promise.all([
      supabase
        .from('supported_markets')
        .select(
          'country_code,country_name,flag_emoji,currency_code,status,rewards_enabled',
        )
        .eq('status', 'active')
        .order('display_order'),
      supabase
        .from('partners')
        .select(
          'id,name,app_display_name,slug,status,short_description,website_url,market_scope,target_country_codes,metadata',
        )
        .is('deleted_at', null)
        .order('name'),
      supabase
        .from('rewards')
        .select(
          'id,partner_id,name,slug,offer_type,description,short_description,terms,image_url,category,points_cost,redemption_method,status,minimum_plan,featured,badge_text,cta_label,location_mode,target_country_codes,location_label,metadata,created_at',
        )
        .is('deleted_at', null)
        .order('created_at', {
          ascending: false,
        }),
    ]);

    const firstError = [
      marketResult.error,
      partnerResult.error,
      offerResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
    }

    if (!marketResult.error) {
      setMarkets(
        (marketResult.data as Market[] | null) ??
          [],
      );
    }

    if (!partnerResult.error) {
      setPartners(
        (partnerResult.data as Partner[] | null) ??
          [],
      );
    }

    if (!offerResult.error) {
      setOffers(
        (offerResult.data as Offer[] | null) ?? [],
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const partnerName = useMemo(
    () =>
      new Map(
        partners.map((partner) => [
          partner.id,
          partner.app_display_name ||
            partner.name,
        ]),
      ),
    [partners],
  );

  const visibleOffers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return offers.filter((offer) => {
      if (
        offerTypeFilter !== 'all' &&
        offer.offer_type !== offerTypeFilter
      ) {
        return false;
      }

      if (
        !marketMatches(
          offer.location_mode,
          offer.target_country_codes,
          countryFilter,
          includeGlobal,
        )
      ) {
        return false;
      }

      if (!query) return true;

      return [
        offer.name,
        offer.slug,
        offer.category,
        partnerName.get(offer.partner_id ?? ''),
      ].some((value) =>
        value?.toLowerCase().includes(query),
      );
    });
  }, [
    countryFilter,
    includeGlobal,
    offerTypeFilter,
    offers,
    partnerName,
    search,
  ]);

  const visiblePartners = useMemo(() => {
    const query = search.trim().toLowerCase();

    return partners.filter((partner) => {
      if (
        !marketMatches(
          partner.market_scope,
          partner.target_country_codes,
          countryFilter,
          includeGlobal,
        )
      ) {
        return false;
      }

      if (!query) return true;

      return [
        partner.name,
        partner.app_display_name,
        partner.slug,
        partner.website_url,
      ].some((value) =>
        value?.toLowerCase().includes(query),
      );
    });
  }, [
    countryFilter,
    includeGlobal,
    partners,
    search,
  ]);

  function toggleOfferCountry(code: string) {
    setOfferForm((current) => ({
      ...current,
      countryCodes:
        current.countryCodes.includes(code)
          ? current.countryCodes.filter(
              (item) => item !== code,
            )
          : [...current.countryCodes, code],
    }));
  }

  function togglePartnerCountry(code: string) {
    setPartnerForm((current) => ({
      ...current,
      countryCodes:
        current.countryCodes.includes(code)
          ? current.countryCodes.filter(
              (item) => item !== code,
            )
          : [...current.countryCodes, code],
    }));
  }

  function launchOffer(offer?: Offer) {
    if (!offer) {
      const defaultCountry =
        countryFilter !== 'all' &&
        countryFilter !== 'global'
          ? [countryFilter]
          : [];

      setOfferForm({
        ...blankOffer,
        countryCodes: defaultCountry,
        marketScope:
          defaultCountry.length > 0
            ? 'country'
            : 'global',
      });
    } else {
      setOfferForm({
        id: offer.id,
        partnerId: offer.partner_id ?? '',
        name: offer.name,
        slug: offer.slug,
        offerType: offer.offer_type,
        shortDescription:
          offer.short_description ?? '',
        description: offer.description ?? '',
        terms: offer.terms ?? '',
        category: offer.category,
        pointsCost: String(offer.points_cost),
        redemptionMethod:
          offer.redemption_method,
        status: offer.status,
        minimumPlan: offer.minimum_plan,
        featured: offer.featured,
        badgeText: offer.badge_text ?? '',
        ctaLabel:
          offer.cta_label ??
          (offer.offer_type === 'coupon'
            ? 'Use coupon'
            : 'Redeem'),
        imageUrl: offer.image_url ?? '',
        externalUrl:
          String(
            offer.metadata?.external_url ??
              offer.metadata?.source_url ??
              '',
          ),
        marketScope:
          offer.location_mode === 'global'
            ? 'global'
            : 'country',
        countryCodes:
          offer.target_country_codes ?? [],
      });
    }

    setError('');
    setSuccess('');
    setOfferModalOpen(true);
  }

  function launchPartner(partner?: Partner) {
    if (!partner) {
      const defaultCountry =
        countryFilter !== 'all' &&
        countryFilter !== 'global'
          ? [countryFilter]
          : [];

      setPartnerForm({
        ...blankPartner,
        countryCodes: defaultCountry,
        marketScope:
          defaultCountry.length > 0
            ? 'country'
            : 'global',
      });
    } else {
      setPartnerForm({
        id: partner.id,
        name: partner.name,
        appDisplayName:
          partner.app_display_name ?? '',
        slug: partner.slug,
        status: partner.status,
        shortDescription:
          partner.short_description ?? '',
        websiteUrl: partner.website_url ?? '',
        marketScope: partner.market_scope,
        countryCodes:
          partner.target_country_codes ?? [],
      });
    }

    setError('');
    setSuccess('');
    setPartnerModalOpen(true);
  }

  async function saveOffer() {
    if (!offerForm.name.trim()) {
      setError('Enter the reward or coupon name.');
      return;
    }

    if (!offerForm.slug.trim()) {
      setError('Enter a unique slug.');
      return;
    }

    if (
      offerForm.marketScope === 'country' &&
      offerForm.countryCodes.length === 0
    ) {
      setError(
        'Select at least one country for this offer.',
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const editing = offers.find(
      (offer) => offer.id === offerForm.id,
    );

    const metadata = {
      ...(editing?.metadata ?? {}),
    } as Record<string, unknown>;

    if (offerForm.externalUrl.trim()) {
      metadata.external_url =
        offerForm.externalUrl.trim();
    } else {
      delete metadata.external_url;
      delete metadata.source_url;
      delete metadata.official_url;
    }

    const selectedNames = offerForm.countryCodes
      .map(
        (code) =>
          markets.find(
            (market) =>
              market.country_code === code,
          )?.country_name ?? code,
      )
      .join(', ');

    const payload = {
      partner_id:
        offerForm.partnerId || null,
      name: offerForm.name.trim(),
      slug: normaliseSlug(offerForm.slug),
      offer_type: offerForm.offerType,
      short_description:
        offerForm.shortDescription.trim() ||
        null,
      description:
        offerForm.description.trim() || null,
      terms: offerForm.terms.trim() || null,
      category:
        offerForm.category.trim() || 'Other',
      points_cost: Math.max(
        0,
        Number(offerForm.pointsCost) || 0,
      ),
      redemption_method:
        offerForm.redemptionMethod,
      status: offerForm.status,
      minimum_plan: offerForm.minimumPlan,
      featured: offerForm.featured,
      badge_text:
        offerForm.badgeText.trim() || null,
      cta_label:
        offerForm.ctaLabel.trim() ||
        (offerForm.offerType === 'coupon'
          ? 'Use coupon'
          : 'Redeem'),
      image_url:
        offerForm.imageUrl.trim() || null,
      location_mode:
        offerForm.marketScope === 'global'
          ? 'global'
          : 'country',
      target_country_codes:
        offerForm.marketScope === 'global'
          ? []
          : offerForm.countryCodes,
      location_label:
        offerForm.marketScope === 'global'
          ? 'Global'
          : selectedNames,
      metadata,
      display_seconds: 25,
      cooldown_hours: 24,
      limit_scope: 'profile',
      coming_soon: false,
      claim_validity_days: 14,
    };

    const query = offerForm.id
      ? supabase
          .from('rewards')
          .update(payload)
          .eq('id', offerForm.id)
      : supabase
          .from('rewards')
          .insert(payload);

    const { error: saveError } = await query;

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setOfferModalOpen(false);
    setSuccess(
      `${titleCase(offerForm.offerType)} saved with market targeting.`,
    );
    await load();
  }

  async function savePartner() {
    if (!partnerForm.name.trim()) {
      setError('Enter the partner name.');
      return;
    }

    if (!partnerForm.slug.trim()) {
      setError('Enter a unique partner slug.');
      return;
    }

    if (
      partnerForm.marketScope === 'country' &&
      partnerForm.countryCodes.length === 0
    ) {
      setError(
        'Select at least one country for this partner.',
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      name: partnerForm.name.trim(),
      app_display_name:
        partnerForm.appDisplayName.trim() ||
        null,
      slug: normaliseSlug(partnerForm.slug),
      status: partnerForm.status,
      short_description:
        partnerForm.shortDescription.trim() ||
        null,
      website_url:
        partnerForm.websiteUrl.trim() || null,
      market_scope:
        partnerForm.marketScope,
      target_country_codes:
        partnerForm.marketScope === 'global'
          ? []
          : partnerForm.countryCodes,
    };

    const query = partnerForm.id
      ? supabase
          .from('partners')
          .update(payload)
          .eq('id', partnerForm.id)
      : supabase
          .from('partners')
          .insert(payload);

    const { error: saveError } = await query;

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setPartnerModalOpen(false);
    setSuccess(
      'Partner saved with market targeting.',
    );
    await load();
  }

  const selectedCountryName =
    countryFilter === 'all'
      ? 'All markets'
      : countryFilter === 'global'
        ? 'Global only'
        : markets.find(
            (market) =>
              market.country_code === countryFilter,
          )?.country_name ?? countryFilter;

  return (
    <>
      <PageHeader
        title="Market Catalogue"
        description="Create, assign and review rewards, coupons and partners by country. Global records remain available in every market."
        actions={
          <>
            <Button
              type="button"
              className="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>

            <Button
              type="button"
              onClick={() =>
                mode === 'offers'
                  ? launchOffer()
                  : launchPartner()
              }
            >
              <Plus size={16} />
              {mode === 'offers'
                ? 'New reward or coupon'
                : 'New partner'}
            </Button>
          </>
        }
      />

      {error ? <p className="error">{error}</p> : null}
      {success ? (
        <p className="success">{success}</p>
      ) : null}

      <div className="grid four">
        <Card>
          <div className="stat">
            <div className="stat-icon">
              <Globe2 size={21} />
            </div>
            <div>
              <strong>{markets.length}</strong>
              <span>Supported markets</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat">
            <div className="stat-icon">
              <Gift size={21} />
            </div>
            <div>
              <strong>
                {
                  offers.filter(
                    (offer) =>
                      offer.offer_type === 'reward',
                  ).length
                }
              </strong>
              <span>Rewards</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat">
            <div className="stat-icon">
              <Tags size={21} />
            </div>
            <div>
              <strong>
                {
                  offers.filter(
                    (offer) =>
                      offer.offer_type === 'coupon',
                  ).length
                }
              </strong>
              <span>Coupons</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat">
            <div className="stat-icon">
              <Building2 size={21} />
            </div>
            <div>
              <strong>{partners.length}</strong>
              <span>Partners</span>
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 18 }}>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Button
            type="button"
            className={
              mode === 'offers'
                ? ''
                : 'secondary'
            }
            onClick={() => setMode('offers')}
          >
            Rewards and coupons
          </Button>

          <Button
            type="button"
            className={
              mode === 'partners'
                ? ''
                : 'secondary'
            }
            onClick={() => setMode('partners')}
          >
            Partners
          </Button>
        </div>

        <div
          className="toolbar"
          style={{ marginTop: 16 }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 260,
              flex: 1,
            }}
          >
            <Search size={16} />
            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, slug, category or website"
            />
          </label>

          <Select
            value={countryFilter}
            onChange={(event) =>
              setCountryFilter(event.target.value)
            }
          >
            <option value="all">
              All markets
            </option>
            <option value="global">
              Global only
            </option>
            {markets.map((market) => (
              <option
                key={market.country_code}
                value={market.country_code}
              >
                {market.flag_emoji}{' '}
                {market.country_name}
              </option>
            ))}
          </Select>

          {mode === 'offers' ? (
            <Select
              value={offerTypeFilter}
              onChange={(event) =>
                setOfferTypeFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                Rewards and coupons
              </option>
              <option value="reward">
                Rewards only
              </option>
              <option value="coupon">
                Coupons only
              </option>
            </Select>
          ) : null}

          {countryFilter !== 'all' &&
          countryFilter !== 'global' ? (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={includeGlobal}
                onChange={(event) =>
                  setIncludeGlobal(
                    event.target.checked,
                  )
                }
              />
              Include global
            </label>
          ) : null}
        </div>

        <p className="muted">
          Viewing: <strong>{selectedCountryName}</strong>
          {countryFilter !== 'all' &&
          countryFilter !== 'global' &&
          includeGlobal
            ? ' plus global records'
            : ''}
        </p>
      </Card>

      {mode === 'offers' ? (
        <Card style={{ marginTop: 18 }}>
          <h2>Rewards and coupons by market</h2>

          {loading ? (
            <div className="empty-state">
              <strong>
                Loading market catalogue…
              </strong>
            </div>
          ) : visibleOffers.length === 0 ? (
            <EmptyState
              title="No matching offers"
              body="Change the country filter or create a reward or coupon for this market."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Offer</th>
                    <th>Type</th>
                    <th>Partner</th>
                    <th>Market availability</th>
                    <th>Points</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleOffers.map((offer) => (
                    <tr key={offer.id}>
                      <td>
                        <strong>{offer.name}</strong>
                        <br />
                        <small className="muted">
                          {offer.category} · {offer.slug}
                        </small>
                      </td>

                      <td>
                        <Badge
                          tone={
                            offer.offer_type ===
                            'coupon'
                              ? 'info'
                              : 'good'
                          }
                        >
                          {titleCase(
                            offer.offer_type,
                          )}
                        </Badge>
                      </td>

                      <td>
                        {offer.partner_id
                          ? partnerName.get(
                              offer.partner_id,
                            ) ?? 'Unknown partner'
                          : 'Hold / no partner'}
                      </td>

                      <td>
                        {marketLabel(
                          offer.location_mode,
                          offer.target_country_codes,
                          markets,
                        )}
                      </td>

                      <td>{offer.points_cost}</td>

                      <td>
                        {titleCase(
                          offer.redemption_method,
                        )}
                      </td>

                      <td>
                        <Badge
                          tone={statusTone(
                            offer.status,
                          )}
                        >
                          {titleCase(offer.status)}
                        </Badge>
                      </td>

                      <td>
                        <Button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            launchOffer(offer)
                          }
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ marginTop: 18 }}>
          <h2>Partners by market</h2>

          {loading ? (
            <div className="empty-state">
              <strong>
                Loading market partners…
              </strong>
            </div>
          ) : visiblePartners.length === 0 ? (
            <EmptyState
              title="No matching partners"
              body="Change the country filter or create a partner for this market."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Website</th>
                    <th>Market availability</th>
                    <th>Offers</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePartners.map(
                    (partner) => (
                      <tr key={partner.id}>
                        <td>
                          <strong>
                            {partner.app_display_name ||
                              partner.name}
                          </strong>
                          <br />
                          <small className="muted">
                            {partner.slug}
                          </small>
                        </td>

                        <td>
                          {partner.website_url || '—'}
                        </td>

                        <td>
                          {marketLabel(
                            partner.market_scope,
                            partner.target_country_codes,
                            markets,
                          )}
                        </td>

                        <td>
                          {
                            offers.filter(
                              (offer) =>
                                offer.partner_id ===
                                partner.id,
                            ).length
                          }
                        </td>

                        <td>
                          <Badge
                            tone={statusTone(
                              partner.status,
                            )}
                          >
                            {titleCase(
                              partner.status,
                            )}
                          </Badge>
                        </td>

                        <td>
                          <Button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              launchPartner(
                                partner,
                              )
                            }
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card style={{ marginTop: 18 }}>
        <h2>Mobile catalogue behaviour</h2>
        <div className="kpi-list">
          <div className="kpi-row">
            <span>Known supported country</span>
            <strong>
              Country offers + global offers
            </strong>
          </div>
          <div className="kpi-row">
            <span>Country-specific partner</span>
            <strong>
              Visible only in assigned markets
            </strong>
          </div>
          <div className="kpi-row">
            <span>No country permission or resolution</span>
            <strong>Global offers only</strong>
          </div>
          <div className="kpi-row">
            <span>Unsupported country</span>
            <strong>Global offers only</strong>
          </div>
        </div>
      </Card>

      {offerModalOpen ? (
        <Modal
          title={
            offerForm.id
              ? 'Manage reward or coupon'
              : 'New reward or coupon'
          }
          onClose={() =>
            setOfferModalOpen(false)
          }
        >
          <div className="form-grid">
            <Field label="Offer type">
              <Select
                value={offerForm.offerType}
                onChange={(event) => {
                  const offerType =
                    event.target
                      .value as OfferForm['offerType'];

                  setOfferForm({
                    ...offerForm,
                    offerType,
                    redemptionMethod:
                      offerType === 'coupon'
                        ? 'external_link'
                        : 'hold_token',
                    pointsCost:
                      offerType === 'coupon'
                        ? '0'
                        : offerForm.pointsCost,
                    ctaLabel:
                      offerType === 'coupon'
                        ? 'Use coupon'
                        : 'Redeem',
                  });
                }}
              >
                <option value="reward">
                  Reward
                </option>
                <option value="coupon">
                  Coupon
                </option>
              </Select>
            </Field>

            <Field label="Partner">
              <Select
                value={offerForm.partnerId}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    partnerId:
                      event.target.value,
                  })
                }
              >
                <option value="">
                  Hold / no partner
                </option>
                {partners.map((partner) => (
                  <option
                    key={partner.id}
                    value={partner.id}
                  >
                    {partner.app_display_name ||
                      partner.name}
                    {partner.market_scope ===
                    'country'
                      ? ` — ${partner.target_country_codes.join(
                          ', ',
                        )}`
                      : ' — Global'}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Name">
              <Input
                value={offerForm.name}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    name: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Slug">
              <Input
                value={offerForm.slug}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    slug: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Short description">
              <Textarea
                value={
                  offerForm.shortDescription
                }
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    shortDescription:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Full description">
              <Textarea
                value={offerForm.description}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    description:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Terms">
              <Textarea
                value={offerForm.terms}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    terms: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Category">
              <Input
                value={offerForm.category}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    category:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Points cost">
              <Input
                type="number"
                min="0"
                value={offerForm.pointsCost}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    pointsCost:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Redemption method">
              <Select
                value={
                  offerForm.redemptionMethod
                }
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    redemptionMethod:
                      event.target.value,
                  })
                }
              >
                <option value="hold_token">
                  Hold one-time token
                </option>
                <option value="unique_code_pool">
                  Unique code pool
                </option>
                <option value="partner_api">
                  Partner API
                </option>
                <option value="shared_barcode">
                  Shared barcode
                </option>
                <option value="external_link">
                  Online link
                </option>
                <option value="manual_confirmation">
                  Manual confirmation
                </option>
              </Select>
            </Field>

            <Field label="Status">
              <Select
                value={offerForm.status}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    status: event.target.value,
                  })
                }
              >
                <option value="draft">
                  Draft
                </option>
                <option value="active">
                  Active
                </option>
                <option value="paused">
                  Paused
                </option>
                <option value="ended">
                  Ended
                </option>
                <option value="archived">
                  Archived
                </option>
              </Select>
            </Field>

            <Field label="Minimum plan">
              <Select
                value={offerForm.minimumPlan}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    minimumPlan:
                      event.target.value,
                  })
                }
              >
                <option value="free">Free</option>
                <option value="plus">Plus</option>
                <option value="premium">
                  Premium
                </option>
                <option value="family">
                  Family
                </option>
              </Select>
            </Field>

            <Field label="Featured">
              <Select
                value={
                  offerForm.featured
                    ? 'yes'
                    : 'no'
                }
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    featured:
                      event.target.value ===
                      'yes',
                  })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </Field>

            <Field label="Badge">
              <Input
                value={offerForm.badgeText}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    badgeText:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="CTA">
              <Input
                value={offerForm.ctaLabel}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    ctaLabel:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Image URL">
              <Input
                type="url"
                value={offerForm.imageUrl}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    imageUrl:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field
              label="Online destination"
              hint="Used for online coupons and rewards."
            >
              <Input
                type="url"
                value={offerForm.externalUrl}
                onChange={(event) =>
                  setOfferForm({
                    ...offerForm,
                    externalUrl:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Market scope">
              <Select
                value={offerForm.marketScope}
                onChange={(event) => {
                  const marketScope =
                    event.target
                      .value as OfferForm['marketScope'];

                  setOfferForm({
                    ...offerForm,
                    marketScope,
                    countryCodes:
                      marketScope === 'global'
                        ? []
                        : offerForm.countryCodes,
                  });
                }}
              >
                <option value="global">
                  Global
                </option>
                <option value="country">
                  Selected countries
                </option>
              </Select>
            </Field>
          </div>

          {offerForm.marketScope ===
          'country' ? (
            <>
              <div
                className="form-section-title"
                style={{ marginTop: 20 }}
              >
                <h3>Available countries</h3>
                <p>
                  Select one or several markets.
                </p>
              </div>

              <div className="grid four">
                {markets.map((market) => (
                  <label
                    key={market.country_code}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={offerForm.countryCodes.includes(
                        market.country_code,
                      )}
                      onChange={() =>
                        toggleOfferCountry(
                          market.country_code,
                        )
                      }
                    />
                    {market.flag_emoji}{' '}
                    {market.country_name}
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {error ? (
            <p className="error">{error}</p>
          ) : null}

          <div className="form-actions">
            <Button
              type="button"
              className="secondary"
              onClick={() =>
                setOfferModalOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={saving}
              onClick={() => void saveOffer()}
            >
              Save offer
            </Button>
          </div>
        </Modal>
      ) : null}

      {partnerModalOpen ? (
        <Modal
          title={
            partnerForm.id
              ? 'Manage partner markets'
              : 'New market partner'
          }
          onClose={() =>
            setPartnerModalOpen(false)
          }
        >
          <div className="form-grid">
            <Field label="Legal / account name">
              <Input
                value={partnerForm.name}
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    name: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="App display name">
              <Input
                value={
                  partnerForm.appDisplayName
                }
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    appDisplayName:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Slug">
              <Input
                value={partnerForm.slug}
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    slug: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Status">
              <Select
                value={partnerForm.status}
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    status: event.target.value,
                  })
                }
              >
                <option value="draft">
                  Draft
                </option>
                <option value="active">
                  Active
                </option>
                <option value="paused">
                  Paused
                </option>
                <option value="ended">
                  Ended
                </option>
                <option value="archived">
                  Archived
                </option>
              </Select>
            </Field>

            <Field label="Description">
              <Textarea
                value={
                  partnerForm.shortDescription
                }
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    shortDescription:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Website">
              <Input
                type="url"
                value={partnerForm.websiteUrl}
                onChange={(event) =>
                  setPartnerForm({
                    ...partnerForm,
                    websiteUrl:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Market scope">
              <Select
                value={partnerForm.marketScope}
                onChange={(event) => {
                  const marketScope =
                    event.target
                      .value as PartnerForm['marketScope'];

                  setPartnerForm({
                    ...partnerForm,
                    marketScope,
                    countryCodes:
                      marketScope === 'global'
                        ? []
                        : partnerForm.countryCodes,
                  });
                }}
              >
                <option value="global">
                  Global
                </option>
                <option value="country">
                  Selected countries
                </option>
              </Select>
            </Field>
          </div>

          {partnerForm.marketScope ===
          'country' ? (
            <>
              <div
                className="form-section-title"
                style={{ marginTop: 20 }}
              >
                <h3>Partner countries</h3>
                <p>
                  Offers attached to this partner
                  cannot target countries outside this
                  list.
                </p>
              </div>

              <div className="grid four">
                {markets.map((market) => (
                  <label
                    key={market.country_code}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={partnerForm.countryCodes.includes(
                        market.country_code,
                      )}
                      onChange={() =>
                        togglePartnerCountry(
                          market.country_code,
                        )
                      }
                    />
                    {market.flag_emoji}{' '}
                    {market.country_name}
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {error ? (
            <p className="error">{error}</p>
          ) : null}

          <div className="form-actions">
            <Button
              type="button"
              className="secondary"
              onClick={() =>
                setPartnerModalOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePartner()
              }
            >
              Save partner
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
