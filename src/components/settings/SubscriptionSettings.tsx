import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, ExternalLink } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { STRIPE_TIERS, getTierFromPriceId } from '@/config/stripe';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const SubscriptionSettings = () => {
  const { subscribed, tier, priceId, subscriptionEnd, loading, openCustomerPortal, checkSubscription } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkSubscription();
    setRefreshing(false);
    toast({ title: 'Subscription status refreshed' });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const tierConfig = tier ? STRIPE_TIERS[tier] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>Manage your billing and subscription plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscribed && tierConfig ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Current Plan:</span>
              <Badge variant="default">{tierConfig.name}</Badge>
            </div>
            {subscriptionEnd && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Renews:</span>
                <span className="text-sm font-medium">
                  {new Date(subscriptionEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handlePortal} disabled={portalLoading}>
                {portalLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Billing
              </Button>
              <Button variant="ghost" onClick={handleRefresh} disabled={refreshing}>
                {refreshing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Refresh Status
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You don't have an active subscription.
            </p>
            <Button onClick={() => navigate('/pricing')}>View Plans</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
