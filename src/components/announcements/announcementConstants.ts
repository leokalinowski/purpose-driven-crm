import { Sparkles, Info, Zap } from 'lucide-react';

export const typeConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  feature: { label: 'New Feature', icon: Sparkles, variant: 'default' },
  update: { label: 'Update', icon: Zap, variant: 'secondary' },
  tip: { label: 'Tip', icon: Info, variant: 'outline' },
};
