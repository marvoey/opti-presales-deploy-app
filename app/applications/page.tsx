import { getToken, listApplications, type Application, type ApplicationHost } from '@/lib/optimizely';

function HostRow({ host }: { host: ApplicationHost }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-1.5 pr-4 font-mono text-sm text-gray-800">{host.authority}</td>
      <td className="py-1.5 pr-4 text-sm text-gray-500">{host.type ?? '—'}</td>
      <td className="py-1.5 pr-4 text-sm text-gray-500">{host.locale ?? '—'}</td>
      <td className="py-1.5 text-sm text-gray-500">{host.preferredUrlScheme ?? '—'}</td>
    </tr>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  const previewFormats = app.previewUrlFormats ? Object.entries(app.previewUrlFormats) : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-gray-900">{app.displayName}</p>
          <p className="mt-0.5 font-mono text-sm text-gray-400">{app.key}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {app.type}
          </span>
          {app.isDefault && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              default
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm border-t border-gray-100 pt-4">
        <dt className="text-gray-400 font-medium">Entry point</dt>
        <dd className="font-mono text-gray-800 break-all">{app.entryPoint}</dd>

        {app.usePreviewTokens !== undefined && (
          <>
            <dt className="text-gray-400 font-medium">Preview tokens</dt>
            <dd className="text-gray-800">{app.usePreviewTokens ? 'Yes' : 'No'}</dd>
          </>
        )}

        {app.useApplicationSpecificAssets !== undefined && (
          <>
            <dt className="text-gray-400 font-medium">App-specific assets</dt>
            <dd className="text-gray-800">{app.useApplicationSpecificAssets ? 'Yes' : 'No'}</dd>
          </>
        )}

        {app.assetsRoot && (
          <>
            <dt className="text-gray-400 font-medium">Assets root</dt>
            <dd className="font-mono text-gray-800 break-all">{app.assetsRoot}</dd>
          </>
        )}

        {app.lastModified && (
          <>
            <dt className="text-gray-400 font-medium">Last modified</dt>
            <dd className="text-gray-800">
              {new Date(app.lastModified).toLocaleString()} by {app.lastModifiedBy ?? '—'}
            </dd>
          </>
        )}

        {app.created && (
          <>
            <dt className="text-gray-400 font-medium">Created</dt>
            <dd className="text-gray-800">
              {new Date(app.created).toLocaleString()} by {app.createdBy ?? '—'}
            </dd>
          </>
        )}
      </dl>

      {app.hosts && app.hosts.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Hosts</p>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                <th className="pb-1.5 pr-4">Authority</th>
                <th className="pb-1.5 pr-4">Type</th>
                <th className="pb-1.5 pr-4">Locale</th>
                <th className="pb-1.5">Scheme</th>
              </tr>
            </thead>
            <tbody>
              {app.hosts.map((h, i) => (
                <HostRow key={i} host={h} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewFormats.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Preview URL formats
          </p>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                <th className="pb-1.5 pr-4">Content type</th>
                <th className="pb-1.5">URL format</th>
              </tr>
            </thead>
            <tbody>
              {previewFormats.map(([type, format]) => (
                <tr key={type} className="border-t border-gray-100">
                  <td className="py-1.5 pr-4 font-mono text-sm text-gray-800">{type}</td>
                  <td className="py-1.5 font-mono text-sm text-gray-600 break-all">{format}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function ApplicationsPage() {
  const clientId = process.env.OPTIMIZELY_CMS_CLIENT_ID;
  const clientSecret = process.env.OPTIMIZELY_CMS_CLIENT_SECRET;

  let applications: Application[] = [];
  let error: string | null = null;

  if (!clientId || !clientSecret) {
    error = 'OPTIMIZELY_CMS_CLIENT_ID and OPTIMIZELY_CMS_CLIENT_SECRET are not configured.';
  } else {
    try {
      const token = await getToken({ clientId, clientSecret });
      applications = await listApplications(token);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load applications.';
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Applications</h1>
        {!error && (
          <p className="mt-1 text-sm text-gray-400">
            {applications.length} application{applications.length !== 1 ? 's' : ''} registered
          </p>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm text-sm text-red-700">
          {error}
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-500">
          No applications found.
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <ApplicationCard key={app.key} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
