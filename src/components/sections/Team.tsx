import { useState } from 'react';
import Reveal, { RevealDirection } from '@/components/primitives/Reveal';
import AuroraField from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';

type Member = {
  img: string;
  name: string;
  title: string;
  direction: RevealDirection;
  /** intrinsic size — prevents layout shift while the photo loads */
  w: number;
  h: number;
};

const TEAM: Member[] = [
  { img: 'audrey-tatum.webp', w: 900, h: 1152, name: 'Audrey Tatum', title: 'Clinical Supervisor', direction: 'left' },
  { img: 'geena-roca.webp', w: 900, h: 1075, name: 'Geena Roca', title: 'Lead RBT', direction: 'scale' },
  { img: 'eric-andrade.webp', w: 900, h: 1140, name: 'Erick Andrade', title: 'Lead RBT', direction: 'right' },
];

function MemberCard({ member, index }: { member: Member; index: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = `${import.meta.env.BASE_URL}${member.img}`;

  return (
    <Reveal
      direction={member.direction}
      delay={0.1 + index * 0.12}
      scale={member.direction === 'scale' ? 0.9 : undefined}
      className="snap-center shrink-0 w-[80vw] md:w-auto md:shrink group flex flex-col h-full"
    >
      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden ring-1 ring-teal/20 shadow-glow-magenta bg-bg-deep transition-transform duration-300 group-hover:scale-[1.02]">
        {imgFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <img
              src={`${import.meta.env.BASE_URL}calaba2.png`}
              alt="CAL-ABA"
              className="h-14 w-auto opacity-90"
            />
            <p className="mt-4 text-text-light font-semibold">{member.name}</p>
            <p className="mt-1 text-gold-bright text-sm font-medium">{member.title}</p>
          </div>
        ) : (
          <img
            src={src}
            alt={`${member.name}, ${member.title} at CAL-ABA`}
            width={member.w}
            height={member.h}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </div>
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
          {TEAM.map((member, i) => (
            <MemberCard key={member.name} member={member} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
