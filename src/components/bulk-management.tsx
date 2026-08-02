'use client';

import { useMemo, useState } from 'react';
import { CheckSquare, LoaderCircle, RotateCcw, Trash2, X } from 'lucide-react';

import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export type LifecycleView = 'all' | 'active' | 'draft' | 'archived' | 'deleted';

export type BulkActionOption = {
  value:
    | 'activate'
    | 'publish'
    | 'suspend'
    | 'draft'
    | 'archive'
    | 'delete'
    | 'restore'
    | 'permanently_delete';
  label: string;
  description: string;
  requiresReason?: boolean;
  permanent?: boolean;
};

type BulkActionResult = {
  operation_id?: string;
  target_count?: number;
  success_count?: number;
  failure_count?: number;
  failures?: Array<{ id: string; error: string }>;
};

type LifecycleTabsProps = {
  value: LifecycleView;
  onChange: (value: LifecycleView) => void;
  counts: Record<LifecycleView, number>;
};

const tabLabels: Record<LifecycleView, string> = {
  all: 'All',
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
  deleted: 'Deleted',
};

export function LifecycleTabs({ value, onChange, counts }: LifecycleTabsProps) {
  return (
    <div className="lifecycle-tabs" role="tablist" aria-label="Record status">
      {(Object.keys(tabLabels) as LifecycleView[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          className={value === tab ? 'active' : ''}
          onClick={() => onChange(tab)}
        >
          <span>{tabLabels[tab]}</span>
          <strong>{counts[tab] ?? 0}</strong>
        </button>
      ))}
    </div>
  );
}

type BulkActionBarProps = {
  entityType: 'user' | 'partner' | 'reward' | 'coupon' | 'campaign';
  noun: string;
  selectedIds: string[];
  visibleCount: number;
  allVisibleSelected: boolean;
  actions: BulkActionOption[];
  onToggleAll: () => void;
  onClear: () => void;
  onComplete: () => Promise<void> | void;
};

export function BulkActionBar({
  entityType,
  noun,
  selectedIds,
  visibleCount,
  allVisibleSelected,
  actions,
  onToggleAll,
  onClear,
  onComplete,
}: BulkActionBarProps) {
  const [actionValue, setActionValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedAction = useMemo(
    () => actions.find((action) => action.value === actionValue) ?? null,
    [actionValue, actions],
  );

  const permanentPhrase = 'PERMANENTLY DELETE';

  function beginAction() {
    setError('');
    setMessage('');

    if (selectedIds.length === 0) {
      setError(`Select at least one ${noun}.`);
      return;
    }

    if (!selectedAction) {
      setError('Choose a bulk action.');
      return;
    }

    setReason('');
    setConfirmation('');
    setConfirmOpen(true);
  }

  async function runAction() {
    if (!selectedAction) return;

    if (selectedAction.requiresReason && !reason.trim()) {
      setError('Enter a reason for this action.');
      return;
    }

    if (selectedAction.permanent && confirmation !== permanentPhrase) {
      setError(`Type ${permanentPhrase} to continue.`);
      return;
    }

    setWorking(true);
    setError('');
    setMessage('');

    const { data, error: actionError } = await supabase.rpc('admin_bulk_action', {
      p_entity_type: entityType,
      p_action: selectedAction.value,
      p_ids: selectedIds,
      p_reason: reason.trim() || null,
    });

    setWorking(false);

    if (actionError) {
      setError(actionError.message.replaceAll('_', ' '));
      return;
    }

    const result = (data ?? {}) as BulkActionResult;
    const succeeded = result.success_count ?? selectedIds.length;
    const failed = result.failure_count ?? 0;

    setConfirmOpen(false);
    setActionValue('');
    setReason('');
    setConfirmation('');
    onClear();
    await onComplete();

    if (failed > 0) {
      const firstFailure = result.failures?.[0]?.error?.replaceAll('_', ' ');
      setMessage(
        `${succeeded} completed and ${failed} failed.${firstFailure ? ` First failure: ${firstFailure}.` : ''}`,
      );
    } else {
      setMessage(`${succeeded} ${noun}${succeeded === 1 ? '' : 's'} updated.`);
    }
  }

  return (
    <>
      <div className="bulk-action-bar">
        <label className="bulk-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected && visibleCount > 0}
            onChange={onToggleAll}
            disabled={visibleCount === 0}
          />
          <span>
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `Select all ${visibleCount} shown`}
          </span>
        </label>

        <div className="bulk-action-controls">
          <Select
            value={actionValue}
            onChange={(event) => setActionValue(event.target.value)}
            disabled={selectedIds.length === 0}
            aria-label="Bulk action"
          >
            <option value="">Bulk actions</option>
            {actions.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </Select>

          <Button
            type="button"
            className={selectedAction?.permanent ? 'danger' : ''}
            onClick={beginAction}
            disabled={selectedIds.length === 0 || !selectedAction}
          >
            <CheckSquare size={16} /> Apply
          </Button>

          {selectedIds.length > 0 ? (
            <button type="button" className="bulk-clear" onClick={onClear}>
              <X size={15} /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="bulk-result success">{message}</p> : null}
      {error && !confirmOpen ? <p className="bulk-result error">{error}</p> : null}

      {confirmOpen && selectedAction ? (
        <Modal
          title={selectedAction.permanent ? 'Confirm permanent deletion' : `Confirm ${selectedAction.label.toLowerCase()}`}
          onClose={() => !working && setConfirmOpen(false)}
        >
          <div className="bulk-confirmation">
            <div className={selectedAction.permanent ? 'bulk-warning danger' : 'bulk-warning'}>
              {selectedAction.permanent ? <Trash2 size={22} /> : <RotateCcw size={22} />}
              <div>
                <strong>
                  {selectedAction.label} {selectedIds.length} {noun}
                  {selectedIds.length === 1 ? '' : 's'}
                </strong>
                <p>{selectedAction.description}</p>
              </div>
            </div>

            {selectedAction.requiresReason ? (
              <label className="field">
                <span className="field-label">Reason</span>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain why this action is being taken"
                  autoFocus
                />
              </label>
            ) : null}

            {selectedAction.permanent ? (
              <label className="field">
                <span className="field-label">Type {permanentPhrase}</span>
                <Input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                />
              </label>
            ) : null}

            {error ? <p className="error">{error}</p> : null}

            <div className="form-actions">
              <Button
                type="button"
                className="secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={working}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={selectedAction.permanent ? 'danger' : ''}
                onClick={() => void runAction()}
                disabled={working}
              >
                {working ? <LoaderCircle className="spin-icon" size={16} /> : null}
                {working ? 'Applying…' : selectedAction.label}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export const contentBulkActions: BulkActionOption[] = [
  {
    value: 'publish',
    label: 'Publish',
    description: 'The selected records will become active and visible where their other rules allow.',
  },
  {
    value: 'draft',
    label: 'Move to draft',
    description: 'The selected records will stop being active and return to draft.',
  },
  {
    value: 'archive',
    label: 'Archive',
    description: 'The selected records will be retained but removed from normal active use.',
  },
  {
    value: 'delete',
    label: 'Delete',
    description: 'The selected records will move to Deleted and can still be restored.',
    requiresReason: true,
  },
];

export const deletedBulkActions: BulkActionOption[] = [
  {
    value: 'restore',
    label: 'Restore',
    description: 'The selected records will return to the status they had before deletion.',
  },
  {
    value: 'permanently_delete',
    label: 'Permanently delete',
    description: 'This cannot be undone. Records linked to protected history may be refused rather than removed.',
    requiresReason: true,
    permanent: true,
  },
];

export const userBulkActions: BulkActionOption[] = [
  {
    value: 'activate',
    label: 'Activate',
    description: 'The selected users will be allowed to use their accounts again.',
  },
  {
    value: 'suspend',
    label: 'Suspend',
    description: 'The selected accounts will be suspended and the reason will be recorded.',
    requiresReason: true,
  },
  {
    value: 'archive',
    label: 'Archive',
    description: 'The selected users will be closed but retained in the main user records.',
  },
  {
    value: 'delete',
    label: 'Delete',
    description: 'The selected users will move to Deleted. Their accounts are not permanently removed yet.',
    requiresReason: true,
  },
];
