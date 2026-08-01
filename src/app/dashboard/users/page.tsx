'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Coins,
  RefreshCw,
  Search,
  UserCog,
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
  Textarea,
} from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type AuthUserRow = {
  id: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  total_count?: number | string | null;
};

type ProfileRow = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  age_band?: string | null;
  account_status?: string | null;
  suspension_reason?: string | null;
  suspended_at?: string | null;
  updated_at?: string | null;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  provider?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  updated_at?: string | null;
};

type MemberProfileRow = {
  id: string;
  account_user_id: string;
  linked_user_id?: string | null;
  display_name: string;
  profile_type: string;
  active: boolean;
};

type PointBalanceRow = {
  profile_id: string;
  balance: number;
};

type UserListResponse = {
  users?: AuthUserRow[];
  profiles?: ProfileRow[];
  subscriptions?: SubscriptionRow[];
  memberProfiles?: MemberProfileRow[];
  pointBalances?: PointBalanceRow[];
  page?: number;
  perPage?: number;
  total?: number;
  error?: string;
  detail?: string;
};

type UserForm = {
  displayName: string;
  username: string;
  email: string;
  role: string;
  ageBand: string;
  profileReason: string;

  plan: string;
  subscriptionStatus: string;
  currentPeriodEnd: string;
  subscriptionReason: string;

  pointsDelta: string;
  pointsReason: string;

  supportNote: string;
};

const blankForm: UserForm = {
  displayName: '',
  username: '',
  email: '',
  role: 'adult',
  ageBand: '18-plus',
  profileReason: '',

  plan: 'free',
  subscriptionStatus: 'active',
  currentPeriodEnd: '',
  subscriptionReason: '',

  pointsDelta: '',
  pointsReason: '',

  supportNote: '',
};

function localDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

function messageFromResponse(
  data: Record<string, unknown> | null | undefined,
  fallback: string,
) {
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.error === 'string') return data.error;

  return fallback;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AuthUserRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    SubscriptionRow[]
  >([]);
  const [memberProfiles, setMemberProfiles] = useState<
    MemberProfileRow[]
  >([]);
  const [pointBalances, setPointBalances] = useState<
    PointBalanceRow[]
  >([]);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<AuthUserRow | null>(
    null,
  );
  const [form, setForm] = useState<UserForm>(blankForm);
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const perPage = 50;

  async function invokeAdmin(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { data, error: invokeError } =
      await supabase.functions.invoke('admin-control', {
        body,
      });

    if (invokeError) {
      throw new Error(invokeError.message);
    }

    const response = (data ?? {}) as Record<string, unknown>;

    if (response.error) {
      throw new Error(
        messageFromResponse(
          response,
          'The administrator action failed.',
        ),
      );
    }

    return response;
  }

  async function loadUsers(nextPage = page) {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = (await invokeAdmin({
        action: 'list_users',
        query: query.trim() || null,
        page: nextPage,
        perPage,
      })) as UserListResponse;

      setUsers(response.users ?? []);
      setProfiles(response.profiles ?? []);
      setSubscriptions(response.subscriptions ?? []);
      setMemberProfiles(response.memberProfiles ?? []);
      setPointBalances(response.pointBalances ?? []);
      setTotal(Number(response.total ?? 0));
      setPage(Number(response.page ?? nextPage));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load users.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(1);
  }, []);

  const profileByUser = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const subscriptionByUser = useMemo(() => {
    const map = new Map<string, SubscriptionRow>();

    for (const subscription of subscriptions) {
      if (!map.has(subscription.user_id)) {
        map.set(subscription.user_id, subscription);
      }
    }

    return map;
  }, [subscriptions]);

  const pointsByMember = useMemo(
    () =>
      new Map(
        pointBalances.map((entry) => [
          entry.profile_id,
          Number(entry.balance ?? 0),
        ]),
      ),
    [pointBalances],
  );

  const pointsByUser = useMemo(() => {
    const map = new Map<string, number>();

    for (const member of memberProfiles) {
      const current = map.get(member.account_user_id) ?? 0;
      const balance = pointsByMember.get(member.id) ?? 0;

      map.set(member.account_user_id, current + balance);
    }

    return map;
  }, [memberProfiles, pointsByMember]);

  function launch(user: AuthUserRow) {
    const profile = profileByUser.get(user.id);
    const subscription = subscriptionByUser.get(user.id);

    setSelected(user);

    setForm({
      displayName: profile?.display_name ?? '',
      username: profile?.username ?? '',
      email: user.email ?? '',
      role: profile?.role ?? 'adult',
      ageBand: profile?.age_band ?? '18-plus',
      profileReason: '',

      plan: subscription?.plan ?? 'free',
      subscriptionStatus: subscription?.status ?? 'active',
      currentPeriodEnd: localDate(
        subscription?.current_period_end,
      ),
      subscriptionReason: '',

      pointsDelta: '',
      pointsReason: '',

      supportNote: '',
    });

    setError('');
    setSuccess('');
    setOpen(true);
  }

  async function updateProfile(event: React.FormEvent) {
    event.preventDefault();

    if (!selected) return;

    setBusy('profile');
    setError('');
    setSuccess('');

    try {
      await invokeAdmin({
        action: 'update_user_profile',
        userId: selected.id,
        displayName: form.displayName,
        username: form.username,
        email: form.email,
        role: form.role,
        ageBand: form.ageBand,
        reason: form.profileReason,
      });

      setSuccess('User profile updated.');
      await loadUsers(page);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update the profile.',
      );
    } finally {
      setBusy('');
    }
  }

  async function updateSubscription() {
    if (!selected) return;

    setBusy('subscription');
    setError('');
    setSuccess('');

    try {
      await invokeAdmin({
        action: 'set_subscription',
        userId: selected.id,
        plan: form.plan,
        status: form.subscriptionStatus,
        currentPeriodEnd: form.currentPeriodEnd
          ? new Date(
              `${form.currentPeriodEnd}T23:59:59`,
            ).toISOString()
          : null,
        reason:
          form.subscriptionReason ||
          'Control Centre subscription update',
      });

      setSuccess('Subscription updated.');
      await loadUsers(page);
    } catch (subscriptionError) {
      setError(
        subscriptionError instanceof Error
          ? subscriptionError.message
          : 'Unable to update the subscription.',
      );
    } finally {
      setBusy('');
    }
  }

  async function adjustPoints() {
    if (!selected) return;

    const delta = Math.trunc(Number(form.pointsDelta));

    if (!delta || !form.pointsReason.trim()) {
      setError(
        'Enter a non-zero points adjustment and an audit reason.',
      );
      return;
    }

    setBusy('points');
    setError('');
    setSuccess('');

    try {
      const response = await invokeAdmin({
        action: 'adjust_points',
        userId: selected.id,
        delta,
        reason: form.pointsReason.trim(),
      });

      setForm((current) => ({
        ...current,
        pointsDelta: '',
        pointsReason: '',
      }));

      setSuccess(
        `Points updated. New balance: ${Number(
          response.balance ?? 0,
        ).toLocaleString('en-GB')}.`,
      );

      await loadUsers(page);
    } catch (pointsError) {
      setError(
        pointsError instanceof Error
          ? pointsError.message
          : 'Unable to adjust points.',
      );
    } finally {
      setBusy('');
    }
  }

  async function addSupportNote() {
    if (!selected || !form.supportNote.trim()) {
      setError('Enter a support note first.');
      return;
    }

    setBusy('note');
    setError('');
    setSuccess('');

    try {
      await invokeAdmin({
        action: 'add_support_note',
        userId: selected.id,
        note: form.supportNote.trim(),
      });

      setForm((current) => ({
        ...current,
        supportNote: '',
      }));

      setSuccess('Internal support note added.');
    } catch (noteError) {
      setError(
        noteError instanceof Error
          ? noteError.message
          : 'Unable to add the support note.',
      );
    } finally {
      setBusy('');
    }
  }

  async function changeAccountStatus(
    status: 'active' | 'suspended',
  ) {
    if (!selected) return;

    let reason = '';

    if (status === 'suspended') {
      const supplied = window.prompt(
        'Enter the reason for suspending this account:',
      );

      if (supplied === null) return;

      reason = supplied.trim();

      if (!reason) {
        setError('A suspension reason is required.');
        return;
      }
    } else {
      reason = 'Account reactivated by administrator';
    }

    setBusy('status');
    setError('');
    setSuccess('');

    try {
      await invokeAdmin({
        action: 'set_account_status',
        userId: selected.id,
        status,
        reason,
      });

      setSuccess(
        status === 'active'
          ? 'Account reactivated.'
          : 'Account suspended.',
      );

      await loadUsers(page);

      const updated = {
        ...selected,
      };

      setSelected(updated);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Unable to change the account status.',
      );
    } finally {
      setBusy('');
    }
  }

  const selectedProfile = selected
    ? profileByUser.get(selected.id)
    : undefined;

  const selectedPoints = selected
    ? pointsByUser.get(selected.id) ?? 0
    : 0;

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <PageHeader
        title="Users"
        description="Search accounts, manage user profiles, subscriptions, points, access status and internal support notes."
        actions={
          <Button
            type="button"
            className="secondary"
            onClick={() => void loadUsers(page)}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />

      <Card>
        <form
          className="toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            void loadUsers(1);
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, phone, name or username"
          />

          <Button type="submit" disabled={loading}>
            <Search size={16} />
            Search
          </Button>
        </form>

        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        {loading ? (
          <div className="empty-state">
            <strong>Loading users…</strong>
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users found"
            body="Try another email address, username, phone number or display name."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Profile</th>
                    <th>Plan</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th>Last sign-in</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => {
                    const profile = profileByUser.get(user.id);
                    const subscription =
                      subscriptionByUser.get(user.id);
                    const accountStatus =
                      profile?.account_status ?? 'active';

                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>
                            {user.email ||
                              user.phone ||
                              'No contact details'}
                          </strong>
                          <br />
                          <span className="muted">
                            {user.id}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {profile?.display_name ||
                              'Unnamed user'}
                          </strong>
                          <br />
                          <span className="muted">
                            {profile?.username
                              ? `@${profile.username}`
                              : titleCase(
                                  profile?.role ?? 'adult',
                                )}
                          </span>
                        </td>

                        <td>
                          <Badge
                            tone={
                              subscription?.plan === 'premium' ||
                              subscription?.plan === 'family'
                                ? 'good'
                                : subscription?.plan === 'plus'
                                  ? 'info'
                                  : 'neutral'
                            }
                          >
                            {titleCase(
                              subscription?.plan ?? 'free',
                            )}
                          </Badge>
                          <br />
                          <span className="muted">
                            {titleCase(
                              subscription?.status ?? 'active',
                            )}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {(
                              pointsByUser.get(user.id) ?? 0
                            ).toLocaleString('en-GB')}
                          </strong>
                        </td>

                        <td>
                          <Badge
                            tone={
                              accountStatus === 'active'
                                ? 'good'
                                : 'bad'
                            }
                          >
                            {titleCase(accountStatus)}
                          </Badge>
                        </td>

                        <td>
                          {formatDate(user.last_sign_in_at)}
                        </td>

                        <td>{formatDate(user.created_at)}</td>

                        <td>
                          <Button
                            type="button"
                            className="secondary"
                            onClick={() => launch(user)}
                          >
                            <UserCog size={15} />
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="toolbar"
              style={{
                justifyContent: 'space-between',
                marginTop: 16,
                marginBottom: 0,
              }}
            >
              <span className="muted">
                Page {page} of {totalPages} · {total} users
              </span>

              <div className="page-actions">
                <Button
                  type="button"
                  className="secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => void loadUsers(page - 1)}
                >
                  Previous
                </Button>

                <Button
                  type="button"
                  className="secondary"
                  disabled={page >= totalPages || loading}
                  onClick={() => void loadUsers(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {open && selected ? (
        <Modal
          title={`Manage ${
            selectedProfile?.display_name ||
            selected.email ||
            'user'
          }`}
          onClose={() => setOpen(false)}
        >
          <div className="grid three" style={{ marginBottom: 18 }}>
            <Card>
              <div className="stat">
                <div className="stat-icon">
                  <Coins size={20} />
                </div>
                <div>
                  <strong>
                    {selectedPoints.toLocaleString('en-GB')}
                  </strong>
                  <span>Current points</span>
                </div>
              </div>
            </Card>

            <Card>
              <strong>
                {titleCase(
                  subscriptionByUser.get(selected.id)?.plan ??
                    'free',
                )}
              </strong>
              <p className="muted">Current plan</p>
            </Card>

            <Card>
              <strong>
                {titleCase(
                  selectedProfile?.account_status ?? 'active',
                )}
              </strong>
              <p className="muted">Account status</p>
            </Card>
          </div>

          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="success">{success}</p> : null}

          <form onSubmit={updateProfile}>
            <div className="form-section-title">
              <h3>Profile</h3>
              <p>
                Update identity and profile details. Email changes
                require owner or super-administrator access.
              </p>
            </div>

            <div className="form-grid">
              <Field label="Display name">
                <Input
                  value={form.displayName}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      displayName: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Username">
                <Input
                  value={form.username}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      username: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Profile role">
                <Select
                  value={form.role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value,
                    })
                  }
                >
                  <option value="adult">Adult</option>
                  <option value="teen">Teen</option>
                  <option value="child">Child</option>
                </Select>
              </Field>

              <Field label="Age band">
                <Select
                  value={form.ageBand}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      ageBand: event.target.value,
                    })
                  }
                >
                  <option value="under-13">Under 13</option>
                  <option value="13-17">13–17</option>
                  <option value="18-plus">18+</option>
                </Select>
              </Field>

              <Field label="Audit reason">
                <Input
                  value={form.profileReason}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      profileReason: event.target.value,
                    })
                  }
                  placeholder="Reason for the change"
                />
              </Field>
            </div>

            <div className="form-actions">
              <Button
                type="submit"
                disabled={busy === 'profile'}
              >
                Save profile
              </Button>
            </div>
          </form>

          <div className="form-section-title">
            <h3>Subscription</h3>
            <p>
              Grant or change a Hold subscription manually.
            </p>
          </div>

          <div className="form-grid">
            <Field label="Plan">
              <Select
                value={form.plan}
                onChange={(event) =>
                  setForm({
                    ...form,
                    plan: event.target.value,
                  })
                }
              >
                <option value="free">Free</option>
                <option value="plus">Plus</option>
                <option value="premium">Premium</option>
                <option value="family">Family</option>
              </Select>
            </Field>

            <Field label="Subscription status">
              <Select
                value={form.subscriptionStatus}
                onChange={(event) =>
                  setForm({
                    ...form,
                    subscriptionStatus: event.target.value,
                  })
                }
              >
                <option value="trialing">Trialling</option>
                <option value="active">Active</option>
                <option value="past_due">Past due</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="paused">Paused</option>
              </Select>
            </Field>

            <Field label="Period end">
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

            <Field label="Audit reason">
              <Input
                value={form.subscriptionReason}
                onChange={(event) =>
                  setForm({
                    ...form,
                    subscriptionReason: event.target.value,
                  })
                }
                placeholder="Why is the plan changing?"
              />
            </Field>
          </div>

          <div className="form-actions">
            <Button
              type="button"
              disabled={busy === 'subscription'}
              onClick={() => void updateSubscription()}
            >
              Save subscription
            </Button>
          </div>

          <div className="form-section-title">
            <h3>Points</h3>
            <p>
              Add or deduct points. Every adjustment is written to
              the points ledger and audit log.
            </p>
          </div>

          <div className="form-grid">
            <Field label="Points adjustment">
              <Input
                type="number"
                value={form.pointsDelta}
                onChange={(event) =>
                  setForm({
                    ...form,
                    pointsDelta: event.target.value,
                  })
                }
                placeholder="Use a negative number to deduct"
              />
            </Field>

            <Field label="Required reason">
              <Input
                value={form.pointsReason}
                onChange={(event) =>
                  setForm({
                    ...form,
                    pointsReason: event.target.value,
                  })
                }
                placeholder="Promotional credit, correction, refund…"
              />
            </Field>
          </div>

          <div className="form-actions">
            <Button
              type="button"
              disabled={busy === 'points'}
              onClick={() => void adjustPoints()}
            >
              <Coins size={16} />
              Apply points adjustment
            </Button>
          </div>

          <div className="form-section-title">
            <h3>Internal support note</h3>
            <p>
              Notes are visible only inside the Control Centre.
            </p>
          </div>

          <Field label="Support note">
            <Textarea
              value={form.supportNote}
              onChange={(event) =>
                setForm({
                  ...form,
                  supportNote: event.target.value,
                })
              }
            />
          </Field>

          <div className="form-actions">
            <Button
              type="button"
              className="secondary"
              disabled={busy === 'note'}
              onClick={() => void addSupportNote()}
            >
              Add support note
            </Button>
          </div>

          <div className="form-section-title">
            <h3>Account access</h3>
            <p>
              Suspending an account blocks authentication until it
              is reactivated.
            </p>
          </div>

          <div className="form-actions">
            {selectedProfile?.account_status === 'suspended' ? (
              <Button
                type="button"
                disabled={busy === 'status'}
                onClick={() =>
                  void changeAccountStatus('active')
                }
              >
                <CheckCircle2 size={16} />
                Reactivate account
              </Button>
            ) : (
              <Button
                type="button"
                className="danger"
                disabled={busy === 'status'}
                onClick={() =>
                  void changeAccountStatus('suspended')
                }
              >
                <Ban size={16} />
                Suspend account
              </Button>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
