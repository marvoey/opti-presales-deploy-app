'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import type { VercelProject, DemoBranch } from '@/lib/vercel';
import type { GitHubRepo } from '@/lib/github';

export default function DashboardPage() {
  const [project, setProject] = useState<VercelProject | null>(null);
  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<DemoBranch[]>([]);
  const [branchDiagnostics, setBranchDiagnostics] = useState<Record<string, string> | null>(null);
  const [branchRaw, setBranchRaw] = useState<unknown>(null);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [projectRes, repoRes, branchesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/repo'),
        fetch('/api/branches'),
      ]);
      const [projectData, repoData, branchesData] = await Promise.all([
        projectRes.json(),
        repoRes.json(),
        branchesRes.json(),
      ]);
      if (!projectRes.ok) throw new Error(projectData.error ?? 'Failed to load project');
      if (!repoRes.ok) throw new Error(repoData.error ?? 'Failed to load repo');
      setBranchRaw(branchesData);
      if (branchesData.diagnostics) setBranchDiagnostics(branchesData.diagnostics);
      if (!branchesRes.ok) throw new Error(branchesData.error ?? 'Failed to load branches');
      setProject(projectData.projects[0] ?? null);
      setRepo(repoData);
      setBranches(branchesData.branches ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteBranch(name: string) {
    setDeletingBranch(name);
    try {
      const res = await fetch('/api/branches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete branch');
      }
      setBranches((prev) => prev.filter((b) => b.name !== name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingBranch(null);
    }
  }

  const latest = project?.latestDeployments?.[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Project</h1>
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

      {!loading && !error && (
        <div className="space-y-4">
          {project && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                Vercel
              </p>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{project.name}</p>
                  {project.framework && (
                    <p className="mt-0.5 text-sm text-gray-400">{project.framework}</p>
                  )}
                </div>
                {latest && <StatusBadge state={latest.state} />}
              </div>
              {latest && (
                <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>Latest deployment</span>
                    {latest.url && (
                      <a
                        href={`https://${latest.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {latest.url}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {repo && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                GitHub
              </p>
              <div className="flex items-start justify-between">
                <div>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-gray-900 hover:underline"
                  >
                    {repo.full_name}
                  </a>
                  {repo.description && (
                    <p className="mt-0.5 text-sm text-gray-500">{repo.description}</p>
                  )}
                </div>
                <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500">
                  {repo.visibility}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-400">Default branch</p>
                  <p className="mt-0.5 font-medium text-gray-700">{repo.default_branch}</p>
                </div>
                {repo.language && (
                  <div>
                    <p className="text-xs text-gray-400">Language</p>
                    <p className="mt-0.5 font-medium text-gray-700">{repo.language}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Open issues</p>
                  <p className="mt-0.5 font-medium text-gray-700">{repo.open_issues_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Last push</p>
                  <p className="mt-0.5 font-medium text-gray-700">
                    {new Date(repo.pushed_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          {branches.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                Branches ({branches.length})
              </p>
              <ul className="divide-y divide-gray-100">
                {branches.map((b) => (
                  <li key={b.name} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-mono text-gray-800">{b.name}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {process.env.NEXT_PUBLIC_DEMO_BASE_DOMAIN && (
                          <a
                            href={`https://${b.name.slice('opti-presales-auto-'.length)}.${process.env.NEXT_PUBLIC_DEMO_BASE_DOMAIN}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100"
                          >
                            Demo site ↗
                          </a>
                        )}
                        {b.cmsUrl && (
                          <a
                            href={`${b.cmsUrl}/ui/cms`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-100"
                          >
                            CMS ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge state={b.state} />
                      <button
                        onClick={() => handleDeleteBranch(b.name)}
                        disabled={!!deletingBranch}
                        title={`Delete ${b.name}`}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deletingBranch === b.name ? (
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {branchRaw !== null && (
            <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <summary className="cursor-pointer px-6 py-4 text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-gray-600">
                Branch fetch diagnostics
              </summary>
              <div className="border-t border-gray-100 px-6 py-4 space-y-4">
                {branchDiagnostics && (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {Object.entries(branchDiagnostics).map(([key, value]) => (
                        <tr key={key}>
                          <td className="py-2 pr-6 font-mono text-xs text-gray-400 whitespace-nowrap">{key}</td>
                          <td className={`py-2 font-mono text-xs ${value.startsWith('(not set)') ? 'text-red-500' : 'text-gray-700'}`}>
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Raw response</p>
                  <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap break-all">
                    {JSON.stringify(branchRaw, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
