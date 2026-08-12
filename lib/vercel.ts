const VERCEL_TOKEN = process.env.OPTI_VERCEL_TOKEN!;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;
const VERCEL_PROJECT_NAME = process.env.VERCEL_PROJECT_NAME!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const GITHUB_REPO_ID = process.env.GITHUB_REPO_ID!;

function authHeaders() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// Vercel validates gitBranch against GitHub synchronously; the branch may not
// be visible to Vercel immediately after creation. Retry on this specific error.
async function withBranchRetry<T>(fn: () => Promise<T>, maxAttempts = 6): Promise<T> {
  let delay = 1500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (attempt < maxAttempts && msg.includes('git_branch_not_found')) {
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 10000);
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

function teamParam(prefix = '?') {
  return VERCEL_TEAM_ID ? `${prefix}teamId=${VERCEL_TEAM_ID}` : '';
}

export type DeploymentState =
  | 'BUILDING'
  | 'ERROR'
  | 'INITIALIZING'
  | 'QUEUED'
  | 'READY'
  | 'CANCELED';

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: DeploymentState;
  created: number;
  meta?: {
    githubCommitRef?: string;
    githubCommitMessage?: string;
    githubCommitSha?: string;
  };
}

export interface VercelLogEvent {
  id: string;
  type: string;
  created: number;
  payload?: {
    text?: string;
    level?: string;
  };
  text?: string;
}

export async function listDeployments(): Promise<VercelDeployment[]> {
  const qs = `projectId=${VERCEL_PROJECT_ID}&limit=25${teamParam('&')}`;
  const res = await fetch(`https://api.vercel.com/v6/deployments?${qs}`, {
    headers: authHeaders(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  const data = await res.json();
  return data.deployments ?? [];
}

export interface DemoBranch {
  name: string;
  url: string | null;
  state: DeploymentState;
  cmsUrl: string | null;
}

export async function listDemoBranches(): Promise<DemoBranch[]> {
  const [deploymentsRes, envsRes] = await Promise.all([
    fetch(`https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=100${teamParam('&')}`, {
      headers: authHeaders(),
      next: { revalidate: 0 },
    }),
    fetch(`https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env${teamParam()}`, {
      headers: authHeaders(),
      next: { revalidate: 0 },
    }),
  ]);
  if (!deploymentsRes.ok) throw new Error(`Vercel API error: ${deploymentsRes.status}`);
  if (!envsRes.ok) throw new Error(`Vercel API error: ${envsRes.status}`);

  const deployments: VercelDeployment[] = (await deploymentsRes.json()).deployments ?? [];
  const envs: Array<{ key: string; value?: string; gitBranch?: string }> = (await envsRes.json()).envs ?? [];

  const cmsUrlByBranch = new Map<string, string>();
  for (const e of envs) {
    if (e.key === 'OPTIMIZELY_CMS_URL' && e.gitBranch && e.value) {
      cmsUrlByBranch.set(e.gitBranch, e.value);
    }
  }

  const seen = new Map<string, DemoBranch>();
  for (const d of deployments) {
    const branch = d.meta?.githubCommitRef;
    if (!branch?.startsWith('opti-presales-auto-') || seen.has(branch)) continue;
    seen.set(branch, {
      name: branch,
      url: d.url ?? null,
      state: d.state,
      cmsUrl: cmsUrlByBranch.get(branch) ?? null,
    });
  }
  return [...seen.values()];
}

export async function getDeployment(id: string): Promise<VercelDeployment> {
  const res = await fetch(
    `https://api.vercel.com/v13/deployments/${id}${teamParam()}`,
    { headers: authHeaders(), next: { revalidate: 0 } }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  return res.json();
}

export async function createDeployment(
  branch: string,
  envOverrides: Record<string, string>
): Promise<VercelDeployment> {
  const body: Record<string, unknown> = {
    name: VERCEL_PROJECT_NAME,
    gitSource: {
      type: 'github',
      repoId: parseInt(GITHUB_REPO_ID, 10),
      ref: branch,
    },
  };

  if (Object.keys(envOverrides).length > 0) {
    body.env = envOverrides;
  }

  return withBranchRetry(async () => {
    const res = await fetch(
      `https://api.vercel.com/v13/deployments${teamParam()}`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Vercel API error: ${res.status} — ${err}`);
    }
    const data = await res.json();
    // v13 create returns `id`; normalize to `uid` to match the rest of the app
    return { ...data, uid: data.uid ?? data.id };
  });
}

export async function deleteDeployment(id: string): Promise<void> {
  const res = await fetch(
    `https://api.vercel.com/v13/deployments/${id}${teamParam()}`,
    { method: 'DELETE', headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
}

export async function deleteDeploymentsForBranch(branch: string): Promise<void> {
  const qs = `projectId=${VERCEL_PROJECT_ID}&branch=${encodeURIComponent(branch)}&limit=100${teamParam('&')}`;
  const res = await fetch(`https://api.vercel.com/v6/deployments?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  const data = await res.json();
  const deployments: VercelDeployment[] = data.deployments ?? [];
  await Promise.all(deployments.map((d) => deleteDeployment(d.uid)));
}

export async function getDeploymentLogs(id: string): Promise<VercelLogEvent[]> {
  const res = await fetch(
    `https://api.vercel.com/v2/deployments/${id}/events${teamParam()}`,
    { headers: authHeaders(), next: { revalidate: 0 } }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  return res.json();
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  latestDeployments: Array<{
    uid: string;
    url: string | null;
    state: DeploymentState;
    created: number;
  }>;
}

export async function listProjects(): Promise<VercelProject[]> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}${teamParam()}`,
    { headers: authHeaders(), next: { revalidate: 0 } }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  const project = await res.json();
  return [project];
}

export async function getProjectEnvKeys(): Promise<string[]> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env${teamParam()}`,
    { headers: authHeaders(), next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  const data = await res.json();
  return (data.envs ?? []).map((e: { key: string }) => e.key);
}

export async function addDomainToBranch(domain: string, branch: string): Promise<void> {
  await withBranchRetry(async () => {
    const res = await fetch(
      `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains${teamParam()}`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: domain, gitBranch: branch }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Vercel API error: ${res.status} — ${err}`);
    }
  });
}

export async function removeBranchDomains(branch: string): Promise<void> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains${teamParam()}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  const data = await res.json();
  const domains: string[] = (data.domains ?? [])
    .filter((d: { gitBranch?: string }) => d.gitBranch === branch)
    .map((d: { name: string }) => d.name);
  await Promise.all(
    domains.map((name) =>
      fetch(
        `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${name}${teamParam()}`,
        { method: 'DELETE', headers: authHeaders() }
      )
    )
  );
}

export async function deleteBranchEnvVars(branch: string): Promise<void> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env${teamParam()}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
  const data = await res.json();
  const ids: string[] = (data.envs ?? [])
    .filter((e: { gitBranch?: string }) => e.gitBranch === branch)
    .map((e: { id: string }) => e.id);
  await Promise.all(
    ids.map((id) =>
      fetch(`https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${id}${teamParam()}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
    )
  );
}

export async function setBranchEnvVars(
  branch: string,
  envVars: Record<string, string>
): Promise<void> {
  const entries = Object.entries(envVars).filter(([k]) => k.trim());
  if (entries.length === 0) return;

  const body = entries.map(([key, value]) => ({
    key,
    value,
    type: key === 'OPTIMIZELY_CMS_URL' ? 'plain' : 'encrypted',
    target: ['preview'],
    gitBranch: branch,
  }));

  await withBranchRetry(async () => {
    const res = await fetch(
      `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env${teamParam()}`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Vercel API error: ${res.status} — ${err}`);
    }
  });
}
