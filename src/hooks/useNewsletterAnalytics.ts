import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DateRange = "7d" | "30d" | "90d" | "all";

export type NewsletterCampaign = {
  id: string;
  campaign_name: string;
  send_date: string | null;
  recipient_count: number | null;
  open_rate: number | null;
  click_through_rate: number | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
  agent_name?: string;
};

export type EmailLogStats = {
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
};

export type MonthlySeriesPoint = {
  month: string;
  open_rate: number | null;
  click_rate: number | null;
  recipients: number;
  delivered: number;
  opened: number;
  bounced: number;
};

function getDateCutoff(range: DateRange): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function toMonthKey(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function useNewsletterAnalytics(dateRange: DateRange = "all") {
  const cutoff = getDateCutoff(dateRange);

  const campaignsQuery = useQuery({
    queryKey: ["newsletter-campaigns", dateRange],
    queryFn: async () => {
      let q = supabase
        .from("newsletter_campaigns")
        .select("id,campaign_name,send_date,recipient_count,open_rate,click_through_rate,status,created_at,created_by")
        .order("send_date", { ascending: false });

      if (cutoff) q = q.gte("send_date", cutoff);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as NewsletterCampaign[];
    },
  });

  const emailLogsQuery = useQuery({
    queryKey: ["newsletter-email-logs", dateRange],
    queryFn: async () => {
      let q = supabase
        .from("email_logs")
        .select("id,status,sent_at,agent_id,email_type")
        .eq("email_type", "newsletter");

      if (cutoff) q = q.gte("sent_at", cutoff);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const campaigns = campaignsQuery.data ?? [];
  const emailLogs = emailLogsQuery.data ?? [];

  const emailStats: EmailLogStats = useMemo(() => {
    const stats: EmailLogStats = { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, failed: 0 };
    for (const log of emailLogs) {
      stats.total++;
      const s = log.status;
      if (s === "delivered") stats.delivered++;
      else if (s === "opened") { stats.opened++; stats.delivered++; }
      else if (s === "clicked") { stats.clicked++; stats.opened++; stats.delivered++; }
      else if (s === "bounced") stats.bounced++;
      else if (s === "complained") stats.complained++;
      else if (s === "failed") stats.failed++;
      else if (s === "sent") stats.delivered++; // sent but not yet tracked = assume delivered
    }
    return stats;
  }, [emailLogs]);

  const metrics = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const totalDelivered = emailStats.delivered;
    const avgOpenRate = emailStats.total > 0 ? Number(((emailStats.opened / emailStats.total) * 100).toFixed(1)) : null;
    const avgClickRate = emailStats.total > 0 ? Number(((emailStats.clicked / emailStats.total) * 100).toFixed(1)) : null;
    const bounceRate = emailStats.total > 0 ? Number(((emailStats.bounced / emailStats.total) * 100).toFixed(1)) : null;
    const unsubscribes = emailStats.complained;

    return { totalCampaigns, totalDelivered, avgOpenRate, avgClickRate, bounceRate, unsubscribes };
  }, [campaigns, emailStats]);

  const monthlySeries: MonthlySeriesPoint[] = useMemo(() => {
    const grouped = new Map<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number }>();

    for (const log of emailLogs) {
      const key = toMonthKey(log.sent_at);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });
      const g = grouped.get(key)!;
      g.sent++;
      const s = log.status;
      if (s === "delivered" || s === "sent") g.delivered++;
      if (s === "opened" || s === "clicked") { g.opened++; g.delivered++; }
      if (s === "clicked") g.clicked++;
      if (s === "bounced") g.bounced++;
    }

    const points = Array.from(grouped.entries()).map(([month, g]) => ({
      month,
      open_rate: g.sent > 0 ? Number(((g.opened / g.sent) * 100).toFixed(1)) : null,
      click_rate: g.sent > 0 ? Number(((g.clicked / g.sent) * 100).toFixed(1)) : null,
      recipients: g.sent,
      delivered: g.delivered,
      opened: g.opened,
      bounced: g.bounced,
    }));

    points.sort((a, b) => a.month.localeCompare(b.month));
    return points;
  }, [emailLogs]);

  return {
    campaigns,
    emailStats,
    metrics,
    monthlySeries,
    isLoading: campaignsQuery.isLoading || emailLogsQuery.isLoading,
    error: campaignsQuery.error || emailLogsQuery.error,
    refetch: () => { campaignsQuery.refetch(); emailLogsQuery.refetch(); },
  };
}
