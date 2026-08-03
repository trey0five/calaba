import { useEffect, useState } from 'react';
import { ChevronRight, Inbox, LucideIcon, Quote, Sparkles, Star, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/motion';
import Reveal from '@/components/primitives/Reveal';
import RevealGroup from '@/components/primitives/RevealGroup';
import { useAdminData, useCounts } from '../data';
import { adminHref } from '../router';
import { useAuth } from '../auth';
import {
  avatarGradient,
  EmptyState,
  glassCard,
  HUES,
  Hue,
  initialsOf,
  Medallion,
  PageEnter,
  relativeTime,
  Skeleton,
} from '../ui';

/** Counts up from 0 so a number arriving reads as news, not decoration. */
function useCountUp(target: number, run: boolean) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);

  useEffect(() => {
    if (reduced || !run) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 800, 1);
      // easeOutExpo, matching the rest of the motion system
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduced]);

  return value;
}

function StatCard({
  icon: Icon,
  hue,
  label,
  value,
  href,
  run,
}: {
  icon: LucideIcon;
  hue: Hue;
  label: string;
  value: number;
  href: string;
  run: boolean;
}) {
  const shown = useCountUp(value, run);
  return (
    <a
      href={href}
      className={cn(
        glassCard,
        'group block overflow-hidden transition duration-300 hover:-translate-y-1 hover:bg-white/[0.1]',
      )}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(closest-side, ${HUES[hue].hex}22, transparent 75%) 100% 0% / 70% 120% no-repeat`,
        }}
        aria-hidden="true"
      />
      <span className="relative flex items-start justify-between gap-3">
        <span>
          <span className="block text-3xl font-extrabold tracking-tight text-text-light">
            {shown}
          </span>
          <span className="mt-1 block text-sm text-text-light/70">{label}</span>
        </span>
        <span
          className={cn('grid h-10 w-10 place-items-center rounded-full ring-1', HUES[hue].bgSoft, HUES[hue].ring, HUES[hue].text)}
        >
          <Icon size={19} />
        </span>
      </span>
    </a>
  );
}

interface AttentionItem {
  key: string;
  href: string;
  medallion: { label: string; gradient: string };
  title: string;
  sub: string;
  at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { reviews, applications, loading, activity } = useAdminData();
  const counts = useCounts();

  const firstName = (user?.name || user?.email || 'there').split(/[\s@]/)[0];
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const attention: AttentionItem[] = [
    // Both audiences land here: a pending team review needs the owner's
    // attention exactly as much as a pending family review does.
    ...reviews
      .filter((r) => r.status === 'pending')
      .map((r) => {
        const team = r.audience === 'staff';
        const anonymous = team
          ? r.submission.anonymous === true
          : r.submission.credit === 'Post anonymously';
        // The real name is admin-only, and the dashboard is admin-only.
        const who = (team ? r.submission.fullName : r.submission.name) || '';
        return {
          key: `rv-${r.id}`,
          href: adminHref('reviews', undefined, { status: 'pending' }),
          medallion: {
            label: team
              ? r.display.initials || 'TM'
              : anonymous
                ? '?'
                : initialsOf(who || r.display.attribution || '?'),
            gradient: avatarGradient(r.id),
          },
          title: `${r.submission.rating || r.display.rating}★ ${team ? 'team ' : ''}review from ${
            who || (anonymous ? 'Anonymous' : team ? 'a team member' : 'a family')
          }`,
          sub: r.submission.headline || r.display.quote || '',
          at: r.createdAt,
        };
      }),
    ...applications
      .filter((a) => a.status === 'new')
      .map((a) => ({
        key: `ap-${a.id}`,
        href: adminHref('applications', a.id),
        medallion: { label: a.values.position || '?', gradient: HUES.coral.gradient },
        title: `${a.values.name} applied for ${a.values.position || 'a role'}`,
        sub: [a.values.city, a.values.region].filter(Boolean).join(', '),
        at: a.createdAt,
      })),
  ]
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .slice(0, 5);

  return (
    <PageEnter>
      <header className="mb-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-bright">
          Overview
        </span>
        <h1
          className="type-lift mt-2 font-bold tracking-tight text-text-light"
          style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}
        >
          Welcome back, <span className="brand-gradient-text-bright">{firstName}</span>
        </h1>
        <p className="mt-1.5 text-sm text-text-light/70">{today}</p>
      </header>

      {loading ? (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </>
      ) : (
        <>
          <RevealGroup className="grid gap-4 grid-cols-2 lg:grid-cols-4" stagger={0.08}>
            <Reveal variantsMode direction="up">
              <StatCard
                icon={Star}
                hue="magenta"
                label="Pending reviews"
                value={counts.pendingReviews}
                href={adminHref('reviews', undefined, { status: 'pending' })}
                run={!loading}
              />
            </Reveal>
            <Reveal variantsMode direction="up">
              <StatCard
                icon={Inbox}
                hue="coral"
                label="New applications"
                value={counts.newApplications}
                href={adminHref('applications', undefined, { status: 'new' })}
                run={!loading}
              />
            </Reveal>
            <Reveal variantsMode direction="up">
              <StatCard
                icon={Quote}
                hue="gold"
                label="Published testimonials"
                value={counts.publishedReviews}
                href={adminHref('reviews', undefined, { status: 'approved' })}
                run={!loading}
              />
            </Reveal>
            <Reveal variantsMode direction="up">
              <StatCard
                icon={Users}
                hue="teal"
                label="Team members"
                value={counts.teamMembers}
                href={adminHref('staff')}
                run={!loading}
              />
            </Reveal>
          </RevealGroup>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className={glassCard}>
              <h2 className="text-[15px] font-bold text-text-light">Needs your attention</h2>
              {attention.length === 0 ? (
                <EmptyState
                  icon={<Sparkles size={22} />}
                  hue="teal"
                  title="You’re all caught up"
                  body="Nothing is waiting on you right now. New reviews and applications will land here."
                />
              ) : (
                <ul className="mt-4 divide-y divide-white/10">
                  {attention.map((item) => (
                    <li key={item.key}>
                      <a
                        href={item.href}
                        className="group -mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 transition hover:bg-white/[0.06]"
                      >
                        <Medallion label={item.medallion.label} gradient={item.medallion.gradient} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-text-light">
                            {item.title}
                          </span>
                          {item.sub && (
                            <span className="mt-0.5 block truncate text-sm text-text-light/70">
                              {item.sub}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-text-light/65">
                          {relativeTime(item.at)}
                        </span>
                        <ChevronRight
                          size={17}
                          className="shrink-0 text-text-light/40 transition-transform group-hover:translate-x-0.5"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={glassCard}>
              <h2 className="text-[15px] font-bold text-text-light">Recent activity</h2>
              {activity.length === 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-text-light/70">
                  Actions you take — publishing a review, updating the team — show up here.
                </p>
              ) : (
                <ul className="mt-4 space-y-3.5">
                  {activity.slice(0, 8).map((entry, i) => (
                    <li key={`${entry.at}-${i}`} className="flex items-start gap-3">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        // A corrupt localStorage entry used to throw here and
                        // take the whole dashboard down with it.
                        style={{ background: (HUES[entry.hue] ?? HUES.gold).hex }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 text-sm text-text-light/85">{entry.text}</span>
                      <span className="shrink-0 text-xs text-text-light/65">
                        {relativeTime(entry.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <p className="mt-8 text-center text-xs text-text-light/65">
        Changes publish to calabatherapy.com.
      </p>
    </PageEnter>
  );
}
