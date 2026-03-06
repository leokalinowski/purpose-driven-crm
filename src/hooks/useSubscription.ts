import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getTierFromPriceId } from '@/config/stripe';

interface SubscriptionState {
  subscribed: boolean;
  tier: 'core' | 'managed' | null;
  priceId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  testMode: boolean;
}

export function useSubscription() {
  const { user, session } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: null,
    priceId: null,
    subscriptionEnd: null,
    loading: true,
    testMode: false,
  });

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setState((s) => ({ ...s, subscribed: false, tier: null, priceId: null, subscriptionEnd: null, loading: false }));
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;

      const isTestMode = !!data?.test_mode;
      const tier = data?.price_id ? getTierFromPriceId(data.price_id, isTestMode) : null;

      setState({
        subscribed: !!data?.subscribed,
        tier,
        priceId: data?.price_id ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
        loading: false,
        testMode: isTestMode,
      });
    } catch (err) {
      console.error('[useSubscription] Error checking subscription:', err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, [session?.access_token]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const createCheckout = async (priceId: string) => {
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { priceId },
      headers,
    });
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
  };

  const openCustomerPortal = async () => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('customer-portal', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
  };

  return {
    ...state,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
