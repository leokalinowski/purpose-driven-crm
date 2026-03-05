import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Target, TrendingDown, Database } from 'lucide-react';
import type { BlockThreeOpportunity } from '@/hooks/useDashboardBlocks';

interface Props {
  data: BlockThreeOpportunity;
}

export function TransactionOpportunity({ data }: Props) {
  const { databaseSize, annualTarget, monthlyTarget, currentYearTransactions, gap, potentialGCI, progressPct } = data;

  return (
    <Card className={gap > 0 ? 'border-destructive/30' : 'border-green-300'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Transaction Opportunity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Database className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-2xl font-bold">{databaseSize.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Contacts</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Target className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-2xl font-bold">{annualTarget}</div>
            <p className="text-xs text-muted-foreground">Annual Target</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{monthlyTarget}</div>
            <p className="text-xs text-muted-foreground">Monthly Target</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{currentYearTransactions}</div>
            <p className="text-xs text-muted-foreground">This Year</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Year-to-date progress</span>
            <span className="font-semibold">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-3" />
        </div>

        {gap > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {gap} transaction{gap !== 1 ? 's' : ''} going to other agents
              </p>
              <p className="text-xs text-muted-foreground">
                Potential GCI you're leaving on the table:{' '}
                <span className="font-bold text-destructive">${potentialGCI.toLocaleString()}</span>
              </p>
            </div>
          </div>
        )}

        {gap === 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <DollarSign className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm font-medium text-primary">You're on track! Keep it up! 🎉</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
