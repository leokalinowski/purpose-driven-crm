import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NewsletterCampaign = {
  id: string;
  campaign_name: string;
  send_date: string | null; // ISO date string
  recipient_count: number | null;
  open_rate: number | null; // 0-100 or 0-1? Assuming 0-100 percentages
  click_through_rate: number | null; // assuming 0-100 percentages
  status: string | null;
  created_at: string;
  updated_at?: string;
};

export type NewsletterMetrics = {
  totalCampaigns: number;
  totalRecipients: number;
  avgOpenRate: number | null;
  avgClickRate: number | null;
};

export type MonthlySeriesPoint = {
  month: string; // YYYY-MM
  open_rate: number | null;
  click_rate: number | null;
  recipients: number;
};

function toMonthKey(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function useNewsletterAnalytics() {
  const query = useQuery({
    queryKey: ["newsletter-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .select(
          "id,campaign_name,send_date,recipient_count,open_rate,click_through_rate,status,created_at,updated_at"
        )
        .order("send_date", { ascending: false });

      if (error) throw error;
      return (data || []) as NewsletterCampaign[];
    },
  });

  const metrics: NewsletterMetrics = useMemo(() => {
    if (!query.data) return { totalCampaigns: 0, totalRecipients: 0, avgOpenRate: null, avgClickRate: null };

    const totalCampaigns = query.data.length;
    const totalRecipients = query.data.reduce((sum, c) => sum + (c.recipient_count ?? 0), 0);

    const openRates = query.data.map((c) => c.open_rate).filter((v): v is number => typeof v === "number");
    const clickRates = query.data
      .map((c) => c.click_through_rate)
      .filter((v): v is number => typeof v === "number");

    const avgOpenRate = openRates.length ? openRates.reduce((a, b) => a + b, 0) / openRates.length : null;
    const avgClickRate = clickRates.length ? clickRates.reduce((a, b) => a + b, 0) / clickRates.length : null;

    return { totalCampaigns, totalRecipients, avgOpenRate, avgClickRate };
  }, [query.data]);

  const monthlySeries: MonthlySeriesPoint[] = useMemo(() => {
    if (!query.data) return [];

    const grouped = new Map<string, { open: number[]; click: number[]; recipients: number }>();

    for (const c of query.data) {
      const key = toMonthKey(c.send_date);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, { open: [], click: [], recipients: 0 });
      const g = grouped.get(key)!;
      if (typeof c.open_rate === "number") g.open.push(c.open_rate);
      if (typeof c.click_through_rate === "number") g.click.push(c.click_through_rate);
      g.recipients += c.recipient_count ?? 0;
    }

    const points = Array.from(grouped.entries()).map(([month, g]) => ({
      month,
      open_rate: g.open.length ? g.open.reduce((a, b) => a + b, 0) / g.open.length : null,
      click_rate: g.click.length ? g.click.reduce((a, b) => a + b, 0) / g.click.length : null,
      recipients: g.recipients,
    }));

    points.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
    return points;
  }, [query.data]);

  return {
    ...query,
    campaigns: query.data ?? [],
    metrics,
    monthlySeries,
  };
}
