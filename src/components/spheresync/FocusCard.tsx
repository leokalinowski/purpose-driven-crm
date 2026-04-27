import { Sparkles, Phone, MessageSquare, Mail, SkipForward, Copy, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NextHour, URGENCY_META } from '@/hooks/useCoachingState';

interface FocusCardProps {
  nextHour: NextHour | null;
  loading?: boolean;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const init = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (parts[0] ?? '?').slice(0, 2);
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base">
      {init.toUpperCase()}
    </div>
  );
}

export function FocusCard({ nextHour, loading }: FocusCardProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 animate-pulse">
        <div className="h-3 w-36 bg-muted rounded mb-4" />
        <div className="h-7 w-3/4 bg-muted rounded mb-2" />
        <div className="h-3 w-full bg-muted rounded mb-1" />
        <div className="h-3 w-2/3 bg-muted rounded mb-6" />
        <div className="h-20 w-full bg-muted/60 rounded-xl mb-4" />
        <div className="flex gap-2">
          {[0,1,2,3].map(i => <div key={i} className="h-9 w-24 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!nextHour) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 text-center min-h-[280px]">
        <Sparkles className="h-9 w-9 text-muted-foreground mb-3" />
        <h2 className="font-semibold text-base mb-1 text-foreground">The Coach is warming up</h2>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          Your first coaching tick runs tonight at 05:00 UTC. After that, this card will tell you
          exactly who to call first and what to say.
        </p>
      </div>
    );
  }

  const urgency = URGENCY_META[nextHour.urgency];
  const actionVerb =
    nextHour.action === 'call' ? 'Call' :
    nextHour.action === 'text' ? 'Text' :
    nextHour.action === 'email' ? 'Email' :
    nextHour.action === 'meet' ? 'Meet' :
    'Follow up with';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(nextHour.first_sentence);
      toast.success('Opener copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7">
      {/* Radial glow — top right */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full"
        style={{ background: 'radial-gradient(circle at top right, hsl(184 100% 34% / 0.08), transparent 70%)' }}
      />

      {/* Eyebrow */}
      <div className="relative mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary">
          <Sparkles className="h-3 w-3" />
          The Coach says, {nextHour.action === 'call' ? 'call' : nextHour.action === 'text' ? 'text' : 'reach out to'} this first
        </div>
        <div className="flex items-center gap-1 text-[10.5px] uppercase font-semibold tracking-wider">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className={cn('px-2 py-0.5 rounded border text-[10px]', urgency.className)}>
            {urgency.label}
          </span>
        </div>
      </div>

      {/* Headline */}
      <h2 className="relative mb-2 text-2xl font-medium leading-tight tracking-tight text-balance text-foreground">
        {nextHour.contact_name}
        {nextHour.reasoning && ` — ${nextHour.reasoning.toLowerCase().charAt(0) === nextHour.reasoning.charAt(0).toLowerCase() ? nextHour.reasoning : nextHour.reasoning}`}
      </h2>

      {/* Opener */}
      <p className="relative mb-5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
        {nextHour.first_sentence}
      </p>

      {/* Persona block */}
      <div className="relative mb-4 flex items-start gap-3.5 rounded-xl border border-border bg-muted/30 p-4">
        <Initials name={nextHour.contact_name} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-0.5 text-foreground">{nextHour.contact_name}</div>
          {nextHour.context_chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {nextHour.context_chips.map((chip, i) => (
                <span
                  key={i}
                  className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[11.5px] font-medium text-primary"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="relative flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-primary hover:bg-reop-teal-hover text-white"
          onClick={() => toast.info(`Opening ${nextHour.action} for ${nextHour.contact_name}…`)}
        >
          <Phone className="h-3.5 w-3.5" />
          {actionVerb} {nextHour.contact_name.split(' ')[0]}
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => toast.info('Opening text…')}>
          <MessageSquare className="h-3.5 w-3.5" />
          Text
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          Copy opener
        </Button>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={() => toast.info('Snoozed to tomorrow')}>
          <SkipForward className="h-3.5 w-3.5" />
          Snooze
        </Button>
      </div>
    </div>
  );
}
