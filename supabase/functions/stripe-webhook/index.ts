import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    logStep("ERROR", { message: "STRIPE_SECRET_KEY not set" });
    return new Response("Server error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;

  if (webhookSecret) {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    try {
      event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
    } catch (err: any) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  } else {
    // Fallback: trust the event (for testing only)
    logStep("WARNING: No STRIPE_WEBHOOK_SECRET set, skipping signature verification");
    const body = await req.text();
    event = JSON.parse(body);
  }

  logStep("Event received", { type: event.type, id: event.id });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const subscriptionId = session.subscription;
        if (!subscriptionId) {
          logStep("No subscription in session, skipping");
          break;
        }

        // Retrieve the subscription to check founder metadata
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const metadata = subscription.metadata || {};

        if (metadata.founder === "true") {
          logStep("Founder subscription detected, converting to schedule", {
            subscriptionId,
            tier: metadata.tier,
            monthlyPriceId: metadata.monthly_price_id,
          });

          // Convert existing subscription into a subscription schedule
          const schedule = await stripe.subscriptionSchedules.create({
            from_subscription: subscriptionId,
          });
          logStep("Schedule created from subscription", { scheduleId: schedule.id });

          // The schedule has one phase (the current 6-month founder phase).
          // Add phase 2: regular monthly pricing after the founder phase ends.
          const currentPhase = schedule.phases[0];
          await stripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: "release", // subscription continues after schedule ends
            phases: [
              {
                items: currentPhase.items.map((item: any) => ({
                  price: item.price,
                  quantity: item.quantity || 1,
                })),
                start_date: currentPhase.start_date,
                end_date: currentPhase.end_date,
                metadata: { founder: "true", tier: metadata.tier },
              },
              {
                items: [
                  {
                    price: metadata.monthly_price_id,
                    quantity: 1,
                  },
                ],
                metadata: { transitioned_from_founder: "true", tier: metadata.tier },
              },
            ],
          });

          logStep("Schedule updated with monthly transition phase", {
            scheduleId: schedule.id,
            monthlyPriceId: metadata.monthly_price_id,
          });
        }

        // Update user role based on subscription
        const userId = metadata.user_id || session.metadata?.user_id;
        if (userId) {
          const tier = metadata.tier;
          if (tier === "core" || tier === "managed") {
            // Upsert user role
            const { error } = await supabase.rpc("has_role", {
              _user_id: userId,
              _role: tier,
            });
            // Insert the role if not exists
            await supabase
              .from("user_roles")
              .upsert(
                { user_id: userId, role: tier, created_by: userId },
                { onConflict: "user_id,role" }
              );
            logStep("User role updated", { userId, role: tier });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.user_id;
        if (userId) {
          // Remove subscription roles
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", userId)
            .in("role", ["core", "managed"]);
          logStep("Subscription cancelled, roles removed", { userId });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR processing event", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
