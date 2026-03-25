import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

/**
 * Founder plan configuration — live and test mode.
 */
const FOUNDER_PLANS_LIVE: Record<
  string,
  { tier: string; productId: string; amountCents: number; monthlyPriceId: string }
> = {
  "price_1T82T9QGA8aVyaHSx4NYVQCl": {
    tier: "core",
    productId: "prod_U6Ex7tgKBZtZc5",
    amountCents: 99700,
    monthlyPriceId: "price_1T809vQGA8aVyaHSqHxPGZVH",
  },
  "price_1T82UbQGA8aVyaHSwPJgIqXm": {
    tier: "managed",
    productId: "prod_U6Eyw4OBAEIm9V",
    amountCents: 299700,
    monthlyPriceId: "price_1T80CiQGA8aVyaHSTcBId8Ss",
  },
};

const FOUNDER_PLANS_TEST: Record<
  string,
  { tier: string; productId: string; amountCents: number; monthlyPriceId: string }
> = {
  "price_1T87JeQGA8aVyaHSYcaEONPJ": {
    tier: "core",
    productId: "prod_U6Jx3oB19agtnz",
    amountCents: 99700,
    monthlyPriceId: "price_1T87J0QGA8aVyaHS7vCe7Fw8",
  },
  "price_1T87KlQGA8aVyaHSN5VInftx": {
    tier: "managed",
    productId: "prod_U6JydMsJcVubkF",
    amountCents: 299700,
    monthlyPriceId: "price_1T87JzQGA8aVyaHSBCJ7pzWT",
  },
};

/** Map standard price IDs to their tier — live and test */
const STANDARD_PRICE_TIERS_LIVE: Record<string, string> = {
  "price_1T809vQGA8aVyaHSqHxPGZVH": "core",
  "price_1T80BTQGA8aVyaHSwA5MG8Wx": "core",
  "price_1T80CiQGA8aVyaHSTcBId8Ss": "managed",
  "price_1T80DBQGA8aVyaHSXggTaq9Z": "managed",
};

const STANDARD_PRICE_TIERS_TEST: Record<string, string> = {
  "price_1T87J0QGA8aVyaHS7vCe7Fw8": "core",
  "price_1T87JNQGA8aVyaHS0fReVKmL": "core",
  "price_1T87JzQGA8aVyaHSBCJ7pzWT": "managed",
  "price_1T87KUQGA8aVyaHSnpM40Lh3": "managed",
};

async function getOrCreateSixMonthPrice(
  stripe: Stripe,
  productId: string,
  amountCents: number
): Promise<string> {
  const existing = await stripe.prices.list({ product: productId, active: true, limit: 20 });
  const match = existing.data.find(
    (p: any) =>
      p.recurring?.interval === "month" &&
      p.recurring?.interval_count === 6 &&
      p.unit_amount === amountCents
  );
  if (match) {
    logStep("Found existing 6-month price", { priceId: match.id });
    return match.id;
  }

  const newPrice = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: "usd",
    recurring: { interval: "month", interval_count: 6 },
  });
  logStep("Created new 6-month price", { priceId: newPrice.id });
  return newPrice.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const isTestMode = stripeKey.startsWith("sk_test_");
    logStep("Mode detected", { isTestMode });

    // Select the correct ID maps based on mode
    const FOUNDER_PLANS = isTestMode ? FOUNDER_PLANS_TEST : FOUNDER_PLANS_LIVE;
    const STANDARD_PRICE_TIERS = isTestMode ? STANDARD_PRICE_TIERS_TEST : STANDARD_PRICE_TIERS_LIVE;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://hub.realestateonpurpose.com";

    // Determine if user is authenticated
    const authHeader = req.headers.get("Authorization");
    let user: { id: string; email: string } | null = null;

    if (authHeader && authHeader !== "Bearer ") {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      if (data.user?.email) {
        user = { id: data.user.id, email: data.user.email };
        logStep("Authenticated user", { userId: user.id, email: user.email });
      }
    }

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");
    logStep("Price ID received", { priceId, authenticated: !!user, isTestMode });

    // Find existing Stripe customer if user is authenticated
    let customerId: string | undefined;
    if (user) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Existing customer found", { customerId });
      }
    }

    const founderPlan = FOUNDER_PLANS[priceId];

    if (founderPlan) {
      // ── Founder Plan ──
      logStep("Founder plan detected", { tier: founderPlan.tier });

      const sixMonthPriceId = await getOrCreateSixMonthPrice(
        stripe,
        founderPlan.productId,
        founderPlan.amountCents
      );

      const sessionParams: any = {
        line_items: [{ price: sixMonthPriceId, quantity: 1 }],
        mode: "subscription",
        allow_promotion_codes: true,
        success_url: `${origin}/welcome?checkout=success`,
        cancel_url: `${origin}/pricing`,
        subscription_data: {
          metadata: {
            founder: "true",
            tier: founderPlan.tier,
            monthly_price_id: founderPlan.monthlyPriceId,
            ...(user ? { user_id: user.id } : {}),
          },
        },
      };

      if (customerId) {
        sessionParams.customer = customerId;
        sessionParams.metadata = { user_id: user!.id };
      } else if (user) {
        sessionParams.customer_email = user.email;
        sessionParams.metadata = { user_id: user.id };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      logStep("Founder checkout session created", { sessionId: session.id });

      return new Response(
        JSON.stringify({ url: session.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ── Standard plan checkout ──
    const tier = STANDARD_PRICE_TIERS[priceId] || null;
    logStep("Standard plan", { tier });

    const sessionParams: any = {
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing`,
      subscription_data: {
        metadata: {
          ...(tier ? { tier } : {}),
          ...(user ? { user_id: user.id } : {}),
        },
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
      sessionParams.metadata = { user_id: user!.id };
    } else if (user) {
      sessionParams.customer_email = user.email;
      sessionParams.metadata = { user_id: user.id };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
