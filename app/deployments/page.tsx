'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import type { VercelDeployment } from '@/lib/vercel';

const DEMO_BASE_DOMAIN = process.env.NEXT_PUBLIC_DEMO_BASE_DOMAIN ?? '';
const BUILDING_STATES = new Set(['BUILDING', 'QUEUED', 'INITIALIZING']);

function siteDomain(branchRef: string | undefined): string | null {
  if (!DEMO_BASE_DOMAIN || !branchRef?.startsWith('opti-presales-auto-')) return null;
  return `${branchRef.slice('opti-presales-auto-'.length)}.${DEMO_BASE_DOMAIN}`;
}

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<VercelDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/deployments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load deployments');
      const filtered = (data.deployments as VercelDeployment[]).filter((d) =>
        d.meta?.githubCommitRef?.startsWith('opti-presales-auto-')
      );
      setDeployments(filtered);
      setError(null);
      return filtered;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    load().then((initial) => {
      if (!initial) return;
      if (!initial.some((d) => BUILDING_STATES.has(d.state))) return;

      interval = setInterval(async () => {
        const latest = await load();
        if (!latest || !latest.some((d) => BUILDING_STATES.has(d.state))) {
          if (interval) clearInterval(interval);
        }
      }, 1000);
    });

    return () => { if (interval) clearInterval(interval); };
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Deployments</h1>
        <Link
          href="/deploy"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          New demo
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-20 text-gray-400">
          <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && deployments.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">No deployments yet.</p>
          <Link href="/deploy" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Create your first demo →
          </Link>
        </div>
      )}

      {deployments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {deployments.map((d) => {
              const domain = siteDomain(d.meta?.githubCommitRef);
              return (
                <li key={d.uid} className="relative flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50">
                  <Link
                    href={`/deployments/${d.uid}`}
                    className="absolute inset-0"
                    aria-label={d.meta?.githubCommitRef ?? d.name}
                  />
                  <div className="relative min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge state={d.state} />
                      <span className="truncate font-mono text-xs text-gray-500">
                        {d.meta?.githubCommitRef ?? d.name}
                      </span>
                    </div>
                    {d.meta?.githubCommitMessage && (
                      <p className="mt-1 truncate text-sm text-gray-700">
                        {d.meta.githubCommitMessage}
                      </p>
                    )}
                  </div>
                  <div className="relative shrink-0 text-right">
                    <p className="text-xs text-gray-400">{timeAgo(d.created)}</p>
                    {domain && d.state === 'READY' && (
                      <a
                        href={`https://${domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100"
                      >
                        Demo site ↗
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
