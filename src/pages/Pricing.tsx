import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Sparkles, Flame, Clock, CheckCircle } from 'lucide-react';
import { STRIPE_TIERS } from '@/config/stripe';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type BillingPeriod = 'monthly' | 'annual' | 'founder';

const Pricing = () => {
  const { user } = useAuth();
  const { subscribed, tier: currentTier, createCheckout, checkSubscription, loading: subLoading } = useSubscription();
  const [billing, setBilling] = useState<BillingPeriod>('founder');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const checkoutSuccess = searchParams.get('checkout') === 'success';

  // Handle ?checkout=success
  useEffect(() => {
    if (checkoutSuccess) {
      if (user) {
        // Authenticated user returning from checkout — refresh subscription
        checkSubscription();
      }
      // Clean up the URL param after showing the banner
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [checkoutSuccess, user]);

  const handleCheckout = async (tierKey: 'core' | 'managed') => {
    const tier = STRIPE_TIERS[tierKey];
    let priceId: string;
    if (billing === 'founder') {
      priceId = tier.founder.price_id;
    } else if (billing === 'annual') {
      priceId = tier.annual.price_id;
    } else {
      priceId = tier.monthly.price_id;
    }
    setCheckoutLoading(tierKey);
    try {
      await createCheckout(priceId);
    } catch (err: any) {
      toast({ title: 'Checkout error', description: err.message, variant: 'destructive' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const tiers = [
    { key: 'core' as const, ...STRIPE_TIERS.core, popular: false },
    { key: 'managed' as const, ...STRIPE_TIERS.managed, popular: true },
  ];

  const getPrice = (tier: typeof tiers[number]) => {
    if (billing === 'founder') return tier.founder.amount;
    if (billing === 'annual') return tier.annual.amount;
    return tier.monthly.amount;
  };

  const getPeriodLabel = () => {
    if (billing === 'founder') return ' / 6 months';
    if (billing === 'annual') return '/year';
    return '/month';
  };

  const content = (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      {/* Checkout success banner */}
      {checkoutSuccess && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              Payment successful! Your subscription is now active.
            </p>
          </div>
          <p className="text-xs text-green-700">
            Check your email for a link to set your password and sign in to your dashboard.
          </p>
        </div>
      )}

      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Get the tools you need to grow your real estate business with purpose.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {(['monthly', 'annual', 'founder'] as BillingPeriod[]).map((period) => (
          <Button
            key={period}
            variant={billing === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBilling(period)}
            className="relative"
          >
            {period === 'monthly' && 'Monthly'}
            {period === 'annual' && 'Annual'}
            {period === 'founder' && (
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                Founder (6-Mo)
              </span>
            )}
          </Button>
        ))}
        {billing === 'annual' && (
          <Badge variant="secondary" className="text-xs">Save 2 months</Badge>
        )}
      </div>

      {/* Founder banner */}
      {billing === 'founder' && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center space-y-1">
          <p className="text-sm font-semibold text-primary flex items-center justify-center gap-2">
            <Flame className="h-4 w-4" />
            Founder Plans — Limited to the First 50 Members
          </p>
          <p className="text-xs text-muted-foreground">
            Lock in a discounted 6-month rate. After 6 months, your plan automatically
            continues at the regular monthly price.
          </p>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {tiers.map((tier) => {
          const isCurrentPlan = subscribed && currentTier === tier.key;
          const price = getPrice(tier);
          const period = getPeriodLabel();
          const isFounder = billing === 'founder';

          return (
            <Card
              key={tier.key}
              className={`relative flex flex-col ${
                tier.popular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''
              }`}
            >
              {tier.popular && !isFounder && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Sparkles className="h-3 w-3 mr-1" /> Most Popular
                  </Badge>
                </div>
              )}
              {isFounder && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-destructive text-destructive-foreground border-destructive">
                    <Flame className="h-3 w-3 mr-1" /> Founder — Limited
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${price.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">{period}</span>
                </CardDescription>
                {billing === 'annual' && (
                  <p className="text-xs text-muted-foreground">
                    (${Math.round(price / 12)}/mo equivalent)
                  </p>
                )}
                {isFounder && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    Then ${tier.monthly.amount}/mo after 6 months
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-6">
                <ul className="space-y-3 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={tier.popular || isFounder ? 'default' : 'outline'}
                  disabled={isCurrentPlan || !!checkoutLoading || subLoading}
                  onClick={() => handleCheckout(tier.key)}
                >
                  {checkoutLoading === tier.key && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {isCurrentPlan
                    ? 'Your Current Plan'
                    : isFounder
                      ? `Get ${tier.name} Founder Plan`
                      : `Get ${tier.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sign-in link for existing users */}
      {!user && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/auth')}
              className="text-primary font-medium hover:underline"
            >
              Sign in here
            </button>
          </p>
        </div>
      )}
    </div>
  );

  // Wrap in Layout only for authenticated users
  if (user) {
    return <Layout>{content}</Layout>;
  }

  // Standalone page for unauthenticated visitors
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
        {content}
      </div>
    </div>
  );
};

export default Pricing;
