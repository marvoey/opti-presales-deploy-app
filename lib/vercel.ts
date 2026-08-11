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
}

export async function deleteDeployment(id: string): Promise<void> {
  const res = await fetch(
    `https://api.vercel.com/v13/deployments/${id}${teamParam()}`,
    { method: 'DELETE', headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`Vercel API error: ${res.status}`);
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

export async function setBranchEnvVars(
  branch: string,
  envVars: Record<string, string>
): Promise<void> {
  const entries = Object.entries(envVars).filter(([k]) => k.trim());
  if (entries.length === 0) return;

  const body = entries.map(([key, value]) => ({
    key,
    value,
    type: 'encrypted',
    target: ['preview'],
    gitBranch: branch,
  }));

  const res = await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env${teamParam()}`,
    { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel API error: ${res.status} — ${err}`);
  }
}
