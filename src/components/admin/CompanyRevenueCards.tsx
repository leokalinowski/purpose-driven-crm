import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Briefcase, Target, PiggyBank, Users } from 'lucide-react';
import { useCompanyRevenue } from '@/hooks/useCompanyRevenue';

export function CompanyRevenueCards() {
  const { metrics, loading } = useCompanyRevenue();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 rounded bg-muted animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total GCI (YTD)',
      value: formatCurrency(metrics.ytdGCI),
      icon: DollarSign,
      subtext: `${metrics.ytdTransactions} transactions`,
      trend: metrics.ytdVsPriorYear,
      trendLabel: 'vs last year',
    },
    {
      title: 'REOP Revenue (20%)',
      value: formatCurrency(metrics.reopRevenue),
      icon: PiggyBank,
      subtext: 'Company rake',
      trend: null,
    },
    {
      title: 'Agent Payout (80%)',
      value: formatCurrency(metrics.agentPayout),
      icon: Users,
      subtext: 'Total commissions',
      trend: null,
    },
    {
      title: 'MTD GCI',
      value: formatCurrency(metrics.mtdGCI),
      icon: Target,
      subtext: `${metrics.mtdTransactions} deals`,
      trend: metrics.mtdVsPriorMonth,
      trendLabel: 'vs last month',
    },
    {
      title: 'Total Sales Volume',
      value: formatCurrency(metrics.ytdSalesVolume),
      icon: Briefcase,
      subtext: 'YTD property value',
      trend: null,
    },
    {
      title: 'Avg Deal Size',
      value: formatCurrency(metrics.avgDealSize),
      icon: TrendingUp,
      subtext: 'Per transaction',
      trend: null,
    },
    {
      title: 'Buyer Side GCI',
      value: formatCurrency(metrics.buyerSideGCI),
      icon: DollarSign,
      subtext: `${metrics.buyerSideCount} transactions`,
      trend: null,
    },
    {
      title: 'Seller Side GCI',
      value: formatCurrency(metrics.sellerSideGCI),
      icon: DollarSign,
      subtext: `${metrics.sellerSideCount} transactions`,
      trend: null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Company Revenue</h2>
          <p className="text-muted-foreground">
            Transaction-based financial performance for Real Estate on Purpose
          </p>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const hasTrend = card.trend !== null && card.trend !== undefined;
          const TrendIcon = hasTrend 
            ? (card.trend! >= 0 ? TrendingUp : TrendingDown)
            : null;
          
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {hasTrend && TrendIcon && (
                    <>
                      <TrendIcon 
                        className={`h-3 w-3 ${
                          card.trend! >= 0 ? 'text-green-500' : 'text-red-500'
                        }`} 
                      />
                      <span className={card.trend! >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {formatPercent(card.trend!)}
                      </span>
                      <span>{card.trendLabel}</span>
                    </>
                  )}
                  {!hasTrend && <span>{card.subtext}</span>}
                </div>
                {hasTrend && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.subtext}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
