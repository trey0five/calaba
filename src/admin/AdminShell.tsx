import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  LucideIcon,
  Star,
  UserCog,
  Users,
} from 'lucide-react';
import { site } from '@/content/site';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';
import AuroraField from '@/components/primitives/AuroraField';
import ParticleField from '@/components/primitives/ParticleField';
import { useAuth } from './auth';
import { useCounts } from './data';
import { adminHref, AdminArea } from './router';
import { focusRing, HUES, Hue, iconBtn, initialsOf, Medallion } from './ui';

interface NavItem {
  area: AdminArea;
  label: string;
  short: string;
  icon: LucideIcon;
  hue: Hue;
}

const NAV: NavItem[] = [
  { area: 'overview', label: 'Overview', short: 'Home', icon: LayoutDashboard, hue: 'gold' },
  { area: 'reviews', label: 'Reviews', short: 'Reviews', icon: Star, hue: 'magenta' },
  { area: 'staff', label: 'Team', short: 'Team', icon: Users, hue: 'teal' },
  { area: 'applications', label: 'Applications', short: 'Apply', icon: Inbox, hue: 'coral' },
];

export const AREA_TITLES: Record<AdminArea, string> = {
  overview: 'Overview',
  reviews: 'Reviews',
  staff: 'Team',
  applications: 'Applications',
  account: 'Account',
};

/** Count badge, with the Careers ping-dot when something is waiting. */
function Badge({ count, hue }: { count: number; hue: Hue }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex items-center gap-1.5">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ background: HUES[hue].hex }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ background: HUES[hue].hex }}
        />
      </span>
      <span
        className={cn(
          'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold text-ink',
        )}
        style={{ background: HUES[hue].hex }}
      >
        {count}
      </span>
    </span>
  );
}

export default function AdminShell({
  area,
  children,
}: {
  area: AdminArea;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const counts = useCounts();
  const reduced = usePrefersReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const badgeFor = (item: NavItem) =>
    item.area === 'reviews'
      ? counts.pendingReviews
      : item.area === 'applications'
        ? counts.newApplications
        : 0;

  return (
    <div className="relative min-h-[100svh] text-text-light">
      {/* One background for the whole admin — never remounted per route. */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <AuroraField variant="admin" />
        <div className="absolute inset-0 hidden lg:block">
          <ParticleField density={40} seed={13} parallax={false} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/10 bg-[#140A2E] lg:flex">
        <a
          href="#/admin"
          className={cn('flex items-center gap-3 px-5 py-5 transition hover:opacity-90', focusRing)}
          aria-label="CAL-ABA admin home"
        >
          <img src={site.logo} alt="" className="h-10 w-10 object-contain" />
          <span className="text-sm font-bold tracking-tight text-text-light">
            CAL-ABA <span className="text-text-light/65">Admin</span>
          </span>
        </a>

        <nav className="mt-2 flex flex-col gap-1 px-3" aria-label="Admin sections">
          {NAV.map((item) => {
            const active = item.area === area;
            const Icon = item.icon;
            return (
              <a
                key={item.area}
                href={adminHref(item.area)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition',
                  focusRing,
                  active
                    ? 'bg-white/10 text-text-light ring-1 ring-white/15'
                    : 'text-text-light/65 hover:bg-white/[0.06] hover:text-text-light',
                )}
              >
                {active && !reduced && (
                  <motion.span
                    layoutId="nav-accent"
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-full"
                    style={{ background: HUES[item.hue].hex }}
                    transition={{ duration: 0.35, ease: easeOutExpo }}
                  />
                )}
                {active && reduced && (
                  <span
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-full"
                    style={{ background: HUES[item.hue].hex }}
                  />
                )}
                <Icon size={18} className={active ? HUES[item.hue].text : undefined} />
                {item.label}
                <Badge count={badgeFor(item)} hue={item.hue} />
              </a>
            );
          })}
        </nav>

        <div className="mx-5 my-4 border-t border-white/10" />

        <div className="mt-auto flex flex-col gap-1 px-3 pb-5">
          <a
            href={adminHref('account')}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              focusRing,
              area === 'account'
                ? 'bg-white/10 text-text-light ring-1 ring-white/15'
                : 'text-text-light/65 hover:bg-white/[0.06] hover:text-text-light',
            )}
          >
            <UserCog size={17} />
            Account
          </a>
          <a
            href="/"
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-text-light/65 transition hover:bg-white/[0.06] hover:text-text-light',
              focusRing,
            )}
          >
            <ExternalLink size={17} />
            View live site
          </a>
          <button
            type="button"
            onClick={signOut}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-text-light/65 transition hover:bg-white/[0.06] hover:text-coral-bright',
              focusRing,
            )}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-ink-950/70 px-4 backdrop-blur md:px-8">
          <img src={site.logo} alt="" className="h-8 w-8 object-contain lg:hidden" />
          {/* Not a heading: this sits BEFORE the page's own <h1> in the DOM, so
              as an <h2> it inverted the outline for anyone browsing by heading. */}
          <p className="text-[15px] font-bold tracking-tight text-text-light">
            {AREA_TITLES[area]}
          </p>

          <div className="relative ml-auto flex items-center gap-2" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={cn(
                'flex items-center gap-2.5 rounded-full bg-white/[0.07] py-1.5 pl-1.5 pr-3 ring-1 ring-white/15 transition hover:bg-white/[0.12]',
                focusRing,
              )}
            >
              <Medallion
                label={initialsOf(user?.name || user?.email || '?')}
                gradient={HUES.teal.gradient}
                size="sm"
              />
              <span className="hidden max-w-[9rem] truncate text-[13px] font-semibold text-text-light sm:block">
                {user?.name || user?.email}
              </span>
            </button>

            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className={cn(iconBtn, 'hidden lg:grid')}
            >
              <LogOut size={17} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-14 w-56 overflow-hidden rounded-2xl bg-ink-950/95 p-1.5 ring-1 ring-white/15 shadow-cosmic backdrop-blur"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-text-light">
                    {user?.name || 'Signed in'}
                  </p>
                  <p className="truncate text-xs text-text-light/65">{user?.email}</p>
                </div>
                <a
                  href={adminHref('account')}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-text-light/80 transition hover:bg-white/10 hover:text-text-light"
                >
                  <UserCog size={16} />
                  Account &amp; password
                </a>
                <a
                  href="/"
                  role="menuitem"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-text-light/80 transition hover:bg-white/10 hover:text-text-light"
                >
                  <ExternalLink size={16} />
                  View live site
                </a>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-light/80 transition hover:bg-white/10 hover:text-coral-bright"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8 pb-24 md:px-10 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 flex border-t border-white/10 bg-ink-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Admin sections"
      >
        {NAV.map((item) => {
          const active = item.area === area;
          const Icon = item.icon;
          const count = badgeFor(item);
          return (
            <a
              key={item.area}
              href={adminHref(item.area)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                // >=44px tall: 10px label + 20px icon + py-2.5 lands just under.
                'relative flex min-h-[52px] flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition',
                focusRing,
                active ? 'text-text-light' : 'text-text-light/55',
              )}
            >
              <span className="relative">
                <Icon size={20} style={active ? { color: HUES[item.hue].hex } : undefined} />
                {count > 0 && (
                  <span
                    className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full ring-2 ring-ink-950"
                    style={{ background: HUES[item.hue].hex }}
                    aria-label={`${count} waiting`}
                  />
                )}
              </span>
              {item.short}
              {active &&
                (reduced ? (
                  <span
                    className="absolute bottom-1 h-1 w-1 rounded-full"
                    style={{ background: HUES[item.hue].hex }}
                  />
                ) : (
                  <motion.span
                    layoutId="tab-dot"
                    className="absolute bottom-1 h-1 w-1 rounded-full"
                    style={{ background: HUES[item.hue].hex }}
                  />
                ))}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
