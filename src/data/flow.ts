/** Public launch journey. Paid terms and connected services require separate agreement. */
import { walk } from './walk';
export interface FlowStage { key: string; name: string; tag: string; blurb: string; href?: string; }
export const flow: FlowStage[] = [
  { key: 'walk', name: walk.name, tag: '', href: walk.path,
    blurb: 'Speak or type about your business, review each answer, and answer the follow-up questions your story earns.' },
  { key: 'review', name: 'Choose your public facts', tag: '',
    blurb: 'Review your business story, services, audience and contact details. You decide what belongs on your website; research suggestions need your permission and approval.' },
  { key: 'website', name: 'Your website source files', tag: 'Free',
    blurb: 'Generate a static website preview and download HTML plus an ownership README. Hosting, domains and future changes are separate arrangements.' },
  { key: 'discovery', name: 'Discuss one business workflow', tag: '', href: '/contact/',
    blurb: 'Describe one repetitive task, your current tools and the result you want. Any implementation, AI lead pilot or paid help needs a separately agreed scope and terms.' },
];