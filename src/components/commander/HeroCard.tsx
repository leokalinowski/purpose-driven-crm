import { Phone, MessageCircle, Copy, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NextHour, URGENCY_META } from '@/hooks/useCoachingState';

interface HeroCardProps {
  nextHour: NextHour | null;
  loading?: boolean;
}

function stripPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function HeroCard({ nextHour, loading }: HeroCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card p-6 md:p-8 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-4" />
        <div className="h-8 w-64 bg-muted rounded mb-3" />
        <div className="h-4 w-full bg-muted rounded mb-6" />
        <div className="h-20 w-full bg-muted/70 rounded mb-4" />
        <div className="flex gap-2">
          <div className="h-11 w-24 bg-muted rounded" />
          <div className="h-11 w-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!nextHour) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-6 md:p-8 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h2 className="font-semibold text-base mb-1">The Coach is warming up</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your first coaching tick runs tonight at 05:00 UTC. After that, this space will tell
          you exactly who to talk to next and what to say.
        </p>
      </div>
    );
  }

  const urgency = URGENCY_META[nextHour.urgency] ?? URGENCY_META.timely;
  const actionLabel = nextHour.action === 'call' ? 'Call' :
                      nextHour.action === 'text' ? 'Text' :
                      nextHour.action === 'email' ? 'Email' :
                      nextHour.action === 'meet' ? 'Meet' :
                      nextHour.action === 'follow_up' ? 'Follow up with' :
                      'Reach out to';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(nextHour.first_sentence);
      toast.success('Opener copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card p-5 md:p-7 shadow-sm">
      {/* Label + urgency */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Clock className="h-3.5 w-3.5" />
          Next hour
        </div>
        <span className={cn('text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded border', urgency.className)}>
          {urgency.label}
        </span>
      </div>

      {/* Action + name */}
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-2">
        {actionLabel} {nextHour.contact_name}
      </h1>

      {/* Reasoning */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground mb-5">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-purple-500" />
        <span>{nextHour.reasoning}</span>
      </div>

      {/* First sentence — the actual opener */}
      <div className="rounded-xl bg-muted/40 border border-border p-4 mb-4">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
          Here's how to open
        </div>
        <p className="text-base leading-relaxed italic">"{nextHour.first_sentence}"</p>
      </div>

      {/* Context chips */}
      {nextHour.context_chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {nextHour.context_chips.map((chip, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          size="lg"
          className="h-12 gap-2 flex-1 md:flex-initial md:min-w-[140px] bg-green-600 hover:bg-green-700 text-white"
        >
          <a href={`tel:_coach_placeholder`} onClick={(e) => {
            e.preventDefault();
            toast.info('Tap Call on the contact card to dial — we do not have the phone cached in the Coach payload yet.');
          }}>
            <Phone className="h-5 w-5" />
            Call now
          </a>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-12 gap-2 flex-1 md:flex-initial"
          onClick={handleCopy}
        >
          <Copy className="h-4 w-4" />
          Copy opener
        </Button>
      </div>

      {/* Footnote */}
      <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        The Coach suggests — you decide. Dismiss anything that doesn't land.
      </p>
    </div>
  );
}
