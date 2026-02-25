import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNewsletterAnalytics, DateRange, CampaignBreakdown } from "@/hooks/useNewsletterAnalytics";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Send, MailOpen, MousePointerClick, AlertTriangle, Ban,
  RefreshCw, ChevronDown, ChevronRight, Download,
} from "lucide-react";

function formatPercent(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(mo, 10) - 1]} ${y}`;
}

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  sending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  draft: "bg-muted text-muted-foreground",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const ranges: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function exportCampaignsToCSV(campaigns: any[]) {
  const headers = ["Campaign", "Send Date", "Recipients", "Open Rate", "Click Rate", "Status", "Agent"];
  const rows = campaigns.map(c => [
    c.campaign_name,
    c.send_date ? new Date(c.send_date).toLocaleDateString() : "",
    c.recipient_count ?? 0,
    c.open_rate != null ? `${c.open_rate}%` : "",
    c.click_through_rate != null ? `${c.click_through_rate}%` : "",
    c.status ?? "",
    c.agent_name ?? "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `newsletter-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function NewsletterAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const { campaigns, emailStats, metrics, monthlySeries, campaignBreakdowns, isLoading, error, refetch } = useNewsletterAnalytics(dateRange);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {ranges.map((r) => (
            <Button
              key={r.value}
              variant={dateRange === r.value ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setDateRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6 text-destructive text-sm">
            Failed to load analytics: {String((error as any)?.message ?? error)}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-5 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <KPICard title="Campaigns Sent" value={metrics.totalCampaigns} icon={<Send className="h-4 w-4" />} />
            <KPICard title="Emails Delivered" value={metrics.totalDelivered.toLocaleString()} icon={<MailOpen className="h-4 w-4" />} />
            <KPICard title="Avg Open Rate" value={formatPercent(metrics.avgOpenRate)} icon={<MailOpen className="h-4 w-4" />} />
            <KPICard title="Avg Click Rate" value={formatPercent(metrics.avgClickRate)} icon={<MousePointerClick className="h-4 w-4" />} />
            <KPICard title="Bounce Rate" value={formatPercent(metrics.bounceRate)} icon={<AlertTriangle className="h-4 w-4" />} negative />
            <KPICard title="Complaints" value={metrics.unsubscribes} icon={<Ban className="h-4 w-4" />} negative />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open & Click Rate Trends</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : monthlySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data available yet.</p>
            ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <AreaChart data={monthlySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradOpen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradClick" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any) => (typeof v === "number" ? `${v.toFixed(1)}%` : v)}
                      labelFormatter={formatMonth}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="open_rate" name="Open Rate" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#gradOpen)" connectNulls />
                    <Area type="monotone" dataKey="click_rate" name="Click Rate" stroke="hsl(var(--accent))" fillOpacity={1} fill="url(#gradClick)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Email Volume by Month</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : monthlySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data available yet.</p>
            ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={monthlySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={formatMonth} />
                    <Legend />
                    <Bar dataKey="delivered_only" name="Delivered" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="opened_only" name="Opened" stackId="a" fill="hsl(142 76% 36%)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="clicked" name="Clicked" stackId="a" fill="hsl(221 83% 53%)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="bounced" name="Bounced" stackId="a" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Campaign Performance</CardTitle>
          {campaigns.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCampaignsToCSV(campaigns)}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Send Date</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead className="text-right">Click Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => {
                    const isExpanded = expandedCampaign === c.id;
                    const breakdown = campaignBreakdowns.get(c.id);
                    return (
                      <React.Fragment key={c.id}>
                        <TableRow
                          className="group cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedCampaign(isExpanded ? null : c.id)}
                        >
                          <TableCell className="w-8 px-2">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{c.campaign_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.agent_name || "—"}</TableCell>
                          <TableCell className="text-sm">{c.send_date ? new Date(c.send_date).toLocaleDateString() : "—"}</TableCell>
                          <TableCell className="text-right">{(c.recipient_count ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatPercent(c.open_rate)}</TableCell>
                          <TableCell className="text-right">{formatPercent(c.click_through_rate)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-xs ${statusColors[c.status ?? ""] ?? ""}`}>
                              {c.status ?? "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={8} className="py-3 px-6">
                              {breakdown ? (
                                <CampaignDrillDown breakdown={breakdown} />
                              ) : (
                                <p className="text-xs text-muted-foreground">No email-level tracking data available for this campaign yet.</p>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignDrillDown({ breakdown }: { breakdown: CampaignBreakdown }) {
  const items = [
    { label: "Total Sent", value: breakdown.total, color: "text-foreground" },
    { label: "Delivered", value: breakdown.delivered, color: "text-primary" },
    { label: "Opened", value: breakdown.opened, color: "text-green-600" },
    { label: "Clicked", value: breakdown.clicked, color: "text-blue-600" },
    { label: "Bounced", value: breakdown.bounced, color: "text-destructive" },
    { label: "Failed", value: breakdown.failed, color: "text-destructive" },
  ];
  return (
    <div className="flex flex-wrap gap-6">
      {items.map(it => (
        <div key={it.label} className="text-center">
          <p className={`text-lg font-semibold ${it.color}`}>{it.value}</p>
          <p className="text-xs text-muted-foreground">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

function KPICard({ title, value, icon, negative }: { title: string; value: string | number; icon: React.ReactNode; negative?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <span className={negative ? "text-destructive/60" : "text-primary/60"}>{icon}</span>
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
