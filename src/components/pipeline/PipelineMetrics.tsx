import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineMetrics as PipelineMetricsType } from "@/hooks/usePipeline";
import { DollarSign, Target, Clock, TrendingUp } from "lucide-react";

interface PipelineMetricsProps {
  metrics: PipelineMetricsType;
  loading: boolean;
}

export function PipelineMetrics({ metrics, loading }: PipelineMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${metrics.pipelineValue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Active opportunities value
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.winRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.closedDeals} of {metrics.totalOpportunities} closed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Close Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.avgCloseTime.toFixed(0)} days
          </div>
          <p className="text-xs text-muted-foreground">
            Average time to close
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.totalOpportunities}
          </div>
          <p className="text-xs text-muted-foreground">
            All pipeline opportunities
          </p>
        </CardContent>
      </Card>
    </div>
  );
}