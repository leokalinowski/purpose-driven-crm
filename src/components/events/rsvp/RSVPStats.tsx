import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface RSVPStatsProps {
  total: number;
  confirmed: number;
  waitlist: number;
  checkedIn: number;
  maxCapacity?: number;
}

export const RSVPStats = ({
  total,
  confirmed,
  waitlist,
  checkedIn,
  maxCapacity,
}: RSVPStatsProps) => {
  const capacityPercentage = maxCapacity
    ? Math.round((confirmed / maxCapacity) * 100)
    : 0;
  const spotsRemaining = maxCapacity ? Math.max(0, maxCapacity - confirmed) : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total RSVPs</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-bold text-green-600">{confirmed}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      {waitlist > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Waitlist</p>
                <p className="text-2xl font-bold text-yellow-600">{waitlist}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Checked In</p>
              <p className="text-2xl font-bold text-blue-600">{checkedIn}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      {maxCapacity && (
        <Card className="col-span-2 md:col-span-4">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Capacity</span>
                <span className="text-muted-foreground">
                  {confirmed} / {maxCapacity} ({capacityPercentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                />
              </div>
              {spotsRemaining !== null && spotsRemaining > 0 && (
                <p className="text-sm text-muted-foreground">
                  {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} remaining
                </p>
              )}
              {spotsRemaining === 0 && (
                <p className="text-sm text-yellow-600 font-medium">
                  Event is at capacity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

