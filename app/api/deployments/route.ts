import { createDeployment, listDeployments } from '@/lib/vercel';

export async function GET() {
  try {
    const deployments = await listDeployments();
    return Response.json({ deployments });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { branch, envOverrides = {} } = await request.json();
    if (!branch) {
      return Response.json({ error: 'branch is required' }, { status: 400 });
    }
    const deployment = await createDeployment(branch, envOverrides);
    return Response.json(deployment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
