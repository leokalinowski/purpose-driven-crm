/**
 * JumpBackIn — the shortcuts panel at the bottom of the Dashboard.
 *
 * Tiles match the design reference exactly: icon + 2-line label
 * (title + category sub). Auto-fill grid `minmax(190px, 1fr)` packs
 * however many shortcuts the agent has access to.
 *
 * Layout reference: design/dashboard-v2.html .shortcuts-panel.
 */

import { Link } from 'react-router-dom';
import {
  Users,
  Mail,
  KanbanSquare,
  Gift,
  GraduationCap,
  Briefcase,
  Zap,
} from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface Shortcut {
  icon: typeof Users;
  title: string;
  sub: string;
  to: string;
}

const SHORTCUTS: Shortcut[] = [
  { icon: Users,         title: 'Call priority queue', sub: 'SphereSync',            to: '/spheresync-tasks' },
  { icon: Mail,          title: 'Compose newsletter',  sub: 'E-Newsletter',          to: '/newsletter' },
  { icon: KanbanSquare,  title: 'Update pipeline',     sub: 'Pipeline',              to: '/pipeline' },
  { icon: Gift,          title: 'Send delight',        sub: 'Surprise & Delight',    to: '/delight' },
  { icon: GraduationCap, title: 'Weekly coaching',     sub: 'Coaching',              to: '/scoreboard' },
  { icon: Briefcase,     title: 'Transactions',        sub: 'Active files',          to: '/transactions' },
];

export function JumpBackIn() {
  const { hasAccess } = useFeatureAccess();
  const visible = SHORTCUTS.filter((s) => hasAccess(s.to));

  return (
    <section className="bg-card border border-border rounded-[16px] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] inline-flex items-center gap-2 text-reop-dark-blue">
          <Zap className="w-3.5 h-3.5 text-primary" />
          Jump back in
        </h3>
      </div>
      <div
        className="p-5 grid gap-2.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
      >
        {visible.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group flex items-center gap-2.5 px-3.5 py-3 rounded-[12px] border border-border bg-[hsl(210_20%_99%)] text-reop-dark-blue text-[13px] font-semibold transition hover:border-primary hover:bg-reop-teal-soft hover:text-primary hover:-translate-y-0.5 hover:shadow-[0_4px_12px_hsl(var(--reop-teal)/0.10)]"
          >
            <s.icon className="w-[15px] h-[15px] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{s.title}</div>
              <span className="text-[12px] text-muted-foreground font-normal block mt-px truncate group-hover:text-primary/70 transition">
                {s.sub}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
