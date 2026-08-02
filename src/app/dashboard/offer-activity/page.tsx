'use client';

import {
  CheckCircle2,
  Download,
  ExternalLink,
  MapPin,
  MousePointerClick,
  RefreshCw,
  ShoppingBag,
  Store,
  Tag,
  TicketCheck,
  Users,
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
  Input,
  PageHeader,
  Select,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';

type OfferEvent = {
  event_id: string;
  occurred_at: string;
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  username?: string | null;
  profile_id?: string | null;
  offer_id: string;
  offer_name: string;
  offer_slug: string;
  offer_type: 'reward' | 'coupon';
  partner_name?: string | null;
  event_type:
    | 'claim'
    | 'outbound_click'
    | 'code_copy'
    | 'redemption_confirmed';
  lifecycle_stage: 'claimed' | 'redeemed';
  channel: 'online' | 'in_store' | 'unknown';
  points_value: number;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  platform?: string | null;
  device_model?: string | null;
  installation_id?: string | null;
  claim_id?: string | null;
  redemption_id?: string | null;
  click_id?: string | null;
  partner_reference?: string | null;
  merchant_location_id?: string | null;
  merchant_location_name?: string | null;
  merchant_location_address?: string | null;
  merchant_location_city?: string | null;
  merchant_location_postcode?: string | null;
  merchant_location_country_code?: string | null;
  website_name?: string | null;
  website_domain?: string | null;
  website_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  tagged_url?: string | null;
  destination_url?: string | null;
  metadata: Record<string, unknown>;
};

type Summary = {
  uniqueUsers: number;
  claims: number;
  onlineOpens: number;
  codeCopies: number;
  confirmedRedemptions: number;
  onlineConfirmed: number;
  inStoreConfirmed: number;
  pointsSpent: number;
  channels: Array<{
    name: string;
    value: number;
  }>;
  topOffers: Array<{
    offerId: string;
    name: string;
    offerType: string;
    claims: number;
    redemptions: number;
  }>;
};

const emptySummary: Summary = {
  uniqueUsers: 0,
  claims: 0,
  onlineOpens: 0,
  codeCopies: 0,
  confirmedRedemptions: 0,
  onlineConfirmed: 0,
  inStoreConfirmed: 0,
  pointsSpent: 0,
  channels: [],
  topOffers: [],
};

const ranges = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
} as const;

function number(value: unknown) {
  return Number(value ?? 0);
}

function normaliseSummary(
  value: unknown,
): Summary {
  if (!value || typeof value !== 'object') {
    return emptySummary;
  }

  const row = value as Record<string, unknown>;

  return {
    uniqueUsers: number(row.uniqueUsers),
    claims: number(row.claims),
    onlineOpens: number(row.onlineOpens),
    codeCopies: number(row.codeCopies),
    confirmedRedemptions: number(
      row.confirmedRedemptions,
    ),
    onlineConfirmed: number(row.onlineConfirmed),
    inStoreConfirmed: number(row.inStoreConfirmed),
    pointsSpent: number(row.pointsSpent),
    channels: Array.isArray(row.channels)
      ? (row.channels as Summary['channels'])
      : [],
    topOffers: Array.isArray(row.topOffers)
      ? (row.topOffers as Summary['topOffers'])
      : [],
  };
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function dateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

function eventLabel(event: OfferEvent) {
  switch (event.event_type) {
    case 'claim':
      return 'Claimed';
    case 'outbound_click':
      return 'Claimed / opened online';
    case 'code_copy':
      return 'Code copied';
    case 'redemption_confirmed':
      return 'Redeemed';
    default:
      return titleCase(event.event_type);
  }
}

function eventTone(event: OfferEvent) {
  if (event.lifecycle_stage === 'redeemed') {
    return 'good';
  }

  if (event.event_type === 'outbound_click') {
    return 'info';
  }

  return 'neutral';
}

function channelTone(channel: OfferEvent['channel']) {
  if (channel === 'in_store') return 'good';
  if (channel === 'online') return 'info';
  return 'neutral';
}

function redemptionDestination(row: OfferEvent) {
  if (row.channel === 'in_store') {
    return {
      title:
        row.merchant_location_name ||
        'Unassigned store branch',
      detail: [
        row.merchant_location_address,
        row.merchant_location_city,
        row.merchant_location_postcode,
        row.merchant_location_country_code,
      ]
        .filter(Boolean)
        .join(', ') || 'No branch address recorded',
      url: null,
    };
  }

  if (row.channel === 'online') {
    return {
      title:
        row.website_name ||
        row.website_domain ||
        'Unknown website',
      detail:
        row.website_domain ||
        row.website_url ||
        row.destination_url ||
        'No website recorded',
      url:
        row.website_url ||
        row.destination_url ||
        row.tagged_url ||
        null,
    };
  }

  return {
    title: 'Unknown destination',
    detail:
      'This legacy record did not identify a store or website.',
    url: null,
  };
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : String(value);

  return `"${text.replaceAll('"', '""')}"`;
}

export default function OfferActivityPage() {
  const [range, setRange] =
    useState<keyof typeof ranges>('30d');
  const [offerType, setOfferType] = useState('all');
  const [channel, setChannel] = useState('all');
  const [eventType, setEventType] =
    useState('all');
  const [query, setQuery] = useState('');

  const [rows, setRows] = useState<OfferEvent[]>([]);
  const [summary, setSummary] =
    useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');

    const to = new Date();
    const from = new Date(
      to.getTime() - ranges[range],
    );

    const [activityResult, summaryResult] =
      await Promise.all([
        supabase.rpc('admin_offer_activity', {
          p_from: from.toISOString(),
          p_to: to.toISOString(),
          p_offer_type: offerType,
          p_channel: channel,
          p_event_type: eventType,
          p_limit: 2000,
        }),
        supabase.rpc(
          'admin_offer_attribution_summary',
          {
            p_from: from.toISOString(),
            p_to: to.toISOString(),
          },
        ),
      ]);

    const firstError = [
      activityResult.error,
      summaryResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
    }

    if (!activityResult.error) {
      setRows(
        (activityResult.data as OfferEvent[] | null) ??
          [],
      );
    }

    if (!summaryResult.error) {
      setSummary(
        normaliseSummary(summaryResult.data),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void load();
    }, 0);

    const fallbackRefresh = setInterval(() => {
      void load(true);
    }, 15_000);

    const topic =
      `hold-offer-activity-${Date.now().toString(36)}`;

    let refreshTimer:
      | ReturnType<typeof setTimeout>
      | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        void load(true);
      }, 250);
    };

    const channelSubscription = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offer_attribution_events',
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      clearTimeout(initialTimer);
      clearInterval(fallbackRefresh);

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(
        channelSubscription,
      );
    };
  }, [channel, eventType, offerType, range]);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((row) =>
      [
        row.display_name,
        row.email,
        row.username,
        row.offer_name,
        row.partner_name,
        row.city,
        row.country,
        row.platform,
        row.device_model,
        row.utm_campaign,
        row.partner_reference,
        row.click_id,
      ].some((value) =>
        value?.toLowerCase().includes(search),
      ),
    );
  }, [query, rows]);

  function exportCsv() {
    const header = [
      'Occurred at',
      'User',
      'Email',
      'Offer',
      'Offer type',
      'Partner',
      'Action',
      'Channel',
      'Store or website',
      'Store address or website domain',
      'User city',
      'User country',
      'Platform',
      'Device',
      'Points',
      'UTM source',
      'UTM medium',
      'UTM campaign',
      'UTM content',
      'UTM term',
      'Click ID',
      'Claim ID',
      'Redemption ID',
      'Partner reference',
      'Destination URL',
      'Tagged URL',
    ];

    const lines = [
      header.map(csvCell).join(','),
      ...filteredRows.map((row) =>
        [
          row.occurred_at,
          row.display_name || row.username || '',
          row.email || '',
          row.offer_name,
          row.offer_type,
          row.partner_name || '',
          eventLabel(row),
          row.channel,
          redemptionDestination(row).title,
          redemptionDestination(row).detail,
          row.city || '',
          row.country || '',
          row.platform || '',
          row.device_model || '',
          row.points_value,
          row.utm_source || '',
          row.utm_medium || '',
          row.utm_campaign || '',
          row.utm_content || '',
          row.utm_term || '',
          row.click_id || '',
          row.claim_id || '',
          row.redemption_id || '',
          row.partner_reference || '',
          row.destination_url || '',
          row.tagged_url || '',
        ]
          .map(csvCell)
          .join(','),
      ),
    ];

    const blob = new Blob(
      [lines.join('\n')],
      {
        type: 'text/csv;charset=utf-8',
      },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `hold-offer-activity-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const cards = [
    {
      label: 'Unique users',
      value: summary.uniqueUsers,
      icon: Users,
    },
    {
      label: 'Claims and opens',
      value: summary.claims,
      icon: Tag,
    },
    {
      label: 'Online opens',
      value: summary.onlineOpens,
      icon: MousePointerClick,
    },
    {
      label: 'Confirmed redemptions',
      value: summary.confirmedRedemptions,
      icon: CheckCircle2,
    },
    {
      label: 'In-store confirmed',
      value: summary.inStoreConfirmed,
      icon: Store,
    },
    {
      label: 'Online confirmed',
      value: summary.onlineConfirmed,
      icon: ShoppingBag,
    },
    {
      label: 'Points spent',
      value: summary.pointsSpent,
      icon: TicketCheck,
    },
  ];

  return (
    <>
      <PageHeader
        title="Offer Activity"
        description="See which user claimed or redeemed each reward and coupon, where it happened, whether it was online or in-store, and the UTM attribution attached to it."
        actions={
          <>
            <Select
              value={range}
              onChange={(event) =>
                setRange(
                  event.target
                    .value as keyof typeof ranges,
                )
              }
            >
              <option value="24h">
                Last 24 hours
              </option>
              <option value="7d">Last 7 days</option>
              <option value="30d">
                Last 30 days
              </option>
              <option value="90d">
                Last 90 days
              </option>
            </Select>

            <Button
              type="button"
              className="secondary"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
            >
              <Download size={16} />
              Export CSV
            </Button>

            <Button
              type="button"
              className="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          </>
        }
      />

      {error ? <p className="error">{error}</p> : null}

      <div className="grid four">
        {cards.map(
          ({ label, value, icon: Icon }) => (
            <Card key={label}>
              <div className="stat">
                <div className="stat-icon">
                  <Icon size={21} />
                </div>
                <div>
                  <strong>
                    {loading
                      ? '—'
                      : Number(value).toLocaleString(
                          'en-GB',
                        )}
                  </strong>
                  <span>{label}</span>
                </div>
              </div>
            </Card>
          ),
        )}
      </div>

      <div
        className="grid two"
        style={{ marginTop: 18 }}
      >
        <Card>
          <h2>Attribution rules</h2>

          <div className="kpi-list">
            <div className="kpi-row">
              <span>Direct wallet claim</span>
              <strong>Claimed</strong>
            </div>
            <div className="kpi-row">
              <span>Retailer link opened</span>
              <strong>
                Claimed / opened online
              </strong>
            </div>
            <div className="kpi-row">
              <span>Merchant barcode scan</span>
              <strong>
                Redeemed in-store
              </strong>
            </div>
            <div className="kpi-row">
              <span>Partner conversion callback</span>
              <strong>
                Redeemed online
              </strong>
            </div>
          </div>
        </Card>

        <Card>
          <h2>Top offers</h2>

          {summary.topOffers.length === 0 ? (
            <EmptyState
              title="No offer activity"
              body="Claims and redemptions will appear after users interact with the updated catalogue."
            />
          ) : (
            <div className="kpi-list">
              {summary.topOffers
                .slice(0, 8)
                .map((offer) => (
                  <div
                    className="kpi-row"
                    key={offer.offerId}
                  >
                    <span>
                      <strong>{offer.name}</strong>
                      <br />
                      <small className="muted">
                        {titleCase(
                          offer.offerType,
                        )}
                      </small>
                    </span>
                    <strong>
                      {number(offer.claims)} claims ·{' '}
                      {number(offer.redemptions)} used
                    </strong>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <Card style={{ marginTop: 18 }}>
        <div className="toolbar">
          <Input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search user, offer, partner, city, UTM campaign or reference"
          />

          <Select
            value={offerType}
            onChange={(event) =>
              setOfferType(event.target.value)
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

          <Select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value)
            }
          >
            <option value="all">
              All channels
            </option>
            <option value="in_store">
              In-store
            </option>
            <option value="online">Online</option>
            <option value="unknown">
              Unknown / legacy
            </option>
          </Select>

          <Select
            value={eventType}
            onChange={(event) =>
              setEventType(event.target.value)
            }
          >
            <option value="all">
              All actions
            </option>
            <option value="claim">Claimed</option>
            <option value="outbound_click">
              Opened online
            </option>
            <option value="code_copy">
              Code copied
            </option>
            <option value="redemption_confirmed">
              Confirmed redeemed
            </option>
          </Select>
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>
              Loading offer activity…
            </strong>
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No matching activity"
            body="Change the filters or use the updated app to claim, open or redeem an offer."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Reward or coupon</th>
                  <th>Action</th>
                  <th>Channel</th>
                  <th>Store or website</th>
                  <th>User location</th>
                  <th>Device</th>
                  <th>Points</th>
                  <th>UTM attribution</th>
                  <th>Confirmation</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.event_id}>
                    <td>
                      {dateTime(row.occurred_at)}
                    </td>

                    <td>
                      <strong>
                        {row.display_name ||
                          row.username ||
                          row.email ||
                          'Unknown user'}
                      </strong>
                      <br />
                      <small className="muted">
                        {row.email || row.user_id}
                      </small>
                    </td>

                    <td>
                      <strong>{row.offer_name}</strong>
                      <br />
                      <small className="muted">
                        {titleCase(row.offer_type)}
                        {row.partner_name
                          ? ` · ${row.partner_name}`
                          : ''}
                      </small>
                    </td>

                    <td>
                      <Badge tone={eventTone(row)}>
                        {eventLabel(row)}
                      </Badge>
                    </td>

                    <td>
                      <Badge
                        tone={channelTone(
                          row.channel,
                        )}
                      >
                        {row.channel === 'in_store'
                          ? 'In-store'
                          : titleCase(row.channel)}
                      </Badge>
                    </td>

                    <td>
                      {(() => {
                        const destination =
                          redemptionDestination(row);

                        return (
                          <div>
                            <strong>
                              {destination.title}
                            </strong>
                            <br />
                            <small className="muted">
                              {destination.detail}
                            </small>

                            {destination.url ? (
                              <>
                                <br />
                                <a
                                  href={destination.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display:
                                      'inline-flex',
                                    alignItems:
                                      'center',
                                    gap: 5,
                                    marginTop: 5,
                                  }}
                                >
                                  <ExternalLink
                                    size={13}
                                  />
                                  Open website
                                </a>
                              </>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                        }}
                      >
                        <MapPin size={15} />
                        <span>
                          {row.city ||
                            'Unknown city'}
                          <br />
                          <small className="muted">
                            {row.country ||
                              'Unknown country'}
                          </small>
                        </span>
                      </div>
                    </td>

                    <td>
                      {row.device_model ||
                        row.platform ||
                        '—'}
                      <br />
                      <small className="muted">
                        {row.platform
                          ? titleCase(row.platform)
                          : ''}
                      </small>
                    </td>

                    <td>
                      {Number(
                        row.points_value || 0,
                      ).toLocaleString('en-GB')}
                    </td>

                    <td>
                      <details>
                        <summary>
                          {row.utm_campaign ||
                            'View UTM'}
                        </summary>
                        <div
                          style={{
                            minWidth: 260,
                            marginTop: 8,
                            fontSize: 12,
                            lineHeight: 1.7,
                          }}
                        >
                          <div>
                            Source:{' '}
                            <strong>
                              {row.utm_source || '—'}
                            </strong>
                          </div>
                          <div>
                            Medium:{' '}
                            <strong>
                              {row.utm_medium || '—'}
                            </strong>
                          </div>
                          <div>
                            Campaign:{' '}
                            <strong>
                              {row.utm_campaign ||
                                '—'}
                            </strong>
                          </div>
                          <div>
                            Content:{' '}
                            <strong>
                              {row.utm_content ||
                                '—'}
                            </strong>
                          </div>
                          <div>
                            Term:{' '}
                            <strong>
                              {row.utm_term || '—'}
                            </strong>
                          </div>

                          {row.tagged_url ? (
                            <a
                              href={row.tagged_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display:
                                  'inline-flex',
                                alignItems:
                                  'center',
                                gap: 5,
                                marginTop: 7,
                              }}
                            >
                              <ExternalLink
                                size={13}
                              />
                              Open tagged URL
                            </a>
                          ) : null}
                        </div>
                      </details>
                    </td>

                    <td>
                      {row.partner_reference ||
                        row.redemption_id ||
                        row.claim_id ||
                        row.click_id ||
                        '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 18 }}>
        <h2>Online conversion status</h2>
        <p className="muted">
          Opening a tagged retailer link proves that
          the user claimed or opened the offer. It does
          not prove that checkout completed. A row is
          marked “Redeemed online” only after a partner,
          affiliate network or retailer callback confirms
          the conversion using the anonymous Hold click
          ID.
        </p>
      </Card>
    </>
  );
}
