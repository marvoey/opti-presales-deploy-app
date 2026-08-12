const CMS_API = 'https://api.cms.optimizely.com';

// Universal root page key — hyphens stripped as required by the content API.
const ROOT_PAGE_KEY = '43f936c9-9b23-4ea3-97b2-61c538ad07c9'.replace(/-/g, '');

export type CmsCredentials = {
  clientId: string;
  clientSecret: string;
};

export type ApplicationHost = {
  authority: string;
  type?: string;
  locale?: string;
  preferredUrlScheme?: string;
};

export type Application = {
  key?: string;
  displayName: string;
  type?: string;
  entryPoint: string;
  isDefault?: boolean;
  useApplicationSpecificAssets?: boolean;
  assetsRoot?: string | null;
  hosts?: ApplicationHost[];
  usePreviewTokens?: boolean;
  previewUrlFormats?: Record<string, string>;
  created?: string;
  createdBy?: string;
  lastModified?: string;
  lastModifiedBy?: string;
};

export type ApplicationCreate = {
  displayName: string;
  type: string;
  entryPoint: string;
  hosts?: ApplicationHost[];
  usePreviewTokens?: boolean;
  useApplicationSpecificAssets?: boolean;
  previewUrlFormats?: Record<string, string>;
};

export type CreatedPage = {
  key: string;
  version: string;
};

/** Exchange client credentials for a bearer token. Call once per operation set. */
export async function getToken({ clientId, clientSecret }: CmsCredentials): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${CMS_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`CMS token request failed: ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

export async function listApplications(token: string): Promise<Application[]> {
  const res = await fetch(`${CMS_API}/v1/applications?pageIndex=0&pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch applications: ${res.status}`);
  const data = await res.json();
  return data?.items ?? [];
}

/** Returns the first application whose hosts include the given hostname, or null. */
export async function findApplicationByHostname(
  token: string,
  hostname: string,
): Promise<Application | null> {
  const apps = await listApplications(token);
  return apps.find((app) => app.hosts?.some((h) => h.authority === hostname)) ?? null;
}

/** Creates a page content item under the universal root page and returns its key and version. */
export async function createPage(
  token: string,
  { contentType, displayName, locale = 'en' }: { contentType: string; displayName: string; locale?: string },
): Promise<CreatedPage> {
  const res = await fetch(`${CMS_API}/v1/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'cms-skip-validation': '*',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      contentType,
      container: ROOT_PAGE_KEY,
      initialVersion: { displayName, locale },
    }),
    cache: 'no-store',
  });
  if (res.status === 409) throw new Error(`Page "${displayName}" already exists`);
  if (!res.ok) throw new Error(`Failed to create page: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const key: string = data.key;
  const version: string = data.initialVersion?.version ?? data.version;
  if (!key || !version) throw new Error('Create page response missing key or version');
  return { key, version };
}

/** Publishes a content item version. */
export async function publishPage(token: string, key: string, version: string): Promise<void> {
  const res = await fetch(
    `${CMS_API}/v1/content/${encodeURIComponent(key)}/versions/${version}:publish`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`Failed to publish page ${key}: ${res.status}`);
}

/** Deletes a content item by key. Used to clean up orphaned pages on partial failure. */
export async function deletePage(token: string, key: string): Promise<void> {
  const res = await fetch(`${CMS_API}/v1/content/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Failed to delete page ${key}: ${res.status}`);
}

/** Deletes a CMS application by key. */
export async function deleteApplication(token: string, key: string): Promise<void> {
  const res = await fetch(`${CMS_API}/v1/applications/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return; // already gone
  if (!res.ok) throw new Error(`Failed to delete application ${key}: ${res.status}`);
}

/** Deletes the CMS application whose hosts include the given hostname. No-ops if none found. */
export async function deleteApplicationByHostname(token: string, hostname: string): Promise<void> {
  const app = await findApplicationByHostname(token, hostname);
  if (!app?.key) return;
  await deleteApplication(token, app.key);
}

/** Creates a CMS application. */
export async function createApplication(
  token: string,
  app: ApplicationCreate,
): Promise<Application> {
  const res = await fetch(`${CMS_API}/v1/applications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(app),
    cache: 'no-store',
  });
  if (res.status === 409) throw new Error(`Application with this key already exists`);
  if (!res.ok) throw new Error(`Failed to create application: ${res.status} ${await res.text()}`);
  return res.json();
}
