'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface GitHubTag {
  name: string;
  commit: { sha: string };
}

const ENV_KEYS = [
  'OPTIMIZELY_CMS_URL',
  'OPTIMIZELY_CMS_CLIENT_ID',
  'OPTIMIZELY_CMS_CLIENT_SECRET',
  'OPTIMIZELY_GRAPH_SINGLE_KEY',
] as const;

type EnvKey = typeof ENV_KEYS[number];

const BRANCH_PREFIX = 'opti-presales-auto-';
const DEMO_BASE_DOMAIN = process.env.NEXT_PUBLIC_DEMO_BASE_DOMAIN ?? '';

function validateBranchName(name: string): string | null {
  if (!name) return 'Branch name is required.';
  if (/[\x00-\x1F\x7F ~^:?*\[\\]/.test(name)) return 'Contains invalid characters.';
  if (name.startsWith('/') || name.endsWith('/')) return 'Cannot start or end with /.';
  if (name.endsWith('.')) return 'Cannot end with a dot.';
  if (name.includes('..')) return 'Cannot contain consecutive dots.';
  if (name.includes('//')) return 'Cannot contain consecutive slashes.';
  if (name.includes('@{')) return 'Cannot contain @{.';
  if (name.endsWith('.lock')) return 'Cannot end with .lock.';
  return null;
}

export default function DeployPage() {
  const router = useRouter();
  const [tags, setTags] = useState<GitHubTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  const [branchName, setBranchName] = useState('');
  const [branchError, setBranchError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [envValues, setEnvValues] = useState<Record<EnvKey, string>>({
    OPTIMIZELY_CMS_URL: 'https://app-epsamoey0012f6ygp001.cms.optimizely.com/',
    OPTIMIZELY_CMS_CLIENT_ID: '3128b1faa14a429894e494927042c442',
    OPTIMIZELY_CMS_CLIENT_SECRET: 'zKjacBgbSY54ZlGbc3cMBTeT1xqVQIEigZXURUtcWC3XVcsF',
    OPTIMIZELY_GRAPH_SINGLE_KEY: 'nDhEAZSjuNtxykWu4btEbHa2HcPPvyVN1QUjOB4mCBZefZTG',
  });
  const [showEnv, setShowEnv] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Array<{ label: string; done: boolean }>>([]);

  function startStep(label: string) {
    setSteps((prev) => [...prev, { label, done: false }]);
  }
  function completeStep() {
    setSteps((prev) => prev.map((s, i) => (i === prev.length - 1 ? { ...s, done: true } : s)));
  }

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((tagData) => {
        const filtered = Array.isArray(tagData)
          ? tagData.filter((t: GitHubTag) => t.name.startsWith('presales/verticals/'))
          : [];
        if (filtered.length > 0) {
          setTags(filtered);
          setSelectedTag(filtered[0].name);
        }
        setLoadingTags(false);
      })
      .catch(() => setLoadingTags(false));

  }, []);

  function handleBranchChange(value: string) {
    value = value.replace(/ /g, '-');
    setBranchName(value);
    setBranchError(value ? validateBranchName(value) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateBranchName(branchName);
    if (validationError) {
      setBranchError(validationError);
      return;
    }

    const tag = tags.find((t) => t.name === selectedTag);
    if (!tag) return;

    setSubmitting(true);
    setSubmitError(null);
    setSteps([]);

    try {
      const fullBranchName = `${BRANCH_PREFIX}${branchName}`;
      const fullDomain = DEMO_BASE_DOMAIN ? `${branchName}.${DEMO_BASE_DOMAIN}` : '';

      startStep('Creating GitHub branch');
      const branchRes = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullBranchName,
          sha: tag.commit.sha,
          domain: fullDomain || undefined,
        }),
      });
      const branchData = await branchRes.json();
      if (branchRes.status === 409) {
        throw new Error('Branch already exists — no deployment triggered.');
      }
      if (!branchRes.ok) throw new Error(branchData.error ?? 'Failed to create branch');
      completeStep();

      if (fullDomain) {
        startStep('Creating CMS application');
        const cmsRes = await fetch('/api/cms/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: envValues.OPTIMIZELY_CMS_CLIENT_ID,
            clientSecret: envValues.OPTIMIZELY_CMS_CLIENT_SECRET,
            displayName: fullBranchName,
            hostname: fullDomain,
          }),
        });
        if (!cmsRes.ok) {
          const cmsData = await cmsRes.json();
          throw new Error(cmsData.error ?? 'Failed to set up CMS application');
        }
        completeStep();
      }

      startStep('Setting environment variables');
      const envOverrides: Record<string, string> = Object.fromEntries(
        Object.entries(envValues).filter(([, v]) => v.trim())
      );
      if (fullDomain) envOverrides['NEXT_PUBLIC_SITE_DOMAIN'] = fullDomain;
      if (Object.keys(envOverrides).length > 0) {
        const envRes = await fetch('/api/env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: fullBranchName, envVars: envOverrides }),
        });
        if (!envRes.ok) {
          const envData = await envRes.json();
          throw new Error(envData.error ?? 'Failed to set environment variables');
        }
      }
      completeStep();

      router.push('/deployments');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  const allEnvFilled = ENV_KEYS.every((k) => envValues[k].trim());
  const isValid = !validateBranchName(branchName) && !!selectedTag && allEnvFilled;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8">
        <a href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </a>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">New demo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Name a new branch and choose the tag it will be created from.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Branch name
          </label>
          <div className={`flex rounded-md border shadow-sm focus-within:ring-1 ${
            branchError
              ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500'
              : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-500'
          }`}>
            <span className="flex items-center rounded-l-md border-r border-gray-200 bg-gray-50 px-3 text-sm text-gray-400 select-none">
              {BRANCH_PREFIX}
            </span>
            <input
              type="text"
              value={branchName}
              onChange={(e) => handleBranchChange(e.target.value)}
              placeholder="acme-corp"
              required
              autoFocus
              className="min-w-0 flex-1 rounded-r-md bg-white px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          {branchError && (
            <p className="mt-1.5 text-xs text-red-600">{branchError}</p>
          )}
          {!branchError && branchName && DEMO_BASE_DOMAIN && (
            <p className="mt-1.5 text-xs text-gray-500">
              Demo will be deployed to{' '}
              <span className="font-mono font-medium text-gray-700">
                {branchName}.{DEMO_BASE_DOMAIN}
              </span>
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Base tag
          </label>
          {loadingTags ? (
            <div className="h-10 animate-pulse rounded-md bg-gray-100" />
          ) : tags.length === 0 ? (
            <p className="text-sm text-gray-400">No tags found in repository.</p>
          ) : (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {tags.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowEnv((s) => !s)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showEnv ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Environment variables
          </button>
          {showEnv && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-xs text-gray-500">
                Required for every deployment. Set on the Vercel preview scoped to this branch.
              </p>
              <div className="space-y-2">
                {ENV_KEYS.map((key) => (
                  <div key={key} className="flex gap-2">
                    <span className="flex w-2/5 items-center rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-500 select-none">
                      {key}
                    </span>
                    <input
                      type="text"
                      placeholder="value"
                      value={envValues[key]}
                      onChange={(e) => setEnvValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      required
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !isValid}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Deploying…
            </span>
          ) : (
            'Create branch'
          )}
        </button>

        {steps.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                {step.done ? (
                  <svg className="h-4 w-4 flex-shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <span className={step.done ? 'text-gray-400' : 'font-medium text-gray-700'}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
