'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import type { VercelDeployment, VercelLogEvent } from '@/lib/vercel';

const ACTIVE_STATES = new Set(['BUILDING', 'INITIALIZING', 'QUEUED']);

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [deployment, setDeployment] = useState<VercelDeployment | null>(null);
  const [logs, setLogs] = useState<VercelLogEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setId((p as { id: string }).id));
  }, [params]);

  const loadDeployment = useCallback(async (depId: string) => {
    try {
      const res = await fetch(`/api/deployments/${depId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setDeployment(data);
      setError(null);
      return data as VercelDeployment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const loadLogs = useCallback(async (depId: string) => {
    try {
      const res = await fetch(`/api/deployments/${depId}/logs`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {
      // logs are best-effort
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    let stopped = false;

    async function poll() {
      const dep = await loadDeployment(id!);
      if (!dep || stopped) return;
      await loadLogs(id!);
      if (ACTIVE_STATES.has(dep.state)) {
        setTimeout(poll, 4_000);
      }
    }
    poll();
    return () => { stopped = true; };
  }, [id, loadDeployment, loadLogs]);

  async function handleDelete() {
    if (!id || !confirm('Delete this deployment?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/deployments/${id}`, { method: 'DELETE' });
      router.push('/');
    } catch {
      setDeleting(false);
    }
  }

  const branch = deployment?.meta?.githubCommitRef ?? '—';
  const url = deployment?.url ? `https://${deployment.url}` : null;
  const isActive = deployment ? ACTIVE_STATES.has(deployment.state) : false;

  function logText(log: VercelLogEvent): string {
    return log.payload?.text ?? log.text ?? '';
  }

  function logColor(log: VercelLogEvent): string {
    const level = log.payload?.level;
    if (level === 'error') return 'text-red-400';
    if (level === 'warning') return 'text-amber-400';
    return 'text-gray-300';
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <a
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← All deployments
      </a>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!deployment && !error && (
        <div className="flex justify-center py-20 text-gray-400">
          <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {deployment && (
        <>
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StatusBadge state={deployment.state} />
                  {isActive && (
                    <span className="text-xs text-gray-500">Refreshing automatically…</span>
                  )}
                </div>
                <p className="font-mono text-xs text-gray-400">{deployment.uid}</p>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="font-medium">Branch:</span>
                  <span className="font-mono">{branch}</span>
                </div>
                {deployment.meta?.githubCommitMessage && (
                  <p className="text-sm text-gray-500">
                    {deployment.meta.githubCommitMessage}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  Created {timeAgo(deployment.created)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {url && deployment.state === 'READY' && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Open demo ↗
                  </a>
                )}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-700">Build logs</h2>
            <div className="h-96 overflow-y-auto rounded-xl bg-gray-900 p-4 font-mono text-xs leading-relaxed">
              {logs.length === 0 && (
                <p className="text-gray-500">
                  {isActive ? 'Waiting for logs…' : 'No logs available.'}
                </p>
              )}
              {logs.map((log, i) => {
                const text = logText(log);
                if (!text) return null;
                return (
                  <p key={log.id ?? i} className={logColor(log)}>
                    {text}
                  </p>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
