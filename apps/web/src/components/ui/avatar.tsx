import { clsx } from 'clsx';

export function Avatar({ name, src, size = 44 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover" />;
  }

  return (
    <div
      className={clsx('flex items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-muted font-semibold text-white')}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </div>
  );
}
