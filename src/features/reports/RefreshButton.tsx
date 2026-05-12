import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Unlock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api';
import { reportsApi } from './api';
import type { RefreshError, RefreshPhase, RefreshRun, RefreshStep } from '@/types';

const POLL_INTERVAL_MS = 1500;

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const ms = Date.now() - t;
  if (ms < 0) return 'just now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const PHASE_LABEL: Record<RefreshPhase, string> = {
  init: 'Starting up',
  apis: 'Affiliate APIs',
  backfill_offers: 'Offer reports backfill',
  backfill_campaigns: 'Campaign reports backfill',
  finalising: 'Finalising',
  done: 'Done',
};

// Orchestrated refresh button used on the Reports + Campaign Reports pages.
// Behaviour:
//   - On click, POST /api/refresh starts a run server-side.
//   - In parallel, the client polls /api/refresh/runs/{run_id} so the UI
//     reflects live step-by-step progress + errors as they happen.
//   - The same status read also tells us about an *existing* in-flight run
//     from another Cloud Run instance or another browser tab — if there is
//     one, we attach to its progress instead of starting a new one.
//   - When POST returns 409 (lock held), we attach to the active run.
export function RefreshButton({
  invalidateOnSuccess = [],
  size = 'sm',
  variant = 'primary',
}: {
  invalidateOnSuccess?: readonly (readonly unknown[])[];
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
}) {
  const qc = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [finalRun, setFinalRun] = useState<RefreshRun | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Status query — gives us last_refresh_at + any in-flight run_id. This is
  // how we discover a refresh started by another browser tab / instance.
  const statusQuery = useQuery({
    queryKey: ['refresh-status'],
    queryFn: () => reportsApi.refreshStatus(),
    staleTime: 10_000,
    refetchInterval: activeRunId ? false : 15_000,
  });

  // Auto-attach to a pre-existing in-flight run on mount or when status
  // reports one we didn't know about.
  useEffect(() => {
    if (activeRunId) return;
    if (statusQuery.data?.active_run_id) {
      setActiveRunId(statusQuery.data.active_run_id);
      setExpanded(true);
      setFinalRun(null);
      setDismissed(false);
    }
  }, [statusQuery.data?.active_run_id, activeRunId]);

  // Poll the active run while it's running.
  const runQuery = useQuery({
    queryKey: ['refresh-run', activeRunId],
    queryFn: () => reportsApi.refreshRun(activeRunId!),
    enabled: !!activeRunId,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return POLL_INTERVAL_MS;
      return data.status === 'pending' || data.status === 'running' ? POLL_INTERVAL_MS : false;
    },
  });

  // When the active run hits a terminal state, snapshot it for the summary
  // banner, clear activeRunId so polling stops, and invalidate downstream
  // queries so the new data shows.
  const lastTerminalRunIdRef = useRef<string | null>(null);
  useEffect(() => {
    const data = runQuery.data;
    if (!data) return;
    if (data.status === 'completed' || data.status === 'failed') {
      if (lastTerminalRunIdRef.current === data.run_id) return;
      lastTerminalRunIdRef.current = data.run_id;
      setFinalRun(data);
      setActiveRunId(null);
      qc.invalidateQueries({ queryKey: ['refresh-status'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['report-campaign-detail'] });
      qc.invalidateQueries({ queryKey: ['report-offer-detail'] });
      for (const key of invalidateOnSuccess) {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      }
    }
  }, [runQuery.data, qc, invalidateOnSuccess]);

  const start = useMutation({
    mutationFn: () => reportsApi.refreshAll(),
    onMutate: () => {
      setDismissed(false);
      setFinalRun(null);
    },
    onSuccess: (r) => {
      setActiveRunId(r.run_id);
      setExpanded(true);
    },
    onError: (err: unknown) => {
      // 409 means another instance is already running a refresh — attach to
      // its run instead of treating this as an error.
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { active_run_id?: string } | null;
        if (body?.active_run_id) {
          setActiveRunId(body.active_run_id);
          setExpanded(true);
          return;
        }
      }
      // Otherwise it's a real error — surface via finalRun-ish banner.
      setFinalRun(null);
      setActiveRunId(null);
    },
  });

  // Force-clear a stuck refresh lock. Used when the holder instance died
  // mid-run (e.g. local dev server killed) and the operator doesn't want to
  // wait for the 30-min lease to expire.
  const unlock = useMutation({
    mutationFn: () => reportsApi.refreshUnlock(),
    onSuccess: () => {
      setActiveRunId(null);
      setFinalRun(null);
      setDismissed(true);
      qc.invalidateQueries({ queryKey: ['refresh-status'] });
      lastTerminalRunIdRef.current = null;
    },
  });

  const running = !!activeRunId && (
    !runQuery.data ||
    runQuery.data.status === 'pending' ||
    runQuery.data.status === 'running'
  );
  const showBanner = !dismissed && (running || !!finalRun || start.isError);

  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="flex flex-col items-end gap-0.5">
        <Button
          size={size}
          variant={variant}
          onClick={() => start.mutate()}
          disabled={running || start.isPending}
        >
          {running || start.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {running ? 'Refreshing…' : start.isPending ? 'Starting…' : 'Refresh'}
        </Button>
        <span className="text-[10px] text-slate-400 dark:text-neutral-500">
          last: {fmtRelative(statusQuery.data?.last_refresh_at)}
        </span>
      </div>

      {showBanner && (
        <ProgressBanner
          run={runQuery.data ?? finalRun}
          starting={start.isPending && !runQuery.data}
          startError={start.error}
          running={running}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          onDismiss={() => {
            setDismissed(true);
            setFinalRun(null);
          }}
          onForceUnlock={() => unlock.mutate()}
          unlockPending={unlock.isPending}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Progress banner — collapsed shows the headline phase + step count + any
// error count. Expanded shows the full step history and error list.
function ProgressBanner({
  run,
  starting,
  startError,
  running,
  expanded,
  onToggle,
  onDismiss,
  onForceUnlock,
  unlockPending,
}: {
  run: RefreshRun | null | undefined;
  starting: boolean;
  startError: unknown;
  running: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  onForceUnlock: () => void;
  unlockPending: boolean;
}) {
  // Start-time error (network / 5xx, not 409).
  if (startError && !running && !run) {
    const message =
      startError instanceof Error ? startError.message : String(startError);
    return (
      <BannerShell tone="error" onDismiss={onDismiss}>
        <div className="flex-1">
          <div className="font-medium">Refresh failed to start</div>
          <div className="mt-0.5 text-xs opacity-90">{message}</div>
        </div>
      </BannerShell>
    );
  }

  if (starting && !run) {
    return (
      <BannerShell tone="info" onDismiss={onDismiss}>
        <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin" />
        <div className="flex-1">
          <div className="font-medium">Starting refresh…</div>
          <div className="mt-0.5 text-xs opacity-90">
            Acquiring lock and creating run.
          </div>
        </div>
      </BannerShell>
    );
  }

  if (!run) return null;

  const isDone = run.status === 'completed' || run.status === 'failed';
  const tone: BannerTone =
    run.status === 'failed' ? 'error' : run.status === 'completed' ? 'success' : 'info';
  const errCount = run.errors.length;

  return (
    <BannerShell tone={tone} onDismiss={onDismiss}>
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-medium">
            {isDone
              ? run.status === 'completed'
                ? 'Refresh complete'
                : 'Refresh finished with errors'
              : `Refreshing — ${PHASE_LABEL[run.phase]}`}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'less' : 'more'}
          </button>
        </div>
        <div className="mt-0.5 text-xs opacity-90">
          {run.current_step}
          {run.apis_total > 0 && (run.phase === 'apis' || (running && run.phase === 'init')) && (
            <span className="ml-2 opacity-80">
              ({run.apis_done}/{run.apis_total} APIs · {run.apis_succeeded}✓
              {run.apis_failed > 0 ? ` · ${run.apis_failed}✗` : ''}
              {run.apis_skipped > 0 ? ` · ${run.apis_skipped} paused` : ''})
            </span>
          )}
          {errCount > 0 && !expanded && (
            <span className="ml-2 font-medium">
              · {errCount} error{errCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {expanded && (
          <div className="mt-3 space-y-3">
            {/* Progress bar — proportional to phase + APIs walked. */}
            <PhaseStrip run={run} />

            {run.errors.length > 0 && (
              <ErrorList errors={run.errors} />
            )}
            {run.steps.length > 0 && (
              <StepList steps={run.steps} />
            )}

            {running && (
              <div className="flex items-center justify-between gap-2 border-t border-current/10 pt-2 text-[11px]">
                <span className="opacity-70">
                  Holder dead? Force-clear the lock to start a fresh refresh.
                </span>
                <button
                  type="button"
                  onClick={onForceUnlock}
                  disabled={unlockPending}
                  className="inline-flex items-center gap-1 rounded-md border border-current/20 px-2 py-1 font-medium opacity-90 hover:opacity-100 disabled:opacity-50"
                >
                  <Unlock className="h-3 w-3" />
                  {unlockPending ? 'Unlocking…' : 'Force unlock'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </BannerShell>
  );
}

function PhaseStrip({ run }: { run: RefreshRun }) {
  const phases: { key: RefreshPhase; label: string }[] = [
    { key: 'apis', label: 'APIs' },
    { key: 'backfill_offers', label: 'Offer backfill' },
    { key: 'backfill_campaigns', label: 'Campaign backfill' },
    { key: 'finalising', label: 'Finalise' },
  ];
  const order: Record<RefreshPhase, number> = {
    init: 0,
    apis: 1,
    backfill_offers: 2,
    backfill_campaigns: 3,
    finalising: 4,
    done: 5,
  };
  const current = order[run.phase];
  return (
    <div className="grid grid-cols-4 gap-1 text-[10px]">
      {phases.map((p) => {
        const idx = order[p.key];
        const state: 'done' | 'active' | 'pending' =
          run.status !== 'pending' && run.status !== 'running'
            ? 'done'
            : idx < current
            ? 'done'
            : idx === current
            ? 'active'
            : 'pending';
        return (
          <div
            key={p.key}
            className={cn(
              'rounded-md px-2 py-1 text-center font-medium',
              state === 'done' && 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
              state === 'active' && 'bg-blue-100/80 text-blue-800 dark:bg-brand-500/15 dark:text-brand-300',
              state === 'pending' && 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
            )}
          >
            {state === 'active' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
            {p.label}
          </div>
        );
      })}
    </div>
  );
}

function ErrorList({ errors }: { errors: RefreshError[] }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50/60 p-2 text-xs dark:border-red-500/30 dark:bg-red-500/10">
      <div className="mb-1 font-medium text-red-700 dark:text-red-300">
        {errors.length} error{errors.length === 1 ? '' : 's'}
      </div>
      <ul className="space-y-0.5">
        {errors.map((e, i) => (
          <li key={i} className="text-red-800 dark:text-red-200">
            <span className="opacity-70">[{e.phase}]</span> {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepList({ steps }: { steps: RefreshStep[] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white/40 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="mb-1 font-medium text-slate-700 dark:text-neutral-300">Step history</div>
      <ul className="space-y-0.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <StepIcon step={s} />
            <span className="flex-1 truncate text-slate-700 dark:text-neutral-300">
              <StepLabel step={s} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepIcon({ step }: { step: RefreshStep }) {
  if (step.kind === 'init') return <Check className="mt-0.5 h-3 w-3 text-emerald-600" />;
  if (step.kind === 'api') {
    return step.ok ? (
      <Check className="mt-0.5 h-3 w-3 text-emerald-600" />
    ) : step.reason === 'paused' ? (
      <AlertTriangle className="mt-0.5 h-3 w-3 text-slate-500" />
    ) : (
      <AlertCircle className="mt-0.5 h-3 w-3 text-red-600" />
    );
  }
  return step.ok ? (
    <Check className="mt-0.5 h-3 w-3 text-emerald-600" />
  ) : (
    <AlertCircle className="mt-0.5 h-3 w-3 text-red-600" />
  );
}

function StepLabel({ step }: { step: RefreshStep }) {
  if (step.kind === 'init') return <>{step.label}</>;
  if (step.kind === 'api') {
    if (step.reason === 'paused') {
      return (
        <>
          <strong>{step.name}</strong> — skipped (paused)
        </>
      );
    }
    if (step.ok) {
      return (
        <>
          <strong>{step.name}</strong> — succeeded ({(step.duration_ms / 1000).toFixed(1)}s)
        </>
      );
    }
    return (
      <>
        <strong>{step.name}</strong> — failed: {step.reason ?? 'unknown'} ({(step.duration_ms / 1000).toFixed(1)}s)
      </>
    );
  }
  const label = step.kind === 'backfill_offers' ? 'Offer reports backfill' : 'Campaign reports backfill';
  if (!step.ok) {
    return (
      <>
        <strong>{label}</strong> — failed: {step.error ?? 'unknown'}
      </>
    );
  }
  const scanned = step.conversions_scanned?.toLocaleString() ?? '0';
  const written = step.buckets_written?.toLocaleString() ?? '0';
  const dur = step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : '';
  return (
    <>
      <strong>{label}</strong> — {scanned} conversions scanned · {written} buckets written{dur ? ` · ${dur}` : ''}
      {step.truncated && (
        <span className="ml-1 text-amber-600 dark:text-amber-400">
          (truncated: {step.truncated_reason ?? 'cap reached'})
        </span>
      )}
    </>
  );
}

type BannerTone = 'info' | 'success' | 'warn' | 'error';

function BannerShell({
  tone, children, onDismiss,
}: {
  tone: BannerTone;
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'info' &&
          'border-blue-200 bg-blue-50 text-blue-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100',
        tone === 'success' &&
          'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
        tone === 'warn' &&
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
        tone === 'error' &&
          'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
      )}
      role="status"
    >
      {children}
      <button
        onClick={onDismiss}
        className="opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
