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
      event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
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

        // Determine the tier from subscription metadata
        const tier = metadata.tier as string | undefined;
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

        if (!userId && customerEmail) {
          // Check if a Supabase user already exists with this email
          const { data: existingUsers } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1,
          });

          const existingUser = existingUsers?.users?.find(
            (u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase()
          );

          if (existingUser) {
            userId = existingUser.id;
            logStep("Found existing Supabase user by email", { userId, email: customerEmail });
          } else {
            // Create a new user account (bypasses validate_invited_signup trigger)
            logStep("Creating new Supabase user", { email: customerEmail, name: customerName });

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
              logStep("ERROR creating user", { error: createError.message });
              // If user already exists error, try to find them
              if (createError.message?.includes("already")) {
                const { data: allUsers } = await supabase.auth.admin.listUsers();
                const found = allUsers?.users?.find(
                  (u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase()
                );
                if (found) {
                  userId = found.id;
                  logStep("Found user after create conflict", { userId });
                }
              }
              if (!userId) break;
            } else if (newUser?.user) {
              userId = newUser.user.id;
              logStep("New user created", { userId });

              // Create profile row
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

              // Send password reset email so user can set their password
              try {
                const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                  type: "recovery",
                  email: customerEmail,
                  options: {
                    redirectTo: "https://hub.realestateonpurpose.com/auth/reset",
                  },
                });

                if (linkError) {
                  logStep("ERROR generating recovery link", { error: linkError.message });
                } else {
                  logStep("Recovery link generated for new user", {
                    email: customerEmail,
                  });

                  // Send email via Resend with the recovery link
                  const resendKey = Deno.env.get("RESEND_API_KEY");
                  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@realestateonpurpose.com";
                  const fromName = Deno.env.get("RESEND_FROM_NAME") || "Real Estate on Purpose";

                  if (resendKey && linkData?.properties?.action_link) {
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
                              Your <strong>${(tier || "core").charAt(0).toUpperCase() + (tier || "core").slice(1)}</strong> subscription is now active. 
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
                      logStep("ERROR sending email via Resend", { status: emailRes.status, body: errBody });
                    }
                  } else {
                    logStep("Resend not configured or no action_link, skipping email");
                  }
                }
              } catch (emailErr: any) {
                logStep("ERROR in recovery email flow", { error: emailErr.message });
              }
            }
          }
        }

        // ── Assign role ──
        if (userId && tier && (tier === "core" || tier === "managed")) {
          await supabase
            .from("user_roles")
            .upsert(
              { user_id: userId, role: tier, created_by: userId },
              { onConflict: "user_id,role" }
            );
          logStep("User role assigned", { userId, role: tier });
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
          // Try to find user by customer email
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
