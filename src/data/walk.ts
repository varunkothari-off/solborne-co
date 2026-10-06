/**
 * The Walk — voice-first intake flow. Naming and the fixed Part-1 questions.
 *
 * NAMING: Walk of Fame is the owner-approved interview name.
 * It is deliberately defined ONCE here — change these three strings and the
 * whole site follows.
 */
export const walk = {
  /** The flow's name as shown in copy. */
  name: 'The Walk of Fame',
  /** Short form for the nav pill / buttons. */
  cta: 'Walk of Fame',
  /** Route. */
  path: '/walk/',
  /** Target duration surfaced in copy. */
  targetMinutes: 30,
} as const;

/**
 * Part labels ("Set A/B/C" is internal shorthand only — never shown).
 */
export const walkParts = [
  { key: 'one', label: 'In your words' },
  { key: 'two', label: 'The right questions' },
  { key: 'three', label: 'Where to find you' },
] as const;

/**
 * Part 1 — the fixed voice questions, identical for everyone. Their job is to
 * surface the raw material from which Part 2's "right questions" are derived:
 * story → strengths → customer value → public proof → next step.
 */
export const partOneQuestions: readonly string[] = [
  'Tell us your business story - what do you do, who do you serve, and what led you here?',
  'What are you proudest of in your work, and what makes your approach different?',
  'What do your customers gain from working with you? Share an example you are comfortable making public.',
  'What public proof, work samples or official links could support that story, and what should stay private?',
  'What should someone understand about your business when they visit your website, and what should they do next?',
];
/** Part 3 — the typed facts. Only name + email are mandatory. */
export interface WalkContactField {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea';
  placeholder?: string;
}

export const partThreeFields: readonly WalkContactField[] = [
  { key: 'name', label: 'Your name', required: true, type: 'text' },
  { key: 'email', label: 'Email', required: true, type: 'email' },
  { key: 'company', label: 'Company / firm', required: false, type: 'text' },
  { key: 'phone', label: 'Phone', required: true, type: 'tel', placeholder: '+91 98765 43210' },
  { key: 'website', label: 'Website', required: false, type: 'url', placeholder: 'https://…' },
  { key: 'linkedin', label: 'LinkedIn', required: false, type: 'url' },
  { key: 'socials', label: 'Other social profiles', required: false, type: 'textarea' },
  { key: 'news', label: 'Been in the news lately? Paste links', required: false, type: 'textarea' },
  { key: 'anything', label: 'Anything else we should look at', required: false, type: 'textarea' },
];
