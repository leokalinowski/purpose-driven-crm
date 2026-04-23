import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useOpportunityActivities } from '@/hooks/useOpportunityActivities';
import { useToast } from '@/hooks/use-toast';
import { TodayOpportunity } from '@/hooks/useToday';
import { Phone, MessageSquare, Mail, Users, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';

const OUTCOMES = [
  { value: 'called', label: 'Called', icon: Phone },
  { value: 'texted', label: 'Texted', icon: MessageSquare },
  { value: 'emailed', label: 'Emailed', icon: Mail },
  { value: 'met', label: 'Met', icon: Users },
  { value: 'left_voicemail', label: 'Left VM', icon: Phone },
  { value: 'no_answer', label: 'No Answer', icon: Phone },
  { value: 'note', label: 'Just a note', icon: FileText },
];

interface Props {
  opportunity: TodayOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export function CompleteAndSetNextModal({ opportunity, open, onOpenChange, onCompleted }: Props) {
  const { toast } = useToast();
  const { logActivity } = useOpportunityActivities(opportunity?.id ?? null);

  const [step, setStep] = useState<1 | 2>(1);
  const [outcome, setOutcome] = useState('');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [nextTitle, setNextTitle] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setOutcome('');
    setOutcomeNote('');
    setNextTitle('');
    setNextDue('');
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleStep1Next = () => {
    if (!outcome) {
      toast({ title: 'Select what happened', variant: 'destructive' });
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (!nextTitle.trim()) {
      toast({ title: 'Next step is required', description: 'What needs to happen next?', variant: 'destructive' });
      return;
    }
    if (!nextDue) {
      toast({ title: 'Due date is required', description: 'When should this be done?', variant: 'destructive' });
      return;
    }
    if (!opportunity) return;

    setSaving(true);
    try {
      // 1. Log the completed activity
      if (outcome !== 'note') {
        await logActivity({
          activity_type: outcome,
          title: opportunity.next_step_title ?? undefined,
          outcome,
          note: outcomeNote.trim() || undefined,
        });
      } else if (outcomeNote.trim()) {
        await logActivity({ activity_type: 'note', note: outcomeNote.trim() });
      }

      // 2. Update opportunity with new next step (clears old one)
      const { error } = await supabase
        .from('opportunities')
        .update({
          next_step_title: nextTitle.trim(),
          next_step_due_date: nextDue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunity.id);

      if (error) throw error;

      toast({ title: 'Done!', description: 'Next step set.' });
      reset();
      onOpenChange(false);
      onCompleted?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // If no existing next step, skip to step 2 directly (setting next step only)
  const isSettingOnly = !opportunity?.next_step_title;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSettingOnly ? 'Set Next Step' : step === 1 ? 'Complete Step' : "What's Next?"}
          </DialogTitle>
          {opportunity && (
            <p className="text-sm text-muted-foreground">{opportunity.contact_name}</p>
          )}
        </DialogHeader>

        {/* Progress dots */}
        {!isSettingOnly && (
          <div className="flex items-center gap-2 py-1">
            <span className={cn('h-2 w-2 rounded-full', step >= 1 ? 'bg-foreground' : 'bg-muted')} />
            <span className="h-px flex-1 bg-border" />
            <span className={cn('h-2 w-2 rounded-full', step >= 2 ? 'bg-foreground' : 'bg-muted')} />
          </div>
        )}

        {/* Step 1: What happened */}
        {(step === 1 && !isSettingOnly) && (
          <div className="space-y-4 py-2">
            {opportunity?.next_step_title && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Was:</span> {opportunity.next_step_title}
              </div>
            )}

            <div>
              <Label className="text-xs mb-2 block">What happened?</Label>
              <div className="grid grid-cols-3 gap-2">
                {OUTCOMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setOutcome(value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2.5 rounded-lg text-xs font-medium border transition-colors',
                      outcome === value
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Note <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="Anything important from this interaction?"
                value={outcomeNote}
                onChange={e => setOutcomeNote(e.target.value)}
                className="text-sm resize-none h-20"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleStep1Next} disabled={!outcome}>
                Next <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Set next step */}
        {(step === 2 || isSettingOnly) && (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs mb-1.5 block">
                Next step <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Schedule showing, Follow up on pre-approval…"
                value={nextTitle}
                onChange={e => setNextTitle(e.target.value)}
                className="text-sm"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">
                Due date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={nextDue}
                onChange={e => setNextDue(e.target.value)}
                className="text-sm"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="flex justify-between gap-2">
              {!isSettingOnly && (
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← Back</Button>
              )}
              <div className="flex gap-2 ml-auto">
                {isSettingOnly && (
                  <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
                )}
                <Button onClick={handleFinish} disabled={saving || !nextTitle.trim() || !nextDue}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  {saving ? 'Saving…' : 'Set Next Step'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
