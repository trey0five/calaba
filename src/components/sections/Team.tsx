import { useEffect, useState } from 'react';
import Reveal, { RevealDirection } from '@/components/primitives/Reveal';
import AuroraField from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';
import StaffCard from '@/components/primitives/StaffCard';
import { getStaff } from '@/lib/api';

type Member = {
  /** resolved HEADSHOT url — bundled files are prefixed with BASE_URL, API
   *  photos arrive as absolute S3 URLs and must NOT be. The card frame, name
   *  and title are composed around it by <StaffCard>. */
  src: string;
  name: string;
  title: string;
  direction: RevealDirection;
  /** intrinsic size — prevents layout shift while the photo loads */
  w: number;
  h: number;
};

/** Reveal choreography by position, reused whatever the source of the data. */
const DIRECTIONS: RevealDirection[] = ['left', 'scale', 'right'];

/** Bundled fallback — stays in the repo forever so the section renders with
 *  the API down, and is only replaced by a non-empty live roster. These are the
 *  plain HEADSHOTS cropped out of the three original card designs, so the
 *  composed card is identical to the artwork it replaces. */
const TEAM: Member[] = (
  [
    { src: 'head-audrey.webp', w: 600, h: 600, name: 'Audrey Tatum', title: 'Clinical Supervisor', direction: 'left' },
    { src: 'head-geena.webp', w: 600, h: 600, name: 'Geena Roca', title: 'Lead RBT', direction: 'scale' },
    { src: 'head-erick.webp', w: 600, h: 600, name: 'Erick Andrade', title: 'Lead RBT', direction: 'right' },
  ] as Member[]
).map((m) => ({ ...m, src: `${import.meta.env.BASE_URL}${m.src}` }));

function MemberCard({ member, index }: { member: Member; index: number }) {
  return (
    <Reveal
      direction={member.direction}
      delay={0.1 + index * 0.12}
      scale={member.direction === 'scale' ? 0.9 : undefined}
      className="snap-center shrink-0 w-[80vw] md:w-auto md:shrink group flex flex-col h-full"
    >
      {/* The card IS the design now: headshot + frame + live text. StaffCard
          owns the aspect-[9/11] box (CLS reservation) and the broken-photo
          fallback, so a dead URL still renders a framed logo placeholder. */}
      <StaffCard
        photoUrl={member.src}
        name={member.name}
        title={member.title}
        className="ring-1 ring-teal/20 shadow-glow-magenta transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="mt-5 text-center">
        <h3 className="text-text-base font-bold text-xl">
          {member.name}
        </h3>
        <p className="mt-1 text-gold-deep font-semibold text-sm tracking-wide uppercase">
          {member.title}
        </p>
      </div>
    </Reveal>
  );
}

export default function Team() {
  const [team, setTeam] = useState<Member[]>(TEAM);

  useEffect(() => {
    const ac = new AbortController();
    let live = true;
    const apply = (staff: Awaited<ReturnType<typeof getStaff>>) => {
      if (!live || !staff) return;
      // Build the replacement FIRST, then decide. Checking `staff.team.length`
      // before filtering out photoless members meant a roster where every
      // member was still awaiting a photo upload blanked the whole section.
      const next: Member[] = (staff.team || [])
        .filter((m) => m?.photo?.url && m.name)
        .map((m, i) => ({
          src: m.photo!.url,
          name: m.name,
          title: m.title,
          // keep the API's intrinsic size so the CLS reservation survives
          w: m.photo?.w ?? 900,
          h: m.photo?.h ?? 1125,
          direction: DIRECTIONS[i % DIRECTIONS.length],
        }));
      if (next.length === 0) return;   // keep the bundled team
      setTeam(next);
    };
    // Second arg revalidates behind a cached paint, so an admin edit shows up
    // within the session instead of waiting for the cache to expire.
    getStaff(ac.signal, apply).then(apply);
    return () => {
      live = false;
      ac.abort();
    };
  }, []);

  return (
    <section
      id="team"
      className="relative py-14 sm:py-24 md:py-32 overflow-hidden overflow-x-clip"
    >
      <AuroraField variant="team" />
      <AuroraRibbon
        mode="echo"
        echoOpacity={0.1}
        className="absolute z-0 w-[min(100vw,1700px)] left-1/2 top-1/3 -translate-x-1/2"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10">
        <Reveal direction="up" className="text-center max-w-3xl mx-auto">
          <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
            The People Behind the Care
          </span>
          <h2
            className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            Meet our <span className="brand-gradient-text">team</span>
          </h2>
          <p className="mt-4 text-text-base/85 text-base md:text-lg leading-[1.7]">
            Behind every plan is a team of dedicated behavior technicians who show up
            for your family with consistency, warmth, and skill.
          </p>
        </Reveal>

        <div
          data-auto-carousel
          className="mt-14 flex items-stretch overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 -mx-6 px-6 pt-2 pb-4 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:items-stretch"
        >
          {team.map((member, i) => (
            <MemberCard key={member.name} member={member} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
