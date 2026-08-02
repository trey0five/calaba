export interface ArticleSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Article {
  id: string;
  tag: string;
  title: string;
  excerpt: string;
  readMinutes: number;
  intro: string;
  sections: ArticleSection[];
  /** closing line pulled out in a highlighted box */
  takeaway: string;
}

export const ARTICLES: Article[] = [
  {
    id: 'intake',
    tag: 'Resource',
    title: 'Preparing for your first ABA intake',
    excerpt:
      'What to expect, what to bring, and how to talk to your child about new visitors.',
    readMinutes: 4,
    intro:
      "The first intake sets the tone for everything that follows, and most families arrive nervous. You don't need to prepare a presentation or have your child on their best behaviour — an ordinary day tells us far more than a rehearsed one. Here is what actually happens and how to walk in feeling ready.",
    sections: [
      {
        heading: 'What the first visit is really for',
        paragraphs: [
          'Intake is a conversation, not a test. A BCBA will ask about your child’s history, communication, routines, and what a hard day looks like — then spend time simply watching your child play and interact. Nothing is being scored.',
          'We are listening for two things: what matters most to your family right now, and where your child already has strengths we can build on. Those two answers shape the whole treatment plan.',
        ],
      },
      {
        heading: 'What to bring',
        bullets: [
          'Any diagnostic reports, evaluations, or prior therapy notes you have',
          'Your insurance card and, if relevant, a physician referral or prescription for ABA',
          'A current IEP or 504 plan if your child is school-aged',
          'A short list of the moments in your week that feel hardest',
          'Your questions — write them down, they evaporate in the moment',
        ],
      },
      {
        heading: 'How to talk to your child beforehand',
        paragraphs: [
          'Keep it short, concrete, and honest. Something like: "A person named Maria is coming to our house on Tuesday. She likes playing games. You can show her your trains if you want to."',
          'Avoid framing the visit as a test or a consequence, and skip the promise that they will love it. If your child asks whether they have to talk to the visitor, the honest answer — that they can take their time — is also the one that builds trust.',
        ],
      },
      {
        heading: 'What happens after',
        paragraphs: [
          'Following intake, the BCBA completes an assessment and drafts an individualized treatment plan with specific goals and recommended hours. You will review that plan together before anything is submitted to insurance, and you can push back on any goal that does not reflect your priorities.',
          'Authorization timelines vary by plan. We handle the submission and keep you updated rather than leaving you to chase it.',
        ],
      },
    ],
    takeaway:
      'You cannot get intake wrong. Come as you are, bring your questions, and let your child be their ordinary self — that is exactly the information we need.',
  },
  {
    id: 'assent',
    tag: 'Resource',
    title: 'What client assent looks like at home',
    excerpt:
      'Practical ways families can practice consent-based interactions every day.',
    readMinutes: 5,
    intro:
      'Assent means your child agrees to what is happening — not just that a parent consented on their behalf. For children who cannot yet say "no" in words, assent is something we read in behaviour and honour in how we respond. It is one of the clearest markers of ethical, modern ABA, and it belongs at home as much as in session.',
    sections: [
      {
        heading: 'Consent and assent are not the same thing',
        paragraphs: [
          'Consent is the legal permission you give as a caregiver. Assent is your child’s ongoing, moment-to-moment willingness to participate. A child can be consented into a program and still withdraw assent on a given afternoon — and that withdrawal is information, not defiance.',
        ],
      },
      {
        heading: 'What assent withdrawal looks like',
        bullets: [
          'Turning or leaning away, pushing materials back, covering their face',
          'Going quiet and still when they are usually animated',
          'Escalating behaviour that reliably ends the activity',
          'Saying "no", "all done", or their own version of those words',
          'Leaving the space, or trying to',
        ],
      },
      {
        heading: 'Five ways to practise at home',
        bullets: [
          'Offer real choices with real consequences — "bath now or after this song?" only works if both answers are honoured',
          'Narrate what is about to happen before you do it, especially with hands-on care',
          'Pause when your child signals no, then try a smaller version of the same request',
          'Let "all done" end something at least sometimes, so the word keeps its power',
          'Notice and respond to the quiet signals, not only the loud ones',
        ],
      },
      {
        heading: 'When you cannot honour a no',
        paragraphs: [
          'Some things are not optional — medication, car seats, a hand held in a parking lot. Assent-based practice does not mean everything is negotiable. It means being honest about what is not, offering control over everything around it, and never pretending a non-negotiable was a choice.',
          'You can say: "This one is not a choice. You can pick which arm, and you can hold your bear while we do it."',
        ],
      },
      {
        heading: 'Why it matters beyond therapy',
        paragraphs: [
          'A child who learns that their "no" is heard learns that their voice changes outcomes. That is the foundation of self-advocacy, and it is also a protective factor — children who expect to be listened to are more likely to report when something is wrong.',
        ],
      },
    ],
    takeaway:
      'Assent is not a technique you add on top of therapy. It is the running question underneath all of it: does this child still want to be here, and what are we doing about their answer?',
  },
  {
    id: 'siblings',
    tag: 'Resource',
    title: 'Building sibling connection through shared play',
    excerpt:
      'Strategies for fostering bonds between siblings, including those with different needs.',
    readMinutes: 4,
    intro:
      'Siblings are often a child’s longest relationship and their most available playmate — but shared play does not always come naturally when children communicate or regulate differently. A little structure goes a long way, and the goal is connection rather than fairness.',
    sections: [
      {
        heading: 'Start with parallel, not cooperative',
        paragraphs: [
          'Cooperative play — sharing a goal, taking turns, negotiating rules — is a demanding skill. Parallel play, where children do similar things side by side, is a real and valuable stage. Two kids building separate towers at the same table are connecting, even without a word.',
          'Build from there: same activity, then shared materials, then a shared goal. Skipping stages is where most sibling play collapses.',
        ],
      },
      {
        heading: 'Games that tend to work',
        bullets: [
          'Movement play — chase, trampoline, obstacle courses — where the fun is not verbal',
          'Building side by side with a big shared pile of blocks or magnetic tiles',
          'Music and rhythm games, which give structure without demanding conversation',
          'Cause-and-effect play like knocking towers down, where both roles are fun',
          'Short, repeatable routines with a clear ending, rather than open-ended sessions',
        ],
      },
      {
        heading: 'Give the neurotypical sibling a role, not a job',
        paragraphs: [
          'Siblings often slip into being a junior therapist or a second parent, and that quietly costs them the relationship. Watch for the child who narrates instructions, corrects, or manages their sibling instead of playing with them.',
          'Redirect gently toward being a playmate: "You don’t have to teach him — just build next to him." Protect their right to be a kid who sometimes finds it annoying.',
        ],
      },
      {
        heading: 'Protect one-on-one time',
        paragraphs: [
          'Every sibling needs time that is not shared and not about their brother or sister’s needs — even fifteen predictable minutes. Resentment tends to grow in the gap between how much attention each child perceives they get.',
          'Answer questions honestly at whatever level they are ready for. Children build their own explanations in the silence, and those are usually worse than the truth.',
        ],
      },
      {
        heading: 'How we help',
        paragraphs: [
          'Sibling training is part of our programming, not an extra. We run sessions with siblings included, coach the play skills that fit your particular children, and give parents language for the harder conversations.',
        ],
      },
    ],
    takeaway:
      'Aim for connection, not equality. Ten minutes of genuinely enjoyable shared play beats an hour of enforced turn-taking that nobody wanted.',
  },
];
