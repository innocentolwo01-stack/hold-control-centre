'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
} from '@/components/ui';
import { formatDate, titleCase } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type RiskCase = {
  id: string;
  user_id?: string | null;
  profile_id?: string | null;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'monitoring' | 'resolved' | 'dismissed';
  title: string;
  suspicion_reason: string;
  evidence: Record<string, unknown>;
  action_taken?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
};

function severityTone(severity: RiskCase['severity']) {
  if (severity === 'critical' || severity === 'high') return 'bad';
  if (severity === 'medium') return 'warn';
  return 'info';
}

function statusTone(status: RiskCase['status']) {
  if (status === 'resolved') return 'good';
  if (status === 'dismissed') return 'neutral';
  if (status === 'monitoring') return 'warn';
  return 'bad';
}

export default function RiskPage() {
  const [cases, setCases] = useState<RiskCase[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    const caseResult = await supabase
      .from('risk_cases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);

    if (caseResult.error) {
      setError(caseResult.error.message);
      setLoading(false);
      return;
    }

    const nextCases = (caseResult.data as RiskCase[]) ?? [];
    setCases(nextCases);

    const userIds = Array.from(
      new Set(
        nextCases
          .map((riskCase) => riskCase.user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (userIds.length > 0) {
      const profileResult = await supabase
        .from('profiles')
        .select('id,display_name,username')
        .in('id', userIds);

      if (!profileResult.error) {
        setProfiles((profileResult.data as Profile[]) ?? []);
      }
    } else {
      setProfiles([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const filteredCases = cases.filter((riskCase) => {
    return (
      (severity === 'all' || riskCase.severity === severity) &&
      (status === 'all' || riskCase.status === status)
    );
  });

  const openCount = cases.filter(
    (riskCase) => riskCase.status === 'open',
  ).length;
  const highCount = cases.filter(
    (riskCase) =>
      riskCase.status === 'open' &&
      ['high', 'critical'].includes(riskCase.severity),
  ).length;
  const monitoringCount = cases.filter(
    (riskCase) => riskCase.status === 'monitoring',
  ).length;

  async function updateStatus(
    riskCase: RiskCase,
    nextStatus: RiskCase['status'],
  ) {
    const note = window.prompt(
      `Enter the review note for marking this case ${nextStatus}:`,
    );

    if (note === null) return;
    if (!note.trim()) {
      setError('A review note is required.');
      return;
    }

    setBusy(riskCase.id);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload: Record<string, unknown> = {
      status: nextStatus,
      review_notes: note.trim(),
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'resolved' || nextStatus === 'dismissed') {
      payload.resolved_at = new Date().toISOString();
      payload.resolved_by = user?.id ?? null;
    } else {
      payload.resolved_at = null;
      payload.resolved_by = null;
    }

    const result = await supabase
      .from('risk_cases')
      .update(payload)
      .eq('id', riskCase.id);

    setBusy('');

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  return (
    <>
      <PageHeader
        title="Risk Centre"
        description="Review suspicious user behaviour, the reason for each flag, supporting evidence and the action already taken."
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

      <div className="grid three" style={{ marginBottom: 18 }}>
        <Card>
          <div className="stat">
            <div className="stat-icon">
              <ShieldAlert size={20} />
            </div>
            <div>
              <strong>{openCount}</strong>
              <span>Open risk cases</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <strong>{highCount}</strong>
              <span>High or critical</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat-icon">
              <RefreshCw size={20} />
            </div>
            <div>
              <strong>{monitoringCount}</strong>
              <span>Under monitoring</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="toolbar">
          <Select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="monitoring">Monitoring</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </Select>
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>Loading risk cases…</strong>
          </div>
        ) : filteredCases.length === 0 ? (
          <EmptyState
            title="No matching risk cases"
            body="New screenshot and redemption security events will be marked here automatically."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>User</th>
                  <th>Suspicion</th>
                  <th>Evidence</th>
                  <th>Action taken</th>
                  <th>Detected</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((riskCase) => {
                  const profile = riskCase.user_id
                    ? profileMap.get(riskCase.user_id)
                    : undefined;

                  return (
                    <tr key={riskCase.id}>
                      <td>
                        <Badge tone={severityTone(riskCase.severity)}>
                          {titleCase(riskCase.severity)}
                        </Badge>
                        <br />
                        <Badge tone={statusTone(riskCase.status)}>
                          {titleCase(riskCase.status)}
                        </Badge>
                      </td>
                      <td>
                        <strong>
                          {profile?.display_name || 'Unknown user'}
                        </strong>
                        <br />
                        <span className="muted">
                          {profile?.username
                            ? `@${profile.username}`
                            : riskCase.user_id || 'No user ID'}
                        </span>
                      </td>
                      <td>
                        <strong>{riskCase.title}</strong>
                        <br />
                        <span className="muted">
                          {riskCase.suspicion_reason}
                        </span>
                      </td>
                      <td>
                        <details>
                          <summary>View evidence</summary>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              maxWidth: 420,
                            }}
                          >
                            {JSON.stringify(
                              riskCase.evidence,
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </td>
                      <td>
                        {riskCase.action_taken || 'No automatic action'}
                      </td>
                      <td>{formatDate(riskCase.created_at)}</td>
                      <td>
                        <div className="page-actions">
                          {riskCase.status !== 'monitoring' ? (
                            <Button
                              type="button"
                              className="secondary"
                              disabled={busy === riskCase.id}
                              onClick={() =>
                                void updateStatus(
                                  riskCase,
                                  'monitoring',
                                )
                              }
                            >
                              Monitor
                            </Button>
                          ) : null}
                          {riskCase.status !== 'resolved' ? (
                            <Button
                              type="button"
                              disabled={busy === riskCase.id}
                              onClick={() =>
                                void updateStatus(
                                  riskCase,
                                  'resolved',
                                )
                              }
                            >
                              Resolve
                            </Button>
                          ) : null}
                          {riskCase.status !== 'dismissed' ? (
                            <Button
                              type="button"
                              className="secondary"
                              disabled={busy === riskCase.id}
                              onClick={() =>
                                void updateStatus(
                                  riskCase,
                                  'dismissed',
                                )
                              }
                            >
                              Dismiss
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
