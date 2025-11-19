import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "@/components/layout/Layout";
import { useNewsletterAnalytics } from "@/hooks/useNewsletterAnalytics";
import { NewsletterPreview } from "@/components/newsletter/NewsletterPreview";
import { Eye } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  // Assume DB stores as percentage 0-100. If it's 0-1, multiply by 100 here.
  const v = value;
  return `${v.toFixed(1)}%`;
}

export default function Newsletter() {
  const { campaigns, metrics, monthlySeries, isLoading, error } = useNewsletterAnalytics();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Layout>
      <Helmet>
        <title>Newsletter Analytics Dashboard</title>
        <meta
          name="description"
          content="Newsletter analytics: campaigns, open rate, click-through rate, and recipients overview."
        />
        <link rel="canonical" href={`${window.location.origin}/newsletter`} />
      </Helmet>

      <div className="space-y-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Newsletter Analytics</h1>
          <Button 
            onClick={() => setShowPreview(true)}
            variant="outline"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview Newsletter
          </Button>
        </header>

        {error ? (
          <Card className="mb-4">
            <CardContent className="pt-6 text-destructive">
              Failed to load analytics: {String(error.message ?? error)}
            </CardContent>
          </Card>
        ) : null}

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-5 w-28 mb-2" />
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalCampaigns}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalRecipients.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercent(metrics.avgOpenRate)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Click-Through</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercent(metrics.avgClickRate)}</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Trend Chart */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : monthlySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available yet.</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <AreaChart data={monthlySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorClick" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: any) => (typeof v === "number" ? `${v.toFixed(1)}%` : v)} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="open_rate"
                      name="Open Rate"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorOpen)"
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="click_rate"
                      name="Click Rate"
                      stroke="hsl(var(--accent))"
                      fillOpacity={1}
                      fill="url(#colorClick)"
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaigns Table */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Send Date</TableHead>
                      <TableHead className="text-right">Recipients</TableHead>
                      <TableHead className="text-right">Open Rate</TableHead>
                      <TableHead className="text-right">Click Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.campaign_name}</TableCell>
                        <TableCell>
                          {c.send_date ? new Date(c.send_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {(c.recipient_count ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{formatPercent(c.open_rate)}</TableCell>
                        <TableCell className="text-right">{formatPercent(c.click_through_rate)}</TableCell>
                        <TableCell>{c.status ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Newsletter Preview Dialog */}
        <NewsletterPreview 
          open={showPreview} 
          onOpenChange={setShowPreview}
        />
      </div>
    </Layout>
  );
}