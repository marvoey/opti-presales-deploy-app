'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={
        active
          ? 'text-sm font-semibold text-white'
          : 'text-sm text-white/60 hover:text-white transition-colors'
      }
    >
      {children}
    </Link>
  );
}
