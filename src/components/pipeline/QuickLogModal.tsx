import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useOpportunityActivities } from '@/hooks/useOpportunityActivities';
import { useToast } from '@/hooks/use-toast';
import { TodayOpportunity } from '@/hooks/useToday';
import { Phone, MessageSquare, Mail, Users, FileText } from 'lucide-react';

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'note', label: 'Note', icon: FileText },
] as const;

interface Props {
  opportunity: TodayOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged?: () => void;
}

export function QuickLogModal({ opportunity, open, onOpenChange, onLogged }: Props) {
  const { toast } = useToast();
  const { logActivity } = useOpportunityActivities(opportunity?.id ?? null);
  const [activityType, setActivityType] = useState<string>('call');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!opportunity) return;
    setSaving(true);
    try {
      await logActivity({ activity_type: activityType, note: note.trim() || undefined });
      toast({ title: 'Activity logged' });
      setNote('');
      onOpenChange(false);
      onLogged?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          {opportunity && (
            <p className="text-sm text-muted-foreground">{opportunity.contact_name}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Activity type */}
          <div>
            <Label className="text-xs mb-2 block">What happened?</Label>
            <div className="flex gap-2 flex-wrap">
              {ACTIVITY_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setActivityType(value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                    activityType === value
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <Label className="text-xs mb-1.5 block">Note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              placeholder="What did you discuss?"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="text-sm resize-none h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Log Activity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
