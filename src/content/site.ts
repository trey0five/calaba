import logoUrl from '@/assets/calaba2.png';

export const site = {
  brand: 'CAL-ABA',
  logo: logoUrl,
  contact: {
    email: 'Info.Calaba@gmail.com',
    phone: '(954) 599-2260',
    /**
     * Consultation-form delivery. GitHub Pages is static, so the browser has
     * to hand off to a service. Tried in order; the first one configured wins,
     * and if none are set the form falls back to a pre-filled email so no
     * enquiry is ever lost.
     *
     * 1. EmailJS — preferred: delivers the branded HTML template in
     *    docs/consultation-email-template.html (logo + every field laid out).
     *    Fill all three values from https://dashboard.emailjs.com.
     * 2. formEndpoint — any Formspree/Web3Forms style JSON endpoint.
     */
    emailjs: {
      serviceId: '',
      /** consultation form -> docs/consultation-email-template.html */
      templateId: '',
      /** job application form -> docs/application-email-template.html */
      applicationTemplateId: '',
      /** review submissions -> docs/review-email-template.html */
      reviewTemplateId: '',
      publicKey: '',
    },
    formEndpoint: '',
    /**
     * Résumé hosting for the job-application form. GitHub Pages can't receive
     * files, and email services only attach on paid plans — so the file is
     * uploaded to Cloudinary (free tier, unsigned preset) and the email
     * carries a download link. Create an unsigned upload preset at
     * https://console.cloudinary.com -> Settings -> Upload.
     * While these are empty the form still submits; the email says the résumé
     * needs to be requested from the applicant.
     */
    resumeUpload: {
      cloudName: '',
      uploadPreset: '',
    },
    hours: 'Mon-Fri 8am-6pm',
  },
  navLinks: [
    { label: 'Home', href: '#top' },
    { label: 'About', href: '#about' },
    { label: 'Our Team', href: '#founder' },
    { label: 'Services', href: '#services' },
    { label: 'Insurance', href: '#insurance' },
    { label: 'Blog', href: '#blog' },
    { label: 'Careers', href: '#careers' },
    { label: 'Contact', href: '#contact' },
  ],
  /**
   * SAMPLE reviews written for design purposes - anonymised composites, not
   * real client statements. Replace with genuine, consented testimonials
   * before launch.
   */
  testimonials: [
    {
      quote:
        'We came in exhausted after a year on waitlists. Within two months our son was asking for what he wanted instead of melting down, and our BCBA had taught us exactly how to respond so it kept working after she left. The first time he said "help me" instead of screaming, I cried in the kitchen.',
      attribution: 'Parent of a 4-year-old',
      location: 'Broward County',
      service: 'Home-Based ABA',
      initials: 'BC',
      rating: 5,
    },
    {
      quote:
        "What sold us was that they asked our daughter what she wanted to work on. Nobody had ever done that. She's nine, she has opinions, and for the first time therapy felt like something happening with her instead of to her. She actually looks forward to Tuesdays now.",
      attribution: 'Parent of a 9-year-old',
      location: 'Miami-Dade County',
      service: 'Community-Based ABA',
      initials: 'MD',
      rating: 5,
    },
    {
      quote:
        'Two years of trying to potty train, three different programs, no progress. CAL-ABA had a plan on day one and we were done in under a month. I keep telling other parents about it because I genuinely did not believe it would work.',
      attribution: 'Parent of a 6-year-old',
      location: 'Palm Beach County',
      service: 'Specialized Programming',
      initials: 'PB',
      rating: 5,
    },
    {
      quote:
        'I used to dread IEP meetings. Our BCBA came with data, sat beside me, and translated everything in real time. We walked out with the supports my son actually needed instead of the ones that were convenient. His teacher says he is a different kid this year.',
      attribution: 'Parent of an 11-year-old',
      location: 'Broward County',
      service: 'IEP & Educational Advocacy',
      initials: 'BC',
      rating: 5,
    },
  ],
  services: [
    {
      title: 'Home-Based ABA',
      body: 'Therapy where your child is most themselves — natural environment, family rhythms, real-world generalization.',
    },
    {
      title: 'School-Based ABA',
      body: 'In-classroom support and educator collaboration to align goals across settings.',
    },
    {
      title: 'Community-Based ABA',
      body: 'Skills generalized to parks, stores, and family outings so progress travels with your child.',
    },
    {
      title: 'Parent & Sibling Training',
      body: 'Collaborative goal-setting, skills coaching, and sibling sessions that strengthen family dynamics.',
    },
    {
      title: 'Specialized Programming',
      body: 'Intensive potty training and severe behavior intervention delivered by experienced clinicians.',
    },
    {
      title: 'IEP & Educational Advocacy',
      body: 'School consultation and IEP meeting support to ensure your child\'s plan reflects their needs.',
    },
  ],
};
