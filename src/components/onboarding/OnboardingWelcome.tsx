import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles, LayoutDashboard, Users, RefreshCw, Trophy,
  Mail, Settings, ChevronRight, ChevronLeft, X, ArrowRight
} from 'lucide-react';

interface OnboardingWelcomeProps {
  userName?: string;
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to the Hub!',
    description:
      "This is your command center for building and maintaining your real estate business through intentional relationship management. Let's walk through everything the platform offers so you can hit the ground running.",
    cta: null,
  },
  {
    icon: LayoutDashboard,
    title: 'Your Dashboard',
    description:
      "Your dashboard has 5 blocks that update automatically:\n\n• **Weekly Impact** — Total touchpoints and unique contacts reached across calls, texts, emails, social posts, and events.\n• **Weekly Tasks** — Everything due this week, grouped by system (SphereSync, Events, Newsletter, and more).\n• **Transaction Opportunity** — A business calculator showing your database's earning potential using a contacts ÷ 6 benchmark.\n• **Performance Trends** — Your weekly completion percentage with an 8-week trend line so you can track momentum.\n• **Accountability Center** — Overdue tasks and a 0–100 Accountability Score based on the last 4 weeks.",
    cta: null,
  },
  {
    icon: Users,
    title: 'Your Database',
    description:
      "Your database is the foundation of everything. Add your sphere of influence — past clients, friends, family, colleagues, and anyone you want to stay in touch with. The platform generates personalized outreach tasks based on who's in your database.\n\nYou can add contacts one-by-one or upload a CSV. Your Core plan supports up to 500 contacts.",
    cta: { label: 'Add Your First Contacts', path: '/database' },
  },
  {
    icon: RefreshCw,
    title: 'SphereSync',
    description:
      "SphereSync is your weekly outreach engine. Each week, it assigns you calls and texts to specific contacts based on a rotating category system — so every person in your sphere hears from you regularly.\n\n• Calls are assigned on specific days of the week\n• Texts go out mid-week\n• New tasks auto-generate every Monday\n\nThe more contacts you add, the more SphereSync has to work with. Complete your tasks each week to stay top-of-mind with your sphere.",
    cta: { label: 'View SphereSync Tasks', path: '/spheresync-tasks' },
  },
  {
    icon: Trophy,
    title: 'Success Scoreboard',
    description:
      "Every week, submit your Success Scoreboard to track your key activities: conversations held, appointments set, agreements signed, closings, and database growth.\n\n**Your goal: 25 conversations per week.**\n\nThe scoreboard feeds your dashboard metrics and builds your performance streak. It's the heartbeat of your accountability system — the more consistently you submit, the clearer your growth trajectory becomes.",
    cta: { label: 'Submit Your First Check-In', path: '/coaching' },
  },
  {
    icon: Mail,
    title: 'E-Newsletter',
    description:
      "Send a monthly newsletter to your database to stay visible and provide value. Use the drag-and-drop builder to create branded emails with market updates, personal notes, listing highlights, and calls to action.\n\nYour newsletter is one of the most powerful tools for passive lead generation — it keeps you top-of-mind even when you're not actively reaching out.",
    cta: { label: 'Explore Newsletter', path: '/newsletter' },
  },
  {
    icon: Settings,
    title: 'Complete Your Profile',
    description:
      "Head to Settings to fill in your name, brokerage, license info, and photo. This information is used in your newsletter templates, email signatures, and across the platform.\n\nYou can also manage your subscription and billing from the Settings page.",
    cta: { label: 'Complete Your Profile', path: '/settings' },
  },
];

export function OnboardingWelcome({ userName, onDismiss }: OnboardingWelcomeProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 relative overflow-hidden">
      {/* dismiss */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition z-10"
        aria-label="Dismiss onboarding"
      >
        <X className="h-5 w-5" />
      </button>

      <CardContent className="pt-6 pb-6 space-y-5">
        {/* progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Step {step + 1} of {STEPS.length}
          </span>
          <Progress value={progress} className="h-2 flex-1" />
        </div>

        {/* content */}
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3 shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2 min-w-0">
            <h2 className="text-xl font-bold tracking-tight">
              {step === 0 && userName
                ? `Welcome to the Hub, ${userName}!`
                : current.title}
            </h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line prose-strong:text-foreground">
              {current.description.split(/(\*\*[^*]+\*\*)/).map((seg, i) =>
                seg.startsWith('**') && seg.endsWith('**') ? (
                  <strong key={i} className="text-foreground font-semibold">
                    {seg.slice(2, -2)}
                  </strong>
                ) : (
                  <span key={i}>{seg}</span>
                ),
              )}
            </div>
          </div>
        </div>

        {/* CTA + navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div>
            {current.cta && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(current.cta!.path)}
              >
                {current.cta.label} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onDismiss}>
                Get Started! <Sparkles className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
