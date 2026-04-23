import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Opportunity } from "@/hooks/usePipeline";
import { usePipelineTasks } from "@/hooks/usePipelineTasks";
import { usePipelineStageHistory } from "@/hooks/usePipelineStageHistory";
import {
  getStagesForType,
  getStageLabel,
  getStageAccent,
  pipelineTypeFromOpportunityType,
  pipelineTypeBadgeClass,
  OPPORTUNITY_TYPE_LABELS,
  PipelineType,
} from "@/config/pipelineStages";
import {
  Sparkles,
  Zap,
  AlertTriangle,
  Shield,
  Clock,
  Star,
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  X,
} from "lucide-react";
import { format } from "date-fns";

interface OpportunityDetailDrawerProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onUpdate: (opportunityId: string, data: Partial<Opportunity>) => Promise<boolean>;
  onRefresh: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4 first:mt-0">
      {children}
    </h3>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}

// ── Stage Progress Bar ────────────────────────────────────────────────────────

function StageProgressBar({
  currentStage,
  pipelineType,
}: {
  currentStage: string;
  pipelineType: PipelineType;
}) {
  const stages = getStagesForType(pipelineType).filter((s) => !s.terminal);
  const currentIdx = stages.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-start gap-0">
      {stages.map((stage, idx) => {
        const isActive = stage.key === currentStage;
        const isDone = currentIdx > idx;
        return (
          <div key={stage.key} className="flex flex-col items-center flex-1 min-w-0">
            <div className="flex items-center w-full">
              {/* Left connector line */}
              <div
                className={`flex-1 h-0.5 ${idx === 0 ? 'bg-transparent' : isDone || isActive ? 'bg-primary' : 'bg-border'}`}
              />
              {/* Circle */}
              <div
                className={`h-4 w-4 rounded-full flex-shrink-0 border-2 transition-all ${
                  isActive
                    ? 'bg-primary border-primary shadow-sm shadow-primary/40'
                    : isDone
                    ? 'bg-primary/80 border-primary/80'
                    : 'bg-background border-border'
                }`}
              />
              {/* Right connector line */}
              <div
                className={`flex-1 h-0.5 ${idx === stages.length - 1 ? 'bg-transparent' : isDone ? 'bg-primary' : 'bg-border'}`}
              />
            </div>
            <span
              className={`text-[10px] mt-1 truncate w-full text-center leading-tight px-0.5 ${
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}
            >
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab({ opportunityId }: { opportunityId: string }) {
  const { openTasks, completedTasks, overdueTasks, loading, addTask, completeTask, deleteTask } =
    usePipelineTasks(opportunityId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', due_date: '', task_type: 'call' });

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    await addTask({
      title: newTask.title,
      due_date: newTask.due_date || null,
      task_type: newTask.task_type,
      priority: 2,
      completed: false,
    });
    setNewTask({ title: '', due_date: '', task_type: 'call' });
    setShowAddForm(false);
  };

  const priorityLabel = (p: number) => {
    if (p >= 3) return <Badge variant="destructive" className="text-[10px] px-1 py-0">High</Badge>;
    if (p === 2) return <Badge variant="secondary" className="text-[10px] px-1 py-0">Normal</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1 py-0">Low</Badge>;
  };

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {overdueTasks.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Open tasks */}
      <div className="space-y-2">
        {openTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-start gap-2 p-2.5 rounded-lg border border-border hover:bg-accent/20 transition-colors group"
          >
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => completeTask(task.id)}
              className="mt-0.5 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
              {task.due_date && (
                <p className={`text-xs mt-0.5 flex items-center gap-1 ${task.due_date < new Date().toISOString().split('T')[0] ? 'text-red-600' : 'text-muted-foreground'}`}>
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.due_date), 'MMM dd, yyyy')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {priorityLabel(task.priority)}
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add task */}
      {showAddForm ? (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-accent/10">
          <Input
            placeholder="Task title..."
            value={newTask.title}
            onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
              className="h-8 text-sm flex-1"
            />
            <Select value={newTask.task_type} onValueChange={(v) => setNewTask(prev => ({ ...prev, task_type: v }))}>
              <SelectTrigger className="h-8 text-sm w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddTask} className="h-7 text-xs">Add Task</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} className="w-full h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Task
        </Button>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {showCompleted ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Completed ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="space-y-1">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded-md text-sm text-muted-foreground line-through"
                >
                  <Checkbox checked disabled className="flex-shrink-0" />
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({ opportunityId }: { opportunityId: string }) {
  const { history, loading } = usePipelineStageHistory(opportunityId);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>;
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No stage history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-2 w-2 rounded-full bg-primary mt-1" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap text-sm">
              {entry.from_stage ? (
                <>
                  <span className="text-muted-foreground font-medium">{getStageLabel(entry.from_stage)}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-semibold text-foreground">{getStageLabel(entry.to_stage)}</span>
                </>
              ) : (
                <span className="font-semibold text-foreground">Added to {getStageLabel(entry.to_stage)}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">
                {format(new Date(entry.changed_at), 'MMM dd, yyyy')}
              </span>
              {entry.days_in_from_stage != null && entry.from_stage && (
                <span className="text-xs text-muted-foreground">
                  {entry.days_in_from_stage}d in {getStageLabel(entry.from_stage)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function OpportunityDetailDrawer({
  opportunity,
  open,
  onOpenChange,
  onStageUpdate,
  onUpdate,
  onRefresh,
}: OpportunityDetailDrawerProps) {
  if (!opportunity) return null;

  const pipelineType: PipelineType =
    (opportunity.pipeline_type as PipelineType | null) ??
    pipelineTypeFromOpportunityType(opportunity.opportunity_type ?? 'buyer');

  const displayName =
    opportunity.contact?.first_name || opportunity.contact?.last_name
      ? `${opportunity.contact?.first_name ?? ''} ${opportunity.contact?.last_name ?? ''}`.trim()
      : 'Unknown Contact';

  const stageAccent = getStageAccent(opportunity.stage, pipelineType);
  const typeLabel = OPPORTUNITY_TYPE_LABELS[opportunity.opportunity_type] ?? opportunity.opportunity_type;
  const typeBadgeClass = pipelineTypeBadgeClass(pipelineType);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-bold text-foreground truncate">
                {displayName}
              </SheetTitle>
              {opportunity.title && (
                <SheetDescription className="text-sm text-muted-foreground mt-0.5 truncate">
                  {opportunity.title}
                </SheetDescription>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs border ${typeBadgeClass}`}
                >
                  {typeLabel}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs border"
                  style={{ borderColor: stageAccent, color: stageAccent }}
                >
                  {getStageLabel(opportunity.stage, pipelineType)}
                </Badge>
                {opportunity.is_stale && (
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                    <Clock className="h-2.5 w-2.5 mr-1" />
                    Stale {opportunity.days_in_current_stage}d
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Stage progress */}
        <div className="px-5 py-3 border-b border-border flex-shrink-0 bg-muted/30">
          <StageProgressBar currentStage={opportunity.stage} pipelineType={pipelineType} />
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
            <TabsList className="flex-shrink-0 mx-5 mt-3 w-auto justify-start h-8 bg-muted/50">
              <TabsTrigger value="overview" className="text-xs h-7">Overview</TabsTrigger>
              <TabsTrigger value="deal" className="text-xs h-7">Deal Details</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs h-7">Tasks</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs h-7">Activity</TabsTrigger>
              <TabsTrigger value="contact" className="text-xs h-7">Contact</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {/* OVERVIEW */}
              <TabsContent value="overview" className="mt-4 space-y-3 focus-visible:outline-none">
                {/* AI Summary */}
                {opportunity.ai_summary && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">AI Summary</span>
                      {opportunity.ai_deal_probability != null && (
                        <span className="ml-auto text-xs font-bold text-blue-700">
                          {opportunity.ai_deal_probability}% probability
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-blue-900 leading-relaxed">{opportunity.ai_summary}</p>
                  </div>
                )}

                {/* AI Suggested Next Action */}
                {opportunity.ai_suggested_next_action && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Suggested Next Action</span>
                    </div>
                    <p className="text-sm text-green-900">{opportunity.ai_suggested_next_action}</p>
                  </div>
                )}

                {/* AI Risk Flags */}
                {opportunity.ai_risk_flags && opportunity.ai_risk_flags.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Risk Flags</span>
                    </div>
                    <ul className="space-y-1">
                      {opportunity.ai_risk_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-red-900 flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Deal Stats */}
                <div className="rounded-lg border border-border p-3">
                  <SectionHeading>Deal Stats</SectionHeading>
                  <InfoGrid>
                    <InfoRow
                      label="Deal Value"
                      value={opportunity.deal_value != null && opportunity.deal_value > 0
                        ? `$${opportunity.deal_value.toLocaleString()}`
                        : null}
                    />
                    <InfoRow
                      label="Est. GCI"
                      value={opportunity.gci_estimated != null && opportunity.gci_estimated > 0
                        ? `$${opportunity.gci_estimated.toLocaleString()}`
                        : null}
                    />
                    <InfoRow
                      label="Expected Close"
                      value={opportunity.expected_close_date
                        ? format(new Date(opportunity.expected_close_date), 'MMM dd, yyyy')
                        : null}
                    />
                    <InfoRow
                      label="Days in Stage"
                      value={opportunity.days_in_current_stage > 0 ? `${opportunity.days_in_current_stage} days` : null}
                    />
                  </InfoGrid>
                </div>

                {/* Notes */}
                {opportunity.notes && (
                  <div className="rounded-lg border border-border p-3">
                    <SectionHeading>Notes</SectionHeading>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{opportunity.notes}</p>
                  </div>
                )}
              </TabsContent>

              {/* DEAL DETAILS */}
              <TabsContent value="deal" className="mt-4 space-y-4 focus-visible:outline-none">
                {/* Property */}
                {opportunity.property_address && (
                  <div className="rounded-lg border border-border p-3">
                    <SectionHeading>Property</SectionHeading>
                    <InfoGrid>
                      <div className="col-span-2">
                        <InfoRow label="Address" value={opportunity.property_address} />
                      </div>
                      <InfoRow
                        label="City / State"
                        value={[opportunity.property_city, opportunity.property_state].filter(Boolean).join(', ')}
                      />
                      <InfoRow label="Type" value={opportunity.property_type} />
                      <InfoRow label="Beds" value={opportunity.property_beds} />
                      <InfoRow label="Baths" value={opportunity.property_baths} />
                      <InfoRow label="Sq Ft" value={opportunity.property_sqft?.toLocaleString()} />
                      <InfoRow label="MLS #" value={opportunity.property_mls_number} />
                    </InfoGrid>
                  </div>
                )}

                {/* Financials */}
                <div className="rounded-lg border border-border p-3">
                  <SectionHeading>Financials</SectionHeading>
                  <InfoGrid>
                    <InfoRow
                      label="List Price"
                      value={opportunity.list_price ? `$${opportunity.list_price.toLocaleString()}` : null}
                    />
                    <InfoRow
                      label="Offer Price"
                      value={opportunity.offer_price ? `$${opportunity.offer_price.toLocaleString()}` : null}
                    />
                    <InfoRow
                      label="Sale Price"
                      value={opportunity.sale_price ? `$${opportunity.sale_price.toLocaleString()}` : null}
                    />
                    <InfoRow
                      label="Commission"
                      value={opportunity.commission_pct ? `${opportunity.commission_pct}%` : null}
                    />
                    <InfoRow
                      label="Est. GCI"
                      value={opportunity.gci_estimated ? `$${opportunity.gci_estimated.toLocaleString()}` : null}
                    />
                    <InfoRow
                      label="Actual GCI"
                      value={opportunity.gci_actual ? `$${opportunity.gci_actual.toLocaleString()}` : null}
                    />
                    <InfoRow
                      label="Referral Fee"
                      value={opportunity.referral_fee_pct ? `${opportunity.referral_fee_pct}%` : null}
                    />
                    <InfoRow label="Referral Agent" value={opportunity.referral_agent_name} />
                    <InfoRow label="Referral Brokerage" value={opportunity.referral_brokerage} />
                  </InfoGrid>
                </div>

                {/* Timeline */}
                <div className="rounded-lg border border-border p-3">
                  <SectionHeading>Timeline</SectionHeading>
                  <InfoGrid>
                    {opportunity.first_contact_date && (
                      <InfoRow
                        label="First Contact"
                        value={format(new Date(opportunity.first_contact_date), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.listing_appointment_date && (
                      <InfoRow
                        label="Listing Appt"
                        value={format(new Date(opportunity.listing_appointment_date), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.offer_date && (
                      <InfoRow
                        label="Offer Date"
                        value={format(new Date(opportunity.offer_date), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.contract_date && (
                      <InfoRow
                        label="Contract Date"
                        value={format(new Date(opportunity.contract_date), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.inspection_date && (
                      <InfoRow
                        label="Inspection"
                        value={format(new Date(opportunity.inspection_date), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.appraisal_date && (
                      <InfoRow
                        label="Appraisal"
                        value={format(new Date(opportunity.appraisal_date), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.closing_date_scheduled && (
                      <InfoRow
                        label="Closing Scheduled"
                        value={format(new Date(opportunity.closing_date_scheduled), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.actual_close_date && (
                      <InfoRow
                        label="Closed"
                        value={format(new Date(opportunity.actual_close_date), 'MMM dd, yyyy')}
                      />
                    )}
                    {opportunity.target_move_date && (
                      <InfoRow
                        label="Target Move"
                        value={format(new Date(opportunity.target_move_date), 'MMM dd, yyyy')}
                      />
                    )}
                  </InfoGrid>
                </div>
              </TabsContent>

              {/* TASKS */}
              <TabsContent value="tasks" className="mt-4 focus-visible:outline-none">
                <TasksTab opportunityId={opportunity.id} />
              </TabsContent>

              {/* ACTIVITY */}
              <TabsContent value="activity" className="mt-4 focus-visible:outline-none">
                <ActivityTab opportunityId={opportunity.id} />
              </TabsContent>

              {/* CONTACT */}
              <TabsContent value="contact" className="mt-4 space-y-4 focus-visible:outline-none">
                {opportunity.contact ? (
                  <>
                    {/* Basic info */}
                    <div className="rounded-lg border border-border p-3">
                      <SectionHeading>Contact Info</SectionHeading>
                      <InfoGrid>
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="text-base font-semibold text-foreground">{displayName}</span>
                          {opportunity.contact.dnc && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              <Shield className="h-2.5 w-2.5 mr-0.5" />
                              DNC
                            </Badge>
                          )}
                        </div>
                        <InfoRow label="Email" value={opportunity.contact.email} />
                        <InfoRow label="Phone" value={opportunity.contact.phone} />
                        <InfoRow label="Category" value={opportunity.contact.category} />
                        <InfoRow
                          label="Relationship Strength"
                          value={opportunity.contact.relationship_strength != null
                            ? <Stars value={opportunity.contact.relationship_strength} />
                            : null}
                        />
                        {opportunity.contact.pipeline_stage_summary && (
                          <div className="col-span-2">
                            <InfoRow label="Pipeline Summary" value={opportunity.contact.pipeline_stage_summary} />
                          </div>
                        )}
                      </InfoGrid>
                    </div>

                    {/* Buyer profile */}
                    {(opportunity.contact.buyer_pre_approval_status ||
                      opportunity.contact.buyer_price_min ||
                      opportunity.contact.buyer_price_max ||
                      opportunity.contact.buyer_lender_name) && (
                      <div className="rounded-lg border border-border p-3">
                        <SectionHeading>Buyer Profile</SectionHeading>
                        <InfoGrid>
                          <InfoRow label="Pre-Approval Status" value={opportunity.contact.buyer_pre_approval_status} />
                          <InfoRow label="Lender" value={opportunity.contact.buyer_lender_name} />
                          <InfoRow
                            label="Price Range"
                            value={
                              opportunity.contact.buyer_price_min || opportunity.contact.buyer_price_max
                                ? `$${(opportunity.contact.buyer_price_min ?? 0).toLocaleString()} — $${(opportunity.contact.buyer_price_max ?? 0).toLocaleString()}`
                                : null
                            }
                          />
                          <InfoRow label="Loan Type" value={opportunity.contact.buyer_loan_type} />
                          <InfoRow
                            label="Motivation Score"
                            value={opportunity.contact.motivation_score != null
                              ? <Stars value={opportunity.contact.motivation_score} />
                              : null}
                          />
                          <InfoRow label="Move Timeline" value={opportunity.contact.move_timeline} />
                        </InfoGrid>
                      </div>
                    )}

                    {/* Seller profile */}
                    {(opportunity.contact.seller_listing_timeline ||
                      opportunity.contact.seller_estimated_value) && (
                      <div className="rounded-lg border border-border p-3">
                        <SectionHeading>Seller Profile</SectionHeading>
                        <InfoGrid>
                          <InfoRow label="Listing Timeline" value={opportunity.contact.seller_listing_timeline} />
                          <InfoRow
                            label="Est. Property Value"
                            value={opportunity.contact.seller_estimated_value
                              ? `$${opportunity.contact.seller_estimated_value.toLocaleString()}`
                              : null}
                          />
                        </InfoGrid>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p className="text-sm">No contact information available</p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
