'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  RefreshCw,
  UsersRound,
} from 'lucide-react';

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
} from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { invokeAdmin } from '@/lib/admin-control';
import { supabase } from '@/lib/supabase';

type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type Profile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  account_status?: string | null;
};

type Subscription = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  provider?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
};

type MemberProfile = {
  id: string;
  account_user_id: string;
  active: boolean;
};

type PlanType = {
  plan_key: string;
  name: string;
  monthly_price: number;
  currency: string;
  family_seats: number;
  active: boolean;
  entitlements: Record<string, unknown>;
};

type UserResponse = {
  users?: AuthUser[];
  profiles?: Profile[];
  subscriptions?: Subscription[];
  memberProfiles?: MemberProfile[];
  total?: number;
};

type MembershipRow = {
  user: AuthUser;
  profile?: Profile;
  subscription?: Subscription;
  familyProfiles: number;
};

function toneForStatus(status: string) {
  if (status === 'active' || status === 'trialing') return 'good';
  if (status === 'past_due' || status === 'paused') return 'warn';
  if (status === 'cancelled' || status === 'expired') return 'bad';
  return 'neutral';
}

function localDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default function MembershipsPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [plans, setPlans] = useState<PlanType[]>([]);
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<MembershipRow | null>(null);
  const [form, setForm] = useState({
    plan: 'free',
    status: 'active',
    currentPeriodEnd: '',
    reason: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [response, planResult] = await Promise.all([
        invokeAdmin<UserResponse>({
          action: 'list_users',
          page: 1,
          perPage: 100,
        }),
        supabase
          .from('membership_plan_types')
          .select('*')
          .order('display_order'),
      ]);

      setUsers(response.users ?? []);
      setProfiles(response.profiles ?? []);
      setSubscriptions(response.subscriptions ?? []);
      setMembers(response.memberProfiles ?? []);

      if (planResult.error) {
        throw planResult.error;
      }

      setPlans((planResult.data as PlanType[]) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load memberships.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const subscriptionMap = useMemo(() => {
    const map = new Map<string, Subscription>();
    for (const subscription of subscriptions) {
      if (!map.has(subscription.user_id)) {
        map.set(subscription.user_id, subscription);
      }
    }
    return map;
  }, [subscriptions]);

  const familyCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const member of members) {
      if (!member.active) continue;
      map.set(
        member.account_user_id,
        (map.get(member.account_user_id) ?? 0) + 1,
      );
    }
    return map;
  }, [members]);

  const rows = useMemo<MembershipRow[]>(
    () =>
      users.map((user) => ({
        user,
        profile: profileMap.get(user.id),
        subscription: subscriptionMap.get(user.id),
        familyProfiles: familyCountMap.get(user.id) ?? 0,
      })),
    [users, profileMap, subscriptionMap, familyCountMap],
  );

  const filteredRows = rows.filter((row) => {
    const plan = row.subscription?.plan ?? 'free';
    const status = row.subscription?.status ?? 'active';

    return (
      (planFilter === 'all' || plan === planFilter) &&
      (statusFilter === 'all' || status === statusFilter)
    );
  });

  const planCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const plan = row.subscription?.plan ?? 'free';
      counts.set(plan, (counts.get(plan) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  function openMembership(row: MembershipRow) {
    setSelected(row);
    setForm({
      plan: row.subscription?.plan ?? 'free',
      status: row.subscription?.status ?? 'active',
      currentPeriodEnd: localDate(
        row.subscription?.current_period_end,
      ),
      reason: '',
    });
    setError('');
    setSuccess('');
  }

  async function saveMembership() {
    if (!selected) return;

    if (!form.reason.trim()) {
      setError('An audit reason is required.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await invokeAdmin({
        action: 'set_subscription',
        userId: selected.user.id,
        plan: form.plan,
        status: form.status,
        currentPeriodEnd: form.currentPeriodEnd
          ? new Date(
              `${form.currentPeriodEnd}T23:59:59`,
            ).toISOString()
          : null,
        reason: form.reason.trim(),
      });

      setSuccess('Membership updated.');
      setSelected(null);
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update membership.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Memberships"
        description="View membership types, active plans, providers, Family profiles and manual subscription overrides."
        actions={
          <Button
            type="button"
            className="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}

      <div className="grid four" style={{ marginBottom: 18 }}>
        {plans.map((plan) => (
          <Card key={plan.plan_key}>
            <div className="stat">
              <div className="stat-icon">
                {plan.plan_key === 'family' ? (
                  <UsersRound size={20} />
                ) : (
                  <CreditCard size={20} />
                )}
              </div>
              <div>
                <strong>
                  {planCounts.get(plan.plan_key) ?? 0}
                </strong>
                <span>{plan.name} members</span>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {plan.monthly_price === 0
                ? 'Free'
                : `${plan.currency} ${Number(
                    plan.monthly_price,
                  ).toFixed(2)} monthly`}
              {plan.plan_key === 'family'
                ? ` · ${plan.family_seats} seats`
                : ''}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="toolbar">
          <Select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
          >
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="plus">Plus</option>
            <option value="premium">Premium</option>
            <option value="family">Family</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </Select>
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>Loading memberships…</strong>
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No memberships found"
            body="Change the filters or refresh the membership list."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Family profiles</th>
                  <th>Period end</th>
                  <th>Last sign-in</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const subscription = row.subscription;
                  const plan = subscription?.plan ?? 'free';
                  const status = subscription?.status ?? 'active';

                  return (
                    <tr key={row.user.id}>
                      <td>
                        <strong>
                          {row.profile?.display_name ||
                            row.user.email ||
                            row.user.phone ||
                            'Unnamed user'}
                        </strong>
                        <br />
                        <span className="muted">
                          {row.user.email || row.user.id}
                        </span>
                      </td>
                      <td>
                        <Badge
                          tone={
                            plan === 'family' ||
                            plan === 'premium'
                              ? 'good'
                              : plan === 'plus'
                                ? 'info'
                                : 'neutral'
                          }
                        >
                          {titleCase(plan)}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={toneForStatus(status)}>
                          {titleCase(status)}
                        </Badge>
                      </td>
                      <td>
                        {titleCase(
                          subscription?.provider ?? 'manual',
                        )}
                      </td>
                      <td>{row.familyProfiles}</td>
                      <td>
                        {formatDate(
                          subscription?.current_period_end,
                        )}
                      </td>
                      <td>{formatDate(row.user.last_sign_in_at)}</td>
                      <td>
                        <Button
                          type="button"
                          className="secondary"
                          onClick={() => openMembership(row)}
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected ? (
        <Modal
          title={`Manage ${
            selected.profile?.display_name ||
            selected.user.email ||
            'membership'
          }`}
          onClose={() => setSelected(null)}
        >
          <div className="form-grid">
            <Field label="Plan">
              <Select
                value={form.plan}
                onChange={(event) =>
                  setForm({ ...form, plan: event.target.value })
                }
              >
                <option value="free">Free</option>
                <option value="plus">Plus</option>
                <option value="premium">Premium</option>
                <option value="family">Family</option>
              </Select>
            </Field>

            <Field label="Status">
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                <option value="trialing">Trialing</option>
                <option value="active">Active</option>
                <option value="past_due">Past due</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </Select>
            </Field>

            <Field label="Current period end">
              <Input
                type="date"
                value={form.currentPeriodEnd}
                onChange={(event) =>
                  setForm({
                    ...form,
                    currentPeriodEnd: event.target.value,
                  })
                }
              />
            </Field>

            <Field
              label="Audit reason"
              hint="Required for every manual membership change."
            >
              <Input
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
                placeholder="Support correction, trial extension…"
              />
            </Field>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="form-actions">
            <Button
              type="button"
              className="secondary"
              onClick={() => setSelected(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void saveMembership()}
            >
              Save membership
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
