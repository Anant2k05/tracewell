import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusText } from '../components/Badges';
import { ButtonLink } from '../components/Button';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { EmptyState, ErrorNotice, Skeleton } from '../components/States';
import { useScans } from '../hooks/useScans';
import { cn } from '../utils/cn';
import { formatDateTimeUtc, shortId } from '../utils/format';

type StatusFilter = 'all' | 'completed' | 'active' | 'failed';
const PAGE_SIZE = 15;

/**
 * Full scan list from GET /scans. Risk scores aren't part of ScanOut (each
 * would need its own /results request), so they appear on the report page.
 */
export function HistoryPage() {
  const { scans, loading, error, reload } = useScans();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (scans ?? []).filter((s) => {
      const statusOk =
        filter === 'all' ||
        (filter === 'active' ? s.status === 'pending' || s.status === 'running' : s.status === filter);
      return statusOk && (!q || s.target_email.toLowerCase().includes(q));
    });
  }, [scans, filter, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const count = (f: StatusFilter) =>
    (scans ?? []).filter((s) => (f === 'all' ? true : f === 'active' ? s.status === 'pending' || s.status === 'running' : s.status === f)).length;

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Assessment history</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Every scan you've started, newest first.</p>
        </div>
        <ButtonLink to="/assess" variant="primary" icon="radar">
          New assessment
        </ButtonLink>
      </div>

      {error && <ErrorNotice title="Couldn't load your scans" message={error} onRetry={() => void reload()} />}

      <Panel className="overflow-hidden">
        <div className="p-space-md border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
          <div className="flex flex-wrap items-center p-0.5 rounded bg-panel-2 border border-line text-[12px] font-mono-sm self-start" role="group" aria-label="Filter by status">
            {(
              [
                ['all', 'All'],
                ['completed', 'Completed'],
                ['active', 'In progress'],
                ['failed', 'Failed'],
              ] as Array<[StatusFilter, string]>
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  setPage(0);
                }}
                className={cn('px-2.5 py-1 rounded', filter === f ? 'bg-surface-container-high text-on-surface font-medium' : 'text-on-surface-variant hover:text-on-surface')}
              >
                {label} ({count(f)})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-space-sm">
            <label className="relative flex-1 md:w-64">
              <span className="sr-only">Search by email</span>
              <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#6E7980]" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Filter by email"
                className="w-full h-9 pl-8 pr-3 rounded-control bg-panel border border-line-strong text-on-surface font-body-sm text-body-sm placeholder:text-[#6E7980] outline-none focus:border-lime focus:ring-1 focus:ring-lime"
              />
            </label>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              aria-label="Refresh"
              className="h-9 w-9 flex items-center justify-center rounded-control border border-line-strong bg-panel-2 hover:bg-panel-hover text-on-surface-variant hover:text-on-surface disabled:opacity-60"
            >
              <Icon name="sync" className={loading ? 'text-[16px] animate-spin' : 'text-[16px]'} />
            </button>
          </div>
        </div>

        {loading && !scans ? (
          <div className="p-space-md flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (scans?.length ?? 0) === 0 ? (
          <EmptyState icon="history_toggle_off" title="No assessments yet" action={<ButtonLink to="/assess" variant="primary" icon="radar">Start your first assessment</ButtonLink>}>
            Once you verify an email address and run a scan, it will be listed here.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <p className="p-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">No scans match the current filter.</p>
        ) : (
          <div className="relative overflow-x-auto">
            {/* relative: keeps the absolutely positioned sr-only header inside the scroll box on narrow screens */}
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-canvas border-b border-line">
                  {['Target', 'Status', 'Started', 'Completed', 'Scan ID'].map((h) => (
                    <th key={h} className="py-2.5 px-3 first:px-space-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="py-2.5 px-space-md">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/scans/${s.id}`)} className="hover:bg-panel-2 transition-colors group cursor-pointer">
                    <td className="py-3 px-space-md font-mono-md text-mono-md text-on-surface font-medium truncate max-w-[260px]">
                      <Link to={`/scans/${s.id}`} onClick={(e) => e.stopPropagation()} className="outline-none focus-visible:underline" title={s.target_email}>
                        {s.target_email}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <StatusText status={s.status} />
                      {s.status === 'failed' && s.error_message && (
                        <span className="block font-mono-sm text-[11px] text-on-surface-variant truncate max-w-[220px]" title={s.error_message}>
                          {s.error_message}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono-sm text-mono-sm text-on-surface-variant whitespace-nowrap">{formatDateTimeUtc(s.created_at)}</td>
                    <td className="py-3 px-3 font-mono-sm text-mono-sm text-secondary whitespace-nowrap">{formatDateTimeUtc(s.completed_at)}</td>
                    <td className="py-3 px-3 font-mono-sm text-mono-sm text-on-surface-variant" title={s.id}>
                      {shortId(s.id)}
                    </td>
                    <td className="py-3 px-space-md text-right">
                      <Icon name="chevron_right" className="text-on-surface-variant group-hover:text-on-surface transition-all text-[18px]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="px-space-md py-space-sm border-t border-line bg-canvas flex items-center justify-between">
            <span className="font-mono-sm text-mono-sm text-on-surface-variant">
              {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} of {filtered.length}
            </span>
            <div className="flex items-center gap-space-xs">
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="h-8 px-2 rounded-control border border-line-strong bg-panel-2 text-on-surface disabled:opacity-40 flex items-center" aria-label="Previous page">
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
              <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="h-8 px-2 rounded-control border border-line-strong bg-panel-2 text-on-surface disabled:opacity-40 flex items-center" aria-label="Next page">
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
