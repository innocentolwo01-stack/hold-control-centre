'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CheckSquare, Download, LayoutGrid, List, LoaderCircle, Search, Trash2, X } from 'lucide-react';

import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export type LayoutMode = 'tiles' | 'list';

export type OperationalAction = {
  value: string;
  label: string;
  description: string;
  requiresReason?: boolean;
  danger?: boolean;
};

type Result = {
  success_count?: number;
  failure_count?: number;
  failures?: Array<{ id: string; error: string }>;
};

export function LayoutSearchBar({
  layout,
  onLayout,
  search,
  onSearch,
  placeholder = 'Search records',
  extra,
}: {
  layout: LayoutMode;
  onLayout: (layout: LayoutMode) => void;
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="collection-toolbar">
      <label className="collection-search">
        <Search size={17} />
        <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />
      </label>
      <div className="collection-toolbar-actions">
        {extra}
        <div className="layout-switch" aria-label="Layout">
          <button type="button" className={layout === 'tiles' ? 'active' : ''} onClick={() => onLayout('tiles')} aria-label="Tile view">
            <LayoutGrid size={17} /> Tiles
          </button>
          <button type="button" className={layout === 'list' ? 'active' : ''} onClick={() => onLayout('list')} aria-label="List view">
            <List size={17} /> List
          </button>
        </div>
      </div>
    </div>
  );
}

export function SelectionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="record-checkbox" title={`Select ${label}`}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={`Select ${label}`} />
      <span />
    </label>
  );
}

export function usePersistedLayout(key: string, fallback: LayoutMode = 'tiles') {
  const [layout, setLayout] = useState<LayoutMode>(fallback);

  function hydrate() {
    const saved = window.localStorage.getItem(key);
    if (saved === 'tiles' || saved === 'list') setLayout(saved);
  }

  function update(next: LayoutMode) {
    setLayout(next);
    window.localStorage.setItem(key, next);
  }

  return { layout, update, hydrate };
}

export function OperationalBulkBar({
  entityType,
  noun,
  selectedIds,
  visibleIds,
  actions,
  onClear,
  onSelectVisible,
  onComplete,
}: {
  entityType: 'code_batch' | 'reward_code' | 'integration' | 'notification' | 'redemption_session' | 'merchant_staff' | 'feature_flag';
  noun: string;
  selectedIds: string[];
  visibleIds: string[];
  actions: OperationalAction[];
  onClear: () => void;
  onSelectVisible: (ids: string[]) => void;
  onComplete: () => Promise<void> | void;
}) {
  const [actionValue, setActionValue] = useState('');
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const action = useMemo(() => actions.find((item) => item.value === actionValue) ?? null, [actions, actionValue]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleAll() {
    if (allVisibleSelected) {
      onClear();
      return;
    }
    onSelectVisible(visibleIds);
  }

  function begin() {
    setError('');
    setMessage('');
    if (!action || selectedIds.length === 0) return;
    setReason('');
    setOpen(true);
  }

  async function run() {
    if (!action) return;
    if (action.requiresReason && !reason.trim()) {
      setError('Enter a reason for this action.');
      return;
    }

    setWorking(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('admin_operational_bulk_action', {
      p_entity_type: entityType,
      p_action: action.value,
      p_ids: selectedIds,
      p_reason: reason.trim() || null,
    });
    setWorking(false);

    if (rpcError) {
      setError(rpcError.message.replaceAll('_', ' '));
      return;
    }

    const result = (data ?? {}) as Result;
    const success = result.success_count ?? selectedIds.length;
    const failures = result.failure_count ?? 0;
    setOpen(false);
    setActionValue('');
    onClear();
    await onComplete();
    const first = result.failures?.[0]?.error?.replaceAll('_', ' ');
    setMessage(failures ? `${success} completed, ${failures} failed.${first ? ` ${first}.` : ''}` : `${success} ${noun}${success === 1 ? '' : 's'} updated.`);
  }

  return (
    <>
      <div className="bulk-action-bar operational-bulk-bar">
        <label className="bulk-select-all">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} disabled={visibleIds.length === 0} />
          <span>{selectedIds.length ? `${selectedIds.length} selected` : `Select all ${visibleIds.length} shown`}</span>
        </label>
        <div className="bulk-action-controls">
          <Select value={actionValue} onChange={(event) => setActionValue(event.target.value)} disabled={!selectedIds.length} aria-label="Bulk action">
            <option value="">Bulk actions</option>
            {actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Button type="button" className={action?.danger ? 'danger' : ''} onClick={begin} disabled={!action || !selectedIds.length}>
            <CheckSquare size={16} /> Apply
          </Button>
          {selectedIds.length ? <button className="bulk-clear" type="button" onClick={onClear}><X size={15} /> Clear</button> : null}
        </div>
      </div>
      {message ? <p className="bulk-result success">{message}</p> : null}
      {error && !open ? <p className="bulk-result error">{error}</p> : null}
      {open && action ? (
        <Modal title={`Confirm ${action.label.toLowerCase()}`} onClose={() => !working && setOpen(false)}>
          <div className="bulk-confirmation">
            <div className={action.danger ? 'bulk-warning danger' : 'bulk-warning'}>
              {action.danger ? <Trash2 size={22} /> : <CheckSquare size={22} />}
              <div><strong>{action.label} {selectedIds.length} {noun}{selectedIds.length === 1 ? '' : 's'}</strong><p>{action.description}</p></div>
            </div>
            {action.requiresReason ? (
              <label className="field"><span className="field-label">Reason</span><Textarea value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /></label>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            <div className="form-actions">
              <Button type="button" className="secondary" onClick={() => setOpen(false)} disabled={working}>Cancel</Button>
              <Button type="button" className={action.danger ? 'danger' : ''} onClick={() => void run()} disabled={working}>
                {working ? <LoaderCircle className="spin-icon" size={16} /> : null}{working ? 'Applying…' : action.label}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function ExportSelectedButton({
  rows,
  filename,
}: {
  rows: Array<Record<string, unknown>>;
  filename: string;
}) {
  function download() {
    if (!rows.length) return;
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [keys.map(escape).join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <Button type="button" className="secondary" onClick={download} disabled={!rows.length}><Download size={16} /> Export {rows.length || ''}</Button>;
}
