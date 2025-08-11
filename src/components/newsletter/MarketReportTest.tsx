
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildMarketReportHTML, monthKey, type MarketStats } from "@/utils/marketReport";

function monthLabel(yyyymm: string) {
  const d = new Date(`${yyyymm}-01T00:00:00Z`);
  if (isNaN(d.getTime())) return yyyymm;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function MarketReportTest() {
  const [zip, setZip] = useState("90210");
  const [month, setMonth] = useState(monthKey());
  const [sending, setSending] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [dataSource, setDataSource] = useState<"sample" | "apify">("sample");
  const [actorId, setActorId] = useState("");
  const { toast } = useToast();

  const subject = useMemo(() => {
    return `${zip} Market Report — ${monthLabel(month)}`;
  }, [zip, month]);

  const onSend = async () => {
    setSending(true);
    try {
      console.log("[MarketReportTest] Starting test send", { zip, month });

      // 1) Fetch or generate market stats via Edge Function
      const body: any = { zip_code: zip, period_month: month, mode: dataSource };
      if (dataSource === "apify" && actorId) {
        body.apify = { actorId };
      }
      const { data: statsResp, error: statsErr } = await supabase.functions.invoke("fetch-market-stats", {
        body,
      });

      if (statsErr) {
        console.error("[MarketReportTest] fetch-market-stats error", statsErr);
        // Continue with placeholders if stats fail
      }

      const statsRow = (statsResp?.data ?? null) as MarketStats | null;

      // 2) Current user email
      const { data: userRes } = await supabase.auth.getUser();
      const toEmail = userRes?.user?.email;
      if (!toEmail) {
        console.warn("[MarketReportTest] No logged-in user email found");
        toast({
          title: "No logged-in user",
          description: "Please sign in to send a test email to your address.",
          variant: "destructive",
        });
        return;
      }

      // 3) Build HTML
      const html = buildMarketReportHTML(zip, {
        zip_code: zip,
        period_month: `${month}-01`,
        median_sale_price: statsRow?.median_sale_price ?? null,
        median_list_price: statsRow?.median_list_price ?? null,
        homes_sold: statsRow?.homes_sold ?? null,
        new_listings: statsRow?.new_listings ?? null,
        median_dom: statsRow?.median_dom ?? null,
        avg_price_per_sqft: statsRow?.avg_price_per_sqft ?? null,
        inventory: statsRow?.inventory ?? null,
      });

      // 4) Send via existing send-email function
      const { data: sendRes, error: sendErr } = await supabase.functions.invoke("send-email", {
        body: {
          to: toEmail,
          subject,
          html,
        },
      });

      if (sendErr) {
        console.error("[MarketReportTest] send-email error", sendErr);
        toast({
          title: "Failed to send email",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      console.log("[MarketReportTest] send-email response", sendRes);

      toast({
        title: "Test email sent",
        description: `We sent the ${zip} Market Report for ${monthLabel(month)} to ${toEmail}.`,
      });
    } catch (err) {
      console.error("[MarketReportTest] Unexpected error", err);
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const onSendToContactsInZip = async () => {
    setSendingBatch(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user) {
        toast({
          title: "No logged-in user",
          description: "Please sign in to send emails to your contacts.",
          variant: "destructive",
        });
        return;
      }

      const payload: any = {
        period_month: month,
        mode: dataSource,
        zip_filter: [zip],
      };
      if (dataSource === "apify" && actorId) {
        payload.apify = { actorId };
      }

      const { data, error } = await supabase.functions.invoke("market-report-send", {
        body: payload,
      });

      if (error) {
        console.error("[MarketReportTest] market-report-send error", error);
        toast({
          title: "Failed to send to contacts",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Market reports sent",
        description: `Sent ${data?.sent ?? 0} of ${data?.recipients ?? 0} emails for ${zip}.`,
      });
    } catch (err) {
      console.error("[MarketReportTest] Unexpected error (batch)", err);
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
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
          <label className="text-sm text-muted-foreground mb-1">Data source</label>
          <Select value={dataSource} onValueChange={(v) => setDataSource(v as any)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sample">Sample</SelectItem>
              <SelectItem value="apify">Apify</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="actor" className="text-sm text-muted-foreground mb-1">
            Apify Actor ID
          </label>
          <Input
            id="actor"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            placeholder="e.g., user/actor"
            className="w-full"
            disabled={dataSource !== "apify"}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={onSend} disabled={sending || !/^\d{5}$/.test(zip)} className="w-full">
            {sending ? "Sending..." : "Send Test Email"}
          </Button>
          <Button
            variant="secondary"
            onClick={onSendToContactsInZip}
            disabled={sendingBatch || !/^\d{5}$/.test(zip)}
            className="w-full"
          >
            {sendingBatch ? "Sending..." : "Send to Contacts in ZIP"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
