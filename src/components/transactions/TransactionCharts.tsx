import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Bar, BarChart } from "recharts";
import { Transaction } from "@/hooks/useTransactions";
import { format, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns";

interface TransactionChartsProps {
  transactions: Transaction[];
  loading: boolean;
}

export function TransactionCharts({ transactions, loading }: TransactionChartsProps) {
  const generateChartData = () => {
    console.log('=== Chart Data Debug ===');
    console.log('Total transactions for charts:', transactions.length);
    
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 5);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      
      // For charts, show closed transactions by closing date
      const closedTransactions = transactions.filter(t => {
        if (!t.closing_date || t.transaction_stage !== 'closed') return false;
        const closeDate = new Date(t.closing_date);
        return closeDate >= monthStart && closeDate <= monthEnd;
      });

      // Also show under contract transactions by contract date for pipeline view
      const contractedTransactions = transactions.filter(t => {
        if (!t.contract_date || t.transaction_stage !== 'under_contract') return false;
        const contractDate = new Date(t.contract_date);
        return contractDate >= monthStart && contractDate <= monthEnd;
      });

      const totalSales = closedTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);
      const totalGCI = closedTransactions.reduce((sum, t) => sum + (t.gci || 0), 0);
      const closedCount = closedTransactions.length;
      const contractedCount = contractedTransactions.length;

      const monthData = {
        month: format(month, 'MMM'),
        sales: totalSales,
        gci: totalGCI,
        count: closedCount,
        contracted: contractedCount, // Add contracted transactions for additional insight
      };

      console.log(`${format(month, 'MMM')} data:`, monthData);
      return monthData;
    });
  };

  const chartConfig = {
    sales: {
      label: "Sales",
      color: "hsl(var(--primary))",
    },
    gci: {
      label: "GCI",
      color: "hsl(var(--secondary))",
    },
    count: {
      label: "Transactions",
      color: "hsl(var(--accent))",
    },
  };

  if (loading) {
    return (
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-5 bg-muted rounded w-32"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded"></div>
          </CardContent>
        </Card>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-5 bg-muted rounded w-32"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartData = generateChartData();

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend (6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <LineChart 
              data={chartData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [
                      new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                      }).format(value as number),
                      "Sales"
                    ]}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="var(--color-sales)"
                strokeWidth={2}
                dot={{ fill: "var(--color-sales)", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Count (6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <BarChart 
              data={chartData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [value, "Transactions"]}
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}