import { Sparkles, Info, Zap } from 'lucide-react';

export const typeConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  feature: { label: 'New Feature', icon: Sparkles, variant: 'default' },
  update: { label: 'Update', icon: Zap, variant: 'secondary' },
  tip: { label: 'Tip', icon: Info, variant: 'outline' },
};

export const APP_PAGES = [
  { label: 'Dashboard', value: '/' },
  { label: 'SphereSync Tasks', value: '/spheresync-tasks' },
  { label: 'Database', value: '/database' },
  { label: 'Events', value: '/events' },
  { label: 'Newsletter', value: '/newsletter' },
  { label: 'Newsletter Builder', value: '/newsletter-builder' },
  { label: 'Coaching', value: '/coaching' },
  { label: 'Transactions', value: '/transactions' },
  { label: 'Pipeline', value: '/pipeline' },
  { label: 'Social Scheduler', value: '/social-scheduler' },
  { label: 'Support', value: '/support' },
] as const;
