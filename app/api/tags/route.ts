import { getTags } from '@/lib/github';

export async function GET() {
  try {
    const tags = await getTags();
    return Response.json(tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
