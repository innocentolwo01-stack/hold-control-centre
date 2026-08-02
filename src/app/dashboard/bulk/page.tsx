'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  RefreshCw,
  Users,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
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
};

type Profile = {
  id: string;
  display_name?: string | null;
  account_status?: string | null;
};

type Subscription = {
  user_id: string;
  plan: string;
  status: string;
};

type UserResponse = {
  users?: AuthUser[];
  profiles?: Profile[];
  subscriptions?: Subscription[];
};

type BulkHistory = {
  id: string;
  action_type: string;
  status: string;
  target_count: number;
  success_count: number;
  failure_count: number;
  reason: string;
  created_at: string;
  completed_at?: string | null;
};

type UserRow = {
  user: AuthUser;
  profile?: Profile;
  subscription?: Subscription;
};

export default function BulkOperationsPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [history, setHistory] = useState<BulkHistory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [action, setAction] = useState('set_plan');
  const [plan, setPlan] = useState('plus');
  const [subscriptionStatus, setSubscriptionStatus] =
    useState('active');
  const [pointsDelta, setPointsDelta] = useState('100');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [response, historyResult] = await Promise.all([
        invokeAdmin<UserResponse>({
          action: 'list_users',
          page: 1,
          perPage: 100,
        }),
        supabase
          .from('bulk_operations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setUsers(response.users ?? []);
      setProfiles(response.profiles ?? []);
      setSubscriptions(response.subscriptions ?? []);

      if (historyResult.error) {
        throw historyResult.error;
      }

      setHistory((historyResult.data as BulkHistory[]) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load bulk operations.',
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

  const subscriptionMap = useMemo(
    () =>
      new Map(
        subscriptions.map((subscription) => [
          subscription.user_id,
          subscription,
        ]),
      ),
    [subscriptions],
  );

  const rows = useMemo<UserRow[]>(
    () =>
      users.map((user) => ({
        user,
        profile: profileMap.get(user.id),
        subscription: subscriptionMap.get(user.id),
      })),
    [users, profileMap, subscriptionMap],
  );

  function toggleUser(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function toggleAll() {
    setSelectedIds((current) =>
      current.length === rows.length
        ? []
        : rows.map((row) => row.user.id),
    );
  }

  async function runOperation() {
    if (selectedIds.length === 0) {
      setError('Select at least one user.');
      return;
    }

    if (!reason.trim()) {
      setError('A reason is required for every bulk action.');
      return;
    }

    if (
      action === 'adjust_points' &&
      Math.trunc(Number(pointsDelta)) === 0
    ) {
      setError('Enter a non-zero points adjustment.');
      return;
    }

    const confirmed = window.confirm(
      `Apply ${action.replaceAll('_', ' ')} to ${
        selectedIds.length
      } selected users?`,
    );

    if (!confirmed) return;

    setProcessing(true);
    setError('');
    setSuccess('');

    const parameters =
      action === 'set_plan'
        ? { plan, status: subscriptionStatus }
        : action === 'adjust_points'
          ? { delta: Math.trunc(Number(pointsDelta)) }
          : { status: action === 'suspend' ? 'suspended' : 'active' };

    const insertResult = await supabase
      .from('bulk_operations')
      .insert({
        action_type: action,
        status: 'processing',
        target_count: selectedIds.length,
        reason: reason.trim(),
        parameters,
      })
      .select('id')
      .single();

    if (insertResult.error) {
      setError(insertResult.error.message);
      setProcessing(false);
      return;
    }

    const operationId = String(insertResult.data.id);
    let successes = 0;
    const failures: Array<{ userId: string; error: string }> = [];

    for (const userId of selectedIds) {
      try {
        if (action === 'set_plan') {
          await invokeAdmin({
            action: 'set_subscription',
            userId,
            plan,
            status: subscriptionStatus,
            currentPeriodEnd: null,
            reason: reason.trim(),
          });
        } else if (action === 'adjust_points') {
          await invokeAdmin({
            action: 'adjust_points',
            userId,
            delta: Math.trunc(Number(pointsDelta)),
            reason: reason.trim(),
          });
        } else {
          await invokeAdmin({
            action: 'set_account_status',
            userId,
            status: action === 'suspend' ? 'suspended' : 'active',
            reason: reason.trim(),
          });
        }

        successes += 1;
      } catch (operationError) {
        failures.push({
          userId,
          error:
            operationError instanceof Error
              ? operationError.message
              : 'Unknown failure',
        });
      }
    }

    const finalStatus =
      failures.length === 0
        ? 'completed'
        : successes === 0
          ? 'failed'
          : 'partially_failed';

    await supabase
      .from('bulk_operations')
      .update({
        status: finalStatus,
        success_count: successes,
        failure_count: failures.length,
        result_summary: { failures },
        completed_at: new Date().toISOString(),
      })
      .eq('id', operationId);

    setProcessing(false);
    setSelectedIds([]);
    setReason('');
    setSuccess(
      `${successes} users updated. ${failures.length} failed.`,
    );

    await load();
  }

  return (
    <>
      <PageHeader
        title="Bulk Operations"
        description="Apply controlled membership, points and account-access actions to selected users with full audit reasons and operation history."
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

      <div className="grid two">
        <Card>
          <div className="stat">
            <div className="stat-icon">
              <CheckSquare size={20} />
            </div>
            <div>
              <strong>{selectedIds.length}</strong>
              <span>Selected users</span>
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 18 }}>
            <Field label="Bulk action">
              <Select
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="set_plan">Set membership plan</option>
                <option value="adjust_points">Adjust points</option>
                <option value="suspend">Suspend accounts</option>
                <option value="reactivate">Reactivate accounts</option>
              </Select>
            </Field>

            {action === 'set_plan' ? (
              <>
                <Field label="Plan">
                  <Select
                    value={plan}
                    onChange={(event) => setPlan(event.target.value)}
                  >
                    <option value="free">Free</option>
                    <option value="plus">Plus</option>
                    <option value="premium">Premium</option>
                    <option value="family">Family</option>
                  </Select>
                </Field>
                <Field label="Subscription status">
                  <Select
                    value={subscriptionStatus}
                    onChange={(event) =>
                      setSubscriptionStatus(event.target.value)
                    }
                  >
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </Select>
                </Field>
              </>
            ) : null}

            {action === 'adjust_points' ? (
              <Field
                label="Points adjustment"
                hint="Use a negative number to deduct points."
              >
                <Input
                  type="number"
                  value={pointsDelta}
                  onChange={(event) =>
                    setPointsDelta(event.target.value)
                  }
                />
              </Field>
            ) : null}

            <Field
              label="Required reason"
              hint="This reason is written to every affected user's audit history."
            >
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Campaign credit, support correction…"
              />
            </Field>
          </div>

          <div className="form-actions">
            <Button
              type="button"
              disabled={processing || selectedIds.length === 0}
              onClick={() => void runOperation()}
            >
              Apply to {selectedIds.length} users
            </Button>
          </div>
        </Card>

        <Card>
          <div className="stat">
            <div className="stat-icon">
              <Users size={20} />
            </div>
            <div>
              <strong>{rows.length}</strong>
              <span>Loaded users</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            Bulk actions process each account separately. One failed
            record does not silently cancel successful changes for the
            remaining users.
          </p>
        </Card>
      </div>

      <Card style={{ marginTop: 18 }}>
        {loading ? (
          <div className="empty-state">
            <strong>Loading users…</strong>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No users loaded"
            body="Refresh the page to load eligible accounts."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        rows.length > 0 &&
                        selectedIds.length === rows.length
                      }
                      onChange={toggleAll}
                      aria-label="Select all loaded users"
                    />
                  </th>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Subscription</th>
                  <th>Account status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.user.id)}
                        onChange={() => toggleUser(row.user.id)}
                        aria-label={`Select ${
                          row.profile?.display_name ||
                          row.user.email ||
                          row.user.id
                        }`}
                      />
                    </td>
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
                      <Badge tone="neutral">
                        {titleCase(
                          row.subscription?.plan ?? 'free',
                        )}
                      </Badge>
                    </td>
                    <td>
                      {titleCase(
                        row.subscription?.status ?? 'active',
                      )}
                    </td>
                    <td>
                      <Badge
                        tone={
                          row.profile?.account_status === 'suspended'
                            ? 'bad'
                            : 'good'
                        }
                      >
                        {titleCase(
                          row.profile?.account_status ?? 'active',
                        )}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 18 }}>
        <h2>Operation history</h2>
        {history.length === 0 ? (
          <EmptyState
            title="No bulk operations"
            body="Completed bulk actions will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Targets</th>
                  <th>Successful</th>
                  <th>Failed</th>
                  <th>Reason</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {history.map((operation) => (
                  <tr key={operation.id}>
                    <td>{titleCase(operation.action_type)}</td>
                    <td>
                      <Badge
                        tone={
                          operation.status === 'completed'
                            ? 'good'
                            : operation.status === 'failed'
                              ? 'bad'
                              : 'warn'
                        }
                      >
                        {titleCase(operation.status)}
                      </Badge>
                    </td>
                    <td>{operation.target_count}</td>
                    <td>{operation.success_count}</td>
                    <td>{operation.failure_count}</td>
                    <td>{operation.reason}</td>
                    <td>{formatDate(operation.created_at)}</td>
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
