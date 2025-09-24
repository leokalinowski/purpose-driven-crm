import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, Users, Mail } from 'lucide-react';

interface CostData {
  id: string;
  agent_id: string;
  grok_api_calls: number;
  grok_tokens_used: number;
  estimated_cost: number;
  emails_sent: number;
  zip_codes_processed: number;
  cache_hits: number;
  run_date: string;
  agent_name?: string;
}

interface CostSummary {
  totalCost: number;
  totalCalls: number;
  totalEmails: number;
  totalCacheHits: number;
  avgCostPerEmail: number;
}

export const NewsletterCostTracking: React.FC = () => {
  const { data: costData = [], isLoading } = useQuery({
    queryKey: ['newsletter-cost-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_cost_tracking')
        .select(`
          *,
          agent:profiles!newsletter_cost_tracking_agent_id_fkey(first_name, last_name, email)
        `)
        .order('run_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as (CostData & { agent?: { first_name?: string; last_name?: string; email?: string } })[];
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['newsletter-cost-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_cost_tracking')
        .select('estimated_cost, grok_api_calls, emails_sent, cache_hits');

      if (error) throw error;

      const summary: CostSummary = {
        totalCost: 0,
        totalCalls: 0,
        totalEmails: 0,
        totalCacheHits: 0,
        avgCostPerEmail: 0,
      };

      data?.forEach((row) => {
        summary.totalCost += row.estimated_cost || 0;
        summary.totalCalls += row.grok_api_calls || 0;
        summary.totalEmails += row.emails_sent || 0;
        summary.totalCacheHits += row.cache_hits || 0;
      });

      summary.avgCostPerEmail = summary.totalEmails > 0 ? summary.totalCost / summary.totalEmails : 0;

      return summary;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalCost.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              API Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalCalls.toLocaleString() || '0'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalEmails.toLocaleString() || '0'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Avg Cost/Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.avgCostPerEmail.toFixed(3) || '0.000'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Cost History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cost History</CardTitle>
        </CardHeader>
        <CardContent>
          {costData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cost tracking data available yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">API Calls</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Emails</TableHead>
                    <TableHead className="text-right">ZIP Codes</TableHead>
                    <TableHead className="text-right">Cache Hits</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costData.map((row) => {
                    const agentName = row.agent 
                      ? `${row.agent.first_name || ''} ${row.agent.last_name || ''}`.trim() || row.agent.email
                      : 'Unknown Agent';

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{agentName}</TableCell>
                        <TableCell>{new Date(row.run_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{row.grok_api_calls}</TableCell>
                        <TableCell className="text-right">{row.grok_tokens_used.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.emails_sent}</TableCell>
                        <TableCell className="text-right">{row.zip_codes_processed}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.cache_hits > 0 ? "default" : "secondary"}>
                            {row.cache_hits}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${row.estimated_cost.toFixed(4)}
                        </TableCell>
                      </TableRow>
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
};
