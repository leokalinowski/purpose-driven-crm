import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { STRIPE_TIERS } from '@/config/stripe';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const Pricing = () => {
  const { user } = useAuth();
  const { subscribed, tier: currentTier, createCheckout, loading: subLoading } = useSubscription();
  const [annual, setAnnual] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleCheckout = async (tierKey: 'core' | 'managed') => {
    if (!user) {
      toast({ title: 'Please sign in first', variant: 'destructive' });
      return;
    }
    const tier = STRIPE_TIERS[tierKey];
    const priceId = annual ? tier.annual.price_id : tier.monthly.price_id;
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Get the tools you need to grow your real estate business with purpose.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <Label htmlFor="billing-toggle" className={!annual ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
            Monthly
          </Label>
          <Switch id="billing-toggle" checked={annual} onCheckedChange={setAnnual} />
          <Label htmlFor="billing-toggle" className={annual ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
            Annual
          </Label>
          {annual && (
            <Badge variant="secondary" className="ml-2 text-xs">Save 2 months</Badge>
          )}
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {tiers.map((tier) => {
            const isCurrentPlan = subscribed && currentTier === tier.key;
            const price = annual ? tier.annual.amount : tier.monthly.amount;
            const period = annual ? '/year' : '/month';

            return (
              <Card
                key={tier.key}
                className={`relative flex flex-col ${
                  tier.popular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Sparkles className="h-3 w-3 mr-1" /> Most Popular
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
                  {annual && (
                    <p className="text-xs text-muted-foreground">
                      (${Math.round(price / 12)}/mo equivalent)
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
                    variant={tier.popular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || !!checkoutLoading || subLoading}
                    onClick={() => handleCheckout(tier.key)}
                  >
                    {checkoutLoading === tier.key && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {isCurrentPlan ? 'Your Current Plan' : `Get ${tier.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Pricing;
