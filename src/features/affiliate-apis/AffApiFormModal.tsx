import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ApiError } from '@/lib/api';
import { networksApi } from '@/features/postbacks/api';
import { affiliateApisApi, type AffiliateApiUpsert } from './api';
import type {
  AffiliateApi,
  AffiliateApiAuthType,
  AffiliateApiKind,
  AffiliateApiPaginationType,
  AffiliateApiResponseFormat,
} from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: AffiliateApi | null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;

interface KvRow { id: string; k: string; v: string; }

interface FormState {
  api_id: string;
  name: string;
  status: 'active' | 'paused';
  kind: AffiliateApiKind;
  response_format: AffiliateApiResponseFormat;
  base_url: string;
  network_id: string;
  // Auth
  auth_type: AffiliateApiAuthType;
  auth_in: 'header' | 'query';
  auth_key_name: string;
  auth_username: string;
  auth_value: string;            // plaintext, write-only
  auth_clear: boolean;
  // Request
  http_method: 'GET' | 'POST';
  body_template: string;
  graphql_query: string;
  query_params: KvRow[];
  headers: KvRow[];
  // Pagination
  pg_type: AffiliateApiPaginationType;
  pg_page_param: string;
  pg_offset_param: string;
  pg_cursor_param: string;
  pg_next_cursor_path: string;
  pg_size_param: string;
  pg_page_size: string;
  pg_max_pages: string;
  // Incremental
  inc_enabled: boolean;
  inc_from: string;
  inc_to: string;
  inc_format: 'iso' | 'unix_ms' | 'unix_s' | 'date';
  inc_lookback: string;
  // Mapping
  m_items: string;
  m_external_id: string;
  m_click_id: string;
  m_payout: string;
  m_currency: string;
  m_status: string;
  m_txn_id: string;
  m_event_time: string;
  m_default_status: string;
  // Schedule
  enabled: boolean;
  runs_per_day: number;
  // Limits
  timeout_ms: string;
  max_records_per_run: string;
}

const DEFAULTS: FormState = {
  api_id: '', name: '', status: 'active', kind: 'rest', response_format: 'json',
  base_url: '', network_id: '',
  auth_type: 'none', auth_in: 'header', auth_key_name: 'X-API-Key', auth_username: '',
  auth_value: '', auth_clear: false,
  http_method: 'GET', body_template: '', graphql_query: '',
  query_params: [], headers: [],
  pg_type: 'page', pg_page_param: 'page', pg_offset_param: 'offset',
  pg_cursor_param: 'cursor', pg_next_cursor_path: '', pg_size_param: 'limit',
  pg_page_size: '100', pg_max_pages: '50',
  inc_enabled: false, inc_from: 'from', inc_to: 'to', inc_format: 'iso', inc_lookback: '30',
  m_items: 'data', m_external_id: 'id', m_click_id: 'click_id',
  m_payout: 'payout', m_currency: 'currency', m_status: 'status',
  m_txn_id: 'transaction_id', m_event_time: 'event_time', m_default_status: 'approved',
  enabled: true, runs_per_day: 4,
  timeout_ms: '30000', max_records_per_run: '50000',
};

const RUNS_PER_DAY_OPTIONS = [1, 2, 4, 6, 8, 12, 24, 48, 96];

function rowsFromMap(m?: Record<string, string>): KvRow[] {
  if (!m) return [];
  return Object.entries(m).map(([k, v], i) => ({ id: `init-${i}`, k, v }));
}

function mapFromRows(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.k.trim();
    if (!k) continue;
    out[k] = r.v;
  }
  return out;
}

function genRowId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fromInitial(api: AffiliateApi): FormState {
  return {
    ...DEFAULTS,
    api_id: api.api_id,
    name: api.name,
    status: api.status,
    kind: api.kind,
    response_format: api.response_format ?? 'json',
    base_url: api.base_url,
    network_id: api.network_id ?? '',
    auth_type: api.auth.type,
    auth_in: api.auth.in ?? 'header',
    auth_key_name: api.auth.key_name ?? 'X-API-Key',
    auth_username: api.auth.username ?? '',
    auth_value: '',
    auth_clear: false,
    http_method: api.request.http_method ?? 'GET',
    body_template: api.request.body_template ?? '',
    graphql_query: api.request.graphql_query ?? '',
    query_params: rowsFromMap(api.request.query_params),
    headers: rowsFromMap(api.request.headers),
    pg_type: api.pagination.type,
    pg_page_param: api.pagination.page_param ?? 'page',
    pg_offset_param: api.pagination.offset_param ?? 'offset',
    pg_cursor_param: api.pagination.cursor_param ?? 'cursor',
    pg_next_cursor_path: api.pagination.next_cursor_path ?? '',
    pg_size_param: api.pagination.size_param ?? 'limit',
    pg_page_size: api.pagination.page_size != null ? String(api.pagination.page_size) : '100',
    pg_max_pages: api.pagination.max_pages != null ? String(api.pagination.max_pages) : '50',
    inc_enabled: api.incremental.enabled,
    inc_from: api.incremental.from_param ?? 'from',
    inc_to: api.incremental.to_param ?? 'to',
    inc_format: api.incremental.format ?? 'iso',
    inc_lookback: String(api.incremental.lookback_minutes ?? 30),
    m_items: api.mapping.items_path,
    m_external_id: api.mapping.external_id_path,
    m_click_id: api.mapping.click_id_path,
    m_payout: api.mapping.payout_path ?? '',
    m_currency: api.mapping.currency_path ?? '',
    m_status: api.mapping.status_path ?? '',
    m_txn_id: api.mapping.txn_id_path ?? '',
    m_event_time: api.mapping.event_time_path ?? '',
    m_default_status: api.mapping.default_status ?? 'approved',
    enabled: api.schedule.enabled,
    runs_per_day: api.schedule.runs_per_day,
    timeout_ms: String(api.timeout_ms ?? 30_000),
    max_records_per_run: String(api.max_records_per_run ?? 50_000),
  };
}

export function AffApiFormModal({ open, onClose, initial }: Props) {
  const editing = !!initial;
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);

  const networksQuery = useQuery({
    queryKey: ['networks-for-aff-api'],
    queryFn: () => networksApi.list({ limit: 100 }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(initial ? fromInitial(initial) : DEFAULTS);
  }, [open, initial]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildPayload(): AffiliateApiUpsert {
    const payload: AffiliateApiUpsert = {
      name: form.name.trim(),
      status: form.status,
      kind: form.kind,
      response_format: form.kind === 'graphql' ? 'json' : form.response_format,
      base_url: form.base_url.trim(),
      network_id: form.network_id.trim() || undefined,
      auth: {
        type: form.auth_type,
        in: form.auth_type === 'api_key' ? form.auth_in : undefined,
        key_name: form.auth_type === 'api_key' ? (form.auth_key_name.trim() || 'X-API-Key') : undefined,
        username: form.auth_type === 'basic' ? form.auth_username.trim() : undefined,
        value: form.auth_value ? form.auth_value : undefined,
        clear_secret: form.auth_clear || undefined,
      },
      request: form.kind === 'graphql'
        ? {
            graphql_query: form.graphql_query.trim() || undefined,
            headers: mapFromRows(form.headers),
          }
        : {
            http_method: form.http_method,
            query_params: mapFromRows(form.query_params),
            body_template: form.body_template.trim() || undefined,
            headers: mapFromRows(form.headers),
          },
      pagination: {
        type: form.pg_type,
        page_param: form.pg_type === 'page' ? form.pg_page_param.trim() || undefined : undefined,
        offset_param: form.pg_type === 'offset' ? form.pg_offset_param.trim() || undefined : undefined,
        cursor_param: form.pg_type === 'cursor' ? form.pg_cursor_param.trim() || undefined : undefined,
        next_cursor_path: form.pg_type === 'cursor' ? form.pg_next_cursor_path.trim() || undefined : undefined,
        size_param: form.pg_size_param.trim() || undefined,
        page_size: form.pg_page_size ? Number(form.pg_page_size) : undefined,
        max_pages: form.pg_max_pages ? Number(form.pg_max_pages) : undefined,
      },
      incremental: {
        enabled: form.inc_enabled,
        from_param: form.inc_enabled ? form.inc_from.trim() || undefined : undefined,
        to_param: form.inc_enabled ? form.inc_to.trim() || undefined : undefined,
        format: form.inc_format,
        lookback_minutes: form.inc_lookback ? Number(form.inc_lookback) : undefined,
      },
      mapping: {
        items_path: form.m_items.trim(),
        external_id_path: form.m_external_id.trim(),
        click_id_path: form.m_click_id.trim(),
        payout_path: form.m_payout.trim() || undefined,
        currency_path: form.m_currency.trim() || undefined,
        status_path: form.m_status.trim() || undefined,
        txn_id_path: form.m_txn_id.trim() || undefined,
        event_time_path: form.m_event_time.trim() || undefined,
        default_status: form.m_default_status.trim() || undefined,
      },
      schedule: { enabled: form.enabled, runs_per_day: form.runs_per_day },
      timeout_ms: form.timeout_ms ? Number(form.timeout_ms) : undefined,
      max_records_per_run: form.max_records_per_run ? Number(form.max_records_per_run) : undefined,
    };
    return payload;
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!editing && !SLUG_RE.test(form.api_id.trim())) {
        throw new Error('API id must be lowercase letters/digits/_- (2-64 chars)');
      }
      if (!form.name.trim()) throw new Error('Name is required');
      if (!form.base_url.trim()) throw new Error('Base URL is required');
      if (!form.m_items.trim() || !form.m_external_id.trim() || !form.m_click_id.trim()) {
        throw new Error('Mapping needs items, external_id and click_id paths');
      }
      const payload = buildPayload();
      if (editing) return affiliateApisApi.update(initial!.api_id, payload);
      return affiliateApisApi.create({ api_id: form.api_id.trim(), ...payload });
    },
    onSuccess: (api) => {
      qc.invalidateQueries({ queryKey: ['affiliate-apis'] });
      qc.invalidateQueries({ queryKey: ['affiliate-api', api.api_id] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.code ?? err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Could not save');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit · ${initial?.name}` : 'Add API integration'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Identity */}
        <Section title="Basics">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="API ID (slug)">
              <Input
                value={form.api_id}
                onChange={(e) => patch('api_id', e.target.value)}
                placeholder="kelkoo_api"
                disabled={editing}
                required
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => patch('status', e.target.value as 'active' | 'paused')}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </Field>
            <Field label="Display name">
              <Input value={form.name} onChange={(e) => patch('name', e.target.value)} placeholder="Kelkoo API" required />
            </Field>
            <Field label="Kind">
              <Select value={form.kind} onChange={(e) => patch('kind', e.target.value as AffiliateApiKind)}>
                <option value="rest">REST</option>
                <option value="graphql">GraphQL</option>
              </Select>
            </Field>
            {form.kind === 'rest' && (
              <Field label="Response format">
                <Select
                  value={form.response_format}
                  onChange={(e) => patch('response_format', e.target.value as AffiliateApiResponseFormat)}
                >
                  <option value="json">JSON</option>
                  <option value="xml">XML</option>
                  <option value="auto">Auto (sniff Content-Type)</option>
                </Select>
                <p className="hint">XML responses are normalised to JSON before mapping; dot/bracket paths work the same way for both.</p>
              </Field>
            )}
            <Field label="Base URL" className="sm:col-span-2">
              <Input
                value={form.base_url}
                onChange={(e) => patch('base_url', e.target.value)}
                placeholder="https://api.kelkoo.com/v1/conversions"
                required
              />
            </Field>
            <Field label="Mapped postback (optional)" className="sm:col-span-2">
              <Select value={form.network_id} onChange={(e) => patch('network_id', e.target.value)}>
                <option value="">— None —</option>
                {networksQuery.data?.items.map((n) => (
                  <option key={n.network_id} value={n.network_id}>{n.name} ({n.network_id})</option>
                ))}
              </Select>
              <p className="hint">If chosen, set this API id on the network's <em>postback_api_id</em> so postbacks for that network become audit-only.</p>
            </Field>
          </div>
        </Section>

        {/* Auth */}
        <Section title="Authentication">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select value={form.auth_type} onChange={(e) => patch('auth_type', e.target.value as AffiliateApiAuthType)}>
                <option value="none">None</option>
                <option value="api_key">API Key</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic auth</option>
                <option value="custom">Custom headers only</option>
              </Select>
            </Field>
            {form.auth_type === 'api_key' && (
              <>
                <Field label="Send via">
                  <Select value={form.auth_in} onChange={(e) => patch('auth_in', e.target.value as 'header' | 'query')}>
                    <option value="header">Header</option>
                    <option value="query">Query</option>
                  </Select>
                </Field>
                <Field label="Key name">
                  <Input value={form.auth_key_name} onChange={(e) => patch('auth_key_name', e.target.value)} placeholder="X-API-Key" />
                </Field>
              </>
            )}
            {form.auth_type === 'basic' && (
              <Field label="Username">
                <Input value={form.auth_username} onChange={(e) => patch('auth_username', e.target.value)} />
              </Field>
            )}
            {(form.auth_type === 'api_key' || form.auth_type === 'bearer' || form.auth_type === 'basic') && (
              <Field label={editing && initial?.auth.has_secret ? 'Secret (leave blank to keep)' : 'Secret'} className="sm:col-span-2">
                <Input
                  type="password"
                  value={form.auth_value}
                  onChange={(e) => patch('auth_value', e.target.value)}
                  placeholder={editing && initial?.auth.has_secret ? '••••••••' : ''}
                  autoComplete="new-password"
                />
                {editing && initial?.auth.has_secret && (
                  <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                    <input type="checkbox" checked={form.auth_clear} onChange={(e) => patch('auth_clear', e.target.checked)} />
                    Clear stored secret
                  </label>
                )}
              </Field>
            )}
          </div>
        </Section>

        {/* Request */}
        <Section title="Request">
          {form.kind === 'graphql' ? (
            <>
              <Field label="GraphQL query">
                <textarea
                  value={form.graphql_query}
                  onChange={(e) => patch('graphql_query', e.target.value)}
                  placeholder="query Conversions($from: String, $to: String, $cursor: String) { conversions(from: $from, to: $to, after: $cursor) { edges { node { id click_id payout currency status } } pageInfo { endCursor hasNextPage } } }"
                  rows={6}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <p className="hint">Variables <code>$from</code>, <code>$to</code>, <code>$page</code>, <code>$offset</code>, <code>$cursor</code> are auto-injected.</p>
              </Field>
              <KvEditor
                label="Headers"
                rows={form.headers}
                onChange={(rows) => patch('headers', rows)}
                placeholderK="X-Custom-Header"
                placeholderV="value"
              />
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="HTTP method">
                  <Select value={form.http_method} onChange={(e) => patch('http_method', e.target.value as 'GET' | 'POST')}>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </Select>
                </Field>
              </div>
              {form.http_method === 'POST' && (
                <Field label="JSON body template">
                  <textarea
                    value={form.body_template}
                    onChange={(e) => patch('body_template', e.target.value)}
                    placeholder='{"from":"{{from}}","to":"{{to}}","page":{{page}}}'
                    rows={4}
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                  <p className="hint">Supports placeholders: <code>{'{{from}}'}</code>, <code>{'{{to}}'}</code>, <code>{'{{page}}'}</code>, <code>{'{{offset}}'}</code>, <code>{'{{cursor}}'}</code>.</p>
                </Field>
              )}
              <KvEditor
                label="Query params"
                rows={form.query_params}
                onChange={(rows) => patch('query_params', rows)}
                placeholderK="status"
                placeholderV="approved"
              />
              <KvEditor
                label="Headers"
                rows={form.headers}
                onChange={(rows) => patch('headers', rows)}
                placeholderK="X-Custom-Header"
                placeholderV="value"
              />
            </>
          )}
        </Section>

        {/* Pagination */}
        <Section title="Pagination">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select value={form.pg_type} onChange={(e) => patch('pg_type', e.target.value as AffiliateApiPaginationType)}>
                <option value="none">None (single page)</option>
                <option value="page">Page number</option>
                <option value="offset">Offset</option>
                <option value="cursor">Cursor</option>
              </Select>
            </Field>
            <Field label="Page size">
              <Input value={form.pg_page_size} onChange={(e) => patch('pg_page_size', e.target.value)} placeholder="100" />
            </Field>
            <Field label="Page size param">
              <Input value={form.pg_size_param} onChange={(e) => patch('pg_size_param', e.target.value)} placeholder="limit" />
            </Field>
            <Field label="Max pages (safety cap)">
              <Input value={form.pg_max_pages} onChange={(e) => patch('pg_max_pages', e.target.value)} placeholder="50" />
            </Field>
            {form.pg_type === 'page' && (
              <Field label="Page param">
                <Input value={form.pg_page_param} onChange={(e) => patch('pg_page_param', e.target.value)} placeholder="page" />
              </Field>
            )}
            {form.pg_type === 'offset' && (
              <Field label="Offset param">
                <Input value={form.pg_offset_param} onChange={(e) => patch('pg_offset_param', e.target.value)} placeholder="offset" />
              </Field>
            )}
            {form.pg_type === 'cursor' && (
              <>
                <Field label="Cursor param">
                  <Input value={form.pg_cursor_param} onChange={(e) => patch('pg_cursor_param', e.target.value)} placeholder="cursor" />
                </Field>
                <Field label="Next-cursor response path">
                  <Input value={form.pg_next_cursor_path} onChange={(e) => patch('pg_next_cursor_path', e.target.value)} placeholder="data.pageInfo.endCursor" />
                </Field>
              </>
            )}
          </div>
        </Section>

        {/* Incremental */}
        <Section title="Incremental window">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
            <input type="checkbox" checked={form.inc_enabled} onChange={(e) => patch('inc_enabled', e.target.checked)} />
            Send a from/to time window each run
          </label>
          {form.inc_enabled && (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="From param"><Input value={form.inc_from} onChange={(e) => patch('inc_from', e.target.value)} /></Field>
              <Field label="To param"><Input value={form.inc_to} onChange={(e) => patch('inc_to', e.target.value)} /></Field>
              <Field label="Time format">
                <Select value={form.inc_format} onChange={(e) => patch('inc_format', e.target.value as FormState['inc_format'])}>
                  <option value="iso">ISO 8601</option>
                  <option value="unix_ms">Unix ms</option>
                  <option value="unix_s">Unix seconds</option>
                  <option value="date">Date only (YYYY-MM-DD)</option>
                </Select>
              </Field>
              <Field label="Lookback (minutes)">
                <Input value={form.inc_lookback} onChange={(e) => patch('inc_lookback', e.target.value)} placeholder="30" />
              </Field>
            </div>
          )}
        </Section>

        {/* Mapping */}
        <Section title="Response → Conversion mapping">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Items path *"><Input value={form.m_items} onChange={(e) => patch('m_items', e.target.value)} placeholder="data.conversions" /></Field>
            <Field label="External ID path *"><Input value={form.m_external_id} onChange={(e) => patch('m_external_id', e.target.value)} placeholder="id" /></Field>
            <Field label="Click ID path *"><Input value={form.m_click_id} onChange={(e) => patch('m_click_id', e.target.value)} placeholder="click_id" /></Field>
            <Field label="Payout path"><Input value={form.m_payout} onChange={(e) => patch('m_payout', e.target.value)} placeholder="payout" /></Field>
            <Field label="Currency path"><Input value={form.m_currency} onChange={(e) => patch('m_currency', e.target.value)} placeholder="currency" /></Field>
            <Field label="Status path"><Input value={form.m_status} onChange={(e) => patch('m_status', e.target.value)} placeholder="state" /></Field>
            <Field label="Transaction ID path"><Input value={form.m_txn_id} onChange={(e) => patch('m_txn_id', e.target.value)} placeholder="transaction_id" /></Field>
            <Field label="Event time path"><Input value={form.m_event_time} onChange={(e) => patch('m_event_time', e.target.value)} placeholder="event_time" /></Field>
            <Field label="Default status"><Input value={form.m_default_status} onChange={(e) => patch('m_default_status', e.target.value)} placeholder="approved" /></Field>
          </div>
          <p className="hint mt-1">
            Paths are dot/bracket — e.g. <code>data.items</code>, <code>edges[0].node.id</code>. For GraphQL connections use{' '}
            <code>data.<i>field</i>.edges</code> as items_path and <code>node.<i>field</i></code> for sub-paths.
          </p>
        </Section>

        {/* Schedule */}
        <Section title="Schedule">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Enabled">
              <Select value={form.enabled ? 'on' : 'off'} onChange={(e) => patch('enabled', e.target.value === 'on')}>
                <option value="on">On</option>
                <option value="off">Off</option>
              </Select>
            </Field>
            <Field label="Runs per day">
              <Select value={String(form.runs_per_day)} onChange={(e) => patch('runs_per_day', Number(e.target.value))}>
                {RUNS_PER_DAY_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}× / day (~ every {Math.round((24 * 60) / n)} min)</option>
                ))}
              </Select>
            </Field>
            <Field label="HTTP timeout (ms)">
              <Input value={form.timeout_ms} onChange={(e) => patch('timeout_ms', e.target.value)} placeholder="30000" />
            </Field>
            <Field label="Max records / run">
              <Input value={form.max_records_per_run} onChange={(e) => patch('max_records_per_run', e.target.value)} placeholder="50000" />
            </Field>
          </div>
        </Section>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:ring-neutral-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

interface KvEditorProps {
  label: string;
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  placeholderK?: string;
  placeholderV?: string;
}

function KvEditor({ label, rows, onChange, placeholderK, placeholderV }: KvEditorProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...rows, { id: genRowId(), k: '', v: '' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {rows.length > 0 && (
        <div className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input value={r.k} placeholder={placeholderK} onChange={(e) => onChange(rows.map((x) => x.id === r.id ? { ...x, k: e.target.value } : x))} />
              <Input value={r.v} placeholder={placeholderV} onChange={(e) => onChange(rows.map((x) => x.id === r.id ? { ...x, v: e.target.value } : x))} />
              <button
                type="button"
                onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-neutral-800"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
