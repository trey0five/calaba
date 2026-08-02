import Reveal from '@/components/primitives/Reveal';
import PhotoFrame from '@/components/primitives/PhotoFrame';
import AuroraField from '@/components/primitives/AuroraField';
import AuroraRibbon from '@/components/primitives/AuroraRibbon';
import { PHOTOS } from '@/data/photos';

export default function About() {
  const photo = PHOTOS.about;

  return (
    <section
      id="about"
      className="relative py-14 sm:py-24 md:py-32 overflow-hidden overflow-x-clip"
    >
      <AuroraField variant="about" />
      <AuroraRibbon
        mode="echo"
        echoOpacity={0.1}
        className="absolute z-0 w-[min(90vw,1500px)] -top-16 -right-[18vw]"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <Reveal direction="left">
          <span className="text-teal-deep font-semibold text-xs tracking-[0.14em] uppercase">
            About CAL-ABA
          </span>
          <h2
            className="mt-4 text-text-base font-bold tracking-tight leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            Built on the belief that every child deserves a{' '}
            <span className="brand-gradient-text">path forward</span>.
          </h2>
          <p className="mt-6 text-text-base/85 text-base md:text-lg leading-[1.75] max-w-2xl">
            CAL-ABA is a Florida-based clinical practice delivering applied behavior analysis in
            the homes, schools, and communities where children live and learn. Our BCBAs and RBTs
            combine current evidence with deep respect for neurodivergent identities — meaning
            therapy is collaborative, assent-based, and shaped by what matters to your family.
            We're here for the long arc: from early intervention through adult transition.
          </p>
        </Reveal>

        <Reveal direction="right" delay={0.1} className="relative flex items-center justify-center">
          <PhotoFrame
            className="w-full max-w-[260px] sm:max-w-[340px] lg:max-w-[420px]"
            innerClassName="aspect-[4/3] sm:aspect-[4/5]"
          >
            <img
              src={photo.src}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-center"
            />
          </PhotoFrame>
        </Reveal>
      </div>
    </section>
  );
}
