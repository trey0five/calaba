import { MessageCircle, UsersRound, Sparkles, LucideIcon } from 'lucide-react';

export interface SkillSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Skill {
  id: string;
  icon: LucideIcon;
  title: string;
  /** one-liner on the card */
  body: string;
  /** medallion + underline fill */
  gradient: string;
  /** corner aura and hover shadow */
  glow: string;
  /** faint tint the card washes into on hover */
  wash: string;
  /** short line under the dialog heading */
  tagline: string;
  intro: string;
  sections: SkillSection[];
  takeaway: string;
}

export const SKILLS: Skill[] = [
  {
    id: 'communication',
    icon: MessageCircle,
    title: 'Communication',
    body: 'Speech, AAC, and functional language that reaches real listeners.',
    gradient: 'linear-gradient(135deg, #2FE0D8 0%, #0E5A56 100%)',
    glow: 'rgba(34,199,192,0.45)',
    wash: 'rgba(34,199,192,0.13)',
    tagline: 'Being understood, by whatever means works',
    intro:
      "Communication is not the same thing as speech. The goal is for your child to be understood by real people in real situations — and to understand others back. Whether that happens through words, signs, pictures or a speech device, a message that works is a message that counts.",
    sections: [
      {
        heading: 'What we build',
        bullets: [
          'Requesting — asking for what you want, and being answered',
          'Refusing and protesting in a way that people listen to, so behaviour is not the only option',
          'Commenting and sharing attention, which is where conversation actually starts',
          'Following and giving directions in the places they matter: home, classroom, playground',
          'Repairing a breakdown — trying again when the first attempt is not understood',
        ],
      },
      {
        heading: 'On AAC and talking',
        paragraphs: [
          'Families often worry that using a device or signs will stop a child from speaking. The research points the other way: augmentative communication tends to support speech rather than replace it, because it lowers the cost of trying to communicate at all.',
          'We use whatever gives your child a voice soonest, and we keep building from there. A child who can make themselves understood has far less reason to escalate.',
        ],
      },
      {
        heading: 'How we teach it',
        paragraphs: [
          'Inside real motivation, not flashcards. If your child wants the bubbles, that is the moment a request is worth teaching — the reward is the bubbles themselves, not praise for performing.',
          'We plan for generalisation deliberately: a word that only works with one therapist in one room is not finished. Caregivers are taught the same strategies so the skill survives outside session.',
        ],
      },
    ],
    takeaway:
      'The measure is not how many words a child has. It is whether they can get their message across to someone who can act on it.',
  },
  {
    id: 'social',
    icon: UsersRound,
    title: 'Social connection',
    body: 'Peer play, friendship-building, and family interaction.',
    gradient: 'linear-gradient(135deg, #FF6FB0 0%, #9C1F5B 100%)',
    glow: 'rgba(214,51,122,0.42)',
    wash: 'rgba(214,51,122,0.12)',
    tagline: 'Real friendships, not scripted politeness',
    intro:
      'Social goals are easy to get wrong. Teaching a child to mask, to force eye contact, or to perform greetings they do not mean produces compliance, not connection. We work toward relationships your child actually wants, on terms that feel safe to them.',
    sections: [
      {
        heading: 'What we build',
        bullets: [
          'Play skills that match your child’s stage — parallel play is real play, not a failure',
          'Joining a group, and leaving one, without it going wrong',
          'Turn-taking and sharing attention around something both children enjoy',
          'Reading and expressing feelings, including the uncomfortable ones',
          'Self-advocacy: saying no, asking for a break, telling someone they need help',
        ],
      },
      {
        heading: 'What we do not do',
        paragraphs: [
          'We do not train children to suppress stimming, force eye contact, or hide the parts of themselves that make other people more comfortable. Those goals raise short-term approval and long-term cost — autistic adults consistently report masking as exhausting and harmful.',
          'If a behaviour is not hurting your child or anyone else, it is usually not a target. We would rather change the environment than the child.',
        ],
      },
      {
        heading: 'Where it happens',
        paragraphs: [
          'Social skills learned at a table rarely survive a playground. We practise with actual peers and actual siblings, in the settings where your child needs them — which is why our programming runs across home, school and the community.',
          'Sibling sessions are part of this: brothers and sisters are often the longest relationship a child will have, and the most available playmate.',
        ],
      },
    ],
    takeaway:
      'Success is your child having relationships that feel good to them — not looking neurotypical to an observer.',
  },
  {
    id: 'daily-living',
    icon: Sparkles,
    title: 'Daily living',
    body: 'Self-care, routines, and independence at every age.',
    gradient: 'linear-gradient(135deg, #FFC44D 0%, #B8451F 100%)',
    glow: 'rgba(245,176,39,0.45)',
    wash: 'rgba(245,176,39,0.14)',
    tagline: 'The skills that decide how much help a life needs',
    intro:
      'Daily living skills are the quiet ones that shape independence more than almost anything else. Dressing, eating, sleeping, toileting, managing a morning — each one your child owns is a piece of their life that belongs to them, and one less pressure on your family.',
    sections: [
      {
        heading: 'What we build',
        bullets: [
          'Toileting, including our intensive potty training programme',
          'Dressing, bathing, brushing teeth, hair washing — often the ones with sensory obstacles',
          'Eating and expanding a restricted diet, at a pace that does not create fear around food',
          'Sleep and bedtime routines, which change a whole household when they work',
          'Transitions, waiting, and coping with plans that change',
          'For older learners: money, travel, cooking, appointments, and workplace routines',
        ],
      },
      {
        heading: 'Sensory reality first',
        paragraphs: [
          'A child who refuses to brush their teeth is frequently telling you something true about how the brush feels, not being defiant. We look for the sensory and medical explanation before we treat anything as a behaviour problem.',
          'That often means changing the toothbrush, the fabric, the lighting or the sequence — small environmental changes that make the skill possible instead of making the child endure it.',
        ],
      },
      {
        heading: 'Built to fade',
        paragraphs: [
          'Every plan is written to reduce support over time. We use task analysis and prompting that deliberately fades, so your child ends up doing the routine themselves rather than becoming dependent on an adult standing beside them.',
          'Caregivers are trained on the same steps, because these skills live at home and on holidays and at grandma’s house — not in a therapy room.',
        ],
      },
    ],
    takeaway:
      'Independence is not all-or-nothing. Every step your child takes alone is one they own for the rest of their life.',
  },
];
