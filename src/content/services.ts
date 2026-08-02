import {
  Home,
  School,
  TreePine,
  HeartHandshake,
  ShieldCheck,
  FileText,
  LucideIcon,
} from 'lucide-react';

export interface Service {
  id: string;
  icon: LucideIcon;
  title: string;
  /** one-line summary on the card */
  body: string;
  /** opening paragraph in the detail dialog */
  intro: string;
  /** "What a session looks like" */
  sessions: string[];
  /** "What's included" */
  includes: string[];
  /** short "best for" line under the heading */
  goodFor: string;
}

export const SERVICES: Service[] = [
  {
    id: 'home',
    icon: Home,
    title: 'Home-Based ABA',
    body: 'Therapy where your child is most themselves — natural environment, family rhythms, real-world generalization.',
    goodFor: 'Best for early learners and skills that belong to daily routines',
    intro:
      "Home is where your child is most themselves, so it's where the most durable learning happens. We work inside your family's real routines — mornings, meals, play, bedtime — so new skills show up in the moments that actually matter, instead of only at a therapy table.",
    sessions: [
      'A Registered Behavior Technician works 1:1 with your child, with a BCBA overseeing every program',
      'Goals are embedded in natural routines and play rather than drilled in isolation',
      'Your child helps steer the session — assent guides what we push and when we pause',
      'Data is taken throughout so progress is visible, not guessed at',
    ],
    includes: [
      'Comprehensive assessment and an individualized treatment plan',
      'Regular BCBA supervision and program updates',
      'Caregiver coaching so strategies continue between sessions',
      'Progress reviews you can actually read and understand',
    ],
  },
  {
    id: 'school',
    icon: School,
    title: 'School-Based ABA',
    body: 'In-classroom support and educator collaboration to align goals across settings.',
    goodFor: 'Best when classroom demands are the biggest hurdle',
    intro:
      'Skills that work at home should work at school too. We support your child inside the classroom and partner with their teachers so everyone is reinforcing the same goals in the same way — instead of your child having to navigate two different systems.',
    sessions: [
      'Direct in-classroom support during the parts of the day that are hardest',
      'Collaboration with teachers, aides, and school staff on consistent strategies',
      'Focus on attending, transitions, peer interaction, and independent work',
      'Careful fading of support as your child gains independence',
    ],
    includes: [
      'Coordination with the school team and existing IEP or 504 goals',
      'Teacher-friendly strategies that fit real classroom constraints',
      'Data shared across home and school so the picture stays whole',
      'Transition planning between grades, classrooms, or schools',
    ],
  },
  {
    id: 'community',
    icon: TreePine,
    title: 'Community-Based ABA',
    body: 'Skills generalized to parks, stores, and family outings so progress travels with your child.',
    goodFor: 'Best for families who want outings to feel possible again',
    intro:
      "A skill your child only uses in the living room isn't finished yet. Community sessions take learning into the places your family actually goes — the grocery store, the park, the waiting room — so progress travels with your child instead of staying home.",
    sessions: [
      'Practice in real settings: shops, playgrounds, restaurants, appointments',
      'Safety skills like staying close, waiting, and asking for help',
      'Tolerating waiting, noise, crowds, and unexpected changes',
      'Caregivers coached in the moment, so you feel confident going alone',
    ],
    includes: [
      'Gradual, planned exposure — never flooding',
      'Communication strategies your child can use under pressure',
      'Plans for the outings your family cares most about',
      'Ongoing BCBA oversight of every community goal',
    ],
  },
  {
    id: 'family',
    icon: HeartHandshake,
    title: 'Parent & Sibling Training',
    body: 'Collaborative goal-setting, skills coaching, and sibling sessions that strengthen family dynamics.',
    goodFor: 'Best for families who want to feel like a team again',
    intro:
      "You are with your child far more than we ever will be, and siblings are often their most important playmates. Training isn't an add-on here — it's part of every plan, so the people who matter most have strategies that genuinely work.",
    sessions: [
      'Goal-setting sessions where your priorities shape the plan',
      'Hands-on coaching with feedback, not just handouts',
      'Sibling sessions that build play, patience, and connection',
      'Practical problem-solving for the moments that derail your week',
    ],
    includes: [
      'Written strategies in plain language you can share with family',
      'Support for routines like mornings, homework, mealtimes, and bedtime',
      'Guidance on responding to challenging behavior consistently',
      'Regular check-ins as goals evolve',
    ],
  },
  {
    id: 'specialized',
    icon: ShieldCheck,
    title: 'Specialized Programming',
    body: 'Intensive potty training and severe behavior intervention delivered by experienced clinicians.',
    goodFor: 'Best for high-priority goals that need focused expertise',
    intro:
      'Some goals need concentrated, experienced attention. Our specialized programs handle the areas families most often tell us they have struggled to solve elsewhere — with senior clinical oversight and a clear, humane plan from day one.',
    sessions: [
      'Intensive toilet training with a structured, data-driven protocol',
      'Severe behavior intervention grounded in careful functional assessment',
      'Frequent clinical review while intensity is high',
      'Clear criteria for stepping intensity back down as things stabilize',
    ],
    includes: [
      'Functional behavior assessment before any intervention begins',
      'Safety and crisis planning where it is warranted',
      'Caregiver training so gains survive the transition home',
      'Coordination with physicians and other providers when useful',
    ],
  },
  {
    id: 'advocacy',
    icon: FileText,
    title: 'IEP & Educational Advocacy',
    body: "School consultation and IEP meeting support to ensure your child's plan reflects their needs.",
    goodFor: 'Best when you want an expert in your corner at the table',
    intro:
      "IEP meetings can feel like everyone in the room speaks a language you were never taught. We help you prepare, attend meetings with you, and make sure the plan on paper reflects the child you actually know.",
    sessions: [
      'Review of current IEP or 504 documents and progress data',
      'Preparation so you walk in knowing what to ask for',
      'Attendance and support at IEP or school meetings',
      'Follow-up on whether agreed supports are truly being delivered',
    ],
    includes: [
      'Plain-language explanation of your rights and options',
      'Clinical data to support the goals you are requesting',
      'Written recommendations the school team can act on',
      'Ongoing consultation as the school year unfolds',
    ],
  },
];
