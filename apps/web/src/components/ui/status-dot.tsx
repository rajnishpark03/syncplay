import { clsx } from 'clsx';

export function StatusDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span className={clsx('relative flex h-2.5 w-2.5', className)}>
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />}
      <span className={clsx('relative inline-flex h-2.5 w-2.5 rounded-full', online ? 'bg-mint' : 'bg-white/25')} />
    </span>
  );
}
