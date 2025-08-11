
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { monthKey } from "@/utils/marketReport";

function monthLabel(yyyymm: string) {
  const d = new Date(`${yyyymm}-01T00:00:00Z`);
  if (isNaN(d.getTime())) return yyyymm;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function fmtUSD(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
}

function fmtInt(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n));
}

function buildTransactionsHTML(zip: string, monthKeyStr: string, txs: any[]) {
  const rows = txs
    .map((t) => {
      const bedsBaths = [t.beds != null ? `${fmtInt(t.beds)} bd` : null, t.baths != null ? `${fmtInt(t.baths)} ba` : null, t.sqft != null ? `${fmtInt(t.sqft)} sqft` : null]
        .filter(Boolean)
        .join(" · ");
      const addr = t.address || "—";
      const price = fmtUSD(t.soldPrice);
      const date = t.soldDate ? new Date(t.soldDate).toLocaleDateString() : "—";
      const link = t.url ? `<a href="${t.url}">View</a>` : "—";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${addr}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${price}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${bedsBaths || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${date}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${link}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${zip} Recent Sales — ${monthLabel(monthKeyStr)}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <h1 style="font-size:20px; margin: 0 0 8px;">${zip} Recent Sales — ${monthLabel(monthKeyStr)}</h1>
    <p style="margin:0 0 16px;">Real, recent transactions fetched via Apify actor.</p>
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th align="left" style="padding:8px;border-bottom:2px solid #000;">Address</th>
          <th align="left" style="padding:8px;border-bottom:2px solid #000;">Sold price</th>
          <th align="left" style="padding:8px;border-bottom:2px solid #000;">Beds/Baths/Sqft</th>
          <th align="left" style="padding:8px;border-bottom:2px solid #000;">Sold date</th>
          <th align="left" style="padding:8px;border-bottom:2px solid #000;">Link</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
</html>`;
}

export default function MarketReportTest() {
  const [zip, setZip] = useState("90210");
  const [month, setMonth] = useState(monthKey());
  const [sending, setSending] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [actorId, setActorId] = useState("maxcopell/zillow-zip-search");
  const [maxWaitSeconds, setMaxWaitSeconds] = useState<number>(30);
  const [advancedInput, setAdvancedInput] = useState<string>("");
  const { toast } = useToast();

  const subject = useMemo(() => {
    return `${zip} Recent Sales — ${monthLabel(month)}`;
  }, [zip, month]);

  const onSend = async () => {
    setSending(true);
    try {
      if (!/^\d{5}$/.test(zip)) {
        toast({ title: "Invalid ZIP", description: "Please enter a 5-digit ZIP code.", variant: "destructive" });
        return;
      }
      if (!actorId.trim()) {
        toast({ title: "Actor ID required", description: "Please enter your Apify Actor ID.", variant: "destructive" });
        return;
      }

      // Optional advanced Apify input
      let apifyInput: any | undefined = undefined;
      if (advancedInput.trim()) {
        try {
          apifyInput = JSON.parse(advancedInput);
        } catch (e: any) {
          toast({ title: "Invalid JSON", description: "Advanced Apify input must be valid JSON.", variant: "destructive" });
          return;
        }
      }

      // Fetch transactions from our Edge Function (Apify-only)
      const { data: txResp, error: txErr } = await supabase.functions.invoke("fetch-zip-transactions", {
        body: {
          zip_code: zip,
          limit: 10,
          apify: { actorId, maxWaitMs: Math.max(0, maxWaitSeconds) * 1000, input: apifyInput },
        },
      });

      if (txErr) {
        console.error("[MarketReportTest] fetch-zip-transactions error", txErr, txResp);
        const msg = (txResp as any)?.error || txErr.message || "Apify did not return transactions within the wait window.";
        toast({ title: "Apify error", description: String(msg).slice(0, 200), variant: "destructive" });
        return;
      }

      const transactions: any[] = (txResp as any)?.transactions ?? [];
      if (!Array.isArray(transactions) || transactions.length === 0) {
        const msg = (txResp as any)?.error || "No recent sales found for this ZIP.";
        toast({ title: "No transactions found", description: String(msg).slice(0, 200), variant: "destructive" });
        return;
      }

      // Current user email
      const { data: userRes } = await supabase.auth.getUser();
      const toEmail = userRes?.user?.email;
      if (!toEmail) {
        toast({ title: "No logged-in user", description: "Please sign in to send a test email.", variant: "destructive" });
        return;
      }

      // Build HTML strictly from real transactions
      const html = buildTransactionsHTML(zip, month, transactions);

      // Send email via edge function
      const { error: sendErr } = await supabase.functions.invoke("send-email", {
        body: { to: toEmail, subject, html },
      });
      if (sendErr) {
        console.error("[MarketReportTest] send-email error", sendErr);
        toast({ title: "Failed to send email", description: "Please try again.", variant: "destructive" });
        return;
      }

      toast({ title: "Test email sent", description: `Sent recent sales for ${zip} to ${toEmail}.` });
    } catch (err) {
      console.error("[MarketReportTest] Unexpected error", err);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const onSendToContactsInZip = async () => {
    setSendingBatch(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user) {
        toast({ title: "No logged-in user", description: "Please sign in to send emails to your contacts.", variant: "destructive" });
        return;
      }

      if (!actorId.trim()) {
        toast({ title: "Actor ID required", description: "Please enter your Apify Actor ID.", variant: "destructive" });
        return;
      }

      const payload: any = {
        period_month: month,
        zip_filter: [zip],
        apify: { actorId, maxWaitMs: Math.max(0, maxWaitSeconds) * 1000, input: advancedInput.trim() ? JSON.parse(advancedInput) : undefined },
      };

      const { data, error } = await supabase.functions.invoke("market-report-send", { body: payload });
      if (error) {
        console.error("[MarketReportTest] market-report-send error", error);
        toast({ title: "Failed to send to contacts", description: "Please try again.", variant: "destructive" });
        return;
      }

      toast({ title: "Market reports sent", description: `Sent ${data?.sent ?? 0} of ${data?.recipients ?? 0} emails for ${zip}.` });
    } catch (err) {
      console.error("[MarketReportTest] Unexpected error (batch)", err);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSendingBatch(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Send Market Report Test</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[1fr_160px_160px_180px_auto]">
        <div className="flex flex-col">
          <label htmlFor="zip" className="text-sm text-muted-foreground mb-1">
            ZIP code
          </label>
          <Input
            id="zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="e.g., 90210"
            maxLength={5}
            className="w-full"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="month" className="text-sm text-muted-foreground mb-1">
            Month (YYYY-MM)
          </label>
          <Input
            id="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM"
            className="w-full"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="actor" className="text-sm text-muted-foreground mb-1">
            Apify Actor ID
          </label>
          <Input
            id="actor"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            placeholder="e.g., maxcopell/zillow-zip-search"
            className="w-full"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="wait" className="text-sm text-muted-foreground mb-1">
            Max wait (seconds)
          </label>
          <Input
            id="wait"
            type="number"
            value={maxWaitSeconds}
            onChange={(e) => setMaxWaitSeconds(Number(e.target.value) || 0)}
            min={5}
            max={60}
            className="w-full"
          />
        </div>
        <div className="flex flex-col md:col-span-5">
          <label htmlFor="advanced" className="text-sm text-muted-foreground mb-1">
            Advanced Apify input (JSON, optional)
          </label>
          <Textarea
            id="advanced"
            value={advancedInput}
            onChange={(e) => setAdvancedInput(e.target.value)}
            placeholder='{"zipCodes":["90210"],"sold":true}'
            rows={4}
            className="w-full"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={onSend} disabled={sending || !/^\d{5}$/.test(zip) || !actorId.trim()} className="w-full">
            {sending ? "Sending..." : "Send Test Email"}
          </Button>
          <Button
            variant="secondary"
            onClick={onSendToContactsInZip}
            disabled={sendingBatch || !/^\d{5}$/.test(zip) || !actorId.trim()}
            className="w-full"
          >
            {sendingBatch ? "Sending..." : "Send to Contacts in ZIP"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
