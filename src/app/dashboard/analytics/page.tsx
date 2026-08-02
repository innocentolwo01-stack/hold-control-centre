'use client';

import {
  Activity,
  Clock3,
  Gift,
  MapPin,
  MonitorSmartphone,
  RefreshCw,
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
import {
  LiveUserMap,
  type LiveMapPoint,
} from '@/components/live-user-map';

type Summary = {
  live_users: number;
  active_users: number;
  hold_sessions: number;
  hold_seconds: number;
  average_hold_seconds: number;
  points_earned: number;
  rewards_claimed: number;
  coupons_claimed: number;
  coupons_used: number;
  confirmed_redemptions: number;
};

type Breakdown = {
  name: string;
  users: number;
  code?: string | null;
  country?: string | null;
};

type Snapshot = {
  from: string;
  to: string;
  liveMinutes: number;
  summary: Summary;
  platforms: Breakdown[];
  countries: Breakdown[];
  cities: Breakdown[];
  hourly: Array<{
    hour: string;
    activeUsers: number;
    events: number;
  }>;
};

type LiveUser = {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  username?: string | null;
  plan: string;
  account_status: string;
  installation_id: string;
  platform: string;
  os_name?: string | null;
  os_version?: string | null;
  app_version?: string | null;
  app_build?: string | null;
  device_model?: string | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  last_screen?: string | null;
  presence_state: string;
  last_seen_at: string;
  seconds_since_seen: number;
  is_live: boolean;
  current_hold_started_at?: string | null;
  current_hold_seconds: number;
  holds_30d: number;
  total_hold_seconds_30d: number;
  rewards_claimed_30d: number;
  coupons_claimed_30d: number;
  coupons_used_30d: number;
};

type ActivityRow = {
  occurred_at: string;
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  activity_type: string;
  title: string;
  detail: string;
  platform?: string | null;
  city?: string | null;
  country?: string | null;
  metadata: Record<string, unknown>;
};

const emptySummary: Summary = {
  live_users: 0,
  active_users: 0,
  hold_sessions: 0,
  hold_seconds: 0,
  average_hold_seconds: 0,
  points_earned: 0,
  rewards_claimed: 0,
  coupons_claimed: 0,
  coupons_used: 0,
  confirmed_redemptions: 0,
};

const emptySnapshot: Snapshot = {
  from: new Date().toISOString(),
  to: new Date().toISOString(),
  liveMinutes: 3,
  summary: emptySummary,
  platforms: [],
  countries: [],
  cities: [],
  hourly: [],
};

const ranges = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
} as const;

function number(value: unknown) {
  return Number(value ?? 0);
}

function duration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));

  if (safe < 60) return `${safe}s`;

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function dateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normaliseSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') {
    return emptySnapshot;
  }

  const row = value as Record<string, unknown>;
  const summary =
    (row.summary as Record<string, unknown> | undefined) ??
    {};

  return {
    from:
      typeof row.from === 'string'
        ? row.from
        : emptySnapshot.from,
    to:
      typeof row.to === 'string'
        ? row.to
        : emptySnapshot.to,
    liveMinutes: number(row.liveMinutes || 3),
    summary: {
      live_users: number(summary.live_users),
      active_users: number(summary.active_users),
      hold_sessions: number(summary.hold_sessions),
      hold_seconds: number(summary.hold_seconds),
      average_hold_seconds: number(
        summary.average_hold_seconds,
      ),
      points_earned: number(summary.points_earned),
      rewards_claimed: number(summary.rewards_claimed),
      coupons_claimed: number(summary.coupons_claimed),
      coupons_used: number(summary.coupons_used),
      confirmed_redemptions: number(
        summary.confirmed_redemptions,
      ),
    },
    platforms: Array.isArray(row.platforms)
      ? (row.platforms as Breakdown[])
      : [],
    countries: Array.isArray(row.countries)
      ? (row.countries as Breakdown[])
      : [],
    cities: Array.isArray(row.cities)
      ? (row.cities as Breakdown[])
      : [],
    hourly: Array.isArray(row.hourly)
      ? (row.hourly as Snapshot['hourly'])
      : [],
  };
}

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: Breakdown[];
}) {
  const max = Math.max(
    1,
    ...rows.map((row) => number(row.users)),
  );

  return (
    <Card>
      <h2>{title}</h2>

      {rows.length === 0 ? (
        <EmptyState
          title="No data yet"
          body="This breakdown appears after mobile analytics heartbeats arrive."
        />
      ) : (
        <div className="kpi-list">
          {rows.slice(0, 10).map((row) => (
            <div
              className="kpi-row"
              key={`${row.name}-${row.country ?? ''}`}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{row.name || 'Unknown'}</strong>
                {row.country ? (
                  <small
                    className="muted"
                    style={{ display: 'block' }}
                  >
                    {row.country}
                  </small>
                ) : null}
                <div
                  style={{
                    height: 6,
                    marginTop: 7,
                    overflow: 'hidden',
                    borderRadius: 999,
                    background: '#EDF1F6',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(
                        4,
                        (number(row.users) / max) * 100,
                      )}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: '#02C8D2',
                    }}
                  />
                </div>
              </div>
              <strong>{number(row.users)}</strong>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] =
    useState<keyof typeof ranges>('24h');
  const [platform, setPlatform] = useState('all');
  const [country, setCountry] = useState('all');
  const [query, setQuery] = useState('');
  const [liveOnly, setLiveOnly] = useState(true);

  const [snapshot, setSnapshot] =
    useState<Snapshot>(emptySnapshot);
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [activity, setActivity] =
    useState<ActivityRow[]>([]);
  const [mapPoints, setMapPoints] =
    useState<LiveMapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');

    const to = new Date();
    const from = new Date(
      to.getTime() - ranges[range],
    );

    const [
      snapshotResult,
      usersResult,
      activityResult,
      mapResult,
    ] = await Promise.all([
      supabase.rpc('admin_analytics_snapshot', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_live_minutes: 3,
      }),
      supabase.rpc('admin_live_users', {
        p_live_minutes: 3,
      }),
      supabase.rpc('admin_recent_user_activity', {
        p_limit: 200,
      }),
      supabase.rpc('admin_live_map_points', {
        p_live_minutes: 3,
      }),
    ]);

    const firstError = [
      snapshotResult.error,
      usersResult.error,
      activityResult.error,
      mapResult.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
    }

    if (!snapshotResult.error) {
      setSnapshot(
        normaliseSnapshot(snapshotResult.data),
      );
    }

    if (!usersResult.error) {
      setUsers(
        (usersResult.data as LiveUser[] | null) ?? [],
      );
    }

    if (!activityResult.error) {
      setActivity(
        (activityResult.data as ActivityRow[] | null) ??
          [],
      );
    }

    if (!mapResult.error) {
      setMapPoints(
        (mapResult.data as LiveMapPoint[] | null) ??
          [],
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void load();
    }, 0);

    const interval = setInterval(() => {
      void load(true);
    }, 10_000);

    const topic =
      `hold-live-analytics-${Date.now().toString(36)}`;

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

    let channel = supabase.channel(topic);

    for (const table of [
      'app_installations',
      'app_events',
      'hold_sessions',
      'coupon_claims',
      'redemptions',
    ]) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [range]);

  const countries = useMemo(
    () =>
      Array.from(
        new Set(
          users
            .map((user) => user.country)
            .filter(
              (value): value is string =>
                Boolean(value),
            ),
        ),
      ).sort(),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return users.filter((user) => {
      if (liveOnly && !user.is_live) return false;

      if (
        platform !== 'all' &&
        user.platform !== platform
      ) {
        return false;
      }

      if (
        country !== 'all' &&
        user.country !== country
      ) {
        return false;
      }

      if (!search) return true;

      return [
        user.display_name,
        user.username,
        user.email,
        user.city,
        user.country,
        user.device_model,
        user.os_name,
        user.last_screen,
      ].some((value) =>
        value?.toLowerCase().includes(search),
      );
    });
  }, [
    country,
    liveOnly,
    platform,
    query,
    users,
  ]);

  const summaryCards = [
    {
      label: 'Live users',
      value: snapshot.summary.live_users,
      icon: Activity,
    },
    {
      label: 'Active users',
      value: snapshot.summary.active_users,
      icon: Users,
    },
    {
      label: 'Hold time',
      value: duration(
        snapshot.summary.hold_seconds,
      ),
      icon: Clock3,
    },
    {
      label: 'Average Hold',
      value: duration(
        snapshot.summary.average_hold_seconds,
      ),
      icon: Clock3,
    },
    {
      label: 'Points earned',
      value:
        snapshot.summary.points_earned.toLocaleString(
          'en-GB',
        ),
      icon: Gift,
    },
    {
      label: 'Rewards claimed',
      value: snapshot.summary.rewards_claimed,
      icon: Gift,
    },
    {
      label: 'Coupons used',
      value: snapshot.summary.coupons_used,
      icon: TicketCheck,
    },
    {
      label: 'Confirmed redemptions',
      value:
        snapshot.summary.confirmed_redemptions,
      icon: TicketCheck,
    },
  ];

  return (
    <>
      <PageHeader
        title="Live Analytics"
        description="Google Analytics-style operational view of live users, locations, devices, Hold activity, reward claims, coupon usage and confirmed redemptions."
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
            </Select>

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
        {summaryCards.map(
          ({ label, value, icon: Icon }) => (
            <Card key={label}>
              <div className="stat">
                <div className="stat-icon">
                  <Icon size={21} />
                </div>
                <div>
                  <strong>
                    {loading ? '—' : value}
                  </strong>
                  <span>{label}</span>
                </div>
              </div>
            </Card>
          ),
        )}
      </div>

      <LiveUserMap
        points={mapPoints}
        loading={loading}
      />

      <div
        className="grid three"
        style={{ marginTop: 18 }}
      >
        <BreakdownList
          title="Operating systems"
          rows={snapshot.platforms}
        />
        <BreakdownList
          title="Countries"
          rows={snapshot.countries}
        />
        <BreakdownList
          title="Cities"
          rows={snapshot.cities}
        />
      </div>

      <Card style={{ marginTop: 18 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>
              Live users
            </h2>
            <p className="muted">
              A user is live when the app has sent an
              active heartbeat in the last three minutes.
            </p>
          </div>

          <Badge tone="good">
            {filteredUsers.filter(
              (user) => user.is_live,
            ).length}{' '}
            live
          </Badge>
        </div>

        <div
          className="toolbar"
          style={{ marginTop: 16 }}
        >
          <Input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search user, city, country, device or screen"
          />

          <Select
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value)
            }
          >
            <option value="all">
              All operating systems
            </option>
            <option value="ios">iOS</option>
            <option value="android">
              Android
            </option>
            <option value="web">Web</option>
            <option value="unknown">
              Unknown
            </option>
          </Select>

          <Select
            value={country}
            onChange={(event) =>
              setCountry(event.target.value)
            }
          >
            <option value="all">
              All countries
            </option>
            {countries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>

          <label
            style={{
              display: 'inline-flex',
              gap: 8,
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={liveOnly}
              onChange={(event) =>
                setLiveOnly(event.target.checked)
              }
            />
            Live only
          </label>
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            title="No matching users"
            body="Open the updated iOS or Android app while signed in to start sending live analytics."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>User</th>
                  <th>Membership</th>
                  <th>Location</th>
                  <th>Device and OS</th>
                  <th>Current screen</th>
                  <th>Current Hold</th>
                  <th>30-day Hold activity</th>
                  <th>Rewards and coupons</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={`${user.user_id}-${user.installation_id}`}
                  >
                    <td>
                      <Badge
                        tone={
                          user.is_live
                            ? 'good'
                            : 'neutral'
                        }
                      >
                        {user.is_live
                          ? 'Live'
                          : titleCase(
                              user.presence_state,
                            )}
                      </Badge>
                    </td>
                    <td>
                      <strong>
                        {user.display_name ||
                          user.email ||
                          'Unnamed user'}
                      </strong>
                      <br />
                      <span className="muted">
                        {user.email ||
                          user.username ||
                          user.user_id}
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          user.plan === 'family' ||
                          user.plan === 'premium'
                            ? 'good'
                            : user.plan === 'plus'
                              ? 'info'
                              : 'neutral'
                        }
                      >
                        {titleCase(user.plan)}
                      </Badge>
                      <br />
                      <small className="muted">
                        {titleCase(
                          user.account_status,
                        )}
                      </small>
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: 7,
                          alignItems: 'center',
                        }}
                      >
                        <MapPin size={15} />
                        <span>
                          {user.city || 'Unknown city'}
                          <br />
                          <small className="muted">
                            {user.country ||
                              'Unknown country'}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: 7,
                          alignItems: 'center',
                        }}
                      >
                        <MonitorSmartphone size={15} />
                        <span>
                          {user.device_model ||
                            'Unknown device'}
                          <br />
                          <small className="muted">
                            {titleCase(
                              user.platform,
                            )}{' '}
                            {user.os_version || ''}
                            {user.app_version
                              ? ` · App ${user.app_version}`
                              : ''}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {user.last_screen || '—'}
                    </td>
                    <td>
                      {user.current_hold_started_at
                        ? duration(
                            user.current_hold_seconds,
                          )
                        : 'Not holding'}
                    </td>
                    <td>
                      <strong>
                        {user.holds_30d} sessions
                      </strong>
                      <br />
                      <small className="muted">
                        {duration(
                          user.total_hold_seconds_30d,
                        )}
                      </small>
                    </td>
                    <td>
                      <strong>
                        {user.rewards_claimed_30d}{' '}
                        rewards
                      </strong>
                      <br />
                      <small className="muted">
                        {user.coupons_claimed_30d}{' '}
                        coupons claimed ·{' '}
                        {user.coupons_used_30d} used
                      </small>
                    </td>
                    <td>
                      {dateTime(user.last_seen_at)}
                      <br />
                      <small className="muted">
                        {duration(
                          user.seconds_since_seen,
                        )}{' '}
                        ago
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 18 }}>
        <h2>Recent user activity</h2>
        <p className="muted">
          Screen activity, Hold sessions, reward
          claims, coupon claims and confirmed
          redemptions from the same backend.
        </p>

        {activity.length === 0 ? (
          <EmptyState
            title="No activity yet"
            body="Activity will appear after users open the updated app or complete Hold and redemption actions."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Activity</th>
                  <th>Details</th>
                  <th>Location</th>
                  <th>Platform</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row, index) => (
                  <tr
                    key={`${row.occurred_at}-${row.user_id}-${index}`}
                  >
                    <td>
                      {dateTime(row.occurred_at)}
                    </td>
                    <td>
                      <strong>
                        {row.display_name ||
                          row.email ||
                          'Unknown user'}
                      </strong>
                      <br />
                      <small className="muted">
                        {row.email || row.user_id}
                      </small>
                    </td>
                    <td>
                      <Badge tone="info">
                        {titleCase(
                          row.activity_type,
                        )}
                      </Badge>
                    </td>
                    <td>
                      <strong>{row.title}</strong>
                      <br />
                      <small className="muted">
                        {row.detail}
                      </small>
                    </td>
                    <td>
                      {[row.city, row.country]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td>
                      {row.platform
                        ? titleCase(row.platform)
                        : '—'}
                    </td>
                    <td>
                      <details>
                        <summary>View</summary>
                        <pre
                          style={{
                            maxWidth: 360,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {JSON.stringify(
                            row.metadata,
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
