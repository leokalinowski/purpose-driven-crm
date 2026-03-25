import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Mail, KeyRound, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useConfetti } from '@/hooks/useConfetti';

const Welcome = () => {
  const { user } = useAuth();
  const { checkSubscription } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { triggerCelebration } = useConfetti();

  const checkoutSuccess = searchParams.get('checkout') === 'success';

  useEffect(() => {
    triggerCelebration();
  }, []);

  useEffect(() => {
    if (checkoutSuccess && user) {
      checkSubscription();
    }
    if (checkoutSuccess) {
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [checkoutSuccess, user]);

  const steps = [
    { icon: Mail, label: 'Check Your Email', desc: 'Look for your welcome email with login instructions' },
    { icon: KeyRound, label: 'Set Your Password', desc: 'Click the link to create your secure password' },
    { icon: LayoutDashboard, label: 'Explore Your Dashboard', desc: 'Start building your business with purpose' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4">
        <div className="flex justify-center pt-6 pb-2">
          <img
            src="https://cguoaokqwgqvzkqqezcq.supabase.co/storage/v1/object/public/assets/logos/reop-logo-full.png"
            alt="Real Estate on Purpose"
            className="h-14 w-auto object-contain"
          />
        </div>
        <div className="max-w-lg mx-auto py-12 text-center space-y-6 animate-fade-in">
          {/* Pulsing success icon */}
          <div className="mx-auto w-24 h-24 rounded-full bg-green-100 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_3]">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>

          {/* "You're In!" badge */}
          <Badge className="bg-primary text-primary-foreground text-sm px-4 py-1.5 font-bold tracking-wide uppercase">
            🎉 You're In!
          </Badge>

          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
            Welcome to Real Estate on Purpose!
          </h1>

          <p className="text-lg text-primary font-medium italic">
            Your journey to purposeful real estate starts now.
          </p>

          <p className="text-muted-foreground">
            Your subscription is now active. You're all set to start growing your business with purpose.
          </p>

          {/* What's Next guide */}
          {!user && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 text-left space-y-4">
              <h3 className="text-lg font-bold text-foreground text-center">What's Next?</h3>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                        <step.icon className="h-4 w-4 text-primary" />
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email notice */}
          {!user && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center justify-center gap-2">
                <Mail className="h-4 w-4 text-amber-600" />
                Check your email
              </p>
              <p>
                We've sent you a link to set your password and sign in to your dashboard.
                Be sure to check your spam folder if you don't see it.
              </p>
            </div>
          )}

          <div className="pt-4">
            {user ? (
              <Button size="lg" className="text-base px-8 py-3 font-bold" onClick={() => navigate('/')}>
                Go to Dashboard →
              </Button>
            ) : (
              <Button size="lg" className="text-base px-8 py-3 font-bold" onClick={() => navigate('/auth')}>
                Sign In to Your Dashboard →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
