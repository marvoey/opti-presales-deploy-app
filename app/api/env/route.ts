import { getProjectEnvKeys, setBranchEnvVars } from '@/lib/vercel';

export async function GET() {
  try {
    const keys = await getProjectEnvKeys();
    return Response.json({ keys });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { branch, envVars } = await request.json();
    if (!branch || typeof envVars !== 'object') {
      return Response.json({ error: 'branch and envVars are required' }, { status: 400 });
    }
    await setBranchEnvVars(branch, envVars);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
