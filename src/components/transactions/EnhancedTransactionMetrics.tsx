import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TransactionMetrics } from "@/hooks/useTransactions";
import { 
  Home, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Building,
  UserCheck
} from "lucide-react";

interface EnhancedTransactionMetricsProps {
  metrics: TransactionMetrics;
  loading?: boolean;
}

export function EnhancedTransactionMetrics({ metrics, loading }: EnhancedTransactionMetricsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);

  const formatNumber = (value: number, decimals = 0) => 
    new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Enhanced Property Metrics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Days on Market</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.avgDaysOnMarket)}
          </div>
          <p className="text-xs text-muted-foreground">
            Average market time
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Price/SqFt</CardTitle>
          <Home className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.avgPricePerSqft > 0 ? formatCurrency(metrics.avgPricePerSqft) : '$0'}
          </div>
          <p className="text-xs text-muted-foreground">
            Per square foot value
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.avgCommissionRate > 0 ? `${formatNumber(metrics.avgCommissionRate, 1)}%` : '0%'}
          </div>
          <p className="text-xs text-muted-foreground">
            Average commission
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Deal Velocity</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.dealVelocity)}
          </div>
          <p className="text-xs text-muted-foreground">
            Avg days to close
          </p>
        </CardContent>
      </Card>

      {/* Property Type Breakdown */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building className="h-4 w-4" />
            Property Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.propertyTypeBreakdown).length > 0 ? (
              Object.entries(metrics.propertyTypeBreakdown)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6)
                .map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}: {count}
                  </Badge>
                ))
            ) : (
              <p className="text-sm text-muted-foreground">No property type data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lead Source Breakdown */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Lead Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.leadSourceBreakdown).length > 0 ? (
              Object.entries(metrics.leadSourceBreakdown)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6)
                .map(([source, count]) => (
                  <Badge key={source} variant="outline" className="text-xs">
                    {source}: {count}
                  </Badge>
                ))
            ) : (
              <p className="text-sm text-muted-foreground">No lead source data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk Factors Alert */}
      {metrics.riskFactorCount > 0 && (
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-amber-600">
                {metrics.riskFactorCount}
              </div>
              <p className="text-sm text-muted-foreground">
                Total risk factors across all active transactions requiring attention
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}