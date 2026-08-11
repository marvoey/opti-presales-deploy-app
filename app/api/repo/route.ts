import { getRepo } from '@/lib/github';

export async function GET() {
  try {
    const repo = await getRepo();
    return Response.json(repo);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
