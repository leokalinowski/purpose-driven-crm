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
 * Founder plan configuration.
 */
const FOUNDER_PLANS: Record<
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

/** Map standard price IDs to their tier */
const STANDARD_PRICE_TIERS: Record<string, string> = {
  // Core monthly
  "price_1T809vQGA8aVyaHSqHxPGZVH": "core",
  // Core annual
  "price_1T80BTQGA8aVyaHSwA5MG8Wx": "core",
  // Managed monthly
  "price_1T80CiQGA8aVyaHSTcBId8Ss": "managed",
  // Managed annual
  "price_1T80DBQGA8aVyaHSXggTaq9Z": "managed",
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
    logStep("Price ID received", { priceId, authenticated: !!user });

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
        success_url: `${origin}/pricing?checkout=success`,
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
      // If unauthenticated: no customer_email, Stripe Checkout collects it

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
    // If unauthenticated: no customer_email set, Stripe collects it

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
