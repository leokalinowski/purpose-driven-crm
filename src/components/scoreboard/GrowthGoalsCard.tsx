/**
 * GrowthGoalsCard — the "Active growth goals" aside from coaching.html.
 *
 * Multi-row, agent-editable list of qualitative goals. Each goal shows:
 *   - Title (bold)
 *   - Target / current line ("March: 14 of 25 · on pace") or due date
 *   - Optional progress bar when target_value + current_value are set
 *
 * Inline + / edit / delete UI uses a Sheet for the editor to stay focused.
 * No goals yet → shows an empty-state CTA.
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Check, X, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { useGrowthGoals, type GrowthGoal, type GrowthGoalDraft } from '@/hooks/useGrowthGoals';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function GrowthGoalsCard() {
  const { goals, loading, create, update, remove } = useGrowthGoals();
  const [editing, setEditing] = useState<GrowthGoal | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <aside className="bg-card border border-border rounded-[14px] p-6">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold tracking-[-0.01em] flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Active growth goals
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className="gap-1 -mr-2 h-8">
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
      <p className="text-[12.5px] text-muted-foreground mb-4">
        Set together with your Coach. Distinct from your annual numbers in Settings → Goals.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground mb-3">
            No active growth goals yet. Set 2–4 to shape what the Coach watches.
          </p>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add your first goal
          </Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} onEdit={() => setEditing(g)} />
          ))}
        </ul>
      )}

      <GoalEditor
        open={creating || !!editing}
        goal={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onCreate={async (draft) => create(draft).then((g) => !!g)}
        onUpdate={async (id, patch) => update(id, patch)}
        onRemove={async (id) => remove(id)}
      />
    </aside>
  );
}

// ── Row ────────────────────────────────────────────────────────────────

function GoalRow({ goal, onEdit }: { goal: GrowthGoal; onEdit: () => void }) {
  const hasBar = goal.target_value != null && goal.target_value > 0;
  const pct = hasBar
    ? Math.min(100, Math.round((goal.current_value / goal.target_value!) * 100))
    : null;
  const formatVal = (n: number) =>
    goal.unit ? `${n.toLocaleString()} ${goal.unit}` : n.toLocaleString();

  const subParts: string[] = [];
  if (hasBar) {
    subParts.push(`${formatVal(goal.current_value)} of ${formatVal(goal.target_value!)}`);
  }
  if (goal.target_date) {
    const d = new Date(goal.target_date);
    subParts.push(`Target: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
  }
  if (goal.status === 'paused') subParts.push('Paused');
  if (goal.status === 'completed') subParts.push('✓ Completed');

  return (
    <li
      className={cn(
        'rounded-[10px] border border-border px-3.5 py-3 hover:border-primary/40 transition cursor-pointer group',
        goal.status === 'completed' && 'opacity-70',
      )}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold leading-snug text-reop-dark-blue">
            {goal.title}
          </div>
          {subParts.length > 0 && (
            <div className="text-[11.5px] text-muted-foreground mt-0.5">
              {subParts.join(' · ')}
            </div>
          )}
        </div>
        <Pencil className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
      </div>
      {hasBar && pct != null && (
        <div className="mt-2 h-1.5 bg-[hsl(210_20%_92%)] rounded-full overflow-hidden">
          <span
            className={cn(
              'block h-full rounded-full',
              pct >= 100 ? 'bg-reop-green' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </li>
  );
}

// ── Editor sheet ───────────────────────────────────────────────────────

interface EditorProps {
  open: boolean;
  goal: GrowthGoal | null;
  onClose: () => void;
  onCreate: (draft: GrowthGoalDraft) => Promise<boolean>;
  onUpdate: (id: string, patch: Partial<GrowthGoalDraft>) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

function GoalEditor({ open, goal, onClose, onCreate, onUpdate, onRemove }: EditorProps) {
  const { toast } = useToast();
  const isEdit = !!goal;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [unit, setUnit] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<GrowthGoal['status']>('active');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Hydrate on open.
  function hydrate() {
    setTitle(goal?.title ?? '');
    setDescription(goal?.description ?? '');
    setTargetValue(goal?.target_value != null ? String(goal.target_value) : '');
    setCurrentValue(goal?.current_value != null ? String(goal.current_value) : '');
    setUnit(goal?.unit ?? '');
    setTargetDate(goal?.target_date ?? '');
    setStatus(goal?.status ?? 'active');
  }

  if (open && (title === '' && !isEdit) && !saving && !removing) {
    // Reset draft when creating fresh.
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      onClose();
      // Reset between opens.
      setTitle(''); setDescription(''); setTargetValue(''); setCurrentValue('');
      setUnit(''); setTargetDate(''); setStatus('active');
    } else {
      hydrate();
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Give your goal a name.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const draft: GrowthGoalDraft = {
      title: title.trim(),
      description: description.trim() || null,
      target_value: targetValue.trim() === '' ? null : Number(targetValue),
      current_value: currentValue.trim() === '' ? 0 : Number(currentValue),
      unit: unit.trim() || null,
      target_date: targetDate || null,
      status,
    };
    const ok = isEdit
      ? await onUpdate(goal!.id, draft)
      : await onCreate(draft);
    setSaving(false);
    if (ok) {
      toast({ title: isEdit ? 'Goal updated' : 'Goal added' });
      onClose();
    } else {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  }

  async function handleRemove() {
    if (!goal) return;
    if (!confirm('Archive this goal? It moves out of the active list but stays in your history.')) return;
    setRemoving(true);
    const ok = await onRemove(goal.id);
    setRemoving(false);
    if (ok) {
      toast({ title: 'Goal archived' });
      onClose();
    } else {
      toast({ title: 'Could not archive', variant: 'destructive' });
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit growth goal' : 'New growth goal'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update title, progress, or status. Archive to remove from the active list.'
              : 'Set a goal. Add a numeric target if you want a progress bar.'}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 py-5">
          <div>
            <Label htmlFor="g-title" className="text-[12px] font-semibold">Title</Label>
            <Input
              id="g-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Send 25 handwritten notes/month"
              maxLength={200}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="g-desc" className="text-[12px] font-semibold">Description (optional)</Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why does this goal matter to you?"
              rows={2}
              className="mt-1.5 resize-y"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <Label htmlFor="g-curr" className="text-[12px] font-semibold">Current</Label>
              <Input
                id="g-curr"
                type="number"
                inputMode="numeric"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="g-target" className="text-[12px] font-semibold">Target</Label>
              <Input
                id="g-target"
                type="number"
                inputMode="numeric"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="25"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="g-unit" className="text-[12px] font-semibold">Unit</Label>
              <Input
                id="g-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="notes"
                maxLength={30}
                className="mt-1.5"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Leave target blank for a qualitative goal (no progress bar).
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <Label htmlFor="g-date" className="text-[12px] font-semibold">Target date</Label>
              <Input
                id="g-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="g-status" className="text-[12px] font-semibold">Status</Label>
              <select
                id="g-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as GrowthGoal['status'])}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={removing || saving}
              className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200"
            >
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Archive
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || removing}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || removing} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isEdit ? 'Save changes' : 'Create goal'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
