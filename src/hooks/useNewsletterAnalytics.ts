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

  // Also fetch monthly runs as fallback data
  const runsQuery = useQuery({
    queryKey: ["monthly-runs-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_runs")
        .select("id,agent_id,emails_sent,contacts_processed,run_date,status,created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const campaigns = query.data ?? [];
  const runs = runsQuery.data ?? [];

  const metrics: NewsletterMetrics = useMemo(() => {
    if (campaigns.length === 0 && runs.length === 0) {
      return { totalCampaigns: 0, totalRecipients: 0, avgOpenRate: null, avgClickRate: null };
    }

    // Prioritize campaign data, fallback to runs data
    if (campaigns.length > 0) {
      const totalCampaigns = campaigns.length;
      const totalRecipients = campaigns.reduce((sum, c) => sum + (c.recipient_count ?? 0), 0);

      const openRates = campaigns.map((c) => c.open_rate).filter((v): v is number => typeof v === "number");
      const clickRates = campaigns
        .map((c) => c.click_through_rate)
        .filter((v): v is number => typeof v === "number");

      const avgOpenRate = openRates.length ? openRates.reduce((a, b) => a + b, 0) / openRates.length : null;
      const avgClickRate = clickRates.length ? clickRates.reduce((a, b) => a + b, 0) / clickRates.length : null;

      return { totalCampaigns, totalRecipients, avgOpenRate, avgClickRate };
    } else {
      // Fallback to runs data
      const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'success');
      const totalCampaigns = completedRuns.length;
      const totalRecipients = completedRuns.reduce((sum, r) => sum + (r.emails_sent ?? 0), 0);
      
      return { totalCampaigns, totalRecipients, avgOpenRate: null, avgClickRate: null };
    }
  }, [campaigns, runs]);

  const monthlySeries: MonthlySeriesPoint[] = useMemo(() => {
    if (campaigns.length === 0 && runs.length === 0) return [];

    const grouped = new Map<string, { open: number[]; click: number[]; recipients: number }>();

    // Process campaigns first
    if (campaigns.length > 0) {
      for (const c of campaigns) {
        const key = toMonthKey(c.send_date);
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, { open: [], click: [], recipients: 0 });
        const g = grouped.get(key)!;
        if (typeof c.open_rate === "number") g.open.push(c.open_rate);
        if (typeof c.click_through_rate === "number") g.click.push(c.click_through_rate);
        g.recipients += c.recipient_count ?? 0;
      }
    } else {
      // Fallback to runs data
      for (const r of runs) {
        const key = toMonthKey(r.run_date);
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, { open: [], click: [], recipients: 0 });
        const g = grouped.get(key)!;
        g.recipients += r.emails_sent ?? 0;
      }
    }

    const points = Array.from(grouped.entries()).map(([month, g]) => ({
      month,
      open_rate: g.open.length ? g.open.reduce((a, b) => a + b, 0) / g.open.length : null,
      click_rate: g.click.length ? g.click.reduce((a, b) => a + b, 0) / g.click.length : null,
      recipients: g.recipients,
    }));

    points.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
    return points;
  }, [campaigns, runs]);

  return {
    ...query,
    campaigns,
    metrics,
    monthlySeries,
    isLoading: query.isLoading || runsQuery.isLoading,
    error: query.error || runsQuery.error,
  };
}
