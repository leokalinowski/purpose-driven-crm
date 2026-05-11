import { useEffect, useState } from 'react';
import {
  ClipboardList,
  X,
  Phone,
  MessageSquare,
  Mail,
  Users,
  FileText,
  CalendarPlus,
  Check,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type TouchType = 'call' | 'text' | 'email' | 'in-person' | 'note';

const types: { key: TouchType; label: string; icon: LucideIcon }[] = [
  { key: 'call', label: 'Call', icon: Phone },
  { key: 'text', label: 'Text', icon: MessageSquare },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'in-person', label: 'In person', icon: Users },
  { key: 'note', label: 'Note', icon: FileText },
];

const durations = ['Under 2 min', '2–5 min', '5–15 min', '15–30 min', '30+ min'];
const outcomes = [
  'Reached — good conversation',
  'Reached — quick check-in',
  'Left voicemail',
  'No answer',
  'Appointment set',
  'Referral received',
];

type Props = {
  open: boolean;
  contactName?: string;
  onClose: () => void;
};

export function LogTouchModal({ open, contactName, onClose }: Props) {
  const [type, setType] = useState<TouchType>('call');
  const [duration, setDuration] = useState(durations[2]);
  const [outcome, setOutcome] = useState(outcomes[0]);
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followTask, setFollowTask] = useState('');
  const [followDate, setFollowDate] = useState('');

  useEffect(() => {
    if (open) {
      setFollowTask(contactName ? `Follow up with ${contactName}` : 'Follow up');
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setFollowDate(d.toISOString().slice(0, 10));
    }
  }, [open, contactName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    onClose();
    toast.success('Touch logged — contact updated.', {
      icon: <CheckCircle2 className="w-4 h-4 text-reop-green" />,
    });
    setNotes('');
    setFollowUp(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/30"
    >
      <div className="bg-white rounded-2xl w-[520px] max-w-full shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-reop-teal-soft text-primary flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold text-primary">Log Touch</div>
            <div className="text-base font-semibold tracking-[-0.01em] text-reop-dark-blue">
              {contactName ? `Log touch — ${contactName}` : 'Log a touchpoint'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-[30px] h-[30px] rounded-md border border-border bg-white flex items-center justify-center text-muted-foreground hover:bg-muted"
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <div className="text-xs font-semibold text-reop-dark-blue mb-2">Type of touch</div>
            <div className="flex gap-2 flex-wrap">
              {types.map((t) => {
                const Icon = t.icon;
                const active = type === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] transition-all',
                      active
                        ? 'border-2 border-primary bg-[hsl(184_100%_98%)] text-primary font-semibold'
                        : 'border-[1.5px] border-border bg-white text-reop-dark-blue font-medium hover:border-primary/40',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {type === 'call' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-reop-dark-blue">Duration</span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-10 px-3 border border-border rounded-lg text-sm bg-white"
                >
                  {durations.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-reop-dark-blue">Outcome</span>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="h-10 px-3 border border-border rounded-lg text-sm bg-white"
                >
                  {outcomes.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-reop-dark-blue">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you talk about? Any signals, next steps, or things to remember…"
              className="w-full min-h-[90px] border border-border rounded-lg px-3 py-2.5 text-sm text-reop-dark-blue resize-none leading-relaxed"
            />
          </label>

          <div className="px-4 py-3.5 bg-[hsl(210_20%_97%)] rounded-[10px] border border-border">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-reop-dark-blue">
                <CalendarPlus className="w-3.5 h-3.5 text-primary" />
                Create follow-up task?
              </div>
              <button
                onClick={() => setFollowUp(!followUp)}
                aria-pressed={followUp}
                className={cn(
                  'ml-auto w-9 h-5 rounded-full relative transition-colors',
                  followUp ? 'bg-primary' : 'bg-[hsl(210_20%_88%)]',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform',
                    followUp && 'translate-x-4',
                  )}
                />
              </button>
            </div>
            {followUp && (
              <div className="grid grid-cols-[1fr_auto] gap-2.5 items-center">
                <input
                  value={followTask}
                  onChange={(e) => setFollowTask(e.target.value)}
                  placeholder="Task description…"
                  className="h-[38px] px-3 border border-border rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={followDate}
                  onChange={(e) => setFollowDate(e.target.value)}
                  className="h-[38px] px-3 border border-border rounded-lg text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-[hsl(210_20%_98%)] flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            className="h-10 px-4 border border-border rounded-lg bg-white text-sm font-semibold text-reop-dark-blue hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="h-10 px-4 bg-primary text-white border-0 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
          >
            <Check className="w-3.5 h-3.5" />
            Save touch
          </button>
        </div>
      </div>
    </div>
  );
}
