import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

/** Product-to-tier maps for fallback when metadata.tier is missing */
const PRODUCT_TO_TIER_LIVE: Record<string, string> = {
  "prod_U6CZnBRXAi2jey": "core",
  "prod_U6CanelVG5Ilvn": "core",
  "prod_U6Ex7tgKBZtZc5": "core",
  "prod_U6CbXJqnPWpRVp": "managed",
  "prod_U6CctQ78FSyxvp": "managed",
  "prod_U6Eyw4OBAEIm9V": "managed",
};

const PRODUCT_TO_TIER_TEST: Record<string, string> = {
  "prod_U6Jwx4nLCE1I2s": "core",
  "prod_U6JxCNA2455QJe": "core",
  "prod_U6Jx3oB19agtnz": "core",
  "prod_U6JxoQJVRqucDT": "managed",
  "prod_U6JyhK7qt3CK4K": "managed",
  "prod_U6JydMsJcVubkF": "managed",
};

/** Derive tier from a product ID, checking both maps */
function getTierFromProductId(productId: string, isTestMode: boolean): string | null {
  const primary = isTestMode ? PRODUCT_TO_TIER_TEST : PRODUCT_TO_TIER_LIVE;
  const fallback = isTestMode ? PRODUCT_TO_TIER_LIVE : PRODUCT_TO_TIER_TEST;
  return primary[productId] || fallback[productId] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    logStep("ERROR", { message: "STRIPE_SECRET_KEY not set" });
    return new Response("Server error", { status: 500 });
  }

  const isTestMode = stripeKey.startsWith("sk_test_");
  logStep("Mode", { isTestMode });

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;

  if (webhookSecret) {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    try {
      const cryptoProvider = Stripe.createSubtleCryptoProvider();
      event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret, undefined, cryptoProvider);
    } catch (err: any) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  } else {
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

        // Retrieve the subscription to get metadata
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const metadata = subscription.metadata || {};
        const sessionMetadata = session.metadata || {};

        // Determine the tier from subscription metadata, with price-based fallback
        let tier = metadata.tier as string | undefined;
        if (!tier) {
          const subProductId = subscription.items?.data?.[0]?.price?.product;
          if (subProductId) {
            tier = getTierFromProductId(subProductId as string, isTestMode) || undefined;
            logStep("Tier derived from product fallback", { subProductId, tier });
          }
        }
        logStep("Subscription metadata", { metadata, sessionMetadata, tier });

        // ── Founder plan: convert to schedule ──
        if (metadata.founder === "true") {
          logStep("Founder subscription detected, converting to schedule", {
            subscriptionId,
            tier,
            monthlyPriceId: metadata.monthly_price_id,
          });

          const schedule = await stripe.subscriptionSchedules.create({
            from_subscription: subscriptionId,
          });
          logStep("Schedule created from subscription", { scheduleId: schedule.id });

          const currentPhase = schedule.phases[0];
          await stripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: "release",
            phases: [
              {
                items: currentPhase.items.map((item: any) => ({
                  price: item.price,
                  quantity: item.quantity || 1,
                })),
                start_date: currentPhase.start_date,
                end_date: currentPhase.end_date,
                metadata: { founder: "true", tier: tier || "" },
              },
              {
                items: [
                  {
                    price: metadata.monthly_price_id,
                    quantity: 1,
                  },
                ],
                metadata: { transitioned_from_founder: "true", tier: tier || "" },
              },
            ],
          });

          logStep("Schedule updated with monthly transition phase");
        }

        // ── User provisioning ──
        const customerEmail = session.customer_details?.email || session.customer_email;
        const customerName = session.customer_details?.name || "";
        let userId = metadata.user_id || sessionMetadata.user_id;
        let isNewUser = false;

        if (!userId && customerEmail) {
          logStep("Attempting to create/find Supabase user", { email: customerEmail, name: customerName });

          const nameParts = customerName ? customerName.split(" ") : [];
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: customerEmail,
            email_confirm: true,
            user_metadata: {
              first_name: firstName,
              last_name: lastName,
            },
          });

          if (createError) {
            logStep("User creation returned error (likely already exists)", { error: createError.message });
            const { data: allUsers } = await supabase.auth.admin.listUsers();
            const found = allUsers?.users?.find(
              (u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase()
            );
            if (found) {
              userId = found.id;
              logStep("Found existing user by email scan", { userId });
            } else {
              logStep("ERROR: Could not find user even after create conflict", { email: customerEmail });
            }
          } else if (newUser?.user) {
            userId = newUser.user.id;
            isNewUser = true;
            logStep("New user created", { userId });

            const { error: profileError } = await supabase.from("profiles").upsert({
              user_id: userId,
              first_name: firstName || null,
              last_name: lastName || null,
              email: customerEmail,
              role: tier || "core",
            }, { onConflict: "user_id" });

            if (profileError) {
              logStep("ERROR creating profile", { error: profileError.message });
            } else {
              logStep("Profile created for new user");
            }
          }
        }

        // ── Assign role (clean up old subscription roles first) ──
        if (userId && tier && (tier === "core" || tier === "managed")) {
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", userId)
            .in("role", ["core", "managed"]);
          logStep("Cleared old subscription roles", { userId });

          await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: tier, created_by: userId });
          logStep("User role assigned", { userId, role: tier });
        }

        // ── Send confirmation emails (for BOTH new and existing users) ──
        if (customerEmail && tier) {
          try {
            const resendKey = Deno.env.get("RESEND_API_KEY");
            const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@realestateonpurpose.com";
            // Hardcode from name for subscription emails — never use RESEND_FROM_NAME (that's for newsletters)
            const fromName = "Real Estate on Purpose";
            const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

            if (!resendKey) {
              logStep("Resend not configured, skipping confirmation emails");
            } else if (isNewUser) {
              // New user: send password-set email + coaching email
              const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                type: "recovery",
                email: customerEmail,
                options: {
                  redirectTo: "https://hub.realestateonpurpose.com/auth/reset",
                },
              });

              if (linkError) {
                logStep("ERROR generating recovery link", { error: linkError.message });
              } else if (linkData?.properties?.action_link) {
                logStep("Recovery link generated for new user", { email: customerEmail });

                const emailRes = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${resendKey}`,
                  },
                  body: JSON.stringify({
                    from: `${fromName} <${fromEmail}>`,
                    to: [customerEmail],
                    subject: "Welcome to REOP Hub — Set Your Password",
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #1a1a1a;">Welcome to Real Estate on Purpose!</h2>
                        <p style="color: #4a4a4a; line-height: 1.6;">
                          Your <strong>${tierLabel}</strong> subscription is now active. 
                          To get started, please set your password by clicking the button below:
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="${linkData.properties.action_link}" 
                             style="background-color: #0d9488; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Set Your Password
                          </a>
                        </div>
                        <p style="color: #6a6a6a; font-size: 14px; line-height: 1.5;">
                          After setting your password, you can sign in at 
                          <a href="https://hub.realestateonpurpose.com/auth" style="color: #0d9488;">hub.realestateonpurpose.com</a>.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
                        <p style="color: #999; font-size: 12px;">
                          If you didn't sign up for this account, you can safely ignore this email.
                        </p>
                      </div>
                    `,
                  }),
                });

                if (emailRes.ok) {
                  logStep("Welcome/password-set email sent via Resend");
                } else {
                  const errBody = await emailRes.text();
                  logStep("ERROR sending welcome email via Resend", { status: emailRes.status, body: errBody });
                }
              }

              // Fire-and-forget: send coaching email after 2 minutes without blocking the webhook response
              const capturedResendKey = resendKey;
              const capturedFromName = fromName;
              const capturedFromEmail = fromEmail;
              const capturedCustomerEmail = customerEmail;
              const capturedTierLabel = tierLabel;
              setTimeout(async () => {
                try {
                  const coachingRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${capturedResendKey}`,
                    },
                    body: JSON.stringify({
                      from: `${capturedFromName} <${capturedFromEmail}>`,
                      to: [capturedCustomerEmail],
                      subject: "Next Step: Schedule Your Coaching Call with Pam",
                      html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                          <h2 style="color: #1a1a1a;">Let's Get You Started! 🎉</h2>
                          <p style="color: #4a4a4a; line-height: 1.6;">
                            Congratulations on joining the <strong>${capturedTierLabel}</strong> plan! 
                            Your next step is to schedule a one-on-one coaching call with <strong>Pam O'Bryant</strong>.
                          </p>
                          <p style="color: #4a4a4a; line-height: 1.6;">
                            During this call, Pam will walk you through:
                          </p>
                          <ul style="color: #4a4a4a; line-height: 1.8;">
                            <li>Getting your Hub account fully set up</li>
                            <li>Your personalized coaching roadmap</li>
                            <li>How to get the most out of your membership</li>
                          </ul>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="https://lp.realestateonpurpose.com/appointmentwithreop"
                               style="background-color: #0d9488; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                              Schedule Your Call with Pam
                            </a>
                          </div>
                          <p style="color: #6a6a6a; font-size: 14px; line-height: 1.5;">
                            We recommend scheduling as soon as possible so you can hit the ground running.
                          </p>
                          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
                          <p style="color: #999; font-size: 12px;">
                            Real Estate on Purpose · <a href="https://hub.realestateonpurpose.com" style="color: #0d9488;">hub.realestateonpurpose.com</a>
                          </p>
                        </div>
                      `,
                    }),
                  });

                  if (coachingRes.ok) {
                    console.log("[STRIPE-WEBHOOK] Coaching call scheduling email sent via Resend (after 2min delay)");
                  } else {
                    const errBody2 = await coachingRes.text();
                    console.log("[STRIPE-WEBHOOK] ERROR sending coaching email via Resend", JSON.stringify({ status: coachingRes.status, body: errBody2 }));
                  }
                } catch (delayedErr: any) {
                  console.log("[STRIPE-WEBHOOK] ERROR in delayed coaching email", delayedErr.message);
                }
              }, 120_000); // 2 minutes
            } else {
              // Existing user: send subscription confirmation email
              logStep("Sending subscription confirmation to existing user", { email: customerEmail, tier });

              const confirmRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                  from: `${fromName} <${fromEmail}>`,
                  to: [customerEmail],
                  subject: `Your ${tierLabel} Plan is Now Active!`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2 style="color: #1a1a1a;">Your Subscription Has Been Updated! 🎉</h2>
                      <p style="color: #4a4a4a; line-height: 1.6;">
                        Great news — your <strong>${tierLabel}</strong> plan is now active. 
                        You now have access to all the features included in your plan.
                      </p>
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="https://hub.realestateonpurpose.com" 
                           style="background-color: #0d9488; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                          Go to Your Dashboard
                        </a>
                      </div>
                      <p style="color: #6a6a6a; font-size: 14px; line-height: 1.5;">
                        If you have any questions about your plan, feel free to reach out through the 
                        <a href="https://hub.realestateonpurpose.com/support" style="color: #0d9488;">Support</a> page in your dashboard.
                      </p>
                      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
                      <p style="color: #999; font-size: 12px;">
                        Real Estate on Purpose · <a href="https://hub.realestateonpurpose.com" style="color: #0d9488;">hub.realestateonpurpose.com</a>
                      </p>
                    </div>
                  `,
                }),
              });

              if (confirmRes.ok) {
                logStep("Subscription confirmation email sent to existing user");
              } else {
                const errBody = await confirmRes.text();
                logStep("ERROR sending confirmation email", { status: confirmRes.status, body: errBody });
              }
            }
          } catch (emailErr: any) {
            logStep("ERROR in email flow", { error: emailErr.message });
          }
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.user_id;
        if (userId) {
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", userId)
            .in("role", ["core", "managed"]);
          logStep("Subscription cancelled, roles removed", { userId });
        } else {
          const customerId = subscription.customer;
          if (customerId) {
            try {
              const customer = await stripe.customers.retrieve(customerId);
              if (customer && !customer.deleted && (customer as any).email) {
                const email = (customer as any).email;
                const { data: allUsers } = await supabase.auth.admin.listUsers();
                const found = allUsers?.users?.find(
                  (u: any) => u.email?.toLowerCase() === email.toLowerCase()
                );
                if (found) {
                  await supabase
                    .from("user_roles")
                    .delete()
                    .eq("user_id", found.id)
                    .in("role", ["core", "managed"]);
                  logStep("Subscription cancelled (by email lookup), roles removed", { userId: found.id, email });
                }
              }
            } catch (err: any) {
              logStep("ERROR looking up customer for cancellation", { error: err.message });
            }
          }
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
