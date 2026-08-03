import PageEntrance from '@/components/primitives/PageEntrance';
import Nav from '@/components/sections/Nav';
import Hero from '@/components/sections/Hero';
import CredentialsBand from '@/components/sections/CredentialsBand';
import Pillars from '@/components/sections/Pillars';
import About from '@/components/sections/About';
import Founder from '@/components/sections/Founder';
import Team from '@/components/sections/Team';
import AbaExplainer from '@/components/sections/AbaExplainer';
import Services from '@/components/sections/Services';
import WhyChoose from '@/components/sections/WhyChoose';
import Process from '@/components/sections/Process';
import InsuranceBanner from '@/components/sections/InsuranceBanner';
import Testimonials from '@/components/sections/Testimonials';
import Blog from '@/components/sections/Blog';
import ContactCta from '@/components/sections/ContactCta';
import Footer from '@/components/sections/Footer';
import { useAutoCarousels } from '@/lib/useAutoCarousels';
import { DialogProvider } from '@/lib/dialogs';
import ConsultationDialog from '@/components/ConsultationDialog';
import ApplicationDialog from '@/components/ApplicationDialog';
import ServiceDialog from '@/components/ServiceDialog';
import ArticleDialog from '@/components/ArticleDialog';
import SkillDialog from '@/components/SkillDialog';
import ReviewDialog from '@/components/ReviewDialog';
import TeamReviewDialog from '@/components/TeamReviewDialog';
import Careers from '@/components/sections/Careers';

export default function App() {
  useAutoCarousels(5500);

  return (
    <DialogProvider>
      <PageEntrance />
      <Nav />
      <main>
        <Hero />
        <CredentialsBand />
        <Pillars />
        <About />
        <Founder />
        <Team />
        <AbaExplainer />
        <Services />
        <WhyChoose />
        <Process />
        <InsuranceBanner />
        <Testimonials />
        <Blog />
        <Careers />
        <ContactCta />
      </main>
      <Footer />
      <ConsultationDialog />
      <ApplicationDialog />
      <ServiceDialog />
      <ArticleDialog />
      <SkillDialog />
      <ReviewDialog />
      <TeamReviewDialog />
    </DialogProvider>
  );
}
