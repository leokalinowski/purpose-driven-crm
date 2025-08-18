import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineMetrics as PipelineMetricsType } from "@/hooks/usePipeline";
import { DollarSign, Target, Clock, TrendingUp } from "lucide-react";

interface PipelineMetricsProps {
  metrics: PipelineMetricsType;
  loading: boolean;
}

export function PipelineMetrics({ metrics, loading }: PipelineMetricsProps) {
  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted animate-pulse rounded w-20" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded w-16 mb-1" />
              <div className="h-3 bg-muted animate-pulse rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/50 hover:border-border transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold text-foreground break-all">
            {formatValue(metrics.pipelineValue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            Active opportunities
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 hover:border-border transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          <Target className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {metrics.winRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            {metrics.closedDeals} of {metrics.totalOpportunities} closed
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 hover:border-border transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg Close Time</CardTitle>
          <Clock className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {metrics.avgCloseTime.toFixed(0)} days
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            Average time to close
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 hover:border-border transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Deals</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {metrics.totalOpportunities}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            All opportunities
          </p>
        </CardContent>
      </Card>
    </div>
  );
}