import { createBranch, deleteBranch } from '@/lib/github';
import { listDemoBranches, deleteDeploymentsForBranch, deleteBranchEnvVars, addDomainToBranch, removeBranchDomains } from '@/lib/vercel';
import { getToken, deleteApplicationByHostname } from '@/lib/optimizely';

function mask(value: string | undefined): string {
  if (!value) return '(not set)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET() {
  const diagnostics = {
    OPTI_VERCEL_TOKEN: mask(process.env.OPTI_VERCEL_TOKEN),
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || '(not set)',
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID || '(not set)',
    VERCEL_DEMO_SITE_PROJECT_NAME: process.env.VERCEL_DEMO_SITE_PROJECT_NAME || '(not set)',
    GITHUB_REPO_ID: process.env.GITHUB_REPO_ID || '(not set)',
  };

  try {
    const branches = await listDemoBranches();
    return Response.json({ branches, diagnostics });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message, diagnostics }, { status: 500 });
  }
}

const BRANCH_PREFIX = 'opti-presales-auto-';
const DEMO_BASE_DOMAIN = process.env.NEXT_PUBLIC_DEMO_BASE_DOMAIN ?? '';

export async function DELETE(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    // Delete the CMS application for this branch's hostname, if one exists.
    const clientId = process.env.OPTIMIZELY_CMS_CLIENT_ID;
    const clientSecret = process.env.OPTIMIZELY_CMS_CLIENT_SECRET;
    if (clientId && clientSecret && DEMO_BASE_DOMAIN && name.startsWith(BRANCH_PREFIX)) {
      const slug = name.slice(BRANCH_PREFIX.length);
      const hostname = `${slug}.${DEMO_BASE_DOMAIN}`;
      const token = await getToken({ clientId, clientSecret });
      await deleteApplicationByHostname(token, hostname).catch(() => {}); // non-fatal
    }

    await Promise.all([
      deleteDeploymentsForBranch(name),
      deleteBranchEnvVars(name),
      removeBranchDomains(name),
      deleteBranch(name).catch(() => {}), // branch may already be gone
    ]);
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, sha, domain } = await request.json();
    if (!name || !sha) {
      return Response.json({ error: 'name and sha are required' }, { status: 400 });
    }
    await createBranch(name, sha);
    if (domain) {
      await addDomainToBranch(domain, name);
    }
    return Response.json({ name }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Reference already exists')) {
      return Response.json({ error: 'Branch already exists.' }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
