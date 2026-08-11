import { getBranches, createBranch, deleteBranch } from '@/lib/github';

export async function GET() {
  try {
    const branches = await getBranches();
    return Response.json(branches);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }
    await deleteBranch(name);
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, sha } = await request.json();
    if (!name || !sha) {
      return Response.json({ error: 'name and sha are required' }, { status: 400 });
    }
    await createBranch(name, sha);
    return Response.json({ name }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Reference already exists')) {
      return Response.json({ error: 'Branch already exists.' }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
