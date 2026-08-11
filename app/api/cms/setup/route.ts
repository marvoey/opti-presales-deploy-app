import { NextResponse } from 'next/server';
import {
  getToken,
  findApplicationByHostname,
  createPage,
  publishPage,
  createApplication,
} from '@/lib/optimizely';

const ENTRY_POINT_CONTENT_TYPE = 'BlankExperience';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, displayName, hostname } = body as {
      clientId?: string;
      clientSecret?: string;
      displayName?: string;
      hostname?: string;
    };

    if (!clientId || !clientSecret || !displayName || !hostname) {
      return NextResponse.json(
        { error: 'clientId, clientSecret, displayName, and hostname are required' },
        { status: 400 },
      );
    }

    // Single token derived from the provided credentials — used for every CMS call.
    const token = await getToken({ clientId, clientSecret });

    const existing = await findApplicationByHostname(token, hostname);
    if (existing) {
      return NextResponse.json(
        { error: `An application with hostname "${hostname}" already exists` },
        { status: 409 },
      );
    }

    const { key, version } = await createPage(token, {
      contentType: ENTRY_POINT_CONTENT_TYPE,
      displayName,
    });

    await publishPage(token, key, version);

    const application = await createApplication(token, {
      displayName,
      type: 'website',
      entryPoint: `cms://content/${key}`,
      hosts: [{ authority: hostname, type: 'Primary', preferredUrlScheme: 'https' }],
      usePreviewTokens: true,
      useApplicationSpecificAssets: true,
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
