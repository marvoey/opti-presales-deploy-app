import { listProjects } from '@/lib/vercel';

export async function GET() {
  try {
    const projects = await listProjects();
    return Response.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
