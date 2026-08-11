import type { DeploymentState } from '@/lib/vercel';

const config: Record<DeploymentState, { label: string; classes: string }> = {
  READY: { label: 'Live', classes: 'bg-green-100 text-green-800' },
  BUILDING: { label: 'Building', classes: 'bg-blue-100 text-blue-800' },
  INITIALIZING: { label: 'Initializing', classes: 'bg-blue-100 text-blue-800' },
  QUEUED: { label: 'Queued', classes: 'bg-amber-100 text-amber-800' },
  ERROR: { label: 'Error', classes: 'bg-red-100 text-red-800' },
  CANCELED: { label: 'Canceled', classes: 'bg-gray-100 text-gray-600' },
};

export default function StatusBadge({ state }: { state: DeploymentState }) {
  const { label, classes } = config[state] ?? {
    label: state,
    classes: 'bg-gray-100 text-gray-600',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {state === 'READY' && (
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      )}
      {(state === 'BUILDING' || state === 'INITIALIZING') && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {label}
    </span>
  );
}
