'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import StatusBadge from './StatusBadge';
import type { VercelDeployment } from '@/lib/vercel';

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  deployment: VercelDeployment;
  onDeleted: () => void;
}

export default function DeploymentCard({ deployment, onDeleted }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const branch = deployment.meta?.githubCommitRef ?? '—';
  const url = deployment.url ? `https://${deployment.url}` : null;

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete deployment ${deployment.uid}?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/deployments/${deployment.uid}`, { method: 'DELETE' });
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
      onClick={() => router.push(`/deployments/${deployment.uid}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge state={deployment.state} />
            <span className="truncate font-mono text-xs text-gray-500">
              {deployment.uid}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-700">
            <svg
              className="h-4 w-4 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
            <span className="font-medium">{branch}</span>
          </p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 block truncate text-sm text-blue-600 hover:underline"
            >
              {deployment.url}
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-gray-400">{timeAgo(deployment.created)}</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded p-1 text-gray-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
            aria-label="Delete deployment"
          >
            {deleting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
