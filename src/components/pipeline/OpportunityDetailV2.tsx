import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TodayOpportunity } from '@/hooks/useToday';
import { useOpportunityActivities } from '@/hooks/useOpportunityActivities';
import { QuickLogModal } from './QuickLogModal';
import { CompleteAndSetNextModal } from './CompleteAndSetNextModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { pipelineTypeFromOpportunityType, getStagesForType, getStageLabel, OPPORTUNITY_TYPE_LABELS } from '@/config/pipelineStages';
import {
  AlertCircle, CheckCircle2, Clock, Zap, CalendarClock,
  MessageSquare, Phone, Mail, Users, FileText, ArrowRight,
  TrendingUp, DollarSign, Calendar
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  text: <MessageSquare className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  note: <FileText className="h-3.5 w-3.5" />,
};

const CONFIDENCE_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { value: 'high', label: 'High', color: 'text-green-600 bg-green-50 border-green-200' },
];

const TYPE_COLORS: Record<string, string> = {
  buyer: 'bg-blue-100 text-blue-800',
  seller: 'bg-amber-100 text-amber-800',
  referral: 'bg-purple-100 text-purple-800',
};

function formatDue(dateStr: string | null): { label: string; urgent: boolean } {
  if (!dateStr) return { label: 'No due date', urgent: false };
  const d = parseISO(dateStr);
  const overdue = isPast(d) && !isToday(d);
  if (overdue) return { label: `Overdue · ${format(d, 'MMM d')}`, urgent: true };
  if (isToday(d)) return { label: 'Due today', urgent: true };
  if (isTomorrow(d)) return { label: 'Due tomorrow', urgent: false };
  return { label: format(d, 'MMM d, yyyy'), urgent: false };
}

function formatActivityDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, h:mm a');
  } catch { return dateStr; }
}

interface Props {
  opportunity: TodayOpportunity | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function OpportunityDetailV2({ opportunity, open, onClose, onRefresh }: Props) {
  const { toast } = useToast();
  const { activities, refresh: refreshActivities } = useOpportunityActivities(opportunity?.id ?? null);
  const [logOpen, setLogOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [savingConfidence, setSavingConfidence] = useState(false);
  const [savingStage, setSavingStage] = useState(false);

  if (!opportunity) return null;

  const pipelineType = (opportunity.pipeline_type ?? pipelineTypeFromOpportunityType(opportunity.opportunity_type ?? 'buyer')) as 'buyer' | 'seller' | 'referral';
  const stages = getStagesForType(pipelineType);
  const due = formatDue(opportunity.next_step_due_date);

  const handleConfidence = async (val: string) => {
    setSavingConfidence(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ confidence: val, updated_at: new Date().toISOString() })
        .eq('id', opportunity.id);
      if (error) throw error;
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingConfidence(false);
    }
  };

  const handleStageChange = async (newStage: string) => {
    setSavingStage(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', opportunity.id);
      if (error) throw error;
      toast({ title: 'Stage updated' });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingStage(false);
    }
  };

  const handleDone = () => {
    setCompleteOpen(false);
    setLogOpen(false);
    refreshActivities();
    onRefresh();
    // Keep drawer open
  };

  const confidenceVal = opportunity.confidence ?? 'medium';
  const confColor = CONFIDENCE_OPTIONS.find(c => c.value === confidenceVal)?.color ?? '';

  return (
    <>
      <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            {/* Contact name + badges */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold leading-tight">{opportunity.contact_name}</h2>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn('text-xs border-0 capitalize', TYPE_COLORS[pipelineType] ?? 'bg-slate-100 text-slate-700')}
                  >
                    {OPPORTUNITY_TYPE_LABELS[opportunity.opportunity_type ?? ''] ?? pipelineType}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {getStageLabel(opportunity.stage ?? '', pipelineType)}
                  </Badge>
                  {opportunity.ai_deal_probability != null && (
                    <Badge
                      variant="outline"
                      className={cn('text-xs gap-1', opportunity.ai_deal_probability >= 70 ? 'text-green-700 bg-green-50 border-green-200' : opportunity.ai_deal_probability >= 40 ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-700 bg-red-50 border-red-200')}
                    >
                      <Zap className="h-3 w-3" />
                      {opportunity.ai_deal_probability}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-5 pb-8">
            {/* NEXT STEP */}
            <div className={cn('rounded-xl p-4 border', opportunity.next_step_title ? 'bg-card border-border' : 'bg-orange-50 border-orange-200')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Step</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2"
                  onClick={() => setCompleteOpen(true)}
                >
                  {opportunity.next_step_title ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Complete</>
                  ) : (
                    <><ArrowRight className="h-3.5 w-3.5 text-orange-600" /> Set</>
                  )}
                </Button>
              </div>

              {opportunity.next_step_title ? (
                <div>
                  <p className="text-sm font-medium">{opportunity.next_step_title}</p>
                  <p className={cn('text-xs mt-1', due.urgent ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                    <CalendarClock className="inline h-3 w-3 mr-1" />
                    {due.label}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-orange-700 font-medium">No next step set</p>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setLogOpen(true)}>
                <MessageSquare className="h-3.5 w-3.5" />
                Log Activity
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {opportunity.next_step_title ? 'Complete' : 'Set Next Step'}
              </Button>
            </div>

            <Separator />

            {/* Confidence */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">My Confidence</p>
              <div className="flex gap-2">
                {CONFIDENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleConfidence(opt.value)}
                    disabled={savingConfidence}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      confidenceVal === opt.value ? opt.color : 'text-muted-foreground border-border hover:border-foreground/30'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stage</p>
              <Select value={opportunity.stage ?? ''} onValueChange={handleStageChange} disabled={savingStage}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.key} value={s.key} className="text-sm">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deal Info */}
            <div className="grid grid-cols-2 gap-3">
              {opportunity.deal_value != null && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" /> Deal Value
                  </div>
                  <p className="text-sm font-semibold">
                    ${opportunity.deal_value.toLocaleString()}
                  </p>
                </div>
              )}
              {opportunity.expected_close_date && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3" /> Target Close
                  </div>
                  <p className="text-sm font-semibold">
                    {format(parseISO(opportunity.expected_close_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>

            {/* AI Summary */}
            {opportunity.ai_summary && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="h-3.5 w-3.5 text-purple-600" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Summary</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{opportunity.ai_summary}</p>
                  {opportunity.ai_suggested_next_action && (
                    <div className="mt-2 p-2 rounded-lg bg-purple-50 border border-purple-100">
                      <p className="text-xs text-purple-700">
                        <strong>Suggested:</strong> {opportunity.ai_suggested_next_action}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Activity Feed */}
            <Separator />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Activity</p>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 10).map(act => (
                    <div key={act.id} className="flex gap-2.5">
                      <div className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {ACTIVITY_ICONS[act.activity_type] ?? <FileText className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium capitalize">{act.activity_type.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-muted-foreground">{formatActivityDate(act.activity_date)}</span>
                        </div>
                        {act.title && <p className="text-xs text-muted-foreground truncate">{act.title}</p>}
                        {act.note && <p className="text-xs text-muted-foreground mt-0.5">{act.note}</p>}
                        {act.outcome && <p className="text-xs text-muted-foreground">→ {act.outcome.replace(/_/g, ' ')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <QuickLogModal
        opportunity={opportunity}
        open={logOpen}
        onOpenChange={setLogOpen}
        onLogged={handleDone}
      />
      <CompleteAndSetNextModal
        opportunity={opportunity}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onCompleted={handleDone}
      />
    </>
  );
}
