import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles, LayoutDashboard, Users, RefreshCw, Trophy,
  Mail, Settings, ChevronRight, ChevronLeft, X, ArrowRight, BookOpen
} from 'lucide-react';

interface OnboardingWelcomeProps {
  userName?: string;
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to the Hub!',
    subtitle: 'Your command center for intentional growth',
    description:
      "This is your command center for building and maintaining your real estate business through intentional relationship management. Let's walk through everything the platform offers so you can hit the ground running.",
    cta: null,
  },
  {
    icon: LayoutDashboard,
    title: 'Your Dashboard',
    subtitle: 'Everything you need at a glance',
    description:
      "Your dashboard has 5 blocks that update automatically:\n\n• **Weekly Impact** — Total touchpoints and unique contacts reached across calls, texts, emails, social posts, and events.\n• **Weekly Tasks** — Everything due this week, grouped by system (SphereSync, Events, Newsletter, and more).\n• **Transaction Opportunity** — A business calculator showing your database's earning potential using a contacts ÷ 6 benchmark.\n• **Performance Trends** — Your weekly completion percentage with an 8-week trend line so you can track momentum.\n• **Accountability Center** — Overdue tasks and a 0–100 Accountability Score based on the last 4 weeks.",
    cta: null,
  },
  {
    icon: Users,
    title: 'Your Database',
    subtitle: 'The foundation of your business',
    description:
      "Your database is the foundation of everything. Add your sphere of influence — past clients, friends, family, colleagues, and anyone you want to stay in touch with. The platform generates personalized outreach tasks based on who's in your database.\n\nYou can add contacts one-by-one or upload a CSV. Your Core plan supports up to 500 contacts.",
    cta: { label: 'Add Your First Contacts', path: '/database' },
  },
  {
    icon: RefreshCw,
    title: 'SphereSync',
    subtitle: 'Your weekly outreach engine',
    description:
      "SphereSync is your weekly outreach engine. Each week, it assigns you calls and texts to specific contacts based on a rotating category system — so every person in your sphere hears from you regularly.\n\n• Calls are assigned on specific days of the week\n• Texts go out mid-week\n• New tasks auto-generate every Monday\n\nThe more contacts you add, the more SphereSync has to work with. Complete your tasks each week to stay top-of-mind with your sphere.",
    cta: { label: 'View SphereSync Tasks', path: '/spheresync-tasks' },
  },
  {
    icon: Trophy,
    title: 'Success Scoreboard',
    subtitle: 'Track your weekly wins',
    description:
      "Every week, submit your Success Scoreboard to track your key activities: conversations held, appointments set, agreements signed, closings, and database growth.\n\n**Your goal: 25 conversations per week.**\n\nThe scoreboard feeds your dashboard metrics and builds your performance streak. It's the heartbeat of your accountability system — the more consistently you submit, the clearer your growth trajectory becomes.",
    cta: { label: 'Submit Your First Check-In', path: '/coaching' },
  },
  {
    icon: Mail,
    title: 'E-Newsletter',
    subtitle: 'Stay visible without lifting a finger',
    description:
      "Send a monthly newsletter to your database to stay visible and provide value. Use the drag-and-drop builder to create branded emails with market updates, personal notes, listing highlights, and calls to action.\n\nYour newsletter is one of the most powerful tools for passive lead generation — it keeps you top-of-mind even when you're not actively reaching out.",
    cta: { label: 'Explore Newsletter', path: '/newsletter' },
  },
  {
    icon: Settings,
    title: 'Complete Your Profile',
    subtitle: 'Personalize your platform experience',
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
    <div className="space-y-2">
      {/* Prominent badge above card */}
      <div className="flex items-center gap-2">
        <Badge className="bg-primary text-primary-foreground font-bold text-xs tracking-widest uppercase px-3 py-1 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_3]">
          <BookOpen className="h-3 w-3 mr-1" />
          Getting Started
        </Badge>
        <span className="text-xs text-muted-foreground">Complete this guide to set up your account</span>
      </div>

      <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden shadow-[0_0_20px_hsl(var(--primary)/0.1)]">
        {/* Decorative ribbon */}
        <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-br-lg tracking-wider uppercase">
          Setup Guide
        </div>

        {/* dismiss */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition z-10"
          aria-label="Dismiss onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        <CardContent className="pt-8 pb-6 space-y-5">
          {/* progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Step {step + 1} of {STEPS.length}
            </span>
            <Progress value={progress} className="h-2.5 flex-1" />
          </div>

          {/* content with animation key */}
          <div key={step} className="flex items-start gap-4 animate-fade-in">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-4 shrink-0 shadow-sm">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2 min-w-0">
              <h2 className="text-2xl font-extrabold tracking-tight">
                {step === 0 && userName
                  ? `Welcome to the Hub, ${userName}!`
                  : current.title}
              </h2>
              {current.subtitle && (
                <p className="text-sm font-medium text-primary italic">{current.subtitle}</p>
              )}
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
                  size="default"
                  onClick={() => navigate(current.cta!.path)}
                  className="font-semibold"
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
                <Button size="default" className="font-bold" onClick={onDismiss}>
                  Get Started! <Sparkles className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button size="default" onClick={() => setStep(step + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
