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
  delivered_only: number;
  opened_only: number;
  clicked: number;
  bounced: number;
};

export type CampaignBreakdown = {
  campaign_id: string;
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
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

export function useNewsletterAnalytics(dateRange: DateRange = "all", agentId?: string) {
  const cutoff = getDateCutoff(dateRange);

  const campaignsQuery = useQuery({
    queryKey: ["newsletter-campaigns", dateRange, agentId],
    queryFn: async () => {
      let q = supabase
        .from("newsletter_campaigns")
        .select("id,campaign_name,send_date,recipient_count,open_rate,click_through_rate,status,created_at,created_by")
        .order("send_date", { ascending: false });

      if (cutoff) q = q.gte("send_date", cutoff);
      if (agentId) q = q.eq("created_by", agentId);

      const { data, error } = await q;
      if (error) throw error;

      // Resolve agent names from created_by
      const campaigns = (data || []) as NewsletterCampaign[];
      const creatorIds = [...new Set(campaigns.map(c => c.created_by).filter(Boolean))] as string[];
      
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", creatorIds);
        
        const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
        for (const c of campaigns) {
          if (c.created_by) c.agent_name = profileMap.get(c.created_by) || undefined;
        }
      }

      return campaigns;
    },
  });

  const emailLogsQuery = useQuery({
    queryKey: ["newsletter-email-logs", dateRange, agentId],
    queryFn: async () => {
      let q = supabase
        .from("email_logs")
        .select("id,status,sent_at,agent_id,email_type,campaign_id")
        .eq("email_type", "newsletter");

      if (cutoff) q = q.gte("sent_at", cutoff);
      if (agentId) q = q.eq("agent_id", agentId);

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
      if (s === "delivered" || s === "sent") stats.delivered++;
      else if (s === "opened") { stats.opened++; stats.delivered++; }
      else if (s === "clicked") { stats.clicked++; stats.opened++; stats.delivered++; }
      else if (s === "bounced") stats.bounced++;
      else if (s === "complained") stats.complained++;
      else if (s === "failed") stats.failed++;
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

  // Mutually exclusive categories for stacked bar chart
  const monthlySeries: MonthlySeriesPoint[] = useMemo(() => {
    const grouped = new Map<string, { total: number; delivered_only: number; opened_only: number; clicked: number; bounced: number }>();

    for (const log of emailLogs) {
      const key = toMonthKey(log.sent_at);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, { total: 0, delivered_only: 0, opened_only: 0, clicked: 0, bounced: 0 });
      const g = grouped.get(key)!;
      g.total++;
      const s = log.status;
      // Mutually exclusive: each email counted in exactly one bucket
      if (s === "clicked") g.clicked++;
      else if (s === "opened") g.opened_only++;
      else if (s === "delivered" || s === "sent") g.delivered_only++;
      else if (s === "bounced") g.bounced++;
    }

    const points = Array.from(grouped.entries()).map(([month, g]) => {
      const totalOpened = g.opened_only + g.clicked;
      const totalDelivered = g.delivered_only + totalOpened;
      return {
        month,
        open_rate: g.total > 0 ? Number(((totalOpened / g.total) * 100).toFixed(1)) : null,
        click_rate: g.total > 0 ? Number(((g.clicked / g.total) * 100).toFixed(1)) : null,
        recipients: g.total,
        delivered_only: g.delivered_only,
        opened_only: g.opened_only,
        clicked: g.clicked,
        bounced: g.bounced,
      };
    });

    points.sort((a, b) => a.month.localeCompare(b.month));
    return points;
  }, [emailLogs]);

  // Per-campaign breakdown from email_logs
  const campaignBreakdowns: Map<string, CampaignBreakdown> = useMemo(() => {
    const map = new Map<string, CampaignBreakdown>();
    for (const log of emailLogs) {
      const cid = log.campaign_id;
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, { campaign_id: cid, total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 });
      const b = map.get(cid)!;
      b.total++;
      const s = log.status;
      if (s === "delivered" || s === "sent") b.delivered++;
      else if (s === "opened") { b.opened++; b.delivered++; }
      else if (s === "clicked") { b.clicked++; b.opened++; b.delivered++; }
      else if (s === "bounced") b.bounced++;
      else if (s === "failed") b.failed++;
    }
    return map;
  }, [emailLogs]);

  return {
    campaigns,
    emailStats,
    metrics,
    monthlySeries,
    campaignBreakdowns,
    isLoading: campaignsQuery.isLoading || emailLogsQuery.isLoading,
    error: campaignsQuery.error || emailLogsQuery.error,
    refetch: () => { campaignsQuery.refetch(); emailLogsQuery.refetch(); },
  };
}
