import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Home, Target, BarChart3 } from "lucide-react";
import { TransactionMetrics as Metrics } from "@/hooks/useTransactions";

interface TransactionMetricsProps {
  metrics: Metrics;
  loading: boolean;
}

export function TransactionMetrics({ metrics, loading }: TransactionMetricsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const metricCards = [
    {
      title: "Total Sales (YTD)",
      value: formatCurrency(metrics.totalSalesYear),
      icon: DollarSign,
      trend: null,
    },
    {
      title: "Monthly Sales",
      value: formatCurrency(metrics.totalSalesMonth),
      icon: TrendingUp,
      trend: {
        value: formatPercentage(metrics.monthlyChange),
        positive: metrics.monthlyChange >= 0,
      },
    },
    {
      title: "Transactions (YTD)",
      value: metrics.transactionsYear.toString(),
      icon: Home,
      trend: null,
    },
    {
      title: "GCI (YTD)",
      value: formatCurrency(metrics.gciYear),
      icon: Target,
      trend: null,
    },
    {
      title: "Ongoing Deals",
      value: metrics.ongoing.toString(),
      icon: BarChart3,
      trend: null,
    },
    {
      title: "Closing Rate",
      value: `${metrics.closingRate.toFixed(1)}%`,
      icon: TrendingUp,
      trend: null,
    },
    {
      title: "Avg Deal Value",
      value: formatCurrency(metrics.avgDealValue),
      icon: DollarSign,
      trend: null,
    },
    {
      title: "Pipeline Value",
      value: formatCurrency(metrics.pipelineValue),
      icon: Target,
      trend: null,
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 bg-muted rounded w-24"></div>
              </CardTitle>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-20 mb-1"></div>
              <div className="h-3 bg-muted rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metricCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.trend && (
                <p className={`text-xs flex items-center ${
                  card.trend.positive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.trend.positive ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {card.trend.value} from last month
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}